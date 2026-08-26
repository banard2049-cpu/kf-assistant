// Generates a print-ready HTML reproduction of the five Rosegraal Rewards
// sheets straight from the rogue manifest, so the rendered tables always match
// the data the module actually uses.  Run with any Node runtime:
//   node tools/rogue-labels/generate-reward-sheet.js
// Output: public/rogue-rewards.html (open directly or print to PDF).
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..", "..");
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "public/modules/rogue/data.js"), "utf8"), ctx);
const RULES = ctx.window.KF_ROGUE_RULES;

const KNIGHT_NAMES = {
  fleischritter: "Fleischritter", kara: "Kara", "ser-sonch": "Ser Sonch",
  renholder: "Renholder", paracelsa: "Paracelsa", "ser-ubar": "Ser Ubar", stoneface: "Stoneface",
};
const KNIGHT_IDS = RULES.KNIGHTS.map(knight => knight.id);
// Ser Ubar and Stoneface belong to the Ten Thousand Succulent Fears expansion.
const EXPANSION_IDS = new Set(["ser-ubar", "stoneface"]);
const ROWS = [
  ["class", "Class", "C"], ["heroic", "Heroic Arc", "H"], ["peril", "Peril Arc", "P"],
  ["technique", "Technique", "T"], ["virtue", "Virtue", "V"], ["gear", "Gear", "G"], ["wild", "Wild Card", "W"],
];
const VIRTUE_ICON = { Might: "might", Fortitude: "fortitude", Insight: "insight", Sagacity: "sagacity", Bravery: "bravery", Tenacity: "tenacity" };

