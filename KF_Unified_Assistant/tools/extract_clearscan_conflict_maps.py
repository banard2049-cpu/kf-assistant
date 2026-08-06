from __future__ import annotations

import argparse
import shutil
import subprocess
from collections import defaultdict
from pathlib import Path

from PIL import Image


# Crop boxes are normalized to the full PDF page after visual verification.
MAP_SPECS = {
    "ratwolves-sunken.jpg": ("sunken", 24, (0.071, 0.040, 0.849, 0.434)),
    "winged-nightmare-sunken.jpg": ("sunken", 25, (0.161, 0.602, 0.866, 0.958)),
    "pumpkinheads-sunken.jpg": ("sunken", 28, (0.105, 0.039, 0.879, 0.435)),
    "knight-fen-sunken.jpg": ("sunken", 30, (0.102, 0.568, 0.876, 0.958)),
    "paleblood-worms-sunken.jpg": ("sunken", 32, (0.038, 0.511, 0.931, 0.958)),
    "firstmen-warriors.jpg": ("sunken", 34, (0.091, 0.044, 0.866, 0.436)),
    "haunts-utrebant.jpg": ("sunken", 36, (0.086, 0.044, 0.862, 0.436)),
    "white-ape-troll.jpg": ("sunken", 38, (0.097, 0.565, 0.872, 0.952)),
    "king-laid-low.jpg": ("sunken", 39, (0.131, 0.566, 0.906, 0.950)),
    "devil-ancient-dusk-l1.jpg": ("sunken", 41, (0.370, 0.655, 0.967, 0.953)),
    "devil-ancient-dusk-l2.jpg": ("sunken", 42, (0.036, 0.655, 0.632, 0.953)),
    "toadragon.jpg": ("sunken", 44, (0.153, 0.042, 0.929, 0.435)),
    "ratwolves-stone.jpg": ("stone", 26, (0.045, 0.042, 0.939, 0.495)),
    "winged-nightmare-stone.jpg": ("stone", 27, (0.145, 0.598, 0.858, 0.957)),
    "pumpkinheads-stone.jpg": ("stone", 30, (0.045, 0.046, 0.940, 0.496)),
    "knight-fen-stone.jpg": ("stone", 32, (0.106, 0.568, 0.883, 0.957)),
    "paleblood-worms-stone.jpg": ("stone", 34, (0.043, 0.509, 0.938, 0.956)),
    "ironcast-dead.jpg": ("stone", 36, (0.042, 0.047, 0.937, 0.497)),
    "eggknight.jpg": ("stone", 38, (0.098, 0.579, 0.859, 0.957)),
    "puppet-king-edelhardt.jpg": ("stone", 39, (0.148, 0.600, 0.854, 0.953)),
    "devil-smelted-fears.jpg": ("stone", 42, (0.231, 0.044, 0.908, 0.387)),
    "panzerdragon-veldr.jpg": ("stone", 44, (0.040, 0.507, 0.932, 0.953)),
    "knighteater.jpg": ("fears", 40, (0.230, 0.041, 0.937, 0.399)),
    "young-devour-dragon.jpg": ("fears", 42, (0.092, 0.040, 0.869, 0.433)),
    "panzergeists.jpg": ("fears", 44, (0.089, 0.557, 0.868, 0.953)),
    "stonemason-knight.jpg": ("fears", 46, (0.089, 0.557, 0.868, 0.948)),
    "firstmen-lictor-hunters.jpg": ("fears", 47, (0.163, 0.616, 0.865, 0.968)),
    "bog-witch.jpg": ("fears", 49, (0.136, 0.565, 0.911, 0.952)),
}

ALIASES = {
    "ratwolves.jpg": "ratwolves-sunken.jpg",
    "winged-nightmare.jpg": "winged-nightmare-sunken.jpg",
    "pumpkinheads.jpg": "pumpkinheads-sunken.jpg",
    "knight-fen.jpg": "knight-fen-sunken.jpg",
    "paleblood-worms.jpg": "paleblood-worms-sunken.jpg",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract conflict maps from ClearScan PDFs.")
    parser.add_argument("--sunken", type=Path, required=True)
    parser.add_argument("--stone", type=Path, required=True)
    parser.add_argument("--fears", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--work-dir", type=Path, required=True)
    parser.add_argument("--poppler", type=Path, required=True)
    parser.add_argument("--dpi", type=int, default=400)
    return parser.parse_args()


def render_page(poppler: Path, pdf: Path, page: int, dpi: int, output: Path) -> Path:
    output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            str(poppler), "-f", str(page), "-l", str(page), "-r", str(dpi),
            "-singlefile", "-png", str(pdf), str(output.with_suffix("")),
        ],
        check=True,
    )
    return output


def main() -> None:
    args = parse_args()
    sources = {"sunken": args.sunken, "stone": args.stone, "fears": args.fears}
    for source in sources.values():
        if not source.is_file():
            raise FileNotFoundError(source)

    args.output.mkdir(parents=True, exist_ok=True)
    args.work_dir.mkdir(parents=True, exist_ok=True)
    grouped: dict[tuple[str, int], list[tuple[str, tuple[float, float, float, float]]]] = defaultdict(list)
    for filename, (book, page, box) in MAP_SPECS.items():
        grouped[(book, page)].append((filename, box))

    for (book, page), maps in grouped.items():
        rendered = args.work_dir / f"{book}-{page}.png"
        render_page(args.poppler, sources[book], page, args.dpi, rendered)
        try:
            with Image.open(rendered) as page_image:
                page_image = page_image.convert("RGB")
                width, height = page_image.size
                for filename, box in maps:
                    left, top, right, bottom = box
                    pixels = (
                        round(left * width), round(top * height),
                        round(right * width), round(bottom * height),
                    )
                    crop = page_image.crop(pixels)
                    crop.save(
                        args.output / filename,
                        "JPEG",
                        quality=94,
                        subsampling=0,
                        optimize=True,
                    )
                    print(f"{filename}: {crop.width}x{crop.height}")
        finally:
            rendered.unlink(missing_ok=True)

    for alias, source in ALIASES.items():
        shutil.copyfile(args.output / source, args.output / alias)


if __name__ == "__main__":
    main()
