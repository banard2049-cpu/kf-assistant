"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");
const stylesSource = fs.readFileSync("public/modules/map/styles.css", "utf8").replace(/\r\n/g, "\n");
const indexSource = fs.readFileSync("public/modules/map/index.html", "utf8");
const panelStart = appSource.indexOf("  function partyOverviewPanel() {");
const panelEnd = appSource.indexOf("\n\n  function tracksPanel()", panelStart);
const matchStart = appSource.indexOf("  function knightMatchesClue(");
const matchEnd = appSource.indexOf("\n\n  function awardClueType", matchStart);

assert.ok(panelStart >= 0 && panelEnd > panelStart, "party overview renderer not found");
assert.ok(matchStart >= 0 && matchEnd > matchStart, "clue eligibility matcher not found");

const panelSource = appSource.slice(panelStart, panelEnd);
const matchSource = appSource.slice(matchStart, matchEnd);
const clues = [
  ["martial", "武艺", "/martial.png"],
  ["errant", "游侠", "/errant.png"],
  ["historic", "历史", "/historic.png"],
  ["mystic", "神秘", "/mystic.png"]
];
const clueCounts = { martial: 1, errant: 2, historic: 3, mystic: 4 };
const knights = [
  { id: "k1", sheetId: "s1", name: "Kara", memberType: "knight", clues: clueCounts, primary: "", secondary: "", task: "mystic" },
  { id: "k2", sheetId: "s2", name: "Stoneface", memberType: "knight", clues: clueCounts, primary: "martial", secondary: "historic", task: "" },
  { id: "k3", sheetId: "s3", name: "Renholder", memberType: "knight", clues: clueCounts, primary: "errant", secondary: "mystic", task: "" },
  { id: "k4", sheetId: "s4", name: "Paracelsa", memberType: "knight", clues: clueCounts, primary: "historic", secondary: "martial", task: "" }
];
const party = knights.map((knight, index) => ({
  id: knight.sheetId,
  sheetId: knight.sheetId,
  name: knight.name,
  type: "knight",
  knightId: `knight-${index + 1}`
}));

function renderParty(stateOverrides = {}) {
  const state = {
    knights: structuredClone(knights),
    mainKnightId: "k1",
    taskMode: true,
    trackers: { unassignedClues: 0 },
    ...stateOverrides
  };
  const context = {
    CLUES: clues,
    Math,
    Number,
    campaignParty: () => party,
    esc: value => String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;"),
    result: "",
    state
  };
  vm.runInNewContext(`${panelSource}\nresult = partyOverviewPanel();`, context);
  return context.result;
}

const selectedMainMarkup = renderParty();
assert.equal((selectedMainMarkup.match(/class="party-member(?:\s|\")/g) || []).length, 4,
  "selecting a main-story knight must not remove that member from the expedition party");
for (const knight of knights) {
  assert.match(selectedMainMarkup, new RegExp(`>${knight.name}<`), `${knight.name} must remain visible in the expedition party`);
}
assert.match(selectedMainMarkup, /--party-records:4/, "the four-member roster must keep four equal records");
const mainCardStart = selectedMainMarkup.indexOf('data-party-member="k1"');
const mainCardEnd = selectedMainMarkup.indexOf('<article class="party-member', mainCardStart + 1);
const mainCardMarkup = selectedMainMarkup.slice(mainCardStart, mainCardEnd);
assert.equal((mainCardMarkup.match(/class="party-resource\s/g) || []).length, 1,
  "the main-story knight must show exactly its task clue requirement");
assert.match(mainCardMarkup, /resource-mystic/);
assert.match(mainCardMarkup, /aria-label="任务"/);

const matchContext = { result: false, state: { mainKnightId: "k1", taskMode: true } };
vm.runInNewContext(`${matchSource}\nresult = knightMatchesClue(${JSON.stringify(knights[0])}, "mystic");`, matchContext);
assert.equal(matchContext.result, true,
  "a main-story knight must receive a clue matching its task objective");
assert.match(appSource, /id="mainKnightTaskSelect"/,
  "the selected main-story knight needs an editable task clue control");
assert.match(appSource, /mainKnightTaskSelect[\s\S]*?mainKnight\.task\s*=\s*event\.target\.value/,
  "changing the task clue control must update the selected main-story knight");

const unassignedMarkup = renderParty({
  mainKnightId: "",
  taskMode: false,
  knights: knights.map(knight => ({ ...structuredClone(knight), primary: "", secondary: "", task: "" }))
});
assert.equal((unassignedMarkup.match(/class="party-resource\s/g) || []).length, 0,
  "members without primary/secondary requirements must not fall back to all four clue controls");
assert.equal((unassignedMarkup.match(/class="party-resource-empty"/g) || []).length, 4,
  "members without requirements need a compact empty-state instead of four controls");

assert.match(stylesSource, /\.party-roster\s*\{[^}]*grid-template-columns:\s*repeat\(var\(--party-records,\s*4\),\s*minmax\(0,\s*1fr\)\)/s,
  "wide rosters must divide the available width evenly between all four members");
assert.match(stylesSource, /\.party-portrait\s*\{[^}]*aspect-ratio:\s*1/s,
  "square avatar artwork must remain square");
assert.doesNotMatch(stylesSource, /\.party-roster\s*\{[^}]*overflow-x:\s*auto/s,
  "the full expedition roster must not be hidden behind horizontal scrolling");
assert.match(stylesSource, /@media \(max-width:\s*759px\)[^]*?\.party-roster\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  "mobile layouts must keep all four members visible in a two-by-two grid");
assert.match(indexSource, /styles\.css\?v=63/);
assert.match(indexSource, /app\.js\?v=110/);

console.log("map expedition party: four members, compact clues and equal responsive cards verified");
