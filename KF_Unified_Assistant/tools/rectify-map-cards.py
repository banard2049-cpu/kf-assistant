#!/usr/bin/env python3
"""Remove scanned map-card white borders by rectifying their printed perimeter.

Only white, neutral edge runs outside the artwork are fitted. Rounded corners
are excluded from the fit and left for a separate content repair. Originals
are read-only; PNG intermediates retain original dimensions and aspect ratios.
Requires Pillow, NumPy and SciPy.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import median_filter

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets" / "map"
OUTPUT = ROOT.parent / "output" / "map-corners" / "rectified"
CRITERIA = {"whiteMinChannel": 225, "whiteMaxChannelSpread": 20,
            "grayMinChannel": 215, "grayMaxChannelSpread": 25,
            "grayBoundaryContrastMustExceed": 40,
            "minimumSupportedRows": 50, "minimumSupportFraction": .05,
            "cornerExclusionPx": 40, "parallelMedianWindowPx": 15,
            "antialiasInsetPx": 1.0, "outputSize": "unchanged from original"}


def edge_strip(rgb: np.ndarray, side: str, depth: int = 40) -> np.ndarray:
    if side == "left":
        return rgb[:, :depth]
    if side == "right":
        return rgb[:, -depth:][:, ::-1]
    if side == "top":
        return np.swapaxes(rgb[:depth], 0, 1)
    return np.swapaxes(rgb[-depth:][::-1], 0, 1)


def fit_edge(rgb: np.ndarray, side: str, threshold: int = 225, spread: int = 20) -> dict:
    """Fit a straight exterior edge, excluding corner arcs and white symbols."""
    strip = edge_strip(rgb, side).astype(np.int16)
    # Filtering only parallel to the perimeter suppresses print grain without
    # smearing a 1-2px scan border into the card itself.
    filtered = median_filter(strip, size=(15, 1, 1), mode="nearest")
    white = (filtered.min(axis=2) >= threshold) & (np.ptp(filtered, axis=2) <= spread)
    runs = np.cumprod(white, axis=1).sum(axis=1).astype(float)
    n = len(runs)
    positions = np.arange(n, dtype=float)
    usable = (positions >= 40) & (positions < n - 40)
    # Deep pale illustrated fog is not an exterior scan strip.
    positive = usable & (runs > 0) & (runs < 16)
    support = int(positive.sum())
    fraction = support / max(1, int(usable.sum()))
    stats = {"support": support, "supportFraction": fraction,
             "maximumRun": int(runs[usable].max(initial=0)), "accepted": False}
    if support < 50 or fraction < .05:
        return stats
    x, y = positions[positive], runs[positive]
    # Robust fit: remove isolated pale art marks, retaining the long straight
    # white run consistent with the scan edge.
    keep = np.ones(len(x), dtype=bool)
    for _ in range(5):
        slope, intercept = np.polyfit(x[keep], y[keep], 1)
        residual = np.abs(y - (slope * x + intercept))
        mad = float(np.median(residual[keep]))
        next_keep = residual <= max(1.25, mad * 3)
        if next_keep.sum() < max(40, support * .6) or np.array_equal(keep, next_keep):
            break
        keep = next_keep
    residual = np.abs(y[keep] - (slope * x[keep] + intercept))
    error = float(np.median(residual))
    raw_ends = np.array([intercept, intercept + slope * (n - 1)])
    ends = np.clip(raw_ends, 0, 12)
    # A supported exterior needs a straight boundary. Large nonlinear runs are
    # likely pale image content, and must never be cropped automatically.
    if error > 1.25 or ends.max() < .3 or np.ptp(raw_ends) > 30:
        stats.update({"fitMedianAbsError": error, "reason": "not-straight-edge"})
        return stats
    stats.update({"accepted": True, "slope": float(slope),
                  "intercept": float(intercept), "fitMedianAbsError": error,
                  "rawInsets": raw_ends.tolist(),
                  "insets": (ends + 1.0).tolist()})
    return stats


def sustained_white_edge(image: Image.Image, side: str) -> bool:
    strip = edge_strip(np.asarray(image), side).astype(np.int16)
    filtered = median_filter(strip, size=(15, 1, 1), mode="nearest")
    white = (filtered.min(axis=2) >= 225) & (np.ptp(filtered, axis=2) <= 20)
    runs = np.cumprod(white, axis=1).sum(axis=1)[64:-64]
    positives = np.count_nonzero((runs > 0) & (runs < 16))
    return positives >= 50 and positives / max(1, len(runs)) >= .05


def boundary_contrast(rgb: np.ndarray, side: str) -> float:
    """Gray matte has a sharp brightness step; naturally pale fog does not."""
    strip = edge_strip(rgb, side).astype(np.int16)
    filtered = median_filter(strip, size=(15, 1, 1), mode="nearest")
    white = (filtered.min(axis=2) >= 215) & (np.ptp(filtered, axis=2) <= 25)
    runs = np.cumprod(white, axis=1).sum(axis=1)
    positions = np.arange(len(runs))
    usable = (positions >= 64) & (positions < len(runs) - 64) & (runs > 0) & (runs < 16)
    rows, ends = positions[usable], runs[usable]
    if not len(rows):
        return 0.0
    before = filtered[rows, 0].mean(axis=1)
    inside = filtered[rows, ends + 2].mean(axis=1)
    return float(np.median(before - inside))


def card_quad(w: int, h: int, edges: dict) -> np.ndarray:
    """Intersect fitted card edges to get TL, TR, BL, BR source coordinates."""
    pairs = {side: (np.array(item["insets"]) if item["accepted"] else np.zeros(2))
             for side, item in edges.items()}
    left, right, top, bottom = (pairs[x] for x in ("left", "right", "top", "bottom"))
    # Edge line represented by a*x + b*y = c.
    lines = {
        "left": (1, -(left[1] - left[0]) / (h - 1), left[0]),
        "right": (1, (right[1] - right[0]) / (h - 1), w - 1 - right[0]),
        "top": (-(top[1] - top[0]) / (w - 1), 1, top[0]),
        "bottom": ((bottom[1] - bottom[0]) / (w - 1), 1, h - 1 - bottom[0]),
    }
    points = []
    for a, b in (("left", "top"), ("right", "top"), ("left", "bottom"), ("right", "bottom")):
        la, lb = lines[a], lines[b]
        points.append(np.linalg.solve([la[:2], lb[:2]], [la[2], lb[2]]))
    return np.asarray(points)


def perspective_coefficients(w: int, h: int, quad: np.ndarray) -> tuple:
    dst = np.array([[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]], dtype=float)
    matrix, target = [], []
    for (x, y), (u, v) in zip(dst, quad):
        matrix.extend([[x, y, 1, 0, 0, 0, -u * x, -u * y],
                       [0, 0, 0, x, y, 1, -v * x, -v * y]])
        target.extend([u, v])
    return tuple(np.linalg.solve(np.asarray(matrix), np.asarray(target)))


def rectify(path: Path, output: Path, inset: float = 5.0) -> dict:
    with Image.open(path) as source:
        im = source.convert("RGB")
    w, h = im.size
    edges = {side: fit_edge(np.asarray(im), side) for side in ("left", "right", "top", "bottom")}
    for side, edge in edges.items():
        if edge["accepted"]:
            continue
        # A scan's white exterior can be gray after compression/lighting.
        # Accept its lower threshold only with a sharp, straight contrast
        # step against the artwork, protecting naturally pale printed fog.
        candidate = fit_edge(np.asarray(im), side, threshold=215, spread=25)
        if candidate["accepted"]:
            contrast = boundary_contrast(np.asarray(im), side)
            if contrast > 40:
                candidate["grayMatte"] = True
                candidate["boundaryContrast"] = contrast
                edges[side] = candidate
    active = [side for side, fit in edges.items() if fit["accepted"]]
    quad = card_quad(w, h, edges)
    coeffs = perspective_coefficients(w, h, quad)
    if active:
        result = im.transform(im.size, Image.Transform.PERSPECTIVE, coeffs,
                              resample=Image.Resampling.BICUBIC)
        # An exterior may grade from white to gray along the scan. Only after
        # a confirmed white-edge transform still leaves a sustained white
        # fringe, refit that same edge at a slightly lower threshold. This
        # cannot discover/crop pale artwork on an otherwise untouched side.
        refined = False
        for side in active:
            if not sustained_white_edge(result, side):
                continue
            candidate = fit_edge(np.asarray(im), side, threshold=215, spread=25)
            if candidate["accepted"] and max(candidate["insets"]) <= max(edges[side]["insets"]) + 3:
                candidate["refinedGrayMatte"] = True
                candidate["initialInsets"] = edges[side]["insets"]
                edges[side] = candidate
                refined = True
        if refined:
            quad = card_quad(w, h, edges)
            coeffs = perspective_coefficients(w, h, quad)
            result = im.transform(im.size, Image.Transform.PERSPECTIVE, coeffs,
                                  resample=Image.Resampling.BICUBIC)
    else:
        result = im
    base_quad, base_coeffs = quad.copy(), coeffs
    if inset:
        if inset < 0 or inset * 2 >= min(w - 1, h - 1):
            raise ValueError("Inset must be positive and smaller than half the card")
        # Sample a tighter rectangle in rectified coordinates, then compose
        # its map with the source homography. The final image is resampled
        # directly from the original exactly once, without a resize cascade.
        base_matrix = np.array([[coeffs[0], coeffs[1], coeffs[2]],
                                [coeffs[3], coeffs[4], coeffs[5]],
                                [coeffs[6], coeffs[7], 1.]])
        crop_matrix = np.array([[(w - 1 - inset * 2) / (w - 1), 0, inset],
                                [0, (h - 1 - inset * 2) / (h - 1), inset],
                                [0, 0, 1.]])
        final_matrix = base_matrix @ crop_matrix
        final_matrix /= final_matrix[2, 2]
        coeffs = tuple(final_matrix.ravel()[:8])
        destinations = np.array([[0, 0, 1], [w - 1, 0, 1],
                                 [0, h - 1, 1], [w - 1, h - 1, 1]]).T
        source_points = final_matrix @ destinations
        quad = (source_points[:2] / source_points[2]).T
        result = im.transform(im.size, Image.Transform.PERSPECTIVE, coeffs,
                              resample=Image.Resampling.BICUBIC)
    output.mkdir(parents=True, exist_ok=True)
    destination = output / (path.stem + ".png")
    result.save(destination, compress_level=3)
    return {"file": path.name, "size": [w, h], "output": destination.name,
            "sourceSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "transformed": bool(active) or bool(inset), "boundaryRectified": bool(active),
            "globalInsetPx": inset, "edges": edges, "quad": quad.tolist(),
            "perspective": list(coeffs), "boundaryQuad": base_quad.tolist(),
            "boundaryPerspective": list(base_coeffs)}


def diagnostics(files: list[dict], assets: Path, output: Path) -> None:
    selected = [f for f in files if f["transformed"]]
    if not selected:
        return
    selected = selected[:12]
    # The long white border is shown as an 8x enlarged edge strip on each side
    # of a full-card pair. Image area/perspective are also easy to compare.
    width, row_h = 1200, 310
    sheet = Image.new("RGB", (width, row_h * len(selected)), "#333333")
    draw = ImageDraw.Draw(sheet)
    for row, info in enumerate(selected):
        source = Image.open(assets / info["file"]).convert("RGB")
        result = Image.open(output / info["output"]).convert("RGB")
        sides = [k for k, v in info["edges"].items() if v["accepted"]]
        side = max(sides, key=lambda k: max(info["edges"][k]["insets"])) if sides else "left"
        draw.text((8, row * row_h + 4), info["file"] + " / " + side + " / before | after", fill="white")
        for col, image in enumerate((source, result)):
            thumb = image.copy()
            thumb.thumbnail((245, 275))
            sheet.paste(thumb, (12 + col * 300, row * row_h + 27))
            strip = edge_strip(np.asarray(image), side, 16)
            strip_im = Image.fromarray(strip).resize((128, 275))
            sheet.paste(strip_im, (700 + col * 180, row * row_h + 27))
    sheet.save(output.parent / "rectification-review.png")


def registration_deltas(results: list[dict], baseline: Path, output: Path) -> None:
    """Record an old-atlas sampling map when rectification changes afterwards."""
    old_files = {item["file"]: item for item in json.loads(baseline.read_text())["files"]}
    deltas = {}
    for item in results:
        old = old_files.get(item["file"])
        if old is None:
            continue
        def matrix(coeffs):
            return np.array([[coeffs[0], coeffs[1], coeffs[2]],
                             [coeffs[3], coeffs[4], coeffs[5]],
                             [coeffs[6], coeffs[7], 1.]])
        delta = np.linalg.inv(matrix(old["perspective"])) @ matrix(item["perspective"])
        delta /= delta[2, 2]
        deltas[item["file"]] = {"oldPerspective": old["perspective"],
                                "newPerspective": item["perspective"],
                                "oldRectifiedFromNewRectified": delta.tolist(),
                                "oldQuad": old["quad"], "newQuad": item["quad"]}
    for filename in ("registration-deltas.json", "gray-deltas.json"):
        (output / filename).write_text(json.dumps(deltas, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assets", type=Path, default=ASSETS)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--inset", type=float, default=5.0,
                        help="Additional inward crop on all four rectified edges (default: 5px)")
    parser.add_argument("--baseline", type=Path,
                        help="Earlier transforms.json for registering already-generated corners")
    parser.add_argument("--files", nargs="*", help="Optional original JPEG names for a pilot")
    args = parser.parse_args()
    files = ([args.assets / name for name in args.files] if args.files else sorted(args.assets.glob("*.jpg")))
    results = [rectify(path, args.output, args.inset) for path in files]
    report = {"method": "robust exterior white/gray edge fit; contrast validation; 1px inward antialias inset; perspective rectification",
              "criteria": CRITERIA,
              "globalInsetPx": args.inset,
              "boundaryRectifiedCount": sum(f["boundaryRectified"] for f in results),
              "count": len(results), "transformed": sum(f["transformed"] for f in results), "files": results}
    (args.output / "transforms.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    baseline = args.baseline or (args.output / "transforms-before-gray.json")
    if baseline.exists():
        registration_deltas(results, baseline, args.output)
    diagnostics(results, args.assets, args.output)
    print(f"Rectified {report['transformed']} of {report['count']} cards; originals unchanged; output {args.output}")


if __name__ == "__main__":
    main()
