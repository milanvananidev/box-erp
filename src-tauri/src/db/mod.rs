//! MongoDB connection management.

mod config;

pub use config::{ConnectionConfig, ConfigSource};

use crate::error::{AppError, AppResult};
use crate::store::Store;
use mongodb::{bson::doc, options::ClientOptions, Client};
use serde::Serialize;
use std::time::Duration;
use tokio::sync::RwLock;

struct Connection {
    client: Client,
    database: String,
    host: String,
    source: ConfigSource,
}

/// Managed Tauri state. Holds at most one live client; commands borrow the
/// `Database` handle through [`Db::database`].
#[derive(Default)]
pub struct Db {
    conn: RwLock<Option<Connection>>,
    last_error: RwLock<Option<String>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbStatus {
    configured: bool,
    connected: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    host: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    database: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    source: Option<ConfigSource>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

impl Db {
    /// Client + database for commands, or a `NotConfigured` error the UI can act on.
    pub async fn store(&self) -> AppResult<Store> {
        self.conn
            .read()
            .await
            .as_ref()
            .map(|c| Store { client: c.client.clone(), db: c.client.database(&c.database) })
            .ok_or_else(|| AppError::NotConfigured("Database is not configured on this computer. Open Settings → Database connection.".into()))
    }

    /// Validate, connect and ping. Does not persist anything.
    async fn open(cfg: &ConnectionConfig) -> AppResult<Connection> {
        cfg.validate()?;
        let mut opts = ClientOptions::parse(&cfg.uri).await?;
        opts.app_name = Some("BoxERP".into());
        opts.server_selection_timeout = Some(Duration::from_secs(8));
        opts.connect_timeout = Some(Duration::from_secs(8));
        let client = Client::with_options(opts)?;
        let db = client.database(&cfg.database);
        db.run_command(doc! { "ping": 1 }).await?;
        crate::store::ensure_indexes(&db).await?;
        crate::store::seed_defaults(&db).await?;
        Ok(Connection { client, database: cfg.database.clone(), host: cfg.host_for_display(), source: cfg.source })
    }

    async fn install(&self, conn: Connection) {
        if let Some(old) = self.conn.write().await.replace(conn) {
            old.client.shutdown().await;
        }
        *self.last_error.write().await = None;
    }

    /// Called at start-up: use the saved keychain entry (or env vars in development).
    pub async fn connect_from_saved(&self) -> AppResult<()> {
        let Some(cfg) = ConnectionConfig::load()? else { return Ok(()) };
        match Self::open(&cfg).await {
            Ok(conn) => {
                self.install(conn).await;
                Ok(())
            }
            Err(e) => {
                *self.last_error.write().await = Some(e.to_string());
                Err(e)
            }
        }
    }

    /// Test a new connection string; only saved to the keychain if the ping succeeds.
    pub async fn configure(&self, uri: String, database: String) -> AppResult<DbStatus> {
        let cfg = ConnectionConfig { uri, database, source: ConfigSource::Keychain };
        let conn = Self::open(&cfg).await?;
        cfg.save()?;
        self.install(conn).await;
        Ok(self.status().await)
    }

    pub async fn forget(&self) -> AppResult<DbStatus> {
        ConnectionConfig::delete()?;
        if let Some(old) = self.conn.write().await.take() {
            old.client.shutdown().await;
        }
        Ok(self.status().await)
    }

    pub async fn status(&self) -> DbStatus {
        let error = self.last_error.read().await.clone();
        if let Some(c) = self.conn.read().await.as_ref() {
            return DbStatus {
                configured: true,
                connected: true,
                host: Some(c.host.clone()),
                database: Some(c.database.clone()),
                source: Some(c.source),
                error: None,
            };
        }
        match ConnectionConfig::load() {
            Ok(Some(cfg)) => DbStatus {
                configured: true,
                connected: false,
                host: Some(cfg.host_for_display()),
                database: Some(cfg.database),
                source: Some(cfg.source),
                error,
            },
            Ok(None) => DbStatus { configured: false, connected: false, host: None, database: None, source: None, error: None },
            Err(e) => DbStatus { configured: false, connected: false, host: None, database: None, source: None, error: Some(e.to_string()) },
        }
    }
}
