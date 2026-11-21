//! Company profile, factory rules, and opening balance settings.

use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::model::settings::{CompanySettings, CompanySettingsDoc};
use crate::store::Store;
use mongodb::bson::doc;
use tauri::State;

const SETTINGS_ID: &str = "company_settings";

pub(crate) async fn get_company_settings(s: &Store) -> AppResult<CompanySettings> {
    let doc = s
        .settings()
        .find_one(doc! { "id": SETTINGS_ID })
        .await?;
    match doc {
        Some(d) => Ok(d.settings),
        None => Ok(CompanySettings::default()),
    }
}

pub(crate) async fn update_company_settings(
    s: &Store,
    input: CompanySettings,
) -> AppResult<CompanySettings> {
    if input.name.trim().is_empty() {
        return Err(AppError::Validation("Company name cannot be empty".into()));
    }
    if input.wastage_target_pct < 0.0 || input.wastage_target_pct > 100.0 {
        return Err(AppError::Validation(
            "Wastage target percentage must be between 0 and 100".into(),
        ));
    }
    if input.opening_date.trim().is_empty() {
        return Err(AppError::Validation("Opening balance date is required".into()));
    }

    let doc_to_save = CompanySettingsDoc {
        id: SETTINGS_ID.into(),
        settings: input.clone(),
    };

    s.settings()
        .replace_one(doc! { "id": SETTINGS_ID }, doc_to_save)
        .upsert(true)
        .await?;

    Ok(input)
}

#[tauri::command]
pub async fn company_settings_get(db: State<'_, Db>) -> AppResult<CompanySettings> {
    get_company_settings(&db.store().await?).await
}

#[tauri::command]
pub async fn company_settings_update(
    db: State<'_, Db>,
    input: CompanySettings,
) -> AppResult<CompanySettings> {
    update_company_settings(&db.store().await?, input).await
}
