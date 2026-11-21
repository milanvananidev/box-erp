# BoxERP — Handoff

**For:** the next coding agent (Antigravity)
**Date:** 21 Nov 2026
**Repo:** `~/Desktop/box-erp` (git initialised, **no commits yet**)

Read this file in full before changing anything. The project README (`README.md`) covers how to run the app and the business rules in more detail.

---

## 1. What this is

BoxERP is a desktop ERP for a corrugated box factory in Gujarat, India. It is built with **Tauri 2 + React + TypeScript** and uses **MongoDB (remote, Atlas in production)**, accessed **only from Rust**.

- There is **no Express or Nest server**, and none should be added. React calls `#[tauri::command]`s, and Rust talks to MongoDB.
- **No shared database credentials are built into the app.** The connection string is entered once per computer in Settings and stored in the OS keychain (`src-tauri/src/db/config.rs`). Remote connections must use TLS.
- **Vyapar remains the billing and GST system.** Do **not** build invoicing.
- The UI follows a reference dashboard design: dark sidebar, cardboard-brown accent, light content area. The target screen sizes are 1366px and 1920px wide.

## 2. Current status

All 7 modules have working screens on **mock data**. The Rust/MongoDB migration has started.

| Module | Screens | Data source |
| --- | --- | --- |
| Dashboard | ✅ | mock (summary); cash-flow chart is live |
| Income & Expenses | ✅ | **LIVE (Rust + MongoDB)** |
| Workers & HR (attendance, advances) | ✅ | **LIVE (Rust + MongoDB)** |
| Production | ✅ | mock |
| Inventory | ✅ | mock |
| Payroll | ✅ | mock |
| Reports | ✅ | mock |
| Alerts (bell icon) | ✅ | mock |
| Settings (DB connection, demo import) | ✅ | live |

**How the live/mock switch works:** every frontend call goes through `command(name, args, mockFn)` in `src/lib/ipc.ts`. A call goes to Rust only when **both** of these are true:
1. The app is running inside Tauri with `VITE_DATA_SOURCE=tauri` (set in `.env.development.local`, which is git-ignored).
2. The command name is listed in **`src/lib/live-commands.ts`** (`LIVE_COMMANDS`).

Otherwise the call runs the mock implementation. **When you port a command, add it to the `app_commands!` macro in `src-tauri/src/lib.rs` *and* to `LIVE_COMMANDS`, and update the `LIVE_MODULES` / `MOCK_MODULES` lists in the same file.**

### Tests and checks (all passing)
- `pnpm build` (runs `tsc -b`, then the Vite build) passes.
- `cd src-tauri && cargo test`: 7 tests, 0 warnings. These include 2 integration tests against a real MongoDB (`src-tauri/src/tests.rs`). They are **skipped, not failed**, when no MongoDB is reachable. To check they actually ran, use `cargo test -- --nocapture` and confirm there is no "⚠ skipping" line.
- I checked every screen in the browser at 1366px.
- **Not yet checked:** the live screens inside the real Tauri window. I started `pnpm tauri dev` against the local database, and the `target/debug/box-erp` process was running, but I didn't click through it.

### Processes left running by the previous session
- `mongod --replSet rs0 --port 27018`. Its `--dbpath` is in a **temporary scratch folder** that may be wiped. Use your own folder (see section 4).
- `pnpm tauri dev` and `target/debug/box-erp`.
- A Vite dev server on port **1420**.

Stop anything you don't need (`pkill -f "tauri dev"; pkill -f target/debug/box-erp; pkill -f "mongod --replSet"`) before starting fresh.

## 3. Stack — versions matter

These are recent major versions, and their APIs differ from most examples online.

