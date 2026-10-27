"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const vm = require("node:vm");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "../public");
const scratch = path.resolve(__dirname, "../../tmp/rogue-stage-transition");
fs.mkdirSync(scratch, { recursive: true });
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ["withergraal-data.js", "data.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, "modules/rogue", file), "utf8"), sandbox);
}
const run = sandbox.window.KF_ROGUE_RULES.freshState();
run.status = "won";
run.nodes.find(node => node.id === "sunken-01").cleared = true;
run.sharedRevives = 8;
run.graalSighs = 3;
run.roster = [{ id: "rogue-1", knightId: "kara", name: "Kara", alive: true, gold: 47, rewards: [] }];
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const file = path.resolve(root, "." + decodeURIComponent(url.pathname).replace(/\/$/, "/index.html"));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end(); return;
  }
  res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.KF_TEST_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    env: { ...process.env, TEMP: scratch, TMP: scratch, TMPDIR: scratch },
    args: [`--disk-cache-dir=${path.join(scratch, "browser-cache")}`] });
  const errors = [];
  const open = async (options = {}) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...options });
    // Exercise the real app and save flow in standalone mode; sync/auth are
    // outside the animation's scope and need no running campaign database.
    await context.route("**/module-bridge.js*", route => route.fulfill({ contentType: "text/javascript", body:
      'const app = document.createElement("script"); app.src = document.body.dataset.originalApp; document.body.appendChild(app);' }));
    await context.addInitScript(value => {
      if (!localStorage.getItem("kf-rogue-path-v2")) localStorage.setItem("kf-rogue-path-v2", JSON.stringify(value));
    }, JSON.parse(JSON.stringify(run)));
    const page = await context.newPage();
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/modules/rogue/`);
    await page.locator("#continueWithergraal").waitFor({ state: "visible" });
    return { context, page };
  };
  const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem("kf-rogue-path-v2")));
  const checkRestored = async page => {
    assert.equal(await page.locator(".graal-transition").count(), 0);
    assert.equal(await page.locator("#app").evaluate(el => el.inert), false);
    assert.equal(await page.evaluate(() => document.body.style.overflow), "");
    assert.equal(await page.evaluate(() => document.activeElement.id), "mapStageSelect");
    const value = await saved(page);
    assert.equal(value.stage, "withergraal");
    assert.equal(value.sharedRevives, 20);
    assert.equal(value.graalSighs, 3);
    assert.equal(value.roster[0].gold, 47);
    assert.equal(value.history.filter(item => item.type === "withergraal-start").length, 1);
  };
  try {
    // Full playback uses the real two map textures and a live GPU burn mask.
    let { page, context } = await open();
    await page.locator("#continueWithergraal").click();
    await page.locator(".graal-transition.is-ready").waitFor();
    assert.equal((await saved(page)).stage, "withergraal", "progress is saved before playback finishes");
    assert.equal(await page.locator("#app").evaluate(el => el.inert), true);
    await page.waitForFunction(() => Number(document.querySelector(".graal-transition")?.dataset.progress) >= .36);
    const carbonPixels = await page.locator(".graal-transition-map canvas").evaluate(canvas => {
      const gl = canvas.getContext("webgl");
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let charred = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 65 && pixels[i + 1] < 55 && pixels[i + 2] < 50) charred++;
      return charred;
    });
    assert.ok(carbonPixels > 1500, "the old paper has broad charred regions, not just a luminous stroke");
    await page.screenshot({ path: path.join(scratch, "desktop-burning.png") });
    await page.locator('.graal-transition[data-phase="revealed"]').waitFor();
    await page.screenshot({ path: path.join(scratch, "desktop-revealed.png") });
    await page.locator(".graal-transition").waitFor({ state: "detached" });
    await checkRestored(page);
    await page.reload();
    await page.locator("#mapStageSelect").waitFor({ state: "visible" });
    assert.equal(await page.locator(".graal-transition").count(), 0, "refresh never replays the cutscene");
    await page.locator("#mapStageSelect").selectOption("rosegraal");
    await page.locator("#mapStageSelect").selectOption("withergraal");
    assert.equal(await page.locator(".graal-transition").count(), 0, "reviewing stages never replays the cutscene");
    await context.close();

    ({ page, context } = await open());
    await page.evaluate(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        return type === "webgl" ? null : getContext.call(this, type, ...args);
      };
    });
    await page.locator("#continueWithergraal").click();
    await page.locator(".graal-transition").waitFor({ state: "detached" });
    await checkRestored(page);
    await context.close();

    ({ page, context } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }));
    await page.locator("#continueWithergraal").click();
    await page.locator('.graal-transition[data-phase="burning"]').waitFor();
    await page.waitForTimeout(1000);
    const box = await page.locator(".graal-transition-map").boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 391 && box.height > 200);
    await page.screenshot({ path: path.join(scratch, "mobile-burning.png") });
    await page.locator(".graal-transition-skip").click();
    await checkRestored(page);
    await context.close();

    ({ page, context } = await open());
    await page.locator("#continueWithergraal").click();
    await page.keyboard.press("Escape");
    await checkRestored(page);
    await context.close();

    ({ page, context } = await open({ reducedMotion: "reduce" }));
    await page.locator("#continueWithergraal").click();
    await checkRestored(page);
    await context.close();

    ({ page, context } = await open());
    await page.route("**/withergraal-tree.jpg*", route => route.abort());
    await page.locator("#continueWithergraal").click();
    await page.locator(".graal-transition").waitFor({ state: "detached" });
    await checkRestored(page);
    await context.close();
    assert.deepEqual(errors, []);
    console.log("Rogue stage transition passed: GPU burn/reveal, charring, saved progress, replay guards, mobile, skip, Escape, reduced motion, missing assets and unavailable WebGL.");
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
