use crate::db::{Db, DbStatus};
use crate::error::AppResult;
use tauri::State;

#[tauri::command]
pub async fn db_status(db: State<'_, Db>) -> AppResult<DbStatus> {
    Ok(db.status().await)
}

#[tauri::command]
pub async fn db_configure(db: State<'_, Db>, uri: String, database: String) -> AppResult<DbStatus> {
    db.configure(uri.trim().to_string(), database.trim().to_string()).await
}

#[tauri::command]
pub async fn db_forget(db: State<'_, Db>) -> AppResult<DbStatus> {
    db.forget().await
}
