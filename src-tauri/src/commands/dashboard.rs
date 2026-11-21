//! Dashboard queries: summary KPI card deltas, alerts list.

use crate::dates;
use crate::db::Db;
use crate::error::AppResult;
use crate::model::dashboard::*;
use crate::model::finance::{CashTreatment, Direction};
use crate::model::inventory::MaterialUnit;
use crate::model::production::ProductionStage;
use crate::model::workers::AttendanceStatus;
use crate::store::{find_all, Store};
use chrono::{Datelike, Duration};
use mongodb::bson::doc;
use tauri::State;

fn pct(cur: i64, prev: i64) -> Option<f64> {
    if prev == 0 {
        None
    } else {
        Some(((cur as f64 - prev as f64) / prev as f64) * 100.0)
    }
}

pub(crate) async fn get_summary(s: &Store) -> AppResult<DashboardSummary> {
    let today = dates::today();
    let today_iso = dates::today_iso();
    let yesterday_iso = dates::iso(today - Duration::days(1));
    let month_start = dates::iso(dates::month_start(today));
    let prev_month = dates::add_months(today, -1);
    let prev_start = dates::iso(dates::month_start(prev_month));
    let prev_end = dates::iso(dates::month_start(prev_month) + Duration::days(today.day0() as i64));

    // 1. Transactions
    let txns = find_all(
        &s.transactions(),
        doc! { "matchedTo": { "$exists": false } },
        doc! {},
    )
    .await?;

    let sum_tx = |from: &str, to: &str, dir: Direction, op_only: bool| -> i64 {
        txns.iter()
            .filter(|t| {
                t.date.as_str() >= from
                    && t.date.as_str() <= to
                    && t.direction == dir
                    && (!op_only || t.treatment == CashTreatment::Operating)
            })
            .map(|t| t.amount)
            .sum()
    };

    let cash_in = sum_tx(&month_start, &today_iso, Direction::In, false);
    let cash_in_prev = sum_tx(&prev_start, &prev_end, Direction::In, false);
    let cash_out = sum_tx(&month_start, &today_iso, Direction::Out, false);
    let cash_out_prev = sum_tx(&prev_start, &prev_end, Direction::Out, false);

    let op_in = sum_tx(&month_start, &today_iso, Direction::In, true);
    let op_out = sum_tx(&month_start, &today_iso, Direction::Out, true);
    let operating_profit = op_in - op_out;

    // 2. Production
    let entries = find_all(&s.production_entries(), doc! {}, doc! {}).await?;
    let prod_today: i64 = entries
        .iter()
        .filter(|e| e.date == today_iso)
        .map(|e| e.good_qty)
        .sum();
    let prod_yesterday: i64 = entries
        .iter()
        .filter(|e| e.date == yesterday_iso)
        .map(|e| e.good_qty)
        .sum();

    let month_produced: i64 = entries
        .iter()
        .filter(|e| e.date.as_str() >= month_start.as_str())
        .map(|e| e.good_qty)
        .sum();
    let month_wastage: i64 = entries
        .iter()
        .filter(|e| e.date.as_str() >= month_start.as_str())
        .map(|e| e.wastage_qty)
        .sum();

    let orders = find_all(&s.production_orders(), doc! {}, doc! {}).await?;
    let planned_active: i64 = orders
        .iter()
        .filter(|o| o.stage != ProductionStage::Completed)
        .map(|o| o.planned_qty)
        .sum();

    // 3. Attendance
    let today_att = find_all(&s.attendance(), doc! { "date": &today_iso }, doc! {}).await?;
    let workers = find_all(&s.workers(), doc! {}, doc! {}).await?;
    let active_workers = workers.iter().filter(|w| w.active).count() as i64;

    let present = today_att.iter().filter(|a| a.status == AttendanceStatus::Present).count() as i64;
    let half_day = today_att.iter().filter(|a| a.status == AttendanceStatus::HalfDay).count() as i64;
    let absent = today_att.iter().filter(|a| a.status == AttendanceStatus::Absent).count() as i64;
    let leave = today_att.iter().filter(|a| a.status == AttendanceStatus::Leave).count() as i64;

    // 4. Salaries & Advances
    let pending_wages = crate::commands::payroll::pending_salaries(s).await?;
    let pending_amount: i64 = pending_wages.iter().map(|p| p.net_payable).sum();
    let pending_workers = pending_wages.iter().filter(|p| p.net_payable > 0).count() as i64;

    let advances = find_all(&s.advances(), doc! {}, doc! {}).await?;
    let advances_outstanding: i64 = advances.iter().map(|a| a.amount - a.recovered).sum();

    let unpaid_lines = crate::commands::payroll::pending_lines(s).await?;
    let unpaid_amount: i64 = unpaid_lines.iter().map(|l| l.line.net).sum();
    let unpaid_workers = unpaid_lines.len() as i64;

    let due_on = dates::iso(dates::month_start(dates::add_months(today, 1)) + Duration::days(6));

    Ok(DashboardSummary {
        as_of: today_iso,
        cash_in: KpiDelta {
            value: cash_in,
            change_pct: pct(cash_in, cash_in_prev),
        },
        cash_out: KpiDelta {
            value: cash_out,
            change_pct: pct(cash_out, cash_out_prev),
        },
        operating_profit: KpiDelta {
            value: operating_profit,
            change_pct: None,
        },
        production_today: KpiDelta {
            value: prod_today,
            change_pct: pct(prod_today, prod_yesterday),
        },
        attendance: AttendanceSummary {
            present,
            half_day,
            absent,
            leave,
            total: active_workers,
        },
        salary_pending: SalaryPendingSummary {
            amount: pending_amount,
            workers: pending_workers,
            advances_outstanding,
            due_on,
            unpaid: UnpaidSummary {
                amount: unpaid_amount,
                workers: unpaid_workers,
            },
        },
        production: ProductionSummary {
            planned: planned_active,
            produced: month_produced,
            wastage: month_wastage,
        },
    })
}

