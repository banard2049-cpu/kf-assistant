"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");
const { PNG } = require("pngjs");

const root = path.resolve(__dirname, "../public");
const output = path.resolve(__dirname, "../../output/map-stitch/black-line");
const whiteImage = new PNG({ width: 8, height: 8 });
whiteImage.data.fill(255);
const white = "data:image/png;base64," + PNG.sync.write(whiteImage).toString("base64");
const mime = { ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp" };
const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/review") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><meta charset="utf-8">
      <link rel="stylesheet" href="/modules/map/map-view.css"><link rel="stylesheet" href="/modules/map/styles.css">
      <style>html,body{margin:0;padding:0;background:#17140f}#review{width:max-content;margin-left:.3px;margin-top:.4px}.map-stage{min-width:0}</style>
      <div id="review"></div><script src="/modules/map/data/map-data.js"></script>
      <script src="/modules/map/data/map-layout.js"></script><script src="/modules/map/map-view.js"></script>`);
    return;
  }
  const file = path.resolve(root, decodeURIComponent(url.pathname).replace(/^\/+/, ""));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404); response.end(); return;
  }
  response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(response);
});

(async () => {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const dpr of [1, 1.25, 2]) {
      const page = await browser.newPage({ viewport: { width: 2500, height: 1500 }, deviceScaleFactor: dpr });
      await page.goto(`http://127.0.0.1:${server.address().port}/review`);
      for (const pair of [
        { ids: ["SK_Tile_LS:1", "SK_Tile_M:3"], axis: "v" },
        { ids: ["SK_Tile_LS:1", "SK_Tile_M:5"], axis: "h" }
      ]) {
      for (const interactive of [true, false]) {
        for (const scale of [27.13, 61.25, 103.333, 176.4]) {
          await page.evaluate(({ scale, interactive, white, ids }) => {
            window.scrollTo(0, 0);
            document.body.style.width = "3500px";
            document.body.style.height = "2200px";
            const state = { kingdom: "SK", maps: { SK: { placed: ids, tileState: Object.fromEntries(ids.map(id => [id, "explored"])) } } };
            const geometry = KFMapView.stageGeometry(state, KF_MOD_DATA);
            document.getElementById("review").innerHTML = KFMapView.renderMapStage({ state, data: KF_MOD_DATA, interactive });
            const stage = document.querySelector(".map-stage");
            stage.style.width = `${geometry.worldWidth * scale}px`;
            KFMapView.bindMapStage?.(stage, geometry);
            for (const image of stage.querySelectorAll(".map-tile-image,.map-seam-image")) image.src = white;
          }, { scale, interactive, white, ids: pair.ids });
          await page.waitForFunction(() => [...document.querySelectorAll(".map-tile-image")].every(i => i.complete && i.naturalWidth));
          for (const phase of ["initial", "zoomed-scrolled"]) {
          if (phase === "zoomed-scrolled") await page.evaluate(() => {
            const stage = document.querySelector(".map-stage");
            stage.style.width = `${Number.parseFloat(stage.style.width) * 1.07}px`;
            window.scrollTo(19, 11);
          });
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const seam = await page.evaluate(({ ids, axis }) => {
            const a = document.querySelector(`[data-map-tile-id="${ids[0]}"]`).getBoundingClientRect();
            const b = document.querySelector(`[data-map-tile-id="${ids[1]}"]`).getBoundingClientRect();
            if (axis === "v") {
              const x = (a.right + b.left) / 2;
              const top = Math.max(a.top, b.top), bottom = Math.min(a.bottom, b.bottom);
              return { normal: x, clip: { x: Math.floor(x)-5, y: Math.ceil(top)+4, width: 12, height: Math.min(180, Math.floor(bottom-top)-8) } };
            }
            const y = (a.bottom + b.top) / 2;
            const left = Math.max(a.left, b.left), right = Math.min(a.right, b.right);
            return { normal: y, clip: { x: Math.ceil(left)+4, y: Math.floor(y)-5, width: Math.min(180, Math.floor(right-left)-8), height: 12 } };
          }, pair);
          const buffer = await page.screenshot({ clip: seam.clip });
          const png = PNG.sync.read(buffer);
          const normal = Math.floor((seam.normal-(pair.axis === "v" ? seam.clip.x : seam.clip.y))*dpr);
          let dark = 0, darkest = 255;
          for (let along = 2; along < (pair.axis === "v" ? png.height : png.width)-2; along++) {
            for (let across = normal-1; across <= normal+1; across++) {
              const x = pair.axis === "v" ? across : along;
              const y = pair.axis === "v" ? along : across;
              const i = (y*png.width+x)*4;
              const value = Math.min(png.data[i], png.data[i+1], png.data[i+2]);
              if (value < 250) dark++;
              darkest = Math.min(darkest, value);
            }
          }
          if (dark) {
            fs.writeFileSync(path.join(output, `pixel-seam-${pair.axis}-${dpr}-${scale}-${phase}-${interactive ? "map" : "display"}.png`), buffer);
          }
          assert.equal(dark, 0, `${pair.axis} seam, ${dpr}x display, ${scale}px/unit, ${phase}, ${interactive ? "map" : "display"}: ${dark} background pixels, darkest=${darkest}`);
          }
        }
      }
      }
      // Inspect every physical seam of both complete maps as painted pixels,
      // including boundaries that have no printed passage.
      for (const kingdom of ["SK", "POS"]) {
        const samples = await page.evaluate(({ kingdom, white }) => {
          window.scrollTo(0, 0);
          const state = { kingdom, maps: { [kingdom]: { showAll: true } } };
          const geometry = KFMapView.stageGeometry(state, KF_MOD_DATA);
          document.getElementById("review").innerHTML = KFMapView.renderMapStage({ state, data: KF_MOD_DATA });
          const stage = document.querySelector(".map-stage");
          stage.style.width = `${geometry.worldWidth * 27.13}px`;
          KFMapView.bindMapStage(stage, geometry);
          for (const image of stage.querySelectorAll(".map-tile-image,.map-seam-image")) image.src = white;
          return KF_MAP_LAYOUT.seams.filter(s => geometry.boxes.has(s.a));
        }, { kingdom, white });
        await page.waitForFunction(() => [...document.querySelectorAll(".map-tile-image,.map-seam-image")].every(i => i.complete && i.naturalWidth));
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const points = await page.evaluate(seams => seams.flatMap(s => {
          const a = document.querySelector(`[data-map-tile-id="${s.a}"]`).getBoundingClientRect();
          const b = document.querySelector(`[data-map-tile-id="${s.b}"]`).getBoundingClientRect();
          return [.25, .5, .75].map(t => s.axis === "v"
            ? { x: (a.right+b.left)/2, y: Math.max(a.top,b.top)*(1-t)+Math.min(a.bottom,b.bottom)*t, axis: s.axis, a: s.a, b: s.b }
            : { x: Math.max(a.left,b.left)*(1-t)+Math.min(a.right,b.right)*t, y: (a.bottom+b.top)/2, axis: s.axis, a: s.a, b: s.b });
        }), samples);
        const buffer = await page.screenshot();
        const png = PNG.sync.read(buffer);
        for (const p of points) {
          for (const delta of [-1, 0, 1]) {
            const x = Math.floor(p.x*dpr)+(p.axis === "v" ? delta : 0);
            const y = Math.floor(p.y*dpr)+(p.axis === "h" ? delta : 0);
            const index = (y*png.width+x)*4;
            const color = [...png.data.subarray(index,index+3)];
            if (Math.min(...color) < 250) fs.writeFileSync(path.join(output, `full-map-failure-${kingdom}-${dpr}.png`), buffer);
            assert.ok(Math.min(...color) >= 250, `${kingdom} ${dpr}x: ${p.a} / ${p.b} leaks background at ${x},${y}: ${color}`);
          }
        }
      }

      if (dpr === 1) {
        for (const fixed of [false, true]) {
          await page.evaluate(fixed => {
            window.scrollTo(0, 0);
            const ids = ["SK_Tile_LS:1", "SK_Tile_M:3"];
            const state = { kingdom: "SK", maps: { SK: { placed: ids, tileState: Object.fromEntries(ids.map(id => [id,"explored"])) } } };
            const geometry = KFMapView.stageGeometry(state, KF_MOD_DATA);
            document.getElementById("review").innerHTML = KFMapView.renderMapStage({ state, data: KF_MOD_DATA });
            const stage = document.querySelector(".map-stage");
            stage.style.width = `${geometry.worldWidth*176.4}px`;
            if (fixed) KFMapView.bindMapStage(stage, geometry);
          }, fixed);
          await page.waitForFunction(() => [...document.querySelectorAll(".map-tile-image,.map-seam-image")].every(i => i.complete && i.naturalWidth));
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const clip = await page.evaluate(() => {
            const a = document.querySelector('[data-map-tile-id="SK_Tile_LS:1"]').getBoundingClientRect();
            return { x: Math.floor(a.right)-70, y: Math.floor(a.top)-44, width: 142, height: 456 };
          });
          await page.screenshot({ clip, path: path.join(output, fixed ? "actual-fixed.png" : "actual-before.png") });
        }
      }
      await page.close();
    }
    console.log("map pixel seams: all 199 seams at three display densities; 96 horizontal/vertical, zoom, scroll and screen combinations verified");
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
