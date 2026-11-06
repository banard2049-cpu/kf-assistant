"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "../public");
const output = path.resolve(__dirname, "../../output/map-stitch/browser");
const key = "kf-map-host-v8";
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg" };
const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/stitch-review") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><meta charset="utf-8">
      <link rel="stylesheet" href="/modules/map/map-view.css"><link rel="stylesheet" href="/modules/map/styles.css">
      <style>html,body{margin:0;padding:0;background:#17140f}#review{width:max-content}.map-stage{min-width:0}</style>
      <div id="review"></div><script src="/modules/map/data/map-data.js"></script>
      <script src="/modules/map/data/map-layout.js"></script><script src="/modules/map/map-view.js"></script>`);
    return;
  }
  const name = decodeURIComponent(url.pathname).replace(/^\/+/, "") + (url.pathname.endsWith("/") ? "index.html" : "");
  const file = path.resolve(root, name);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404); response.end(); return;
  }
  let body = fs.readFileSync(file);
  if (name === "modules/map/index.html") {
    body = Buffer.from(body.toString().replace(/<script src="\.\.\/module-bridge\.js[^\"]*"[^>]*><\/script>/,
      '<script src="app.js"></script>'));
  }
  response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
  response.end(body);
});

(async () => {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(base + "/stitch-review");
    for (const kingdom of ["SK", "POS"]) {
      for (const interactive of [true, false]) {
        for (const scale of [27, 61.25, 103.333]) {
          const result = await page.evaluate(({ kingdom, interactive, scale }) => {
            const state = { kingdom, maps: { [kingdom]: { showAll: true } } };
            const geometry = KFMapView.stageGeometry(state, KF_MOD_DATA);
            document.getElementById("review").innerHTML = KFMapView.renderMapStage({ state, data: KF_MOD_DATA, interactive });
            document.querySelector(".map-stage").style.width = `${geometry.worldWidth * scale}px`;
            KFMapView.bindMapStage(document.querySelector(".map-stage"), geometry);
            const nodes = [...document.querySelectorAll(".map-tile")];
            const rects = new Map(geometry.shown.map((tile, i) => [tile.id, nodes[i].getBoundingClientRect()]));
            const seams = KF_MAP_LAYOUT.seams.filter(s => rects.has(s.a));
            const gaps = seams.map(s => {
              const a = rects.get(s.a), b = rects.get(s.b);
              return Math.abs(s.axis === "v" ? a.right - b.left : a.bottom - b.top);
            });
            return { count: nodes.length, maxGap: Math.max(...gaps), readOnly: nodes.every(n => n.classList.contains("read-only")) };
          }, { kingdom, interactive, scale });
          assert.equal(result.count, kingdom === "SK" ? 63 : 62);
          // Browser layout uses subpixel fixed-point coordinates, so allow one
          // layout quantum, not an entire rendered pixel of background.
          assert.ok(result.maxGap < .04, `${kingdom} ${scale}: shared browser edges (${result.maxGap}px)`);
          assert.equal(result.readOnly, !interactive);
          await page.waitForFunction(() => [...document.querySelectorAll(".map-tile-image")].every(i => i.complete && i.naturalWidth > 0));
          if (scale === 27) await page.locator(".map-stage").screenshot({ path: path.join(output, `${kingdom}-${interactive ? "map" : "display"}.png`) });
        }
      }
    }

    // Exercise the real app's token drag, save and reload on a rectified,
    // rotated tile rather than testing only the coordinate helper.
    await page.goto(base + "/modules/map/");
    await page.locator("#tool-tab-travel").waitFor();
    const tileId = "POS_Tile_M:3";
    await page.evaluate(({ key, tileId }) => {
      const state = JSON.parse(localStorage.getItem(key));
      state.kingdom = "POS";
      Object.assign(state.maps.POS, { placed: [tileId], current: tileId, selected: tileId,
        tileState: { [tileId]: "explored" }, showAll: false, monsters: [], pathMarkers: [], tileMarkers: [],
        partyPositions: { [tileId]: { x: 35, y: 60 } }, autoFocus: false, scrollLeft: 0, scrollTop: 0 });
      localStorage.setItem(key, JSON.stringify(state));
    }, { key, tileId });
    await page.reload();
    const token = page.locator('.party-location-token[data-map-token="party"]');
    await token.scrollIntoViewIfNeeded();
    const initial = await token.boundingBox();
    const start = { x: initial.x + initial.width / 2, y: initial.y + initial.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 24, start.y + 16, { steps: 8 });
    await page.mouse.up();
    const moved = await token.boundingBox();
    assert.ok(Math.abs(moved.x - initial.x - 24) < .6 && Math.abs(moved.y - initial.y - 16) < .6, "token follows the pointer in rectified artwork");
    await page.waitForFunction(({ key, tileId }) => {
      const p = JSON.parse(localStorage.getItem(key)).maps.POS.partyPositions[tileId];
      return Math.abs(p.x - 35) > 1 || Math.abs(p.y - 60) > 1;
    }, { key, tileId });
    const saved = await page.evaluate(({ key, tileId }) => JSON.parse(localStorage.getItem(key)).maps.POS.partyPositions[tileId], { key, tileId });
    assert.ok(Math.abs(saved.x - 35) > 1 || Math.abs(saved.y - 60) > 1, "drag persists a new source-artwork coordinate");
    await page.reload();
    await token.scrollIntoViewIfNeeded();
    const restored = await token.boundingBox();
    assert.ok(Math.abs(restored.x - moved.x) < .7 && Math.abs(restored.y - moved.y) < .7, "saved token does not jump after reload");
    assert.deepEqual(errors, []);
    console.log("map stitch browser: both kingdoms and displays at three zoom levels; rectified token drag/save/reload verified");
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
