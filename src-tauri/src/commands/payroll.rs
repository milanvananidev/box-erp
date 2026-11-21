//! Payroll: periods, draft computation, line adjustments, finalisation, reopening, payouts.

use crate::dates;
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::model::finance::{CashTreatment, Direction, Origin, Transaction, TxnSource};
use crate::model::new_id;
use crate::model::payroll::*;
use crate::model::workers::{AttendanceRecord, SalaryAdvance, SalaryPayment, Worker};
use crate::model::PaymentMode;
use crate::store::{find_all, Store};
use futures_util::FutureExt;
use mongodb::bson::doc;
use std::collections::HashMap;
use tauri::State;

/* ───────── Draft Computation ───────── */

pub(crate) async fn compute_draft(s: &Store, period: &str) -> AppResult<PayrollRun> {
    let month_date = dates::parse_month(period)?;
    let from = dates::month_start(month_date);
    let to = dates::month_end(month_date);
    let today = dates::today();
    let until = if to < today { to } else { today };

    let from_s = dates::iso(from);
    let to_s = dates::iso(to);
    let working_days = dates::working_days(from, to);

    let workers = find_all(&s.workers(), doc! {}, doc! { "code": 1 }).await?;
    let att = find_all(
        &s.attendance(),
        doc! { "date": { "$gte": &from_s, "$lte": &to_s } },
        doc! {},
    )
    .await?;
    let advances = find_all(&s.advances(), doc! { "date": { "$lte": &to_s } }, doc! {}).await?;
    let adj_docs = find_all(&s.payroll_adjustments(), doc! { "period": period }, doc! {}).await?;

    let mut att_map: HashMap<String, Vec<AttendanceRecord>> = HashMap::new();
    for r in att {
        att_map.entry(r.worker_id.clone()).or_default().push(r);
    }

    let mut adv_map: HashMap<String, i64> = HashMap::new();
    for a in advances {
        *adv_map.entry(a.worker_id.clone()).or_insert(0) += a.amount - a.recovered;
    }

    let mut adj_map: HashMap<String, PayrollAdjustment> = HashMap::new();
    for d in adj_docs {
        adj_map.insert(
            d.worker_id,
            PayrollAdjustment {
                bonus: d.bonus,
                other_deduction: d.other_deduction,
                other_deduction_note: d.other_deduction_note,
                advance_deduction: d.advance_deduction,
            },
        );
    }

    let mut lines = Vec::new();
    for w in workers {
        let left_ok = match &w.left_on {
            Some(l) => l.as_str() >= from_s.as_str(),
            None => true,
        };
        if w.joined_on.as_str() <= to_s.as_str() && left_ok && (w.active || w.left_on.is_some()) {
            let recs = att_map.get(&w.id).cloned().unwrap_or_default();
            let start = dates::parse(&w.joined_on).unwrap_or(from).max(from);
            let end = match &w.left_on {
                Some(l) => dates::parse(l).unwrap_or(until).min(until),
                None => until,
            };
            let expected_days = dates::working_days(start, end);
            let adv_outstanding = adv_map.get(&w.id).copied().unwrap_or(0);
            let adj = adj_map.get(&w.id);

            let line = build_payroll_line(&w, &recs, working_days, expected_days, adv_outstanding, adj);
            if line.paid_days > 0.0 || line.pieces > 0 || line.advance_outstanding > 0 || line.unmarked_days > 0 {
                lines.push(line);
            }
        }
    }

    Ok(PayrollRun {
        id: format!("draft-{period}"),
        period: period.to_string(),
        status: PayrollRunStatus::Draft,
        working_days,
        lines,
        finalized_on: None,
    })
}

/* ───────── Queries ───────── */

pub(crate) async fn get_run(s: &Store, period: &str) -> AppResult<PayrollRun> {
    if let Some(run) = s.payroll_runs().find_one(doc! { "period": period }).await? {
        Ok(run)
    } else {
        compute_draft(s, &period).await
    }
}

#[tauri::command]
pub async fn payroll_run_get(db: State<'_, Db>, period: String) -> AppResult<PayrollRun> {
    get_run(&db.store().await?, &period).await
}

