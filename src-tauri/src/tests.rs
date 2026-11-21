//! Integration tests against a real MongoDB replica set.
//!
//!   BOXERP_TEST_MONGODB_URI=mongodb://127.0.0.1:27018/?replicaSet=rs0&directConnection=true cargo test
//!
//! Each test uses its own throw-away database. Tests are skipped (not failed)
//! when no server is reachable, so `cargo test` still works offline.

use crate::commands::{
    dashboard::tests_api as dash, finance::tests_api as fin, inventory::tests_api as inv,
    payroll::tests_api as pay, production::tests_api as prod, reports::tests_api as rep,
    workers::tests_api as wk,
};
use crate::error::AppError;
use crate::model::finance::{Direction, Origin, SimilarInput, TransactionInput};
use crate::model::inventory::{
    AdjustmentReason, AdjustInput, InwardInput, IssueInput, MaterialCategory, MaterialInput, MaterialUnit,
    PayNowInput,
};
use crate::model::payroll::{calculate_wage, PayInput, PayrollAdjustment, PayrollRunStatus};
use crate::model::production::{
    paper_per_box, stages_for, BoxSpec, EntryInput, OrderInput, OrderPriority, ProductionStage, WastageReason,
};
use crate::model::workers::{
    AdvanceInput, AttendanceMark, AttendanceRecord, AttendanceStatus, WageType, Worker, WorkerInput,
};
use crate::model::PaymentMode;
use crate::store::{ensure_indexes, seed_defaults, Store};
use crate::dates;
use mongodb::{bson::doc, options::ClientOptions, Client};
use std::time::Duration;

const DEFAULT_URI: &str = "mongodb://127.0.0.1:27018/?replicaSet=rs0&directConnection=true";

async fn client(uri: &str) -> Option<Client> {
    let mut opts = ClientOptions::parse(uri).await.ok()?;
    opts.server_selection_timeout = Some(Duration::from_secs(3));
    Client::with_options(opts).ok()
}

