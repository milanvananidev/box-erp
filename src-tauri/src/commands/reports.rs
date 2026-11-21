//! Reports: profit & loss, cash flow, labour cost, attendance, payroll, production.

use crate::dates;
use crate::db::Db;
use crate::error::AppResult;
use crate::model::finance::{CashTreatment, Direction, Transaction};
use crate::model::production::{ProductionOrder, ProductionStage, WastageReason};
use crate::model::reports::*;
use crate::model::workers::{AttendanceRecord, AttendanceStatus};
use crate::model::PaymentMode;
use crate::store::{find_all, Store};
use mongodb::bson::doc;
use std::collections::{HashMap, HashSet};
use tauri::State;

fn months_between(from: &str, to: &str) -> Vec<String> {
    let mut out = Vec::new();
    if let (Ok(mut start), Ok(end)) = (dates::parse(from), dates::parse(to)) {
        start = dates::month_start(start);
        let end_m = dates::month_start(end);
        while start <= end_m {
            out.push(dates::iso(start)[0..7].to_string());
            start = dates::add_months(start, 1);
        }
    }
    out
}

/* ───────── 1. Profit ───────── */

pub(crate) async fn profit_report(s: &Store, from: String, to: String) -> AppResult<ProfitReport> {
    let txns = find_all(
        &s.transactions(),
        doc! { "matchedTo": { "$exists": false } },
        doc! {},
    )
    .await?;
    let all_att = find_all(&s.attendance(), doc! {}, doc! { "date": 1 }).await?;
    let tracking_since = all_att
        .iter()
        .map(|a| a.date.as_str())
        .min()
        .unwrap_or("9999-12-31");

    let months = months_between(&from, &to);
    let mut profit_months = Vec::new();

    for m in &months {
        let m_tx: Vec<&Transaction> = txns
            .iter()
            .filter(|t| t.date.starts_with(m.as_str()) && t.treatment == CashTreatment::Operating)
            .collect();
        let receipts: i64 = m_tx
            .iter()
            .filter(|t| t.direction == Direction::In)
            .map(|t| t.amount)
            .sum();
        let materials: i64 = m_tx
            .iter()
            .filter(|t| t.direction == Direction::Out && t.category == "Raw Material")
            .map(|t| t.amount)
            .sum();
        let overheads: i64 = m_tx
            .iter()
            .filter(|t| {
                t.direction == Direction::Out
                    && t.category != "Raw Material"
                    && t.category != "Wages & Salary"
            })
            .map(|t| t.amount)
            .sum();

        let (labour, labour_basis) = if format!("{m}-01") >= tracking_since.to_string() {
            let run = crate::commands::payroll::get_run(s, m).await?;
            let sum_gross: i64 = run.lines.iter().map(|l| l.gross).sum();
            (sum_gross, "payroll".to_string())
        } else {
            let m_date = dates::parse_month(m)?;
            let next_m = dates::iso(dates::add_months(m_date, 1))[0..7].to_string();
            let cash: i64 = txns
                .iter()
                .filter(|t| t.category == "Wages & Salary" && t.date.starts_with(&next_m))
                .map(|t| t.amount)
                .sum();
            (cash, "cash".to_string())
        };

        profit_months.push(ProfitMonth {
            month: m.clone(),
            receipts,
            materials,
            labour,
            labour_basis,
            overheads,
            profit: receipts - materials - labour - overheads,
        });
    }

    let mut cat_map: HashMap<(String, String), (CashTreatment, i64, i64)> = HashMap::new();
    let in_range_tx: Vec<&Transaction> = txns
        .iter()
        .filter(|t| t.date.as_str() >= from.as_str() && t.date.as_str() <= to.as_str())
        .collect();

    for t in &in_range_tx {
        let dir_str = match t.direction {
            Direction::In => "in",
            Direction::Out => "out",
        };
        let key = (dir_str.to_string(), t.category.clone());
        let entry = cat_map.entry(key).or_insert((t.treatment, 0, 0));
        entry.1 += t.amount;
        entry.2 += 1;
    }

    let mut categories: Vec<CategoryRow> = cat_map
        .into_iter()
        .map(|((dir, cat), (treatment, amount, count))| CategoryRow {
            category: cat,
            treatment,
            direction: dir,
            amount,
            count,
        })
        .collect();

    categories.sort_by(|a, b| {
        if a.direction == b.direction {
            b.amount.cmp(&a.amount)
        } else if a.direction == "in" {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    let tot_receipts: i64 = profit_months.iter().map(|m| m.receipts).sum();
    let tot_materials: i64 = profit_months.iter().map(|m| m.materials).sum();
    let tot_labour: i64 = profit_months.iter().map(|m| m.labour).sum();
    let tot_overheads: i64 = profit_months.iter().map(|m| m.overheads).sum();
    let tot_profit: i64 = profit_months.iter().map(|m| m.profit).sum();

    let op_in: i64 = in_range_tx
        .iter()
        .filter(|t| t.treatment == CashTreatment::Operating && t.direction == Direction::In)
        .map(|t| t.amount)
        .sum();
    let op_out: i64 = in_range_tx
        .iter()
        .filter(|t| t.treatment == CashTreatment::Operating && t.direction == Direction::Out)
        .map(|t| t.amount)
        .sum();

    Ok(ProfitReport {
        months: profit_months,
        categories,
        totals: ProfitTotals {
            receipts: tot_receipts,
            materials: tot_materials,
            labour: tot_labour,
            overheads: tot_overheads,
            profit: tot_profit,
            operating_cash: op_in - op_out,
        },
    })
}

#[tauri::command]
pub async fn report_profit(db: State<'_, Db>, from: String, to: String) -> AppResult<ProfitReport> {
    profit_report(&db.store().await?, from, to).await
}

/* ───────── 2. Cash Flow ───────── */

pub(crate) async fn cash_flow_report(
    s: &Store,
    from: String,
    to: String,
) -> AppResult<CashFlowReport> {
    let txns = find_all(
        &s.transactions(),
        doc! { "matchedTo": { "$exists": false }, "date": { "$gte": &from, "$lte": &to } },
        doc! { "date": 1 },
    )
    .await?;

    let treatments = [
        CashTreatment::Operating,
        CashTreatment::Advance,
        CashTreatment::Capital,
        CashTreatment::Loan,
        CashTreatment::Transfer,
    ];
    let by_treatment = treatments
        .into_iter()
        .map(|tr| {
            let cin: i64 = txns
                .iter()
                .filter(|t| t.treatment == tr && t.direction == Direction::In)
                .map(|t| t.amount)
                .sum();
            let cout: i64 = txns
                .iter()
                .filter(|t| t.treatment == tr && t.direction == Direction::Out)
                .map(|t| t.amount)
                .sum();
            TreatmentRow {
                treatment: tr,
                cash_in: cin,
                cash_out: cout,
                net: cin - cout,
            }
        })
        .collect();

    let modes = [PaymentMode::Cash, PaymentMode::Bank, PaymentMode::Upi];
    let by_mode = modes
        .into_iter()
        .map(|pm| {
            let cin: i64 = txns
                .iter()
                .filter(|t| t.mode == pm && t.direction == Direction::In)
                .map(|t| t.amount)
                .sum();
            let cout: i64 = txns
                .iter()
                .filter(|t| t.mode == pm && t.direction == Direction::Out)
                .map(|t| t.amount)
                .sum();
            ModeRow {
                mode: pm,
                cash_in: cin,
                cash_out: cout,
                net: cin - cout,
            }
        })
        .collect();

    let months = months_between(&from, &to);
    let mut cum: i64 = 0;
    let mut month_rows = Vec::new();

    for m in months {
        let cin: i64 = txns
            .iter()
            .filter(|t| t.date.starts_with(m.as_str()) && t.direction == Direction::In)
            .map(|t| t.amount)
            .sum();
        let cout: i64 = txns
            .iter()
            .filter(|t| t.date.starts_with(m.as_str()) && t.direction == Direction::Out)
            .map(|t| t.amount)
            .sum();
        let net = cin - cout;
        cum += net;
        month_rows.push(CashFlowMonth {
            month: m,
            cash_in: cin,
            cash_out: cout,
            net,
            cumulative: cum,
        });
    }

    let tot_in: i64 = txns
        .iter()
        .filter(|t| t.direction == Direction::In)
        .map(|t| t.amount)
        .sum();
    let tot_out: i64 = txns
        .iter()
        .filter(|t| t.direction == Direction::Out)
        .map(|t| t.amount)
        .sum();

    Ok(CashFlowReport {
        by_treatment,
        by_mode,
        months: month_rows,
        totals: CashFlowTotals {
            cash_in: tot_in,
            cash_out: tot_out,
            net: tot_in - tot_out,
        },
    })
}

#[tauri::command]
pub async fn report_cash_flow(
    db: State<'_, Db>,
    from: String,
    to: String,
) -> AppResult<CashFlowReport> {
    cash_flow_report(&db.store().await?, from, to).await
}

/* ───────── 3. Labour ───────── */

pub(crate) async fn labour_report(s: &Store, from: String, to: String) -> AppResult<LabourReport> {
    let months = months_between(&from, &to);
    let all_att = find_all(&s.attendance(), doc! {}, doc! { "date": 1 }).await?;
    let tracking_since = all_att
        .iter()
        .map(|a| a.date.as_str())
        .min()
        .unwrap_or("9999-12-31");
    let txns = find_all(
        &s.transactions(),
        doc! { "matchedTo": { "$exists": false } },
        doc! {},
    )
    .await?;

    let mut month_rows = Vec::new();
    let mut dept_map: HashMap<String, (HashSet<String>, f64, i64, i64, i64, i64)> = HashMap::new();

    for m in &months {
        if format!("{m}-01") < tracking_since.to_string() {
            let m_date = dates::parse_month(m)?;
            let next_m = dates::iso(dates::add_months(m_date, 1))[0..7].to_string();
            let cash: i64 = txns
                .iter()
                .filter(|t| t.category == "Wages & Salary" && t.date.starts_with(&next_m))
                .map(|t| t.amount)
                .sum();
            month_rows.push(LabourMonth {
                month: m.clone(),
                basic: cash,
                overtime: 0,
                bonus: 0,
                gross: cash,
                man_days: 0.0,
                basis: "cash".into(),
            });
        } else {
            let run = crate::commands::payroll::get_run(s, m).await?;
            for l in &run.lines {
                let entry = dept_map
                    .entry(l.department.clone())
                    .or_insert_with(|| (HashSet::new(), 0.0, 0, 0, 0, 0));
                entry.0.insert(l.worker_id.clone());
                entry.1 += l.paid_days;
                entry.2 += l.basic;
                entry.3 += l.overtime;
                entry.4 += l.bonus;
                entry.5 += l.gross;
            }
            let basic: i64 = run.lines.iter().map(|l| l.basic).sum();
            let overtime: i64 = run.lines.iter().map(|l| l.overtime).sum();
            let bonus: i64 = run.lines.iter().map(|l| l.bonus).sum();
            let gross: i64 = run.lines.iter().map(|l| l.gross).sum();
            let man_days: f64 = run.lines.iter().map(|l| l.paid_days).sum();

            month_rows.push(LabourMonth {
                month: m.clone(),
                basic,
                overtime,
                bonus,
                gross,
                man_days,
                basis: "payroll".into(),
            });
        }
    }

    let receipts: i64 = txns
        .iter()
        .filter(|t| {
            t.date.as_str() >= from.as_str()
                && t.date.as_str() <= to.as_str()
                && t.treatment == CashTreatment::Operating
                && t.direction == Direction::In
        })
        .map(|t| t.amount)
        .sum();

    let mut departments: Vec<DepartmentLabour> = dept_map
        .into_iter()
        .map(|(dept, (ids, man_days, basic, overtime, bonus, gross))| DepartmentLabour {
            department: dept,
            workers: ids.len() as i64,
            man_days,
            basic,
            overtime,
            bonus,
            gross,
        })
        .collect();
    departments.sort_by(|a, b| b.gross.cmp(&a.gross));

    let tot_gross: i64 = month_rows.iter().map(|m| m.gross).sum();
    let tot_overtime: i64 = month_rows.iter().map(|m| m.overtime).sum();
    let tot_man_days: f64 = month_rows.iter().map(|m| m.man_days).sum();

    Ok(LabourReport {
        months: month_rows,
        departments,
        totals: LabourTotals {
            gross: tot_gross,
            overtime: tot_overtime,
            man_days: tot_man_days,
            receipts,
        },
    })
}

#[tauri::command]
pub async fn report_labour(db: State<'_, Db>, from: String, to: String) -> AppResult<LabourReport> {
    labour_report(&db.store().await?, from, to).await
}

/* ───────── 4. Attendance ───────── */

pub(crate) async fn attendance_report(
    s: &Store,
    from: String,
    to: String,
) -> AppResult<AttendanceReport> {
    let today_iso = dates::today_iso();
    let end = if to.as_str() < today_iso.as_str() {
        to
    } else {
        today_iso
    };

    let workers = find_all(&s.workers(), doc! {}, doc! { "code": 1 }).await?;
    let att = find_all(
        &s.attendance(),
        doc! { "date": { "$gte": &from, "$lte": &end } },
        doc! {},
    )
    .await?;

    let mut att_by_worker: HashMap<String, Vec<&AttendanceRecord>> = HashMap::new();
    for a in &att {
        att_by_worker.entry(a.worker_id.clone()).or_default().push(a);
    }

    let mut rows = Vec::new();
    let (from_d, end_d) = (dates::parse(&from)?, dates::parse(&end)?);

    for w in workers {
        let left_ok = match &w.left_on {
            Some(l) => l.as_str() >= from.as_str(),
            None => true,
        };
        if w.joined_on.as_str() <= end.as_str() && left_ok {
            let recs = att_by_worker.get(&w.id).cloned().unwrap_or_default();
            let start = dates::parse(&w.joined_on).unwrap_or(from_d).max(from_d);
            let stop = match &w.left_on {
                Some(l) => dates::parse(l).unwrap_or(end_d).min(end_d),
                None => end_d,
            };
            let expected = dates::working_days(start, stop);

            let present = recs.iter().filter(|r| r.status == AttendanceStatus::Present).count() as i64;
            let half_day = recs.iter().filter(|r| r.status == AttendanceStatus::HalfDay).count() as i64;
            let absent = recs.iter().filter(|r| r.status == AttendanceStatus::Absent).count() as i64;
            let leave = recs.iter().filter(|r| r.status == AttendanceStatus::Leave).count() as i64;
            let unmarked = (expected - recs.len() as i64).max(0);
            let overtime_hours: f64 = recs.iter().map(|r| r.overtime_hours).sum();
            let paid_days = present as f64 + half_day as f64 * 0.5;
            let pct = if expected > 0 {
                (paid_days / expected as f64) * 100.0
            } else {
                0.0
            };

            rows.push(AttendanceRow {
                worker_id: w.id,
                code: w.code,
                name: w.name,
                department: w.department,
                active: w.active,
                expected,
                present,
                half_day,
                absent,
                leave,
                unmarked,
                overtime_hours,
                pct,
            });
        }
    }

    let mut dept_map: HashMap<String, (i64, i64, f64, i64, f64)> = HashMap::new();
    for r in &rows {
        let entry = dept_map
            .entry(r.department.clone())
            .or_insert((0, 0, 0.0, 0, 0.0));
        entry.0 += 1;
        entry.1 += r.expected;
        entry.2 += r.present as f64 + r.half_day as f64 * 0.5;
        entry.3 += r.absent;
        entry.4 += r.overtime_hours;
    }

    let departments = dept_map
        .into_iter()
        .map(|(dept, (workers, expected, paid, absent, overtime_hours))| DepartmentAttendance {
            department: dept,
            workers,
            pct: if expected > 0 {
                (paid / expected as f64) * 100.0
            } else {
                0.0
            },
            absent,
            overtime_hours,
        })
        .collect();

    Ok(AttendanceReport {
        workers: rows,
        departments,
    })
}

#[tauri::command]
pub async fn report_attendance(
    db: State<'_, Db>,
    from: String,
    to: String,
) -> AppResult<AttendanceReport> {
    attendance_report(&db.store().await?, from, to).await
}

/* ───────── 5. Payroll ───────── */

pub(crate) async fn payroll_report(
    s: &Store,
    from: String,
    to: String,
) -> AppResult<Vec<PayrollReportRow>> {
    let months = months_between(&from, &to);
    let all_att = find_all(&s.attendance(), doc! {}, doc! { "date": 1 }).await?;
    let tracking_since = all_att
        .iter()
        .map(|a| a.date.as_str())
        .min()
        .unwrap_or("9999-12-31");
    let current_period = dates::iso(dates::today())[0..7].to_string();

    let mut rows = Vec::new();
    for m in months {
        if format!("{m}-01") < tracking_since.to_string() {
            rows.push(PayrollReportRow {
                month: m,
                status: "draft".into(),
                in_progress: false,
                untracked: true,
                workers: 0,
                gross: 0,
                advance: 0,
                other: 0,
                net: 0,
                paid: 0,
                pending: 0,
            });
        } else {
            let run = crate::commands::payroll::get_run(s, &m).await?;
            let gross: i64 = run.lines.iter().map(|l| l.gross).sum();
            let advance: i64 = run.lines.iter().map(|l| l.advance_deduction).sum();
            let other: i64 = run.lines.iter().map(|l| l.other_deduction).sum();
            let net: i64 = run.lines.iter().map(|l| l.net).sum();
            let paid: i64 = run
                .lines
                .iter()
                .filter(|l| l.payment_id.is_some())
                .map(|l| l.net)
                .sum();
            let status_str = match run.status {
                crate::model::payroll::PayrollRunStatus::Draft => "draft",
                crate::model::payroll::PayrollRunStatus::Finalized => "finalized",
            };
            let pending = if status_str == "finalized" {
                net - paid
            } else {
                0
            };

            rows.push(PayrollReportRow {
                month: m.clone(),
                status: status_str.into(),
                in_progress: m == current_period,
                untracked: false,
                workers: run.lines.len() as i64,
                gross,
                advance,
                other,
                net,
                paid,
                pending,
            });
        }
    }

    Ok(rows)
}

#[tauri::command]
pub async fn report_payroll(
    db: State<'_, Db>,
    from: String,
    to: String,
) -> AppResult<Vec<PayrollReportRow>> {
    payroll_report(&db.store().await?, from, to).await
}

/* ───────── 6. Production ───────── */

pub(crate) async fn production_report(
    s: &Store,
    from: String,
    to: String,
) -> AppResult<ProductionReport> {
    let entries = find_all(
        &s.production_entries(),
        doc! { "date": { "$gte": &from, "$lte": &to } },
        doc! { "date": 1 },
    )
    .await?;
    let orders = find_all(&s.production_orders(), doc! {}, doc! {}).await?;
    let order_by_id: HashMap<String, &ProductionOrder> = orders.iter().map(|o| (o.id.clone(), o)).collect();

    let mut reason_map: HashMap<String, i64> = HashMap::new();
    let mut cust_map: HashMap<String, (HashSet<String>, i64, i64)> = HashMap::new();
    let mut stage_map: HashMap<ProductionStage, (i64, i64)> = HashMap::new();
    let mut daily_map: HashMap<String, (i64, i64)> = HashMap::new();

    for e in &entries {
        if e.wastage_qty > 0 {
            let r_str = match e.wastage_reason {
                Some(WastageReason::BoardDefect) => "board_defect",
                Some(WastageReason::PrintMisregister) => "print_misregister",
                Some(WastageReason::DieCutError) => "die_cut_error",
                Some(WastageReason::MachineSetup) => "machine_setup",
                Some(WastageReason::HandlingDamage) => "handling_damage",
                Some(WastageReason::Other) => "other",
                None => "unspecified",
            };
            *reason_map.entry(r_str.to_string()).or_insert(0) += e.wastage_qty;
        }

        if let Some(o) = order_by_id.get(&e.order_id) {
            let c_entry = cust_map
                .entry(o.customer.clone())
                .or_insert_with(|| (HashSet::new(), 0, 0));
            c_entry.0.insert(o.id.clone());
            c_entry.1 += e.good_qty;
            c_entry.2 += e.wastage_qty;
        }

        let s_entry = stage_map.entry(e.stage).or_insert((0, 0));
        s_entry.0 += e.good_qty;
        s_entry.1 += e.wastage_qty;

        let d_entry = daily_map.entry(e.date.clone()).or_insert((0, 0));
        d_entry.0 += e.good_qty;
        d_entry.1 += e.wastage_qty;
    }

    let mut completed = Vec::new();
    for o in &orders {
        if o.stage == ProductionStage::Completed {
            if let Some(ref comp_on) = o.completed_on {
                if comp_on.as_str() >= from.as_str() && comp_on.as_str() <= to.as_str() {
                    let late_days = match (dates::parse(comp_on), dates::parse(&o.due_date)) {
                        (Ok(c), Ok(d)) => (c - d).num_days().max(0),
                        _ => 0,
                    };
                    completed.push(CompletedOrderRow {
                        order_no: o.order_no.clone(),
                        customer: o.customer.clone(),
                        product: o.product.clone(),
                        planned_qty: o.planned_qty,
                        produced_qty: o.produced_qty,
                        wastage_qty: o.wastage_qty,
                        due_date: o.due_date.clone(),
                        completed_on: comp_on.clone(),
                        late_days,
                    });
                }
            }
        }
    }

    let good_tot: i64 = entries.iter().map(|e| e.good_qty).sum();
    let waste_tot: i64 = entries.iter().map(|e| e.wastage_qty).sum();
    let on_time = completed.iter().filter(|c| c.late_days == 0).count() as i64;
    let active_orders = orders.iter().filter(|o| o.stage != ProductionStage::Completed).count() as i64;

    let mut by_reason: Vec<ReasonWastage> = reason_map
        .into_iter()
        .map(|(reason, qty)| ReasonWastage { reason, qty })
        .collect();
    by_reason.sort_by(|a, b| b.qty.cmp(&a.qty));

    let mut by_customer: Vec<CustomerProduction> = cust_map
        .into_iter()
        .map(|(customer, (ords, good, wastage))| CustomerProduction {
            customer,
            orders: ords.len() as i64,
            good,
            wastage,
        })
        .collect();
    by_customer.sort_by(|a, b| b.good.cmp(&a.good));

    let by_stage: Vec<StageProduction> = stage_map
        .into_iter()
        .map(|(stage, (good, wastage))| StageProduction { stage, good, wastage })
        .collect();

    let mut daily: Vec<DailyOutput> = daily_map
        .into_iter()
        .map(|(date, (good, wastage))| DailyOutput { date, good, wastage })
        .collect();
    daily.sort_by(|a, b| a.date.cmp(&b.date));

    Ok(ProductionReport {
        totals: ProductionReportTotals {
            good: good_tot,
            wastage: waste_tot,
            orders_completed: completed.len() as i64,
            on_time,
            active_orders,
        },
        by_reason,
        by_customer,
        by_stage,
        completed,
        daily,
    })
}

#[tauri::command]
pub async fn report_production(
    db: State<'_, Db>,
    from: String,
    to: String,
) -> AppResult<ProductionReport> {
    production_report(&db.store().await?, from, to).await
}

#[cfg(test)]
pub(crate) mod tests_api {
    pub(crate) use super::{
        attendance_report, cash_flow_report, labour_report, payroll_report, production_report,
        profit_report,
    };
}
