"""Independently inspect rendered white passage bars at the actual image edges.

Run after stitch_map.py. Requires the local map assets; code-only geometry
checks live in tools/test-map-aligned-layout.js.
"""
import json
import numpy as np
from PIL import Image

import stitch_map as stitch


def check():
    layout = stitch.read_layout(stitch.LAYOUT)
    tiles = {t["id"]: stitch.legacy.Tile(t, code) for code, k in stitch.legacy.load_maps().items() for t in k["tiles"]}
    images = {}
    for tid, item in layout["tiles"].items():
        with Image.open(stitch.PUBLIC / item["face"].lstrip("/")) as opened:
            images[tid] = np.asarray(opened.convert("RGB").rotate(-tiles[tid].angle, expand=True)).astype(float)
    measured, unreadable = [], []
    for passage in layout["passages"]:
        positions = []
        for index, tid in enumerate((passage["a"], passage["b"])):
            box = stitch.bounds(tiles[tid], layout)
            arr = images[tid]
            h, w = arr.shape[:2]
            if passage["axis"] == "v":
                start, units, pixels = box["top"], box["bottom"]-box["top"], h
                expected = (passage["y"]-start)/units*(pixels-1)
                edge = "right" if index == 0 else "left"
            else:
                start, units, pixels = box["left"], box["right"]-box["left"], w
                expected = (passage["x"]-start)/units*(pixels-1)
                edge = "bottom" if index == 0 else "top"
            centers = []
            for depth in (0, 1, 2):
                rgb = stitch.legacy.edge_lines(arr, edge, depth)
                gray, sat = rgb.mean(axis=1), np.ptp(rgb, axis=1)
                candidates = []
                for a, b in stitch.legacy.runs((gray > 175) & (sat < 70)):
                    center = (a+b-1)/2
                    if (2 <= b-a <= 20 and abs(center-expected) < 15
                            and gray[max(0, a-4):a].min(initial=255) < 70
                            and gray[b:b+4].min(initial=255) < 70):
                        candidates.append(center)
                if candidates:
                    centers.append(min(candidates, key=lambda p: abs(p-expected)))
            if centers:
                positions.append(start+float(np.median(centers))/(pixels-1)*units)
            else:
                unreadable.append(dict(a=passage["a"], b=passage["b"], tile=tid))
        if len(positions) == 2:
            error = abs(positions[0]-positions[1])*stitch.legacy.PX_PER_UNIT
            measured.append(dict(a=passage["a"], b=passage["b"], errorPx=error))
    errors = np.array([m["errorPx"] for m in measured])
    result = dict(measured=len(measured), unreadable=unreadable,
                  medianPx=float(np.median(errors)), maximumPx=float(errors.max()),
                  worst=sorted(measured, key=lambda m: -m["errorPx"])[:10])
    output = stitch.ROOT.parent / "output/map-stitch/edge-pixel-check.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    assert len(measured) >= 150, "Too many actual white bars could not be inspected"
    assert errors.max() < 3, "Rendered passage bars still have a visible step"


if __name__ == "__main__":
    check()