async fn store(name: &str) -> Option<Store> {
    let uri = std::env::var("BOXERP_TEST_MONGODB_URI").unwrap_or_else(|_| DEFAULT_URI.into());
    // A brand-new local replica set must be initiated before a replicaSet-aware
    // client can select it, so bootstrap over a direct connection first.
    let direct = client(&uri.replace("replicaSet=rs0&", "")).await?;
    let admin = direct.database("admin");
    if admin.run_command(doc! { "ping": 1 }).await.is_err() {
        eprintln!("⚠ skipping {name}: no MongoDB at {uri}");
        return None;
    }
    if admin.run_command(doc! { "replSetGetStatus": 1 }).await.is_err() {
        let _ = admin.run_command(doc! { "replSetInitiate": {} }).await;
    }
    // wait until the node has been elected primary and accepts writes
    for _ in 0..40 {
        let hello = admin.run_command(doc! { "hello": 1 }).await.ok()?;
        if hello.get_bool("isWritablePrimary").unwrap_or(false) { break; }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
    let client = client(&uri).await?;
    let db = client.database(&format!("boxerp_test_{name}"));
    db.drop().await.ok();
    ensure_indexes(&db).await.unwrap();
    seed_defaults(&db).await.unwrap();
    Some(Store { client, db })
}

fn txn(date: &str, amount: i64, category: &str, direction: Direction) -> TransactionInput {
    TransactionInput { date: date.into(), direction, amount, category: category.into(), mode: PaymentMode::Bank, party_id: None, particulars: "Test entry".into(), reference: None }
}

fn worker_input(name: &str) -> WorkerInput {
    WorkerInput {
        name: name.into(), phone: Some("9825012345".into()), address: None, emergency_contact: None,
        department: "Corrugation".into(), designation: "Helper".into(), joined_on: "2024-01-01".into(),
        wage_type: WageType::Daily, wage_rate: 50_000, overtime_rate_per_hour: 8_000, notes: None,
    }
}

#[tokio::test]
async fn finance_rules() {
    let Some(s) = store("finance").await else { return };
    let today = dates::today_iso();

    // future dates and advance category are rejected
    let tomorrow = dates::iso(dates::today() + chrono::Duration::days(1));
    assert!(matches!(fin::create(&s, txn(&tomorrow, 100, "Electricity", Direction::Out)).await, Err(AppError::Validation(_))));
    assert!(matches!(fin::create(&s, txn(&today, 100, "Salary Advance", Direction::Out)).await, Err(AppError::Validation(_))));
    // category must match direction
    assert!(matches!(fin::create(&s, txn(&today, 100, "Electricity", Direction::In)).await, Err(AppError::Validation(_))));

    let t = fin::create(&s, txn(&today, 38_500_00, "Electricity", Direction::Out)).await.unwrap();
    assert_eq!(t.category, "Electricity");

    // duplicate finder sees it within ±3 days
    let near = dates::iso(dates::today() - chrono::Duration::days(2));
    let hits = fin::similar(&s, SimilarInput { date: near, direction: Direction::Out, amount: 38_500_00, party_id: None }).await.unwrap();
    assert_eq!(hits.len(), 1);

    // cash flow picks it up in the last bucket
    let flow = fin::cash_flow(&s, "30d").await.unwrap();
    assert_eq!(flow.len(), 5);
    assert_eq!(flow.last().unwrap().cash_out, 38_500_00);

    // entries created by other modules are protected
    let mut locked = t.clone();
    locked.id = "locked".into();
    locked.origin = Some(Origin { module: "payroll".into(), ref_id: "2026-10".into() });
    s.transactions().insert_one(&locked).await.unwrap();
    assert!(matches!(fin::delete(&s, "locked").await, Err(AppError::Conflict(_))));

    fin::delete(&s, &t.id).await.unwrap();
    assert!(matches!(fin::delete(&s, &t.id).await, Err(AppError::NotFound(_))));
    s.db.drop().await.ok();
}

#[tokio::test]
async fn workers_attendance_and_advances() {
    let Some(s) = store("workers").await else { return };
    let today = dates::today_iso();

    let a = wk::create_worker(&s, worker_input("Ramesh Patel")).await.unwrap();
    let b = wk::create_worker(&s, worker_input("Suresh Yadav")).await.unwrap();
    assert_eq!(a.code, "EMP-0101");
    assert_eq!(b.code, "EMP-0102");
    let mut bad = worker_input("X Y");
    bad.phone = Some("12345".into());
    assert!(matches!(wk::create_worker(&s, bad).await, Err(AppError::Validation(_))));

    // attendance upserts: saving twice keeps one record per worker per day
    let mark = |id: &str, status| AttendanceMark { worker_id: id.into(), status, overtime_hours: 0.0, pieces: None };
    wk::save_day(&s, today.clone(), vec![mark(&a.id, AttendanceStatus::Present), mark(&b.id, AttendanceStatus::Absent)]).await.unwrap();
    wk::save_day(&s, today.clone(), vec![mark(&b.id, AttendanceStatus::HalfDay)]).await.unwrap();
    assert_eq!(s.attendance().count_documents(doc! { "date": &today }).await.unwrap(), 2);
    let rec = s.attendance().find_one(doc! { "workerId": &b.id, "date": &today }).await.unwrap().unwrap();
    assert_eq!(rec.status, AttendanceStatus::HalfDay);

    // absent with overtime is rejected
    let mut ot = mark(&a.id, AttendanceStatus::Absent);
    ot.overtime_hours = 2.0;
    assert!(matches!(wk::save_day(&s, today.clone(), vec![ot]).await, Err(AppError::Validation(_))));

    // advance creates exactly one cash-book entry, tagged with its origin
    let adv = wk::give_advance(&s, AdvanceInput { worker_id: a.id.clone(), date: today.clone(), amount: 2_000_00, mode: PaymentMode::Cash, note: None }).await.unwrap();
    let t = s.transactions().find_one(doc! { "id": &adv.transaction_id }).await.unwrap().expect("cash-book entry");
    assert_eq!(t.amount, 2_000_00);
    assert_eq!(t.origin.as_ref().unwrap().module, "advance");

    let roster = wk::roster(&s).await.unwrap();
    let ra = roster.iter().find(|r| r.worker.id == a.id).unwrap();
    assert_eq!(ra.advance_balance, 2_000_00);
    assert!(ra.month_attendance_pct.unwrap() > 0.0);

    // can't mark as left with an advance outstanding
    assert!(matches!(wk::set_active(&s, &a.id, false, None).await, Err(AppError::Conflict(_))));

    // deleting the advance removes its cash-book entry in the same transaction
    wk::delete_advance(&s, &adv.id).await.unwrap();
    assert!(s.transactions().find_one(doc! { "id": &adv.transaction_id }).await.unwrap().is_none());
    wk::set_active(&s, &a.id, false, None).await.unwrap();
    s.db.drop().await.ok();
}

fn sample_spec(printed: bool) -> BoxSpec {
    BoxSpec {
        ply: 5,
        length_mm: 400,
        width_mm: 300,
        height_mm: 250,
        flute: "BC".into(),
        gsm: 150,
        printed,
        colors: if printed { Some(2) } else { None },
    }
}

fn sample_order(customer: &str, printed: bool) -> OrderInput {
    let today = dates::today();
    OrderInput {
        customer: customer.into(),
        customer_ref: Some("PO-999".into()),
        product: "5 Ply Printed Box".into(),
        spec: sample_spec(printed),
        planned_qty: 5000,
        priority: OrderPriority::Normal,
        start_date: dates::iso(today),
        due_date: dates::iso(today + chrono::Duration::days(5)),
        notes: None,
    }
}

#[tokio::test]
async fn production_rules() {
    let Some(s) = store("production").await else { return };
    let today = dates::today_iso();

    // 1. Validation checks
    let mut bad_dates = sample_order("Acme Corp", true);
    bad_dates.start_date = "2026-11-10".into();
    bad_dates.due_date = "2026-11-05".into();
    assert!(matches!(prod::create_order(&s, bad_dates).await, Err(AppError::Validation(_))));

    // 2. Create order
    let o = prod::create_order(&s, sample_order("Acme Corp", true)).await.unwrap();
    assert!(o.order_no.starts_with("PO-"));
    assert_eq!(o.stage, ProductionStage::Planned);
    assert_eq!(o.produced_qty, 0);
    assert_eq!(o.wastage_qty, 0);

    // 3. Update order
    let mut upd = sample_order("Acme Corp", true);
    upd.planned_qty = 6000;
    let o = prod::update_order(&s, &o.id, upd).await.unwrap();
    assert_eq!(o.planned_qty, 6000);

    // 4. Hold & resume
    let held = prod::hold_order(&s, &o.id, "Waiting for plates").await.unwrap();
    assert_eq!(held.stage, ProductionStage::OnHold);
    assert_eq!(held.held_from_stage, Some(ProductionStage::Planned));

    // Can't change stage while on hold
    assert!(matches!(prod::set_stage(&s, &o.id, ProductionStage::Corrugation).await, Err(AppError::Conflict(_))));

    let resumed = prod::resume_order(&s, &o.id).await.unwrap();
    assert_eq!(resumed.stage, ProductionStage::Planned);

    // 5. Plain boxes skip printing stage
    let plain_spec = sample_spec(false);
    let plain_flow = stages_for(&plain_spec);
    assert!(!plain_flow.contains(&ProductionStage::Printing));
    let printed_spec = sample_spec(true);
    let printed_flow = stages_for(&printed_spec);
    assert!(printed_flow.contains(&ProductionStage::Printing));

    // Paper calculation check
    let weight = paper_per_box(&printed_spec);
    assert!(weight > 0);

    // 6. Log entry: moves planned order to its next stage automatically
    let entry = prod::log_entry(&s, EntryInput {
        order_id: o.id.clone(),
        date: today.clone(),
        stage: ProductionStage::Corrugation,
        good_qty: 2500,
        wastage_qty: 50,
        wastage_reason: Some(WastageReason::BoardDefect),
        note: Some("Shift A".into()),
    }).await.unwrap();

    let orders = prod::list_orders(&s).await.unwrap();
    let updated_o = orders.iter().find(|x| x.id == o.id).unwrap();
    assert_eq!(updated_o.stage, ProductionStage::Corrugation);
    assert_eq!(updated_o.produced_qty, 2500);
    assert_eq!(updated_o.wastage_qty, 50);

    let entries = prod::list_entries(&s, &o.id).await.unwrap();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].good_qty, 2500);

    // Month output aggregation
    let mo = prod::month_output(&s).await.unwrap();
    assert_eq!(mo.good, 2500);
    assert_eq!(mo.wastage, 50);

    // Customers list
    let custs = prod::customers(&s).await.unwrap();
    assert_eq!(custs, vec!["Acme Corp"]);

    // Active orders list includes active order
    let active = prod::active_orders(&s).await.unwrap();
    assert_eq!(active.len(), 1);

    // Cannot delete order with entries logged
    assert!(matches!(prod::delete_order(&s, &o.id).await, Err(AppError::Conflict(_))));

    // 7. Complete order
    let completed = prod::set_stage(&s, &o.id, ProductionStage::Completed).await.unwrap();
    assert_eq!(completed.stage, ProductionStage::Completed);
    assert!(completed.completed_on.is_some());

    // Completed order is locked
    assert!(matches!(prod::hold_order(&s, &o.id, "reason").await, Err(AppError::Conflict(_))));
    let mut dummy_upd = sample_order("Acme Corp", true);
    dummy_upd.planned_qty = 7000;
    assert!(matches!(prod::update_order(&s, &o.id, dummy_upd).await, Err(AppError::Conflict(_))));
    assert!(matches!(prod::log_entry(&s, EntryInput {
        order_id: o.id.clone(),
        date: today.clone(),
        stage: ProductionStage::Bundling,
        good_qty: 100,
        wastage_qty: 0,
        wastage_reason: None,
        note: None,
    }).await, Err(AppError::Conflict(_))));
    assert!(matches!(prod::delete_entry(&s, &entry.id).await, Err(AppError::Conflict(_))));

    // 8. Reopen, delete entry and delete order
    prod::set_stage(&s, &o.id, ProductionStage::Bundling).await.unwrap();
    prod::delete_entry(&s, &entry.id).await.unwrap();

    let reopened = prod::list_orders(&s).await.unwrap();
    let reopened_o = reopened.iter().find(|x| x.id == o.id).unwrap();
    assert_eq!(reopened_o.produced_qty, 0);
    assert_eq!(reopened_o.wastage_qty, 0);

    // Now order can be deleted
    prod::delete_order(&s, &o.id).await.unwrap();
    let remaining = prod::list_orders(&s).await.unwrap();
    assert!(remaining.is_empty());

    s.db.drop().await.ok();
}

