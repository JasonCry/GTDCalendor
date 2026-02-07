#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod store;

#[cfg(desktop)]
fn set_window_icon(app: &tauri::AppHandle) {
    use std::path::PathBuf;
    use tauri::image::Image;
    use tauri::Manager;
    let window = match app.get_webview_window("main") {
        Some(w) => w,
        None => {
            if let Some((_, w)) = app.webview_windows().into_iter().next() {
                w
            } else {
                return;
            }
        }
    };
    let resource_dir: Option<PathBuf> = app.path().resource_dir().ok();
    // 使用 PNG/ICO 以便 Image::from_path 可解码（需启用 image-png / image-ico）
    let icon_path: Option<PathBuf> = resource_dir.as_ref().and_then(|d| {
        #[cfg(windows)]
        return Some(d.join("icons").join("icon.ico"));
        #[cfg(not(windows))]
        return Some(d.join("icons").join("32x32.png"));
    });
    if let Some(path) = icon_path.as_ref() {
        if path.exists() {
            if let Ok(img) = Image::from_path(path) {
                let _ = window.set_icon(img);
                return;
            }
        }
    }
    // Fallback: 32x32.png (e.g. in dev)
    if let Some(ref res) = resource_dir {
        let png = res.join("icons").join("32x32.png");
        if png.exists() {
            if let Ok(img) = Image::from_path(&png) {
                let _ = window.set_icon(img);
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::read_markdown,
            commands::write_markdown,
            commands::get_default_store_path,
            commands::set_default_store_path,
            commands::read_file_at_path,
            commands::write_file_at_path,
            commands::get_app_data_dir,
        ])
        .setup(|app| {
            #[cfg(desktop)]
            set_window_icon(&app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

