//! Inventory: materials, stock movements, ledger recomputation, consumption reports.

use crate::dates;
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::model::finance::{CashTreatment, Direction, Origin, Transaction, TxnSource};
use crate::model::inventory::*;
use crate::model::new_id;
use crate::store::{find_all, Store};
use futures_util::FutureExt;
use mongodb::bson::doc;
use tauri::State;

/* ───────── Queries ───────── */

pub(crate) async fn list_materials(s: &Store) -> AppResult<Vec<MaterialRow>> {
    let mats = find_all(&s.materials(), doc! {}, doc! { "name": 1 }).await?;
    let month_start = dates::iso(dates::month_start(dates::today()));
    let movements = find_all(&s.stock_movements(), doc! {}, doc! {}).await?;

    let mut rows = Vec::new();
    for m in mats {
        let mvs: Vec<&StockMovement> = movements.iter().filter(|mv| mv.material_id == m.id).collect();
        let status = if m.stock <= 0 {
            StockStatus::Out
        } else if m.stock <= m.reorder_level {
            StockStatus::Low
        } else {
            StockStatus::Ok
        };
        let last_inward = mvs
            .iter()
            .filter(|mv| mv.movement_type == MovementType::Inward)
            .map(|mv| mv.date.as_str())
            .max()
            .map(|s| s.to_string());
        let issued_this_month: i64 = mvs
            .iter()
            .filter(|mv| mv.movement_type == MovementType::Issue && mv.date.as_str() >= month_start.as_str())
            .map(|mv| -mv.qty)
            .sum();

        rows.push(MaterialRow {
            value: (m.stock as f64 * m.avg_cost as f64).round() as i64,
            status,
            last_inward,
            issued_this_month,
            material: m,
        });
    }
    Ok(rows)
}

#[tauri::command]
pub async fn materials_list(db: State<'_, Db>) -> AppResult<Vec<MaterialRow>> {
    list_materials(&db.store().await?).await
}

pub(crate) async fn list_movements(
    s: &Store,
    material_id: Option<String>,
) -> AppResult<Vec<StockMovement>> {
    let mut filter = doc! {};
    if let Some(mid) = material_id.filter(|s| !s.is_empty()) {
        filter.insert("materialId", mid);
    }
    find_all(&s.stock_movements(), filter, doc! { "date": -1, "createdAt": -1 }).await
}

#[tauri::command]
pub async fn stock_movements_list(
    db: State<'_, Db>,
    material_id: Option<String>,
) -> AppResult<Vec<StockMovement>> {
    list_movements(&db.store().await?, material_id).await
}