pub(crate) async fn list_periods(s: &Store) -> AppResult<Vec<PeriodSummary>> {
    let today = dates::today();
    let current = dates::iso(today)[0..7].to_string();
    let mut out = Vec::new();

    for i in 0..4 {
        let month_date = dates::add_months(today, -i);
        let p = dates::iso(month_date)[0..7].to_string();
        let run = get_run(s, &p).await?;
        let paid: Vec<&PayrollLine> = run.lines.iter().filter(|l| l.payment_id.is_some()).collect();
        let gross: i64 = run.lines.iter().map(|l| l.gross).sum();
        let net: i64 = run.lines.iter().map(|l| l.net).sum();
        let paid_net: i64 = paid.iter().map(|l| l.net).sum();

        out.push(PeriodSummary {
            period: p.clone(),
            status: run.status,
            in_progress: p == current,
            workers: run.lines.len(),
            gross,
            net,
            paid_count: paid.len(),
            paid_net,
        });
    }

    Ok(out)
}

#[tauri::command]
pub async fn payroll_periods(db: State<'_, Db>) -> AppResult<Vec<PeriodSummary>> {
    list_periods(&db.store().await?).await
}

pub(crate) async fn pending_lines(s: &Store) -> AppResult<Vec<PendingLine>> {
    let runs = find_all(&s.payroll_runs(), doc! {}, doc! { "period": -1 }).await?;
    let mut out = Vec::new();
    for r in runs {
        for l in r.lines {
            if l.payment_id.is_none() && l.net > 0 {
                out.push(PendingLine {
                    period: r.period.clone(),
                    line: l,
                });
            }
        }
    }
    Ok(out)
}

#[tauri::command]
pub async fn payroll_pending_lines(db: State<'_, Db>) -> AppResult<Vec<PendingLine>> {
    pending_lines(&db.store().await?).await
}

pub(crate) async fn payments_history(s: &Store) -> AppResult<Vec<PaymentRow>> {
    let payments = find_all(&s.salary_payments(), doc! {}, doc! { "paidOn": -1 }).await?;
    let workers = find_all(&s.workers(), doc! {}, doc! {}).await?;
    let by_id: HashMap<String, Worker> = workers.into_iter().map(|w| (w.id.clone(), w)).collect();

    let mut out = Vec::new();
    for p in payments {
        let (name, code, department) = match by_id.get(&p.worker_id) {
            Some(w) => (w.name.clone(), w.code.clone(), w.department.clone()),
            None => ("—".into(), "".into(), "".into()),
        };
        out.push(PaymentRow {
            payment: p,
            name,
            code,
            department,
        });
    }
    out.sort_by(|a, b| b.payment.paid_on.cmp(&a.payment.paid_on).then_with(|| a.code.cmp(&b.code)));
    Ok(out)
}

#[tauri::command]
pub async fn payroll_payments(db: State<'_, Db>) -> AppResult<Vec<PaymentRow>> {
    payments_history(&db.store().await?).await
}

pub(crate) async fn pending_salaries(s: &Store) -> AppResult<Vec<PendingSalary>> {
    let today = dates::today();
    let period = dates::iso(today)[0..7].to_string();
    let run = compute_draft(s, &period).await?;
    let mut list: Vec<PendingSalary> = run
        .lines
        .into_iter()
        .map(|l| PendingSalary {
            worker_id: l.worker_id,
            name: l.name,
            department: l.department,
            net_payable: l.net,
        })
        .collect();
    list.sort_by(|a, b| b.net_payable.cmp(&a.net_payable));
    Ok(list)
}

#[tauri::command]
pub async fn payroll_pending(db: State<'_, Db>) -> AppResult<Vec<PendingSalary>> {
    pending_salaries(&db.store().await?).await
}

/* ───────── Mutations ───────── */

pub(crate) async fn adjust_line(
    s: &Store,
    period: &str,
    worker_id: &str,
    adj: PayrollAdjustment,
) -> AppResult<Option<PayrollLine>> {
    if s.payroll_runs().find_one(doc! { "period": period }).await?.is_some() {
        return Err(AppError::Conflict("This payroll is finalised. Reopen it to make changes.".into()));
    }
    if adj.bonus < 0 || adj.other_deduction < 0 || adj.advance_deduction.unwrap_or(0) < 0 {
        return Err(AppError::Validation("Amounts can't be negative.".into()));
    }

    let old_doc = s
        .payroll_adjustments()
        .find_one(doc! { "period": period, "workerId": worker_id })
        .await?;

    let doc = PayrollAdjustmentDoc {
        id: old_doc.as_ref().map(|d| d.id.clone()).unwrap_or_else(new_id),
        period: period.to_string(),
        worker_id: worker_id.to_string(),
        bonus: adj.bonus,
        other_deduction: adj.other_deduction,
        other_deduction_note: adj.other_deduction_note.clone(),
        advance_deduction: adj.advance_deduction,
    };

    s.payroll_adjustments()
        .replace_one(
            doc! { "period": period, "workerId": worker_id },
            &doc,
        )
        .upsert(true)
        .await?;

    let draft = compute_draft(s, period).await?;
    let line = draft.lines.into_iter().find(|l| l.worker_id == worker_id);
    if let Some(ref l) = line {
        if l.net < 0 {
            if let Some(prev) = old_doc {
                s.payroll_adjustments()
                    .replace_one(doc! { "period": period, "workerId": worker_id }, &prev)
                    .await?;
            } else {
                s.payroll_adjustments()
                    .delete_one(doc! { "period": period, "workerId": worker_id })
                    .await?;
            }
            return Err(AppError::Validation(
                "Deductions are more than the gross pay. Net pay can't be negative.".into(),
            ));
        }
    }

    Ok(line)
}

