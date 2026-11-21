//! IPC + storage models. Field names and shapes mirror `src/types/domain.ts`
//! (camelCase JSON, money as integer paise, dates as `yyyy-MM-dd`).
//!
//! Each document stores its own string `id` (ObjectId hex) with a unique index;
//! MongoDB's internal `_id` is ignored on read, so one struct serves both the
//! database and the UI.

pub mod dashboard;
pub mod finance;
pub mod inventory;
pub mod payroll;
pub mod production;
pub mod reports;
pub mod settings;
pub mod workers;

use serde::{Deserialize, Serialize};

pub type Paise = i64;

pub fn new_id() -> String {
    mongodb::bson::oid::ObjectId::new().to_hex()
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum PaymentMode {
    Cash,
    Bank,
    Upi,
}
