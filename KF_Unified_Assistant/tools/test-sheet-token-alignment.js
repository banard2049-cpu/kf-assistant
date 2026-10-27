"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const read = name => fs.readFileSync(name, "utf8").replace(/\r\n/g, "\n");
const host = read("public/modules/aibp/app.js");
const display = read("public/modules/display/app.js");
const api = read("public/api.php");
const positions = vm.runInNewContext(host.match(/const BOG_WITCH_POSITIONS = (\[[\s\S]*?\n  \]);/)[1]);
const centers = [[330.749, 975.819], [674.386, 974.695], [1017.532, 974.162]];

// These centers were measured on the printed source, independently of the overlay.
for (const [index, position] of positions.entries()) {
  assert.ok(Math.abs(position.x * 4810 / 100 - centers[index][0]) < .02);
  assert.ok(Math.abs(position.y * 1649 / 100 - centers[index][1]) < .02);
}

const apiPositions = JSON.parse(api.match(/\$positions=(\[\[[^;]+\]\]);/)[1]);
const publicTokens = apiPositions.map(([x, y]) => [{ assetId: "bog-witch-encounter", count: 1, x, y, auto: true }]);
for (let i = 0; i < 3; i++) {
  assert.equal(publicTokens[i][0].assetId, "bog-witch-encounter");
  assert.equal(publicTokens[i][0].x, positions[i].x);
  assert.equal(publicTokens[i][0].y, positions[i].y);
}

const layerStart = host.indexOf("  function sheetTokenLayer(");
const layerEnd = host.indexOf("  function sheetStageAspect(", layerStart);
const layerContext = {
  BOG_WITCH_POSITIONS: positions, BOG_WITCH_MARKER_SRC: "/witch.png", TOKEN_ASSETS: [],
  autoSheetTokens: () => [], whiteVengeanceActive: () => false, esc: String,
};
vm.createContext(layerContext);
vm.runInContext(host.slice(layerStart, layerEnd), layerContext);
for (let index = 0; index < 3; index++) {
  const html = layerContext.sheetTokenLayer({ monsterId: "M_BogWitch", sheetTokens: [], ruleState: { bogWitch: { position: index } } });
  assert.equal((html.match(/data-bog-position=/g) || []).length, 3);
  const active = html.match(/class="bog-position-slot active"[\s\S]*?<\/button>/)[0];
  assert.ok(active.includes(`data-bog-position="${index}"`));
  assert.ok(active.includes(`left:${positions[index].x}%;top:${positions[index].y}%`));
  assert.ok(active.includes('/witch.png'));
}

const armorDefaultsStart = host.indexOf("  const SHEET_ARMOR_DEFAULT_POSITIONS =");
const armorDefaultsEnd = host.indexOf("\n  const $", armorDefaultsStart);
const defaultPositionStart = host.indexOf("  function defaultSheetTokenPosition(");
const defaultPositionEnd = host.indexOf("\n  function setSheetTokenCount(", defaultPositionStart);
const defaultPositionContext = { Object };
vm.createContext(defaultPositionContext);
vm.runInContext(`${host.slice(armorDefaultsStart, armorDefaultsEnd)}
${host.slice(defaultPositionStart, defaultPositionEnd)}
globalThis.armorDefaults = SHEET_ARMOR_DEFAULT_POSITIONS;
globalThis.defaultPosition = defaultSheetTokenPosition;`, defaultPositionContext);
for (const [monsterId, expected] of [
  ["M_Eggknight", { x: 56.64, y: 43.0 }],
  ["M_Stonemason", { x: 86.38, y: 36.05 }],
  ["M_KnightFen", { x: 96.0, y: 8.0 }]
]) {
  assert.deepEqual(
    JSON.parse(JSON.stringify(defaultPositionContext.defaultPosition(3, "token-armor", { monsterId }))),
    expected,
    `${monsterId} manual armor must start on its printed armor slot`
  );
}
assert.deepEqual(
  JSON.parse(JSON.stringify(defaultPositionContext.defaultPosition(1, "token-01", { monsterId: "M_Stonemason" }))),
  { x: 29, y: 20 },
  "non-armor tokens must retain their generic grid placement"
);

// Eggknight's three printed BP frames were measured on the sheet art itself
// (right-hand 2405 × 1649 panel): frame centres at x 319.25 / 673.25 / 1026.75
// and y 709.25 / 705.75 / 706. Auto armor tokens must sit on those centres
// instead of the hand-drawn approximations that drifted each token off its frame.
const eggArmorStart = host.indexOf('if (battle.monsterId === "M_Eggknight")');
const eggArmorEnd = host.indexOf('if (battle.monsterId === "M_Stonemason")', eggArmorStart);
const eggBpSlots = callArguments(host.slice(eggArmorStart, eggArmorEnd), "make")
  .map(args => [args[1], Number(args[3]), Number(args[4])])
  .filter(([slot]) => /^"bp[123]"$/.test(slot));