#[tauri::command]
pub async fn payroll_adjust_line(
    db: State<'_, Db>,
    period: String,
    worker_id: String,
    adjustment: PayrollAdjustment,
) -> AppResult<Option<PayrollLine>> {
    adjust_line(&db.store().await?, &period, &worker_id, adjustment).await
}

pub(crate) async fn finalize_payroll(s: &Store, period: &str) -> AppResult<PayrollRun> {
    let current = dates::iso(dates::today())[0..7].to_string();
    if period >= current.as_str() {
        return Err(AppError::Validation(
            "A month can only be finalised after it ends. Attendance may still change.".into(),
        ));
    }
    if s.payroll_runs().find_one(doc! { "period": period }).await?.is_some() {
        return Err(AppError::Conflict("This payroll is already finalised.".into()));
    }

    let draft = compute_draft(s, period).await?;
    let run = PayrollRun {
        id: format!("run-{period}"),
        period: period.to_string(),
        status: PayrollRunStatus::Finalized,
        working_days: draft.working_days,
        lines: draft.lines,
        finalized_on: Some(dates::today_iso()),
    };

    let (run_save, period_save) = (run.clone(), period.to_string());
    s.in_transaction(move |st, session| {
        let (run, period) = (run_save.clone(), period_save.clone());
        async move {
            st.payroll_runs().insert_one(&run).session(&mut *session).await?;
            st.payroll_adjustments()
                .delete_many(doc! { "period": &period })
                .session(&mut *session)
                .await?;
            Ok(())
        }
        .boxed()
    })
    .await?;

    Ok(run)
}

#[tauri::command]
pub async fn payroll_finalize(db: State<'_, Db>, period: String) -> AppResult<PayrollRun> {
    finalize_payroll(&db.store().await?, &period).await
}

pub(crate) async fn reopen_payroll(s: &Store, period: &str) -> AppResult<String> {
    let run = s
        .payroll_runs()
        .find_one(doc! { "period": period })
        .await?
        .ok_or_else(|| AppError::NotFound("Payroll run not found.".into()))?;

    if run.lines.iter().any(|l| l.payment_id.is_some()) {
        return Err(AppError::Conflict(
            "Salaries have already been paid from this run, so it can't be reopened. Make corrections in next month's payroll instead.".into(),
        ));
    }

    let (run_save, period_save) = (run.clone(), period.to_string());
    s.in_transaction(move |st, session| {
        let (run, period) = (run_save.clone(), period_save.clone());
        async move {
            st.payroll_runs()
                .delete_one(doc! { "period": &period })
                .session(&mut *session)
                .await?;
            for l in &run.lines {
                if l.bonus > 0 || l.other_deduction > 0 || l.other_deduction_note.is_some() {
                    let doc = PayrollAdjustmentDoc {
                        id: new_id(),
                        period: period.clone(),
                        worker_id: l.worker_id.clone(),
                        bonus: l.bonus,
                        other_deduction: l.other_deduction,
                        other_deduction_note: l.other_deduction_note.clone(),
                        advance_deduction: Some(l.advance_deduction),
                    };
                    st.payroll_adjustments().insert_one(&doc).session(&mut *session).await?;
                }
            }
            Ok(())
        }
        .boxed()
    })
    .await?;

    Ok(period.to_string())
}

#[tauri::command]
pub async fn payroll_reopen(db: State<'_, Db>, period: String) -> AppResult<String> {
    reopen_payroll(&db.store().await?, &period).await
}

