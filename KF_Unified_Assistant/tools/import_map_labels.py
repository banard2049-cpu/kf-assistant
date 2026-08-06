"""Merge hand-audited map and exploration-card backs into the map module."""

from __future__ import annotations

import json
from pathlib import Path


PROJECT = Path(__file__).resolve().parents[1]
MODULE = PROJECT / "public" / "modules" / "map"
LABEL_FILE = MODULE / "data" / "card-back-labels.json"
MAP_DATA_FILE = MODULE / "data" / "map-data.js"
PREFIX = "window.KF_MOD_DATA="

REGION_IDS = {
    "SK": {
        "": None,
        "淹没区": "drowned",
        "沼泽区": "marsh",
        "泥泞区": "mud",
    },
    "POS": {
        "": None,
        "商人区": "merchant",
        "港口区": "port",
        "工匠区": "craftsman",
        "贵族区": "noble",
    },
}

CLUE_TYPES = {"martial", "errant", "mystic", "historic"}
DIRECTIONS = ("north", "east", "south", "west")


def number(label: dict, key: str, tile_id: str) -> int | float:
    value = label.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{tile_id}: {key} is not numeric")
    return value


def main() -> None:
    exported = json.loads(LABEL_FILE.read_text(encoding="utf-8"))
    labels = exported.get("labels") or {}
    map_labels = {
        tile_id: label
        for tile_id, label in labels.items()
        if "_Tile_" in tile_id
    }
    exploration_labels = {
        card_id: label
        for card_id, label in labels.items()
        if ":EXP:" in card_id or ":SPECIAL:" in card_id
    }
    fog_labels = {
        card_id: label
        for card_id, label in labels.items()
        if ":FOG:" in card_id
    }

    text = MAP_DATA_FILE.read_text(encoding="utf-8")
    if not text.startswith(PREFIX):
        raise ValueError("Unexpected map-data.js wrapper")
    data = json.loads(text[len(PREFIX):].rstrip(";\r\n"))
    tiles = {
        tile["id"]: tile
        for map_data in data["maps"].values()
        for tile in map_data["tiles"]
    }
    exploration_cards = {
        card["id"]: card
        for rule_data in data["kingdomRules"].values()
        for card in [
            *rule_data.get("exploration", []),
            *rule_data.get("specialExploration", []),
        ]
    }
    fog_cards = {
        card["id"]: card
        for rule_data in data["kingdomRules"].values()
        for card in rule_data.get("deepFog", [])
    }

    missing = sorted(set(tiles) - set(map_labels))
    unknown = sorted(set(map_labels) - set(tiles))
    incomplete = sorted(
        tile_id for tile_id, label in map_labels.items()
        if label.get("completed") is not True
    )
    if missing or unknown or incomplete:
        raise ValueError(
            f"label mismatch: missing={missing[:5]}, unknown={unknown[:5]}, "
            f"incomplete={incomplete[:5]}"
        )

    unknown_exploration = sorted(set(exploration_labels) - set(exploration_cards))
    if unknown_exploration:
        raise ValueError(f"unknown exploration labels: {unknown_exploration[:5]}")

    missing_fog = sorted(set(fog_cards) - set(fog_labels))
    unknown_fog = sorted(set(fog_labels) - set(fog_cards))
    incomplete_fog = sorted(
        card_id for card_id, label in fog_labels.items()
        if label.get("completed") is not True
    )
    if missing_fog or unknown_fog or incomplete_fog:
        raise ValueError(
            f"fog label mismatch: missing={missing_fog[:5]}, "
            f"unknown={unknown_fog[:5]}, incomplete={incomplete_fog[:5]}"
        )

    region_counts: dict[str, int] = {}
    for tile_id, tile in tiles.items():
        label = map_labels[tile_id]
        kingdom = tile["kingdom"]
        region_name = str(label.get("region") or "")
        if region_name not in REGION_IDS[kingdom]:
            raise ValueError(f"{tile_id}: unknown region {region_name!r}")

        rules = tile.setdefault("rules", {})
        rules["region"] = REGION_IDS[kingdom][region_name]
        back = rules.setdefault("back", {})
        back.update({
            "time": number(label, "time", tile_id),
            "threat": number(label, "threat", tile_id),
            "clues": number(label, "clues", tile_id),
            "fogIntensity": number(label, "fogIntensity", tile_id),
            "iconTags": list(label.get("iconTags") or []),
            "pathNotes": str(label.get("pathNotes") or ""),
            "labelUpdatedAt": label.get("updatedAt"),
        })
        if region_name:
            region_counts[region_name] = region_counts.get(region_name, 0) + 1

    blank_exploration = 0
    labeled_exploration = 0
    for card_id, exploration_card in exploration_cards.items():
        label = exploration_labels.get(card_id)
        directions: dict[str, str | None] = {}
        for direction in DIRECTIONS:
            value = str((label or {}).get(direction) or "")
            if value and value not in CLUE_TYPES:
                raise ValueError(f"{card_id}: unknown {direction} clue {value!r}")
            directions[direction] = value or None

        is_blank = not any(directions.values())
        if is_blank:
            blank_exploration += 1
        else:
            missing_directions = [
                direction for direction, value in directions.items() if value is None
            ]
            if missing_directions:
                raise ValueError(
                    f"{card_id}: partially labeled directions {missing_directions}"
                )
            labeled_exploration += 1

        exploration_card["cluesByDirection"] = directions
        exploration_card["blankBack"] = is_blank
        exploration_card["labelUpdatedAt"] = (label or {}).get("updatedAt")

    fog_hazards = 0
    for card_id, fog_card in fog_cards.items():
        label = fog_labels[card_id]
        fog_card["fogValue"] = number(label, "fogValue", card_id)
        fog_card["hazard"] = label.get("hazard") is True
        fog_card["gravePenalty"] = str(label.get("gravePenalty") or "")
        fog_card["labelUpdatedAt"] = label.get("updatedAt")
        if fog_card["hazard"]:
            fog_hazards += 1

    data["cardBackLabelImport"] = {
        "source": LABEL_FILE.name,
        "sourceMod": exported.get("source"),
        "exportedAt": exported.get("exportedAt"),
        "mapTiles": len(map_labels),
        "completed": len(map_labels) - len(incomplete),
        "regionCounts": region_counts,
        "explorationCards": len(exploration_cards),
        "explorationLabeled": labeled_exploration,
        "explorationBlank": blank_exploration,
        "deepFogCards": len(fog_cards),
        "deepFogHazards": fog_hazards,
    }
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    MAP_DATA_FILE.write_text(f"{PREFIX}{payload};\n", encoding="utf-8")
    print(
        f"imported {len(map_labels)} completed map labels and "
        f"{labeled_exploration} directional exploration backs "
        f"({blank_exploration} blank), plus {len(fog_cards)} deep fog cards "
        f"({fog_hazards} hazards) into {MAP_DATA_FILE}"
    )


if __name__ == "__main__":
    main()
