//! Thin data-access layer over the MongoDB driver: typed collections,
//! indexes, sequence counters and multi-document transactions.

use crate::error::{AppError, AppResult};
use crate::model::costing::QuotationDoc;
use crate::model::finance::{default_categories, ExpenseCategory, Party, Transaction};
use crate::model::inventory::{Material, StockMovement};
use crate::model::payroll::{PayrollAdjustmentDoc, PayrollRun};
use crate::model::production::{ProductionEntry, ProductionOrder};
use crate::model::settings::CompanySettingsDoc;
use crate::model::workers::{AttendanceRecord, SalaryAdvance, SalaryPayment, Worker};
use futures_util::TryStreamExt;
use mongodb::{
    bson::{doc, Document},
    error::{TRANSIENT_TRANSACTION_ERROR, UNKNOWN_TRANSACTION_COMMIT_RESULT},
    options::{IndexOptions, ReturnDocument},
    Client, ClientSession, Collection, Database, IndexModel,
};
use serde::{de::DeserializeOwned, Deserialize};

pub mod names {
    pub const TRANSACTIONS: &str = "transactions";
    pub const PARTIES: &str = "parties";
    pub const CATEGORIES: &str = "categories";
    pub const WORKERS: &str = "workers";
    pub const ATTENDANCE: &str = "attendance";
    pub const ADVANCES: &str = "advances";
    pub const SALARY_PAYMENTS: &str = "salary_payments";
    pub const PRODUCTION_ORDERS: &str = "production_orders";
    pub const PRODUCTION_ENTRIES: &str = "production_entries";
    pub const MATERIALS: &str = "materials";
    pub const STOCK_MOVEMENTS: &str = "stock_movements";
    pub const PAYROLL_RUNS: &str = "payroll_runs";
    pub const PAYROLL_ADJUSTMENTS: &str = "payroll_adjustments";
    pub const SETTINGS: &str = "settings";
    pub const QUOTATIONS: &str = "quotations";
    pub const PAPER_RATES: &str = "paper_rates";
    pub const COUNTERS: &str = "counters";
}

/// Handle given to every command: one client (for sessions) + the database.
#[derive(Clone)]
pub struct Store {
    pub client: Client,
    pub db: Database,
}

impl Store {
    pub fn transactions(&self) -> Collection<Transaction> { self.db.collection(names::TRANSACTIONS) }
    pub fn parties(&self) -> Collection<Party> { self.db.collection(names::PARTIES) }
    pub fn categories(&self) -> Collection<ExpenseCategory> { self.db.collection(names::CATEGORIES) }
    pub fn workers(&self) -> Collection<Worker> { self.db.collection(names::WORKERS) }
    pub fn attendance(&self) -> Collection<AttendanceRecord> { self.db.collection(names::ATTENDANCE) }
    pub fn advances(&self) -> Collection<SalaryAdvance> { self.db.collection(names::ADVANCES) }
    pub fn salary_payments(&self) -> Collection<SalaryPayment> { self.db.collection(names::SALARY_PAYMENTS) }
    pub fn production_orders(&self) -> Collection<ProductionOrder> { self.db.collection(names::PRODUCTION_ORDERS) }
    pub fn production_entries(&self) -> Collection<ProductionEntry> { self.db.collection(names::PRODUCTION_ENTRIES) }
    pub fn materials(&self) -> Collection<Material> { self.db.collection(names::MATERIALS) }
    pub fn stock_movements(&self) -> Collection<StockMovement> { self.db.collection(names::STOCK_MOVEMENTS) }
    pub fn payroll_runs(&self) -> Collection<PayrollRun> { self.db.collection(names::PAYROLL_RUNS) }
    pub fn payroll_adjustments(&self) -> Collection<PayrollAdjustmentDoc> { self.db.collection(names::PAYROLL_ADJUSTMENTS) }
    pub fn settings(&self) -> Collection<CompanySettingsDoc> { self.db.collection(names::SETTINGS) }
    pub fn quotations(&self) -> Collection<QuotationDoc> { self.db.collection(names::QUOTATIONS) }
    pub fn paper_rates(&self) -> Collection<Document> { self.db.collection(names::PAPER_RATES) }

    /// Atomically increments and returns a named counter (employee codes, order numbers…).
    pub async fn next_seq(&self, name: &str, start_at: i64) -> AppResult<i64> {
        #[derive(Deserialize)]
        struct Counter {
            value: i64,
        }
        // Seed the counter on first use so codes continue after imported data.
        self.db
            .collection::<Document>(names::COUNTERS)
            .update_one(doc! { "_id": name }, doc! { "$setOnInsert": { "value": start_at } })
            .upsert(true)
            .await?;
        let c = self
            .db
            .collection::<Counter>(names::COUNTERS)
            .find_one_and_update(doc! { "_id": name }, doc! { "$inc": { "value": 1 } })
            .return_document(ReturnDocument::After)
            .await?
            .ok_or_else(|| AppError::Internal("counter missing".into()))?;
        Ok(c.value)
    }