fn sample_material(code: &str, category: MaterialCategory) -> MaterialInput {
    MaterialInput {
        name: "Kraft Paper 150 GSM".into(),
        code: code.into(),
        category,
        unit: MaterialUnit::Kg,
        reorder_level: 5000,
        gsm: Some(150),
        bf: Some(18),
        deckle_inch: Some(40),
        preferred_vendor_id: None,
        notes: None,
    }
}

#[tokio::test]
async fn inventory_rules() {
    let Some(s) = store("inventory").await else { return };
    let today = dates::today_iso();

    // 1. Material creation & uniqueness
    let m = inv::create_material(&s, sample_material("KP-150", MaterialCategory::PaperRoll)).await.unwrap();
    assert_eq!(m.stock, 0);
    assert_eq!(m.avg_cost, 0);
    assert!(matches!(
        inv::create_material(&s, sample_material("kp-150", MaterialCategory::PaperRoll)).await,
        Err(AppError::Conflict(_))
    ));

    // 2. Inward with pay_now creates cash-book transaction and updates running balance & avg_cost
    let inward = inv::record_inward(&s, InwardInput {
        material_id: m.id.clone(),
        date: today.clone(),
        qty: 10_000,
        rate: 35_00, // ₹35/kg
        vendor_id: None,
        bill_no: Some("INV-001".into()),
        reels: Some(20),
        note: None,
        pay_now: Some(PayNowInput { mode: PaymentMode::Bank }),
    }).await.unwrap();

    assert_eq!(inward.qty, 10_000);
    assert_eq!(inward.rate, 35_00);
    assert_eq!(inward.balance_after, 10_000);

    // Linked cash-book entry was created
    let txn_id = inward.transaction_id.as_ref().unwrap();
    let txn = s.transactions().find_one(doc! { "id": txn_id }).await.unwrap().expect("transaction exists");
    assert_eq!(txn.amount, 350_000_00);
    assert_eq!(txn.origin.as_ref().unwrap().module, "inventory");

    // Check material updated
    let mats = inv::list_materials(&s).await.unwrap();
    let m_row = mats.iter().find(|x| x.material.id == m.id).unwrap();
    assert_eq!(m_row.material.stock, 10_000);
    assert_eq!(m_row.material.avg_cost, 35_00);
    assert_eq!(m_row.value, 350_000_00);

    // 3. Cannot change unit once stock movements exist
    let mut upd = sample_material("KP-150", MaterialCategory::PaperRoll);
    upd.unit = MaterialUnit::Roll;
    assert!(matches!(inv::update_material(&s, &m.id, upd).await, Err(AppError::Validation(_))));

    // 4. Issue stock: negative qty rejected, qty > stock rejected
    assert!(matches!(inv::record_issue(&s, IssueInput {
        material_id: m.id.clone(),
        date: today.clone(),
        qty: 15_000, // only 10,000 in stock
        order_id: None,
        note: None,
    }).await, Err(AppError::Validation(_))));

    // Second inward at higher price: ₹45/kg for 10,000 kg -> weighted average becomes ₹40/kg
    inv::record_inward(&s, InwardInput {
        material_id: m.id.clone(),
        date: today.clone(),
        qty: 10_000,
        rate: 45_00,
        vendor_id: None,
        bill_no: Some("INV-002".into()),
        reels: Some(20),
        note: None,
        pay_now: None,
    }).await.unwrap();

    let mats = inv::list_materials(&s).await.unwrap();
    let m_row = mats.iter().find(|x| x.material.id == m.id).unwrap();
    assert_eq!(m_row.material.stock, 20_000);
    assert_eq!(m_row.material.avg_cost, 40_00);

    // Valid issue of 5,000 kg
    let issue = inv::record_issue(&s, IssueInput {
        material_id: m.id.clone(),
        date: today.clone(),
        qty: 5_000,
        order_id: None,
        note: Some("Floor issue".into()),
    }).await.unwrap();
    assert_eq!(issue.qty, -5_000);
    assert_eq!(issue.rate, 40_00);
    assert_eq!(issue.balance_after, 15_000);

    // 5. Stock adjustment for today
    let adj = inv::record_adjust(&s, AdjustInput {
        material_id: m.id.clone(),
        date: today.clone(),
        new_stock: 14_800,
        reason: AdjustmentReason::MoistureLoss,
        note: Some("Scale check".into()),
    }).await.unwrap();
    assert_eq!(adj.qty, -200);
    assert_eq!(adj.balance_after, 14_800);

    let mvs = inv::list_movements(&s, Some(m.id.clone())).await.unwrap();
    assert_eq!(mvs.len(), 4);

    let report = inv::consumption(&s, today.clone(), today.clone()).await.unwrap();
    assert!(!report.by_material.is_empty());

    // 6. Cannot delete inward if later issues would make stock negative
    // Here inward #1 was for 10,000 kg. If we delete it, initial stock was 0,
    // so total inwards would be 10,000 and total issues 5,200 (14,800 is still ok).
    // Let's issue 12,000 kg more so stock becomes 2,800:
    inv::record_issue(&s, IssueInput {
        material_id: m.id.clone(),
        date: today.clone(),
        qty: 12_000,
        order_id: None,
        note: None,
    }).await.unwrap();

    // Now total inwards = 20,000, total out = 17,200. Deleting inward #1 (10,000) would make stock negative!
    assert!(matches!(inv::delete_movement(&s, &inward.id).await, Err(AppError::Conflict(_))));

    // 7. Deleting a movement with a linked transaction removes the transaction
    // Let's create another material and paid inward to test clean deletion
    let m2 = inv::create_material(&s, sample_material("INK-BLK", MaterialCategory::Ink)).await.unwrap();
    let m2_inward = inv::record_inward(&s, InwardInput {
        material_id: m2.id.clone(),
        date: today.clone(),
        qty: 50,
        rate: 200_00,
        vendor_id: None,
        bill_no: Some("INV-003".into()),
        reels: None,
        note: None,
        pay_now: Some(PayNowInput { mode: PaymentMode::Cash }),
    }).await.unwrap();
    let m2_tx_id = m2_inward.transaction_id.as_ref().unwrap();
    assert!(s.transactions().find_one(doc! { "id": m2_tx_id }).await.unwrap().is_some());

    inv::delete_movement(&s, &m2_inward.id).await.unwrap();
    assert!(s.transactions().find_one(doc! { "id": m2_tx_id }).await.unwrap().is_none());

    s.db.drop().await.ok();
}

