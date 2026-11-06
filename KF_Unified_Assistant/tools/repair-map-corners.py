#!/usr/bin/env python3
"""Prepare corner atlases and composite AI-filled corners without changing card art.

Source images are read-only. Repaired cards are written as lossless WebP.
Requires Pillow and NumPy. Run ``prepare`` before editing the four source atlases.
Use --extension png with rectified sources; --output-assets selects the final
map asset directory, whose repaired/ child receives the WebP files.
"""

from __future__ import annotations

import argparse
from collections import deque
import hashlib
import json
from pathlib import Path
import shutil

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ASSETS = ROOT / "public" / "assets" / "map"
DEFAULT_WORK = ROOT.parent / "output" / "map-corners"
CELL = 64
GRID = 16
CORNERS = ("top-left", "top-right", "bottom-left", "bottom-right")


def normalized_corner(image: Image.Image, corner: str) -> Image.Image:
    """Return a corner with the missing outer area at the upper left."""
    w, h = image.size
    right = corner.endswith("right")
    bottom = corner.startswith("bottom")
    x, y = (w - CELL if right else 0), (h - CELL if bottom else 0)
    crop = image.crop((x, y, x + CELL, y + CELL))
    if right:
        crop = crop.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    if bottom:
        crop = crop.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    return crop


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def corner_mask(crop: Image.Image) -> tuple[np.ndarray, dict]:
    """Select only the white matte connected to the outside corner.

    An 8-pixel transition includes JPEG/scan antialiasing, with a short
    feather at its outer edge. Rectify long white scan edges before this step.
    No mask is made for a corner whose actual art reaches the corner pixel.
    """
    rgb = np.asarray(crop).astype(np.int16)
    white = (rgb.min(axis=2) >= 238) & (np.ptp(rgb, axis=2) <= 20)
    core = np.zeros((CELL, CELL), dtype=bool)
    seed = (0, 0)
    seed_kind = "white-corner"
    if not white[0, 0]:
        # Rectification/JPEG ringing may leave a gray first pixel even though
        # its immediate neighbors still contain a clear, smooth white cap.
        corner_min = int(rgb[0, 0].min())
        corner_range = int(np.ptp(rgb[0, 0]))
        near_white = white[:4, :4]
        neutral = (rgb.min(axis=2) >= 225) & (np.ptp(rgb, axis=2) <= 25)
        if near_white.any():
            candidates = np.argwhere(near_white)
            sy, sx = min(candidates, key=lambda point: int(point.sum()))
            seed = (int(sx), int(sy))
            white[:4, :4] |= neutral[:4, :4]
            seed_kind = "nearby-white"
        elif corner_min >= 220 and corner_range <= 25:
            white[:4, :4] |= neutral[:4, :4]
            white[0, 0] = True
            seed_kind = "gray-antialias"
        else:
            return core.astype(np.uint8), {"reason": "art-at-corner", "corePixels": 0, "pixels": 0}
    if not white[seed[1], seed[0]]:
        return core.astype(np.uint8), {"reason": "art-at-corner", "corePixels": 0, "pixels": 0}
    pending = deque([seed])
    core[seed[1], seed[0]] = True
    while pending:
        x, y = pending.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < CELL and 0 <= ny < CELL and white[ny, nx] and not core[ny, nx]:
                core[ny, nx] = True
                pending.append((nx, ny))

    ys, xs = np.nonzero(core)
    width, height = int(xs.max()) + 1, int(ys.max()) + 1
    # Fill scan-compression holes in the outer matte. Do not stop at a gap in
    # a row or trim long components: every connected white core pixel must be
    # filled. Long components are flagged for visual review of pale map fog.
    contour = core.copy()
    row_ends = np.max(np.where(core, np.arange(CELL)[None, :] + 1, 0), axis=1)
    for y, end in enumerate(row_ends):
        if end > 0:
            contour[y, :int(end)] = True
    margin = Image.fromarray((contour * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(17))
    alpha = np.asarray(margin.filter(ImageFilter.GaussianBlur(.7))).copy()
    # Protect dark border strokes even if they sit immediately beside a cap.
    # Within 3px, dark curves can be scan shadows belonging to the round cap.
    near_core = np.asarray(Image.fromarray((contour * 255).astype(np.uint8))
                           .filter(ImageFilter.MaxFilter(7))) > 0
    alpha[~near_core & (rgb.mean(axis=2) < 130)] = 0
    alpha[core] = 255
    return alpha, {"reason": "rounded-matte", "corePixels": int(core.sum()),
                  "pixels": int(np.count_nonzero(alpha)), "width": width, "height": height,
                  "seed": seed_kind, "reviewLongComponent": width > 44 or height > 44}


def prepare(args: argparse.Namespace) -> None:
    args.work.mkdir(parents=True, exist_ok=True)
    (args.work / "atlases").mkdir(exist_ok=True)
    files = sorted(args.assets.glob(f"*.{args.extension}"))
    if not files:
        raise ValueError(f"No {args.extension} sources in {args.assets}")
    manifest = {"version": 1, "cell": CELL, "grid": GRID,
                "assets": str(args.assets.resolve()), "extension": args.extension,
                "sheets": {}, "files": {}}
    for kingdom in ("sk", "pos"):
        for side in ("face", "back"):
            name = f"{kingdom}-{side}"
            sheet = Image.new("RGB", (CELL * GRID, CELL * GRID), "#777777")
            entries = []
            for path in files:
                if not (path.name.startswith(kingdom + "-")
                        and path.name.endswith("-" + side + "." + args.extension)):
                    continue
                with Image.open(path) as source:
                    im = source.convert("RGB")
                manifest["files"][path.name] = {"size": list(im.size), "sha256": sha256(path)}
                for corner in CORNERS:
                    index = len(entries)
                    x, y = (index % GRID) * CELL, (index // GRID) * CELL
                    if y >= CELL * GRID:
                        raise ValueError(f"Too many corners for {name}")
                    sheet.paste(normalized_corner(im, corner), (x, y))
                    entries.append({"file": path.name, "corner": corner, "cell": index})
            destination = args.work / "atlases" / f"{name}.png"
            sheet.save(destination)
            manifest["sheets"][name] = {"source": str(destination.relative_to(args.work)), "entries": entries}
            print(f"{name}: {len(entries)} corners -> {destination}")
    (args.work / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def masks(args: argparse.Namespace) -> None:
    manifest_path = args.work / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    mask_dir = args.work / "masks"
    mask_dir.mkdir(exist_ok=True)
    totals = {"corners": 0, "repairedCorners": 0, "pixels": 0, "reviewLongComponents": []}
    for name, sheet_info in manifest["sheets"].items():
        with Image.open(args.work / sheet_info["source"]) as source:
            sheet = source.convert("RGB")
        mask_sheet = Image.new("L", sheet.size, 0)
        overlay = np.asarray(sheet).copy()
        for entry in sheet_info["entries"]:
            index = entry["cell"]
            x, y = (index % GRID) * CELL, (index // GRID) * CELL
            crop = sheet.crop((x, y, x + CELL, y + CELL))
            alpha, stats = corner_mask(crop)
            mask = alpha > 0
            entry["mask"] = stats
            mask_sheet.paste(Image.fromarray(alpha), (x, y))
            patch = overlay[y:y + CELL, x:x + CELL]
            patch[mask] = (patch[mask].astype(np.uint16) // 2 + np.array([127, 0, 90])).astype(np.uint8)
            totals["corners"] += 1
            totals["repairedCorners"] += int(stats["pixels"] > 0)
            totals["pixels"] += stats["pixels"]
            if stats.get("reviewLongComponent"):
                totals["reviewLongComponents"].append({"file": entry["file"], "corner": entry["corner"]})
        mask_sheet.save(mask_dir / f"{name}.png")
        Image.fromarray(overlay).save(mask_dir / f"{name}-overlay.png")
        sheet_info["mask"] = str((mask_dir / f"{name}.png").relative_to(args.work))
    manifest["maskTotals"] = totals
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(totals, indent=2))


def denormalize(array: np.ndarray, corner: str) -> np.ndarray:
    if corner.startswith("bottom"):
        array = np.flipud(array)
    if corner.endswith("right"):
        array = np.fliplr(array)
    return array


def perspective_matrix(values: list[float]) -> np.ndarray:
    return np.asarray([*values, 1.0], dtype=np.float64).reshape(3, 3)


def sample_patch(patch: np.ndarray, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    """Bilinear texture sampling, excluding generated cell-divider hairlines."""
    x, y = np.clip(x, 2, CELL - 3), np.clip(y, 2, CELL - 3)
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    x1, y1 = np.minimum(x0 + 1, CELL - 3), np.minimum(y0 + 1, CELL - 3)
    wx, wy = (x - x0)[:, :, None], (y - y0)[:, :, None]
    return np.rint(patch[y0, x0] * (1 - wx) * (1 - wy)
                   + patch[y0, x1] * wx * (1 - wy)
                   + patch[y1, x0] * (1 - wx) * wy
                   + patch[y1, x1] * wx * wy).astype(np.uint8)


def match_pale_fog(source: np.ndarray, patch: np.ndarray, alpha: np.ndarray) -> tuple[np.ndarray, bool]:
    """Match small generated patches to uniform pale fog surrounding a cap."""
    support = alpha > 0
    ring = np.asarray(Image.fromarray((support * 255).astype(np.uint8))
                      .filter(ImageFilter.MaxFilter(13))) > 0
    ring &= ~support
    strong = alpha >= 200
    if int(ring.sum()) < 16 or not strong.any():
        return patch, False
    colors = source[ring].astype(np.float64)
    target = np.median(colors, axis=0)
    current = np.median(patch[strong].astype(np.float64), axis=0)
    if (target.mean() < 195 or np.ptp(target) > 30
            or colors.mean(axis=1).std() > 22 or (target - current).mean() < 20):
        return patch, False
    delta = np.clip(target - current, -60, 60)
    return np.clip(np.rint(patch.astype(np.float64) + delta), 0, 255).astype(np.uint8), True


def register(args: argparse.Namespace) -> None:
    """Align generated corner textures when rectification changes afterward.

    Input perspective coefficients map rectified output pixels to original
    scan pixels. Thus inv(old) @ new maps new output pixels to old output.
    Original generated atlases are backed up once, making reruns idempotent.
    Run prepare/masks on frozen sources before register, then composite.
    """
    manifest_path = args.work / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    source_dir = Path(manifest["assets"])
    before_path = args.transforms_before or source_dir / "transforms-before-gray.json"
    after_path = args.transforms_after or source_dir / "transforms.json"
    before = json.loads(before_path.read_text(encoding="utf-8"))
    after = json.loads(after_path.read_text(encoding="utf-8"))
    old_files = {Path(item["file"]).stem: item for item in before["files"]}
    new_files = {Path(item["file"]).stem: item for item in after["files"]}
    backup_dir = args.work / "filled" / "before-registration"
    backup_dir.mkdir(parents=True, exist_ok=True)
    report = {"before": str(before_path), "after": str(after_path),
              "changedFiles": [], "registeredCorners": 0, "sheets": {}}
    yy, xx = np.indices((CELL, CELL), dtype=np.float64)
    changed_files = set()
    for name, info in manifest["sheets"].items():
        output_path = args.work / "filled" / f"{name}.png"
        backup_path = backup_dir / output_path.name
        if not backup_path.exists():
            shutil.copy2(output_path, backup_path)
        with Image.open(backup_path) as source:
            generated = source.convert("RGB")
        if generated.width != generated.height:
            raise ValueError(f"Generated atlas must remain square: {backup_path}")
        generated = generated.resize((GRID * CELL, GRID * CELL), Image.Resampling.LANCZOS)
        old_atlas = np.asarray(generated).astype(np.float64)
        aligned = np.asarray(generated).copy()
        for entry in info["entries"]:
            stem = Path(entry["file"]).stem
            old_item, new_item = old_files[stem], new_files[stem]
            delta = np.linalg.inv(perspective_matrix(old_item["perspective"])) @ perspective_matrix(new_item["perspective"])
            if not np.allclose(delta, np.eye(3), atol=1e-10):
                changed_files.add(entry["file"])
                report["registeredCorners"] += 1
            w, h = manifest["files"][entry["file"]]["size"]
            right, bottom = entry["corner"].endswith("right"), entry["corner"].startswith("bottom")
            gx, gy = (w - 1 - xx if right else xx), (h - 1 - yy if bottom else yy)
            coords = delta @ np.stack((gx, gy, np.ones_like(gx))).reshape(3, -1)
            ox = (coords[0] / coords[2]).reshape(CELL, CELL)
            oy = (coords[1] / coords[2]).reshape(CELL, CELL)
            u, v = (w - 1 - ox if right else ox), (h - 1 - oy if bottom else oy)
            index = entry["cell"]
            sx, sy = index % GRID * CELL, index // GRID * CELL
            patch = old_atlas[sy:sy + CELL, sx:sx + CELL]
            aligned[sy:sy + CELL, sx:sx + CELL] = sample_patch(patch, u, v)
        Image.fromarray(aligned).save(output_path)
        report["sheets"][name] = {"sourceSha256": sha256(backup_path),
                                  "registeredSha256": sha256(output_path)}
    report["changedFiles"] = sorted(changed_files)
    manifest["registration"] = report
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (args.work / "registration-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Registered {report['registeredCorners']} corners across {len(changed_files)} changed cards; "
          "original generated atlases preserved in filled/before-registration/.")


def composite(args: argparse.Namespace) -> None:
    manifest = json.loads((args.work / "manifest.json").read_text(encoding="utf-8"))
    source_dir = Path(manifest["assets"])
    output_assets = args.output_assets or args.assets
    output_dir = output_assets / "repaired"
    output_dir.mkdir(parents=True, exist_ok=True)
    cards = {}
    report = {"files": {}, "corners": 0, "changedPixels": 0, "fogColorMatched": 0}

    def card_for(filename: str) -> dict:
        if filename not in cards:
            source_path = source_dir / filename
            if sha256(source_path) != manifest["files"][filename]["sha256"]:
                raise ValueError(f"Source changed since prepare: {source_path}")
            with Image.open(source_path) as source:
                original = np.asarray(source.convert("RGB")).copy()
            cards[filename] = {"source": original, "result": original.copy(),
                               "mask": np.zeros(original.shape[:2], dtype=bool), "corners": []}
        return cards[filename]

    if args.include_unmasked:
        for filename in manifest["files"]:
            card_for(filename)
    for name, info in manifest["sheets"].items():
        filled_path = args.work / "filled" / f"{name}.png"
        with Image.open(filled_path) as source:
            generated = source.convert("RGB")
        if generated.width != generated.height:
            raise ValueError(f"Generated atlas must remain square: {filled_path}")
        if generated.size != (CELL * GRID, CELL * GRID):
            generated = generated.resize((CELL * GRID, CELL * GRID), Image.Resampling.LANCZOS)
        normalized_dir = args.work / "filled" / "normalized"
        normalized_dir.mkdir(exist_ok=True)
        generated.save(normalized_dir / f"{name}.png")
        filled = np.asarray(generated)
        with Image.open(args.work / info["mask"]) as source:
            sheet_alpha = np.asarray(source.convert("L"))
        for entry in info["entries"]:
            index = entry["cell"]
            x, y = (index % GRID) * CELL, (index // GRID) * CELL
            alpha = sheet_alpha[y:y + CELL, x:x + CELL]
            mask = alpha > 0
            if not mask.any():
                continue
            filename = entry["file"]
            card = card_for(filename)
            patch = filled[y:y + CELL, x:x + CELL].copy()
            # Image generation may draw a hairline at cell joins. Clamp the
            # outer two pixels to adjacent generated texture, before masking.
            if "registration" not in manifest:
                coords = np.clip(np.arange(CELL), 2, CELL - 3)
                patch = patch[coords[:, None], coords[None, :]]
            patch = denormalize(patch, entry["corner"])
            local_alpha = denormalize(alpha, entry["corner"]).astype(np.float64)[:, :, None] / 255
            local_mask = denormalize(mask, entry["corner"])
            h, w = card["result"].shape[:2]
            tx = w - CELL if entry["corner"].endswith("right") else 0
            ty = h - CELL if entry["corner"].startswith("bottom") else 0
            target = card["result"][ty:ty + CELL, tx:tx + CELL]
            patch, fog_matched = match_pale_fog(target, patch, denormalize(alpha, entry["corner"]))
            report["fogColorMatched"] += int(fog_matched)
            blended = np.rint(target.astype(np.float64) * (1 - local_alpha)
                             + patch.astype(np.float64) * local_alpha).astype(np.uint8)
            target[local_mask] = blended[local_mask]
            card["mask"][ty:ty + CELL, tx:tx + CELL] |= local_mask
            card["corners"].append(entry["corner"])
            report["corners"] += 1

    for filename, card in cards.items():
        path = output_dir / (Path(filename).stem + ".webp")
        Image.fromarray(card["result"]).save(path, format="WEBP", lossless=True, exact=True, method=3)
        with Image.open(path) as repaired:
            decoded = np.asarray(repaired.convert("RGB"))
        if not np.array_equal(decoded, card["result"]):
            raise AssertionError(f"WebP changed pixels: {path}")
        outside = ~card["mask"]
        if not np.array_equal(decoded[outside], card["source"][outside]):
            raise AssertionError(f"Unmasked source art changed: {path}")
        changed = int(np.any(decoded != card["source"], axis=2).sum())
        report["files"][filename] = {"output": str(path.relative_to(output_assets)),
                                      "corners": card["corners"], "changedPixels": changed,
                                      "maskedPixels": int(card["mask"].sum()), "sha256": sha256(path)}
        report["changedPixels"] += changed
    (args.work / "repair-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Wrote {len(cards)} lossless repaired cards; {report['corners']} corners; "
          f"{report['changedPixels']} changed pixels. All unmasked pixels verified identical.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("prepare", "masks", "register", "composite"))
    parser.add_argument("--assets", type=Path, default=DEFAULT_ASSETS)
    parser.add_argument("--extension", choices=("jpg", "png"), default="jpg",
                        help="Read one source format; use png for rectified cards")
    parser.add_argument("--output-assets", type=Path,
                        help="Final map asset root; repaired/ is created underneath it")
    parser.add_argument("--include-unmasked", action="store_true",
                        help="Also export geometry-corrected sources needing no corner fill")
    parser.add_argument("--transforms-before", type=Path,
                        help="Old rectification metadata for generated atlas registration")
    parser.add_argument("--transforms-after", type=Path,
                        help="Frozen rectification metadata for generated atlas registration")
    parser.add_argument("--work", type=Path, default=DEFAULT_WORK)
    args = parser.parse_args()
    if args.command == "prepare":
        prepare(args)
    elif args.command == "masks":
        masks(args)
    elif args.command == "composite":
        composite(args)
    elif args.command == "register":
        register(args)


if __name__ == "__main__":
    main()
