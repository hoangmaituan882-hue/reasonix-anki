import importlib
import unittest
from types import SimpleNamespace


def load_bridge_module():
    try:
        return importlib.import_module("reasonix_addon.operation_bridge")
    except ModuleNotFoundError as error:
        raise AssertionError("Anki operation bridge is not implemented") from error


class ImmediateOperation:
    def __init__(self, collection, operation) -> None:
        self.collection = collection
        self.operation = operation
        self.on_success = None
        self.on_failure = None

    def success(self, callback):
        self.on_success = callback
        return self

    def failure(self, callback):
        self.on_failure = callback
        return self

    def run_in_background(self):
        try:
            result = self.operation(self.collection)
            if not hasattr(result, "changes"):
                raise AssertionError("CollectionOp results must expose .changes")
        except Exception as error:
            self.on_failure(error)
        else:
            self.on_success(result)


class ImmediateQueryOperation:
    def __init__(self, collection, operation, on_success) -> None:
        self.collection = collection
        self.operation = operation
        self.on_success = on_success
        self.on_failure = None

    def failure(self, callback):
        self.on_failure = callback
        return self

    def run_in_background(self):
        try:
            result = self.operation(self.collection)
        except Exception as error:
            self.on_failure(error)
        else:
            self.on_success(result)


class OperationBridgeTests(unittest.TestCase):
    def make_bridge(self):
        bridge_module = load_bridge_module()
        collection = object()
        used: list[str] = []

        def factory(kind: str):
            if kind == "query":
                def create(*, parent, op, success):
                    self.assertEqual(parent, "main-window")
                    used.append(kind)
                    return ImmediateQueryOperation(collection, op, success)
            else:
                def create(*, parent, op):
                    self.assertEqual(parent, "main-window")
                    used.append(kind)
                    return ImmediateOperation(collection, op)

            return create

        handled: list[object] = []

        def handle(request: object):
            handled.append(request)
            return {"result": {"ok": True}, "error": None}

        bridge = bridge_module.AnkiOperationBridge(
            parent="main-window",
            handle=handle,
            run_on_main=lambda callback: callback(),
            query_op_factory=factory("query"),
            collection_op_factory=factory("collection"),
            collection_changes=lambda: "operation-changes",
            timeout=0.2,
        )
        return bridge, used, handled

    def test_read_actions_use_query_operations(self) -> None:
        bridge, used, handled = self.make_bridge()
        request = {"action": "session.next"}

        response = bridge.dispatch(request)

        self.assertEqual(response, {"result": {"ok": True}, "error": None})
        self.assertEqual(used, ["query"])
        self.assertEqual(handled, [request])

    def test_collection_result_unwraps_nested_undo_changes(self) -> None:
        bridge_module = load_bridge_module()
        native_changes = object()

        result = bridge_module.CollectionOperationResponse(
            response={"result": {}, "error": None},
            native_changes=SimpleNamespace(changes=native_changes),
        )

        self.assertIs(result.changes, native_changes)

    def test_scheduler_mutations_use_collection_operations(self) -> None:
        bridge, used, _ = self.make_bridge()

        bridge.dispatch({"action": "session.start"})
        bridge.dispatch({"action": "session.answer"})
        bridge.dispatch({"action": "session.undo"})

        self.assertEqual(used, ["collection", "collection", "collection"])

    def test_operation_failures_become_structured_retryable_errors(self) -> None:
        bridge_module = load_bridge_module()

        def fail(_request: object):
            raise RuntimeError("database busy")

        bridge = bridge_module.AnkiOperationBridge(
            parent="main-window",
            handle=fail,
            run_on_main=lambda callback: callback(),
            query_op_factory=lambda *, parent, op, success: ImmediateQueryOperation(
                object(), op, success
            ),
            collection_op_factory=lambda *, parent, op: ImmediateOperation(
                object(), op
            ),
            collection_changes=lambda: "operation-changes",
            timeout=0.2,
        )

        response = bridge.dispatch({"action": "session.next"})

        self.assertEqual(response["error"]["code"], "ANKI_OPERATION_FAILED")
        self.assertTrue(response["error"]["retryable"])
        self.assertNotIn("database busy", response["error"]["message"])

    def test_times_out_if_the_main_thread_never_accepts_the_operation(self) -> None:
        bridge_module = load_bridge_module()
        bridge = bridge_module.AnkiOperationBridge(
            parent="main-window",
            handle=lambda request: {"result": {}, "error": None},
            run_on_main=lambda callback: None,
            query_op_factory=lambda *, parent, op, success: ImmediateQueryOperation(
                object(), op, success
            ),
            collection_op_factory=lambda *, parent, op: ImmediateOperation(
                object(), op
            ),
            collection_changes=lambda: "operation-changes",
            timeout=0.01,
        )

        response = bridge.dispatch({"action": "session.next"})

        self.assertEqual(response["error"]["code"], "ANKI_OPERATION_TIMEOUT")
        self.assertTrue(response["error"]["retryable"])

    def test_rejects_a_request_if_anki_supplies_a_different_collection(self) -> None:
        bridge_module = load_bridge_module()
        expected_collection = object()
        handled = []

        bridge = bridge_module.AnkiOperationBridge(
            parent="main-window",
            handle=lambda request: handled.append(request) or {"result": {}, "error": None},
            run_on_main=lambda callback: callback(),
            query_op_factory=lambda *, parent, op, success: ImmediateQueryOperation(
                object(), op, success
            ),
            collection_op_factory=lambda *, parent, op: ImmediateOperation(
                object(), op
            ),
            collection_changes=lambda: "operation-changes",
            expected_collection=expected_collection,
            timeout=0.2,
        )

        response = bridge.dispatch({"action": "session.next"})

        self.assertEqual(response["error"]["code"], "PROFILE_CHANGED")
        self.assertFalse(response["error"]["retryable"])
        self.assertEqual(handled, [])


if __name__ == "__main__":
    unittest.main()