pub(crate) async fn consumption(
    s: &Store,
    from: String,
    to: String,
) -> AppResult<ConsumptionReport> {
    let in_range: Vec<StockMovement> = find_all(
        &s.stock_movements(),
        doc! { "date": { "$gte": &from, "$lte": &to } },
        doc! { "date": 1 },
    )
    .await?;

    let mats = find_all(&s.materials(), doc! {}, doc! { "name": 1 }).await?;
    let mut by_material = Vec::new();
    for m in &mats {
        let m_mvs: Vec<&StockMovement> = in_range.iter().filter(|mv| mv.material_id == m.id).collect();
        let inward: i64 = m_mvs
            .iter()
            .filter(|mv| mv.movement_type == MovementType::Inward)
            .map(|mv| mv.qty)
            .sum();
        let issued: i64 = m_mvs
            .iter()
            .filter(|mv| mv.movement_type == MovementType::Issue)
            .map(|mv| -mv.qty)
            .sum();
        let value: i64 = m_mvs
            .iter()
            .filter(|mv| mv.movement_type == MovementType::Issue)
            .map(|mv| -mv.value)
            .sum();
        if inward > 0 || issued > 0 {
            by_material.push(MaterialConsumption {
                material_id: m.id.clone(),
                code: m.code.clone(),
                name: m.name.clone(),
                unit: match m.unit {
                    MaterialUnit::Kg => "kg".into(),
                    MaterialUnit::Roll => "roll".into(),
                    MaterialUnit::Litre => "litre".into(),
                    MaterialUnit::Pcs => "pcs".into(),
                    MaterialUnit::Bag => "bag".into(),
                },
                inward,
                issued,
                value,
            });
        }
    }

    let paper_ids: std::collections::HashSet<String> = mats
        .iter()
        .filter(|m| m.category == MaterialCategory::PaperRoll)
        .map(|m| m.id.clone())
        .collect();

    let mut order_ids: Vec<String> = in_range
        .iter()
        .filter(|mv| mv.order_id.is_some() && paper_ids.contains(&mv.material_id))
        .filter_map(|mv| mv.order_id.clone())
        .collect();
    order_ids.sort();
    order_ids.dedup();

    let mut by_order = Vec::new();
    let orders = find_all(&s.production_orders(), doc! {}, doc! {}).await?;
    let entries = find_all(&s.production_entries(), doc! {}, doc! {}).await?;

    for oid in order_ids {
        if let Some(o) = orders.iter().find(|x| x.id == oid) {
            let issued_mvs: Vec<&StockMovement> = in_range
                .iter()
                .filter(|mv| {
                    mv.order_id.as_deref() == Some(&oid)
                        && paper_ids.contains(&mv.material_id)
                        && mv.movement_type == MovementType::Issue
                })
                .collect();
            let issued_kg: i64 = issued_mvs.iter().map(|mv| -mv.qty).sum();
            let val: i64 = issued_mvs.iter().map(|mv| -mv.value).sum();
            let pieces: i64 = entries
                .iter()
                .filter(|e| e.order_id == oid)
                .map(|e| e.good_qty + e.wastage_qty)
                .sum();
            let expected_kg =
                ((crate::model::production::paper_per_box(&o.spec) * pieces) as f64 / 1000.0).round() as i64;
            let variance_pct = if expected_kg > 0 {
                Some(((issued_kg - expected_kg) as f64 / expected_kg as f64) * 100.0)
            } else {
                None
            };
            by_order.push(OrderConsumption {
                order_id: oid,
                order_no: o.order_no.clone(),
                customer: o.customer.clone(),
                product: o.product.clone(),
                issued_kg,
                value: val,
                expected_kg,
                variance_pct,
            });
        }
    }

    Ok(ConsumptionReport { by_material, by_order })
}

#[tauri::command]
pub async fn stock_consumption(
    db: State<'_, Db>,
    from: String,
    to: String,
) -> AppResult<ConsumptionReport> {
    consumption(&db.store().await?, from, to).await
}

/* ───────── Ledger Recomputation ───────── */

async fn replay_ledger(
    st: &Store,
    session: &mut mongodb::ClientSession,
    material_id: &str,
    is_delete: bool,
) -> AppResult<()> {
    let mut cursor = st
        .stock_movements()
        .find(doc! { "materialId": material_id })
        .sort(doc! { "date": 1, "createdAt": 1 })
        .session(&mut *session)
        .await?;

    let mut list = Vec::new();
    while let Some(res) = cursor.next(&mut *session).await {
        list.push(res?);
    }

    let mut bal: i64 = 0;
    let mut avg: i64 = 0;

    for mv in &mut list {
        if mv.movement_type == MovementType::Opening || mv.movement_type == MovementType::Inward {
            if bal + mv.qty > 0 {
                let num = (bal as f64) * (avg as f64) + (mv.qty as f64) * (mv.rate as f64);
                let den = (bal + mv.qty) as f64;
                avg = (num / den).round() as i64;
            } else {
                avg = mv.rate;
            }
        } else {
            mv.rate = avg;
            mv.value = mv.qty * avg;
        }
        bal += mv.qty;
        if bal < 0 {
            let msg = if is_delete {
                format!(
                    "Deleting this would make stock negative on {}, because later issues depend on it.",
                    mv.date
                )
            } else {
                format!(
                    "Not enough stock: the balance would go below zero on {}. Record the inward first or check the quantity.",
                    mv.date
                )
            };
            return Err(if is_delete {
                AppError::Conflict(msg)
            } else {
                AppError::Validation(msg)
            });
        }
        mv.balance_after = bal;

        st.stock_movements()
            .update_one(
                doc! { "id": &mv.id },
                doc! {
                    "$set": {
                        "rate": mv.rate,
                        "value": mv.value,
                        "balanceAfter": mv.balance_after,
                    }
                },
            )
            .session(&mut *session)
            .await?;
    }

    st.materials()
        .update_one(
            doc! { "id": material_id },
            doc! {
                "$set": {
                    "stock": bal,
                    "avgCost": avg,
                }
            },
        )
        .session(&mut *session)
        .await?;

    Ok(())
}

