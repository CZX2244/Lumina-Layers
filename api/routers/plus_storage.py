"""Storage overview and selective cleanup (Lumina Studio Plus).

存储占用一览与分项清理（个人增强版）。

``GET /api/system/storage`` reports how much disk each local data category
uses; ``POST /api/system/storage/clean`` removes the categories the user picks.
Both stay behind the same local-origin guard as ``/api/system/clear-cache``.
Generated outputs that are still served (registry/session files) are only
removed by the existing full cleanup, which also resets sessions.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

import config
from api.routers.feedback import _resolve_feedback_root
from api.routers.system import _enforce_clear_cache_origin
from api.structured_logging import get_logger
from core.material_cache import default_cache_directory

log = get_logger(__name__)

router = APIRouter(prefix="/api/system/storage", tags=["System"])

_REPO_ROOT = Path(__file__).resolve().parents[2]

StorageCategory = Literal["temp", "models", "solver_cache", "feedback", "logs"]


@dataclass(frozen=True)
class _CategorySpec:
    root: Callable[[], Path]
    keep_newest_file: bool = False


def _log_root() -> Path:
    override = os.environ.get("LUMINA_LOG_DIR", "").strip()
    return Path(override) if override else _REPO_ROOT / "logs"


_CATEGORIES: dict[str, _CategorySpec] = {
    "temp": _CategorySpec(lambda: Path(config.TEMP_DIR)),
    "models": _CategorySpec(lambda: Path(config.MODELS_DIR)),
    "solver_cache": _CategorySpec(lambda: default_cache_directory()),
    "feedback": _CategorySpec(_resolve_feedback_root),
    # The active log file is still being written; keep the newest one.
    "logs": _CategorySpec(_log_root, keep_newest_file=True),
}


class StorageEntry(BaseModel):
    id: str
    path: str
    bytes: int
    files: int
    exists: bool


class StorageOverview(BaseModel):
    categories: list[StorageEntry]
    total_bytes: int


class StorageCleanRequest(BaseModel):
    categories: list[StorageCategory] = Field(min_length=1, max_length=len(_CATEGORIES))


class StorageCleanResult(BaseModel):
    deleted_files: int
    freed_bytes: int
    failed_files: int


def _measure(root: Path) -> tuple[int, int]:
    total = 0
    count = 0
    for directory, _dirs, files in os.walk(root, onerror=lambda _error: None):
        for name in files:
            try:
                total += os.lstat(os.path.join(directory, name)).st_size
                count += 1
            except OSError:
                continue
    return total, count


def _newest_file(root: Path) -> Path | None:
    newest: tuple[float, Path] | None = None
    for directory, _dirs, files in os.walk(root, onerror=lambda _error: None):
        for name in files:
            path = Path(directory, name)
            try:
                mtime = path.stat().st_mtime
            except OSError:
                continue
            if newest is None or mtime > newest[0]:
                newest = (mtime, path)
    return newest[1] if newest else None


def _clean(root: Path, keep_newest_file: bool) -> tuple[int, int, int]:
    """Delete everything below *root* (never *root* itself)."""
    if not root.is_dir():
        return 0, 0, 0
    keep = _newest_file(root) if keep_newest_file else None
    deleted = freed = failed = 0
    for directory, dirs, files in os.walk(root, topdown=False, onerror=lambda _error: None):
        for name in files:
            path = Path(directory, name)
            if keep is not None and path == keep:
                continue
            try:
                size = path.lstat().st_size
                path.unlink()
                deleted += 1
                freed += size
            except OSError:
                failed += 1
        for name in dirs:
            path = Path(directory, name)
            if path.is_symlink():
                continue
            with_contents = any(path.iterdir()) if path.is_dir() else False
            if not with_contents:
                try:
                    path.rmdir()
                except OSError:
                    pass
    return deleted, freed, failed


@router.get("")
def storage_overview(request: Request) -> StorageOverview:
    """Report disk use per local data category. 报告各类本地数据的磁盘占用。"""
    _enforce_clear_cache_origin(request)
    entries: list[StorageEntry] = []
    for category_id, spec in _CATEGORIES.items():
        root = spec.root()
        exists = root.is_dir()
        size, files = _measure(root) if exists else (0, 0)
        entries.append(StorageEntry(id=category_id, path=str(root), bytes=size, files=files, exists=exists))
    return StorageOverview(categories=entries, total_bytes=sum(entry.bytes for entry in entries))


@router.post("/clean")
def storage_clean(request: Request, body: StorageCleanRequest) -> StorageCleanResult:
    """Delete the selected categories. 删除选中的数据类别。"""
    _enforce_clear_cache_origin(request)
    deleted = freed = failed = 0
    for category_id in dict.fromkeys(body.categories):
        spec = _CATEGORIES[category_id]
        root = spec.root()
        # Never follow a category root that resolves to the filesystem root
        # or the application directory itself.
        resolved = root.resolve()
        if resolved == Path(resolved.anchor) or resolved == _REPO_ROOT.resolve():
            continue
        d, f, x = _clean(root, spec.keep_newest_file)
        deleted += d
        freed += f
        failed += x
    log.info(
        "Selective storage cleanup finished",
        extra={
            "event": "plus_storage_clean_done",
            "categories": list(dict.fromkeys(body.categories)),
            "deleted_files": deleted,
            "freed_bytes": freed,
            "failed_files": failed,
        },
    )
    return StorageCleanResult(deleted_files=deleted, freed_bytes=freed, failed_files=failed)

