use crate::model::finance::CashTreatment;
use crate::model::production::ProductionStage;
use crate::model::{Paise, PaymentMode};
use serde::{Deserialize, Serialize};

// 1. Profit
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfitMonth {
    pub month: String,
    pub receipts: Paise,
    pub materials: Paise,
    pub labour: Paise,
    pub labour_basis: String,
    pub overheads: Paise,
    pub profit: Paise,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryRow {
    pub category: String,
    pub treatment: CashTreatment,
    pub direction: String,
    pub amount: Paise,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfitTotals {
    pub receipts: Paise,
    pub materials: Paise,
    pub labour: Paise,
    pub overheads: Paise,
    pub profit: Paise,
    pub operating_cash: Paise,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfitReport {
    pub months: Vec<ProfitMonth>,
    pub categories: Vec<CategoryRow>,
    pub totals: ProfitTotals,
}

// 2. Cash flow
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TreatmentRow {
    pub treatment: CashTreatment,
    pub cash_in: Paise,
    pub cash_out: Paise,
    pub net: Paise,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModeRow {
    pub mode: PaymentMode,
    pub cash_in: Paise,
    pub cash_out: Paise,
    pub net: Paise,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CashFlowMonth {
    pub month: String,
    pub cash_in: Paise,
    pub cash_out: Paise,
    pub net: Paise,
    pub cumulative: Paise,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CashFlowTotals {
    pub cash_in: Paise,
    pub cash_out: Paise,
    pub net: Paise,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CashFlowReport {
    pub by_treatment: Vec<TreatmentRow>,
    pub by_mode: Vec<ModeRow>,
    pub months: Vec<CashFlowMonth>,
    pub totals: CashFlowTotals,
}

// 3. Labour
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LabourMonth {
    pub month: String,
    pub basic: Paise,
    pub overtime: Paise,
    pub bonus: Paise,
    pub gross: Paise,
    pub man_days: f64,
    pub basis: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DepartmentLabour {
    pub department: String,
    pub workers: i64,
    pub man_days: f64,
    pub basic: Paise,
    pub overtime: Paise,
    pub bonus: Paise,
    pub gross: Paise,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LabourTotals {
    pub gross: Paise,
    pub overtime: Paise,
    pub man_days: f64,
    pub receipts: Paise,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LabourReport {
    pub months: Vec<LabourMonth>,
    pub departments: Vec<DepartmentLabour>,
    pub totals: LabourTotals,
}

// 4. Attendance
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttendanceRow {
    pub worker_id: String,
    pub code: String,
    pub name: String,
    pub department: String,
    pub active: bool,
    pub expected: i64,
    pub present: i64,
    pub half_day: i64,
    pub absent: i64,
    pub leave: i64,
    pub unmarked: i64,
    pub overtime_hours: f64,
    pub pct: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DepartmentAttendance {
    pub department: String,
    pub workers: i64,
    pub pct: f64,
    pub absent: i64,
    pub overtime_hours: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttendanceReport {
    pub workers: Vec<AttendanceRow>,
    pub departments: Vec<DepartmentAttendance>,
}

// 5. Payroll
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PayrollReportRow {
    pub month: String,
    pub status: String,
    pub in_progress: bool,
    pub untracked: bool,
    pub workers: i64,
    pub gross: Paise,
    pub advance: Paise,
    pub other: Paise,
    pub net: Paise,
    pub paid: Paise,
    pub pending: Paise,
}

// 6. Production
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionReportTotals {
    pub good: i64,
    pub wastage: i64,
    pub orders_completed: i64,
    pub on_time: i64,
    pub active_orders: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReasonWastage {
    pub reason: String,
    pub qty: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerProduction {
    pub customer: String,
    pub orders: i64,
    pub good: i64,
    pub wastage: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StageProduction {
    pub stage: ProductionStage,
    pub good: i64,
    pub wastage: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletedOrderRow {
    pub order_no: String,
    pub customer: String,
    pub product: String,
    pub planned_qty: i64,
    pub produced_qty: i64,
    pub wastage_qty: i64,
    pub due_date: String,
    pub completed_on: String,
    pub late_days: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyOutput {
    pub date: String,
    pub good: i64,
    pub wastage: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionReport {
    pub totals: ProductionReportTotals,
    pub by_reason: Vec<ReasonWastage>,
    pub by_customer: Vec<CustomerProduction>,
    pub by_stage: Vec<StageProduction>,
    pub completed: Vec<CompletedOrderRow>,
    pub daily: Vec<DailyOutput>,
}
