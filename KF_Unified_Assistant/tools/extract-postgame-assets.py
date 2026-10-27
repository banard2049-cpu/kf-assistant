"""Reproduce the postgame monster crops and level data from the supplied PDFs.

Usage: python extract-postgame-assets.py --source-dir "D:/.../FileRecv"
Only the cited appendix rectangles are rendered; the source PDFs are unchanged.
The measured rectangles below use the reviewed page-image pixel coordinates.
They are converted to PDF points and stored with each generated reference card.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    "sunken": "沉没的王国（69.pdf",
    "stone": "斯托恩公国（70.pdf",
    "fear": "万种多肉恐惧（76.pdf",
}
GROUPS: list[dict] = []


def add(monster, source, page, size, xs, rows):
    """row: level, names, hit, wounds, promotion, AI, signature, row y0/y1, text y0/y1."""
    for level, names, hit, wounds, promotion, ai, signature, r0, r1, t0, t1 in rows:
        GROUPS.append(dict(monsterId=monster, source=source, page=page, size=size,
            level=level, names=names.split("|"), hit=hit, wounds=wounds,
            promotion=promotion, activations=[f"{ai} AI"] + ([f"{signature} Signature"] if signature else []),
            levelRect=[xs[0], r0, xs[1], r1], traitRect=[xs[0], t0, xs[1], t1]))


add("M_Pumpkinhead", "sunken", 65, [1168, 1705], [76, 587], [
    (5,"Each One Worse Than the Last|Airborne Spores|Fireproof","9+",7,0,2,1,270,383,389,665),
    (6,"Humid Haze","10+",8,0,2,1,669,780,786,869),
    (7,"Trick, not Treat|Ruthless","10+",8,0,2,1,875,986,990,1162),
    (8,"Cloud of Death","11+",9,0,2,1,1167,1280,1282,1367),
    (9,"Where Angels Fear to Tread","12+",9,0,2,1,1371,1483,1485,1565),
])
add("M_WingedNightmare", "sunken", 65, [1168, 1705], [619, 1129], [
    (5,"Slippery Like an Eel","10+",6,2,1,1,271,385,390,487),
    (6,"Fleeting Victory","11+",6,3,1,1,493,604,609,695),
    (7,"Siren's Lure|Ruthless","12+",7,4,1,1,700,813,817,978),
    (8,"Rusalka's Frenzy","13+",8,5,1,1,981,1096,1099,1187),
    (9,"Where Angels Fear to Tread","14+",9,5,1,1,1197,1310,1317,1397),
])
add("M_FirstmenWarriors", "sunken", 66, [1172, 1710], [75, 582], [
    (5,"Echoing Howl","10+",9,2,2,1,175,288,294,390),
    (6,"Suppressing Fire","10+",10,2,2,1,399,513,518,602),
    (7,"Bedeviled|Ruthless","11+",11,3,2,1,607,721,726,873),
    (8,"Testudinem Formate!","12+",12,3,2,1,878,993,998,1081),
    (9,"Where Angels Fear to Tread","12+",13,3,2,1,1085,1200,1203,1277),
])
add("M_HauntOf", "sunken", 66, [1172, 1710], [614, 1122], [
    (5,"Bad Things Come in Threes","10+",9,0,2,1,175,288,294,379),
    (6,"Deathly Departed","11+",9,0,2,1,383,498,502,583),
    (7,"Profane Possession|Ruthless","12+",9,0,2,1,585,700,705,937),
    (8,"The Little Things","13+",9,0,2,1,943,1058,1060,1157),
    (9,"Where Angels Fear to Tread","14+",9,0,2,1,1160,1274,1278,1362),
])
add("M_WhiteApe", "sunken", 67, [1167, 1705], [79, 589], [
    (5,"Firstman Fastball","9+!",8,2,1,1,177,294,299,440),
    (6,"Territorial Instinct","10+!",9,3,1,1,447,563,567,664),
    (7,"Ancestral Terror","11+!",10,4,1,1,669,785,789,870),
    (8,"Primal Punch|Ruthless","12+!",11,5,1,1,876,992,996,1167),
    (9,"Where Angels Fear to Tread","13+!",12,5,1,1,1173,1289,1293,1386),
])
add("M_KingLaidLow", "sunken", 67, [1167, 1705], [620, 1128], [
    (5,"Trench Runner","10+",10,2,2,1,177,293,299,393),
    (6,"Dig Dug","11+",11,3,2,1,400,515,519,587),
    (7,"Dug Too Deep|Bedeviled|Ruthless","12+",12,4,2,1,591,707,710,939),
    (8,"Mere of Sorrows","12+",13,5,2,1,944,1059,1062,1137),
    (9,"Where Angels Fear to Tread","13+",14,6,2,1,1141,1255,1258,1333),
])
add("M_DevilAncientDusk", "sunken", 68, [1182, 1713], [84, 590], [
    (4,"Swindler's Surge","13+",11,1,2,1,194,309,313,426),
    (5,"Drifter at the Double-Crossroads","13+",12,2,2,1,430,545,549,620),
    (6,"House Edge","14+",13,3,2,1,625,740,742,819),
    (7,"Idle Feet Are the Devil's Playthings|Bedeviled|Ruthless","15+",14,4,2,1,821,936,941,1197),
    (8,"Mask of Stolen Faces","15+",15,5,2,1,1204,1319,1321,1432),
])
add("M_DevilAncientDusk", "sunken", 68, [1182, 1713], [621, 1123], [
    (9,"Where Angels Fear to Tread","16+",16,5,2,1,194,309,313,387),
])
add("M_Toadragon", "sunken", 69, [1176, 1707], [79, 590], [
    (3,"Mire of Ancient Burdens","11+",12,2,1,0,197,313,317,403),
    (4,"Where Angels Fear to Tread|Song of Suffering|Ruthless","12+",12,3,1,0,408,523,527,760),
    (5,"Restless Brood","12+",13,4,1,1,766,882,886,985),
    (6,"Dirge of Desolation","13+",13,4,1,1,990,1107,1112,1206),
    (7,"Soulswallower","13+",14,5,2,1,1211,1324,1327,1401),
])
add("M_Toadragon", "sunken", 69, [1176, 1707], [621, 1126], [
    (8,"Bedeviled","14+",15,5,2,1,195,312,316,384),
    (9,"Choir of a Thousand Young","15+",16,5,2,1,388,503,508,643),
])
add("M_Panzergeists", "fear", 71, [1164, 1704], [69, 576], [
    (5,"Grateful Dead|Panzerschale","10+!",8,1,2,1,367,481,485,664),
    (6,"Chill of the Beyond","10+!",10,1,2,1,669,783,786,869),
    (7,"Ashes to Ashes Rust to Rust|Ruthless","11+!",10,1,2,1,873,989,991,1189),
    (8,"Gravecaller","11+!",10,1,2,1,1193,1310,1313,1403),
    (9,"Where Angels Fear to Tread","12+!",10,1,2,1,1408,1524,1526,1601),
])
add("M_Stonemason", "fear", 71, [1164, 1704], [619, 1121], [
    (5,"Impervious","11+",10,1,2,1,367,481,486,552),
    (6,"Invert Polarity","12+",11,3,1,1,557,670,673,787),
    (7,"Deadly Collapse","12+",12,4,2,1,791,906,908,993),
    (8,"Unstoppable|Ruthless","12+",13,5,2,1,997,1112,1115,1288),
    (9,"Where Angels Fear to Tread","13+",14,5,2,1,1292,1408,1411,1490),
])
add("M_Knighteater", "fear", 72, [1167, 1715], [39, 543], [
    (5,"Famished","8+",10,2,1,1,373,489,493,598),
    (6,"Profane Hunger","10+",10,2,2,1,604,720,724,917),
    (7,"Bedeviled|Ruthless","10+",12,4,2,1,922,1038,1041,1184),
    (8,"Ultrafast Reflexes","11+",13,5,2,1,1188,1304,1307,1375),
    (9,"Where Angels Fear to Tread","12+",14,5,2,1,1377,1494,1496,1565),
])
add("M_FirstmenLictor", "fear", 72, [1167, 1715], [582, 1087], [
    (5,"Gibbering Mockery","10+",9,2,2,1,368,484,488,565),
    (6,"The Kiss of Death","10+",10,2,2,1,569,683,688,802),
    (7,"Anatiochan Legionary Tactics|Ruthless","10+","!",4,2,1,807,924,927,1259),
    (8,"Madcap Decoction","11+","!",3,2,1,1262,1379,1380,1450),
    (9,"Where Angels Fear to Tread","12+","!",3,2,1,1452,1569,1570,1639),
])
add("M_BogWitch", "fear", 73, [1163, 1706], [77, 583], [
    (5,"Hateful Predisposition","10+",10,2,1,0,182,298,302,380),
    (6,"Swamp Sacrifice","11+",11,3,1,0,385,501,504,590),
    (7,"Bedeviled","12+",12,4,1,1,591,707,709,777),
    (8,"Mud Pits|Ruthless","12+",13,5,2,1,780,895,897,1060),
    (9,"Where Angels Fear to Tread","13+",13,5,1,1,1063,1178,1180,1244),
    (10,"The Witch Queen","13+",13,6,1,1,1246,1361,1364,1470),
])
add("M_YoungDevour", "fear", 73, [1163, 1706], [616, 1120], [
    (3,"All-Consuming|Where Angels Fear to Tread","10+",12,0,1,0,183,299,304,553),
    (4,"Heavenly Bliss|Ruthless","12+",12,0,1,0,556,673,677,883),
    (5,"The Descending Doom","12+",14,0,1,1,886,1002,1004,1131),
    (6,"The World Eater","12+",14,0,1,1,1136,1252,1255,1347),
    (7,"Hungry Hungry Dragon","13+",14,0,2,1,1351,1467,1470,1544),
])
add("M_YoungDevour", "fear", 74, [1168, 1713], [37, 544], [
    (8,"Polyhedrophilia","14+",14,0,2,1,187,305,307,407),
    (9,"Rapture of the Heavenly Heights","15+",15,0,2,1,412,529,531,663),
])
add("M_Ratwolves", "stone", 65, [817, 1194], [53, 407], [
    (5,"Mutable Physiology","9+",5,1,2,1,195,277,278,400),
    (6,"Like a Rat in a Corner","10+",6,1,2,1,405,486,488,579),
    (7,"Extreme Mutations|Ruthless","10+",6,2,2,1,580,661,662,827),
    (8,"Children of Pestilence","11+",7,2,2,1,829,910,912,969),
    (9,"Where Angels Fear to Tread","12+",8,2,2,1,970,1053,1054,1113),
])
add("M_PalebloodWorms", "stone", 65, [817, 1194], [428, 783], [
    (5,"Bad Blood","10+",9,2,2,1,195,277,278,338),
    (6,"Bloodletting","10+",10,2,2,1,341,422,424,480),
    (7,"Hyper-Coagulation|Ruthless","11+",11,2,2,1,485,566,568,676),
    (8,"Beyond the Pale|Mega Drain","11+",12,3,2,1,680,760,764,874),
    (9,"Where Angels Fear to Tread","12+",13,3,2,1,877,958,961,1016),
])
add("M_KnightFen", "stone", 66, [819, 1201], [42, 397], [
    (5,"Impervious","11+",10,2,1,1,132,214,217,265),
    (6,"Sympathetic Reaction","12+",11,3,1,1,268,350,353,408),
    (7,"Acidic Oblivion|Ruthless","12+",12,4,1,1,410,492,495,619),
    (8,"Divide Then Conquer","12+",13,5,1,1,623,706,709,775),
    (9,"Where Angels Fear to Tread","13+",14,5,1,1,777,859,862,910),
])
add("M_Ironcast", "stone", 66, [819, 1201], [417, 774], [
    (5,"Panzerschale","9+",8,1,2,1,131,214,217,282),
    (6,"Eisernwald Steel","10+",9,2,2,1,285,368,371,450),
    (7,"Marche Macabre|Ruthless","10+",10,2,2,1,453,536,537,721),
    (8,"Legion of the Grave","11+",11,3,2,1,724,806,809,874),
    (9,"Where Angels Fear to Tread","12+",12,3,2,1,878,960,963,1015),
])
add("M_Eggknight", "stone", 67, [817, 1196], [55, 410], [
    (5,"Ceramic Regrowth|Overjacked","11+",10,2,1,1,129,211,212,372),
    (6,"Humpty Supercharge","12+",11,3,1,1,374,454,456,556),
    (7,"Bedeviled","12+",12,4,1,1,557,637,639,689),
    (8,"Tough One to Crack|Ruthless","12+",13,5,2,1,692,773,775,908),
    (9,"Where Angels Fear to Tread","13+",14,5,2,1,910,991,994,1051),
])
add("M_PuppetKing", "stone", 67, [817, 1196], [430, 784], [
    (5,"Hand of the Master|Impervious","10+",10,2,1,1,131,213,215,338),
    (6,"Flood of the Fallen","11+",11,3,1,1,341,423,425,523),
    (7,"Banished From My Sight|Ruthless","12+",12,4,2,1,526,608,611,708),
    (8,"Honeyed Words","12+",13,5,2,1,712,795,797,848),
    (9,"Where Angels Fear to Tread","13+",14,5,2,1,850,933,935,984),
])
add("M_DevilSmeltedFears", "stone", 68, [819, 1200], [42, 398], [
    (4,"Bar the Gates|Shadow of Fear","13+",11,1,2,1,145,227,230,484),
    (5,"Can't Fool the Devil Twice|Profane Liturgy","12+",12,2,2,1,493,575,578,681),
    (6,"House Edge|Bedeviled","12+",13,3,2,1,684,767,769,854),
    (7,"Drowning in Sin|Ruthless","13+",14,4,2,1,859,941,944,1064),
])
add("M_DevilSmeltedFears", "stone", 68, [819, 1200], [419, 769], [
    (8,"Musk of Fear","13+",15,5,2,1,145,227,230,308),
    (9,"Where Angels Fear to Tread","14+",16,5,2,1,312,394,397,443),
    (10,"The Bowels of Hell","15+",16,5,2,1,448,530,533,631),
])
add("M_Panzerdragon", "stone", 69, [815, 1196], [54, 409], [
    (3,"Rust Absolution","11+",12,2,2,0,143,225,227,308),
    (4,"Where Angels Fear to Tread|Complete Battlefield Saturation|Ruthless","12+",12,3,2,0,310,392,395,590),
    (5,"Scouring Scurriers","12+",13,4,2,1,591,673,676,732),
    (6,"Despiser of Metal","13+",13,4,2,1,735,816,817,870),
    (7,"Despiser of Man","13+",14,5,2,1,874,956,958,1075),
])
add("M_Panzerdragon", "stone", 69, [815, 1196], [428, 782], [
    (8,"Bedeviled","14+",15,5,2,1,145,226,229,279),
    (9,"Panzer Event Horizon","15+",16,5,2,1,281,363,365,436),
])

REPLACEMENTS = {
    "M_WingedNightmare": [(8,"Rusalka's Frenzy",["Nixie's Fury"],"取代 Nixie's Fury。")],
    "M_Knighteater": [(6,"Profane Hunger",["Living Up To The Name"],"取代 Living Up To The Name。")],
    "M_Toadragon": [(6,"Dirge of Desolation",["Dirge of Dominion"],"发生冲突时优先于 Dirge of Dominion。")],
    "M_PuppetKing": [(5,"Hand of the Master",["Five Fingers"],"取代 Five Fingers；按新版手指受伤效果结算。")],
    "M_Eggknight": [(6,"Humpty Supercharge",["Humpty Fate","Hardboiled"],"Humpty Fate 和 Hardboiled 已禁用。")],
    "M_Panzerdragon": [(7,"Despiser of Man",["Beneath the Shadow of Their Wings"],"原始残躯移动按 Despiser of Man，优先于 Beneath the Shadow of Their Wings。")],
    "M_DevilSmeltedFears": [
        (7,"Drowning in Sin",["Profane Liturgy"],"Profane Liturgy 已被取代；每次 Ferrobaptism X 的值翻倍。"),
        (10,"The Bowels of Hell",[],"Bargain 弃置的盔甲不再放到 Smelter Oubliette；Shadow of Fear 不能忽略。"),
    ],
}

JS_HELPERS = r"""
  const intLevel = value => Math.max(1, Math.trunc(Number(value) || 1));
  const allCards = new Map();
  Object.values(DATA).forEach(rows => rows.forEach(row => {
    allCards.set(row.trait.id, row.trait);
    allCards.set(row.reference.id, row.reference);
  }));
  function replacementNotesFor(monsterId, level) {
    return (REPLACEMENTS[monsterId] || []).filter(item => item.minLevel <= intLevel(level)).map(item => ({ ...item, replaces: [...item.replaces] }));
  }
  function traitsFor(monsterId, level) {
    const current = intLevel(level);
    const replacements = replacementNotesFor(monsterId, current);
    return (DATA[monsterId] || []).filter(row => row.level <= current).map(row => {
      const superseded = replacements.filter(item => item.minLevel > row.level && item.replaces.some(name => row.trait.traitNames.some(original => original.toLowerCase() === name.toLowerCase())));
      return { ...row.trait, supersededBy: superseded.length ? superseded.map(item => item.name) : null,
        note: [row.trait.note, ...superseded.map(item => item.note)].filter(Boolean).join(" ") };
    });
  }
  function levelReferenceFor(monsterId, level) {
    return (DATA[monsterId] || []).find(row => row.level === intLevel(level))?.reference || null;
  }
  function cardById(monsterId, level, id) {
    const card = allCards.get(String(id));
    return card?.monsterId === monsterId ? card : null;
  }
  function maxLevel(monsterId) {
    return Math.max(1, ...(globalThis.KF_LEVEL_CONFIG?.[monsterId] || []).map(row => Number(row.level) || 1), ...(DATA[monsterId] || []).map(row => row.level));
  }
  window.KF_POSTGAME_RULES = Object.freeze({ DATA, traitsFor, levelReferenceFor, replacementNotesFor, cardById, maxLevel });
})();
"""


def level_clip_path(pixmap):
    """Describe the printed stat row silhouette without changing its PNG pixels.

    Keep the largest connected ink shape so a sliver of the next appendix
    paragraph is ignored. Its outer boundary keeps enclosed white letters and
    symbols opaque instead of treating all white pixels as a color key.
    """
    width, height, channels = pixmap.width, pixmap.height, pixmap.n
    samples = pixmap.samples
    ink = bytearray(width * height)
    for index in range(width * height):
        rgb = samples[index * channels:index * channels + 3]
        # Some fear appendix scans have grey paper near RGB 200 rather than
        # pure white. The printed bars are dark and the badge/trim are colored.
        ink[index] = min(rgb) < 190 or max(rgb) - min(rgb) > 20
    largest, silhouette = 0, bytearray(width * height)
    for start, value in enumerate(ink):
        if not value:
            continue
        ink[start] = 0
        pending, component = [start], []
        while pending:
            index = pending.pop()
            y, x = divmod(index, width)
            component.append(index)
            for neighbor in (index - 1 if x else -1, index + 1 if x + 1 < width else -1,
                             index - width if y else -1, index + width if y + 1 < height else -1):
                if neighbor >= 0 and ink[neighbor]:
                    ink[neighbor] = 0
                    pending.append(neighbor)
        if len(component) > largest:
            largest, silhouette = len(component), bytearray(width * height)
            for index in component:
                silhouette[index] = 1
    if not largest:
        raise ValueError("The level reference image contains no printed stat row")
    def inside(x, y):
        return 0 <= x < width and 0 <= y < height and silhouette[y * width + x]
    # Clockwise pixel-edge tracing follows concave paper margins as well as the
    # badge tip. Interior holes are intentionally absent from this CSS polygon.
    start = next(index for index, value in enumerate(silhouette) if value)
    origin = point = (start % width, start // width)
    direction, points = 0, []
    steps = ((1, 0), (0, 1), (-1, 0), (0, -1))
    while True:
        points.append(point)
        x, y = point
        boundaries = (inside(x, y) and not inside(x, y - 1),
                      inside(x - 1, y) and not inside(x, y),
                      inside(x - 1, y - 1) and not inside(x - 1, y),
                      inside(x, y - 1) and not inside(x - 1, y - 1))
        direction = next(candidate for candidate in ((direction + 1) % 4, direction, (direction - 1) % 4, (direction + 2) % 4) if boundaries[candidate])
        dx, dy = steps[direction]
        point = (x + dx, y + dy)
        if point == origin:
            break
        if len(points) > width * height * 4:
            raise ValueError("The level reference silhouette did not close")
    outline = []
    for point in points:
        if outline and point == outline[-1]:
            continue
        while len(outline) > 1:
            a, b = outline[-2:]
            if (b[0] - a[0]) * (point[1] - b[1]) != (b[1] - a[1]) * (point[0] - b[0]):
                break
            outline.pop()
        outline.append(point)
    return "polygon(" + ", ".join(f"{x / width * 100:.4f}% {y / height * 100:.4f}%" for x, y in outline) + ")"


def refresh_level_masks():
    config = ROOT / "public/modules/aibp/data/postgame-config.js"
    content = config.read_text(encoding="utf-8")
    before, data_and_after = content.split("  const DATA = ", 1)
    raw, after = data_and_after.split(";\n  const REPLACEMENTS = ", 1)
    data = json.loads(raw)
    count = 0
    for rows in data.values():
        for row in rows:
            card = row["reference"]
            source = ROOT / "public" / card["image"]["face"].lstrip("/")
            card["image"]["clipPath"] = level_clip_path(fitz.Pixmap(str(source)))
            count += 1
    config.write_text(before + "  const DATA = " + json.dumps(data, ensure_ascii=False, indent=2)
                      + ";\n  const REPLACEMENTS = " + after, encoding="utf-8")
    print(json.dumps({"levelMasks": count, "config": str(config)}, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path)
    parser.add_argument("--scale", type=float, default=2.5)
    parser.add_argument("--metadata-only", action="store_true", help="Regenerate JS without rendering PNGs")
    parser.add_argument("--refresh-level-masks", action="store_true", help="Refresh CSS silhouettes from existing level PNGs without source PDFs or modifying the images")
    args = parser.parse_args()
    if args.refresh_level_masks:
        refresh_level_masks()
        return
    if args.source_dir is None:
        parser.error("--source-dir is required unless --refresh-level-masks is used")
    output = ROOT / "public/assets/aibp/postgame"
    output.mkdir(parents=True, exist_ok=True)
    documents = {key: fitz.open(args.source_dir / file) for key, file in SOURCES.items()}
    data, levels = {}, {}
    for group in GROUPS:
        monster, level = group["monsterId"], group["level"]
        page = documents[group["source"]][group["page"] - 1]
        record = {"level": level}
        slug = monster.removeprefix("M_").lower()
        for key, kind in [("traitRect", "traits"), ("levelRect", "level")]:
            raw = group[key]
            clip = fitz.Rect(raw[0] / group["size"][0] * page.rect.width,
                             raw[1] / group["size"][1] * page.rect.height,
                             raw[2] / group["size"][0] * page.rect.width,
                             raw[3] / group["size"][1] * page.rect.height)
            pixmap = page.get_pixmap(matrix=fitz.Matrix(args.scale, args.scale), clip=clip, alpha=False)
            filename = f"{slug}-{level}-{kind}.png"
            if not args.metadata_only:
                (output / filename).write_bytes(pixmap.tobytes("png"))
            names = group["names"]
            card = dict(id=f"postgame-{slug}-{level}-{kind}", monsterId=monster,
                name=f"等级 {level} · " + (" / ".join(names) if kind == "traits" else "属性与蓝行加值（按原图）"),
                kind="Trait", minLevel=level, width=pixmap.width, height=pixmap.height,
                image={"face": f"/assets/aibp/postgame/{filename}", "aspect": pixmap.width / pixmap.height},
                source={"file": SOURCES[group["source"]], "page": group["page"], "rect": [round(n, 3) for n in clip]})
            if kind == "level":
                card["image"]["clipPath"] = level_clip_path(pixmap)
            if kind == "traits":
                card["traitNames"] = names
                if monster == "M_FirstmenLictor" and level == 6:
                    card["note"] = "原表列名为 The Kiss of Death，正文标题印为 PROFANE HUNGER；贴图保留原文。"
                if monster == "M_Panzergeists" and level == 5:
                    card["note"] = "原文 Panzerschale 段落引用 Pumpkin Plague；贴图保留原文。"
                record["trait"] = card
            else:
                card["note"] = "蓝行全部加值按原图应用；附录未列展览模式初始损伤。"
                record["reference"] = card
        data.setdefault(monster, []).append(record)
        levels.setdefault(monster, []).append({key: group[key] for key in ["level","hit","wounds","promotion","activations"]} |
            {"exhibitionWoundsUnspecified": True, "source": {"file": SOURCES[group["source"]], "page": group["page"]}})
    for value in data.values():
        value.sort(key=lambda row: row["level"])
    replacements = {monster: [dict(minLevel=l, name=n, replaces=r, note=t) for l,n,r,t in items] for monster,items in REPLACEMENTS.items()}
    config = ROOT / "public/modules/aibp/data/postgame-config.js"
    config.write_text("// Generated by tools/extract-postgame-assets.py from the supplied appendix pages.\n(() => {\n  \"use strict\";\n  const DATA = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n  const REPLACEMENTS = " + json.dumps(replacements, ensure_ascii=False, indent=2) + ";\n" + JS_HELPERS, encoding="utf-8")
    level_file = ROOT / "public/modules/aibp/data/level-config.js"
    content = level_file.read_text(encoding="utf-8").split("// BEGIN GENERATED POSTGAME LEVELS")[0].rstrip()
    level_file.write_text(content + "\n\n// BEGIN GENERATED POSTGAME LEVELS\n// Exact appendix rows, not extrapolated. Exhibition wounds are not printed in these tables.\n(() => {\n  const rows = " + json.dumps(levels, ensure_ascii=False, indent=2) + ";\n  for (const [id, additions] of Object.entries(rows)) {\n    const existing = window.KF_LEVEL_CONFIG[id] || [];\n    window.KF_LEVEL_CONFIG[id] = [...existing.filter(row => !additions.some(item => item.level === row.level)), ...additions].sort((a, b) => a.level - b.level);\n  }\n})();\n// END GENERATED POSTGAME LEVELS\n", encoding="utf-8")
    print(json.dumps({"monsters":len(data), "levelRows":len(GROUPS), "images":len(GROUPS)*2, "output":str(output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
