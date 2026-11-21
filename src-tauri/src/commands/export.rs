//! Native Excel (.xlsx) export using rust_xlsxwriter.

use crate::error::{AppError, AppResult};
use rust_xlsxwriter::{Color, Format, FormatBorder, Workbook};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct XlsxSheet {
    pub name: String,
    pub headers: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct XlsxExportInput {
    pub title: Option<String>,
    pub sheets: Vec<XlsxSheet>,
}

#[tauri::command]
pub async fn export_xlsx(input: XlsxExportInput) -> AppResult<Vec<u8>> {
    let mut workbook = Workbook::new();

    let title_format = Format::new()
        .set_bold()
        .set_font_size(14.0)
        .set_font_name("Segoe UI");

    let header_format = Format::new()
        .set_bold()
        .set_font_name("Segoe UI")
        .set_font_size(10.5)
        .set_background_color(Color::RGB(0xEAECF0))
        .set_border(FormatBorder::Thin)
        .set_border_color(Color::RGB(0xD0D5DD));

    let cell_format = Format::new()
        .set_font_name("Segoe UI")
        .set_font_size(10.0);

    let int_format = Format::new()
        .set_font_name("Segoe UI")
        .set_font_size(10.0)
        .set_num_format("#,##0");

    let dec_format = Format::new()
        .set_font_name("Segoe UI")
        .set_font_size(10.0)
        .set_num_format("#,##0.00");

    if input.sheets.is_empty() {
        let worksheet = workbook.add_worksheet();
        worksheet.set_name("Sheet1").map_err(|e| AppError::Internal(e.to_string()))?;
    }

    for (sheet_idx, sheet) in input.sheets.iter().enumerate() {
        let worksheet = workbook.add_worksheet();
        let safe_name = if sheet.name.trim().is_empty() {
            format!("Sheet{}", sheet_idx + 1)
        } else {
            // Excel sheet names max 31 chars and no : \ / ? * [ ]
            sheet
                .name
                .chars()
                .filter(|c| !":\\/?*[]".contains(*c))
                .take(31)
                .collect()
        };
        let _ = worksheet.set_name(&safe_name);

        let mut row_idx: u32 = 0;

        // Title if present
        if let Some(ref t) = input.title {
            worksheet
                .write_string_with_format(row_idx, 0, t, &title_format)
                .map_err(|e| AppError::Internal(e.to_string()))?;
            row_idx += 2;
        }

        // Headers
        for (col_idx, h) in sheet.headers.iter().enumerate() {
            worksheet
                .write_string_with_format(row_idx, col_idx as u16, h, &header_format)
                .map_err(|e| AppError::Internal(e.to_string()))?;
        }
        if !sheet.headers.is_empty() {
            row_idx += 1;
        }

        // Data rows
        for r in &sheet.rows {
            for (col_idx, val) in r.iter().enumerate() {
                let c = col_idx as u16;
                match val {
                    serde_json::Value::Number(n) => {
                        if let Some(i) = n.as_i64() {
                            let _ = worksheet.write_number_with_format(row_idx, c, i as f64, &int_format);
                        } else if let Some(f) = n.as_f64() {
                            let _ = worksheet.write_number_with_format(row_idx, c, f, &dec_format);
                        }
                    }
                    serde_json::Value::String(s) => {
                        let _ = worksheet.write_string_with_format(row_idx, c, s, &cell_format);
                    }
                    serde_json::Value::Bool(b) => {
                        let _ = worksheet.write_boolean_with_format(row_idx, c, *b, &cell_format);
                    }
                    serde_json::Value::Null => {
                        // Empty cell
                    }
                    other => {
                        let _ = worksheet.write_string_with_format(row_idx, c, other.to_string(), &cell_format);
                    }
                }
            }
            row_idx += 1;
        }

        worksheet.autofit();
    }

    let buf = workbook
        .save_to_buffer()
        .map_err(|e| AppError::Internal(format!("Failed to generate Excel file: {e}")))?;

    Ok(buf)
}
