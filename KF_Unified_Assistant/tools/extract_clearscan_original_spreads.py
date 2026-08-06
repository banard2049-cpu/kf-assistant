from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

from PIL import Image


SPREAD_SPECS = {
    "ratwolves-sunken.jpg": ("sunken", (23, 24)),
    "ratwolves-stone.jpg": ("stone", (25, 26)),
    "winged-nightmare-sunken.jpg": ("sunken", (25, 26)),
    "winged-nightmare-stone.jpg": ("stone", (27, 28)),
    "pumpkinheads-sunken.jpg": ("sunken", (27, 28)),
    "pumpkinheads-stone.jpg": ("stone", (29, 30)),
    "knight-fen-sunken.jpg": ("sunken", (29, 30)),
    "knight-fen-stone.jpg": ("stone", (31, 32)),
    "paleblood-worms-sunken.jpg": ("sunken", (31, 32)),
    "paleblood-worms-stone.jpg": ("stone", (33, 34)),
    "firstmen-warriors.jpg": ("sunken", (33, 34)),
    "haunts-utrebant.jpg": ("sunken", (35, 36)),
    "white-ape-troll.jpg": ("sunken", (37, 38)),
    "king-laid-low.jpg": ("sunken", (39, 40)),
    "devil-ancient-dusk.jpg": ("sunken", (41, 42)),
    "toadragon.jpg": ("sunken", (43, 44)),
    "knighteater.jpg": ("fears", (39, 40)),
    "young-devour-dragon.jpg": ("fears", (41, 42)),
    "panzergeists.jpg": ("fears", (43, 44)),
    "stonemason-knight.jpg": ("fears", (45, 46)),
    "firstmen-lictor-hunters.jpg": ("fears", (47, 48)),
    "bog-witch.jpg": ("fears", (49, 50)),
    "ironcast-dead.jpg": ("stone", (35, 36)),
    "eggknight.jpg": ("stone", (37, 38)),
    "puppet-king-edelhardt.jpg": ("stone", (39, 40)),
    "devil-smelted-fears.jpg": ("stone", (41, 42)),
    "panzerdragon-veldr.jpg": ("stone", (43, 44)),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render original ClearScan clash spreads.")
    parser.add_argument("--sunken", type=Path, required=True)
    parser.add_argument("--stone", type=Path, required=True)
    parser.add_argument("--fears", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--work-dir", type=Path, required=True)
    parser.add_argument("--poppler", type=Path, required=True)
    parser.add_argument("--dpi", type=int, default=180)
    return parser.parse_args()


def render_page(poppler: Path, pdf: Path, page: int, dpi: int, output: Path) -> Path:
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

    for filename, (book, pages) in SPREAD_SPECS.items():
        rendered = []
        try:
            for page in pages:
                page_path = args.work_dir / f"{book}-{page}.png"
                render_page(args.poppler, sources[book], page, args.dpi, page_path)
                rendered.append(page_path)

            with Image.open(rendered[0]) as left_source, Image.open(rendered[1]) as right_source:
                left = left_source.convert("RGB")
                right = right_source.convert("RGB")
                height = max(left.height, right.height)
                spread = Image.new("RGB", (left.width + right.width, height), "white")
                spread.paste(left, (0, 0))
                spread.paste(right, (left.width, 0))
                spread.save(
                    args.output / filename,
                    "JPEG",
                    quality=92,
                    subsampling=0,
                    optimize=True,
                    progressive=True,
                )
                print(f"{filename}: {spread.width}x{spread.height}")
        finally:
            for page_path in rendered:
                page_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