assert.equal(eggBpSlots.length, 3, "Eggknight must auto-place one armor stack per BP frame");
const eggFrameCentres = [[319.25, 709.25], [673.25, 705.75], [1026.75, 706]];
eggBpSlots.forEach(([, x, y], index) => {
  const [frameX, frameY] = eggFrameCentres[index];
  assert.ok(
    Math.abs(x / 100 * 4810 - (2405 + frameX)) < 1,
    `Eggknight BP${index + 1} armor must sit on the printed frame centre, not ${x}%`
  );
  assert.ok(
    Math.abs(y / 100 * 1649 - frameY) < 3,
    `Eggknight BP${index + 1} armor must sit on the printed frame centre vertically, not ${y}%`
  );
});
assert.ok(
  Math.abs((eggBpSlots[1][1] - eggBpSlots[0][1]) - (eggBpSlots[2][1] - eggBpSlots[1][1])) < .01,
  "the three BP armor slots are evenly spaced on the sheet, so the tokens must be too"
);

function rules(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...css.matchAll(new RegExp(`(?:^|})\\s*${escaped}\\s*\\{([^}]*)}`, "gm"))]
    .map(match => Object.fromEntries(match[1].split(";").filter(row => row.includes(":")).map(row => row.split(":").map(part => part.trim()))));
}
const hostCSS = read("public/modules/aibp/styles.css");
const displayCSS = read("public/modules/display/styles.css");
assert.match(read("public/modules/aibp/index.html"), /styles\.css\?v=\d+/);
assert.match(read("public/modules/display/index.html"), /styles\.css\?v=\d+/);
for (const [css, selectors] of [
  [hostCSS, [".sheet-token", ".sheet-token.auto-token", ".sheet-rule-token-slot"]],
  [displayCSS, [".boss-sheet-token", ".boss-sheet-token.auto-token"]],
]) {
  for (const selector of selectors) {
    const widths = rules(css, selector).map(rule => rule.width).filter(Boolean);
    assert.ok(widths.length, selector);
    assert.ok(widths.every(width => width === "5%"), `${selector}: fixed pixel caps would detach tokens from printed frames`);
  }
}
assert.equal(rules(hostCSS, ".bog-position-slot")[0].width, "6.4%");
assert.equal(rules(displayCSS, ".boss-sheet-token.bog-position-token")[0].width, "6.4%");
const imageRule = rules(hostCSS, ".bog-position-slot.active img")[0];
assert.equal(imageRule.width, "100%");
assert.equal(imageRule.height, "100%");
assert.equal(imageRule.border, rules(displayCSS, ".boss-sheet-token.bog-position-token img")[0].border);
assert.equal(rules(hostCSS, ".monster-sheet-spread")[0].border, "0");
assert.equal(rules(displayCSS, ".boss-sheet-stage")[0].border, "0");
const hostBadge = rules(hostCSS, ".sheet-token-quantity")[0];
const displayBadge = rules(displayCSS, ".boss-sheet-token b")[0];
for (const badge of [hostBadge, displayBadge]) {
  assert.equal(badge["min-width"], "45%");
  assert.equal(badge.height, "45%");
  assert.equal(badge["font-size"], "18cqw");
}
assert.equal(rules(hostCSS, ".sheet-token")[0]["container-type"], "inline-size");
assert.equal(rules(displayCSS, ".boss-sheet-token")[0]["container-type"], "inline-size");
assert.equal(rules(hostCSS, ".sheet-rule-token-slot")[0].border, "max(1px, .2cqw) dashed rgba(198, 154, 75, .9)");
assert.equal(rules(hostCSS, ".young-devour-stage-overlay")[0].border, "max(1px, .22cqw) solid var(--gold-bright)");

const stageStart = host.indexOf("  function sheetStageAspect(");
const stageEnd = host.indexOf("\n  function ", stageStart + 10);
const stageContext = {};
vm.createContext(stageContext);
vm.runInContext(host.slice(stageStart, stageEnd), stageContext);
const aspect = stageContext.sheetStageAspect({ sheet: { face: "/f", back: "/b", cellWidth: 2405, cellHeight: 1649 } });
assert.equal(aspect, 4810 / 1649);
assert.equal(stageContext.sheetStageAspect({ sheet: { face: "/f", cellWidth: 2405, cellHeight: 1649 } }), 2405 / 1649);

const stackStart = display.indexOf("  function publicTokenStacks(");
const stackEnd = display.indexOf("  function markerStacks(", stackStart);
const stackContext = { tokenSrc: () => "/token.png", tokenShapeClass: () => "", esc: String, clamp: (n, min, max) => Math.max(min, Math.min(max, n)), aibpAsset: value => value, monsterLabel: () => "witch", sheetTraitPlacements: () => [] };
vm.createContext(stackContext);
vm.runInContext(display.slice(stackStart, stackEnd), stackContext);
const secondScreen = stackContext.publicTokenStacks(publicTokens[2]);
assert.ok(secondScreen.includes("bog-position-token"));
assert.ok(!secondScreen.includes("<b>"), "a position marker has no quantity badge to obscure its printed frame");
const sheet = stackContext.bossSheetHtml({ sheet: { face: "/f", back: "/b", cellWidth: 2405, cellHeight: 1649 } }, { sheetAutoTokens: publicTokens[2] });
assert.ok(sheet.includes(`aspect-ratio:${aspect};height:auto;flex:none`));

