//! Workers & HR: profiles, daily attendance, salary advances, payment history.

use crate::commands::finance::{validate_amount, validate_not_future};
use crate::dates;
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::model::finance::{CashTreatment, Direction, Origin, Transaction, TxnSource};
use crate::model::new_id;
use crate::model::workers::*;
use crate::store::{find_all, Store};
use futures_util::FutureExt;
use mongodb::bson::{doc, to_bson};
use std::collections::HashMap;
use tauri::State;

/* ───────── roster ───────── */

pub(crate) async fn advance_balances(s: &Store) -> AppResult<HashMap<String, i64>> {
    let mut out = HashMap::new();
    for a in find_all(&s.advances(), doc! {}, doc! {}).await? {
        *out.entry(a.worker_id).or_insert(0) += a.amount - a.recovered;
    }
    Ok(out)
}

pub(crate) async fn roster(s: &Store) -> AppResult<Vec<WorkerRow>> {
    let today = dates::today();
    let from = dates::month_start(today);
    let (from_s, to_s) = (dates::iso(from), dates::iso(today));
    let workers = find_all(&s.workers(), doc! {}, doc! { "code": 1 }).await?;
    let att = find_all(&s.attendance(), doc! { "date": { "$gte": &from_s, "$lte": &to_s } }, doc! {}).await?;
    let balances = advance_balances(s).await?;
    let mut paid: HashMap<&str, f64> = HashMap::new();
    for r in &att {
        let v = match r.status { AttendanceStatus::Present => 1.0, AttendanceStatus::HalfDay => 0.5, _ => 0.0 };
        *paid.entry(r.worker_id.as_str()).or_insert(0.0) += v;
    }
    Ok(workers
        .into_iter()
        .map(|w| {
            let start = dates::parse(&w.joined_on).map(|j| j.max(from)).unwrap_or(from);
            let days = dates::working_days(start, today);
            let pct = (w.active && days > 0).then(|| paid.get(w.id.as_str()).copied().unwrap_or(0.0) / days as f64 * 100.0);
            WorkerRow { advance_balance: balances.get(&w.id).copied().unwrap_or(0), month_attendance_pct: pct, worker: w }
        })
        .collect())
}

#[tauri::command]
pub async fn workers_roster(db: State<'_, Db>) -> AppResult<Vec<WorkerRow>> {
    roster(&db.store().await?).await
}

/* ───────── create / update / leave ───────── */