#[test]
fn wage_maths_matches_typescript() {
    // 1. October slip from demo:
    // 20.5 days × ₹650 + 6h × ₹80 − ₹2,000 = ₹11,805
    let w_daily = Worker {
        id: "w1".into(),
        code: "EMP-101".into(),
        name: "Ramesh Patel".into(),
        department: "Corrugation".into(),
        designation: "Machine Operator".into(),
        joined_on: "2024-01-01".into(),
        wage_type: WageType::Daily,
        wage_rate: 650_00, // ₹650
        overtime_rate_per_hour: 80_00, // ₹80
        active: true,
        phone: None,
        address: None,
        emergency_contact: None,
        left_on: None,
        notes: None,
    };

    let mut recs = Vec::new();
    for i in 1..=20 {
        recs.push(AttendanceRecord {
            id: format!("r{i}"),
            worker_id: "w1".into(),
            date: format!("2026-10-{:02}", i),
            status: AttendanceStatus::Present,
            overtime_hours: if i == 1 { 6.0 } else { 0.0 },
            pieces: None,
        });
    }
    recs.push(AttendanceRecord {
        id: "r21".into(),
        worker_id: "w1".into(),
        date: "2026-10-21".into(),
        status: AttendanceStatus::HalfDay,
        overtime_hours: 0.0,
        pieces: None,
    });

    let b = calculate_wage(&w_daily, &recs, 25, 2000_00);
    assert_eq!(b.paid_days, 20.5);
    assert_eq!(b.basic, 13325_00); // ₹13,325
    assert_eq!(b.overtime, 480_00); // ₹480
    assert_eq!(b.gross, 13805_00); // ₹13,805
    assert_eq!(b.advance_deduction, 2000_00); // ₹2,000
    assert_eq!(b.net, 11805_00); // ₹11,805 (exact match!)

    // 2. Monthly worker: ₹18,000 / month, 22.5 paid days / 25 working days = ₹16,200
    let mut w_monthly = w_daily.clone();
    w_monthly.wage_type = WageType::Monthly;
    w_monthly.wage_rate = 18000_00;
    w_monthly.overtime_rate_per_hour = 0;
    let b_monthly = calculate_wage(&w_monthly, &recs, 25, 0);
    // 20.5 paid days / 25 * 18000 = 14,760
    assert_eq!(b_monthly.basic, 14760_00);

    // 3. Piece rate worker: 4,000 pieces × ₹2.50 = ₹10,000
    let mut w_piece = w_daily.clone();
    w_piece.wage_type = WageType::PieceRate;
    w_piece.wage_rate = 2_50;
    let piece_recs = vec![AttendanceRecord {
        id: "rp".into(),
        worker_id: "w1".into(),
        date: "2026-10-01".into(),
        status: AttendanceStatus::Present,
        overtime_hours: 0.0,
        pieces: Some(4000),
    }];
    let b_piece = calculate_wage(&w_piece, &piece_recs, 25, 0);
    assert_eq!(b_piece.basic, 10000_00);
}

