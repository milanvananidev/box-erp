use super::{Paise, PaymentMode};
use serde::{Deserialize, Serialize};

pub const DEPARTMENTS: &[&str] = &["Corrugation", "Printing", "Die Cutting", "Pasting", "Stitching", "Dispatch", "Maintenance", "Office"];

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WageType {
    Daily,
    Monthly,
    PieceRate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Worker {
    pub id: String,
    pub code: String,
    pub name: String,
    pub department: String,
    pub designation: String,
    pub joined_on: String,
    pub wage_type: WageType,
    pub wage_rate: Paise,
    pub overtime_rate_per_hour: Paise,
    pub active: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emergency_contact: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub left_on: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerRow {
    #[serde(flatten)]
    pub worker: Worker,
    pub advance_balance: Paise,
    pub month_attendance_pct: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerInput {
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub emergency_contact: Option<String>,
    pub department: String,
    pub designation: String,
    pub joined_on: String,
    pub wage_type: WageType,
    pub wage_rate: Paise,
    pub overtime_rate_per_hour: Paise,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AttendanceStatus {
    Present,
    Absent,
    HalfDay,
    Leave,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttendanceRecord {
    pub id: String,
    pub worker_id: String,
    pub date: String,
    pub status: AttendanceStatus,
    pub overtime_hours: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pieces: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttendanceMark {
    pub worker_id: String,
    pub status: AttendanceStatus,
    pub overtime_hours: f64,
    pub pieces: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalaryAdvance {
    pub id: String,
    pub worker_id: String,
    pub date: String,
    pub amount: Paise,
    pub mode: PaymentMode,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    pub recovered: Paise,
    pub transaction_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvanceInput {
    pub worker_id: String,
    pub date: String,
    pub amount: Paise,
    pub mode: PaymentMode,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalaryPayment {
    pub id: String,
    pub worker_id: String,
    pub period: String,
    pub paid_on: String,
    pub gross: Paise,
    pub advance_deduction: Paise,
    pub net: Paise,
    pub mode: PaymentMode,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transaction_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum HistoryItem {
    Salary { date: String, item: SalaryPayment },
    Advance { date: String, item: SalaryAdvance },
}

impl HistoryItem {
    pub fn date(&self) -> &str {
        match self {
            HistoryItem::Salary { date, .. } | HistoryItem::Advance { date, .. } => date,
        }
    }
}
