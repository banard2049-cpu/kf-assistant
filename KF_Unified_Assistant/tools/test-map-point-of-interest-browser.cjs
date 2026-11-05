"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const publicRoot = path.resolve(__dirname, "../public");
const output = path.resolve(__dirname, "../../output/map-front-index/poi-ui-review");
const SAVE_KEY = "kf-map-host-v8";
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") + (url.pathname.endsWith("/") ? "index.html" : "");
  const file = path.resolve(publicRoot, relative);
  if (!file.startsWith(publicRoot + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404); response.end(); return;
  }
  let body = fs.readFileSync(file);
  if (relative === "modules/map/index.html") {
    // Run the real map app without the campaign bridge or a backend session.
    body = Buffer.from(body.toString("utf8").replace(/<script src="\.\.\/module-bridge\.js[^\"]*"[^>]*><\/script>/,
      '<script src="app.js"></script>'));
  }
  response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
  response.end(body);
});

async function readState(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
}

async function seedArrival(page, baseline, origin, target) {
  const fixture = structuredClone(baseline);
  fixture.step = 0;
  fixture.round = 1;
  fixture.kingdom = "SK";
  fixture.trackers = { threat: 0, curse: 0, time: 0, unassignedClues: 0 };
  fixture.log = [];
  Object.assign(fixture.maps.SK, {
    current: origin, selected: origin, startingTile: origin,
    placed: [origin, target], tileState: { [origin]: "explored", [target]: "hidden" },
    tileMeta: {}, history: [], travelRoute: [], tileResolution: null,
    pointOfInterestReminder: null, monsters: [], pendingEncounter: null,
    pathMarkers: [], tileMarkers: [], autoFocus: false,
  });
  Object.assign(fixture.maps.SK.exploration, {
    deck: ["SK:EXP:23909", "SK:EXP:23905", ...baseline.maps.SK.exploration.deck.filter(id => !["SK:EXP:23909", "SK:EXP:23905"].includes(id))],
    current: null, discard: [], resolvedRound: null, peek: false,
  });
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: SAVE_KEY, state: fixture });
  await page.reload();
  await page.locator(`[data-begin="${target}"]`).click();
  await page.locator("#advanceTileButton").click();
  await page.locator("#advanceTileButton").click();
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).step === 2, SAVE_KEY);
  assert.equal(await page.locator(".story-reminder-panel").count(), 0, "the reminder must not appear before the story step");
  return readState(page);
}

