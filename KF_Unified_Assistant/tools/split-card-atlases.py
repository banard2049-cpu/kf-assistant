"""Extract referenced card cells with jpegtran, preserving native pixels and crop geometry.

Cards that already carry a `<side>Crop` are skipped, so a normal re-run is a no-op.
The faces listed in tools/localized-card-assets.json are Chinese replacements for
English scans: they are never re-extracted, and a from-scratch data rebuild gets
their full-bleed geometry back instead of the atlas crop. The script stops when one
of those files no longer matches its recorded sha256.

Run --apply first, verify the application, then use --delete-sources to remove
unreferenced atlases. Already extracted sides and standalone artwork are reused.
"""

import argparse
import collections
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
OUTPUT = ROOT / "output/full-card-split"
LOCALIZED = ROOT / "tools/localized-card-assets.json"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def load_data(relative):
    path = PUBLIC / relative
    raw = path.read_bytes()
    text = raw.decode("utf-8-sig")
    prefix = text.split("=", 1)[0] if path.suffix == ".js" else None
    value = text.split("=", 1)[1].strip().rstrip(";") if prefix else text
    return {"path": path, "raw": raw, "prefix": prefix, "data": json.loads(value)}


def save_data(record):
    assert record["path"].read_bytes() == record["raw"], f'Concurrent change: {record["path"]}'
    if record["prefix"] is not None:
        text = record["prefix"] + "=" + json.dumps(record["data"], ensure_ascii=False, separators=(",", ":")) + ";\n"
    else:
        text = json.dumps(record["data"], ensure_ascii=False, indent=2) + "\n"
    record["path"].write_text(text, encoding="utf-8-sig" if record["raw"].startswith(b"\xef\xbb\xbf") else "utf-8")


def public_path(value):
    value = value.split("?", 1)[0].split("#", 1)[0]
    path = (PUBLIC / value.lstrip("/")).resolve()
    assert path.is_relative_to((PUBLIC / "assets").resolve()), value
    return path


def load_localized():
    """中文卡面清单：这些路径已换成中文卡，重新切图时必须保留。"""
    document = json.loads(LOCALIZED.read_text(encoding="utf-8"))
    assets = {}
    for entry in document["assets"]:
        path = public_path(entry["face"])
        assert path.is_file(), f'Missing localized card face: {entry["face"]}'
        actual = digest(path.read_bytes())
        assert actual == entry["sha256"], (
            f'Localized card face changed: {entry["face"]}\n'
            f'  manifest sha256: {entry["sha256"]}\n'
            f'  on-disk sha256:  {actual}\n'
            "Restore the card, or update tools/localized-card-assets.json on purpose."
        )
        assets[entry["face"]] = entry
    return assets


def delete_sources():
    report = json.loads((OUTPUT / "manifest.json").read_text(encoding="utf-8"))
    sources = [s for s in report["sources"] if public_path(s["source"]).exists()]
    texts = []
    for file in PUBLIC.rglob("*"):
        if file.is_file() and file.suffix in {".js", ".json", ".html", ".css", ".php"}:
            texts.append((file, file.read_text(encoding="utf-8-sig", errors="replace")))
    for source in sources:
        path = public_path(source["source"])
        assert digest(path.read_bytes()) == source["sha256"], f"Source changed: {path}"
        for file, text in texts:
            assert source["source"] not in text, f"Still referenced by {file}: {path}"
    for image in report["images"]:
        assert public_path(image["target"]).is_file(), image["target"]
    for source in sources:
        public_path(source["source"]).unlink()
    report["sourceAtlasesRemoved"] = True
    (OUTPUT / "manifest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Removed {len(sources)} unreferenced source atlases.", flush=True)