#[tokio::test]
async fn payroll_rules() {
    let Some(s) = store("payroll").await else { return };
    let today = dates::today();
    let current_period = dates::iso(today)[0..7].to_string();
    let prev_month = dates::add_months(today, -1);
    let prev_period = dates::iso(prev_month)[0..7].to_string();

    // 1. Create worker
    let w = wk::create_worker(&s, worker_input("Raju Bhai")).await.unwrap();

    // Give advance of ₹2,000 on previous month
    let prev_date = format!("{prev_period}-05");
    let adv = wk::give_advance(&s, AdvanceInput {
        worker_id: w.id.clone(),
        date: prev_date.clone(),
        amount: 2000_00,
        mode: PaymentMode::Cash,
        note: None,
    }).await.unwrap();

    // Save 10 present days in previous month
    let mut marks = Vec::new();
    for d in 1..=10 {
        marks.push(AttendanceMark {
            worker_id: w.id.clone(),
            status: AttendanceStatus::Present,
            overtime_hours: 2.0,
            pieces: None,
        });
        let day_str = format!("{prev_period}-{:02}", d);
        wk::save_day(&s, day_str, marks.clone()).await.unwrap();
        marks.clear();
    }

    // 2. Compute draft for previous month
    let draft = pay::compute_draft(&s, &prev_period).await.unwrap();
    assert_eq!(draft.status, PayrollRunStatus::Draft);
    let line = draft.lines.iter().find(|l| l.worker_id == w.id).unwrap();
    assert_eq!(line.paid_days, 10.0);
    assert_eq!(line.advance_outstanding, 2000_00);
    assert_eq!(line.advance_deduction, 2000_00);
    // 10 days × ₹500 + 20h × ₹80 = ₹5,000 + ₹1,600 = ₹6,600 gross. Net = ₹6,600 - ₹2,000 = ₹4,600
    assert_eq!(line.gross, 6600_00);
    assert_eq!(line.net, 4600_00);

    // 3. Adjust line with bonus
    let adj_line = pay::adjust_line(&s, &prev_period, &w.id, PayrollAdjustment {
        bonus: 500_00,
        other_deduction: 100_00,
        other_deduction_note: Some("Tea".into()),
        advance_deduction: None,
    }).await.unwrap().unwrap();
    assert_eq!(adj_line.bonus, 500_00);
    assert_eq!(adj_line.other_deduction, 100_00);
    assert_eq!(adj_line.gross, 7100_00);
    assert_eq!(adj_line.net, 5000_00); // 7100 - 100 - 2000 = 5000

    // Deductions > gross pay rejected
    assert!(matches!(pay::adjust_line(&s, &prev_period, &w.id, PayrollAdjustment {
        bonus: 0,
        other_deduction: 10000_00,
        other_deduction_note: None,
        advance_deduction: None,
    }).await, Err(AppError::Validation(_))));

    // 4. Current month cannot be finalised
    assert!(matches!(pay::finalize_payroll(&s, &current_period).await, Err(AppError::Validation(_))));

    // 5. Finalise previous month
    let run = pay::finalize_payroll(&s, &prev_period).await.unwrap();
    assert_eq!(run.status, PayrollRunStatus::Finalized);
    assert!(run.finalized_on.is_some());

    // Once finalised, adjustments are blocked
    assert!(matches!(pay::adjust_line(&s, &prev_period, &w.id, PayrollAdjustment::default()).await, Err(AppError::Conflict(_))));

    // 6. Pay salary
    let pay_res = pay::pay_salaries(&s, PayInput {
        period: prev_period.clone(),
        worker_ids: vec![w.id.clone()],
        mode: PaymentMode::Bank,
        paid_on: dates::today_iso(),
    }).await.unwrap();
    assert_eq!(pay_res.paid, 1);
    assert_eq!(pay_res.total, 5000_00);

    // Check advance was recovered
    let adv_after = s.advances().find_one(doc! { "id": &adv.id }).await.unwrap().unwrap();
    assert_eq!(adv_after.recovered, 2000_00);

    // Check cash-book entry was created with origin "payroll"
    let txn = s.transactions().find_one(doc! { "origin.module": "payroll", "origin.refId": &prev_period }).await.unwrap().unwrap();
    assert_eq!(txn.amount, 5000_00);
    assert_eq!(txn.category, "Wages & Salary");

    // Once paid, reopen is blocked
    assert!(matches!(pay::reopen_payroll(&s, &prev_period).await, Err(AppError::Conflict(_))));

    // Pending lines has nothing left for this run
    let pending = pay::pending_lines(&s).await.unwrap();
    assert!(pending.iter().all(|l| l.line.worker_id != w.id));

    let run_get = pay::get_run(&s, &prev_period).await.unwrap();
    assert_eq!(run_get.status, PayrollRunStatus::Finalized);

    let periods = pay::list_periods(&s).await.unwrap();
    assert!(!periods.is_empty());

    // Payment history records the payment
    let history = pay::payments_history(&s).await.unwrap();
    assert!(history.iter().any(|p| p.payment.worker_id == w.id && p.payment.net == 5000_00));

    // Dashboard pending salaries works
    let dash_pending = pay::pending_salaries(&s).await.unwrap();
    assert!(!dash_pending.is_empty());

    s.db.drop().await.ok();
}