/* ───────── Material mutations ───────── */

fn clean(o: Option<String>) -> Option<String> {
    o.map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

fn validate_material_input(i: &MaterialInput) -> AppResult<()> {
    if i.name.trim().len() < 2 {
        return Err(AppError::Validation("Enter the material name.".into()));
    }
    if i.code.trim().is_empty() {
        return Err(AppError::Validation("Enter an item code.".into()));
    }
    if i.reorder_level < 0 {
        return Err(AppError::Validation("Reorder level can't be negative.".into()));
    }
    Ok(())
}

pub(crate) async fn create_material(s: &Store, input: MaterialInput) -> AppResult<Material> {
    validate_material_input(&input)?;
    let code_lower = input.code.trim().to_lowercase();
    let existing = find_all(&s.materials(), doc! {}, doc! {}).await?;
    if existing.iter().any(|m| m.code.to_lowercase() == code_lower) {
        return Err(AppError::Conflict(format!("Code {} is already used.", input.code.trim())));
    }

    let material = Material {
        id: new_id(),
        code: input.code.trim().to_string(),
        name: input.name.trim().to_string(),
        category: input.category,
        unit: input.unit,
        stock: 0,
        reorder_level: input.reorder_level,
        avg_cost: 0,
        gsm: input.gsm,
        bf: input.bf,
        deckle_inch: input.deckle_inch,
        preferred_vendor_id: clean(input.preferred_vendor_id),
        active: true,
        notes: clean(input.notes),
    };

    s.materials().insert_one(&material).await?;
    Ok(material)
}

#[tauri::command]
pub async fn material_create(db: State<'_, Db>, input: MaterialInput) -> AppResult<Material> {
    create_material(&db.store().await?, input).await
}

pub(crate) async fn update_material(
    s: &Store,
    id: &str,
    input: MaterialInput,
) -> AppResult<Material> {
    validate_material_input(&input)?;
    let mut material = s
        .materials()
        .find_one(doc! { "id": id })
        .await?
        .ok_or_else(|| AppError::NotFound("Material not found.".into()))?;

    let code_lower = input.code.trim().to_lowercase();
    let existing = find_all(&s.materials(), doc! {}, doc! {}).await?;
    if existing
        .iter()
        .any(|m| m.id != id && m.code.to_lowercase() == code_lower)
    {
        return Err(AppError::Conflict(format!("Code {} is already used.", input.code.trim())));
    }

    if input.unit != material.unit {
        let count = s
            .stock_movements()
            .count_documents(doc! { "materialId": id })
            .await?;
        if count > 0 {
            return Err(AppError::Validation(
                "The unit can't change once stock has been recorded. Create a new material instead.".into(),
            ));
        }
    }

    material.code = input.code.trim().to_string();
    material.name = input.name.trim().to_string();
    material.category = input.category;
    material.unit = input.unit;
    material.reorder_level = input.reorder_level;
    material.gsm = input.gsm;
    material.bf = input.bf;
    material.deckle_inch = input.deckle_inch;
    material.preferred_vendor_id = clean(input.preferred_vendor_id);
    material.notes = clean(input.notes);

    s.materials()
        .replace_one(doc! { "id": id }, &material)
        .await?;
    Ok(material)
}

#[tauri::command]
pub async fn material_update(
    db: State<'_, Db>,
    id: String,
    input: MaterialInput,
) -> AppResult<Material> {
    update_material(&db.store().await?, &id, input).await
}

/* ───────── Movement mutations ───────── */

pub(crate) async fn record_inward(s: &Store, input: InwardInput) -> AppResult<StockMovement> {
    let material = s
        .materials()
        .find_one(doc! { "id": &input.material_id })
        .await?
        .ok_or_else(|| AppError::NotFound("Material not found.".into()))?;
    dates::parse(&input.date)?;
    if dates::parse(&input.date)? > dates::today() {
        return Err(AppError::Validation("Inward date can't be in the future.".into()));
    }
    if input.qty <= 0 || input.rate <= 0 {
        return Err(AppError::Validation("Quantity and rate must be more than zero.".into()));
    }

    let vendor = match input.vendor_id.as_deref().filter(|v| !v.is_empty()) {
        Some(vid) => s.parties().find_one(doc! { "id": vid }).await?,
        None => None,
    };

    let mv_id = new_id();
    let txn_id = input.pay_now.as_ref().map(|_| format!("t-{mv_id}"));
    let movement = StockMovement {
        id: mv_id.clone(),
        material_id: material.id.clone(),
        date: input.date.clone(),
        movement_type: MovementType::Inward,
        qty: input.qty,
        rate: input.rate,
        value: (input.qty as f64 * input.rate as f64).round() as i64,
        balance_after: 0,
        vendor_id: vendor.as_ref().map(|v| v.id.clone()),
        vendor_name: vendor.as_ref().map(|v| v.name.clone()),
        bill_no: clean(input.bill_no),
        reels: input.reels,
        order_id: None,
        order_no: None,
        reason: None,
        note: clean(input.note),
        transaction_id: txn_id.clone(),
        created_at: dates::now_iso(),
    };

    let txn = if let Some(pn) = input.pay_now {
        Some(Transaction {
            id: txn_id.expect("txn_id set"),
            date: movement.date.clone(),
            direction: Direction::Out,
            amount: movement.value,
            category: "Raw Material".into(),
            treatment: CashTreatment::Operating,
            mode: pn.mode,
            party_id: movement.vendor_id.clone(),
            party_name: movement.vendor_name.clone(),
            particulars: format!("Material Purchase – {}", material.name),
            reference: movement.bill_no.clone(),
            source: TxnSource::Manual,
            external_ref: None,
            matched_to: None,
            origin: Some(Origin {
                module: "inventory".into(),
                ref_id: movement.id.clone(),
            }),
            created_at: movement.created_at.clone(),
        })
    } else {
        None
    };

    let (mv_out, material_id) = (movement.clone(), material.id.clone());
    s.in_transaction(move |st, session| {
        let (movement, txn, material_id) = (mv_out.clone(), txn.clone(), material_id.clone());
        async move {
            st.stock_movements().insert_one(&movement).session(&mut *session).await?;
            if let Some(t) = txn {
                st.transactions().insert_one(&t).session(&mut *session).await?;
            }
            replay_ledger(st, session, &material_id, false).await?;
            Ok(())
        }
        .boxed()
    })
    .await?;

    let saved = s
        .stock_movements()
        .find_one(doc! { "id": &mv_id })
        .await?
        .unwrap_or(movement);
    Ok(saved)
}

#[tauri::command]
pub async fn stock_inward(db: State<'_, Db>, input: InwardInput) -> AppResult<StockMovement> {
    record_inward(&db.store().await?, input).await
}

pub(crate) async fn record_issue(s: &Store, input: IssueInput) -> AppResult<StockMovement> {
    let material = s
        .materials()
        .find_one(doc! { "id": &input.material_id })
        .await?
        .ok_or_else(|| AppError::NotFound("Material not found.".into()))?;
    dates::parse(&input.date)?;
    if dates::parse(&input.date)? > dates::today() {
        return Err(AppError::Validation("Issue date can't be in the future.".into()));
    }
    if input.qty <= 0 {
        return Err(AppError::Validation("Quantity must be more than zero.".into()));
    }

    let order = match input.order_id.as_deref().filter(|o| !o.is_empty()) {
        Some(oid) => s.production_orders().find_one(doc! { "id": oid }).await?,
        None => None,
    };

    let mv_id = new_id();
    let movement = StockMovement {
        id: mv_id.clone(),
        material_id: material.id.clone(),
        date: input.date.clone(),
        movement_type: MovementType::Issue,
        qty: -input.qty,
        rate: material.avg_cost,
        value: -input.qty * material.avg_cost,
        balance_after: 0,
        vendor_id: None,
        vendor_name: None,
        bill_no: None,
        reels: None,
        order_id: order.as_ref().map(|o| o.id.clone()),
        order_no: order.as_ref().map(|o| o.order_no.clone()),
        reason: None,
        note: clean(input.note).or_else(|| if order.is_none() { Some("General use".into()) } else { None }),
        transaction_id: None,
        created_at: dates::now_iso(),
    };

    let (mv_out, material_id) = (movement.clone(), material.id.clone());
    s.in_transaction(move |st, session| {
        let (movement, material_id) = (mv_out.clone(), material_id.clone());
        async move {
            st.stock_movements().insert_one(&movement).session(&mut *session).await?;
            replay_ledger(st, session, &material_id, false).await?;
            Ok(())
        }
        .boxed()
    })
    .await?;

    let saved = s
        .stock_movements()
        .find_one(doc! { "id": &mv_id })
        .await?
        .unwrap_or(movement);
    Ok(saved)
}

#[tauri::command]
pub async fn stock_issue(db: State<'_, Db>, input: IssueInput) -> AppResult<StockMovement> {
    record_issue(&db.store().await?, input).await
}

pub(crate) async fn record_adjust(s: &Store, input: AdjustInput) -> AppResult<StockMovement> {
    let material = s
        .materials()
        .find_one(doc! { "id": &input.material_id })
        .await?
        .ok_or_else(|| AppError::NotFound("Material not found.".into()))?;
    if input.new_stock < 0 {
        return Err(AppError::Validation("Stock can't be negative.".into()));
    }
    dates::parse(&input.date)?;
    if input.date != dates::today_iso() {
        return Err(AppError::Validation(
            "Adjustments are recorded for today, against the current balance.".into(),
        ));
    }
    let diff = input.new_stock - material.stock;
    if diff == 0 {
        return Err(AppError::Validation("The counted stock matches the system. Nothing to adjust.".into()));
    }

    let mv_id = new_id();
    let movement = StockMovement {
        id: mv_id.clone(),
        material_id: material.id.clone(),
        date: input.date.clone(),
        movement_type: MovementType::Adjustment,
        qty: diff,
        rate: material.avg_cost,
        value: diff * material.avg_cost,
        balance_after: 0,
        vendor_id: None,
        vendor_name: None,
        bill_no: None,
        reels: None,
        order_id: None,
        order_no: None,
        reason: Some(input.reason),
        note: clean(input.note),
        transaction_id: None,
        created_at: dates::now_iso(),
    };

    let (mv_out, material_id) = (movement.clone(), material.id.clone());
    s.in_transaction(move |st, session| {
        let (movement, material_id) = (mv_out.clone(), material_id.clone());
        async move {
            st.stock_movements().insert_one(&movement).session(&mut *session).await?;
            replay_ledger(st, session, &material_id, false).await?;
            Ok(())
        }
        .boxed()
    })
    .await?;

    let saved = s
        .stock_movements()
        .find_one(doc! { "id": &mv_id })
        .await?
        .unwrap_or(movement);
    Ok(saved)
}

#[tauri::command]
pub async fn stock_adjust(db: State<'_, Db>, input: AdjustInput) -> AppResult<StockMovement> {
    record_adjust(&db.store().await?, input).await
}

pub(crate) async fn delete_movement(s: &Store, id: &str) -> AppResult<String> {
    let mv = s
        .stock_movements()
        .find_one(doc! { "id": id })
        .await?
        .ok_or_else(|| AppError::NotFound("Entry not found.".into()))?;
    if mv.movement_type == MovementType::Opening {
        return Err(AppError::Conflict("The opening balance can't be deleted. Use an adjustment instead.".into()));
    }

    let (mv_id, material_id, txn_id) = (id.to_string(), mv.material_id.clone(), mv.transaction_id.clone());
    s.in_transaction(move |st, session| {
        let (mv_id, material_id, txn_id) = (mv_id.clone(), material_id.clone(), txn_id.clone());
        async move {
            st.stock_movements().delete_one(doc! { "id": &mv_id }).session(&mut *session).await?;
            if let Some(tid) = txn_id {
                st.transactions().delete_one(doc! { "id": &tid }).session(&mut *session).await?;
            }
            replay_ledger(st, session, &material_id, true).await?;
            Ok(())
        }
        .boxed()
    })
    .await?;

    Ok(id.to_string())
}

#[tauri::command]
pub async fn stock_movement_delete(db: State<'_, Db>, id: String) -> AppResult<String> {
    delete_movement(&db.store().await?, &id).await
}

#[cfg(test)]
pub(crate) mod tests_api {
    pub(crate) use super::{
        consumption, create_material, delete_movement, list_materials, list_movements, record_adjust,
        record_inward, record_issue, update_material,
    };
}
