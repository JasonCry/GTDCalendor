use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

const PREF_DEFAULT_PATH: &str = "default_store_path";

/// Persist default store path in app data; read on startup.
pub fn get_default_store_path(app: &AppHandle) -> Option<PathBuf> {
    let path = app.path().app_data_dir().ok()?.join("prefs.json");
    let s = std::fs::read_to_string(&path).ok()?;
    let prefs: Prefs = serde_json::from_str(&s).ok()?;
    prefs.default_store_path.map(PathBuf::from)
}

pub fn set_default_store_path(app: &AppHandle, path: Option<String>) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let prefs_path = dir.join("prefs.json");
    let mut prefs: Prefs = std::fs::read_to_string(&prefs_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    prefs.default_store_path = path;
    let s = serde_json::to_string_pretty(&prefs).map_err(|e| e.to_string())?;
    std::fs::write(prefs_path, s).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Default, Serialize, Deserialize)]
struct Prefs {
    default_store_path: Option<String>,
}