    /// Runs `f` inside a multi-document transaction, retrying on transient errors.
    /// Requires a replica set (MongoDB Atlas always is; local dev uses `--replSet`).
    pub async fn in_transaction<T, F>(&self, mut f: F) -> AppResult<T>
    where
        F: for<'s> FnMut(&'s Store, &'s mut ClientSession) -> futures_util::future::BoxFuture<'s, AppResult<T>>,
    {
        let mut session = self.client.start_session().await?;
        for attempt in 0..3 {
            session.start_transaction().await?;
            match f(self, &mut session).await {
                Ok(v) => loop {
                    match session.commit_transaction().await {
                        Ok(()) => return Ok(v),
                        Err(e) if e.contains_label(UNKNOWN_TRANSACTION_COMMIT_RESULT) => continue,
                        Err(e) => return Err(e.into()),
                    }
                },
                Err(AppError::Mongo(e)) if e.contains_label(TRANSIENT_TRANSACTION_ERROR) && attempt < 2 => {
                    let _ = session.abort_transaction().await;
                    continue;
                }
                Err(e) => {
                    let _ = session.abort_transaction().await;
                    return Err(e);
                }
            }
        }
        Err(AppError::Database("The database was busy. Please try again.".into()))
    }
}

pub async fn find_all<T>(coll: &Collection<T>, filter: Document, sort: Document) -> AppResult<Vec<T>>
where
    T: DeserializeOwned + Send + Sync,
{
    Ok(coll.find(filter).sort(sort).await?.try_collect().await?)
}

/// Unique / lookup indexes. Idempotent; runs on every connect.
pub async fn ensure_indexes(db: &Database) -> AppResult<()> {
    let unique = |keys: Document| IndexModel::builder().keys(keys).options(IndexOptions::builder().unique(true).build()).build();
    let plain = |keys: Document| IndexModel::builder().keys(keys).build();
    let partial_unique = |keys: Document, filter: Document| {
        IndexModel::builder().keys(keys).options(IndexOptions::builder().unique(true).partial_filter_expression(filter).build()).build()
    };

    let tx = db.collection::<Document>(names::TRANSACTIONS);
    tx.create_indexes([
        unique(doc! { "id": 1 }),
        plain(doc! { "date": -1 }),
        plain(doc! { "partyId": 1, "date": -1 }),
        // Vyapar import idempotency: one row per voucher
        partial_unique(doc! { "source": 1, "externalRef": 1 }, doc! { "externalRef": { "$exists": true } }),
    ])
    .await?;
    db.collection::<Document>(names::PARTIES).create_indexes([unique(doc! { "id": 1 }), plain(doc! { "type": 1, "name": 1 })]).await?;
    db.collection::<Document>(names::CATEGORIES).create_indexes([unique(doc! { "id": 1 }), unique(doc! { "direction": 1, "name": 1 })]).await?;
    db.collection::<Document>(names::WORKERS).create_indexes([unique(doc! { "id": 1 }), unique(doc! { "code": 1 })]).await?;
    db.collection::<Document>(names::ATTENDANCE)
        .create_indexes([unique(doc! { "id": 1 }), unique(doc! { "workerId": 1, "date": 1 }), plain(doc! { "date": 1 })])
        .await?;
    db.collection::<Document>(names::ADVANCES).create_indexes([unique(doc! { "id": 1 }), plain(doc! { "workerId": 1, "date": 1 })]).await?;
    db.collection::<Document>(names::SALARY_PAYMENTS)
        .create_indexes([unique(doc! { "id": 1 }), unique(doc! { "workerId": 1, "period": 1 }), plain(doc! { "paidOn": -1 })])
        .await?;
    db.collection::<Document>(names::PRODUCTION_ORDERS)
        .create_indexes([
            unique(doc! { "id": 1 }),
            unique(doc! { "orderNo": 1 }),
            plain(doc! { "stage": 1 }),
            plain(doc! { "dueDate": 1 }),
            plain(doc! { "customer": 1 }),
        ])
        .await?;
    db.collection::<Document>(names::PRODUCTION_ENTRIES)
        .create_indexes([
            unique(doc! { "id": 1 }),
            plain(doc! { "orderId": 1, "date": -1 }),
            plain(doc! { "date": 1 }),
        ])
        .await?;
    db.collection::<Document>(names::MATERIALS)
        .create_indexes([
            unique(doc! { "id": 1 }),
            unique(doc! { "code": 1 }),
            plain(doc! { "category": 1 }),
        ])
        .await?;
    db.collection::<Document>(names::STOCK_MOVEMENTS)
        .create_indexes([
            unique(doc! { "id": 1 }),
            plain(doc! { "materialId": 1, "date": 1 }),
            plain(doc! { "date": -1 }),
            plain(doc! { "orderId": 1 }),
        ])
        .await?;
    db.collection::<Document>(names::PAYROLL_RUNS)
        .create_indexes([
            unique(doc! { "id": 1 }),
            unique(doc! { "period": 1 }),
        ])
        .await?;
    db.collection::<Document>(names::PAYROLL_ADJUSTMENTS)
        .create_indexes([
            unique(doc! { "id": 1 }),
            unique(doc! { "period": 1, "workerId": 1 }),
        ])
        .await?;
    db.collection::<Document>(names::SETTINGS)
        .create_indexes([unique(doc! { "id": 1 })])
        .await?;
    db.collection::<Document>(names::QUOTATIONS)
        .create_indexes([
            unique(doc! { "id": 1 }),
            plain(doc! { "quotationNumber": 1 }),
            plain(doc! { "date": -1 }),
        ])
        .await?;
    db.collection::<Document>(names::PAPER_RATES)
        .create_indexes([unique(doc! { "id": 1 })])
        .await?;
    Ok(())
}

/// Reference data a fresh database needs (category list).
pub async fn seed_defaults(db: &Database) -> AppResult<()> {
    let cats = db.collection::<ExpenseCategory>(names::CATEGORIES);
    if cats.count_documents(doc! {}).await? == 0 {
        cats.insert_many(default_categories()).await?;
    }
    Ok(())
}
