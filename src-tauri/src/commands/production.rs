//! Production: orders, stages, production entries, wastage tracking.

use crate::dates;
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::model::new_id;
use crate::model::production::*;
use crate::store::{find_all, Store};
use futures_util::FutureExt;
use mongodb::bson::{doc, to_bson};
use tauri::State;

/* ───────── Queries ───────── */

pub(crate) async fn list_orders(s: &Store) -> AppResult<Vec<ProductionOrder>> {
    find_all(&s.production_orders(), doc! {}, doc! { "dueDate": 1, "createdAt": -1 }).await
}

#[tauri::command]
pub async fn production_orders_list(db: State<'_, Db>) -> AppResult<Vec<ProductionOrder>> {
    list_orders(&db.store().await?).await
}

pub(crate) async fn list_entries(s: &Store, order_id: &str) -> AppResult<Vec<ProductionEntry>> {
    find_all(&s.production_entries(), doc! { "orderId": order_id }, doc! { "date": -1, "createdAt": -1 }).await
}

#[tauri::command]
pub async fn production_entries_list(db: State<'_, Db>, order_id: String) -> AppResult<Vec<ProductionEntry>> {
    list_entries(&db.store().await?, &order_id).await
}

pub(crate) async fn customers(s: &Store) -> AppResult<Vec<String>> {
    let mut list: Vec<String> = s
        .production_orders()
        .distinct("customer", doc! {})
        .await?
        .into_iter()
        .filter_map(|b| b.as_str().map(|s| s.to_string()))
        .collect();
    list.sort();
    list.dedup();
    Ok(list)
}

#[tauri::command]
pub async fn production_customers(db: State<'_, Db>) -> AppResult<Vec<String>> {
    customers(&db.store().await?).await
}

pub(crate) async fn month_output(s: &Store) -> AppResult<MonthOutput> {
    let today = dates::today();
    let from = dates::iso(dates::month_start(today));
    let entries: Vec<ProductionEntry> = find_all(
        &s.production_entries(),
        doc! { "date": { "$gte": from } },
        doc! {},
    )
    .await?;
    let good: i64 = entries.iter().map(|e| e.good_qty).sum();
    let wastage: i64 = entries.iter().map(|e| e.wastage_qty).sum();
    Ok(MonthOutput { good, wastage })
}

#[tauri::command]
pub async fn production_month_output(db: State<'_, Db>) -> AppResult<MonthOutput> {
    month_output(&db.store().await?).await
}

pub(crate) async fn active_orders(s: &Store) -> AppResult<Vec<ProductionOrder>> {
    find_all(
        &s.production_orders(),
        doc! { "stage": { "$ne": "completed" } },
        doc! { "dueDate": 1 },
    )
    .await
}

#[tauri::command]
pub async fn production_active_orders(db: State<'_, Db>) -> AppResult<Vec<ProductionOrder>> {
    active_orders(&db.store().await?).await
}

/* ───────── Order mutations ───────── */

