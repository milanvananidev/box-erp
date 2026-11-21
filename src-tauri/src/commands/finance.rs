//! Income & Expenses: cash-book entries, parties, categories, dashboard cash flow.

use crate::dates;
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::model::finance::*;
use crate::model::new_id;
use crate::store::{find_all, Store};
use chrono::Duration;
use mongodb::bson::doc;
use tauri::State;

pub(crate) async fn list_transactions(s: &Store, from: Option<&str>, to: Option<&str>) -> AppResult<Vec<Transaction>> {
    let mut filter = doc! { "matchedTo": { "$exists": false } };
    let mut range = doc! {};
    if let Some(f) = from { range.insert("$gte", f); }
    if let Some(t) = to { range.insert("$lte", t); }
    if !range.is_empty() { filter.insert("date", range); }
    find_all(&s.transactions(), filter, doc! { "date": -1, "createdAt": -1 }).await
}

#[tauri::command]
pub async fn transactions_list(db: State<'_, Db>) -> AppResult<Vec<Transaction>> {
    list_transactions(&db.store().await?, None, None).await
}

#[tauri::command]
pub async fn transactions_recent(db: State<'_, Db>, limit: Option<i64>) -> AppResult<Vec<Transaction>> {
    let s = db.store().await?;
    use futures_util::TryStreamExt;
    Ok(s.transactions()
        .find(doc! { "matchedTo": { "$exists": false } })
        .sort(doc! { "date": -1, "createdAt": -1 })
        .limit(limit.unwrap_or(5).clamp(1, 50))
        .await?
        .try_collect()
        .await?)
}

#[tauri::command]
pub async fn parties_list(db: State<'_, Db>) -> AppResult<Vec<Party>> {
    let s = db.store().await?;
    find_all(&s.parties(), doc! {}, doc! { "name": 1 }).await
}

#[tauri::command]
pub async fn categories_list(db: State<'_, Db>) -> AppResult<Vec<ExpenseCategory>> {
    let s = db.store().await?;
    find_all(&s.categories(), doc! {}, doc! { "direction": 1, "name": 1 }).await
}

pub(crate) fn validate_amount(amount: i64) -> AppResult<()> {
    if amount <= 0 { return Err(AppError::Validation("Amount must be greater than zero.".into())); }
    if amount > 100_000_000_000 { return Err(AppError::Validation("Amount looks too large.".into())); }
    Ok(())
}

pub(crate) fn validate_not_future(date: &str, what: &str) -> AppResult<()> {
    if dates::parse(date)? > dates::today() {
        return Err(AppError::Validation(format!("{what} date can't be in the future.")));
    }
    Ok(())
}

pub(crate) async fn create(s: &Store, input: TransactionInput) -> AppResult<Transaction> {
    validate_amount(input.amount)?;
    validate_not_future(&input.date, "Transaction")?;
    let particulars = input.particulars.trim().to_string();
    if particulars.len() < 2 { return Err(AppError::Validation("Describe the transaction.".into())); }
    let cat = s
        .categories()
        .find_one(doc! { "name": &input.category, "direction": if input.direction == Direction::In { "in" } else { "out" } })
        .await?
        .ok_or_else(|| AppError::Validation(format!("Unknown category “{}”.", input.category)))?;
    if cat.treatment == CashTreatment::Advance {
        return Err(AppError::Validation("Salary advances are recorded from Workers & HR → Advances, so they can be recovered in payroll.".into()));
    }
    let party = match input.party_id.as_deref().filter(|p| !p.is_empty()) {
        Some(pid) => {
            let p = s.parties().find_one(doc! { "id": pid }).await?.ok_or_else(|| AppError::Validation("Selected party no longer exists.".into()))?;
            let expected = if input.direction == Direction::In { PartyType::Customer } else { PartyType::Vendor };
            if p.party_type != expected { return Err(AppError::Validation("Party type doesn't match the transaction direction.".into())); }
            Some(p)
        }
        None => None,
    };
    let t = Transaction {
        id: new_id(),
        date: input.date,
        direction: input.direction,
        amount: input.amount,
        category: cat.name,
        treatment: cat.treatment,
        mode: input.mode,
        party_id: party.as_ref().map(|p| p.id.clone()),
        party_name: party.map(|p| p.name),
        particulars,
        reference: input.reference.map(|r| r.trim().to_string()).filter(|r| !r.is_empty()),
        source: TxnSource::Manual,
        external_ref: None,
        matched_to: None,
        origin: None,
        created_at: dates::now_iso(),
    };
    s.transactions().insert_one(&t).await?;
    Ok(t)
}

