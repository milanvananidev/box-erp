use crate::model::Paise;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompanySettings {
    pub name: String,
    pub address: String,
    pub phone: String,
    pub gstin: String,
    pub wastage_target_pct: f64,
    pub weekly_off: String,
    pub opening_cash_balance: Paise,
    pub opening_bank_balance: Paise,
    pub opening_date: String,
}

impl Default for CompanySettings {
    fn default() -> Self {
        Self {
            name: "Gujarat Corrugated Box Industry".into(),
            address: "Plot 42, GIDC Industrial Estate, Rajkot, Gujarat 360001".into(),
            phone: "+91 98765 43210".into(),
            gstin: "24AABCB1234D1Z2".into(),
            wastage_target_pct: 3.0,
            weekly_off: "Sunday".into(),
            opening_cash_balance: 0,
            opening_bank_balance: 0,
            opening_date: "2026-04-01".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompanySettingsDoc {
    pub id: String,
    #[serde(flatten)]
    pub settings: CompanySettings,
}
