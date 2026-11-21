use crate::model::Paise;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KpiDelta {
    pub value: i64,
    pub change_pct: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttendanceSummary {
    pub present: i64,
    pub absent: i64,
    pub half_day: i64,
    pub leave: i64,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnpaidSummary {
    pub amount: Paise,
    pub workers: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalaryPendingSummary {
    pub amount: Paise,
    pub workers: i64,
    pub advances_outstanding: Paise,
    pub due_on: String,
    pub unpaid: UnpaidSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionSummary {
    pub planned: i64,
    pub produced: i64,
    pub wastage: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardSummary {
    pub as_of: String,
    pub cash_in: KpiDelta,
    pub cash_out: KpiDelta,
    pub operating_profit: KpiDelta,
    pub production_today: KpiDelta,
    pub attendance: AttendanceSummary,
    pub salary_pending: SalaryPendingSummary,
    pub production: ProductionSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Alert {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub detail: String,
    pub href: String,
}
