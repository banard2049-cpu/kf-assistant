"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync("public/modules/encounter/app.js", "utf8").replace(/\r\n/g, "\n");
const viewSource = fs.readFileSync("public/modules/encounter/encounter-view.js", "utf8").replace(/\r\n/g, "\n");
const stylesSource = fs.readFileSync("public/modules/encounter/styles.css", "utf8").replace(/\r\n/g, "\n");
const indexSource = fs.readFileSync("public/modules/encounter/index.html", "utf8");

assert.match(viewSource, /id=\\?"peekBoardIcons\\?"[^>]*aria-pressed=\\?"false\\?"[^>]*title=\\?"按住查看地图图标\\?"/,
  "the board exposes a press-and-hold icon peek control");
assert.match(appSource, /peekBoardIcons\.addEventListener\("pointerdown"/,
  "pressing the control starts the temporary peek");
for (const eventName of ["pointerup", "pointercancel", "pointerleave", "lostpointercapture"]) {
  assert.match(appSource, new RegExp(`"${eventName}"`), `${eventName} restores board pieces`);
}
assert.match(appSource, /peekBoardIcons\.addEventListener\("keydown"/,
  "keyboard hold starts the temporary peek");
assert.match(appSource, /peekBoardIcons\.addEventListener\("keyup"/,
  "keyboard release restores board pieces");
assert.match(appSource, /peekBoardIcons\.addEventListener\("blur"/,
  "losing focus restores board pieces");
assert.match(stylesSource, /\.board-wrap\.pieces-hidden \.piece \{ visibility: hidden; \}/,
  "peek mode hides every board piece without changing encounter state");
assert.match(indexSource, /styles\.css\?v=14/);
assert.match(indexSource, /app\.js\?v=24/);

console.log("encounter board peek: hold hides all board pieces and release restores them");