const esc = value => String(value ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Renders one reward option into a checkbox line, decorating the printed icons
// that the physical sheet shows next to virtue and gold rewards.
function optionHtml(category, text) {
  let decorated = esc(text);
  if (category === "virtue") {
    decorated = decorated.replace(/\+(\d+)\s+(Might|Fortitude|Insight|Sagacity|Bravery|Tenacity)/g,
      (_, n, attr) => `+${n} ${attr} <img class="ico" src="assets/sheet-icons/${VIRTUE_ICON[attr]}.png" alt="">`);
  } else if (category === "wild" && /^\+\d+$/.test(String(text).trim())) {
    decorated = `${decorated} <img class="ico" src="assets/sheet-icons/gold.png" alt="">`;
  }
  return `<span class="opt"><span class="box"></span><span class="opt-text">${decorated}</span></span>`;
}

// Categories whose several entries are all kept (mirrors app.js GRANT_ALL);
// the rest present multiple entries as a choice — the knight picks one.
const GRANT_ALL = new Set(["gear"]);
function badgeHtml(category, count) {
  if (count < 2) return "";
  if (GRANT_ALL.has(category)) return `<span class="badge all">全给</span>`;
  return `<span class="badge pick">${count === 2 ? "二选一" : "多选一"}</span>`;
}
function cellHtml(level, knightId, category) {
  const options = RULES.rewardOptions(level, knightId, category);
  return badgeHtml(category, options.length) + options.map(option => optionHtml(category, option)).join("");
}

const STYLE = `
:root { --ink:#1a1712; --line:#2b2620; --paper:#fbf8f1; --muted:#6b6357; --exp:#f3ead6; }
* { box-sizing:border-box; }
body { margin:0; padding:28px 20px; background:#d9d3c6;
  font-family:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,"Times New Roman",serif;
  color:var(--ink); }
.sheet { background:var(--paper); max-width:1180px; margin:0 auto 34px; padding:30px 34px 20px;
  box-shadow:0 3px 14px rgba(0,0,0,.28); page-break-after:always; }
.sheet:last-child { page-break-after:auto; }
.sheet-title { text-align:center; font-size:40px; font-weight:700; letter-spacing:.06em; }
.sheet-level { text-align:center; font-size:24px; font-weight:700; letter-spacing:.14em;
  display:flex; align-items:center; justify-content:center; gap:16px; margin:6px 0 2px; }
.sheet-level .rule { height:2px; width:120px; background:var(--ink); display:inline-block; }
.expansion-banner { text-align:right; font-size:11px; font-weight:700; color:var(--muted);
  letter-spacing:.03em; margin:2px 4px 10px 0; }
table { width:100%; border-collapse:collapse; table-layout:fixed; }
th,td { border:1px solid var(--line); vertical-align:top; padding:6px 7px; font-size:12px; line-height:1.34; }
thead th { text-align:center; font-weight:700; font-size:13px; background:#f0e9db; padding:8px 6px; }
.corner { width:78px; font-style:italic; font-weight:700; }
.rowhead { width:96px; text-align:left; font-weight:700; white-space:nowrap;
  display:flex; align-items:center; justify-content:space-between; gap:6px; background:#f6efe1; }
.rowletter { border:1px solid var(--ink); border-radius:3px; font-size:10px; padding:0 4px;
  font-family:Georgia,serif; font-weight:700; }
.expansion { background:var(--exp); }
thead th.expansion { background:#ecdfc0; }
.opt { display:flex; align-items:flex-start; gap:5px; margin:1px 0; }
.opt + .opt { margin-top:3px; }
.box { flex:0 0 auto; width:11px; height:11px; border:1.4px solid var(--ink); border-radius:2px; margin-top:2px; }
.opt-text { font-style:italic; }
.badge { display:inline-block; font-size:9px; font-style:normal; font-weight:700; letter-spacing:.04em;
  padding:1px 5px; border-radius:8px; margin-bottom:4px; }
.badge.all { background:#dbeede; color:#1f5130; border:1px solid #78ad86; }
.badge.pick { background:#f3e2d0; color:#7a4a20; border:1px solid #c79a6a; }
.ico { height:13px; width:13px; vertical-align:-2px; }
.sheet-foot { display:flex; align-items:center; justify-content:space-between; margin-top:14px; }
.brand { font-weight:700; letter-spacing:.14em; font-size:13px; }
.pageno { font-weight:700; letter-spacing:.08em; font-size:12px; }
@media print { body { background:#fff; padding:0; } .sheet { box-shadow:none; margin:0; max-width:none; } }
`;

function levelTable(level) {
  const head = KNIGHT_IDS.map(id =>
    `<th class="${EXPANSION_IDS.has(id) ? "expansion" : ""}">${esc(KNIGHT_NAMES[id])}</th>`).join("");
  const body = ROWS.map(([category, label, letter]) => {
    const cells = KNIGHT_IDS.map(id =>
      `<td class="${EXPANSION_IDS.has(id) ? "expansion" : ""}">${cellHtml(level, id, category)}</td>`).join("");
    return `<tr><th class="rowhead"><span class="rowlabel">${esc(label)}</span><span class="rowletter">${esc(letter)}</span></th>${cells}</tr>`;
  }).join("\n");
  // The expansion bracket spans the last two knight columns.
  return `<section class="sheet">
  <div class="sheet-title">ROSEGRAAL REWARDS</div>
  <div class="sheet-level"><span class="rule"></span>LEVEL ${level}<span class="rule"></span></div>
  <div class="expansion-banner">🔒 Ten Thousand Succulent Fears Expansion</div>
  <table>
    <thead><tr><th class="corner">${["I","II","III","IV","V"][level-1]}</th>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="sheet-foot"><span class="brand">KINGDOMS FORLORN</span><span class="pageno">ROSEGRAAL REWARDS ${level}/5</span></div>
</section>`;
}

const sheets = [1, 2, 3, 4, 5].map(levelTable).join("\n");
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Rosegraal Rewards</title>
<style>${STYLE}</style>
</head><body>
${sheets}
</body></html>`;

const outPath = path.join(ROOT, "public/rogue-rewards.html");
fs.writeFileSync(outPath, html);
console.log("wrote", path.relative(ROOT, outPath));

