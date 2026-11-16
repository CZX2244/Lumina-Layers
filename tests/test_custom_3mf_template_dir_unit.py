"""Saved 3MF printer templates follow LUMINA_CUSTOM_3MF_TEMPLATE_DIR.

The desktop build points this at its own data folder so templates are not
written into another app's folder.
3MF 打印机模板目录遵循 LUMINA_CUSTOM_3MF_TEMPLATE_DIR。
"""

from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

from core import custom_3mf_templates


def _store_template(folder: Path) -> str:
    template_id = uuid4().hex
    folder.mkdir(parents=True, exist_ok=True)
    document = {"metadata": {"id": template_id, "name": "A1", "slicer": "BambuStudio"}, "settings": {"printer": "A1"}}
    (folder / f"{template_id}.json").write_text(json.dumps(document), encoding="utf-8")
    return template_id


def test_templates_are_read_from_and_deleted_in_the_configured_folder(tmp_path, monkeypatch) -> None:
    configured = tmp_path / "Lumina Studio Plus" / "3mf-templates"
    monkeypatch.setenv("LUMINA_CUSTOM_3MF_TEMPLATE_DIR", str(configured))
    monkeypatch.setenv("APPDATA", str(tmp_path / "official"))
    monkeypatch.setenv("XDG_DATA_HOME", str(tmp_path / "official"))
    template_id = _store_template(configured)

    assert [item["id"] for item in custom_3mf_templates.list_templates()] == [template_id]
    assert custom_3mf_templates.load_template(template_id)["printer"] == "A1"
    custom_3mf_templates.delete_template(template_id)
    assert not any(configured.iterdir())
    assert not (tmp_path / "official").exists(), "nothing is written to the default folder"


def test_without_the_setting_the_default_desktop_folder_is_used(tmp_path, monkeypatch) -> None:
    monkeypatch.delenv("LUMINA_CUSTOM_3MF_TEMPLATE_DIR", raising=False)
    monkeypatch.setenv("APPDATA", str(tmp_path))
    monkeypatch.setenv("XDG_DATA_HOME", str(tmp_path))
    from config import _desktop_user_data_dir

    assert custom_3mf_templates._root() == Path(_desktop_user_data_dir()) / "3mf-templates"
    assert str(custom_3mf_templates._root()).startswith(str(tmp_path))
