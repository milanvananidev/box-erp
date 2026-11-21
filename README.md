# BoxERP

A desktop ERP for a corrugated box factory, built with Tauri 2, React and TypeScript.

> **Status: UI review build.** The app shell, the design system, the Dashboard and Income & Expenses run on realistic mock data.
> The other modules have placeholder pages. Domain database commands get added module by module once each screen's UI is approved.

## Run

```bash
pnpm install
pnpm dev          # browser preview at http://localhost:1420 (mock data)
pnpm tauri dev    # desktop app
pnpm tauri build  # installer
```

Rust tests: `cd src-tauri && cargo test`.

## Architecture

```
React (UI only)  ──invoke()──▶  Rust #[tauri::command]  ──TLS──▶  MongoDB (remote)
                                  │
                                  └─ connection string in the OS keychain
```

- **No server.** No Express or Nest. The Rust layer in `src-tauri` is the only code that talks to MongoDB.
- **No shared credentials in the binary.** An admin enters each computer's connection string once, under *Settings → Database connection*. It is tested (with a ping), then stored in the OS keychain. Give each computer its own MongoDB user with `readWrite` on the BoxERP database only, and restrict network access to the factory and office IPs. Remote connections must use TLS. Debug builds can also read `BOXERP_MONGODB_URI`, for development only.
- **Mock ↔ real switch.** Every frontend call goes through `command(name, args, mock)` in `src/lib/ipc.ts`. Leave `VITE_DATA_SOURCE` unset for mock data. Set `VITE_DATA_SOURCE=tauri` once the matching Rust commands exist.

### Frontend layout

```
src/
  index.css            design tokens (colours, radii, shadows): the single source of truth
  components/ui/       shadcn-style primitives (button, card, dialog, sheet, select, table…)
  components/shared/   app building blocks: DataTable, StatCard, SectionCard, RingGauge,
                       ConfirmDialog, EmptyState/ErrorState, FormField
  components/layout/   AppShell, Sidebar, Topbar, CommandPalette
  features/<module>/   api.ts (TanStack Query hooks + mock impl), page, components
  lib/                 format (₹, paise, dates), payroll calc, ipc, nav
  stores/ui.ts         Zustand: sidebar, command palette, global drawers
  types/domain.ts      domain model shared with Rust DTOs
  data/mock/seed.ts    deterministic mock data relative to today
```

### Business rules baked into the model

- **Money is integer paise** everywhere. This avoids floating-point drift.
- **Vyapar stays the billing/GST system.** BoxERP has no invoicing module.
- **No double counting.** Imported rows keep Vyapar's voucher number (`externalRef`), so importing the same CSV twice is a no-op. A manual entry that matches an existing one (same amount, party and direction, within ±3 days) shows a warning before it is saved. Imported rows can't be deleted in BoxERP.
- **Cash flow ≠ profit.** Every transaction has a `treatment` (`operating`, `advance`, `capital`, `transfer`, `loan`). Net cash flow counts everything. Operating surplus counts only `operating`. Salary advances, machinery purchases and loans move cash but are not expenses.
- **Wages** (`src/lib/payroll.ts`): daily, monthly (pro-rata on paid days) or piece-rate, plus overtime. A half day counts as 0.5. Advances are recovered up to the gross amount.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| ⌘/Ctrl K | Search & command palette |
| ⌘/Ctrl B | Collapse / expand sidebar |
| ⌘/Ctrl 1–8 | Jump to module |
| ⌘/Ctrl ⇧ E / ⇧ I | New expense / income |
| / | Focus table search |
| ⌘/Ctrl Enter | Save open form |
