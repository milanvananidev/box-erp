use crate::model::workers::{AttendanceRecord, AttendanceStatus, WageType, Worker};
use crate::model::{Paise, PaymentMode};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PayrollRunStatus {
    Draft,
    Finalized,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PayrollAdjustment {
    pub bonus: Paise,
    pub other_deduction: Paise,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub other_deduction_note: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub advance_deduction: Option<Paise>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PayrollAdjustmentDoc {
    pub id: String,
    pub period: String,
    pub worker_id: String,
    pub bonus: Paise,
    pub other_deduction: Paise,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub other_deduction_note: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub advance_deduction: Option<Paise>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PayrollLine {
    pub worker_id: String,
    pub code: String,
    pub name: String,
    pub department: String,
    pub designation: String,
    pub wage_type: WageType,
    pub wage_rate: Paise,
    pub overtime_rate_per_hour: Paise,
    pub present_days: i64,
    pub half_days: i64,
    pub absent_days: i64,
    pub leave_days: i64,
    pub paid_days: f64,
    pub unmarked_days: i64,
    pub overtime_hours: f64,
    pub pieces: i64,
    pub basic: Paise,
    pub overtime: Paise,
    pub bonus: Paise,
    pub other_deduction: Paise,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub other_deduction_note: Option<String>,
    pub gross: Paise,
    pub advance_outstanding: Paise,
    pub advance_deduction: Paise,
    pub net: Paise,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payment_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PayrollRun {
    pub id: String,
    pub period: String,
    pub status: PayrollRunStatus,
    pub working_days: i64,
    pub lines: Vec<PayrollLine>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finalized_on: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeriodSummary {
    pub period: String,
    pub status: PayrollRunStatus,
    pub in_progress: bool,
    pub workers: usize,
    pub gross: Paise,
    pub net: Paise,
    pub paid_count: usize,
    pub paid_net: Paise,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingLine {
    #[serde(flatten)]
    pub line: PayrollLine,
    pub period: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentRow {
    #[serde(flatten)]
    pub payment: crate::model::workers::SalaryPayment,
    pub name: String,
    pub code: String,
    pub department: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PayInput {
    pub period: String,
    pub worker_ids: Vec<String>,
    pub mode: PaymentMode,
    pub paid_on: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PayResult {
    pub paid: usize,
    pub total: Paise,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingSalary {
    pub worker_id: String,
    pub name: String,
    pub department: String,
    pub net_payable: Paise,
}

#[allow(dead_code)]
pub struct WageBreakdown {
    pub present_days: i64,
    pub half_days: i64,
    pub paid_days: f64,
    pub overtime_hours: f64,
    pub pieces: i64,
    pub basic: Paise,
    pub overtime: Paise,
    pub gross: Paise,
    pub advance_deduction: Paise,
    pub net: Paise,
}

pub fn calculate_wage(
    worker: &Worker,
    records: &[AttendanceRecord],
    working_days: i64,
    advance_outstanding: Paise,
) -> WageBreakdown {
    let mut present_days = 0;
    let mut half_days = 0;
    let mut overtime_hours = 0.0;
    let mut pieces = 0;

    for r in records {
        match r.status {
            AttendanceStatus::Present => present_days += 1,
            AttendanceStatus::HalfDay => half_days += 1,
            _ => {}
        }
        overtime_hours += r.overtime_hours;
        pieces += r.pieces.unwrap_or(0);
    }

    let paid_days = present_days as f64 + half_days as f64 * 0.5;

    let basic = match worker.wage_type {
        WageType::Daily => (worker.wage_rate as f64 * paid_days).round() as i64,
        WageType::Monthly => {
            if working_days > 0 {
                ((worker.wage_rate as f64 * paid_days) / working_days as f64).round() as i64
            } else {
                0
            }
        }
        WageType::PieceRate => worker.wage_rate * pieces,
    };

    let overtime = (worker.overtime_rate_per_hour as f64 * overtime_hours).round() as i64;
    let gross = basic + overtime;
    let advance_deduction = advance_outstanding.min(gross);

    WageBreakdown {
        present_days,
        half_days,
        paid_days,
        overtime_hours,
        pieces,
        basic,
        overtime,
        gross,
        advance_deduction,
        net: gross - advance_deduction,
    }
}

pub fn build_payroll_line(
    worker: &Worker,
    records: &[AttendanceRecord],
    working_days: i64,
    expected_days: i64,
    advance_outstanding: Paise,
    adjustment: Option<&PayrollAdjustment>,
) -> PayrollLine {
    let w = calculate_wage(worker, records, working_days, 0);
    let default_adj = PayrollAdjustment::default();
    let adj = adjustment.unwrap_or(&default_adj);

    let gross = w.basic + w.overtime + adj.bonus;
    let available = (gross - adj.other_deduction).max(0);
    let max_recovery = advance_outstanding.min(available);
    let advance_deduction = adj
        .advance_deduction
        .unwrap_or(max_recovery)
        .clamp(0, max_recovery);

    let marked = records.len() as i64;
    let absent_days = records.iter().filter(|r| r.status == AttendanceStatus::Absent).count() as i64;
    let leave_days = records.iter().filter(|r| r.status == AttendanceStatus::Leave).count() as i64;

    PayrollLine {
        worker_id: worker.id.clone(),
        code: worker.code.clone(),
        name: worker.name.clone(),
        department: worker.department.clone(),
        designation: worker.designation.clone(),
        wage_type: worker.wage_type,
        wage_rate: worker.wage_rate,
        overtime_rate_per_hour: worker.overtime_rate_per_hour,
        present_days: w.present_days,
        half_days: w.half_days,
        absent_days,
        leave_days,
        paid_days: w.paid_days,
        unmarked_days: (expected_days - marked).max(0),
        overtime_hours: w.overtime_hours,
        pieces: w.pieces,
        basic: w.basic,
        overtime: w.overtime,
        bonus: adj.bonus,
        other_deduction: adj.other_deduction,
        other_deduction_note: adj.other_deduction_note.clone(),
        gross,
        advance_outstanding,
        advance_deduction,
        net: gross - adj.other_deduction - advance_deduction,
        payment_id: None,
    }
}
