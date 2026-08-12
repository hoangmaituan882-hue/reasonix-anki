//! AnkiConnect 代理 command（技术方案 §2.2）
//!
//! Rust 层刻意做薄：只负责转发 + 超时 + `{result, error}` 统一解包，
//! 业务逻辑全部留在 TS 层（可测、可热更新）。

use base64::Engine as _;
use serde_json::Value;
use std::sync::OnceLock;
use std::time::Duration;
use tauri::Manager;

const ANKI_URL: &str = "http://127.0.0.1:8765";
const REASONIX_URL: &str = "http://127.0.0.1:8766";
const TIMEOUT: Duration = Duration::from_secs(15);

static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn client() -> &'static reqwest::Client {
    CLIENT.get_or_init(reqwest::Client::new)
}

/// 通用 AnkiConnect 调用：action + params → result
/// 前端经 `invoke("anki_request", { action, params })` 调用（camelCase 自动映射）。
#[tauri::command]
pub async fn anki_request(action: String, params: Value) -> Result<Value, String> {
    let body = serde_json::json!({
        "action": action,
        "version": 6,
        "params": params,
    });

    let resp = client()
        .post(ANKI_URL)
        .json(&body)
        .timeout(TIMEOUT)
        .send()
        .await
        .map_err(|e| format!("无法连接 AnkiConnect（127.0.0.1:8765）：{e}"))?;

    let json: Value = resp
        .json()
        .await
        .map_err(|e| format!("AnkiConnect 响应解析失败：{e}"))?;

    // AnkiConnect v6 响应约定：error 为 null 即成功，否则为错误信息字符串
    match json.get("error") {
        Some(Value::String(msg)) if !msg.is_empty() => Err(msg.clone()),
        _ => Ok(json.get("result").cloned().unwrap_or(Value::Null)),
    }
}

/// Reasonix 配套插件代理：只转发完整协议 envelope，不在 Rust 层解释业务错误。
#[tauri::command]
pub async fn reasonix_request(request: Value) -> Result<Value, String> {
    let response = client()
        .post(REASONIX_URL)
        .json(&request)
        .timeout(TIMEOUT)
        .send()
        .await
        .map_err(|e| format!("无法连接 Reasonix Anki 插件（127.0.0.1:8766）：{e}"))?;

    response
        .json()
        .await
        .map_err(|e| format!("Reasonix Anki 插件响应解析失败：{e}"))
}

/* ---------------- 媒体直读（技术方案 §6.3 首选链路） ---------------- */

/// 媒体目录路径缓存（首次 read_media_file 时经 getMediaDirPath 获取）
#[derive(Default)]
pub struct MediaDir(std::sync::Mutex<Option<std::path::PathBuf>>);

async fn resolve_media_dir(state: &MediaDir) -> Result<std::path::PathBuf, String> {
    // 锁守卫不能跨 await（否则 future 非 Send）：读缓存与写缓存分开加锁
    {
        let guard = state.0.lock().unwrap();
        if let Some(dir) = guard.as_ref() {
            return Ok(dir.clone());
        }
    }
    let resp = client()
        .post(ANKI_URL)
        .json(&serde_json::json!({
            "action": "getMediaDirPath",
            "version": 6,
            "params": {}
        }))
        .timeout(TIMEOUT)
        .send()
        .await
        .map_err(|e| format!("无法连接 AnkiConnect：{e}"))?;
    let json: Value = resp
        .json()
        .await
        .map_err(|e| format!("AnkiConnect 响应解析失败：{e}"))?;
    if let Some(Value::String(msg)) = json.get("error") {
        if !msg.is_empty() {
            return Err(msg.clone());
        }
    }
    let dir = json
        .get("result")
        .and_then(Value::as_str)
        .ok_or_else(|| "getMediaDirPath 返回异常".to_string())?;
    let path = std::path::PathBuf::from(dir);
    let mut guard = state.0.lock().unwrap();
    *guard = Some(path.clone());
    Ok(path)
}

/// 直读 Anki 媒体目录中的文件，返回 base64。
/// 文件名来自卡片 HTML（不可信输入）：拒绝路径分隔符与 ".."，防目录穿越。
#[tauri::command]
pub async fn read_media_file(
    state: tauri::State<'_, MediaDir>,
    filename: String,
) -> Result<String, String> {
    if filename.is_empty()
        || filename.contains("..")
        || filename.contains('/')
        || filename.contains('\\')
        || filename.contains(':')
    {
        return Err("非法媒体文件名".to_string());
    }
    let dir = resolve_media_dir(&state).await?;
    let path = dir.join(&filename);
    let bytes = std::fs::read(&path).map_err(|e| format!("读取媒体失败：{e}"))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}

/// 返回内嵌的配套插件安装包绝对路径（tauri bundle resources）。
/// 前端据此引导用户安装/打开所在目录；dev 模式指向 src-tauri/resources/。
#[tauri::command]
pub async fn addon_package_path(
    app: tauri::AppHandle,
) -> Result<String, String> {
    let path = app
        .path()
        .resolve(
            "reasonix-anki-addon.ankiaddon",
            tauri::path::BaseDirectory::Resource,
        )
        .map_err(|e| format!("无法解析插件安装包路径：{e}"))?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::{ANKI_URL, REASONIX_URL};

    #[test]
    fn addon_proxy_uses_a_separate_loopback_port() {
        assert_eq!(ANKI_URL, "http://127.0.0.1:8765");
        assert_eq!(REASONIX_URL, "http://127.0.0.1:8766");
        assert_ne!(ANKI_URL, REASONIX_URL);
    }
}