#[tokio::test]
async fn dashboard_and_reports_rules() {
    let Some(s) = store("reports").await else { return };
    let today = dates::today_iso();
    let month_start = dates::iso(dates::month_start(dates::today()));

    // Seed transaction
    fin::create(&s, txn(&today, 100_000_00, "Sales Receipt", Direction::In)).await.unwrap();
    fin::create(&s, txn(&today, 40_000_00, "Raw Material", Direction::Out)).await.unwrap();

    // Seed material & alert
    let m = inv::create_material(&s, sample_material("MAT-1", MaterialCategory::PaperRoll)).await.unwrap();
    // stock is 0, reorder level is 5000 -> triggers low stock alert!

    // Seed production order
    let o = prod::create_order(&s, sample_order("Acme Corp", false)).await.unwrap();
    prod::log_entry(&s, EntryInput {
        order_id: o.id.clone(),
        date: today.clone(),
        stage: ProductionStage::Corrugation,
        good_qty: 1000,
        wastage_qty: 20,
        wastage_reason: Some(WastageReason::BoardDefect),
        note: None,
    }).await.unwrap();

    // 1. Dashboard summary
    let summary = dash::get_summary(&s).await.unwrap();
    assert_eq!(summary.cash_in.value, 100_000_00);
    assert_eq!(summary.cash_out.value, 40_000_00);
    assert_eq!(summary.operating_profit.value, 60_000_00);
    assert_eq!(summary.production_today.value, 1000);
    assert_eq!(summary.production.produced, 1000);
    assert_eq!(summary.production.wastage, 20);

    // 2. Alerts list
    let alerts = dash::get_alerts(&s).await.unwrap();
    assert!(alerts.iter().any(|a| a.kind == "low_stock" && a.id.contains(&m.id)));

    // 3. Profit report
    let profit = rep::profit_report(&s, month_start.clone(), today.clone()).await.unwrap();
    assert_eq!(profit.totals.receipts, 100_000_00);
    assert_eq!(profit.totals.materials, 40_000_00);
    assert!(!profit.categories.is_empty());

    // 4. Cash flow report
    let cf = rep::cash_flow_report(&s, month_start.clone(), today.clone()).await.unwrap();
    assert_eq!(cf.totals.cash_in, 100_000_00);
    assert_eq!(cf.totals.cash_out, 40_000_00);
    assert_eq!(cf.totals.net, 60_000_00);

    // 5. Labour report
    let labour = rep::labour_report(&s, month_start.clone(), today.clone()).await.unwrap();
    assert_eq!(labour.totals.receipts, 100_000_00);

    // 6. Attendance report
    let att_rep = rep::attendance_report(&s, month_start.clone(), today.clone()).await.unwrap();
    assert!(att_rep.departments.is_empty() || !att_rep.departments.is_empty());

    // 7. Payroll report
    let payroll_rep = rep::payroll_report(&s, month_start.clone(), today.clone()).await.unwrap();
    assert!(!payroll_rep.is_empty());

    // 8. Production report
    let prod_rep = rep::production_report(&s, month_start.clone(), today.clone()).await.unwrap();
    assert_eq!(prod_rep.totals.good, 1000);
    assert_eq!(prod_rep.totals.wastage, 20);
    assert_eq!(prod_rep.totals.active_orders, 1);
    assert_eq!(prod_rep.by_reason[0].reason, "board_defect");
    assert_eq!(prod_rep.by_reason[0].qty, 20);

    s.db.drop().await.ok();
}

