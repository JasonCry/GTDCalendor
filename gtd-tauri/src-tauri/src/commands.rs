use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

const DEFAULT_TEMPLATE: &str = r#"# 📥 收件箱
- [ ] 示例任务（可删除或开始添加）

# ⚡ 下一步行动


# ⏳ 等待确认


# ☕ 将来/也许
"#;

/// Resolve default store path; if none set, use app_data_dir()/gtd-flow/store.md and persist it.
fn ensure_default_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    if let Some(p) = crate::store::get_default_store_path(app) {
        return Ok(p);
    }
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let default_path = dir.join("gtd-flow").join("store.md");
    std::fs::create_dir_all(default_path.parent().unwrap()).map_err(|e| e.to_string())?;
    crate::store::set_default_store_path(app, default_path.to_str().map(String::from))?;
    Ok(default_path)
}

/// Read markdown from default store path or return default template.
#[tauri::command]
pub fn read_markdown(app: AppHandle) -> Result<String, String> {
    let path = ensure_default_path(&app)?;
    if path.exists() {
        std::fs::read_to_string(&path).map_err(|e| e.to_string())
    } else {
        Ok(DEFAULT_TEMPLATE.to_string())
    }
}

/// Write markdown to default store path. Creates file and parent dirs if needed.
#[tauri::command]
pub fn write_markdown(app: AppHandle, content: String) -> Result<(), String> {
    let path = ensure_default_path(&app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

/// Get the path used for default store (or null if not set).
#[tauri::command]
pub fn get_default_store_path(app: AppHandle) -> Result<Option<String>, String> {
    Ok(crate::store::get_default_store_path(&app).and_then(|p| p.to_str().map(String::from)))
}

/// Set the default store path (e.g. after user picks a file). Pass null to clear.
#[tauri::command]
pub fn set_default_store_path(app: AppHandle, path: Option<String>) -> Result<(), String> {
    crate::store::set_default_store_path(&app, path)
}

/// Return app data directory path (for UI to show or choose store location).
#[tauri::command]
pub fn get_app_data_dir(app: AppHandle) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    dir.to_str()
        .map(String::from)
        .ok_or_else(|| "Invalid path".to_string())
}

/// Read file content at the given path (for Open / Open dialog result).
#[tauri::command]
pub fn read_file_at_path(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// Write content to the given path (for Save As). Creates parent dirs if needed.
#[tauri::command]
pub fn write_file_at_path(path: String, content: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&p, content).map_err(|e| e.to_string())?;
    Ok(())
}