| Package | Version | Note |
| --- | --- | --- |
| React | 19 | |
| TypeScript | **7** | `npx tsc --noEmit -p .` |
| Vite | **8** (rolldown) | |
| Tailwind | **4** | CSS-first config: all design tokens are in `src/index.css` (`@theme inline`). There is no `tailwind.config.js`. |
| **TanStack Table** | **9** | **Not v8.** Uses `useTable`, `tableFeatures({...})`, `createSortedRowModel()`, `table.FlexRender`, `ColumnDef<TFeatures, TData>`. The wrapper is `src/components/shared/DataTable.tsx`. Docs ship inside the package: `node_modules/@tanstack/react-table/skills/`. |
| TanStack Query | 5 | |
| Zustand | 5 | UI state only (`src/stores/ui.ts`) |
| Recharts | 3 | |
| zod | **4** | `z.number({ error: "..." })`, not `required_error` |
| lucide-react | 1.x | |
| shadcn-style UI | hand-written | in `src/components/ui/*`, built on Radix |
| Rust | 1.100 | |
| `mongodb` crate | 3.2 | builder-style calls: `coll.find(filter).sort(..).await`, `.session(&mut s)` |
| `keyring` | 3 | |
| `chrono` | 0.4 | |

Package manager: **pnpm**.

## 4. Running it

Browser preview (mock data only, fastest for UI work):
```bash
pnpm dev
```
It serves http://localhost:1420.

Local database. Multi-document transactions need a replica set, so `--replSet` is required:
```bash
mkdir -p ~/boxerp-dev-db
```
```bash
mongod --replSet rs0 --port 27018 --bind_ip 127.0.0.1 --dbpath ~/boxerp-dev-db
```
The first time, the replica set must be initiated. Running the Rust integration tests once does this automatically:
```bash
cd src-tauri && cargo test
```

Desktop app against the local database. **Debug builds only** read `BOXERP_MONGODB_URI` and `BOXERP_MONGODB_DB`:
```bash
BOXERP_MONGODB_URI='mongodb://127.0.0.1:27018/?replicaSet=rs0' BOXERP_MONGODB_DB=boxerp_dev pnpm tauri dev
```
If Vite is already running on port 1420, add `--config '{"build":{"beforeDevCommand":""}}'`.

Then go to **Settings → Load demo data (dev)**. This copies the mock seed into an **empty** database. It refuses if the collections already contain data, and it is compiled only into debug builds (`src-tauri/src/commands/dev.rs`).

## 5. Code map

```
src/
  index.css                 design tokens (the single source of colours/radii/shadows) + print CSS
  lib/ipc.ts                command(name, args, mock) — the ONLY way the UI reaches the backend
  lib/live-commands.ts      which commands go to Rust
  lib/format.ts             ₹ formatting (Indian grouping), paise helpers, dates
  lib/payroll.ts            wage maths: calculateWage, buildPayrollLine, rupeesInWords
  lib/production.ts         stage flow, RSC blank size, paper-per-box estimate
  lib/csv.ts                CSV export (UTF-8 BOM)
  types/domain.ts           domain model; Rust models mirror it exactly
  data/mock/seed.ts         deterministic demo data relative to "today" (seeded PRNG)
  components/ui/            primitives (button, dialog, sheet, select, table, …)
  components/shared/        DataTable, StatCard, SectionCard, RingGauge, ConfirmDialog,
                            EmptyState/ErrorState, FormField, PrintPortal
  components/layout/        AppShell (hotkeys, DB banner), Sidebar, Topbar, CommandPalette
  features/<module>/        api.ts (mock impl + TanStack Query hooks), Page, components/
src-tauri/src/
  lib.rs                    app_commands! macro (single list of commands)
  error.rs                  AppError → serialised {kind, message}; never leaks connection strings
  dates.rs                  yyyy-MM-dd helpers, working_days (Mon–Sat), month maths
  store.rs                  Store {client, db}, typed collections, ensure_indexes, seed_defaults,
                            next_seq (counters), in_transaction (with retry)
  db/                       connection lifecycle + keychain config
  model/                    serde DTOs (camelCase) — one struct serves both MongoDB and IPC
  commands/finance.rs       ✅ live
  commands/workers.rs       ✅ live
  commands/dev.rs           debug-only demo import
  tests.rs                  integration tests
```

## 6. Conventions you must keep