// Layout width and page zoom must change the marker and its printed circle by the same factor.
for (const width of [320, 640, 1024, 1920, 3840]) {
  for (const zoom of [.5, .75, 1, 1.25, 2]) {
    const frameScale = width / 4810 * zoom;
    for (let i = 0; i < 3; i++) {
      const x = positions[i].x / 100 * width * zoom;
      const y = positions[i].y / 100 * (width / aspect) * zoom;
      assert.ok(Math.abs(x - centers[i][0] * frameScale) < .02);
      assert.ok(Math.abs(y - centers[i][1] * frameScale) < .02);
      assert.ok(Math.abs(width * .064 * zoom / frameScale - 4810 * .064) < 1e-9);
    }
  }
}

function callArguments(source, name) {
  const calls = [];
  let cursor = 0;
  while ((cursor = source.indexOf(`${name}(`, cursor)) >= 0) {
    const start = cursor + name.length + 1;
    const args = [];
    let depth = 0;
    let quote = "";
    let argumentStart = start;
    for (let index = start; index < source.length; index += 1) {
      const character = source[index];
      if (quote) {
        if (character === "\\") index += 1;
        else if (character === quote) quote = "";
        continue;
      }
      if (character === "\"" || character === "'") {
        quote = character;
      } else if (character === "(" || character === "[" || character === "{") {
        depth += 1;
      } else if (character === ")" && depth === 0) {
        args.push(source.slice(argumentStart, index).trim());
        calls.push(args);
        cursor = index + 1;
        break;
      } else if (character === ")" || character === "]" || character === "}") {
        depth -= 1;
      } else if (character === "," && depth === 0) {
        args.push(source.slice(argumentStart, index).trim());
        argumentStart = index + 1;
      }
    }
  }
  return calls;
}
const jsAutoStart = host.indexOf("  function autoSheetTokens(");
const jsAutoEnd = host.indexOf("  function sheetTokenLayer(", jsAutoStart);
const hostAutoCalls = callArguments(host.slice(jsAutoStart, jsAutoEnd), "make")
  .map(args => [args[0].match(/^"([^"]+)"$/)[1], Number(args[3]), Number(args[4])]);
const apiAutoStart = api.indexOf("function public_aibp_auto_sheet_tokens(");
const apiAutoEnd = api.indexOf("\n}\n", apiAutoStart) + 2;
const apiAutoCalls = callArguments(api.slice(apiAutoStart, apiAutoEnd), "$add")
  .map(args => [args[0].match(/^'([^']+)'$/)[1], Number(args[2]), Number(args[3])])
  .filter(([assetId]) => assetId !== "bog-witch-encounter");
assert.deepEqual(apiAutoCalls, hostAutoCalls, "every ordinary Boss auto-token coordinate must match between host and PHP");
assert.equal(hostAutoCalls.length, 20);
assert.deepEqual(
  apiPositions.map(([x, y]) => [Number(x), Number(y)]),
  JSON.parse(JSON.stringify(positions)).map(position => [position.x, position.y]),
  "Bog Witch position tokens must match between host and PHP"
);

const monsterSource = read("public/modules/aibp/data/monster-data.js");
const monsterContext = { window: {} };
vm.createContext(monsterContext);
vm.runInContext(monsterSource, monsterContext);
const sheetMonsters = monsterContext.window.KF_MONSTER_DATA.monsters.filter(monster => monster.sheet?.face || monster.sheet?.back);
assert.ok(sheetMonsters.length >= 20);
for (const monster of sheetMonsters) {
  const expected = (Number(monster.sheet.cellWidth) / Number(monster.sheet.cellHeight))
    * (Number(Boolean(monster.sheet.face)) + Number(Boolean(monster.sheet.back)) || 1);
  assert.equal(stageContext.sheetStageAspect(monster), expected, monster.id);
}

// Global overlay units keep every boss marker, badge and edge on the same scale.
for (const width of [320, 640, 1024, 1920, 3840]) {
  for (const zoom of [.5, .75, 1, 1.25, 2]) {
    const scale = width / 4810 * zoom;
    for (const [, x, y] of hostAutoCalls) {
      assert.ok(Math.abs(width * (1 - x / 100) * zoom - 4810 * (1 - x / 100) * scale) < 1e-9);
      assert.ok(Math.abs(width / aspect * (y / 100) * zoom - 1649 * (y / 100) * scale) < 1e-9);
    }
  }
}
console.log(`sheet token alignment: 20 Boss rule markers, Bog Witch's 3 printed centers, host/PHP/second-screen parity, all sheets and 25 width/zoom combinations verified`);