def split_cards(jpegtran, apply):
    records = {key: load_data(relative) for key, relative in {
        "aibp": "modules/aibp/data/monster-data.js",
        "map": "modules/map/data/map-data.js",
        "encounter": "modules/encounter/data/encounter-data.js",
        "conflict": "modules/display/data/conflict-board-data.json",
    }.items()}
    conflict_js = load_data("modules/display/data/conflict-board-data.js")
    manifest_record = load_data("modules/display/data/conflict-assets-manifest.json")
    slugs = json.loads((ROOT / "tools/monster-token-crops.json").read_text(encoding="utf-8"))
    localized = load_localized()
    localized_cards = {f'aibp:{card_id}': entry for entry in localized.values() for card_id in entry["cards"]}
    jobs = {}
    assignments = []

    def register(image, side, folder, owner, map_rules=False):
        if not image.get(side) or image.get(side + "Crop"):
            return
        if map_rules and side == "back" and not image.get("uniqueBack"):
            return
        cols, rows = float(image.get("width", 1)), float(image.get("height", 1))
        if not cols.is_integer() or not rows.is_integer() or cols * rows <= 1:
            return
        cols, rows, index = int(cols), int(rows), int(image.get("index", 0))
        assert 0 <= index < cols * rows, owner
        key = (image[side], cols, rows, index)
        if key not in jobs:
            source_id = digest(image[side].encode())[:8]
            destination = f"/assets/cards/{folder}/{source_id}-{index:02d}.jpg"
            entry = localized_cards.get(owner)
            if entry:
                # 这张卡已经是中文卡面：跳过切图，保留文件并按满幅几何写回。
                jobs[key] = {"source": image[side], "grid": [cols, rows], "index": index,
                             "target": entry["face"], "localized": entry}
            else:
                jobs[key] = {"source": image[side], "grid": [cols, rows], "index": index, "target": destination}
        assignments.append({"owner": owner, "side": side, "image": image, "job": jobs[key]})

    for monster in records["aibp"]["data"]["monsters"]:
        for card in monster["cards"]:
            for side in ("face", "back"):
                register(card["image"], side, f'monster-{side}s/{slugs[monster["id"]]["slug"]}', f'aibp:{card["id"]}')
    for kingdom, rules in records["map"]["data"]["kingdomRules"].items():
        for category in ("exploration", "specialExploration", "deepFog"):
            for card in rules.get(category, []):
                for side in ("face", "back"):
                    folder = "deep-fog" if category == "deepFog" else f"exploration/{kingdom.lower()}/{side}"
                    register(card["image"], side, folder, f'map:{card["id"]}', map_rules=True)
    for monster in records["encounter"]["data"]["monsters"]:
        for level in monster.get("encounterLevels", []):
            for side in ("face", "back"):
                register(level["image"], side, f"encounters/{side}", f'encounter:{monster["id"]}:{level["level"]}:{level.get("cardId", "")}')
    board = records["conflict"]["data"]
    for category, cards in (("terrainCards", list(board["terrainCards"]["byAsset"].values())), ("foolDeck", board["foolDeck"]["cards"])):
        sheet = board[category].get("sheet")
        if not sheet:
            continue
        for card in cards:
            image = {"face": sheet["asset"], "width": sheet["columns"], "height": sheet["rows"],
                     "index": card["row"] * sheet["columns"] + card["column"],
                     "cellWidth": sheet["width"] / sheet["columns"], "cellHeight": sheet["height"] / sheet["rows"]}
            image["aspect"] = image["cellWidth"] / image["cellHeight"]
            card["image"] = image
            register(image, "face", "terrain" if category == "terrainCards" else "fool", f'conflict:{card["cardId"]}')

    grouped = collections.defaultdict(list)
    for job in jobs.values():
        if "localized" in job:
            continue
        grouped[job["source"]].append(job)
    preserved = sum(1 for job in jobs.values() if "localized" in job)
    print(f"Plan: {len(grouped)} atlases, {len(jobs) - preserved} unique cells, "
          f"{len(assignments)} side references, {preserved} localized faces preserved.", flush=True)
    if not apply or not jobs:
        return
    if grouped:
        assert jpegtran and Path(jpegtran).is_file(), "Pass --jpegtran with the native jpegtran executable."
    OUTPUT.mkdir(parents=True, exist_ok=True)
    report = {"version": 1, "method": "Lossless native-size JPEG cells; source context padding hidden with independent per-side geometry.",
              "sources": [], "images": [], "assignments": []}
    visible_cache = {}
    for source_number, (source_uri, source_jobs) in enumerate(grouped.items(), 1):
        source = public_path(source_uri)
        report["sources"].append({"source": source_uri, "bytes": source.stat().st_size, "sha256": digest(source.read_bytes())})
        with Image.open(source) as atlas:
            atlas.load()
            assert atlas.format == "JPEG" and atlas.mode == "RGB", source
            mcu_x = 8 * max(layer[1] for layer in atlas.layer)
            mcu_y = 8 * max(layer[2] for layer in atlas.layer)
            for job in source_jobs:
                cols, rows = job["grid"]
                assert atlas.width % cols == 0 and atlas.height % rows == 0, job
                width, height = atlas.width // cols, atlas.height // rows
                left, top = job["index"] % cols * width, job["index"] // cols * height
                right, bottom = left + width, top + height
                expected = atlas.crop((left, top, right, bottom))
                visible_hash = digest(expected.tobytes())
                content_key = (width, height, visible_hash)
                if content_key in visible_cache:
                    original_target = job["target"]
                    job.update(visible_cache[content_key])
                    job["reusedTarget"] = original_target != job["target"]
                    continue
                # Keep neighboring JPEG blocks where chroma interpolation needs
                # context. These pixels are clipped by the renderer, never scaled into the card.
                x0, y0 = left // mcu_x * mcu_x, top // mcu_y * mcu_y
                x1, y1 = min(atlas.width, math.ceil(right / mcu_x) * mcu_x), min(atlas.height, math.ceil(bottom / mcu_y) * mcu_y)
                if left - x0 < 2 and x0:
                    x0 -= mcu_x
                if top - y0 < 2 and y0:
                    y0 -= mcu_y
                if x1 - right < 2 and x1 < atlas.width:
                    x1 = min(atlas.width, x1 + mcu_x)
                if y1 - bottom < 2 and y1 < atlas.height:
                    y1 = min(atlas.height, y1 + mcu_y)
                target = public_path(job["target"])
                target.parent.mkdir(parents=True, exist_ok=True)
                if not target.exists():
                    subprocess.run([jpegtran, "-copy", "all", "-optimize", "-crop", f"{x1-x0}x{y1-y0}+{x0}+{y0}", str(source), str(target)], check=True, capture_output=True)
                with Image.open(target) as result:
                    assert result.size == (x1 - x0, y1 - y0), target
                    dx, dy = left - x0, top - y0
                    visible = result.crop((dx, dy, dx + width, dy + height)).convert("RGB")
                    assert visible.tobytes() == expected.tobytes(), f"Decoded crop mismatch: {target}"
                    crop = {"width": result.width / width, "height": result.height / height, "index": 0,
                            "x": dx / (result.width - width) * 100 if result.width != width else 0,
                            "y": dy / (result.height - height) * 100 if result.height != height else 0,
                            "cellWidth": width, "cellHeight": height, "aspect": width / height}
                    metadata = {"target": job["target"], "crop": crop, "visibleSize": [width, height],
                                "fileSize": list(result.size), "padding": [dx, dy], "visiblePixelSHA256": visible_hash}
                metadata["bytes"] = target.stat().st_size
                job.update(metadata)
                visible_cache[content_key] = metadata
                report["images"].append({**metadata, "source": source_uri, "sourceBox": [left, top, right, bottom], "sourceIndex": job["index"]})
        print(f"[{source_number}/{len(grouped)}] {source.name}: {len(source_jobs)} cells verified", flush=True)

    for item in assignments:
        image, side, job = item["image"], item["side"], item["job"]
        before = json.loads(json.dumps(image))
        if "localized" in job:
            # 满幅中文卡：没有图谱留白需要裁，直接按文件实际尺寸铺满。
            entry = job["localized"]
            crop = {"width": 1, "height": 1, "index": 0, "x": 0, "y": 0,
                    "cellWidth": entry["width"], "cellHeight": entry["height"],
                    "aspect": entry["width"] / entry["height"]}
        else:
            crop = {**job["crop"], "aspect": image.get("aspect") or job["crop"]["aspect"]}
        image[side] = job["target"]
        image[side + "Crop"] = crop
        report["assignments"].append({"owner": item["owner"], "side": side, "beforeImage": before,
                                      "target": job["target"], "crop": crop})
    for category in ("terrainCards", "foolDeck"):
        board[category].pop("sheet", None)

    # Replace the two sprite-sheet manifest entries with their independent files.
    old_paths = set(grouped)
    public_manifest = manifest_record["data"]
    public_manifest["assets"] = [entry for entry in public_manifest["assets"] if entry.get("publicPath") not in old_paths]
    for image in report["images"]:
        if image["source"] not in {"/assets/conflict/terrain-card-sheet.jpg", "/assets/conflict/fool-card-sheet.jpg"}:
            continue
        file = public_path(image["target"])
        public_manifest["assets"].append({"id": f'card-{Path(image["target"]).parent.name}-{image["sourceIndex"]}',
            "kind": "card", "publicPath": image["target"], "width": image["fileSize"][0], "height": image["fileSize"][1],
            "bytes": file.stat().st_size, "sha256": digest(file.read_bytes())})
    public_manifest["assets"].sort(key=lambda entry: entry["id"])
    conflict_js["data"] = board
    # Check all inputs before writing any of them, preserving concurrent edits.
    for record in [*records.values(), conflict_js, manifest_record]:
        assert record["path"].read_bytes() == record["raw"], f'Concurrent change: {record["path"]}'
    for record in [*records.values(), conflict_js, manifest_record]:
        save_data(record)
    report["sourceBytes"] = sum(entry["bytes"] for entry in report["sources"])
    report["targetBytes"] = sum(entry["bytes"] for entry in report["images"])
    # 只保留取过格子的那一轮的清单；纯保留中文卡的运行不覆盖它。
    if grouped:
        (OUTPUT / "manifest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f'Applied {len(assignments)} references to {len(report["images"])} files. Sources retained for verification.', flush=True)
    else:
        print(f'Preserved {preserved} localized faces and restored their geometry; nothing to extract.', flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--delete-sources", action="store_true")
    parser.add_argument("--jpegtran", default=shutil.which("jpegtran"))
    args = parser.parse_args()
    if args.delete_sources:
        delete_sources()
    else:
        split_cards(args.jpegtran, args.apply)
