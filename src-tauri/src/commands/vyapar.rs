//! Vyapar CSV import: idempotent import of Vyapar sales, purchases, and daybook transactions.

use crate::dates;
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::model::finance::{CashTreatment, Direction, Party, PartyType, Transaction, TxnSource};
use crate::model::{new_id, PaymentMode};
use crate::store::Store;
use chrono::NaiveDate;
use mongodb::bson::doc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VyaparImportSummary {
    pub total_rows: usize,
    pub imported_count: usize,
    pub skipped_count: usize,
    pub error_count: usize,
    pub errors: Vec<String>,
}

fn parse_amount(val: &str) -> Option<i64> {
    let clean = val
        .replace('₹', "")
        .replace("Rs.", "")
        .replace("Rs", "")
        .replace(',', "")
        .trim()
        .to_string();
    if clean.is_empty() {
        return None;
    }
    let float_val: f64 = clean.parse().ok()?;
    Some((float_val.abs() * 100.0).round() as i64)
}

fn parse_date(val: &str) -> Option<String> {
    let clean = val.trim();
    if clean.is_empty() {
        return None;
    }

    // Try standard formats
    let formats = [
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%d.%m.%Y",
        "%Y/%m/%d",
        "%d-%b-%Y",
        "%d-%b-%y",
        "%d/%m/%y",
        "%d-%m-%y",
    ];

    for fmt in formats {
        if let Ok(d) = NaiveDate::parse_from_str(clean, fmt) {
            return Some(d.format("%Y-%m-%d").to_string());
        }
    }
    None
}

fn normalize_header(h: &str) -> String {
    h.trim()
        .trim_matches('\u{feff}') // remove UTF-8 BOM
        .to_lowercase()
        .replace([' ', '_', '-', '.', '/'], "")
}

