"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const read = path => fs.readFileSync(`public/modules/encounter/${path}`, "utf8");
const context = { window: {} };
vm.runInNewContext(read("data/encounter-data.js"), context);
const source = read("encounter-view.js");
vm.runInNewContext(source, context);
const view = context.window.KFEncounterView, data = context.window.KF_ENCOUNTER_DATA;
const monster = data.monsters.find(item => item.id === "M_Panzerdragon"), level = monster.encounterLevels[0], board = data.boards.dragon;
const appSource = read("app.js");
const range = { isUnavailableBoardSpace: () => false };
vm.runInNewContext(appSource.slice(appSource.indexOf("  function rotateAttackOffset("), appSource.indexOf("  function calculatedAttackTargets(")) + "\nthis.targets = monsterAttackTargets;", range);
const glyphContext = {};
vm.runInNewContext(source.slice(source.indexOf("  const INK_DRAGON_GLYPHS"), source.indexOf("  function inkWarningGlyph(")) + "\nthis.glyphs = INK_DRAGON_GLYPHS;", glyphContext);
const phrases = ["黑炎弹", "毁灭爆裂疾风弹", "巨龙吐息", "原子吐息", "腐蚀吐息", "吾即是大灾变", "铁离子攻城炮"];
const extraGlyphContext = {};
vm.runInNewContext(source.slice(source.indexOf("  const INK_MONSTER_GLYPHS"), source.indexOf("  function inkWarningGlyph(")) + "\nthis.glyphs = INK_MONSTER_GLYPHS;", extraGlyphContext);
for (const character of new Set(phrases.join(""))) assert.ok(glyphContext.glyphs[character]?.length || extraGlyphContext.glyphs[character]?.length, `handwritten glyph exists for ${character}`);
const normalized = html => html.replace(/encounter-ink-\d+/g, "encounter-ink-stable");
for (const [facing, space] of [[90,"1"],[270,"7"],[0,"19"],[180,"1"]]) {
  const piece = { id: "dragon-instance", space, facing, rolls: ["dragon-sword"] };
  const state = { monsterId: monster.id, level: 1, phase: "monster", monsters: [piece], targets: range.targets(piece, level, board, 3) };
  const inkOptions = view.boardInkOptions(state, monster, level);
  assert.equal(inkOptions.dragonBreath, true);
  assert.equal(inkOptions.breathFacing, facing);
  const main = view.renderBoard({ state, data, monster, level }), display = view.renderBoard({ state, data, monster, level, interactive: false });
  const mainInk = main.match(/<svg class="board-ink"[\s\S]*?<\/svg>/)[0], displayInk = display.match(/<svg class="board-ink"[\s\S]*?<\/svg>/)[0];
  assert.equal(normalized(mainInk), normalized(displayInk), "main and display use the same phrase, flow and pen strokes");
  assert.match(mainInk, /data-dragon-fire="true"/);
  assert.match(mainInk, /data-dragon-tail="[1-9]\d*"/);
  assert.match(mainInk, new RegExp(`data-dragon-facing="${facing}"`));
  assert.ok(!/NaN|Infinity/.test(mainInk));
}
const cells = Array.from({ length: 27 }, (_, i) => i + 1).filter(cell => (cell - 1) % 9 >= 3);
const seen = new Set();
for (let batch = 1; batch <= 48; batch++) {
  const options = { dragonBreath: true, breathFacing: 90, warningSeed: batch };
  const html = view.renderBoardInk(new Map(), cells, board, options);
  const phrase = html.match(/data-dragon-phrase="([^"]+)"/)[1];
  seen.add(phrase);
  assert.equal(normalized(html), normalized(view.renderBoardInk(new Map(), cells, board, options)), "the phrase remains stable while selecting or dragging pieces");
  const caption = html.slice(html.indexOf('data-dragon-caption="true"'), html.indexOf('data-dragon-tail='));
  const sizes = [...caption.matchAll(/data-warning-box="([^"]+)"/g)].map(match => Number(match[1].split(",")[2]));
  assert.ok(sizes.every(size => size > 70), "the long strip uses larger handwriting than normal cell warnings");
  const tail = html.slice(html.indexOf('data-dragon-tail='));
  assert.match(tail, /data-warning-side="tail"/);
  const tailCenters = [...tail.matchAll(/data-warning-box="([^"]+)"/g)].map(match => {
    const box = match[1].split(",").map(Number); return box[0] + box[2] / 2;
  });
  assert.ok(tailCenters.at(-1) >= 850, "exclamation marks continue to the strip's far end");
}
assert.deepEqual([...seen].sort(), [...phrases].sort(), "all seven requested phrases occur in the random pool");
assert.equal(view.boardInkOptions({ monsterId: "M_Toadragon" }, { id: "M_Toadragon" }, level).dragonBreath, false);
assert.doesNotMatch(view.renderBoardInk(new Map(), cells, board), /data-dragon-phrase=/, "other monsters retain normal warnings");
assert.doesNotMatch(view.renderBoardInk(new Map(), [1,2,10], board, { dragonBreath: true }), /data-dragon-phrase=/, "an irregular edited range stays cell-safe");
assert.match(appSource, /renderBoardInk\(matches, targets, board,\s*window\.KFEncounterView\.boardInkOptions\(/, "selection updates preserve the dragon overlay");
console.log("dragon breath: seven handwritten phrases, terminal punctuation, flames, all facings, main/display consistency and selection stability passed");
