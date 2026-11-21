//! Calendar helpers. Dates travel as `yyyy-MM-dd` strings (same as the UI),
//! which also sort correctly as strings in MongoDB.

use crate::error::{AppError, AppResult};
use chrono::{Datelike, Duration, Local, NaiveDate, Weekday};

pub fn today() -> NaiveDate {
    Local::now().date_naive()
}

pub fn iso(d: NaiveDate) -> String {
    d.format("%Y-%m-%d").to_string()
}

pub fn today_iso() -> String {
    iso(today())
}

pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

pub fn parse(s: &str) -> AppResult<NaiveDate> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").map_err(|_| AppError::Validation(format!("Invalid date: {s}")))
}

/// `yyyy-MM` → first day of that month
pub fn parse_month(m: &str) -> AppResult<NaiveDate> {
    NaiveDate::parse_from_str(&format!("{m}-01"), "%Y-%m-%d").map_err(|_| AppError::Validation(format!("Invalid month: {m}")))
}

pub fn month_start(d: NaiveDate) -> NaiveDate {
    d.with_day(1).expect("day 1 always valid")
}

pub fn month_end(d: NaiveDate) -> NaiveDate {
    let next = if d.month() == 12 {
        NaiveDate::from_ymd_opt(d.year() + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(d.year(), d.month() + 1, 1)
    };
    next.expect("valid month") - Duration::days(1)
}

pub fn add_months(d: NaiveDate, months: i32) -> NaiveDate {
    let total = d.year() * 12 + d.month0() as i32 + months;
    let (y, m) = (total.div_euclid(12), total.rem_euclid(12) as u32 + 1);
    let first = NaiveDate::from_ymd_opt(y, m, 1).expect("valid month");
    first.with_day(d.day().min(month_end(first).day())).expect("clamped day")
}

/// Working days (Mon–Sat) in [from, to], inclusive. Sunday is the weekly off.
pub fn working_days(from: NaiveDate, to: NaiveDate) -> i64 {
    if to < from {
        return 0;
    }
    from.iter_days().take_while(|d| *d <= to).filter(|d| d.weekday() != Weekday::Sun).count() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(s: &str) -> NaiveDate {
        parse(s).unwrap()
    }

    #[test]
    fn working_days_skip_sundays() {
        // Nov 2026: 30 days, Sundays on 1, 8, 15, 22, 29
        assert_eq!(working_days(d("2026-11-01"), d("2026-11-30")), 25);
        assert_eq!(working_days(d("2026-11-02"), d("2026-11-02")), 1);
        assert_eq!(working_days(d("2026-11-03"), d("2026-11-02")), 0);
    }

    #[test]
    fn month_math() {
        assert_eq!(month_end(d("2026-02-10")), d("2026-02-28"));
        assert_eq!(month_end(d("2026-12-05")), d("2026-12-31"));
        assert_eq!(add_months(d("2026-01-31"), 1), d("2026-02-28"));
        assert_eq!(add_months(d("2026-11-15"), -11), d("2025-12-15"));
    }
}
