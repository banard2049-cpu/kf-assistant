"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");
const styleSource = fs.readFileSync("public/modules/map/styles.css", "utf8");
const indexSource = fs.readFileSync("public/modules/map/index.html", "utf8");
const functionStart = appSource.indexOf("  function trackNoteText(");
const functionEnd = appSource.indexOf("\n\n  function defaultMap(", functionStart);

assert.ok(functionStart >= 0 && functionEnd > functionStart, "track note normalization functions not found");

const context = {};
vm.runInNewContext(`
  const TRACK_NOTE_MAX_LENGTH = 24;
  ${appSource.slice(functionStart, functionEnd)}
  result = {
    trimmed: trackNoteText("  note  "),
    limited: trackNoteText("123456789012345678901234567890"),
    normalized: normalizeTrackNotes({
      threat: { 3: "  hunt  ", bad: "ignored", 4: "" },
      time: { 8: "conflict" },
      curse: { 2: "bane" }
    }),
    positions: normalizeTrackNotePositions(["5", 3, 3, 11, -1, "bad", 1.5], 10),
    minimums: normalizeTrackers({ threat: -3, curse: "-2", time: -1, unassignedClues: -4 }),
    integers: normalizeTrackers({ threat: 4.9, curse: "3", time: 8.2, unassignedClues: 2 })
  };
`, context);

assert.equal(context.result.trimmed, "note");
assert.equal(context.result.limited.length, 24);
assert.equal(
  JSON.stringify(context.result.normalized),
  JSON.stringify({ threat: { 3: "hunt" }, curse: { 2: "bane" }, time: { 8: "conflict" } })
);
assert.equal(JSON.stringify(context.result.positions), JSON.stringify([3, 5]));
assert.equal(
  JSON.stringify(context.result.minimums),
  JSON.stringify({ threat: 0, curse: 0, time: 0, unassignedClues: 0 })
);
assert.equal(
  JSON.stringify(context.result.integers),
  JSON.stringify({ threat: 4, curse: 3, time: 8, unassignedClues: 2 })
);

assert.match(appSource, /trackNotes: normalizeTrackNotes\(\)/, "new saves must initialize track notes");
assert.match(appSource, /saved\.trackNotes = normalizeTrackNotes\(saved\.trackNotes\)/, "old saves must normalize track notes");
assert.match(appSource, /trackNotes: deepCopy\(state\.trackNotes\)/, "undo snapshots must include track notes");
assert.match(appSource, /state\.trackNotes = normalizeTrackNotes\(item\.trackNotes \|\| state\.trackNotes\)/, "undo must restore track notes");
assert.match(appSource, /data-track-note-form="\$\{id\}"/, "all three tracks must render note editors");
assert.match(appSource, /type="checkbox" data-track-note-value="\$\{id\}"/, "track note values must support multi-selection");
assert.match(appSource, /data-track-note-summary="\$\{id\}"[^>]*>\$\{selectedNotePosition\}<\/summary>/, "track note selectors must show the selected value without a redundant label");
assert.match(appSource, /summary\.textContent = positions\.join\("、"\)/, "multi-selected track values must remain label-free after interaction");
assert.match(appSource, /changedPositions\.forEach\(position => \{ state\.trackNotes\[key\]\[String\(position\)\] = note; \}\)/, "one save must apply a note to every selected value");
assert.match(appSource, /markedPositions\.forEach\(position => \{ delete state\.trackNotes\[key\]\[String\(position\)\]; \}\)/, "clear must apply to every selected value");
assert.match(appSource, /data-track-note-clear="\$\{id\}"[^>]*>清除<\/button>/, "track note clear button must use the short label");
assert.doesNotMatch(appSource, /清除所选/);
assert.match(appSource, /class="track-cell-note"/, "track cells must render note text above their number");
assert.match(appSource, /data-track-note-text="\$\{id\}"[^>]*maxlength="\$\{TRACK_NOTE_MAX_LENGTH\}"/, "note input must enforce its length limit");
assert.match(appSource, /\$\$\('\[data-track-note-form\]'\)/, "note forms must bind save handling");
assert.match(appSource, /delete state\.trackNotes\[key\]\[String\(position\)\]/, "notes must be removable");
assert.match(appSource, /state\.trackNotes = normalizeTrackNotes\(\)/, "reset must clear track notes");
assert.equal(
  (appSource.match(/\{ threat: 0, curse: 0, time: 0, unassignedClues: 0 \}/g) || []).length,
  2,
  "changed starting tiles and resets must start every track at zero"
);
assert.match(appSource, /trackers: normalizeTrackers\(\)/, "new maps must initialize every track at zero");
assert.match(appSource, /Number\(state\.trackers\.time\) !== 0/, "zero must be treated as the initial time");
assert.doesNotMatch(appSource, /time: 1/, "time must never initialize at one");
assert.match(appSource, /saved\.trackers = normalizeTrackers\(saved\.trackers\)/,
  "loaded and imported track values must be clamped to zero");
assert.match(appSource, /state\.trackers = normalizeTrackers\(item\.trackers\)/,
  "undo must not restore negative track values");
assert.match(appSource, /const after = trackerValue\(before \+ Number\(amount \|\| 0\)\)/,
  "threat reductions must stop at zero");
assert.doesNotMatch(appSource, /delve-track-compact|curse-counter|data-track-adjust/, "curse must use the shared track and note controls");
assert.doesNotMatch(styleSource, /delve-track-compact|curse-counter/, "removed curse counter styles must not remain");

assert.match(styleSource, /\.track-note-editor \{/);
assert.match(styleSource, /\.track-note-position-options \{/);
assert.match(styleSource, /grid-template-columns: 46px minmax\(64px, 1fr\) auto auto;/, "numeric track-note selector must stay compact");
assert.match(styleSource, /\.track-curse \.delve-track-heading \{[\s\S]*?grid-template-columns: 34px auto minmax\(0, 1fr\);/, "curse title and compact note controls must share one row");
assert.match(styleSource, /\.track-curse \.track-note-editor \{[\s\S]*?grid-template-columns: 36px minmax\(34px, 1fr\) auto auto;/, "curse note content must use the compact layout");
assert.match(styleSource, /\.track-note-editor button \{[\s\S]*?white-space: nowrap;/, "track-note action labels must remain on one line");
assert.match(styleSource, /button\.delve-track-cell \.track-cell-note \{/);
assert.match(styleSource, /grid-template-rows: 20px 20px 11px;/, "track cell height must remain stable with notes");
assert.match(styleSource, /grid-template-columns: minmax\(340px, 10fr\) minmax\(240px, 6fr\) minmax\(620px, 17fr\);/, "curse must be wider than before while time still receives the most track space");
assert.match(indexSource, /styles\.css\?v=59/);
assert.match(indexSource, /app\.js\?v=99/);

console.log("map track notes: normalization, persistence, controls and styling verified");
