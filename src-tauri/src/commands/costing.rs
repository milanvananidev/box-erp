//! Box Costing & Quotation commands.

use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::model::costing::{PaperRateItem, QuotationDoc};
use crate::model::new_id;
use crate::store::{find_all, Store};
use mongodb::bson::{doc, to_document};
use tauri::State;

const RATES_DOC_ID: &str = "paper_rate_matrix";

fn default_paper_rates() -> Vec<PaperRateItem> {
    vec![
        PaperRateItem {
            id: "r1".into(),
            bf: 14.0,
            min_gsm: 100.0,
            max_gsm: 140.0,
            rate_per_kg: 32.0,
            paper_type: "Semi Kraft".into(),
        },
        PaperRateItem {
            id: "r2".into(),
            bf: 16.0,
            min_gsm: 140.0,
            max_gsm: 180.0,
            rate_per_kg: 36.0,
            paper_type: "Medium Kraft".into(),
        },
        PaperRateItem {
            id: "r3".into(),
            bf: 18.0,
            min_gsm: 140.0,
            max_gsm: 180.0,
            rate_per_kg: 42.0,
            paper_type: "Virgin Fluting".into(),
        },
        PaperRateItem {
            id: "r4".into(),
            bf: 22.0,
            min_gsm: 180.0,
            max_gsm: 220.0,
            rate_per_kg: 48.0,
            paper_type: "High BF Kraft".into(),
        },
        PaperRateItem {
            id: "r5".into(),
            bf: 28.0,
            min_gsm: 200.0,
            max_gsm: 260.0,
            rate_per_kg: 54.0,
            paper_type: "Test Liner".into(),
        },
    ]
}

pub(crate) async fn list_quotations(s: &Store) -> AppResult<Vec<QuotationDoc>> {
    find_all(&s.quotations(), doc! {}, doc! { "date": -1, "createdAt": -1 }).await
}

pub(crate) async fn save_quotation(s: &Store, mut input: QuotationDoc) -> AppResult<QuotationDoc> {
    if input.id.trim().is_empty() {
        input.id = new_id();
    }
    if input.quotation_number.trim().is_empty() {
        let seq = s.next_seq("quotation_no", 1000).await?;
        input.quotation_number = format!("QT-{seq:04}");
    }

    s.quotations()
        .replace_one(doc! { "id": &input.id }, &input)
        .upsert(true)
        .await?;

    Ok(input)
}

pub(crate) async fn delete_quotation(s: &Store, id: &str) -> AppResult<String> {
    let res = s.quotations().delete_one(doc! { "id": id }).await?;
    if res.deleted_count == 0 {
        return Err(AppError::NotFound("Quotation not found".into()));
    }
    Ok(id.to_string())
}

pub(crate) async fn get_paper_rates(s: &Store) -> AppResult<Vec<PaperRateItem>> {
    #[derive(serde::Deserialize)]
    struct Wrapper {
        rates: Vec<PaperRateItem>,
    }

    let doc = s
        .paper_rates()
        .find_one(doc! { "id": RATES_DOC_ID })
        .await?;

    match doc {
        Some(d) => {
            let w: Wrapper = mongodb::bson::from_document(d)
                .map_err(|e| AppError::Internal(format!("Failed to parse rates: {e}")))?;
            Ok(w.rates)
        }
        None => Ok(default_paper_rates()),
    }
}

pub(crate) async fn save_paper_rates(
    s: &Store,
    rates: Vec<PaperRateItem>,
) -> AppResult<Vec<PaperRateItem>> {
    #[derive(serde::Serialize)]
    struct Wrapper {
        id: String,
        rates: Vec<PaperRateItem>,
    }

    let w = Wrapper {
        id: RATES_DOC_ID.into(),
        rates: rates.clone(),
    };
    let doc = to_document(&w)
        .map_err(|e| AppError::Internal(format!("Failed to serialize rates: {e}")))?;

    s.paper_rates()
        .replace_one(doc! { "id": RATES_DOC_ID }, doc)
        .upsert(true)
        .await?;

    Ok(rates)
}

#[tauri::command]
pub async fn quotations_list(db: State<'_, Db>) -> AppResult<Vec<QuotationDoc>> {
    list_quotations(&db.store().await?).await
}

#[tauri::command]
pub async fn quotation_save(db: State<'_, Db>, input: QuotationDoc) -> AppResult<QuotationDoc> {
    save_quotation(&db.store().await?, input).await
}

#[tauri::command]
pub async fn quotation_delete(db: State<'_, Db>, id: String) -> AppResult<String> {
    delete_quotation(&db.store().await?, &id).await
}

#[tauri::command]
pub async fn paper_rates_get(db: State<'_, Db>) -> AppResult<Vec<PaperRateItem>> {
    get_paper_rates(&db.store().await?).await
}

#[tauri::command]
pub async fn paper_rates_save(
    db: State<'_, Db>,
    rates: Vec<PaperRateItem>,
) -> AppResult<Vec<PaperRateItem>> {
    save_paper_rates(&db.store().await?, rates).await
}
