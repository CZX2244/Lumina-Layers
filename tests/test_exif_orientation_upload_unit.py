"""EXIF-rotated uploads are processed upright, like browsers display them.

A phone photo stored as 300x100 with orientation 6 is shown as a 100x300
portrait. The crop dialog draws its box on that portrait, so the backend must
crop the same upright pixels instead of the stored landscape ones.
带 EXIF 旋转标记的照片按浏览器显示的方向处理。
"""

from __future__ import annotations

import asyncio
import io
import os
from pathlib import Path

from fastapi import UploadFile
from fastapi.testclient import TestClient
from PIL import Image

from api.app import app
from api.file_bridge import ensure_png_tempfile

client = TestClient(app)
BLUE = (30, 30, 200)
RED = (200, 30, 30)


def _rotated_phone_jpeg() -> bytes:
    """Stored 300x100 with a blue band on the left; orientation 6 shows it as a portrait with the band on top."""
    image = Image.new("RGB", (300, 100), RED)
    image.paste(BLUE, (0, 0, 60, 100))
    exif = Image.Exif()
    exif[0x0112] = 6
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=95, exif=exif.tobytes())
    return buffer.getvalue()


def _download(url: str) -> Image.Image:
    response = client.get(url)
    assert response.status_code == 200
    return Image.open(io.BytesIO(response.content)).convert("RGB")


def _close(colour: tuple[int, int, int], expected: tuple[int, int, int]) -> bool:
    return all(abs(a - b) <= 40 for a, b in zip(colour, expected))


def test_crop_of_rotated_photo_keeps_the_whole_upright_picture() -> None:
    response = client.post(
        "/api/convert/crop",
        files={"image": ("phone.jpg", _rotated_phone_jpeg(), "image/jpeg")},
        data={"x": "0", "y": "0", "width": "100", "height": "300"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert (body["width"], body["height"]) == (100, 300)
    cropped = _download(body["cropped_url"])
    assert cropped.size == (100, 300)
    assert _close(cropped.getpixel((50, 20)), BLUE), "the band on the left of the stored image is on top when upright"
    assert _close(cropped.getpixel((50, 250)), RED)


def _ensure(name: str, content: bytes, content_type: str) -> str:
    upload = UploadFile(file=io.BytesIO(content), filename=name, headers={"content-type": content_type})
    return asyncio.run(ensure_png_tempfile(upload))


def test_rotated_upload_is_stored_upright_and_unrotated_upload_is_untouched() -> None:
    rotated_path = _ensure("phone.jpg", _rotated_phone_jpeg(), "image/jpeg")
    try:
        with Image.open(rotated_path) as upright:
            assert upright.size == (100, 300)
            assert upright.getexif().get(0x0112, 1) == 1
    finally:
        os.unlink(rotated_path)

    plain = io.BytesIO()
    Image.new("RGBA", (40, 20), (10, 200, 10, 128)).save(plain, "PNG")
    plain_path = _ensure("plain.png", plain.getvalue(), "image/png")
    try:
        assert Path(plain_path).read_bytes() == plain.getvalue(), "files without a rotation tag are not re-encoded"
    finally:
        os.unlink(plain_path)


def test_rotated_png_with_transparency_keeps_its_alpha() -> None:
    image = Image.new("RGBA", (300, 100), (0, 0, 0, 0))
    image.paste((*BLUE, 255), (0, 0, 60, 100))
    exif = Image.Exif()
    exif[0x0112] = 6
    buffer = io.BytesIO()
    image.save(buffer, "PNG", exif=exif.tobytes())

    path = _ensure("sticker.png", buffer.getvalue(), "image/png")
    try:
        with Image.open(path) as upright:
            assert upright.size == (100, 300)
            assert upright.mode == "RGBA"
            assert upright.getpixel((50, 20))[3] == 255
            assert upright.getpixel((50, 250))[3] == 0
    finally:
        os.unlink(path)