fn clean(o: Option<String>) -> Option<String> {
    o.map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

fn validate_worker(i: &WorkerInput) -> AppResult<()> {
    if i.name.trim().len() < 2 { return Err(AppError::Validation("Enter the worker's name.".into())); }
    if !DEPARTMENTS.contains(&i.department.as_str()) { return Err(AppError::Validation("Choose a valid department.".into())); }
    if i.designation.trim().len() < 2 { return Err(AppError::Validation("Enter the role.".into())); }
    validate_not_future(&i.joined_on, "Joining")?;
    if i.wage_rate <= 0 { return Err(AppError::Validation("Wage must be more than zero.".into())); }
    if i.overtime_rate_per_hour < 0 { return Err(AppError::Validation("Overtime rate can't be negative.".into())); }
    if let Some(p) = clean(i.phone.clone()) {
        let digits: String = p.chars().filter(|c| c.is_ascii_digit()).collect();
        let local = digits.strip_prefix("91").filter(|d| d.len() == 10).unwrap_or(&digits);
        if local.len() != 10 || !matches!(local.chars().next(), Some('6'..='9')) {
            return Err(AppError::Validation("Enter a 10-digit mobile number.".into()));
        }
    }
    Ok(())
}

pub(crate) async fn create_worker(s: &Store, i: WorkerInput) -> AppResult<Worker> {
    validate_worker(&i)?;
    // continue numbering after any imported/existing codes
    let max_existing = find_all(&s.workers(), doc! {}, doc! {}).await?.iter().filter_map(|w| w.code.trim_start_matches("EMP-").parse::<i64>().ok()).max().unwrap_or(100);
    let n = s.next_seq("worker_code", max_existing).await?;
    let w = Worker {
        id: new_id(),
        code: format!("EMP-{n:04}"),
        name: i.name.trim().into(),
        department: i.department,
        designation: i.designation.trim().into(),
        joined_on: i.joined_on,
        wage_type: i.wage_type,
        wage_rate: i.wage_rate,
        overtime_rate_per_hour: i.overtime_rate_per_hour,
        active: true,
        phone: clean(i.phone),
        address: clean(i.address),
        emergency_contact: clean(i.emergency_contact),
        left_on: None,
        notes: clean(i.notes),
    };
    s.workers().insert_one(&w).await?;
    Ok(w)
}

#[tauri::command]
pub async fn worker_create(db: State<'_, Db>, input: WorkerInput) -> AppResult<Worker> {
    create_worker(&db.store().await?, input).await
}

pub(crate) async fn update_worker(s: &Store, id: &str, i: WorkerInput) -> AppResult<Worker> {
    validate_worker(&i)?;
    let mut w = s.workers().find_one(doc! { "id": id }).await?.ok_or_else(|| AppError::NotFound("Worker not found.".into()))?;
    w.name = i.name.trim().into();
    w.department = i.department;
    w.designation = i.designation.trim().into();
    w.joined_on = i.joined_on;
    w.wage_type = i.wage_type;
    w.wage_rate = i.wage_rate;
    w.overtime_rate_per_hour = i.overtime_rate_per_hour;
    w.phone = clean(i.phone);
    w.address = clean(i.address);
    w.emergency_contact = clean(i.emergency_contact);
    w.notes = clean(i.notes);
    s.workers().replace_one(doc! { "id": id }, &w).await?;
    Ok(w)
}

#[tauri::command]
pub async fn worker_update(db: State<'_, Db>, id: String, input: WorkerInput) -> AppResult<Worker> {
    update_worker(&db.store().await?, &id, input).await
}

pub(crate) async fn set_active(s: &Store, id: &str, active: bool, left_on: Option<String>) -> AppResult<Worker> {
    let mut w = s.workers().find_one(doc! { "id": id }).await?.ok_or_else(|| AppError::NotFound("Worker not found.".into()))?;
    if !active && advance_balances(s).await?.get(id).copied().unwrap_or(0) > 0 {
        return Err(AppError::Conflict("This worker still has an unrecovered advance. Settle it in the final salary before marking them as left.".into()));
    }
    w.active = active;
    w.left_on = if active { None } else { Some(left_on.unwrap_or_else(dates::today_iso)) };
    s.workers().replace_one(doc! { "id": id }, &w).await?;
    Ok(w)
}

#[tauri::command]
pub async fn worker_set_active(db: State<'_, Db>, id: String, active: bool, left_on: Option<String>) -> AppResult<Worker> {
    set_active(&db.store().await?, &id, active, left_on).await
}

/* ───────── attendance ───────── */

#[tauri::command]
pub async fn attendance_for_day(db: State<'_, Db>, date: String) -> AppResult<Vec<AttendanceRecord>> {
    let s = db.store().await?;
    dates::parse(&date)?;
    find_all(&s.attendance(), doc! { "date": &date }, doc! {}).await
}

#[tauri::command]
pub async fn attendance_for_worker_month(db: State<'_, Db>, worker_id: String, month: String) -> AppResult<Vec<AttendanceRecord>> {
    let s = db.store().await?;
    let m = dates::parse_month(&month)?;
    find_all(
        &s.attendance(),
        doc! { "workerId": &worker_id, "date": { "$gte": dates::iso(m), "$lte": dates::iso(dates::month_end(m)) } },
        doc! { "date": 1 },
    )
    .await
}

#[derive(serde::Serialize)]
pub struct Saved {
    saved: usize,
}

pub(crate) async fn save_day(s: &Store, date: String, marks: Vec<AttendanceMark>) -> AppResult<Saved> {
    validate_not_future(&date, "Attendance")?;
    let workers: HashMap<String, Worker> = find_all(&s.workers(), doc! {}, doc! {}).await?.into_iter().map(|w| (w.id.clone(), w)).collect();
    for m in &marks {
        let w = workers.get(&m.worker_id).ok_or_else(|| AppError::Validation("Unknown worker in attendance.".into()))?;
        if w.joined_on > date { return Err(AppError::Validation(format!("{} joined after this date.", w.name))); }
        if w.left_on.as_deref().is_some_and(|l| l < date.as_str()) { return Err(AppError::Validation(format!("{} had left by this date.", w.name))); }
        if !(0.0..=12.0).contains(&m.overtime_hours) { return Err(AppError::Validation("Overtime must be between 0 and 12 hours.".into())); }
        let off = matches!(m.status, AttendanceStatus::Absent | AttendanceStatus::Leave);
        if off && (m.overtime_hours > 0.0 || m.pieces.unwrap_or(0) > 0) {
            return Err(AppError::Validation("Absent or on-leave workers can't have overtime or pieces.".into()));
        }
        if m.pieces.is_some_and(|p| p < 0) { return Err(AppError::Validation("Pieces can't be negative.".into())); }
    }
    let count = marks.len();
    s.in_transaction(move |st, session| {
        let (date, marks) = (date.clone(), marks.clone());
        async move {
            for m in marks {
                let status = to_bson(&m.status)?;
                st.attendance()
                    .update_one(
                        doc! { "workerId": &m.worker_id, "date": &date },
                        doc! {
                            "$set": { "status": status, "overtimeHours": m.overtime_hours, "pieces": m.pieces },
                            "$setOnInsert": { "id": new_id(), "workerId": &m.worker_id, "date": &date },
                        },
                    )
                    .upsert(true)
                    .session(&mut *session)
                    .await?;
            }
            Ok(())
        }
        .boxed()
    })
    .await?;
    Ok(Saved { saved: count })
}

#[tauri::command]
pub async fn attendance_save_day(db: State<'_, Db>, date: String, marks: Vec<AttendanceMark>) -> AppResult<Saved> {
    save_day(&db.store().await?, date, marks).await
}

/* ───────── advances ───────── */

#[tauri::command]
pub async fn advances_list(db: State<'_, Db>) -> AppResult<Vec<SalaryAdvance>> {
    let s = db.store().await?;
    find_all(&s.advances(), doc! {}, doc! { "date": -1 }).await
}

pub(crate) async fn give_advance(s: &Store, i: AdvanceInput) -> AppResult<SalaryAdvance> {
    validate_amount(i.amount)?;
    if i.amount > 20_000_000 { return Err(AppError::Validation("That's unusually large. Check the amount.".into())); }
    validate_not_future(&i.date, "Advance")?;
    let w = s.workers().find_one(doc! { "id": &i.worker_id }).await?.filter(|w| w.active)
        .ok_or_else(|| AppError::Validation("Advances can only be given to active workers.".into()))?;
    let adv = SalaryAdvance {
        id: new_id(),
        worker_id: w.id.clone(),
        date: i.date.clone(),
        amount: i.amount,
        mode: i.mode,
        note: clean(i.note),
        recovered: 0,
        transaction_id: new_id(),
    };
    // One cash-book entry, treatment "advance" so it never counts as an expense.
    let txn = Transaction {
        id: adv.transaction_id.clone(),
        date: adv.date.clone(),
        direction: Direction::Out,
        amount: adv.amount,
        category: "Salary Advance".into(),
        treatment: CashTreatment::Advance,
        mode: adv.mode,
        party_id: None,
        party_name: None,
        particulars: format!("Advance – {}", w.name),
        reference: adv.note.clone(),
        source: TxnSource::Manual,
        external_ref: None,
        matched_to: None,
        origin: Some(Origin { module: "advance".into(), ref_id: adv.id.clone() }),
        created_at: dates::now_iso(),
    };
    let out = adv.clone();
    s.in_transaction(move |st, session| {
        let (adv, txn) = (adv.clone(), txn.clone());
        async move {
            st.transactions().insert_one(&txn).session(&mut *session).await?;
            st.advances().insert_one(&adv).session(&mut *session).await?;
            Ok(())
        }
        .boxed()
    })
    .await?;
    Ok(out)
}

#[tauri::command]
pub async fn advance_create(db: State<'_, Db>, input: AdvanceInput) -> AppResult<SalaryAdvance> {
    give_advance(&db.store().await?, input).await
}

pub(crate) async fn delete_advance(s: &Store, id: &str) -> AppResult<String> {
    let a = s.advances().find_one(doc! { "id": id }).await?.ok_or_else(|| AppError::NotFound("Advance not found.".into()))?;
    if a.recovered > 0 {
        return Err(AppError::Conflict("Part of this advance has already been recovered in payroll, so it can't be deleted.".into()));
    }
    let id = id.to_string();
    let out = id.clone();
    s.in_transaction(move |st, session| {
        let (id, tid) = (id.clone(), a.transaction_id.clone());
        async move {
            st.advances().delete_one(doc! { "id": &id, "recovered": 0 }).session(&mut *session).await?;
            st.transactions().delete_one(doc! { "id": &tid }).session(&mut *session).await?;
            Ok(())
        }
        .boxed()
    })
    .await?;
    Ok(out)
}

#[tauri::command]
pub async fn advance_delete(db: State<'_, Db>, id: String) -> AppResult<String> {
    delete_advance(&db.store().await?, &id).await
}

#[tauri::command]
pub async fn worker_payment_history(db: State<'_, Db>, worker_id: String) -> AppResult<Vec<HistoryItem>> {
    let s = db.store().await?;
    let mut items: Vec<HistoryItem> = find_all(&s.salary_payments(), doc! { "workerId": &worker_id }, doc! {})
        .await?
        .into_iter()
        .map(|p| HistoryItem::Salary { date: p.paid_on.clone(), item: p })
        .collect();
    items.extend(find_all(&s.advances(), doc! { "workerId": &worker_id }, doc! {}).await?.into_iter().map(|a| HistoryItem::Advance { date: a.date.clone(), item: a }));
    items.sort_by(|a, b| b.date().cmp(a.date()));
    Ok(items)
}

#[cfg(test)]
pub(crate) mod tests_api {
    pub(crate) use super::{create_worker, delete_advance, give_advance, roster, save_day, set_active};
}
