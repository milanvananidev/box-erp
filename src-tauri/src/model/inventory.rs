use crate::model::{Paise, PaymentMode};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum MaterialCategory {
    #[serde(rename = "Paper Roll")]
    PaperRoll,
    #[serde(rename = "Gum & Adhesive")]
    GumAdhesive,
    #[serde(rename = "Ink")]
    Ink,
    #[serde(rename = "Stitching Wire")]
    StitchingWire,
    #[serde(rename = "Strapping")]
    Strapping,
    #[serde(rename = "Consumable")]
    Consumable,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MaterialUnit {
    Kg,
    Roll,
    Litre,
    Pcs,
    Bag,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Material {
    pub id: String,
    pub code: String,
    pub name: String,
    pub category: MaterialCategory,
    pub unit: MaterialUnit,
    pub stock: i64,
    pub reorder_level: i64,
    pub avg_cost: Paise,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gsm: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bf: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deckle_inch: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preferred_vendor_id: Option<String>,
    pub active: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum StockStatus {
    Ok,
    Low,
    Out,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialRow {
    #[serde(flatten)]
    pub material: Material,
    pub status: StockStatus,
    pub value: Paise,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_inward: Option<String>,
    pub issued_this_month: i64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MovementType {
    Opening,
    Inward,
    Issue,
    Adjustment,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AdjustmentReason {
    StockCount,
    Damage,
    MoistureLoss,
    ReturnToVendor,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StockMovement {
    pub id: String,
    pub material_id: String,
    pub date: String,
    #[serde(rename = "type")]
    pub movement_type: MovementType,
    pub qty: i64,
    pub rate: Paise,
    pub value: Paise,
    pub balance_after: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vendor_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vendor_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bill_no: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reels: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order_no: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<AdjustmentReason>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transaction_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialInput {
    pub name: String,
    pub code: String,
    pub category: MaterialCategory,
    pub unit: MaterialUnit,
    pub reorder_level: i64,
    pub gsm: Option<i64>,
    pub bf: Option<i64>,
    pub deckle_inch: Option<i64>,
    pub preferred_vendor_id: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PayNowInput {
    pub mode: PaymentMode,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InwardInput {
    pub material_id: String,
    pub date: String,
    pub qty: i64,
    pub rate: Paise,
    pub vendor_id: Option<String>,
    pub bill_no: Option<String>,
    pub reels: Option<i64>,
    pub note: Option<String>,
    pub pay_now: Option<PayNowInput>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueInput {
    pub material_id: String,
    pub date: String,
    pub qty: i64,
    pub order_id: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdjustInput {
    pub material_id: String,
    pub date: String,
    pub new_stock: i64,
    pub reason: AdjustmentReason,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialConsumption {
    pub material_id: String,
    pub code: String,
    pub name: String,
    pub unit: String,
    pub inward: i64,
    pub issued: i64,
    pub value: Paise,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderConsumption {
    pub order_id: String,
    pub order_no: String,
    pub customer: String,
    pub product: String,
    pub issued_kg: i64,
    pub value: Paise,
    pub expected_kg: i64,
    pub variance_pct: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsumptionReport {
    pub by_material: Vec<MaterialConsumption>,
    pub by_order: Vec<OrderConsumption>,
}
