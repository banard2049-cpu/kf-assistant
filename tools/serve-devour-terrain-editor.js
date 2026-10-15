// 启动巨兽之腹起始位置打标工具：node tools/serve-devour-terrain-editor.js
// 所有编辑逻辑已内置于 devour-terrain-editor.js（对齐 aibp 编辑地形模式），不再注入补丁脚本。
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PORT = 4198;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".json": "application/json",
};

http.createServer((req, res) => {
  let rel = decodeURIComponent((req.url || "/tools/devour-terrain-editor.html").split("?")[0]);
  if (rel === "/") rel = "/tools/devour-terrain-editor.html";
  const file = path.resolve(ROOT, "." + rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end("not found");
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`巨兽之腹起始位置打标工具：http://localhost:${PORT}/tools/devour-terrain-editor.html`));
