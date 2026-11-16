"""Generation snapshots stay consistent while background work writes the session.

After every preview a background thread adds ``visible_region_component_cache``
to the session (api/visible_region_cache.py). Generation copies the session
under the editor locks only, so a key added during ``deepcopy`` raised
"dictionary changed size during iteration" and the user saw a 409
"Generation inputs could not be snapshotted safely".
生成快照不能被后台线程新增会话键打断。
"""

from __future__ import annotations

import logging
import sys
import threading

import pytest
from fastapi import HTTPException

from api.routers.converter.generate import _capture_generation_snapshot
from api.session_store import SessionStore

ATTEMPTS = 60


def _session_with_bulky_inputs(store: SessionStore) -> str:
    session_id = store.create()
    # Enough nested data that deepcopy spans many thread switches.
    store.put(session_id, "replacement_regions", [{"selected_color": f"#{i:06x}", "mask": list(range(40))} for i in range(400)])
    store.put(session_id, "editor_content_revision", 1)
    return session_id


def _capture(store: SessionStore, session_id: str) -> dict:
    snapshot, _, _ = _capture_generation_snapshot(
        store, session_id, revision_mismatch_detail="changed",
    )
    return snapshot


@pytest.fixture
def frequent_thread_switches():
    previous = sys.getswitchinterval()
    sys.setswitchinterval(1e-6)
    yield
    sys.setswitchinterval(previous)


def test_snapshot_survives_keys_added_by_a_background_thread(frequent_thread_switches) -> None:
    store = SessionStore(ttl=1800)
    session_id = _session_with_bulky_inputs(store)
    stop = threading.Event()

    def background_writer() -> None:
        # Keep changing the dict size with a bounded set of keys: add through
        # put() like the prewarm thread, remove under the same store lock.
        live = store.get(session_id)
        index = 0
        while not stop.is_set():
            key = f"background_cache_{index % 32}"
            if key in live:
                with store._lock:
                    live.pop(key, None)
            else:
                store.put(session_id, key, index)
            index += 1

    writer = threading.Thread(target=background_writer, daemon=True)
    writer.start()
    failures = []
    try:
        for _ in range(ATTEMPTS):
            try:
                snapshot = _capture(store, session_id)
            except HTTPException as exc:
                failures.append(exc.detail)
                continue
            assert len(snapshot["replacement_regions"]) == 400
    finally:
        stop.set()
        writer.join(timeout=5)
        store.clear_all()

    assert failures == [], f"{len(failures)}/{ATTEMPTS} snapshots failed: {failures[:1]}"


def test_snapshot_is_independent_of_the_live_session() -> None:
    store = SessionStore(ttl=1800)
    session_id = _session_with_bulky_inputs(store)
    snapshot = _capture(store, session_id)

    snapshot["replacement_regions"][0]["selected_color"] = "#ffffff"
    snapshot["new_key"] = True
    store.put(session_id, "later_key", 1)

    live = store.get(session_id)
    assert live["replacement_regions"][0]["selected_color"] == "#000000"
    assert "new_key" not in live
    assert "later_key" not in snapshot
    store.clear_all()


def test_snapshot_failure_logs_its_cause(monkeypatch, caplog) -> None:
    store = SessionStore(ttl=1800)
    session_id = _session_with_bulky_inputs(store)

    def broken_deepcopy(_value, _memo=None):
        raise RuntimeError("dictionary changed size during iteration")

    monkeypatch.setattr("api.routers.converter.generate.deepcopy", broken_deepcopy)
    with caplog.at_level(logging.WARNING), pytest.raises(HTTPException) as exc_info:
        _capture(store, session_id)

    assert exc_info.value.status_code == 409
    records = [r for r in caplog.records if getattr(r, "event", None) == "generation_snapshot_failed"]
    assert len(records) == 1
    assert records[0].levelno == logging.WARNING
    assert records[0].error_type == "RuntimeError"
    assert records[0].session_id == session_id
    store.clear_all()


def test_store_snapshot_is_a_copy_and_skips_unavailable_sessions() -> None:
    store = SessionStore(ttl=1800)
    session_id = store.create()
    store.put(session_id, "a", 1)

    copy = store.snapshot(session_id)
    copy["b"] = 2
    assert copy == {"a": 1, "b": 2}
    assert store.get(session_id) == {"a": 1}
    assert store.snapshot("missing") is None

    store.close(session_id)
    assert store.snapshot(session_id) is None
