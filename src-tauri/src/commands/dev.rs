//! Development-only helpers. Compiled into debug builds only.

#![cfg(debug_assertions)]

use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::model::finance::{Party, Transaction};
use crate::model::inventory::{Material, StockMovement};
use crate::model::payroll::PayrollRun;
use crate::model::production::{ProductionEntry, ProductionOrder};
use crate::model::workers::{AttendanceRecord, SalaryAdvance, SalaryPayment, Worker};
use crate::store::names;
use mongodb::bson::{doc, Document};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DemoPayload {
    parties: Vec<Party>,
    transactions: Vec<Transaction>,
    workers: Vec<Worker>,
    attendance: Vec<AttendanceRecord>,
    advances: Vec<SalaryAdvance>,
    salary_payments: Vec<SalaryPayment>,
    production_orders: Vec<ProductionOrder>,
    production_entries: Vec<ProductionEntry>,
    materials: Vec<Material>,
    stock_movements: Vec<StockMovement>,
    payroll_runs: Vec<PayrollRun>,
}

#[derive(Serialize)]
pub struct ImportResult {
    collections: Vec<(String, usize)>,
}

/// Loads the UI's demo data into an EMPTY development database so live
/// screens can be reviewed. Refuses to touch collections that already hold data.
#[tauri::command]
pub async fn dev_import_demo(db: State<'_, Db>, payload: DemoPayload) -> AppResult<ImportResult> {
    let s = db.store().await?;
    for name in [
        names::PARTIES,
        names::TRANSACTIONS,
        names::WORKERS,
        names::ATTENDANCE,
        names::ADVANCES,
        names::SALARY_PAYMENTS,
        names::PRODUCTION_ORDERS,
        names::PRODUCTION_ENTRIES,
        names::MATERIALS,
        names::STOCK_MOVEMENTS,
        names::PAYROLL_RUNS,
    ] {
        if s.db.collection::<Document>(name).count_documents(doc! {}).await? > 0 {
            return Err(AppError::Conflict(format!("Collection “{name}” already has data. Demo import only runs on an empty database.")));
        }
    }
    let mut out = vec![];
    macro_rules! put {
        ($coll:expr, $items:expr, $name:expr) => {
            if !$items.is_empty() {
                $coll.insert_many(&$items).await?;
            }
            out.push(($name.to_string(), $items.len()));
        };
    }
    put!(s.parties(), payload.parties, names::PARTIES);
    put!(s.transactions(), payload.transactions, names::TRANSACTIONS);
    put!(s.workers(), payload.workers, names::WORKERS);
    put!(s.attendance(), payload.attendance, names::ATTENDANCE);
    put!(s.advances(), payload.advances, names::ADVANCES);
    put!(s.salary_payments(), payload.salary_payments, names::SALARY_PAYMENTS);
    put!(s.production_orders(), payload.production_orders, names::PRODUCTION_ORDERS);
    put!(s.production_entries(), payload.production_entries, names::PRODUCTION_ENTRIES);
    put!(s.materials(), payload.materials, names::MATERIALS);
    put!(s.stock_movements(), payload.stock_movements, names::STOCK_MOVEMENTS);
    put!(s.payroll_runs(), payload.payroll_runs, names::PAYROLL_RUNS);

    let max_order_no = payload
        .production_orders
        .iter()
        .filter_map(|o| o.order_no.trim_start_matches("PO-").parse::<i64>().ok())
        .max()
        .unwrap_or(1000);
    s.db
        .collection::<Document>(names::COUNTERS)
        .update_one(
            doc! { "_id": "order_no" },
            doc! { "$set": { "value": max_order_no } },
        )
        .upsert(true)
        .await?;

    Ok(ImportResult { collections: out })
}
