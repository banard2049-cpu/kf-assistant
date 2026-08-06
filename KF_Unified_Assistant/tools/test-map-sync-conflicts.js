const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const apiSource = fs.readFileSync(path.join(root, "public", "api.php"), "utf8");
const bridgeSource = fs.readFileSync(path.join(root, "public", "modules", "module-bridge.js"), "utf8");
const mapSource = fs.readFileSync(path.join(root, "public", "modules", "map", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "public", "modules", "map", "index.html"), "utf8");

assert.match(apiSource, /function resolve_campaign_sync_conflict\(/);
assert.match(apiSource, /\$path!==['"]modules\.map['"]/);
assert.match(apiSource, /\$previousRound>\$incomingRound/);
assert.match(apiSource, /\$result\[['"]resolution['"]\]=['"]existing['"]/);
assert.match(apiSource, /\$result=\[['"]value['"]=>\$incoming,['"]resolution['"]=>['"]incoming['"]\]/);
assert.match(apiSource, /BEGIN IMMEDIATE[\s\S]*owned_campaign\(\$db,\$row\[['"]id['"]\],\$user\[['"]id['"]\]\)/);
assert.match(apiSource, /['"]resolution['"]=>\$choice\[['"]resolution['"]\]/);

assert.match(bridgeSource, /conflict\.resolution === "existing"/);
assert.match(bridgeSource, /result\.state\?\.modules\?\.\[moduleName\]/);
assert.match(bridgeSource, /localStorage\.setItem\(storageKey, serialized\)/);
assert.match(bridgeSource, /new CustomEvent\("kf:module-state", \{ detail: selected \}\)/);

assert.match(mapSource, /addEventListener\("kf:module-state"/);
assert.match(mapSource, /state = replacement/);
assert.match(mapSource, /checkLimits\(\);\s*render\(\);/);
assert.match(indexSource, /app\.js\?v=99/);
assert.match(indexSource, /module-bridge\.js\?v=12/);

console.log("map sync conflict regression checks passed");
