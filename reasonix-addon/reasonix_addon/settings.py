"""Chinese native settings page and Anki menu registration."""

from __future__ import annotations

from collections.abc import Callable
from collections.abc import Mapping
from typing import Any

from .permissions import AuthorizationMode, PermissionManager
from .runtime import ADDON_VERSION


SETTINGS_TITLE = "Reasonix Anki 设置"
MENU_LABEL = "Reasonix 设置…"


def register_settings(
    mw: Any,
    *,
    addon_name: str,
    permission_manager: PermissionManager,
    anki_version_provider: Callable[[], str],
    runtime_status_provider: Callable[[], Mapping[str, object]] | None = None,
    action_factory: Callable[[str, Any], Any] | None = None,
) -> Any:
    """Register both official addon config and a visible Tools menu entry."""

    def open_page() -> None:
        open_settings(
            mw,
            permission_manager=permission_manager,
            anki_version_provider=anki_version_provider,
            runtime_status_provider=runtime_status_provider,
        )

    mw.addonManager.setConfigAction(addon_name, open_page)
    if action_factory is None:
        from aqt.qt import QAction

        action_factory = QAction
    action = action_factory(MENU_LABEL, mw)
    action.triggered.connect(open_page)
    mw.form.menuTools.addAction(action)
    return action


def open_settings(
    mw: Any,
    *,
    permission_manager: PermissionManager,
    anki_version_provider: Callable[[], str],
    runtime_status_provider: Callable[[], Mapping[str, object]] | None = None,
) -> None:
    """Show the native Qt settings dialog; imports stay Anki-local."""

    from aqt.qt import (
        QDialog,
        QDialogButtonBox,
        QGroupBox,
        QLabel,
        QMessageBox,
        QPushButton,
        QRadioButton,
        QTimer,
        QVBoxLayout,
    )

    dialog = QDialog(mw)
    dialog.setWindowTitle(SETTINGS_TITLE)
    dialog.setMinimumWidth(520)
    root = QVBoxLayout(dialog)

    intro = QLabel(
        "Reasonix 只负责呈现，Anki 负责数据、调度与同步。\n"
        "以下授权适用于此 Anki 安装的所有 Profile。"
    )
    intro.setWordWrap(True)
    root.addWidget(intro)

    status = QLabel()
    root.addWidget(status)

    group = QGroupBox("授权策略")
    group_layout = QVBoxLayout(group)
    prompt_once = QRadioButton("首次询问并永久记住（推荐）")
    prompt_each_start = QRadioButton("每次启动 Anki 询问一次")
    deny = QRadioButton("始终拒绝 Reasonix 学习会话")
    group_layout.addWidget(prompt_once)
    group_layout.addWidget(prompt_each_start)
    group_layout.addWidget(deny)
    root.addWidget(group)

    revoke = QPushButton("撤销当前授权")
    root.addWidget(revoke)

    diagnostics = QLabel()
    diagnostics.setWordWrap(True)
    root.addWidget(diagnostics)
    copy_diagnostics = QPushButton("复制诊断信息")
    root.addWidget(copy_diagnostics)

    buttons = QDialogButtonBox(
        QDialogButtonBox.StandardButton.Ok
        | QDialogButtonBox.StandardButton.Cancel
    )
    root.addWidget(buttons)

    current = permission_manager.settings()
    mode = current["authorizationMode"]
    if mode == "prompt_each_start":
        prompt_each_start.setChecked(True)
    elif mode == "deny":
        deny.setChecked(True)
    else:
        prompt_once.setChecked(True)

    def refresh() -> None:
        state = permission_manager.settings()
        if state["granted"]:
            status.setText("授权状态：已授权（此 Anki 安装）")
        elif state["authorizationMode"] == "deny":
            status.setText("授权状态：已禁用")
        else:
            status.setText("授权状态：等待首次确认")
        try:
            runtime_status = (
                dict(runtime_status_provider())
                if runtime_status_provider is not None
                else {}
            )
        except Exception:
            runtime_status = {}
        health = runtime_status.get("health")
        health = dict(health) if isinstance(health, Mapping) else {}
        sync = health.get("sync")
        sync = dict(sync) if isinstance(sync, Mapping) else {}
        last_error = health.get("lastError")
        last_error = dict(last_error) if isinstance(last_error, Mapping) else None
        service_labels = {
            "stopped": "未启动",
            "starting": "启动中",
            "listening": "监听中",
            "error": "异常",
        }
        service_state = service_labels.get(
            str(health.get("serviceState", "stopped")), "未知"
        )
        sync_labels = {
            "idle": "空闲",
            "starting": "启动中",
            "syncing": "同步中",
            "finished": "已完成",
            "error": "异常",
        }
        sync_state = sync_labels.get(str(sync.get("state", "idle")), "未知")
        error_line = ""
        if last_error is not None:
            error_line = f"\n最近错误：{last_error.get('code', 'UNKNOWN')}"
        try:
            anki_version = anki_version_provider()
        except Exception:
            anki_version = "未知"
        diagnostics.setText(
            f"插件版本：{ADDON_VERSION}\n"
            f"Anki 版本：{anki_version}\n"
            f"协议：v1 · 服务：{service_state} · 监听：127.0.0.1:8766\n"
            f"请求：{health.get('requestCount', 0)}（失败 {health.get('failedRequestCount', 0)}）\n"
            f"同步：{sync_state} · 尝试 {sync.get('attempts', 0)}"
            f"{error_line}"
        )

    def selected_mode() -> AuthorizationMode:
        if prompt_each_start.isChecked():
            return "prompt_each_start"
        if deny.isChecked():
            return "deny"
        return "prompt_once"

    def apply() -> None:
        permission_manager.set_authorization_mode(selected_mode())
        refresh()

    def revoke_permission() -> None:
        permission_manager.revoke()
        prompt_once.setChecked(True)
        permission_manager.set_authorization_mode("prompt_once")
        refresh()
        QMessageBox.information(
            dialog,
            SETTINGS_TITLE,
            "授权已撤销。下一次开始学习时会重新询问。",
        )

    def copy_info() -> None:
        from aqt.qt import QApplication

        QApplication.clipboard().setText(diagnostics.text())

    revoke.clicked.connect(revoke_permission)
    copy_diagnostics.clicked.connect(copy_info)
    buttons.accepted.connect(apply)
    buttons.accepted.connect(dialog.accept)
    buttons.rejected.connect(dialog.reject)
    monitor = QTimer(dialog)
    monitor.setInterval(1000)
    monitor.timeout.connect(refresh)
    monitor.start()
    dialog.finished.connect(lambda _result: monitor.stop())
    refresh()
    dialog.exec()