#[tauri::command]
pub async fn dashboard_summary(db: State<'_, Db>) -> AppResult<DashboardSummary> {
    get_summary(&db.store().await?).await
}

pub(crate) async fn get_alerts(s: &Store) -> AppResult<Vec<Alert>> {
    let today = dates::today();
    let soon = dates::iso(today + Duration::days(1));

    let materials = find_all(&s.materials(), doc! {}, doc! { "name": 1 }).await?;
    let mut alerts = Vec::new();

    for m in materials {
        if m.stock <= m.reorder_level {
            let unit_str = match m.unit {
                MaterialUnit::Kg => "kg",
                MaterialUnit::Roll => "rolls",
                MaterialUnit::Litre => "L",
                MaterialUnit::Pcs => "pcs",
                MaterialUnit::Bag => "bags",
            };
            alerts.push(Alert {
                id: format!("ls-{}", m.id),
                kind: "low_stock".into(),
                title: format!("Low stock: {}", m.name),
                detail: format!(
                    "{} {} left · reorder at {} {}",
                    m.stock, unit_str, m.reorder_level, unit_str
                ),
                href: format!("/inventory?material={}", m.id),
            });
        }
    }

    let orders = find_all(
        &s.production_orders(),
        doc! { "stage": { "$ne": "completed" } },
        doc! { "dueDate": 1 },
    )
    .await?;

    for o in orders {
        if o.due_date.as_str() <= soon.as_str() {
            alerts.push(Alert {
                id: format!("due-{}", o.id),
                kind: "order_due".into(),
                title: format!("{} due {}", o.order_no, o.due_date),
                detail: format!("{} · {} / {} pcs", o.customer, o.produced_qty, o.planned_qty),
                href: format!("/production?order={}", o.id),
            });
        }
    }

    Ok(alerts)
}

#[tauri::command]
pub async fn alerts_list(db: State<'_, Db>) -> AppResult<Vec<Alert>> {
    get_alerts(&db.store().await?).await
}

#[cfg(test)]
pub(crate) mod tests_api {
    pub(crate) use super::{get_alerts, get_summary};
}
