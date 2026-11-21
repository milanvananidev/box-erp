use serde::Serialize;

/// Errors returned to the UI. Serialised as `{ kind, message }` and turned
/// into an `AppError` by `src/lib/ipc.ts`. Messages must never contain
/// credentials or full connection strings.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    NotConfigured(String),
    #[error("{0}")]
    Connection(String),
    #[error("{0}")]
    Database(String),
    #[error("{0}")]
    Validation(String),
    #[allow(dead_code)]
    #[error("{0}")]
    NotFound(String),
    #[allow(dead_code)]
    #[error("{0}")]
    Conflict(String),
    #[error("{0}")]
    Internal(String),
    /// Raw driver error, kept so transaction retries can inspect error labels.
    #[error("{0}")]
    Mongo(mongodb::error::Error),
}

impl AppError {
    fn kind(&self) -> &'static str {
        match self {
            AppError::NotConfigured(_) => "NotConfigured",
            AppError::Connection(_) => "Connection",
            AppError::Database(_) => "Database",
            AppError::Validation(_) => "Validation",
            AppError::NotFound(_) => "NotFound",
            AppError::Conflict(_) => "Conflict",
            AppError::Internal(_) => "Internal",
            AppError::Mongo(_) => "Database",
        }
    }
}

impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut st = s.serialize_struct("AppError", 2)?;
        st.serialize_field("kind", self.kind())?;
        let message = match self {
            AppError::Mongo(e) => friendly(e),
            other => other.to_string(),
        };
        st.serialize_field("message", &message)?;
        st.end()
    }
}

impl From<mongodb::error::Error> for AppError {
    fn from(e: mongodb::error::Error) -> Self {
        use mongodb::error::ErrorKind;
        match *e.kind {
            ErrorKind::ServerSelection { .. } | ErrorKind::Io(_) | ErrorKind::DnsResolve { .. } => AppError::Connection(friendly(&e)),
            ErrorKind::Authentication { .. } => AppError::Connection(friendly(&e)),
            ErrorKind::InvalidArgument { ref message, .. } => AppError::Validation(message.clone()),
            _ => AppError::Mongo(e),
        }
    }
}

/// User-facing text for driver errors. Never includes the connection string.
fn friendly(e: &mongodb::error::Error) -> String {
    use mongodb::error::{ErrorKind, WriteFailure};
    match &*e.kind {
        ErrorKind::ServerSelection { .. } | ErrorKind::Io(_) | ErrorKind::DnsResolve { .. } => {
            "Can't reach the database server. Check the internet connection and that this computer's IP is allowed.".into()
        }
        ErrorKind::Authentication { .. } => "Database login failed. Check the username and password.".into(),
        ErrorKind::Write(WriteFailure::WriteError(w)) if w.code == 11000 => "This record already exists.".into(),
        _ => {
            log::error!("database error: {e}");
            "A database error occurred. Please try again.".into()
        }
    }
}

impl From<mongodb::bson::ser::Error> for AppError {
    fn from(e: mongodb::bson::ser::Error) -> Self {
        AppError::Internal(format!("serialisation error: {e}"))
    }
}

impl From<keyring::Error> for AppError {
    fn from(e: keyring::Error) -> Self {
        AppError::Internal(format!("OS keychain error: {e}"))
    }
}

pub type AppResult<T> = Result<T, AppError>;
