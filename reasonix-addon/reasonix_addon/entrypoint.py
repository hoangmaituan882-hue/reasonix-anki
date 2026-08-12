"""Anki addon entrypoint and official GUI-hook wiring."""

from __future__ import annotations

import atexit
from collections.abc import Callable
from threading import Thread
from typing import Any

from .anki_adapter import AnkiSchedulerAdapter
from .config import authorization_settings, normalize_config, update_authorization
from .operation_bridge import AnkiOperationBridge
from .permissions import PermissionManager
from .profile_key import derive_profile_key
from .runtime import AddonRuntime
from .service import AddonService
from .session import SessionManager
from .settings import register_settings


def install(
    mw: Any,
    gui_hooks: Any,
    *,
    query_op_factory: Callable[..., Any] | None = None,
    collection_op_factory: Callable[..., Any] | None = None,
    scheduler_adapter_factory: Callable[[Any], Any] = AnkiSchedulerAdapter,
    server_factory: Callable[..., Any] | None = None,
    thread_factory: Callable[..., Any] = Thread,
    ask_user: Callable[[], bool] | None = None,
    empty_changes_factory: Callable[[], object] | None = None,
    addon_name: str = "reasonix-anki",
    settings_registrar: Callable[..., object] = register_settings,
) -> AddonRuntime:
    """Install the addon once and return its lifecycle runtime.

    Imports that require Anki/Qt are delayed until this function is called, so
    importing the small core package in tests never assumes that a profile or
    collection is already open.
    """

    if query_op_factory is None or collection_op_factory is None:
        from aqt.operations import CollectionOp, QueryOp

        query_op_factory = query_op_factory or QueryOp
        collection_op_factory = collection_op_factory or CollectionOp
    if server_factory is None:
        from .http import AddonHttpServer

        server_factory = AddonHttpServer
    if empty_changes_factory is None:
        from anki.collection import OpChanges

        empty_changes_factory = OpChanges
    if ask_user is None:
        from aqt.utils import askUser

        ask_user = lambda: askUser(
            "Reasonix Anki 请求权限，用于呈现并控制当前 Anki 学习会话。\n\n"
            "选择“是”后，此 Anki 安装将记住你的授权；你可以随时在“工具 → "
            "Reasonix 设置…”中撤销。",
            parent=mw,
            title="Reasonix Anki 授权",
        )

    addon_manager = mw.addonManager
    config = normalize_config(addon_manager.getConfig(addon_name) or {})
    authorization_mode, remembered_grant = authorization_settings(config)

    def write_config(apply: Callable[[dict[str, Any]], dict[str, Any]]) -> None:
        """统一写入通道：读 + 合并 + 写整体在 run_on_main 内串行执行，
        避免调用线程读、主线程写造成的授权/会话互相覆盖窗口。"""
        nonlocal config

        def apply_and_write() -> None:
            nonlocal config
            latest = normalize_config(
                addon_manager.getConfig(addon_name) or {}
            )
            config = apply(latest)
            addon_manager.writeConfig(addon_name, config)

        mw.taskman.run_on_main(apply_and_write)

    def persist_permission_state(manager: PermissionManager) -> None:
        state = manager.settings()
        write_config(
            lambda latest: update_authorization(
                latest,
                mode=state["authorizationMode"],
                granted=bool(state["granted"]),
            )
        )

    permission_manager = PermissionManager(
        confirm=ask_user,
        run_on_main=mw.taskman.run_on_main,
        authorization_mode=authorization_mode,
        remembered_grant=remembered_grant,
        on_state_change=persist_permission_state,
    )

    def anki_version() -> str:
        import aqt

        return str(aqt.appVersion)

    runtime = AddonRuntime(
        server_factory=server_factory,
        thread_factory=thread_factory,
        permission_manager=permission_manager,
        anki_version_provider=anki_version,
        sync_start=getattr(mw, "on_sync_button_clicked", None),
        run_on_main=mw.taskman.run_on_main,
    )
    def on_profile_did_open() -> None:
        collection = getattr(mw, "col", None)
        profile_manager = getattr(mw, "pm", None)
        profile_name = getattr(profile_manager, "name", None)
        collection_path = (
            profile_manager.collectionPath() if profile_manager is not None else None
        )
        if collection is None or not isinstance(profile_name, str) or not profile_name:
            runtime.profile_will_close()
            return
        if not isinstance(collection_path, str) or not collection_path:
            runtime.profile_will_close()
            return

        profile_key = derive_profile_key(collection_path)
        adapter = scheduler_adapter_factory(collection)

        # 会话快照持久化到 addon config（config 通道已存在，跨重启保留）。
        # 快照按 profileKey 隔离存储于 config["session"] 映射；空 dict = 无活动会话。
        def persist_session_snapshot(snapshot: dict[str, object]) -> None:
            # 合并逻辑交给 write_config 在 main 线程串行执行（基于最新 config）
            def merge(latest: dict[str, Any]) -> dict[str, Any]:
                sessions = dict(latest.get("session") or {})
                sessions[profile_key] = snapshot
                latest["session"] = sessions
                return latest

            write_config(merge)

        def load_session_snapshot() -> dict[str, object] | None:
            sessions = config.get("session")
            if not isinstance(sessions, dict):
                return None
            snapshot = sessions.get(profile_key)
            return snapshot if isinstance(snapshot, dict) else None

        manager = SessionManager(
            adapter,
            persist=persist_session_snapshot,
            load_snapshot=load_session_snapshot,
        )
        service = AddonService(
            manager,
            token_provider=lambda: permission_manager.token,
            profile_key_provider=lambda profile_key=profile_key: profile_key,
        )

        def collection_changes() -> object:
            # Capture this profile's service.  A profile switch may replace the
            # outer active_service while an old CollectionOp is finishing.
            changes = service.take_collection_changes()
            return changes if changes is not None else empty_changes_factory()

        bridge = AnkiOperationBridge(
            parent=mw,
            handle=service.handle,
            run_on_main=mw.taskman.run_on_main,
            query_op_factory=query_op_factory,
            collection_op_factory=collection_op_factory,
            collection_changes=collection_changes,
            expected_collection=collection,
        )
        runtime.profile_did_open(
            bridge,
            invalidate=manager.invalidate,
            profile_name=profile_name,
            profile_key=profile_key,
            active_session_provider=lambda manager=manager: manager.has_active_session,
        )

    def on_profile_will_close() -> None:
        runtime.profile_will_close()

    runtime.start()
    settings_registrar(
        mw,
        addon_name=addon_name,
        permission_manager=permission_manager,
        anki_version_provider=anki_version,
        runtime_status_provider=runtime.status,
    )
    gui_hooks.profile_did_open.append(on_profile_did_open)
    gui_hooks.profile_will_close.append(on_profile_will_close)
    gui_hooks.collection_will_temporarily_close.append(
        lambda _collection: runtime.collection_will_temporarily_close()
    )
    gui_hooks.collection_did_temporarily_close.append(
        lambda _collection: runtime.collection_did_temporarily_close()
    )
    gui_hooks.sync_will_start.append(runtime.sync_will_start)
    gui_hooks.sync_did_finish.append(runtime.sync_did_finish)
    atexit.register(runtime.stop)
    return runtime
