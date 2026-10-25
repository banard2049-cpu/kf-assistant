#!/usr/bin/env node
"use strict";

const { execFileSync } = require("node:child_process");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "../..");
const allowedImages = new Set([
  "KF_Unified_Assistant/tools/packaging/android/app/src/main/res/drawable-nodpi/ic_launcher.png"
]);
const imageExtension = /\.(?:png|apng|jpe?g|jfif|gif|webp|avif|bmp|ico|cur|icns|svg|tiff?|heic|heif|psd|xcf|jxl)$/i;
const assetDirectory = /(?:^|\/)(?:public\/assets|modules\/[^/]+\/assets)\//i;

try {
  const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024
  }).split("\0").filter(Boolean);
  const forbiddenFiles = trackedFiles.filter(file =>
    assetDirectory.test(file) || (imageExtension.test(file) && !allowedImages.has(file))
  );

  if (forbiddenFiles.length) {
    console.error("Repository asset check failed: game resources and image files must remain untracked.");
    for (const file of forbiddenFiles) console.error(`  ${file}`);
    console.error("Remove these paths from the Git index while keeping the local resource files.");
    process.exitCode = 1;
  } else {
    console.log("Repository asset check passed: no tracked game resources or unexpected images.");
  }
} catch (error) {
  console.error(`Repository asset check failed: ${error.message}`);
  process.exitCode = 1;
}