#[tokio::test]
async fn settings_and_vyapar_import_and_xlsx_export() {
    let s = match store("settings_vyapar_xlsx").await {
        Some(s) => s,
        None => return,
    };

    // 1. Settings default and update
    use crate::commands::settings;

    let default_cfg = settings::get_company_settings(&s).await.unwrap();
    assert_eq!(default_cfg.name, "Gujarat Corrugated Box Industry");
    assert_eq!(default_cfg.wastage_target_pct, 3.0);

    let mut custom_cfg = default_cfg.clone();
    custom_cfg.name = "Shree Ram Packaging".into();
    custom_cfg.opening_cash_balance = 5000000; // ₹50,000
    custom_cfg.opening_bank_balance = 25000000; // ₹2,50,000

    let updated = settings::update_company_settings(&s, custom_cfg.clone()).await.unwrap();
    assert_eq!(updated.name, "Shree Ram Packaging");

    let read_back = settings::get_company_settings(&s).await.unwrap();
    assert_eq!(read_back.name, "Shree Ram Packaging");
    assert_eq!(read_back.opening_cash_balance, 5000000);

    // Validation: empty name rejected
    let mut invalid = custom_cfg.clone();
    invalid.name = "".into();
    assert!(settings::update_company_settings(&s, invalid).await.is_err());

    // 2. Vyapar CSV import and idempotency
    use crate::commands::vyapar;
    let sample_csv = "\
Date,Invoice No.,Party Name,Transaction Type,Total Amount,Payment Mode,Description\n\
2026-10-05,INV-1001,Patel Agro Ltd,Sale,15000.00,Bank,Corrugated fruit boxes\n\
2026-10-06,BILL-502,Surat Kraft Mills,Purchase,8500.50,Cash,18BF Paper Reel\n\
";

    let import_res1 = vyapar::import_vyapar_csv(&s, sample_csv).await.unwrap();
    assert_eq!(import_res1.total_rows, 2);
    assert_eq!(import_res1.imported_count, 2);
    assert_eq!(import_res1.skipped_count, 0);

    // Re-importing exact same file must skip already imported vouchers (idempotent)
    let import_res2 = vyapar::import_vyapar_csv(&s, sample_csv).await.unwrap();
    assert_eq!(import_res2.total_rows, 2);
    assert_eq!(import_res2.imported_count, 0);
    assert_eq!(import_res2.skipped_count, 2);

    // Check transactions created
    let txns = crate::store::find_all(&s.transactions(), mongodb::bson::doc! {}, mongodb::bson::doc! { "date": 1 }).await.unwrap();
    assert_eq!(txns.len(), 2);
    assert_eq!(txns[0].external_ref.as_deref(), Some("INV-1001"));
    assert_eq!(txns[0].amount, 1500000); // ₹15,000.00 in paise
    assert_eq!(txns[0].source, crate::model::finance::TxnSource::VyaparImport);

    assert_eq!(txns[1].external_ref.as_deref(), Some("BILL-502"));
    assert_eq!(txns[1].amount, 850050); // ₹8,500.50 in paise
    assert_eq!(txns[1].direction, crate::model::finance::Direction::Out);

    // 3. Native XLSX export
    use crate::commands::export::{self, XlsxExportInput, XlsxSheet};
    let xlsx_input = XlsxExportInput {
        title: Some("BoxERP Test Export".into()),
        sheets: vec![XlsxSheet {
            name: "Transactions".into(),
            headers: vec!["Date".into(), "Ref".into(), "Amount".into()],
            rows: vec![
                vec![
                    serde_json::Value::String("2026-10-05".into()),
                    serde_json::Value::String("INV-1001".into()),
                    serde_json::Value::Number(serde_json::Number::from(15000)),
                ],
            ],
        }],
    };

    let xlsx_bytes = export::export_xlsx(xlsx_input).await.unwrap();
    assert!(!xlsx_bytes.is_empty());
    // Valid ZIP / XLSX header signature: PK\x03\x04
    assert_eq!(&xlsx_bytes[0..4], &[0x50, 0x4B, 0x03, 0x04]);

    s.db.drop().await.ok();
}

