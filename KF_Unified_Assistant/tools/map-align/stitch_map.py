"""Stitch shared rectangular edges, then rectify the current artwork to its passages.

Run from KF_Unified_Assistant/:
  python tools/map-align/stitch_map.py --source-dir PATH/TO/BACKUP/faces
Requires NumPy and Pillow. Source artwork is read-only and may live outside the
project. Generated faces live in public/assets/map/aligned/; layout and marker
coordinates share the same mesh. Never rectify the active corrected faces again.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image

import align_map as legacy

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"
LAYOUT = PUBLIC / "modules/map/data/map-layout.js"
SIDES = ("left", "right", "top", "bottom")


def read_layout(path):
    return json.loads(path.read_text(encoding="utf-8").removeprefix("window.KF_MAP_LAYOUT=").rstrip(";\r\n"))


def original_face_path(tile, source_dir=None):
    if source_dir is not None:
        name = f"{tile.code.lower()}-tile-{tile.raw['size'].lower()}-{tile.raw['number']}-face.webp"
        path = source_dir / name
    else:
        path = PUBLIC / tile.raw["image"]["face"].lstrip("/")
        if path.resolve().parent == (PUBLIC / "assets/map/aligned").resolve():
            raise ValueError("Active map faces are already corrected. Supply --source-dir pointing to the original-image backup; refusing to rectify them twice.")
    if not path.is_file():
        raise FileNotFoundError(f"Original map face missing: {path}")
    return path


def bounds(tile, layout):
    item = layout["tiles"][tile.id]
    w, h = (item["height"], item["width"]) if abs(tile.angle) == 90 else (item["width"], item["height"])
    return dict(left=item["x"] - w / 2, right=item["x"] + w / 2,
                top=item["y"] - h / 2, bottom=item["y"] + h / 2)


def contacts(tiles, boxes):
    result = []
    for i, a in enumerate(tiles):
        for b in tiles[i + 1:]:
            if a.code != b.code:
                continue
            for p, q in ((a, b), (b, a)):
                x, y = boxes[p.id], boxes[q.id]
                if abs(x["right"] - y["left"]) < .15 and min(x["bottom"], y["bottom"]) - max(x["top"], y["top"]) > .25:
                    result.append(dict(a=p.id, b=q.id, axis="v"))
                if abs(x["bottom"] - y["top"]) < .15 and min(x["right"], y["right"]) - max(x["left"], y["left"]) > .25:
                    result.append(dict(a=p.id, b=q.id, axis="h"))
    return result


def stitch_bounds(tiles, initial, shared):
    """Union shared edge coordinates first; dimensions never compete with a seam."""
    parent = {(t.id, s): (t.id, s) for t in tiles for s in SIDES}

    def find(k):
        while parent[k] != k:
            parent[k] = parent[parent[k]]
            k = parent[k]
        return k

    def union(a, b):
        parent[find(a)] = find(b)

    for c in shared:
        a, b = c["a"], c["b"]
        union((a, "right" if c["axis"] == "v" else "bottom"), (b, "left" if c["axis"] == "v" else "top"))
        along = ("top", "bottom") if c["axis"] == "v" else ("left", "right")
        for sa in along:
            for sb in along:
                if abs(initial[a][sa] - initial[b][sb]) < .12:
                    union((a, sa), (b, sb))

    # Printed cards have integral map-unit dimensions. Solve each connected
    # component with exact edge/dimension equations and only translate it to
    # the old layout. This also removes tiny four-card corner slivers.
    graph = {}
    for t in tiles:
        for lo, hi, size in (("left", "right", t.W), ("top", "bottom", t.H)):
            a, b, length = find((t.id, lo)), find((t.id, hi)), round(size)
            graph.setdefault(a, []).append((b, length))
            graph.setdefault(b, []).append((a, -length))
    solved = {}
    for seed in graph:
        if seed in solved:
            continue
        offset, stack = {seed: 0.0}, [seed]
        while stack:
            a = stack.pop()
            for b, delta in graph[a]:
                value = offset[a] + delta
                if b in offset:
                    if abs(offset[b] - value) > 1e-8:
                        raise ValueError(f"Inconsistent shared-edge topology: {a}, {b}")
                else:
                    offset[b] = value
                    stack.append(b)
        priors = [initial[t.id][s] - offset[find((t.id, s))]
                  for t in tiles for s in SIDES if find((t.id, s)) in offset]
        translation = round(float(np.mean(priors)), 6)
        solved.update({key: value + translation for key, value in offset.items()})
    return {t.id: {s: round(solved[find((t.id, s))], 6) for s in SIDES} for t in tiles}


def local_point(tile, box, x, y):
    cx, cy = (box["left"] + box["right"]) / 2, (box["top"] + box["bottom"]) / 2
    dx, dy = legacy.rot(x - cx, y - cy, -tile.angle)
    w, h = box["right"] - box["left"], box["bottom"] - box["top"]
    if abs(tile.angle) == 90:
        w, h = h, w
    return np.array([dx / w + .5, dy / h + .5])


def source_point(edge, candidate, detection):
    w, h = detection["imageSize"]
    along = candidate["center"] / ((w - 1) if edge in ("top", "bottom") else (h - 1))
    return np.array({"top": [along, 0], "bottom": [along, 1], "left": [0, along], "right": [1, along]}[edge])


def refine_edge_centers(path, detection):
    """Measure the bar at the actual boundary, not its average 5–30px inside.
    A valid bar has strong dark flanks; nearby pale terrain must not win just
    because it happens to be closer to the other tile's old position.
    """
    with Image.open(path) as opened:
        arr = np.asarray(opened.convert("RGB")).astype(float)
    for edge in legacy.EDGES:
        for candidate in detection["edges"][edge]:
            if candidate["support"] < .2:
                continue
            hits = []
            for depth in range(6):
                rgb = legacy.edge_lines(arr, edge, depth)
                gray, sat = rgb.mean(axis=1), np.ptp(rgb, axis=1)
                choices = []
                for a, b in legacy.runs((gray > 175) & (sat < 70)):
                    center = (a+b-1)/2
                    if 2 <= b-a <= 16 and abs(center-candidate["center"]) <= 10:
                        left = gray[max(0, a-4):a].min(initial=255)
                        right = gray[b:b+4].min(initial=255)
                        if left < 70 and right < 70:
                            choices.append((abs(center-candidate["center"]), center))
                if choices:
                    hits.append((depth, min(choices)[1]))
            near = [center for depth, center in hits if depth <= 2]
            if len(near) >= 2:
                candidate["center"] = float(np.median(near))
            elif len(hits) >= 3:
                candidate["center"] = float(np.median([center for _, center in hits]))


def pick_pair(a, b, axis, initial, detections):
    direction = "E" if axis == "v" else "S"
    edges = [next(e for e, d in legacy.EDGE_TO_DIR[t.angle].items() if d == dr)
             for t, dr in ((a, direction), (b, legacy.OPP[direction]))]
    choices = []
    for t, edge, other in ((a, edges[0], b), (b, edges[1], a)):
        candidates = []
        for c in detections[t.id]["edges"][edge]:
            if c["support"] < .2 or c["nearEdge"] < 2:
                continue
            pt = source_point(edge, c, detections[t.id])
            w, h = t.uw, t.uh
            dx, dy = legacy.rot((pt[0] - .5) * w, (pt[1] - .5) * h, t.angle)
            box, target = initial[t.id], initial[other.id]
            along = (box["top"] + box["bottom"]) / 2 + dy if axis == "v" else (box["left"] + box["right"]) / 2 + dx
            lo, hi = ("top", "bottom") if axis == "v" else ("left", "right")
            if target[lo] - .08 <= along <= target[hi] + .08:
                candidates.append((c, pt, along))
        choices.append(candidates)
    pairs = [(abs(ca[2] - cb[2]) + .3 * (2 - ca[0]["support"] - cb[0]["support"])
              + .02 * (14 - ca[0]["nearEdge"] - cb[0]["nearEdge"]), ca, cb)
             for ca in choices[0] for cb in choices[1] if abs(ca[2] - cb[2]) < .3]
    if not pairs:
        raise ValueError(f"No reliable passage pair: {a.id} / {b.id} ({edges})")
    _, ca, cb = min(pairs, key=lambda value: value[0])
    return edges, ca, cb


def homography(source, target):
    rows, rhs = [], []
    for (x, y), (u, v) in zip(source, target):
        rows += [[x, y, 1, 0, 0, 0, -u*x, -u*y], [0, 0, 0, x, y, 1, -v*x, -v*y]]
        rhs += [u, v]
    coefficients = np.linalg.lstsq(np.asarray(rows), np.asarray(rhs), rcond=None)[0]
    return np.append(coefficients, 1).reshape(3, 3)


def project(matrix, point):
    value = matrix @ np.array([*point, 1.0])
    return value[:2] / value[2]


def mesh_for(anchors):
    """Perspective fit plus a boundary residual mesh: corners stay rectangular,
    every detected exit lands exactly on its common passage, and all triangles
    share identical edge interpolation (no seams inside the corrected image).
    """
    corners = [np.array(p, dtype=float) for p in ((0, 0), (1, 0), (0, 1), (1, 1))]
    source = corners + [a[0] for a in anchors]
    target = corners + [a[1] for a in anchors]
    matrix = homography(source, target)
    boundaries = {}
    for edge in legacy.EDGES:
        along = 0 if edge in ("top", "bottom") else 1
        fixed = 1 - along
        value = 0 if edge in ("top", "left") else 1
        pts = sorted([(s[along], d) for s, d in zip(source, target) if abs(s[fixed] - value) < 1e-8], key=lambda p: p[0])
        if any(b[1][along] - a[1][along] <= 0 for a, b in zip(pts, pts[1:])):
            raise ValueError(f"Non-monotone {edge} passage correction")
        boundaries[edge] = pts

    def edge_target(edge, t):
        pts = boundaries[edge]
        return np.array([np.interp(t, [p[0] for p in pts], [p[1][k] for p in pts]) for k in (0, 1)])

    def residual(edge, point, t):
        return edge_target(edge, t) - project(matrix, point)

    corner_residuals = [c - project(matrix, c) for c in corners]
    xs = sorted({round(float(x), 9) for x in [0, .25, .5, .75, 1] + [s[0] for s in source]})
    ys = sorted({round(float(y), 9) for y in [0, .25, .5, .75, 1] + [s[1] for s in source]})
    points = []
    for y in ys:
        for x in xs:
            bilinear = ((1-x)*(1-y)*corner_residuals[0] + x*(1-y)*corner_residuals[1]
                        + (1-x)*y*corner_residuals[2] + x*y*corner_residuals[3])
            p = (project(matrix, (x, y)) + (1-y)*residual("top", (x, 0), x)
                 + y*residual("bottom", (x, 1), x) + (1-x)*residual("left", (0, y), y)
                 + x*residual("right", (1, y), y) - bilinear)
            points.append([round(float(v), 9) for v in p])
    mesh = {"x": xs, "y": ys, "points": points}
    for src, dst in triangles(mesh):
        if np.linalg.det(np.array([dst[1]-dst[0], dst[2]-dst[0]])) <= 1e-10:
            raise ValueError("Folded rectification mesh")
    return mesh


def triangles(mesh):
    xs, ys, pts = mesh["x"], mesh["y"], np.asarray(mesh["points"])
    n = len(xs)
    for j in range(len(ys)-1):
        for i in range(n-1):
            source = np.array([[xs[i], ys[j]], [xs[i+1], ys[j]], [xs[i], ys[j+1]], [xs[i+1], ys[j+1]]])
            target = pts[[j*n+i, j*n+i+1, (j+1)*n+i, (j+1)*n+i+1]]
            for indices in ([0, 1, 3], [0, 3, 2]):
                yield source[indices], target[indices]


def transform_face(source_path, output_path, mesh):
    with Image.open(source_path) as opened:
        source = opened.convert("RGB")
    w, h = source.size
    # Bicubic samples at a rectified boundary may reach outside by a fraction
    # of a pixel. Extend the edge colors so resampling never introduces black.
    padded = Image.fromarray(np.pad(np.asarray(source), ((2, 2), (2, 2), (0, 0)), mode="edge"))
    result = Image.new("RGB", source.size, (255, 0, 255))
    coverage = Image.new("1", source.size)
    for src, dst in triangles(mesh):
        src = src * [w-1, h-1] + 2
        dst = dst * [w-1, h-1]
        lo = np.maximum(np.floor(dst.min(axis=0)).astype(int)-1, 0)
        hi = np.minimum(np.ceil(dst.max(axis=0)).astype(int)+2, [w, h])
        size = tuple((hi-lo).tolist())
        local = dst-lo
        coefficients = np.linalg.solve(np.column_stack((local, np.ones(3))), src).T.flatten()
        patch = padded.transform(size, Image.Transform.AFFINE, tuple(coefficients), Image.Resampling.BICUBIC)
        # Rasterize in the same floating-point coordinate system as the mesh.
        # Rounding polygon vertices separately can leave single-pixel pinholes.
        yy, xx = np.mgrid[0:size[1], 0:size[0]]
        a, b, c = local
        denominator = (b[1]-c[1])*(a[0]-c[0]) + (c[0]-b[0])*(a[1]-c[1])
        wa = ((b[1]-c[1])*(xx-c[0]) + (c[0]-b[0])*(yy-c[1])) / denominator
        wb = ((c[1]-a[1])*(xx-c[0]) + (a[0]-c[0])*(yy-c[1])) / denominator
        mask = Image.fromarray(((wa >= -1e-8) & (wb >= -1e-8) & (wa+wb <= 1+1e-8)).astype(np.uint8)*255)
        result.paste(patch, tuple(lo), mask)
        coverage.paste(1, tuple(lo), mask)
    if not np.asarray(coverage).all():
        raise ValueError(f"Uncovered pixels: {source_path}")
    temporary = output_path.with_suffix(".tmp")
    result.save(temporary, format="WEBP", lossless=True, method=1)
    temporary.replace(output_path)


def build(args):
    maps = legacy.load_maps()
    tiles = [legacy.Tile(t, code) for code, k in maps.items() for t in k["tiles"]]
    by_id = {t.id: t for t in tiles}
    old = read_layout(args.layout)
    initial = {t.id: bounds(t, old) for t in tiles}
    shared = contacts(tiles, initial)
    boxes = stitch_bounds(tiles, initial, shared)
    for i, a in enumerate(tiles):
        for b in tiles[i+1:]:
            if a.code != b.code:
                continue
            x, y = boxes[a.id], boxes[b.id]
            if min(x["right"], y["right"])-max(x["left"], y["left"]) > 1e-8 and min(x["bottom"], y["bottom"])-max(x["top"], y["top"]) > 1e-8:
                raise ValueError(f"Tiles overlap: {a.id} / {b.id}")
    detections = {}
    paths = {}
    for t in tiles:
        paths[t.id] = original_face_path(t, args.source_dir)
        detections[t.id] = legacy.detect_tile(paths[t.id], t.raw)
        refine_edge_centers(paths[t.id], detections[t.id])
    anchors = {t.id: [] for t in tiles}
    passages, report = [], []
    for c in shared:
        a, b = by_id[c["a"]], by_id[c["b"]]
        if b.id not in a.raw["neighbors"] and a.id not in b.raw["neighbors"]:
            continue
        edges, ca, cb = pick_pair(a, b, c["axis"], initial, detections)
        edge_a, edge_b = edges
        axis = c["axis"]
        alongs = []
        for t, edge, candidate in ((a, edge_a, ca), (b, edge_b, cb)):
            pt = candidate[1]
            box = boxes[t.id]
            # Preserve the printed fraction within the newly snapped rectangle.
            w, h = box["right"]-box["left"], box["bottom"]-box["top"]
            uw, uh = (h, w) if abs(t.angle) == 90 else (w, h)
            dx, dy = legacy.rot((pt[0]-.5)*uw, (pt[1]-.5)*uh, t.angle)
            alongs.append((box["top"]+box["bottom"])/2 + dy if axis == "v" else (box["left"]+box["right"])/2 + dx)
        along = float(np.mean(alongs))
        x, y = (boxes[a.id]["right"], along) if axis == "v" else (along, boxes[a.id]["bottom"])
        for t, candidate in ((a, ca), (b, cb)):
            target = local_point(t, boxes[t.id], x, y)
            if target.min() < -1e-8 or target.max() > 1+1e-8:
                raise ValueError(f"Passage outside shared edge: {a.id} / {b.id}")
            anchors[t.id].append((candidate[1], target))
        passage = dict(a=a.id, b=b.id, x=round(x, 9), y=round(y, 9), axis=axis,
                       sourceA=[round(float(v), 9) for v in ca[1]], sourceB=[round(float(v), 9) for v in cb[1]])
        passages.append(passage)
        report.append({**passage, "sourceA": ca[1].tolist(), "sourceB": cb[1].tolist(),
                       "beforeMisalignmentPx": abs(alongs[0]-alongs[1])*legacy.PX_PER_UNIT})
    if len(passages) != len(old["passages"]):
        raise ValueError(f"Passage count changed: {len(old['passages'])} -> {len(passages)}")
    args.work.mkdir(parents=True, exist_ok=True)
    args.assets.mkdir(parents=True, exist_ok=True)
    output = dict(version=2, source="tools/map-align/stitch_map.py (shared edges; perspective + boundary mesh)",
                  pxPerUnit=legacy.PX_PER_UNIT, tiles={}, seams=shared, passages=passages)
    max_shift = 0
    jobs = []
    for t in sorted(tiles, key=lambda tile: tile.id):
        box = boxes[t.id]
        w, h = box["right"]-box["left"], box["bottom"]-box["top"]
        uw, uh = (h, w) if abs(t.angle) == 90 else (w, h)
        mesh = mesh_for(anchors[t.id])
        source_path = paths[t.id]
        digest = hashlib.sha256(b"perspective-boundary-mesh-v2"+source_path.read_bytes()+json.dumps(mesh, sort_keys=True).encode()).hexdigest()[:12]
        name = source_path.stem + "-" + digest + ".webp"
        destination = args.assets / name
        if not args.skip_images:
            valid = False
            if destination.exists():
                try:
                    with Image.open(destination) as cached:
                        cached.verify()
                        valid = cached.size == tuple(detections[t.id]["imageSize"])
                except (OSError, ValueError):
                    pass
            if not valid:
                jobs.append((source_path, destination, mesh))
        for src, dst in anchors[t.id]:
            max_shift = max(max_shift, float(np.linalg.norm((dst-src)*detections[t.id]["imageSize"])))
        output["tiles"][t.id] = dict(x=round((box["left"]+box["right"])/2, 6), y=round((box["top"]+box["bottom"])/2, 6),
                                     width=round(uw, 6), height=round(uh, 6), face="/"+destination.relative_to(PUBLIC).as_posix(), warp=mesh)
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda job: transform_face(*job), jobs))
    (args.work / "stitch-report.json").write_text(json.dumps(dict(seams=shared, passages=report, maxArtworkShiftPx=max_shift), ensure_ascii=False, indent=2), encoding="utf-8")
    args.layout.write_text("window.KF_MAP_LAYOUT="+json.dumps(output, ensure_ascii=False, separators=(",", ":"))+";\n", encoding="utf-8")
    print(f"{len(tiles)} tiles, {len(shared)} exact shared edges, {len(passages)} rectified passages; max artwork correction {max_shift:.2f}px")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--layout", type=Path, default=LAYOUT)
    parser.add_argument("--source-dir", type=Path, help="External backup directory containing the original uncorrected *-face.webp files")
    parser.add_argument("--assets", type=Path, default=PUBLIC / "assets/map/aligned")
    parser.add_argument("--work", type=Path, default=ROOT.parent / "output/map-stitch")
    parser.add_argument("--skip-images", action="store_true", help="Only regenerate layout/mesh metadata")
    build(parser.parse_args())
