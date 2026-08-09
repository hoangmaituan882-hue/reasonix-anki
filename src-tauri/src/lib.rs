mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // SQLite（M4 统计聚合表，技术方案 §5.4）
        .plugin(tauri_plugin_sql::Builder::default().build())
        // 媒体目录缓存（M3 媒体直读，技术方案 §6.3）
        .manage(commands::MediaDir::default())
        .invoke_handler(tauri::generate_handler![
            commands::anki_request,
            commands::read_media_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
