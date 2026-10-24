"""Write app/catalog.js and small previews from data/image.

Run from the repository root:

    python -m pip install pillow
    python app/build.py
"""

from __future__ import annotations

import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image, ImageFile, ImageOps

ImageFile.LOAD_TRUNCATED_IMAGES = True
Image.MAX_IMAGE_PIXELS = 500_000_000

ROOT = Path(__file__).resolve().parents[1]
IMAGE_ROOT = ROOT / "data" / "image"
APP = ROOT / "app"
THUMBS = APP / "thumbs"
PREVIEWS = APP / "previews"
CATALOG_PATH = APP / "catalog.js"

IMAGE_EXT = {".jpg", ".jpeg", ".tif", ".tiff", ".png", ".gif", ".webp"}
TIFF_EXT = {".tif", ".tiff"}
THUMB_EDGE = 480
PREVIEW_EDGE = 2000

INSTITUTIONS = {
    "escola-de-artes-visuais-do-parque-lage": {
        "name": "Escola de Artes Visuais do Parque Lage",
        "license": "Public domain. This work is not protected by copyright.",
    },
    "instituto-moreira-salles": {
        "name": "Instituto Moreira Salles",
        "license": "Public domain. This work is not protected by copyright.",
    },
    "museu-de-arte-contemporanea-da-universidade-de-sao-paulo": {
        "name": "Museu de Arte Contemporânea da Universidade de São Paulo",
        "license": "Public domain. This work is not protected by copyright.",
    },
    "museu-historico-nacional-ibram": {
        "name": "Museu Histórico Nacional/Ibram",
        "license": "Public domain. This work is not protected by copyright.",
    },
    "museu-paulista-da-usp": {
        "name": "Museu Paulista da USP",
        "license": "Public domain. This work is not protected by copyright.",
    },
}


def to_rgb(image: Image.Image) -> Image.Image:
    image = ImageOps.exif_transpose(image) or image
    if image.mode == "RGBA":
        background = Image.new("RGB", image.size, (255, 255, 255))
        background.paste(image, mask=image.getchannel("A"))
        return background
    if image.mode != "RGB":
        return image.convert("RGB")
    return image


def save_jpeg(source: Path, dest: Path, max_edge: int, quality: int) -> None:
    if dest.exists() and dest.stat().st_size > 0 and dest.stat().st_mtime >= source.stat().st_mtime:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        if image.format == "JPEG":
            image.draft("RGB", (max_edge, max_edge))
        rgb = to_rgb(image)
        rgb.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
        rgb.save(dest, "JPEG", quality=quality)


def make_derivatives(source: Path, thumb: Path, preview: Path | None) -> None:
    save_jpeg(source, thumb, THUMB_EDGE, 72)
    if preview is not None:
        save_jpeg(source, preview, PREVIEW_EDGE, 85)


def main() -> None:
    if not IMAGE_ROOT.is_dir():
        raise SystemExit(f"Missing image folder: {IMAGE_ROOT}")

    files = sorted(
        path for path in IMAGE_ROOT.rglob("*") if path.is_file() and path.suffix.lower() in IMAGE_EXT
    )
    items = []
    jobs = []
    thumb_keys: dict[str, Path] = {}

    for source in files:
        relative = source.relative_to(IMAGE_ROOT)
        slug = relative.parts[0]
        meta = INSTITUTIONS.get(slug)
        if meta is None:
            raise SystemExit(f"No institution entry for {slug}")

        is_tiff = source.suffix.lower() in TIFF_EXT
        thumb_relative = Path("thumbs") / relative.with_suffix(".jpg")
        thumb_key = str(thumb_relative).casefold()
        if thumb_key in thumb_keys:
            raise SystemExit(f"Thumbnail path collision: {thumb_relative}")
        thumb_keys[thumb_key] = source

        if is_tiff:
            src = (Path("previews") / relative.with_suffix(".jpg")).as_posix()
            preview = PREVIEWS / relative.with_suffix(".jpg")
        else:
            src = ("../data/image/" + relative.as_posix())
            preview = None

        items.append(
            {
                "id": relative.as_posix(),
                "src": src,
                "thumb": thumb_relative.as_posix(),
                "institution": meta["name"],
                "license": meta["license"],
                "filename": source.name,
            }
        )
        jobs.append((source, THUMBS / relative.with_suffix(".jpg"), preview))

    items.sort(key=lambda item: (item["institution"].casefold(), item["filename"].casefold()))
    payload = json.dumps(items, ensure_ascii=False, separators=(",", ":"))
    CATALOG_PATH.write_text(f"window.CATALOG = {payload};\n", encoding="utf-8")
    print(f"Wrote {CATALOG_PATH.name} with {len(items)} pictures", flush=True)

    failures = []
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {pool.submit(make_derivatives, *job): job[0] for job in jobs}
        done = 0
        total = len(futures)
        for future in as_completed(futures):
            done += 1
            source = futures[future]
            try:
                future.result()
            except Exception as error:  # noqa: BLE001 - report and continue
                failures.append(f"{source}: {error}")
                print(f"FAILED {source}: {error}", flush=True)
            if done % 50 == 0 or done == total:
                print(f"{done}/{total}", flush=True)

    if failures:
        print(f"{len(failures)} pictures could not be previewed", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
