//! Tauri commands, one module per ERP area. Each command:
//!  * takes typed, validated input,
//!  * gets the `Store` (client + database) from managed state,
//!  * returns DTOs that mirror `src/types/domain.ts` (camelCase, money in paise).
//!
//! Live so far: database connection, finance, workers/attendance/advances.
//! Production, inventory, payroll, dashboard summary and reports still run
//! on the frontend mocks (see `src/lib/live-commands.ts`).

pub mod dashboard;
pub mod db;
pub mod dev;
pub mod export;
pub mod finance;
pub mod inventory;
pub mod payroll;
pub mod production;
pub mod reports;
pub mod settings;
pub mod vyapar;
pub mod workers;