#[tauri::command]
pub async fn transactions_create(db: State<'_, Db>, input: TransactionInput) -> AppResult<Transaction> {
    create(&db.store().await?, input).await
}

pub(crate) async fn delete(s: &Store, id: &str) -> AppResult<String> {
    let t = s.transactions().find_one(doc! { "id": id }).await?.ok_or_else(|| AppError::NotFound("Transaction no longer exists.".into()))?;
    if t.source == TxnSource::VyaparImport {
        return Err(AppError::Validation("Imported Vyapar entries can't be deleted here. Correct them in Vyapar and re-import.".into()));
    }
    if let Some(o) = &t.origin {
        let place = match o.module.as_str() {
            "advance" => "Workers & HR → Advances",
            "payroll" => "Payroll",
            "inventory" => "Inventory (the inward entry)",
            _ => "the module that created it",
        };
        return Err(AppError::Conflict(format!("This entry was created automatically. Change it from {place}.")));
    }
    s.transactions().delete_one(doc! { "id": id }).await?;
    Ok(id.to_string())
}

#[tauri::command]
pub async fn transactions_delete(db: State<'_, Db>, id: String) -> AppResult<String> {
    delete(&db.store().await?, &id).await
}

/// Same direction and amount, same party (if given), within ±3 days.
pub(crate) async fn similar(s: &Store, input: SimilarInput) -> AppResult<Vec<Transaction>> {
    if input.amount <= 0 { return Ok(vec![]); }
    let d = match dates::parse(&input.date) { Ok(d) => d, Err(_) => return Ok(vec![]) };
    let mut filter = doc! {
        "direction": if input.direction == Direction::In { "in" } else { "out" },
        "amount": input.amount,
        "date": { "$gte": dates::iso(d - Duration::days(3)), "$lte": dates::iso(d + Duration::days(3)) },
    };
    if let Some(p) = input.party_id.filter(|p| !p.is_empty()) { filter.insert("partyId", p); }
    use futures_util::TryStreamExt;
    Ok(s.transactions().find(filter).limit(3).await?.try_collect().await?)
}

#[tauri::command]
pub async fn transactions_find_similar(db: State<'_, Db>, input: SimilarInput) -> AppResult<Vec<Transaction>> {
    similar(&db.store().await?, input).await
}

pub(crate) async fn cash_flow(s: &Store, range: &str) -> AppResult<Vec<CashFlowPoint>> {
    let today = dates::today();
    let buckets: Vec<(String, chrono::NaiveDate, chrono::NaiveDate)> = match range {
        "30d" => (0..5)
            .map(|i| {
                let end = today - Duration::days((4 - i) * 7);
                let start = end - Duration::days(6);
                (start.format("%-d %b").to_string(), start, end)
            })
            .collect(),
        "6m" => (0..6)
            .map(|i| {
                let m = dates::month_start(dates::add_months(today, i - 5));
                (m.format("%b").to_string(), m, dates::month_end(m))
            })
            .collect(),
        _ => return Err(AppError::Validation("Unknown range.".into())),
    };
    let from = dates::iso(buckets[0].1);
    let txs = list_transactions(s, Some(&from), Some(&dates::iso(today))).await?;
    Ok(buckets
        .into_iter()
        .map(|(label, start, end)| {
            let (a, b) = (dates::iso(start), dates::iso(end));
            let within = txs.iter().filter(|t| t.date >= a && t.date <= b);
            let (mut cash_in, mut cash_out) = (0, 0);
            for t in within {
                if t.direction == Direction::In { cash_in += t.amount } else { cash_out += t.amount }
            }
            CashFlowPoint { label, start: a, cash_in, cash_out }
        })
        .collect())
}

#[tauri::command]
pub async fn dashboard_cash_flow(db: State<'_, Db>, range: String) -> AppResult<Vec<CashFlowPoint>> {
    cash_flow(&db.store().await?, &range).await
}

#[cfg(test)]
pub(crate) mod tests_api {
    //! Re-exports for integration tests (commands take `State`, these take `&Store`).
    pub(crate) use super::{cash_flow, create, delete, similar};
}
