//! BoxERP desktop backend.
//!
//! The React UI never sees database credentials or talks to MongoDB directly.
//! Every read/write goes through a `#[tauri::command]` defined in [`commands`],
//! which uses the connection held in [`db::Db`].

mod commands;
mod dates;
mod db;
mod error;
mod model;
mod store;

#[cfg(test)]
mod tests;

use db::Db;
use tauri::Manager;

/// Every production command, listed once and shared by debug/release builds.
macro_rules! app_commands {
    ($($extra:path),* $(,)?) => {
        tauri::generate_handler![
            commands::db::db_status,
            commands::db::db_configure,
            commands::db::db_forget,
            commands::finance::transactions_list,
            commands::finance::transactions_recent,
            commands::finance::transactions_create,
            commands::finance::transactions_delete,
            commands::finance::transactions_find_similar,
            commands::finance::parties_list,
            commands::finance::categories_list,
            commands::finance::dashboard_cash_flow,
            commands::workers::workers_roster,
            commands::workers::worker_create,
            commands::workers::worker_update,
            commands::workers::worker_set_active,
            commands::workers::attendance_for_day,
            commands::workers::attendance_for_worker_month,
            commands::workers::attendance_save_day,
            commands::workers::advances_list,
            commands::workers::advance_create,
            commands::workers::advance_delete,
            commands::workers::worker_payment_history,
            commands::production::production_orders_list,
            commands::production::production_entries_list,
            commands::production::production_customers,
            commands::production::production_month_output,
            commands::production::production_active_orders,
            commands::production::production_order_create,
            commands::production::production_order_update,
            commands::production::production_order_set_stage,
            commands::production::production_order_hold,
            commands::production::production_order_resume,
            commands::production::production_order_delete,
            commands::production::production_entry_create,
            commands::production::production_entry_delete,
            commands::inventory::materials_list,
            commands::inventory::stock_movements_list,
            commands::inventory::stock_consumption,
            commands::inventory::material_create,
            commands::inventory::material_update,
            commands::inventory::stock_inward,
            commands::inventory::stock_issue,
            commands::inventory::stock_adjust,
            commands::inventory::stock_movement_delete,
            commands::payroll::payroll_periods,
            commands::payroll::payroll_run_get,
            commands::payroll::payroll_adjust_line,
            commands::payroll::payroll_finalize,
            commands::payroll::payroll_reopen,
            commands::payroll::payroll_pay,
            commands::payroll::payroll_pending_lines,
            commands::payroll::payroll_payments,
            commands::payroll::payroll_pending,
            commands::dashboard::dashboard_summary,
            commands::dashboard::alerts_list,
            commands::reports::report_profit,
            commands::reports::report_cash_flow,
            commands::reports::report_labour,
            commands::reports::report_attendance,
            commands::reports::report_payroll,
            commands::reports::report_production,
            commands::settings::company_settings_get,
            commands::settings::company_settings_update,
            commands::vyapar::vyapar_import,
            commands::export::export_xlsx,
            $($extra),*
        ]
    };
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().manage(Db::default()).setup(|app| {
        // Connect in the background so the window appears immediately.
        let handle = app.handle().clone();
        tauri::async_runtime::spawn(async move {
            let db = handle.state::<Db>();
            if let Err(e) = db.connect_from_saved().await {
                log::warn!("database not connected at start-up: {e}");
            }
        });
        Ok(())
    });

    #[cfg(debug_assertions)]
    let builder = builder.invoke_handler(app_commands![commands::dev::dev_import_demo]);
    #[cfg(not(debug_assertions))]
    let builder = builder.invoke_handler(app_commands![]);

    builder.run(tauri::generate_context!()).expect("error while running BoxERP");
}
