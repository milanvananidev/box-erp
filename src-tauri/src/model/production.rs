use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum ProductionStage {
    Planned,
    Corrugation,
    Printing,
    Cutting,
    Pasting,
    Bundling,
    Completed,
    OnHold,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoxSpec {
    pub ply: u8,
    pub length_mm: i64,
    pub width_mm: i64,
    pub height_mm: i64,
    pub flute: String,
    pub gsm: i64,
    pub printed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub colors: Option<i64>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OrderPriority {
    Normal,
    Urgent,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WastageReason {
    BoardDefect,
    PrintMisregister,
    DieCutError,
    MachineSetup,
    HandlingDamage,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionOrder {
    pub id: String,
    pub order_no: String,
    pub customer: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub customer_ref: Option<String>,
    pub product: String,
    pub spec: BoxSpec,
    pub planned_qty: i64,
    pub produced_qty: i64,
    pub wastage_qty: i64,
    pub stage: ProductionStage,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub held_from_stage: Option<ProductionStage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hold_reason: Option<String>,
    pub priority: OrderPriority,
    pub start_date: String,
    pub due_date: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_on: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionEntry {
    pub id: String,
    pub order_id: String,
    pub date: String,
    pub stage: ProductionStage,
    pub good_qty: i64,
    pub wastage_qty: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wastage_reason: Option<WastageReason>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderInput {
    pub customer: String,
    pub customer_ref: Option<String>,
    pub product: String,
    pub spec: BoxSpec,
    pub planned_qty: i64,
    pub priority: OrderPriority,
    pub start_date: String,
    pub due_date: String,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryInput {
    pub order_id: String,
    pub date: String,
    pub stage: ProductionStage,
    pub good_qty: i64,
    pub wastage_qty: i64,
    pub wastage_reason: Option<WastageReason>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonthOutput {
    pub good: i64,
    pub wastage: i64,
}

pub const STAGE_FLOW: [ProductionStage; 7] = [
    ProductionStage::Planned,
    ProductionStage::Corrugation,
    ProductionStage::Printing,
    ProductionStage::Cutting,
    ProductionStage::Pasting,
    ProductionStage::Bundling,
    ProductionStage::Completed,
];

pub fn stages_for(spec: &BoxSpec) -> Vec<ProductionStage> {
    STAGE_FLOW
        .into_iter()
        .filter(|&s| s != ProductionStage::Printing || spec.printed)
        .collect()
}

pub fn working_stage(o: &ProductionOrder) -> ProductionStage {
    if o.stage == ProductionStage::OnHold {
        o.held_from_stage.unwrap_or(ProductionStage::Planned)
    } else {
        o.stage
    }
}

pub fn next_stage(o: &ProductionOrder) -> Option<ProductionStage> {
    let flow = stages_for(&o.spec);
    let curr = working_stage(o);
    let idx = flow.iter().position(|&s| s == curr)?;
    if idx + 1 < flow.len() {
        Some(flow[idx + 1])
    } else {
        None
    }
}

#[allow(dead_code)]
pub struct BlankSize {
    pub length_mm: i64,
    pub width_mm: i64,
}

#[allow(dead_code)]
pub fn caliper(flute: &str) -> f64 {
    match flute {
        "A" => 5.0,
        "B" => 3.0,
        "C" => 4.0,
        "E" => 1.5,
        "BC" => 7.0,
        _ => 4.0,
    }
}

#[allow(dead_code)]
pub fn take_up(flute: &str) -> f64 {
    match flute {
        "A" => 1.54,
        "B" => 1.36,
        "C" => 1.46,
        "E" => 1.27,
        "BC" => 1.41,
        _ => 1.40,
    }
}

#[allow(dead_code)]
pub fn blank_size(spec: &BoxSpec) -> BlankSize {
    let t = caliper(&spec.flute);
    BlankSize {
        length_mm: (2.0 * spec.length_mm as f64 + 2.0 * spec.width_mm as f64 + 35.0 + 4.0 * t).round() as i64,
        width_mm: (spec.height_mm as f64 + spec.width_mm as f64 + 2.0 * t).round() as i64,
    }
}

#[allow(dead_code)]
pub fn paper_per_box(spec: &BoxSpec) -> i64 {
    let b = blank_size(spec);
    let area = (b.length_mm as f64 / 1000.0) * (b.width_mm as f64 / 1000.0);
    let liners = (spec.ply as f64 + 1.0) / 2.0;
    let flutes = (spec.ply as f64 - 1.0) / 2.0;
    let gsm_total = liners * spec.gsm as f64 + flutes * spec.gsm as f64 * take_up(&spec.flute);
    (area * gsm_total).round() as i64
}
