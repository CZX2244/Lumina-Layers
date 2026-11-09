"""Storage overview and selective cleanup for the personal desktop build."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import config
from api.app import app
from api.routers import plus_storage

LOCAL = {"Host": "127.0.0.1:8000", "Origin": "http://127.0.0.1:8000"}


@pytest.fixture()
def roots(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> dict[str, Path]:
    paths = {name: tmp_path / name for name in ("temp", "models", "solver_cache", "feedback", "logs")}
    for path in paths.values():
        path.mkdir()
    monkeypatch.setattr(config, "TEMP_DIR", str(paths["temp"]))
    monkeypatch.setattr(config, "MODELS_DIR", str(paths["models"]))
    monkeypatch.setitem(plus_storage._CATEGORIES, "solver_cache", plus_storage._CategorySpec(lambda: paths["solver_cache"]))
    monkeypatch.setitem(plus_storage._CATEGORIES, "feedback", plus_storage._CategorySpec(lambda: paths["feedback"]))
    monkeypatch.setitem(plus_storage._CATEGORIES, "logs", plus_storage._CategorySpec(lambda: paths["logs"], keep_newest_file=True))
    (paths["temp"] / "a.png").write_bytes(b"x" * 10)
    (paths["temp"] / "nested").mkdir()
    (paths["temp"] / "nested" / "b.bin").write_bytes(b"y" * 5)
    (paths["solver_cache"] / "c.npz").write_bytes(b"z" * 7)
    old_log = paths["logs"] / "lumina_old.log"
    old_log.write_bytes(b"l" * 3)
    new_log = paths["logs"] / "lumina_new.log"
    new_log.write_bytes(b"n" * 4)
    import os
    os.utime(old_log, (1_000_000, 1_000_000))
    return paths


def test_overview_reports_sizes_per_category(roots: dict[str, Path]) -> None:
    client = TestClient(app)
    response = client.get("/api/system/storage", headers=LOCAL)
    assert response.status_code == 200
    data = {entry["id"]: entry for entry in response.json()["categories"]}
    assert data["temp"]["bytes"] == 15 and data["temp"]["files"] == 2
    assert data["solver_cache"]["bytes"] == 7
    assert data["logs"]["files"] == 2
    assert response.json()["total_bytes"] == 15 + 7 + 7


def test_clean_removes_selected_categories_and_keeps_active_log(roots: dict[str, Path]) -> None:
    client = TestClient(app)
    response = client.post("/api/system/storage/clean", json={"categories": ["temp", "logs"]}, headers=LOCAL)
    assert response.status_code == 200
    assert response.json()["deleted_files"] == 3
    assert response.json()["freed_bytes"] == 18
    assert roots["temp"].is_dir() and not any(roots["temp"].iterdir())
    assert [path.name for path in roots["logs"].iterdir()] == ["lumina_new.log"]
    assert (roots["solver_cache"] / "c.npz").exists(), "unselected categories are untouched"


def test_storage_routes_reject_untrusted_origins(roots: dict[str, Path]) -> None:
    client = TestClient(app)
    assert client.get("/api/system/storage", headers={"origin": "https://evil.example"}).status_code == 403
    response = client.post("/api/system/storage/clean", json={"categories": ["temp"]}, headers={"origin": "https://evil.example"})
    assert response.status_code == 403
    assert (roots["temp"] / "a.png").exists()


def test_unknown_categories_are_rejected(roots: dict[str, Path]) -> None:
    client = TestClient(app)
    response = client.post("/api/system/storage/clean", json={"categories": ["materials"]}, headers=LOCAL)
    assert response.status_code == 422
