//! Where the connection string lives.
//!
//! * Production: the OS keychain (macOS Keychain, Windows Credential Manager,
//!   Secret Service on Linux), entered once per computer from Settings.
//!   Nothing is compiled into the binary or written to a plain file.
//! * Development: `BOXERP_MONGODB_URI` / `BOXERP_MONGODB_DB` env vars, read
//!   only in debug builds.

use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};

const SERVICE: &str = "com.boxerp.desktop";
const ACCOUNT: &str = "mongodb-connection";

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ConfigSource {
    Keychain,
    Env,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub uri: String,
    pub database: String,
    #[serde(skip, default = "default_source")]
    pub source: ConfigSource,
}

fn default_source() -> ConfigSource {
    ConfigSource::Keychain
}

// Never print the URI (it contains the password).
impl std::fmt::Debug for ConnectionConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ConnectionConfig")
            .field("host", &self.host_for_display())
            .field("database", &self.database)
            .finish()
    }
}

fn entry() -> AppResult<keyring::Entry> {
    Ok(keyring::Entry::new(SERVICE, ACCOUNT)?)
}

impl ConnectionConfig {
    pub fn load() -> AppResult<Option<Self>> {
        if cfg!(debug_assertions) {
            if let Ok(uri) = std::env::var("BOXERP_MONGODB_URI") {
                let database = std::env::var("BOXERP_MONGODB_DB").unwrap_or_else(|_| "boxerp".into());
                return Ok(Some(Self { uri, database, source: ConfigSource::Env }));
            }
        }
        match entry()?.get_password() {
            Ok(json) => serde_json::from_str(&json)
                .map(Some)
                .map_err(|_| AppError::Internal("Saved database settings are unreadable. Reconnect from Settings.".into())),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn save(&self) -> AppResult<()> {
        let json = serde_json::to_string(self).map_err(|e| AppError::Internal(e.to_string()))?;
        entry()?.set_password(&json)?;
        Ok(())
    }

    pub fn delete() -> AppResult<()> {
        match entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.into()),
        }
    }

    /// Basic hygiene checks before we try to connect.
    pub fn validate(&self) -> AppResult<()> {
        let uri = self.uri.trim();
        let db = self.database.trim();
        if db.is_empty() || db.contains(['/', '\\', '.', ' ', '"', '$']) || db.len() > 63 {
            return Err(AppError::Validation("Enter a valid database name (letters, digits, - or _).".into()));
        }
        let is_srv = uri.starts_with("mongodb+srv://");
        if !is_srv && !uri.starts_with("mongodb://") {
            return Err(AppError::Validation("Connection string must start with mongodb+srv:// or mongodb://".into()));
        }
        let host = self.host_for_display();
        let local = host.starts_with("localhost") || host.starts_with("127.0.0.1") || host.starts_with("[::1]");
        let lower = uri.to_ascii_lowercase();
        let tls_off = lower.contains("tls=false") || lower.contains("ssl=false");
        let tls_on = is_srv || lower.contains("tls=true") || lower.contains("ssl=true");
        if !local && (tls_off || !tls_on) {
            return Err(AppError::Validation(
                "Remote connections must use TLS. Use a mongodb+srv:// string or add tls=true.".into(),
            ));
        }
        Ok(())
    }

    /// Host part only (credentials stripped) — safe to show in the UI or logs.
    pub fn host_for_display(&self) -> String {
        let rest = self.uri.split_once("://").map(|(_, r)| r).unwrap_or(&self.uri);
        let rest = rest.rsplit_once('@').map(|(_, h)| h).unwrap_or(rest);
        rest.split(['/', '?']).next().unwrap_or_default().to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cfg(uri: &str) -> ConnectionConfig {
        ConnectionConfig { uri: uri.into(), database: "boxerp".into(), source: ConfigSource::Keychain }
    }

    #[test]
    fn strips_credentials_from_host() {
        assert_eq!(cfg("mongodb+srv://u:p@ss@cluster0.abc.mongodb.net/?retryWrites=true").host_for_display(), "cluster0.abc.mongodb.net");
        assert_eq!(cfg("mongodb://localhost:27017").host_for_display(), "localhost:27017");
    }

    #[test]
    fn requires_tls_for_remote() {
        assert!(cfg("mongodb+srv://u:p@cluster0.abc.mongodb.net").validate().is_ok());
        assert!(cfg("mongodb://u:p@db.example.com:27017").validate().is_err());
        assert!(cfg("mongodb://u:p@db.example.com:27017/?tls=true").validate().is_ok());
        assert!(cfg("mongodb+srv://u:p@cluster0.abc.mongodb.net/?tls=false").validate().is_err());
        assert!(cfg("mongodb://localhost:27017").validate().is_ok());
        assert!(cfg("postgres://x").validate().is_err());
    }

    #[test]
    fn debug_never_prints_uri() {
        let s = format!("{:?}", cfg("mongodb+srv://user:secret@cluster0.abc.mongodb.net"));
        assert!(!s.contains("secret"));
    }
}
