"""Extract all 22 monster sheets at native resolution from the supplied B2 PDF.

The input PDF is read-only. Embedded JPEGs are decoded once, cropped without
resizing, and saved as pixel-exact lossless WebP. The A4 title, white margins,
and printer's crop lines are excluded. Kingdom and trait pages are not changed.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import io
import json
from pathlib import Path

import fitz
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
# The printed vertical guides occupy source columns 888-890 and 7300-7302.
# Exclude their antialiased edges as well; do not rescale the remaining pixels.
CROP = (892, 1493, 7299, 5890)
SHEETS = [
    ("M_Ironcast", "ironcast", 3),
    ("M_Ratwolves", "ratwolves", 5),
    ("M_Pumpkinhead", "pumpkinhead", 7),
    ("M_FirstmenLictor", "firstmen-lictor-hunters", 9),
    ("M_FirstmenWarriors", "firstmen-warriors", 11),
    ("M_PalebloodWorms", "paleblood-worms", 13),
    ("M_HauntOf", "haunts-utrebant", 15),
    ("M_WingedNightmare", "winged-nightmare", 17),
    ("M_Panzergeists", "panzergeists", 19),
    ("M_Eggknight", "eggknight", 21),
    ("M_Stonemason", "stonemason", 23),
    ("M_WhiteApe", "white-ape", 25),
    ("M_KnightFen", "knight-fen", 27),
    ("M_BogWitch", "bog-witch", 29),
    ("M_Knighteater", "knighteater", 31),
    ("M_KingLaidLow", "king-laid-low", 33),
    ("M_PuppetKing", "puppet-king", 35),
    ("M_DevilSmeltedFears", "devil-smelted-fears", 37),
    ("M_DevilAncientDusk", "devil-ancient-dusk", 39),
    ("M_Panzerdragon", "panzerdragon", 41),
    ("M_Toadragon", "toadragon", 43),
    ("M_YoungDevour", "young-devour", 45),
]


def extract(source, destination, spec):
    monster_id, slug, page_number, side = spec
    with fitz.open(source) as document:
        page = document[page_number - 1]
        images = page.get_images(full=True)
        if len(images) != 1:
            raise ValueError(f"Page {page_number}: expected one embedded original")
        raw = document.extract_image(images[0][0])["image"]
    with Image.open(io.BytesIO(raw)) as original:
        if original.size != (9353, 6614):
            raise ValueError(f"Page {page_number}: unexpected source dimensions {original.size}")
        cropped = original.convert("RGB").crop(CROP)
    pixels_hash = hashlib.sha256(cropped.tobytes()).hexdigest()
    target = destination / f"{slug}-{side}.webp"
    cropped.save(target, format="WEBP", lossless=True, method=4, exact=True)
    with Image.open(target) as restored:
        if restored.size != cropped.size or hashlib.sha256(restored.convert("RGB").tobytes()).hexdigest() != pixels_hash:
            raise ValueError(f"Pixel verification failed: {target.name}")
    print(f"Verified page {page_number}: {target.name} {cropped.width}x{cropped.height}", flush=True)
    return {
        "monsterId": monster_id, "side": side, "page": page_number,
        "path": f"/assets/boss-panels/{target.name}",
        "sourceImageDimensions": [9353, 6614], "crop": list(CROP),
        "width": cropped.width, "height": cropped.height,
        "bytes": target.stat().st_size,
        "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
        "decodedPixelSHA256": pixels_hash, "pixelExact": True,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "public/assets/boss-panels")
    parser.add_argument("--report", type=Path, default=ROOT.parent / "output/boss-panel-extraction/extraction-report.json")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    jobs = [(mid, slug, page + offset, side) for mid, slug, page in SHEETS
            for offset, side in enumerate(("face", "back"))]
    with ThreadPoolExecutor(max_workers=2) as pool:
        rows = list(pool.map(lambda spec: extract(args.source, args.output, spec), jobs))
    report = {
        "source": args.source.name,
        "sourceSHA256": hashlib.sha256(args.source.read_bytes()).hexdigest(),
        "method": "Embedded original JPEG decode; native pixel crop; lossless WebP; no resampling",
        "monsterCount": len(SHEETS), "imageCount": len(rows), "images": rows,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(f"Complete: {len(rows)} verified images, {sum(row['bytes'] for row in rows):,} bytes", flush=True)


if __name__ == "__main__":
    main()
