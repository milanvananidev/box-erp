use super::{Paise, PaymentMode};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Direction {
    In,
    Out,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CashTreatment {
    Operating,
    Advance,
    Capital,
    Transfer,
    Loan,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TxnSource {
    Manual,
    VyaparImport,
}

/// Which module created a cash-book entry. Such entries can only be changed
/// from that module, so the two records never drift apart.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Origin {
    pub module: String,
    pub ref_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Transaction {
    pub id: String,
    pub date: String,
    pub direction: Direction,
    pub amount: Paise,
    pub category: String,
    pub treatment: CashTreatment,
    pub mode: PaymentMode,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub party_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub party_name: Option<String>,
    pub particulars: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reference: Option<String>,
    pub source: TxnSource,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub external_ref: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub matched_to: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub origin: Option<Origin>,
    pub created_at: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PartyType {
    Customer,
    Vendor,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Party {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub party_type: PartyType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gstin: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpenseCategory {
    pub id: String,
    pub name: String,
    pub direction: Direction,
    pub treatment: CashTreatment,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionInput {
    pub date: String,
    pub direction: Direction,
    pub amount: Paise,
    pub category: String,
    pub mode: PaymentMode,
    pub party_id: Option<String>,
    pub particulars: String,
    pub reference: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimilarInput {
    pub date: String,
    pub direction: Direction,
    pub amount: Paise,
    pub party_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CashFlowPoint {
    pub label: String,
    pub start: String,
    pub cash_in: Paise,
    pub cash_out: Paise,
}

/// Default chart of categories created on first connect.
pub fn default_categories() -> Vec<ExpenseCategory> {
    use CashTreatment::*;
    use Direction::*;
    let c = |id: &str, name: &str, direction, treatment| ExpenseCategory { id: id.into(), name: name.into(), direction, treatment };
    vec![
        c("sales", "Sales Receipt", In, Operating),
        c("scrap", "Scrap Sale", In, Operating),
        c("loan_in", "Loan Received", In, Loan),
        c("raw", "Raw Material", Out, Operating),
        c("wages", "Wages & Salary", Out, Operating),
        c("advance", "Salary Advance", Out, Advance),
        c("power", "Electricity", Out, Operating),
        c("transport", "Transport & Freight", Out, Operating),
        c("maint", "Repairs & Maintenance", Out, Operating),
        c("rent", "Rent", Out, Operating),
        c("machinery", "Machinery Purchase", Out, Capital),
        c("misc", "Miscellaneous", Out, Operating),
    ]
}
