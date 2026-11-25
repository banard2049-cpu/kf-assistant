const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { once } = require("node:events");

test("Docker serves the web app and legacy artwork mount without exposing instance files", async t => {
  const php = spawnSync("php", ["-r", "echo PHP_BINARY;"], { encoding: "utf8" });
  if (php.status !== 0) return t.skip("PHP is unavailable");

  const app = path.resolve(__dirname, "../..");
  for (const image of [app, path.join(app, "tools/packaging/docker")]) {
    const dockerfile = fs.readFileSync(path.join(image, "Dockerfile"), "utf8");
    assert.match(dockerfile, /"-t", "\/app\/public", "\/app\/public\/docker-router\.php"/);
    assert.match(dockerfile, /ln -s \.\.\/assets \/app\/public\/assets/);
    const compose = fs.readFileSync(path.join(image, "compose.yaml"), "utf8");
    assert.match(compose, /:\/app\/data/);
    assert.match(compose, /:\/app\/backups/);
    assert.match(compose, /:\/app\/assets:ro/);
  }

  const tempRoot = fs.realpathSync(os.tmpdir());
  const scratch = fs.mkdtempSync(path.join(tempRoot, "kf-docker-routing-"));
  const fixture = {
    "public/index.html": "app",
    "public/modules/display/index.html": "display",
    "public/api.php": '<?php echo "api";',
    "public/unintended.db": "private",
    "assets/board.png": "artwork",
    "assets/archive.db": "private",
    "data/current.db": "private",
    "data/private.png": "private",
    "backups/backup.db": "private",
    "tools/internal.txt": "private",
    ".env": "private",
  };
  let server, closed;
  try {
    for (const [name, content] of Object.entries(fixture)) {
      const file = path.join(scratch, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
    const linkType = process.platform === "win32" ? "junction" : "dir";
    fs.symlinkSync(path.join(scratch, "assets"), path.join(scratch, "public/assets"), linkType);
    fs.symlinkSync(path.join(scratch, "data"), path.join(scratch, "assets/private"), linkType);
    const router = path.join(scratch, "public/docker-router.php");
    fs.copyFileSync(path.join(app, "public/docker-router.php"), router);

    const socket = net.createServer().listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    socket.close();
    await once(socket, "close");
    server = spawn(php.stdout.trim(), ["-S", "127.0.0.1:" + port, "-t", path.join(scratch, "public"), router], { stdio: "ignore" });
    closed = once(server, "close");
    const get = url => fetch("http://127.0.0.1:" + port + url);
    for (let attempt = 0; ; attempt++) {
      try { assert.equal(await (await get("/")).text(), "app"); break; }
      catch (error) {
        if (attempt >= 20) throw error;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    assert.equal(await (await get("/modules/display/")).text(), "display");
    assert.equal(await (await get("/api.php?route=health")).text(), "api");
    assert.equal(await (await get("/assets/board.png")).text(), "artwork");
    for (const name of [
      "/data/current.db", "/backups/backup.db", "/.env", "/tools/internal.txt",
      "/unintended.db", "/assets/archive.db", "/assets/private/private.png", "/docker-router.php",
    ]) {
      const response = await get(name);
      assert.equal(response.status, 404, name);
      assert.equal(await response.text(), "", name);
    }
  } finally {
    if (server && server.exitCode === null) server.kill();
    if (closed) await closed;
    const resolved = fs.realpathSync(scratch);
    if (path.dirname(resolved) === tempRoot && path.basename(resolved).startsWith("kf-docker-routing-")) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
});
