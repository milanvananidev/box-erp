use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaperLayer {
    pub layer_num: i32,
    pub role: String,
    pub is_fluting: bool,
    pub bf: f64,
    pub gsm: f64,
    pub rate: f64,
    pub flute_factor: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub weight_kg: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cost_rs: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaperRateItem {
    pub id: String,
    pub bf: f64,
    pub min_gsm: f64,
    pub max_gsm: f64,
    pub rate_per_kg: f64,
    pub paper_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrugatedBoxInput {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub box_no: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub c_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub box_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remark: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unit_mode: Option<String>,
    pub length_mm: f64,
    pub width_mm: f64,
    pub height_mm: f64,
    pub ply: i32,
    pub layers: Vec<PaperLayer>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub add_l_mm: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub add_w_mm: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ups: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub waste_percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conversion_rate: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conv_type: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub printing_rate: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transport_per_box: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lamination_per_box: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub partition_cost: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub setup_cost: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order_qty: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profit_percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tax_percent: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrugatedBoxResult {
    pub sheet_length_inch: f64,
    pub sheet_width_inch: f64,
    pub sheet_area_sqm: f64,
    pub in_mm_l: f64,
    pub in_mm_w: f64,
    pub layers: Vec<PaperLayer>,
    pub total_gsm: f64,
    pub total_bs: f64,
    pub total_weight_kg: f64,
    pub total_paper_weight_kg: f64,
    pub total_paper_cost: f64,
    pub wastage_cost: f64,
    pub conversion_cost: f64,
    pub printing_cost: f64,
    pub transport_cost: f64,
    pub lamination_cost: f64,
    pub partition_cost: f64,
    pub setup_cost_per_box: f64,
    pub manufacturing_cost: f64,
    pub base_manufacturing_cost: f64,
    pub profit_amount: f64,
    pub basic_price: f64,
    pub tax_percent: f64,
    pub tax_amount: f64,
    pub final_box_rate: f64,
    pub price_with_tax: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuotationDoc {
    pub id: String,
    pub quotation_number: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_id: Option<String>,
    pub client_name: String,
    pub box_name: String,
    pub date: String,
    pub status: String,
    pub unit_mode: String,
    pub input: CorrugatedBoxInput,
    pub result: CorrugatedBoxResult,
    pub quantity: f64,
    pub basic_price: f64,
    pub tax_percent: f64,
    pub tax_amount: f64,
    pub total_amount: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    pub created_at: String,
}