- **Money is integer paise everywhere** (`i64` in Rust, `number` in TS). Format only for display.
- **Dates are `yyyy-MM-dd` strings**; months are `yyyy-MM`. String comparison is used for ranges. The weekly off is **Sunday**.
- **Document IDs:** each document stores its own string `id` (ObjectId hex, with a unique index). MongoDB's own `_id` is ignored when reading.
- **Rust DTOs mirror `src/types/domain.ts`:** `#[serde(rename_all = "camelCase")]`, and `skip_serializing_if = "Option::is_none"` on optional fields.
- **Command argument names:** Tauri converts Rust snake_case arguments to camelCase on the JS side (`worker_id` ↔ `workerId`). Inputs are passed as `{ input }` or as flat arguments, exactly as each mock `command(...)` call in `features/*/api.ts` does. Match those shapes.
- **Validation lives in Rust.** Error messages are written for end users and copied from the mocks. Use the `AppError` variants: `Validation` for bad input, `Conflict` for business-rule blocks, `NotFound`, `NotConfigured`.
- **Writes that touch more than one collection must use `store.in_transaction(...)`.** See `give_advance` and `delete_advance` in `commands/workers.rs`.
- **The UI pattern for every screen:** forms in a right-side drawer (`Sheet`) or a `Dialog`, `ConfirmDialog` for anything destructive, a sonner toast on success or error, and loading, empty and error states on every query. The URL holds which drawer is open (`?order=`, `?worker=`, `?material=`, `?new=1`).
- **Keyboard shortcuts:** ⌘K palette, ⌘B sidebar, ⌘1–8 jump to a module, ⌘⇧E / ⌘⇧I new expense / income, `/` table search, ⌘Enter save. Per page: `N` new, `I` inward, `O` issue.

## 7. Business rules already built (preserve these)

1. **No double counting:**
   - Vyapar imports carry `externalRef`. There is a unique partial index on `(source, externalRef)`.
   - A manual entry triggers a "possible duplicate" warning when an existing entry has the same direction and amount, the same party, and is within ±3 days.
   - Imported rows can't be deleted.
2. **Cash flow ≠ profit:**
   - Every transaction has a `treatment`: operating, advance, capital, transfer or loan.
   - Cash flow counts all of them. Profit counts operating items only.
   - **Labour cost in profit = payroll gross** (what was earned), not salary cash paid.
3. **Auto-created cash-book entries** carry `origin {module, refId}` and can only be changed from the module that created them. This covers advances, payroll payouts and paid inventory inwards. Finance refuses to delete them, in both the mock and Rust.
4. **Salary advances:**
   - Given only from Workers & HR. The "Salary Advance" category is hidden in the finance form, and Rust rejects it there.
   - Recorded with treatment `advance`, so they are never an expense.
   - Recovered in payroll, oldest first.
   - A worker can't be marked as left while an advance is outstanding.
5. **Attendance:** one record per worker per day (unique index), and a half day counts as 0.5. Absent or on-leave workers can't have overtime or pieces. Overtime is limited to 0–12 hours. No future dates.
6. **Wages** (`src/lib/payroll.ts`, **must be ported to Rust exactly**):
   - Daily wage = rate × paid days.
   - Monthly wage = rate × paid days ÷ working days in the month (Mon–Sat).
   - Piece rate = rate × pieces.
   - Plus overtime hours × overtime rate.
   - Advance recovery = min(amount outstanding, gross − other deductions). Net pay is never negative.
7. **Payroll:**
   - A draft is recalculated from attendance every time it's read.
   - **Finalise** is allowed only after the month ends. It freezes the lines.
   - **Reopen** is allowed only if nobody from that run has been paid.
   - **Pay** writes one salary payment per worker, recovers advances oldest first, and creates **one** "Wages & Salary" cash-book entry per payout batch.
8. **Inventory:**
   - The stock ledger is signed (+ in, − out). After any insert or delete, the material's ledger is **replayed in date order** (`rebuild()` in `features/inventory/api.ts`) to recompute running balances and the weighted average cost.
   - Any write that would make the balance negative on any day is rejected.
   - Adjustments are recorded for today only.
   - The opening balance can't be deleted.