pub(crate) async fn pay_salaries(s: &Store, input: PayInput) -> AppResult<PayResult> {
    dates::parse(&input.paid_on)?;
    if dates::parse(&input.paid_on)? > dates::today() {
        return Err(AppError::Validation("Payment date can't be in the future.".into()));
    }
    let mut run = s
        .payroll_runs()
        .find_one(doc! { "period": &input.period })
        .await?
        .ok_or_else(|| AppError::Conflict("Finalise the payroll before paying salaries.".into()))?;

    let to_pay: Vec<usize> = run
        .lines
        .iter()
        .enumerate()
        .filter(|(_, l)| input.worker_ids.contains(&l.worker_id) && l.payment_id.is_none() && l.net >= 0)
        .map(|(i, _)| i)
        .collect();

    if to_pay.is_empty() {
        return Err(AppError::Validation("Nothing left to pay for the selected workers.".into()));
    }

    let mode_str = match input.mode {
        PaymentMode::Cash => "cash",
        PaymentMode::Bank => "bank",
        PaymentMode::Upi => "upi",
    };
    let txn_id = format!("t-sal-{}-{}-{}", input.period, mode_str, new_id());
    let mut total: i64 = 0;
    let mut payments = Vec::new();

    for &idx in &to_pay {
        let l = &mut run.lines[idx];
        let pay_id = format!("sp-{}-{}", l.worker_id, input.period);
        l.payment_id = Some(pay_id.clone());
        total += l.net;
        payments.push(SalaryPayment {
            id: pay_id,
            worker_id: l.worker_id.clone(),
            period: input.period.clone(),
            paid_on: input.paid_on.clone(),
            gross: l.gross,
            advance_deduction: l.advance_deduction,
            net: l.net,
            mode: input.mode,
            transaction_id: Some(txn_id.clone()),
        });
    }

    let period_date = dates::parse_month(&input.period)?;
    let period_short = period_date.format("%b %Y").to_string();
    let count = to_pay.len();
    let txn = Transaction {
        id: txn_id,
        date: input.paid_on.clone(),
        direction: Direction::Out,
        amount: total,
        category: "Wages & Salary".into(),
        treatment: CashTreatment::Operating,
        mode: input.mode,
        party_id: None,
        party_name: None,
        particulars: format!("Salary {} – {} worker{}", period_short, count, if count > 1 { "s" } else { "" }),
        reference: None,
        source: TxnSource::Manual,
        external_ref: None,
        matched_to: None,
        origin: Some(Origin { module: "payroll".into(), ref_id: input.period.clone() }),
        created_at: dates::now_iso(),
    };

    let (run_to_save, payments_to_save, advances_to_deduct) = (
        run.clone(),
        payments,
        to_pay.iter().map(|&i| (run.lines[i].worker_id.clone(), run.lines[i].advance_deduction)).collect::<Vec<_>>(),
    );

    s.in_transaction(move |st, session| {
        let (run, payments, advances_deduct, txn) = (
            run_to_save.clone(),
            payments_to_save.clone(),
            advances_to_deduct.clone(),
            txn.clone(),
        );
        async move {
            st.payroll_runs()
                .replace_one(doc! { "period": &run.period }, &run)
                .session(&mut *session)
                .await?;

            for p in &payments {
                st.salary_payments().insert_one(p).session(&mut *session).await?;
            }

            for (worker_id, deduction) in advances_deduct {
                if deduction <= 0 {
                    continue;
                }
                let mut cursor = st
                    .advances()
                    .find(doc! { "workerId": &worker_id, "$expr": { "$gt": ["$amount", "$recovered"] } })
                    .sort(doc! { "date": 1 })
                    .session(&mut *session)
                    .await?;

                let mut left = deduction;
                while let Some(res) = cursor.next(&mut *session).await {
                    if left <= 0 {
                        break;
                    }
                    let adv: SalaryAdvance = res?;
                    let available = adv.amount - adv.recovered;
                    let take = available.min(left);
                    st.advances()
                        .update_one(
                            doc! { "id": &adv.id },
                            doc! { "$inc": { "recovered": take } },
                        )
                        .session(&mut *session)
                        .await?;
                    left -= take;
                }
            }

            st.transactions().insert_one(&txn).session(&mut *session).await?;
            Ok(())
        }
        .boxed()
    })
    .await?;

    Ok(PayResult { paid: count, total })
}

#[tauri::command]
pub async fn payroll_pay(db: State<'_, Db>, input: PayInput) -> AppResult<PayResult> {
    pay_salaries(&db.store().await?, input).await
}

#[cfg(test)]
pub(crate) mod tests_api {
    pub(crate) use super::{
        adjust_line, compute_draft, finalize_payroll, get_run, list_periods, pay_salaries, payments_history,
        pending_lines, pending_salaries, reopen_payroll,
    };
}