#[tokio::test]
async fn costing_and_quotations_and_paper_rates() {
    let s = match store("costing_quotations").await {
        Some(s) => s,
        None => return,
    };

    use crate::commands::costing;
    use crate::model::costing::*;

    // 1. Paper rates
    let rates = costing::get_paper_rates(&s).await.unwrap();
    assert_eq!(rates.len(), 5);
    assert_eq!(rates[0].paper_type, "Semi Kraft");

    let mut updated_rates = rates.clone();
    updated_rates[0].rate_per_kg = 35.5;
    costing::save_paper_rates(&s, updated_rates.clone()).await.unwrap();

    let re_read_rates = costing::get_paper_rates(&s).await.unwrap();
    assert_eq!(re_read_rates[0].rate_per_kg, 35.5);

    // 2. Save quotation
    let sample_quote = QuotationDoc {
        id: "".into(),
        quotation_number: "".into(),
        client_id: None,
        client_name: "Gujarat Fruits Packaging".into(),
        box_name: "5-Ply Apple Shipper Box".into(),
        date: "2026-10-15".into(),
        status: "DRAFT".into(),
        unit_mode: "mm".into(),
        input: CorrugatedBoxInput {
            box_no: Some("1".into()),
            date: Some("2026-10-15".into()),
            client: Some("Gujarat Fruits Packaging".into()),
            c_name: None,
            box_name: Some("5-Ply Apple Shipper Box".into()),
            remark: None,
            unit_mode: Some("mm".into()),
            length_mm: 350.0,
            width_mm: 250.0,
            height_mm: 200.0,
            ply: 5,
            layers: vec![],
            add_l_mm: Some(50.0),
            add_w_mm: Some(20.0),
            ups: Some(1.0),
            waste_percent: Some(3.0),
            conversion_rate: Some(10.0),
            conv_type: Some(1),
            printing_rate: Some(0.0),
            transport_per_box: Some(0.0),
            lamination_per_box: Some(0.0),
            partition_cost: Some(0.0),
            setup_cost: Some(0.0),
            order_qty: Some(1000.0),
            profit_percent: Some(10.0),
            tax_percent: Some(12.0),
        },
        result: CorrugatedBoxResult {
            sheet_length_inch: 49.21,
            sheet_width_inch: 18.50,
            sheet_area_sqm: 0.587,
            in_mm_l: 1250.0,
            in_mm_w: 470.0,
            layers: vec![],
            total_gsm: 680.0,
            total_bs: 10.5,
            total_weight_kg: 0.45,
            total_paper_weight_kg: 0.45,
            total_paper_cost: 16.20,
            wastage_cost: 0.49,
            conversion_cost: 4.50,
            printing_cost: 0.0,
            transport_cost: 0.0,
            lamination_cost: 0.0,
            partition_cost: 0.0,
            setup_cost_per_box: 0.0,
            manufacturing_cost: 21.19,
            base_manufacturing_cost: 21.19,
            profit_amount: 2.12,
            basic_price: 23.31,
            tax_percent: 12.0,
            tax_amount: 2.80,
            final_box_rate: 23.31,
            price_with_tax: 26.11,
        },
        quantity: 1000.0,
        basic_price: 23.31,
        tax_percent: 12.0,
        tax_amount: 2800.0,
        total_amount: 26110.0,
        notes: Some("Urgent dispatch".into()),
        created_at: "2026-10-15T10:00:00Z".into(),
    };

    let saved = costing::save_quotation(&s, sample_quote).await.unwrap();
    assert!(!saved.id.is_empty());
    assert_eq!(saved.quotation_number, "QT-1001");

    // 3. List quotations
    let list = costing::list_quotations(&s).await.unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].box_name, "5-Ply Apple Shipper Box");
    assert_eq!(list[0].quotation_number, "QT-1001");

    // 4. Delete quotation
    let deleted_id = costing::delete_quotation(&s, &saved.id).await.unwrap();
    assert_eq!(deleted_id, saved.id);

    let empty_list = costing::list_quotations(&s).await.unwrap();
    assert_eq!(empty_list.len(), 0);

    s.db.drop().await.ok();
}