fn clean(o: Option<String>) -> Option<String> {
    o.map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

fn validate_order_input(i: &OrderInput) -> AppResult<()> {
    if i.customer.trim().len() < 2 {
        return Err(AppError::Validation("Enter the customer's name.".into()));
    }
    if i.product.trim().len() < 2 {
        return Err(AppError::Validation("Enter the product description.".into()));
    }
    if i.planned_qty <= 0 {
        return Err(AppError::Validation("Planned quantity must be greater than zero.".into()));
    }
    if i.due_date < i.start_date {
        return Err(AppError::Validation("Due date can't be before the start date.".into()));
    }
    dates::parse(&i.start_date)?;
    dates::parse(&i.due_date)?;
    if !matches!(i.spec.ply, 3 | 5 | 7) {
        return Err(AppError::Validation("Ply must be 3, 5, or 7.".into()));
    }
    if !matches!(i.spec.flute.as_str(), "A" | "B" | "C" | "E" | "BC") {
        return Err(AppError::Validation("Choose a valid flute type.".into()));
    }
    if i.spec.length_mm <= 0 || i.spec.width_mm <= 0 || i.spec.height_mm <= 0 {
        return Err(AppError::Validation("Box dimensions must be positive.".into()));
    }
    if i.spec.gsm <= 0 {
        return Err(AppError::Validation("GSM must be positive.".into()));
    }
    if i.spec.printed {
        if let Some(colors) = i.spec.colors {
            if colors <= 0 {
                return Err(AppError::Validation("Number of colors must be positive.".into()));
            }
        }
    }
    Ok(())
}

pub(crate) async fn create_order(s: &Store, input: OrderInput) -> AppResult<ProductionOrder> {
    validate_order_input(&input)?;
    let seq = s.next_seq("order_no", 1000).await?;
    let order_no = format!("PO-{seq}");
    let order = ProductionOrder {
        id: new_id(),
        order_no,
        customer: input.customer.trim().to_string(),
        customer_ref: clean(input.customer_ref),
        product: input.product.trim().to_string(),
        spec: input.spec,
        planned_qty: input.planned_qty,
        produced_qty: 0,
        wastage_qty: 0,
        stage: ProductionStage::Planned,
        held_from_stage: None,
        hold_reason: None,
        priority: input.priority,
        start_date: input.start_date,
        due_date: input.due_date,
        completed_on: None,
        notes: clean(input.notes),
        created_at: dates::now_iso(),
    };
    s.production_orders().insert_one(&order).await?;
    Ok(order)
}

#[tauri::command]
pub async fn production_order_create(db: State<'_, Db>, input: OrderInput) -> AppResult<ProductionOrder> {
    create_order(&db.store().await?, input).await
}

pub(crate) async fn update_order(s: &Store, id: &str, input: OrderInput) -> AppResult<ProductionOrder> {
    validate_order_input(&input)?;
    let mut order = s
        .production_orders()
        .find_one(doc! { "id": id })
        .await?
        .ok_or_else(|| AppError::NotFound("This production order no longer exists.".into()))?;
    if order.stage == ProductionStage::Completed {
        return Err(AppError::Conflict("Completed orders can't be edited.".into()));
    }
    if input.planned_qty < order.produced_qty {
        return Err(AppError::Validation(format!(
            "Planned quantity can't be less than already produced ({}).",
            order.produced_qty
        )));
    }

    order.customer = input.customer.trim().to_string();
    order.customer_ref = clean(input.customer_ref);
    order.product = input.product.trim().to_string();
    order.spec = input.spec;
    order.planned_qty = input.planned_qty;
    order.priority = input.priority;
    order.start_date = input.start_date;
    order.due_date = input.due_date;
    order.notes = clean(input.notes);

    s.production_orders()
        .replace_one(doc! { "id": id }, &order)
        .await?;
    Ok(order)
}

#[tauri::command]
pub async fn production_order_update(
    db: State<'_, Db>,
    id: String,
    input: OrderInput,
) -> AppResult<ProductionOrder> {
    update_order(&db.store().await?, &id, input).await
}

pub(crate) async fn set_stage(s: &Store, id: &str, stage: ProductionStage) -> AppResult<ProductionOrder> {
    let mut order = s
        .production_orders()
        .find_one(doc! { "id": id })
        .await?
        .ok_or_else(|| AppError::NotFound("This production order no longer exists.".into()))?;
    if order.stage == ProductionStage::OnHold {
        return Err(AppError::Conflict("Resume the order before changing its stage.".into()));
    }
    order.stage = stage;
    order.completed_on = if stage == ProductionStage::Completed {
        Some(dates::today_iso())
    } else {
        None
    };

    s.production_orders()
        .replace_one(doc! { "id": id }, &order)
        .await?;
    Ok(order)
}

#[tauri::command]
pub async fn production_order_set_stage(
    db: State<'_, Db>,
    id: String,
    stage: ProductionStage,
) -> AppResult<ProductionOrder> {
    set_stage(&db.store().await?, &id, stage).await
}

pub(crate) async fn hold_order(s: &Store, id: &str, reason: &str) -> AppResult<ProductionOrder> {
    let mut order = s
        .production_orders()
        .find_one(doc! { "id": id })
        .await?
        .ok_or_else(|| AppError::NotFound("This production order no longer exists.".into()))?;
    if order.stage == ProductionStage::Completed {
        return Err(AppError::Conflict("Completed orders can't be put on hold.".into()));
    }
    order.held_from_stage = Some(working_stage(&order));
    order.stage = ProductionStage::OnHold;
    order.hold_reason = Some(reason.trim().to_string());

    s.production_orders()
        .replace_one(doc! { "id": id }, &order)
        .await?;
    Ok(order)
}

#[tauri::command]
pub async fn production_order_hold(
    db: State<'_, Db>,
    id: String,
    reason: String,
) -> AppResult<ProductionOrder> {
    hold_order(&db.store().await?, &id, &reason).await
}

pub(crate) async fn resume_order(s: &Store, id: &str) -> AppResult<ProductionOrder> {
    let mut order = s
        .production_orders()
        .find_one(doc! { "id": id })
        .await?
        .ok_or_else(|| AppError::NotFound("This production order no longer exists.".into()))?;
    order.stage = order.held_from_stage.unwrap_or(ProductionStage::Planned);
    order.held_from_stage = None;
    order.hold_reason = None;

    s.production_orders()
        .replace_one(doc! { "id": id }, &order)
        .await?;
    Ok(order)
}

#[tauri::command]
pub async fn production_order_resume(db: State<'_, Db>, id: String) -> AppResult<ProductionOrder> {
    resume_order(&db.store().await?, &id).await
}

pub(crate) async fn delete_order(s: &Store, id: &str) -> AppResult<String> {
    let _order = s
        .production_orders()
        .find_one(doc! { "id": id })
        .await?
        .ok_or_else(|| AppError::NotFound("This production order no longer exists.".into()))?;
    let entry_count = s
        .production_entries()
        .count_documents(doc! { "orderId": id })
        .await?;
    if entry_count > 0 {
        return Err(AppError::Conflict(
            "This order has production logged against it. Put it on hold instead of deleting it.".into(),
        ));
    }
    s.production_orders()
        .delete_one(doc! { "id": id })
        .await?;
    Ok(id.to_string())
}

#[tauri::command]
pub async fn production_order_delete(db: State<'_, Db>, id: String) -> AppResult<String> {
    delete_order(&db.store().await?, &id).await
}

/* ───────── Entry mutations ───────── */

fn validate_entry_input(i: &EntryInput) -> AppResult<()> {
    if i.good_qty < 0 || i.wastage_qty < 0 {
        return Err(AppError::Validation("Quantities cannot be negative.".into()));
    }
    if i.good_qty + i.wastage_qty <= 0 {
        return Err(AppError::Validation("Enter good pieces or wastage.".into()));
    }
    dates::parse(&i.date)?;
    if dates::parse(&i.date)? > dates::today() {
        return Err(AppError::Validation("Entry date can't be in the future.".into()));
    }
    Ok(())
}

pub(crate) async fn log_entry(s: &Store, input: EntryInput) -> AppResult<ProductionEntry> {
    validate_entry_input(&input)?;
    let order = s
        .production_orders()
        .find_one(doc! { "id": &input.order_id })
        .await?
        .ok_or_else(|| AppError::NotFound("Production order not found.".into()))?;
    if order.stage == ProductionStage::Completed {
        return Err(AppError::Conflict("This order is already completed.".into()));
    }

    let entry = ProductionEntry {
        id: new_id(),
        order_id: input.order_id.clone(),
        date: input.date.clone(),
        stage: input.stage,
        good_qty: input.good_qty,
        wastage_qty: input.wastage_qty,
        wastage_reason: input.wastage_reason,
        note: clean(input.note),
        created_at: dates::now_iso(),
    };

    let (order_id, entry_out) = (order.id.clone(), entry.clone());
    s.in_transaction(move |st, session| {
        let (order_id, entry) = (order_id.clone(), entry_out.clone());
        async move {
            st.production_entries().insert_one(&entry).session(&mut *session).await?;

            let mut cursor = st
                .production_entries()
                .find(doc! { "orderId": &order_id })
                .session(&mut *session)
                .await?;
            let mut produced_qty: i64 = 0;
            let mut wastage_qty: i64 = 0;
            while let Some(res) = cursor.next(&mut *session).await {
                let e = res?;
                produced_qty += e.good_qty;
                wastage_qty += e.wastage_qty;
            }

            let order = st
                .production_orders()
                .find_one(doc! { "id": &order_id })
                .session(&mut *session)
                .await?
                .ok_or_else(|| AppError::NotFound("Production order not found.".into()))?;

            let mut new_stage = order.stage;
            if order.stage == ProductionStage::Planned {
                if let Some(next) = next_stage(&order) {
                    new_stage = next;
                }
            }

            let stage_bson = to_bson(&new_stage)?;
            st.production_orders()
                .update_one(
                    doc! { "id": &order_id },
                    doc! {
                        "$set": {
                            "producedQty": produced_qty,
                            "wastageQty": wastage_qty,
                            "stage": stage_bson,
                        }
                    },
                )
                .session(&mut *session)
                .await?;
            Ok(())
        }
        .boxed()
    })
    .await?;

    Ok(entry)
}

#[tauri::command]
pub async fn production_entry_create(db: State<'_, Db>, input: EntryInput) -> AppResult<ProductionEntry> {
    log_entry(&db.store().await?, input).await
}

pub(crate) async fn delete_entry(s: &Store, id: &str) -> AppResult<String> {
    let entry = s
        .production_entries()
        .find_one(doc! { "id": id })
        .await?
        .ok_or_else(|| AppError::NotFound("Entry no longer exists.".into()))?;
    let order = s
        .production_orders()
        .find_one(doc! { "id": &entry.order_id })
        .await?
        .ok_or_else(|| AppError::NotFound("Production order not found.".into()))?;
    if order.stage == ProductionStage::Completed {
        return Err(AppError::Conflict("Entries of a completed order are locked.".into()));
    }

    let (order_id, entry_id) = (order.id.clone(), id.to_string());
    s.in_transaction(move |st, session| {
        let (order_id, entry_id) = (order_id.clone(), entry_id.clone());
        async move {
            st.production_entries()
                .delete_one(doc! { "id": &entry_id })
                .session(&mut *session)
                .await?;

            let mut cursor = st
                .production_entries()
                .find(doc! { "orderId": &order_id })
                .session(&mut *session)
                .await?;
            let mut produced_qty: i64 = 0;
            let mut wastage_qty: i64 = 0;
            while let Some(res) = cursor.next(&mut *session).await {
                let e = res?;
                produced_qty += e.good_qty;
                wastage_qty += e.wastage_qty;
            }

            st.production_orders()
                .update_one(
                    doc! { "id": &order_id },
                    doc! {
                        "$set": {
                            "producedQty": produced_qty,
                            "wastageQty": wastage_qty,
                        }
                    },
                )
                .session(&mut *session)
                .await?;
            Ok(())
        }
        .boxed()
    })
    .await?;

    Ok(id.to_string())
}

#[tauri::command]
pub async fn production_entry_delete(db: State<'_, Db>, id: String) -> AppResult<String> {
    delete_entry(&db.store().await?, &id).await
}

#[cfg(test)]
pub(crate) mod tests_api {
    pub(crate) use super::{
        active_orders, create_order, customers, delete_entry, delete_order, hold_order, list_entries,
        list_orders, log_entry, month_output, resume_order, set_stage, update_order,
    };
}
