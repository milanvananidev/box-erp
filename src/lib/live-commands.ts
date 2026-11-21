/**
 * Commands that have a real Rust/MongoDB implementation. When the app runs
 * in the desktop shell with VITE_DATA_SOURCE=tauri, these go to the backend;
 * everything else keeps using the in-memory mocks until its module is ported.
 * Keep in sync with `app_commands!` in src-tauri/src/lib.rs.
 */
export const LIVE_COMMANDS = new Set<string>([
  // Income & Expenses
  "transactions_list",
  "transactions_recent",
  "transactions_create",
  "transactions_delete",
  "transactions_find_similar",
  "parties_list",
  "categories_list",
  "dashboard_cash_flow",
  // Workers & HR
  "workers_roster",
  "worker_create",
  "worker_update",
  "worker_set_active",
  "attendance_for_day",
  "attendance_for_worker_month",
  "attendance_save_day",
  "advances_list",
  "advance_create",
  "advance_delete",
  "worker_payment_history",
  // Production
  "production_orders_list",
  "production_entries_list",
  "production_customers",
  "production_month_output",
  "production_active_orders",
  "production_order_create",
  "production_order_update",
  "production_order_set_stage",
  "production_order_hold",
  "production_order_resume",
  "production_order_delete",
  "production_entry_create",
  "production_entry_delete",
  // Inventory
  "materials_list",
  "stock_movements_list",
  "stock_consumption",
  "material_create",
  "material_update",
  "stock_inward",
  "stock_issue",
  "stock_adjust",
  "stock_movement_delete",
  // Payroll
  "payroll_periods",
  "payroll_run_get",
  "payroll_adjust_line",
  "payroll_finalize",
  "payroll_reopen",
  "payroll_pay",
  "payroll_pending_lines",
  "payroll_payments",
  "payroll_pending",
  // Dashboard & Alerts
  "dashboard_summary",
  "alerts_list",
  // Reports
  "report_profit",
  "report_cash_flow",
  "report_labour",
  "report_attendance",
  "report_payroll",
  "report_production",
  // Settings & Utilities
  "company_settings_get",
  "company_settings_update",
  "vyapar_import",
  "export_xlsx",
  // Costing & Quotations
  "quotations_list",
  "quotation_save",
  "quotation_delete",
  "paper_rates_get",
  "paper_rates_save",
]);

export const LIVE_MODULES = [
  "Dashboard",
  "Income & Expenses",
  "Workers & HR",
  "Box Costing",
  "Inventory",
  "Payroll",
  "Reports",
  "Alerts",
  "Settings",
];
export const MOCK_MODULES: string[] = [];