async function storyReminder(page, reason) {
  const toast = page.locator(".story-reminder-panel");
  await toast.waitFor({ state: "visible" });
  const text = await toast.innerText();
  assert.match(text, /故事步骤提醒/, `${reason}: the story transition is announced`);
  assert.equal((await readState(page)).step, 3, `${reason}: the flow remains in story`);
  assert.equal(await page.locator(".sidebar-scroll > :first-child .story-reminder-panel").count(), 1,
    `${reason}: story reminder is in the first priority area`);
  assert.equal(await page.locator("#toast").isVisible(), false,
    `${reason}: story entry no longer uses a bottom toast`);
  return text;
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/modules/map/`);
    await page.locator("#tool-tab-travel").waitFor();
    const baseline = await readState(page);

    // Resolve a real new tile before drawing exploration. The later reminder
    // must retain that top card's modifier instead of reading the next card.
    const arrival = await seedArrival(page, baseline, "SK_Tile_LS:1", "SK_Tile_M:3");
    const captured = arrival.maps.SK.pointOfInterestReminder;
    assert.equal(captured.modifier, 3);
    assert.equal(captured.cardId, "SK:EXP:23909");
    assert.equal(captured.points[0].value, 2);
    assert.equal(captured.points[0].result, 5);
    assert.equal(arrival.maps.SK.exploration.deck[0], "SK:EXP:23909",
      "capturing a PoI must leave the card at the top of its deck");
    await page.locator("#drawExploration").click();
    await page.locator("#effectType").selectOption("instant");
    await page.locator("#resolveExploration").click();
    await page.locator("#nextStep").click();
    const numericMessage = await storyReminder(page, "normal exploration");
    assert.match(numericMessage, /2\s*\+\s*3\s*\+\s*0\s*=\s*5/);
    assert.match(numericMessage, /一座古老的水泵/,
      "the numeric reminder includes this kingdom's actual lookup-table title");
    assert.match(numericMessage, /弃置一枚涌水指示物/,
      "the numeric reminder includes the effect, rather than only the lookup number");
    assert.match(numericMessage, /阅读本轮故事段落/);
    assert.match(numericMessage, /时间事件/);
    const story = await readState(page);
    assert.equal(story.maps.SK.exploration.deck[0], "SK:EXP:23905");
    assert.equal(story.maps.SK.pointOfInterestReminder.modifier, 3);
    assert.match(story.log[0].text, /2\s*\+\s*3\s*=\s*5/,
      "the recent history retains the same reminder after its toast disappears");
    assert.equal(await page.locator("#nextStep").innerText(), "完成本轮");

    const beforeBrowsing = story.log.length;
    await page.locator("#tool-tab-tile").click();
    await page.locator("#tool-tab-exploration").click();
    assert.equal((await readState(page)).step, 3, "browsing tools must not change the story phase");
    assert.equal((await readState(page)).log.length, beforeBrowsing,
      "ordinary rerenders must not duplicate the story reminder log");
    await page.reload();
    assert.equal(await storyReminder(page, "reloading a saved numeric story"), numericMessage);
    assert.equal((await readState(page)).log.length, beforeBrowsing,
      "reloading shows the reminder again without adding another history entry");

    const decrease = page.getByRole("button", { name: "兴趣点结果减一", exact: true });
    const increase = page.getByRole("button", { name: "兴趣点结果加一", exact: true });
    const resultValue = page.locator(".story-poi-value");
    await decrease.click();
    assert.equal(await resultValue.innerText(), "4");
    assert.match(await page.locator(".story-poi-formula").innerText(), /2\s*\+\s*3\s*\+\s*\(-1\)\s*=\s*4/);
    assert.match(await page.locator(".story-poi-result").innerText(), /远方的山崩[\s\S]*轮换\s*1/,
      "decreasing the result immediately updates the matching title and effect");
    const corrected = await readState(page);
    assert.equal(corrected.maps.SK.pointOfInterestReminder.modifier, 3,
      "a manual result correction preserves the originally captured modifier");
    assert.equal(corrected.maps.SK.pointOfInterestReminder.points[0].value, 2);
    assert.equal(corrected.maps.SK.pointOfInterestReminder.cardId, captured.cardId);
    assert.deepEqual(corrected.maps.SK.exploration.deck, story.maps.SK.exploration.deck,
      "manual corrections must not draw or reorder exploration cards");
    assert.match(corrected.log[0].text, /手动修正为 4/);
    const executePoi = page.locator("[data-execute-poi]");
    const wheelBefore = corrected.maps.SK.districtWheel;
    await executePoi.click();
    const rotated = await readState(page);
    const districts = await page.evaluate(() => window.KF_MOD_DATA.kingdomRules.SK.districts.map(item => item.id));
    const wheelValues = districts.map(id => wheelBefore[id]);
    wheelValues.unshift(wheelValues.pop());
    assert.deepEqual(districts.map(id => rotated.maps.SK.districtWheel[id]), wheelValues,
      "execute rotates the existing district wheel clockwise exactly once");
    assert.equal(await executePoi.isDisabled(), true);
    assert.equal(await increase.isDisabled(), true, "executed results cannot be changed until undone");
    await page.reload();
    assert.equal(await executePoi.isDisabled(), true, "execution status survives reload");
    await page.locator("#undoButton").click();
    assert.deepEqual((await readState(page)).maps.SK.districtWheel, wheelBefore,
      "undo restores the district wheel and allows execution again");
    assert.equal(await executePoi.isEnabled(), true);
    await page.reload();
    assert.equal(await resultValue.innerText(), "4", "manual results survive save/reload");
    await page.locator("#undoButton").click();
    assert.equal(await resultValue.innerText(), "5", "normal map undo restores the automatic result");
    await increase.click();
    assert.equal(await resultValue.innerText(), "6");
    assert.match(await page.locator(".story-poi-formula").innerText(), /2\s*\+\s*3\s*\+\s*1\s*=\s*6/);
    assert.match(await page.locator(".story-poi-result").innerText(), /黑暗中的轮廓[\s\S]*成功[\s\S]*失败/);
    await decrease.click();
    assert.deepEqual((await readState(page)).maps.SK.pointOfInterestReminder.manualResults, [null],
      "returning to the automatic result clears the manual override");
    assert.doesNotMatch(await page.locator(".story-poi-calculation").innerText(), /已手动修正/);
    assert.match(await page.locator(".story-poi-formula").innerText(), /2\s*\+\s*3\s*\+\s*0\s*=\s*5/);
    await decrease.click();
    await page.screenshot({ path: path.join(output, "story-priority-desktop.png"), fullPage: true });
    await page.locator(".story-reminder-panel").screenshot({ path: path.join(output, "story-priority-panel-desktop.png") });

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileBox = await page.locator(".story-reminder-panel").boundingBox();
    assert.ok(mobileBox && mobileBox.x >= 0 && mobileBox.x + mobileBox.width <= 391,
      "the story reminder fits the mobile viewport");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false,
      "the priority card must not create horizontal page overflow");
    await page.screenshot({ path: path.join(output, "story-priority-mobile.png"), fullPage: true });
    await page.locator(".story-reminder-panel").screenshot({ path: path.join(output, "story-priority-panel-mobile.png") });

    while ((await readState(page)).maps.SK.pointOfInterestReminder.points[0].result > 1) await decrease.click();
    assert.equal(await decrease.isDisabled(), true, "result 1 disables decrement");
    while ((await readState(page)).maps.SK.pointOfInterestReminder.points[0].result < 9) await increase.click();
    assert.equal(await increase.isDisabled(), true, "result 9 disables increment");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false,
      "manual result controls must fit the mobile viewport");
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1100 });
      const [formulaBox, buttonsBox] = await page.evaluate(() =>
        [".story-poi-formula", ".story-poi-adjustment"].map(selector => {
          const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
          return { x, y, width, height };
        }));
      assert.ok(formulaBox && buttonsBox && buttonsBox.x >= formulaBox.x + formulaBox.width,
        `${width}px: both buttons stay to the right of the formula`);
      assert.ok(Math.abs(buttonsBox.y + buttonsBox.height / 2 - formulaBox.y - formulaBox.height / 2) < 2,
        `${width}px: formula and buttons share a centered row`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false,
        `${width}px: the formula row causes no horizontal overflow`);
    }

    // Backtracking still enters story, while not replaying an old tile's PoI.
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.locator("#nextStep").click();
    await page.locator("#backtrackTarget").selectOption("SK_Tile_LS:1");
    await page.locator("#backtrackButton").click();
    await page.locator("#skipExplorationButton").click();
    const noPoiMessage = await storyReminder(page, "backtracking without PoI");
    assert.doesNotMatch(noPoiMessage, /An Ancient Pump|Signs of Struggle|2\s*\+\s*3\s*=\s*5/);
    await page.locator("#nextStep").click();
    await page.locator("#backtrackTarget").selectOption("SK_Tile_M:3");
    await page.locator("#backtrackButton").click();
    await page.locator("#skipExplorationButton").click();
    assert.doesNotMatch(await storyReminder(page, "backtracking onto an old PoI"), /An Ancient Pump|Signs of Struggle|2\s*\+\s*3\s*=\s*5/);

    const namedArrival = await seedArrival(page, baseline, "SK_Tile_S:1", "SK_Tile_L:1");
    assert.equal(namedArrival.maps.SK.pointOfInterestReminder.cardId, null);
    await page.locator("#skipExplorationButton").click();
    const namedMessage = await storyReminder(page, "named point with skipped exploration");
    assert.match(namedMessage, /Signs of Struggle/);
    assert.match(namedMessage, /搜刮\s*1/,
      "a named reminder includes its actual kingdom-specific table effect");
    assert.equal(await page.locator("[data-poi-delta]").count(), 0,
      "a fixed named story has no numeric result to adjust");

    // Missing card metadata must request the original printed modifier rather
    // than silently treating an unknown value as zero.
    await page.evaluate(({ key, fixture }) => {
      fixture.maps.SK.pointOfInterestReminder = window.KF_POINT_OF_INTEREST_RULES.capture(
        "SK_Tile_M:3", fixture.round, { id: "POS:EXP:31126", special: true }
      );
      localStorage.setItem(key, JSON.stringify(fixture));
    }, { key: SAVE_KEY, fixture: structuredClone(story) });
    await page.reload();
    const unknownMessage = await storyReminder(page, "missing numeric modifier");
    assert.match(unknownMessage, /按当时探索牌顶修正后查表/);
    assert.equal(await resultValue.innerText(), "?");
    await increase.click();
    assert.equal(await resultValue.innerText(), "3",
      "without a modifier, the first increment uses the printed tile number as a baseline");
    assert.match(await page.locator(".story-poi-result").innerText(), /漂浮的背包/);
    await page.reload();
    assert.equal(await resultValue.innerText(), "3");
    assert.equal((await readState(page)).maps.SK.pointOfInterestReminder.modifier, null,
      "manual completion must not invent a missing card modifier");
    await page.locator("#undoButton").click();
    assert.equal(await resultValue.innerText(), "?", "undo restores the unknown result");

    // The same table number has a different result in the other kingdom.
    const stoneStory = structuredClone(baseline);
    stoneStory.kingdom = "POS";
    stoneStory.step = 3;
    stoneStory.round = 7;
    Object.assign(stoneStory.maps.POS, {
      current: "POS_Tile_M:2", selected: "POS_Tile_M:2",
      placed: [...new Set([...stoneStory.maps.POS.placed, "POS_Tile_M:2"])],
      tileState: { ...stoneStory.maps.POS.tileState, "POS_Tile_M:2": "explored" }
    });
    await page.evaluate(({ key, fixture }) => {
      const top = window.KF_MOD_DATA.kingdomRules.POS.exploration.find(card => card.id === "POS:EXP:31121");
      fixture.maps.POS.pointOfInterestReminder = window.KF_POINT_OF_INTEREST_RULES.capture(
        "POS_Tile_M:2", fixture.round, top
      );
      localStorage.setItem(key, JSON.stringify(fixture));
    }, { key: SAVE_KEY, fixture: stoneStory });
    await page.reload();
    const stoneMessage = await storyReminder(page, "stone kingdom table result");
    assert.match(stoneMessage, /3\s*\+\s*2\s*\+\s*0\s*=\s*5/);
    assert.match(stoneMessage, /破碎的货车/);
    assert.match(stoneMessage, /4\s*金钱/);
    assert.match(stoneMessage, /DEVIL[\s\S]*12\s*金钱/,
      "the conditional Devil result remains present in the reminder");
    assert.doesNotMatch(stoneMessage, /一座古老的水泵/,
      "kingdom-specific lookup results must not be mixed");
    await decrease.click();
    assert.equal(await resultValue.innerText(), "4");
    assert.match(await page.locator(".story-poi-result").innerText(), /空气中弥漫的紧张感[\s\S]*王国冒险/,
      "a corrected result uses the current kingdom's own table");

    const threatStory = structuredClone(story);
    threatStory.trackers.threat = 5;
    threatStory.maps.SK.history = [];
    threatStory.maps.SK.pointOfInterestReminder.manualResults = [7];
    await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: SAVE_KEY, state: threatStory });
    await page.reload();
    await page.getByRole("button", { name: "执行：威胁 −2", exact: true }).click();
    assert.equal((await readState(page)).trackers.threat, 3, "execute applies threat -2 through the tracker logic");
    assert.equal(await page.locator("[data-execute-poi]").isDisabled(), true);
    await page.locator("#undoButton").click();
    assert.equal((await readState(page)).trackers.threat, 5, "undo restores threat before execution");

    const forcedStory = structuredClone(baseline);
    forcedStory.step = 3;
    forcedStory.maps.SK.selected = "SK_Tile_M:3";
    forcedStory.maps.SK.tileState["SK_Tile_M:3"] = "explored";
    await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: SAVE_KEY, state: forcedStory });
    await page.reload();
    await page.locator("#tool-tab-tile").click();
    const forceButton = page.locator("#selectedBeginButton");
    assert.equal(await forceButton.innerText(), "强制板块结算");
    assert.equal(await forceButton.isEnabled(), true);
    const beforeForce = await readState(page);
    page.once("dialog", dialog => dialog.dismiss());
    await forceButton.click();
    assert.deepEqual(await readState(page), beforeForce, "canceling the force confirmation leaves all state unchanged");
    page.once("dialog", dialog => dialog.accept());
    await forceButton.click();
    const forced = await readState(page);
    assert.equal(forced.maps.SK.current, "SK_Tile_M:3", "force immediately moves the party to the selected tile");
    assert.equal(forced.step, 1);
    assert.equal(forced.maps.SK.tileResolution.stage, "back", "force restarts the full tile settlement");
    await page.locator("#undoButton").click();
    assert.equal((await readState(page)).maps.SK.current, beforeForce.maps.SK.current);
    assert.equal((await readState(page)).step, 3, "undo restores the interrupted step");

    const emptyStory = structuredClone(baseline);
    emptyStory.step = 3;
    emptyStory.round = 8;
    emptyStory.maps.SK.current = "SK_Tile_S:1";
    emptyStory.maps.SK.selected = "SK_Tile_S:1";
    emptyStory.maps.SK.pointOfInterestReminder = null;
    emptyStory.maps.SK.exploration.resolvedRound = 8;
    await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: SAVE_KEY, state: emptyStory });
    await page.reload();
    assert.doesNotMatch(await storyReminder(page, "a saved story step without PoI"), /An Ancient Pump|Signs of Struggle|2\s*\+\s*3\s*=\s*5/);
    assert.equal((await readState(page)).log.length, emptyStory.log.length,
      "an existing story save gets a visible reminder without changing history");
    await page.locator("#nextStep").click();
    const nextRound = await readState(page);
    assert.equal(nextRound.round, 9);
    assert.equal(nextRound.step, 0);
    assert.equal(await page.locator(".story-reminder-panel").count(), 0,
      "completing the round removes its story reminder");
    assert.equal(await page.locator("#tool-tab-travel").getAttribute("aria-selected"), "true");
    assert.deepEqual(errors, [], "browser must not report JavaScript errors");
    console.log("Story reminder browser QA passed: +/- updates both kingdom tables, original capture retained, save/reload, undo, 1..9 boundaries, unknown-modifier completion, named stories unchanged, backtrack non-repeat, round completion, and 1440px/390px layouts.");
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
