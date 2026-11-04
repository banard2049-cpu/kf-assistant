"""Extract original, resolution-independent stat symbols from the Rulebook.

Usage: python tools/extract-aibp-stat-icons.py --source "path/to/Rulebook.pdf"
Uses the printed pages 17 and 46, not rasterized monster-panel crops. The paths
and fill rules are preserved, recolored gold, and normalized to a 64-unit square.
"""
import argparse
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/assets/aibp/stat-icons"
# The Vigor and Heat bounds exclude the colored square behind the white glyph.
SOURCES = {
    "hit": (46, (35.9, 748.5, 45.2, 757.8)),
    "wounds": (46, (35.9, 772.7, 45.2, 782.0)),
    "at": (46, (305.9, 144.4, 313.4, 153.8)),
    "evasion": (46, (306.3, 191.9, 315.0, 201.3)),
    "vigor-loss": (46, (306.9, 169.1, 313.9, 176.1)),
    "intensity": (17, (50.9, 635.2, 57.95, 642.2)),
}


def point(value):
    return f"{value.x:.6f},{value.y:.6f}"


def svg_path(drawing):
    commands = []
    current = None
    for kind, *values in drawing["items"]:
        if kind in ("l", "c"):
            start, end = values[0], values[-1]
            if current != start:
                commands.append("M" + point(start))
            commands.append(("L" + point(end)) if kind == "l" else ("C" + " ".join(point(p) for p in values[1:])))
            current = end
        elif kind == "re":
            rect = values[0]
            commands.append(f"M{point(rect.tl)} L{point(rect.tr)} L{point(rect.br)} L{point(rect.bl)} Z")
            current = None
        elif kind == "qu":
            quad = values[0]
            commands.append(f"M{point(quad.ul)} L{point(quad.ur)} L{point(quad.lr)} L{point(quad.ll)} Z")
            current = None
        else:
            raise ValueError(f"Unsupported PDF path operator: {kind}")
    if drawing.get("closePath"):
        commands.append("Z")
    rule = "evenodd" if drawing.get("even_odd") else "nonzero"
    return f'<path fill="#e2bd72" fill-rule="{rule}" d="{" ".join(commands)}"/>'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    args = parser.parse_args()
    document = fitz.open(args.source)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, (page, bounds) in SOURCES.items():
        area = fitz.Rect(bounds)
        drawings = [item for item in document[page - 1].get_drawings()
                    if item.get("fill") is not None and area.contains(item["rect"])]
        if not drawings:
            raise ValueError(f"No original vector glyph found for {name} on page {page}")
        rect = fitz.Rect(drawings[0]["rect"])
        for item in drawings[1:]:
            rect |= item["rect"]
        scale = 54 / max(rect.width, rect.height)
        cx, cy = (rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">'
               f'<g transform="translate(32 32) scale({scale:.9f}) translate({-cx:.6f} {-cy:.6f})">'
               + "".join(svg_path(item) for item in drawings) + "</g></svg>\n")
        (OUTPUT / f"{name}.svg").write_text(svg, encoding="utf-8")
    print(f"Extracted {len(SOURCES)} original vector stat icons to {OUTPUT}")


if __name__ == "__main__":
    main()