9. **Production:**
   - Output entries are the source of truth for produced and wastage quantities.
   - Logging the first output moves a "planned" order to its next stage.
   - Completing an order short of its planned quantity requires confirmation.
   - A completed order's log is locked.
   - An order with output can't be deleted.
   - Plain (unprinted) boxes skip the Printing stage.

## 8. Next steps (in order)

1. **Check the live modules in the Tauri window.**
   - Load demo data, then in Income & Expenses add and delete an entry and confirm the duplicate warning appears.
   - In Workers & HR: mark attendance and save, give an advance (it should appear in the cash book with an "Advance" tag), try to delete that cash-book entry (it should be blocked), and delete the advance.
2. **Port Production** to `commands/production.rs`. Collections: `production_orders`, `production_entries`; order numbers via `next_seq("order_no", …)`. Commands:
   - `production_orders_list`, `production_entries_list`, `production_customers`, `production_month_output`, `production_active_orders`
   - `production_order_create` / `_update` / `_set_stage` / `_hold` / `_resume` / `_delete`
   - `production_entry_create` / `_delete`

   Port `stagesFor` / `nextStage` / `paperPerBox` from `lib/production.ts`. Extend `dev_import_demo` to cover the new collections.
3. **Port Inventory:** `materials_list`, `material_create` / `_update`, `stock_movements_list`, `stock_inward` (paid → cash-book entry with `origin inventory`, in a transaction), `stock_issue`, `stock_adjust`, `stock_movement_delete`, `stock_consumption`. The ledger replay must run inside the transaction.
4. **Port Payroll:**
   - Commands: `payroll_periods`, `payroll_run_get`, `payroll_adjust_line`, `payroll_finalize`, `payroll_reopen`, `payroll_pay`, `payroll_pending_lines`, `payroll_payments`.
   - Collections: `payroll_runs` (finalised, frozen lines) and `payroll_adjustments` (draft bonus/deductions).
   - Port the wage maths with **unit tests that match the TypeScript results**. For example, the October slip in the demo: 20.5 days × ₹650 + 6h × ₹80 − ₹2,000 = ₹11,805.
5. **Then:** `dashboard_summary`, `alerts_list`, `payroll_pending` (the dashboard card), and the `report_*` commands (profit, cash flow, labour, attendance, payroll, production). Prefer MongoDB aggregation pipelines where data is large. In the profit report, months before attendance tracking began fall back to salary cash paid (see `labourFor` in `features/reports/api.ts`).
6. **Clean up after everything is live:**
   - Delete the mock implementations, or keep them behind `import.meta.env.DEV` for UI work.
   - Make `ipc.ts` always invoke in the desktop app.
   - The two dashboard production figures (`monthProduction`) are still **fixed numbers**. Calculate them from production entries.
7. **Still to build:** Vyapar CSV import (idempotent on `externalRef`), native `.xlsx` export (Rust, e.g. `rust_xlsxwriter` + a save dialog), opening cash/bank balances, a Company section in Settings (`src/lib/company.ts` is a placeholder), and settings for the wastage target (3%) and the weekly off.
8. **Check printing in the Tauri window.** Salary slips and reports use `PrintPortal` + `window.print()`. On macOS the desktop app's web view (WKWebView) may not support `window.print()`; fall back to saving a PDF if so.

## 9. Gotchas

- **Mock data lives in memory** (`data/mock/seed.ts` arrays are mutated by mock writes) and resets on reload. Mock state can also diverge after a hot reload; reload the page if numbers look odd.
- **Transition gap:** until Payroll and Inventory are ported, their mock cash-book entries won't appear in the *live* Income & Expenses list.
- **Transactions need a replica set.** A standalone `mongod` will fail on `in_transaction`. MongoDB Atlas is always a replica set.
- **Test database names:** integration tests create `boxerp_test_*` databases and drop them afterwards. Override the server with `BOXERP_TEST_MONGODB_URI`.
- **Don't commit** `.env.development.local` or `.claude/settings.local.json`. `.gitignore` already covers `.env.*`.
- The user is the factory owner and developer. Keep wording in the UI plain and specific to the factory floor, and avoid accounting jargon.
