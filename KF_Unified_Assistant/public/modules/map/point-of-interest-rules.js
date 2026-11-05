(() => {
  "use strict";

  // Card fronts visually checked against all 125 local map tiles and all 48
  // normal exploration cards. The four EXTRA labels have no printed PoI icon.
  // Chinese rulebook 1.06, pp.32-34: resolve front symbols before drawing the
  // exploration card; backtracking skips the kingdom tile step entirely.
  const TILE_POINTS = Object.freeze({
    "SK_Tile_M:1": [{"type": "number", "value": 1}],
    "SK_Tile_M:2": [{"type": "number", "value": 2}],
    "SK_Tile_M:3": [{"type": "number", "value": 2}],
    "SK_Tile_M:4": [{"type": "number", "value": 4}],
    "SK_Tile_M:5": [{"type": "number", "value": 2}],
    "SK_Tile_M:9": [{"type": "number", "value": 4}],
    "SK_Tile_M:10": [{"type": "number", "value": 1}],
    "SK_Tile_M:13": [{"type": "name", "name": "Faraway Landslide"}],
    "SK_Tile_M:14": [{"type": "number", "value": 3}],
    "SK_Tile_L:1": [{"type": "name", "name": "Signs of Struggle"}],
    "SK_Tile_L:2": [{"type": "name", "name": "Tension in the Air"}],
    "SK_Tile_L:3": [{"type": "number", "value": 3}],
    "SK_Tile_L:4": [{"type": "number", "value": 3}],
    "SK_Tile_L:5": [{"type": "number", "value": 4}],
    "SK_Tile_LS:5": [{"type": "number", "value": 1}],
    "SK_Tile_EL:1": [{"type": "number", "value": 5}],
    "SK_Tile_EL:2": [{"type": "number", "value": 5}],
    "SK_Tile_EL:3": [{"type": "number", "value": 5}],
    "SK_Tile_EXTRA:7": [{"type": "name", "name": "Tension in the Air", "printedWithoutIcon": true}],
    "SK_Tile_EXTRA:17": [{"type": "name", "name": "Tension in the Air", "printedWithoutIcon": true}],
    "POS_Tile_S:11": [{"type": "number", "value": 1}],
    "POS_Tile_M:2": [{"type": "number", "value": 3}],
    "POS_Tile_M:3": [{"type": "number", "value": 2}],
    "POS_Tile_M:4": [{"type": "number", "value": 4}],
    "POS_Tile_M:5": [{"type": "number", "value": 4}],
    "POS_Tile_M:6": [{"type": "name", "name": "A Guard’s Statue"}],
    "POS_Tile_M:8": [{"type": "number", "value": 1}],
    "POS_Tile_M:9": [{"type": "number", "value": 1}],
    "POS_Tile_M:10": [{"type": "number", "value": 4}],
    "POS_Tile_M:11": [{"type": "number", "value": 3}],
    "POS_Tile_M:12": [{"type": "number", "value": 2}],
    "POS_Tile_L:1": [{"type": "number", "value": 4}],
    "POS_Tile_L:2": [{"type": "name", "name": "Signs of Struggle"}],
    "POS_Tile_L:3": [{"type": "number", "value": 1}],
    "POS_Tile_L:4": [{"type": "number", "value": 3}],
    "POS_Tile_L:5": [{"type": "name", "name": "Tension in the Air"}],
    "POS_Tile_EL:1": [{"type": "number", "value": 2}],
    "POS_Tile_EL:2": [{"type": "number", "value": 3}],
    "POS_Tile_EL:3": [{"type": "number", "value": 2}],
    "POS_Tile_EXTRA:3": [{"type": "name", "name": "Tension in the Air", "printedWithoutIcon": true}],
    "POS_Tile_EXTRA:17": [{"type": "name", "name": "Tension in the Air", "printedWithoutIcon": true}]
  });

  const CARD_MODIFIERS = Object.freeze({
    "SK:EXP:23909": 3,
    "SK:EXP:23905": 4,
    "SK:EXP:23903": 0,
    "SK:EXP:23921": 3,
    "SK:EXP:23908": 1,
    "SK:EXP:23915": 1,
    "SK:EXP:23913": 4,
    "SK:EXP:23914": 1,
    "SK:EXP:23919": 2,
    "SK:EXP:23907": 1,
    "SK:EXP:23916": 0,
    "SK:EXP:23922": 4,
    "SK:EXP:23906": 0,
    "SK:EXP:23902": 2,
    "SK:EXP:23900": 3,
    "SK:EXP:23910": 0,
    "SK:EXP:23920": 3,
    "SK:EXP:23912": 4,
    "SK:EXP:23923": 0,
    "SK:EXP:23918": 4,
    "SK:EXP:23904": 1,
    "SK:EXP:23917": 3,
    "SK:EXP:23901": 1,
    "SK:EXP:23911": 2,
    "POS:EXP:31116": 0,
    "POS:EXP:31106": 4,
    "POS:EXP:31102": 5,
    "POS:EXP:31112": 4,
    "POS:EXP:31105": 0,
    "POS:EXP:31101": 5,
    "POS:EXP:31109": 5,
    "POS:EXP:31110": 0,
    "POS:EXP:31103": 5,
    "POS:EXP:31120": 4,
    "POS:EXP:31104": 0,
    "POS:EXP:31122": 3,
    "POS:EXP:31114": 1,
    "POS:EXP:31115": 5,
    "POS:EXP:31118": 2,
    "POS:EXP:31108": 1,
    "POS:EXP:31117": 3,
    "POS:EXP:31107": 2,
    "POS:EXP:31113": 1,
    "POS:EXP:31119": 1,
    "POS:EXP:31100": 5,
    "POS:EXP:31111": 4,
    "POS:EXP:31123": 4,
    "POS:EXP:31121": 2
  });

  // The two Kingdom Sheets have different effects for the same number.
  // Icon-only resource names have been expanded from the Chinese rulebook key.
  const KINGDOM_RESULTS = Object.freeze({
    SK: [
      {"number": 1, "title": "一处静谧居所", "name": "A Quiet Abode", "text": "由玩家自选的一名骑士进行虔信。"},
      {"number": 2, "title": "挣扎的痕迹", "name": "Signs of Struggle", "text": "搜刮 1。"},
      {"number": 3, "title": "漂浮的背包", "name": "Floating Backpacks", "text": "在所有骑士之间分配 4 金钱。DEVIL：改为 12 金钱。"},
      {"number": 4, "title": "远方的山崩", "name": "Faraway Landslide", "text": "执行轮换 1。"},
      {"number": 5, "title": "一座古老的水泵", "name": "An Ancient Pump", "text": "弃置一枚涌水指示物。"},
      {"number": 6, "title": "黑暗中的轮廓", "name": "Shapes in the Dark", "text": "队长进行洞察检定（7+）：成功：遭遇战；失败：伏击。"},
      {"number": 7, "title": "一个便利的藏身处", "name": "A Convenient Hideaway", "text": "威胁 −2。"},
      {"number": 8, "title": "空气中弥漫的紧张感", "name": "Tension in the Air", "text": "结算一场王国冒险。"},
      {"number": 9, "title": "一片干燥的林中空地", "name": "A Dry Clearing", "text": "两名随机骑士执行刷新 1。"}
    ],
    POS: [
      {"number": 1, "title": "一处静谧的居所", "name": "A Quiet Abode", "text": "由玩家自选的一名骑士进行虔信。"},
      {"number": 2, "title": "一条被忽视的小巷", "name": "An Overlooked Alleyway", "text": "每位骑士获得1自选线索。"},
      {"number": 3, "title": "挣扎的痕迹", "name": "Signs of Struggle", "text": "搜刮1。"},
      {"number": 4, "title": "空气中弥漫的紧张感", "name": "Tension in the Air", "text": "结算一场王国冒险。"},
      {"number": 5, "title": "破碎的货车", "name": "Splintered Cart", "text": "在所有骑士之间分配4金钱。DEVIL：改为12金钱。"},
      {"number": 6, "title": "可疑的空旷广场", "name": "Suspiciously Empty Plaza", "text": "队长进行洞察检定（7+）。成功：遭遇战；失败：伏击。"},
      {"number": 7, "title": "一座卫兵雕像", "name": "A Guard's Statue", "text": "获得一把石钥。"},
      {"number": 8, "title": "远方的轰鸣声", "name": "A Distant Rumble", "text": "执行轮换1。"},
      {"number": 9, "title": "废弃的营地", "name": "Abandoned Camp", "text": "每位骑士活力 +2、烈度 −1。"}
    ],
  });

  function tilePoints(tileId) {
    return (Object.hasOwn(TILE_POINTS, tileId) ? TILE_POINTS[tileId] : []).map(point => ({ ...point }));
  }

  function modifier(card) {
    if (!card || card.special) return null;
    const value = CARD_MODIFIERS[card.id];
    return Number.isInteger(value) ? value : null;
  }

  function manualResultsFor(points, values) {
    return points.map((point, index) => point.type === "number" && Array.isArray(values)
      && Number.isInteger(values[index]) && values[index] >= 1 && values[index] <= 9
      ? values[index] : null);
  }

  function applyModifier(points, adjustment, manualResults = []) {
    return points.map((point, index) => point.type === "number"
      ? { ...point, result: manualResults[index] ?? (adjustment === null ? null : point.value + adjustment) }
      : { ...point });
  }

  function capture(tileId, round, topCard) {
    const points = tilePoints(tileId);
    if (!points.length) return null;
    const numeric = points.some(point => point.type === "number");
    const adjustment = numeric ? modifier(topCard) : null;
    return {
      tileId,
      round,
      cardId: numeric ? topCard?.id || null : null,
      modifier: adjustment,
      manualResults: manualResultsFor(points),
      points: applyModifier(points, adjustment),
      acknowledged: false
    };
  }

  function normalize(reminder) {
    if (!reminder || Array.isArray(reminder) || typeof reminder !== "object"
      || !Number.isInteger(reminder.round) || reminder.round < 1) return null;
    const points = tilePoints(reminder.tileId);
    if (!points.length) return null;
    const numeric = points.some(point => point.type === "number");
    const adjustment = numeric && Number.isInteger(reminder.modifier) ? reminder.modifier : null;
    const manualResults = manualResultsFor(points, reminder.manualResults);
    return {
      tileId: reminder.tileId,
      round: reminder.round,
      cardId: numeric && typeof reminder.cardId === "string" ? reminder.cardId : null,
      modifier: adjustment,
      manualResults,
      executed: points.map((_, index) => Array.isArray(reminder.executed) && reminder.executed[index] === true),
      points: applyModifier(points, adjustment, manualResults),
      acknowledged: reminder.acknowledged === true
    };
  }

  function adjustResult(reminder, index, delta) {
    const updated = normalize(reminder);
    const point = updated?.points[index];
    if (!Number.isInteger(index) || point?.type !== "number" || updated.executed[index] || ![-1, 1].includes(delta)) return updated;
    const next = Math.min(9, Math.max(1, (point.result ?? point.value) + delta));
    const automatic = updated.modifier === null ? null : point.value + updated.modifier;
    updated.manualResults[index] = next === automatic ? null : next;
    updated.points = applyModifier(tilePoints(updated.tileId), updated.modifier, updated.manualResults);
    return updated;
  }

  function currentReminder(reminder, { step, round, tileId }) {
    return step === 3 && reminder?.round === round && reminder.tileId === tileId
      && Array.isArray(reminder.points) && reminder.points.length ? reminder : null;
  }

  function result(kingdom, point) {
    const entries = Object.hasOwn(KINGDOM_RESULTS, kingdom) ? KINGDOM_RESULTS[kingdom] : [];
    if (!point) return null;
    const normalizeName = name => String(name || "").replace(/[’‘]/g, "'").trim().toLowerCase();
    const entry = point.type === "number"
      ? entries.find(item => Number.isInteger(point.result) && item.number === point.result)
      : point.type === "name"
        ? entries.find(item => normalizeName(item.name) === normalizeName(point.name))
        : null;
    return entry ? { ...entry } : null;
  }

  window.KF_POINT_OF_INTEREST_RULES = Object.freeze({
    tilePoints, modifier, capture, normalize, adjustResult, currentReminder, result
  });
})();
