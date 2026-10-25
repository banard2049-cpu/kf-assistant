import json
import re
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont


FONT_PATH = Path(r"C:\Windows\Fonts\STXINGKA.TTF")
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "tmp" / "handwritten-brush-paths.json"
JS_OUTPUT_PATH = Path(__file__).resolve().parents[1] / "public" / "modules" / "encounter" / "encounter-brush-paths.js"
CHARACTERS = "FEN!粪这就是屎shi食尸十石师士世！"


def glyph_path(font, glyph_set, character):
    cmap = font.getBestCmap()
    glyph_name = cmap.get(ord(character))
    if not glyph_name:
        raise RuntimeError(f"Font does not contain {character!r}")
    glyph = glyph_set[glyph_name]
    bounds_pen = BoundsPen(glyph_set)
    glyph.draw(bounds_pen)
    if not bounds_pen.bounds:
        raise RuntimeError(f"Glyph {character!r} has no outline")
    x_min, y_min, x_max, y_max = bounds_pen.bounds
    width = max(1, x_max - x_min)
    height = max(1, y_max - y_min)
    scale = min(90 / width, 90 / height)
    translate_x = (100 - width * scale) / 2 - x_min * scale
    translate_y = (100 - height * scale) / 2 + y_max * scale
    pen = SVGPathPen(glyph_set)
    glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, translate_x, translate_y)))
    commands = pen.getCommands()
    return re.sub(
        r"-?\d+(?:\.\d+)?",
        lambda match: f"{float(match.group()):.2f}".rstrip("0").rstrip("."),
        commands,
    )


def main():
    font = TTFont(FONT_PATH)
    glyph_set = font.getGlyphSet()
    paths = {character: glyph_path(font, glyph_set, character) for character in dict.fromkeys(CHARACTERS)}
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(paths, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    JS_OUTPUT_PATH.write_text(
        "(() => {\n"
        '  "use strict";\n'
        "  window.KF_HANDWRITTEN_BRUSH_PATHS = Object.freeze("
        + json.dumps(paths, ensure_ascii=False, separators=(",", ":"))
        + ");\n"
        "})();\n",
        encoding="utf8",
    )
    print(f"Wrote {len(paths)} brush paths to {OUTPUT_PATH} and {JS_OUTPUT_PATH}")


if __name__ == "__main__":
    main()