pub(crate) async fn import_vyapar_csv(
    s: &Store,
    csv_content: &str,
) -> AppResult<VyaparImportSummary> {
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(csv_content.as_bytes());

    let headers = reader
        .headers()
        .map_err(|e| AppError::Validation(format!("Could not read CSV header: {e}")))?
        .clone();

    // Map normalized header names to column indexes
    let mut col_map = HashMap::new();
    for (idx, h) in headers.iter().enumerate() {
        let norm = normalize_header(h);
        col_map.insert(norm, idx);
    }

    let find_col = |patterns: &[&str]| -> Option<usize> {
        for p in patterns {
            let p_norm = normalize_header(p);
            if let Some(&idx) = col_map.get(&p_norm) {
                return Some(idx);
            }
            for (key, &idx) in &col_map {
                if key.contains(&p_norm) {
                    return Some(idx);
                }
            }
        }
        None
    };

    let col_date = find_col(&["date", "txndate", "billdate", "voucherdate"])
        .ok_or_else(|| AppError::Validation("CSV is missing a Date column".into()))?;

    let col_ref = find_col(&[
        "invoiceno",
        "billno",
        "voucherno",
        "refno",
        "reference",
        "txnno",
        "billnumber",
    ]);

    let col_party = find_col(&[
        "partyname",
        "customername",
        "vendorname",
        "party",
        "customer",
        "vendor",
    ]);

    let col_type = find_col(&["type", "transactiontype", "vouchertype"]);
    let col_amount = find_col(&["total", "totalamount", "amount", "netamount"]);
    let col_received = find_col(&["received", "cashin", "credit"]);
    let col_paid = find_col(&["paid", "cashout", "debit"]);
    let col_mode = find_col(&["paymenttype", "paymentmode", "mode"]);
    let col_desc = find_col(&["description", "particulars", "note", "remarks"]);

    if col_amount.is_none() && col_received.is_none() && col_paid.is_none() {
        return Err(AppError::Validation(
            "CSV is missing an Amount, Received, or Paid column".into(),
        ));
    }

    let mut total_rows = 0;
    let mut imported_count = 0;
    let mut skipped_count = 0;
    let mut error_count = 0;
    let mut errors = Vec::new();

    let now_iso = dates::now_iso();

    for (row_num, record) in reader.records().enumerate() {
        let rec = match record {
            Ok(r) => r,
            Err(e) => {
                error_count += 1;
                errors.push(format!("Row {}: CSV error - {e}", row_num + 2));
                continue;
            }
        };

        if rec.iter().all(|f| f.trim().is_empty()) {
            continue; // Skip blank rows
        }

        total_rows += 1;

        // Date
        let date_str = match rec.get(col_date).and_then(parse_date) {
            Some(d) => d,
            None => {
                error_count += 1;
                errors.push(format!(
                    "Row {}: Invalid date {:?}",
                    row_num + 2,
                    rec.get(col_date).unwrap_or("")
                ));
                continue;
            }
        };

        // Determine Direction and Amount
        let mut direction = Direction::In;
        let mut amount: i64 = 0;

        let rec_amt = col_received.and_then(|i| rec.get(i)).and_then(parse_amount);
        let paid_amt = col_paid.and_then(|i| rec.get(i)).and_then(parse_amount);

        if let Some(r) = rec_amt.filter(|&v| v > 0) {
            direction = Direction::In;
            amount = r;
        } else if let Some(p) = paid_amt.filter(|&v| v > 0) {
            direction = Direction::Out;
            amount = p;
        } else if let Some(amt_idx) = col_amount {
            let raw_amt = rec.get(amt_idx).unwrap_or("");
            if let Some(parsed) = parse_amount(raw_amt) {
                amount = parsed;
                // Infer direction from type
                let type_str = col_type
                    .and_then(|i| rec.get(i))
                    .unwrap_or("")
                    .to_lowercase();
                if type_str.contains("purchase")
                    || type_str.contains("out")
                    || type_str.contains("expense")
                    || type_str.contains("debit")
                {
                    direction = Direction::Out;
                } else {
                    direction = Direction::In;
                }
            }
        }

        if amount <= 0 {
            // Nothing to record
            skipped_count += 1;
            continue;
        }

        // Party
        let party_name = col_party
            .and_then(|i| rec.get(i))
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        // External reference
        let external_ref = col_ref
            .and_then(|i| rec.get(i))
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| {
                // If ref is missing, build a deterministic reference from date, party, and amount
                format!(
                    "VY-{}-{}-{}",
                    date_str.replace('-', ""),
                    party_name.as_deref().unwrap_or("NA"),
                    amount
                )
            });

        // Check idempotency: unique on (source: "vyapar_import", externalRef)
        let exists = s
            .transactions()
            .find_one(doc! {
                "source": "vyapar_import",
                "externalRef": &external_ref,
            })
            .await?;

        if exists.is_some() {
            skipped_count += 1;
            continue;
        }

        // Payment Mode
        let mode_str = col_mode
            .and_then(|i| rec.get(i))
            .unwrap_or("")
            .to_lowercase();
        let mode = if mode_str.contains("cash") {
            PaymentMode::Cash
        } else if mode_str.contains("upi")
            || mode_str.contains("gpay")
            || mode_str.contains("phonepe")
            || mode_str.contains("paytm")
            || mode_str.contains("qr")
        {
            PaymentMode::Upi
        } else {
            PaymentMode::Bank
        };

        // Resolve or create party
        let mut party_id = None;
        if let Some(ref p_name) = party_name {
            let existing_party = s
                .parties()
                .find_one(doc! {
                    "name": { "$regex": format!("^{}$", regex_escape(p_name)), "$options": "i" }
                })
                .await?;

            if let Some(p) = existing_party {
                party_id = Some(p.id);
            } else {
                let new_pid = new_id();
                let new_party = Party {
                    id: new_pid.clone(),
                    name: p_name.clone(),
                    party_type: if direction == Direction::In {
                        PartyType::Customer
                    } else {
                        PartyType::Vendor
                    },
                    phone: None,
                    gstin: None,
                };
                let _ = s.parties().insert_one(new_party).await;
                party_id = Some(new_pid);
            }
        }

        let desc = col_desc
            .and_then(|i| rec.get(i))
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let particulars = desc.unwrap_or_else(|| {
            if let Some(ref p_name) = party_name {
                format!(
                    "{} ({})",
                    p_name,
                    if direction == Direction::In {
                        "Vyapar Receipt"
                    } else {
                        "Vyapar Payment"
                    }
                )
            } else {
                format!("Vyapar voucher {}", external_ref)
            }
        });

        let category = if direction == Direction::In {
            "Sales Receipt".to_string()
        } else {
            "Purchase Payment".to_string()
        };

        let txn = Transaction {
            id: new_id(),
            date: date_str,
            direction,
            amount,
            category,
            treatment: CashTreatment::Operating,
            mode,
            party_id,
            party_name,
            particulars,
            reference: Some(format!("Vyapar #{external_ref}")),
            source: TxnSource::VyaparImport,
            external_ref: Some(external_ref),
            matched_to: None,
            origin: None,
            created_at: now_iso.clone(),
        };

        s.transactions().insert_one(txn).await?;
        imported_count += 1;
    }

    Ok(VyaparImportSummary {
        total_rows,
        imported_count,
        skipped_count,
        error_count,
        errors,
    })
}

fn regex_escape(s: &str) -> String {
    let mut out = String::new();
    for c in s.chars() {
        if "^$.*+?()[]{}|\\".contains(c) {
            out.push('\\');
        }
        out.push(c);
    }
    out
}

#[tauri::command]
pub async fn vyapar_import(
    db: State<'_, Db>,
    csv_content: String,
) -> AppResult<VyaparImportSummary> {
    import_vyapar_csv(&db.store().await?, &csv_content).await
}
