"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const read = filename => fs.readFileSync(path.resolve(__dirname, "..", filename), "utf8");
const api = read("public/api.php");
const bridge = read("public/modules/module-bridge.js");
const aibp = read("public/modules/aibp/app.js");
const display = read("public/modules/display/app.js");
const displayStyles = read("public/modules/display/styles.css");
const index = read("public/modules/display/index.html");
const mapIndex = read("public/modules/map/index.html");
const mapApp = read("public/modules/map/app.js");
const mapView = read("public/modules/map/map-view.js");
const mapViewStyles = read("public/modules/map/map-view.css");
const encounterIndex = read("public/modules/encounter/index.html");
const encounterApp = read("public/modules/encounter/app.js");
const encounterView = read("public/modules/encounter/encounter-view.js");
const main = read("public/index.html");
const mainApp = read("public/app.js");

assert.match(api, /function default_presentation_state/);
assert.match(api, /'conflictRotation'=>90/);
assert.match(api, /in_array\(\$conflictRotation,\[90,270\],true\)\?\$conflictRotation:90/);
assert.match(api, /\$route === 'display-state' && \$method === 'GET'/);
assert.match(api, /HTTP_IF_NONE_MATCH/);
assert.match(api, /http_response_code\(304\)/);
assert.match(api, /public_aibp_display_state/);
assert.match(api, /'aiDeckCount'/);
assert.match(api, /'bpDeckCount'/);
assert.match(api, /\$public\['aiDeckLevels'\]/);
assert.match(api, /\$public\['bpDeckLevels'\]/);
assert.doesNotMatch(api.match(/function public_aibp_display_state[\s\S]*?\n\}/)?.[0] || "", /'aiDeck','bpDeck'/);
assert.match(api, /\$revealed\?text_value\(\$slot\['id'\]/);
assert.match(api, /'occupied'=>text_value\(\$slot\['id'\]/);
assert.doesNotMatch(api.match(/function public_aibp_display_state[\s\S]*?\n\}/)?.[0] || "", /patient|aiChoiceIds/);
assert.match(api, /\$monsterId==='M_KnightFen'/);
assert.match(api, /\$monsterId==='M_WhiteApe'/);
assert.match(api, /'cardIds'=>\$revealed\?\$cards:\[\]/);
assert.match(api, /\$public\['bossMobTrack'\]/);

assert.match(bridge, /new BroadcastChannel\("kf-presentation"\)/);
assert.match(bridge, /operationQueue/);
assert.match(bridge, /presentation\.scene/);
assert.match(bridge, /presentation\.updatedAt/);
assert.match(bridge, /presentation\.sourceClientId/);

assert.match(aibp, /conflictBoard: buildConflictBoard/);
assert.match(aibp, /normalized\.conflictBoard = normalizeConflictBoard/);
assert.match(aibp, /battle\.conflictBoard = buildConflictBoard/);
assert.match(aibp, /randomOrientations/);
assert.match(aibp, /mobAssignments/);
assert.match(aibp, /knightAssignments: conflictKnightAssignments/);
assert.match(aibp, /member\.type === "squire" \? member\.squireId : member\.knightId/);
assert.match(aibp, /terrain: defaultConflictTerrain/);
assert.match(aibp, /normalizeConflictTerrain\(raw\?\.terrain/);
assert.match(aibp, /data-terrain-board/);
assert.match(aibp, /data-terrain-rotate/);
assert.match(aibp, /data-terrain-flip/);
assert.match(aibp, /data-terrain-delete/);
assert.match(aibp, /data-terrain-reset/);
assert.match(aibp, /function conflictTerrainCards/);
assert.match(aibp, /data-terrain-card=/);
assert.match(aibp, /showTerrainCardPreview/);
assert.ok(aibp.includes('value.includes("/") ? value.replace'), "地形卡整图路径必须可以直接解析");
const conflictAssetSrcSource = aibp.match(/function conflictAssetSrc[\s\S]*?\n  \}/)?.[0] || "";
const conflictAssetContext = {window:{KF_CONFLICT_BOARD_DATA:{assets:{Column:"assets/conflict/terrain/column.png"}}}};
vm.runInNewContext(`${conflictAssetSrcSource}; result = {
  mapped: conflictAssetSrc("Column"),
  sheet: conflictAssetSrc("assets/conflict/terrain-card-sheet.jpg"),
  unknown: conflictAssetSrc("Missing")
};`, conflictAssetContext);
assert.deepStrictEqual(JSON.parse(JSON.stringify(conflictAssetContext.result)), {
  mapped:"../display/assets/conflict/terrain/column.png",
  sheet:"../display/assets/conflict/terrain-card-sheet.jpg",
  unknown:""
});
assert.match(aibp, /\["knight", "monster", "number"\]\.includes\(item\.kind\) \|\| item\.asset === "LictorDecoy"/);
assert.match(aibp, /function rotateConflictTerrain/);
assert.match(aibp, /placement => rotateConflictTerrain\(placement, delta\)/);
assert.match(aibp, /transform:translate\(-50%,-50%\) rotate\(\$\{placement\.rotation\}deg\)/);
const terrainBindingSource = aibp.match(/\$\$\('\[data-terrain-id\]'\)[\s\S]*?\$\$\('\[data-terrain-rotate\]'\)/)?.[0] || "";
assert.match(terrainBindingSource, /if \(selectedTerrainId !== button\.dataset\.terrainId\) \{\s*event\.stopPropagation\(\)/);
assert.match(terrainBindingSource, /\[data-terrain-board\][\s\S]*?if \(!selectedTerrainId\) return;/);
assert.doesNotMatch(terrainBindingSource, /event\.target\.closest\('\[data-terrain-id\]'\)/);
const renderAibpSource = aibp.match(/function renderApp\(\)[\s\S]*?\n  function bindEvents/)?.[0] || "";
assert.ok(renderAibpSource.indexOf("操作日志") < renderAibpSource.indexOf("conflictBoardEditorHtml(monster, b)"), "冲突版图必须位于 AIBP 最底部");

assert.match(index, /id="displayRoot"/);
assert.match(index, /\.\.\/map\/map-view\.js/);
assert.match(index, /\.\.\/map\/map-view\.css/);
assert.match(mapIndex, /map-view\.js/);
assert.match(mapIndex, /map-view\.css/);
assert.match(mapApp, /KFMapView\.renderMapStage/);
assert.match(display, /KFMapView\?\.renderMapStage/);
assert.match(display, /interactive:\s*false/);
assert.match(display, /function terrainCardsFor/);
assert.match(display, /conflict-terrain-card-list/);
assert.match(display, /\["knight","monster","number"\]\.includes\(item\.kind\) \|\| item\.asset === "LictorDecoy"/);
assert.match(display, /KFMapView\.renderKingdomBoard/);
assert.match(display, /KFMapView\.renderDistrictExplorationCards/);
assert.match(display, /KFMapView\.renderClueTracking/);
assert.match(display, /骑士线索追踪/);
assert.match(display, /function keepPartyInMapViewport/);
assert.match(display, /querySelector\("\.party-location-token"\)/);
assert.match(display, /requestAnimationFrame\(\(\) => requestAnimationFrame\(keepPartyInMapViewport\)\)/);
assert.match(displayStyles, /data-display-token-kind="monster"/);
assert.match(displayStyles, /width:min\(28cqw,28cqh,74px\)/);
assert.match(mapView, /function renderMapStage/);
assert.match(mapView, /function renderKingdomBoard/);
assert.match(mapView, /function renderExplorationCard/);
assert.match(mapView, /function renderDistrictExplorationCards/);
assert.match(mapView, /current\.exploration\?\.activeEffect/);
assert.match(mapView, /current\.exploration\?\.districtEffects/);
assert.match(mapViewStyles, /\.kingdom-active-exploration/);
assert.match(displayStyles, /\.sidebar-clue-panel/);
assert.match(displayStyles, /\.sidebar-clue-panel \.display-clue-list\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\);gap:6px;overflow:hidden\}/);
assert.match(displayStyles, /\.sidebar-clue-panel \.display-clue-values\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);gap:3px\}/);
assert.match(displayStyles, /\.display-body \.delve-tracks\{grid-template-columns:max-content max-content max-content/);
assert.match(displayStyles, /\.display-body \.delve-track\{grid-template-columns:auto auto/);
assert.match(displayStyles, /\.display-body \.track-time \.delve-track-cells\{grid-template-columns:repeat\(var\(--track-cells\),22px\)/);
assert.match(displayStyles, /@media\(min-width:3000px\) and \(min-height:1700px\)/);
assert.match(displayStyles, /\.map-scene\{grid-template-columns:minmax\(0,1fr\) clamp\(960px,27vw,1160px\)\}/);
assert.match(displayStyles, /\.sidebar-clue-panel \.display-clue-list\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\);gap:8px;overflow:hidden\}/);
assert.match(index, /styles\.css\?v=38/);
assert.match(index, /app\.js\?v=30/);
assert.match(index, /map-view\.js\?v=8/);
assert.doesNotMatch(mapView, /<figcaption>激活效果<\/figcaption>/,
  "active effect cards must not show the removed corner label");
assert.strictEqual((mapView.match(/active: \{ x: 72\.5, y: 50, width: 31 \}/g) || []).length, 2);
assert.strictEqual((mapApp.match(/active: \{ x: 72\.5, y: 50, width: 31 \}/g) || []).length, 2);
const renderMapSource = display.match(/function renderMap\(payload\)[\s\S]*?\n  function renderEncounter/)?.[0] || "";
assert.ok(renderMapSource.indexOf("display-kingdom-board") < renderMapSource.indexOf("display-district-section"));
assert.ok(renderMapSource.indexOf("display-district-section") < renderMapSource.indexOf("sidebar-clue-panel"));
assert.match(display, /function renderMapAutoPreview/);
assert.match(display, /current\.fog\?\.active === true/);
assert.match(display, /function renderFogPreview/);
assert.match(display, /function renderCurrentTilePreview/);
assert.match(display, /mapTileAngle\(tile\)/);
assert.match(renderMapSource, /renderMapAutoPreview\(state, current\)/);
assert.doesNotMatch(renderMapSource, /深入轮|当前步骤|怪物标记|地图标记/);
assert.doesNotMatch(renderMapSource, /KINGDOM BOARD|REGION EFFECTS|各区域探索卡/);
assert.match(displayStyles, /\.map-side-scroll\{min-height:0;display:grid;grid-template-rows:auto auto minmax\(0,1fr\);gap:8px;padding:12px;overflow:hidden\}/);
assert.match(displayStyles, /\.map-auto-preview\{min-width:0;min-height:0;display:grid;grid-template-rows:auto minmax\(0,1fr\)/);
assert.match(displayStyles, /\.map-auto-preview-body\{[^}]*overflow:hidden/);
assert.match(displayStyles, /\.map-auto-tile-frame\{[^}]*width:min\(96cqw,calc\(96cqh \* var\(--preview-aspect\)\)\);height:min\(96cqh,calc\(96cqw \/ var\(--preview-aspect\)\)\)/);
const mapPreviewSources = ["mapAsset", "mapTileAngle", "renderCurrentTilePreview", "renderFogPreview", "renderMapAutoPreview"]
  .map(name => display.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n  \\}`))?.[0] || "")
  .join("\n");
const mapPreviewContext = {
  esc: value => String(value ?? ""),
  window: {
    KF_MOD_DATA: {
      maps: { SK: { tiles: [
        { id:"tile-1",size:"S",number:1,rotation:270,image:{aspect:.5,face:"assets/tile-face.jpg",back:"assets/tile-back.jpg"} },
        { id:"tile-2",size:"S",number:2,rotation:180,image:{aspect:.5,face:"assets/target.jpg",back:"assets/target-back.jpg"} }
      ] } },
      kingdomRules: { SK: { deepFog: [
        { id:"fog-1",image:{aspect:.6,face:"fog-face.jpg",back:"fog-back.jpg"} },
        { id:"fog-2",image:{aspect:.6,face:"fog-face.jpg",back:"fog-back.jpg"} },
        { id:"fog-3",image:{aspect:.6,face:"fog-face.jpg",back:"fog-back.jpg"} }
      ] } }
    },
    KFMapView: {
      tileLabel: tile => tile ? `${tile.size}-${tile.number}` : "未知",
      renderExplorationCard: ({card,side}) => `<card data-id="${card.id}" data-side="${side}"></card>`
    }
  }
};
vm.runInNewContext(`${mapPreviewSources}; result = {
  tile: renderMapAutoPreview({kingdom:"SK"},{current:"tile-1",tileState:{"tile-1":"explored"},fog:{active:false}}),
  hidden: renderCurrentTilePreview({kingdom:"SK"},{current:"tile-1",tileState:{}}),
  fog: renderMapAutoPreview({kingdom:"SK"},{current:"tile-1",fog:{active:true,target:"tile-2",started:true,used:[{cardId:"fog-1",x:0,y:0},{cardId:"fog-2",x:1,y:0},{cardId:"fog-3",x:1,y:1}],route:[{cardId:"fog-2",x:1,y:0},{cardId:"fog-3",x:1,y:1}]}})
};`, mapPreviewContext);
assert.match(mapPreviewContext.result.tile, /quarter-turn/);
assert.match(mapPreviewContext.result.tile, /--preview-aspect:2;--preview-angle:90deg/);
assert.match(mapPreviewContext.result.tile, /tile-face\.jpg/);
assert.match(mapPreviewContext.result.hidden, /tile-back\.jpg/);
assert.match(mapPreviewContext.result.fog, /弥雾路径/);
assert.match(mapPreviewContext.result.fog, /前往 S-2/);
assert.doesNotMatch(mapPreviewContext.result.fog, /data-id="fog-1"/);
assert.match(mapPreviewContext.result.fog, /data-id="fog-2" data-side="face"/);
assert.match(mapPreviewContext.result.fog, /data-id="fog-3" data-side="face"/);
assert.match(mapPreviewContext.result.fog, /--fog-columns:2;--fog-aspect:1\.2/);
assert.match(mapPreviewContext.result.fog, /grid-column:1;grid-row:1[\s\S]*grid-column:2;grid-row:1/);
assert.match(displayStyles, /\.display-fog-preview\{[^}]*grid-template-rows:minmax\(0,1fr\);grid-auto-flow:column/);
assert.match(displayStyles, /\.display-district-effects\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\);gap:8px;overflow:hidden\}/);
assert.match(displayStyles, /\.display-district-effects:has\(>\.display-district-effect:nth-child\(4\)\)\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)\}/);
assert.doesNotMatch(displayStyles, /\.display-district-effects\{[^}]*overflow-[xy]:auto/);
assert.match(mapView, /function renderClueTracking/);
assert.match(mapView, /function renderDelveTracks/);
assert.match(mapApp, /KFMapView\.renderDelveTracks/);
assert.match(mapApp, /heroId: member\.type === "squire"/);
assert.match(mapApp, /normalizedInitialState/);
assert.match(display, /KFMapView\?\.renderDelveTracks/);
assert.match(display, /scene !== "map"/);
assert.match(display, /displayHeader\.hidden = true/);
for (const clue of ["martial", "errant", "historic", "mystic"]) assert.match(mapView, new RegExp(`\\["${clue}"`));
const clueRenderer = mapView.match(/function renderClueTracking[\s\S]*?\n  \}/)?.[0] || "";
assert.doesNotMatch(clueRenderer, /<button|addEventListener|onclick/);
assert.match(clueRenderer, /data-clue-role="\$\{role\}"/);
assert.match(clueRenderer, /knight\.primary, "primary"/);
assert.match(clueRenderer, /knight\.secondary, "secondary"/);
assert.doesNotMatch(clueRenderer, /CLUES\.map/);
assert.doesNotMatch(clueRenderer, /<small>|<span><small>/);
assert.match(index, /\.\.\/encounter\/encounter-view\.js/);
assert.match(index, /\.\.\/encounter\/encounter-view\.css/);
assert.match(index, /\.\.\/aibp\/data\/localized-sheets\.js/);
assert.match(index, /\.\.\/aibp\/data\/localized-traits\.js/);
assert.match(encounterIndex, /encounter-view\.js/);
assert.match(encounterIndex, /encounter-view\.css/);
assert.match(encounterApp, /KFEncounterView\.renderBoard/);
assert.match(encounterApp, /KFEncounterView\.renderCard/);
assert.match(display, /KFEncounterView\?\.renderBoard/);
assert.match(display, /KFEncounterView\.renderCard/);
assert.match(encounterView, /footprint-\$\{footprint\}/);
assert.match(encounterView, /attackTargetsVisible/);
assert.match(encounterView, /match match-both/);
assert.match(encounterView, /isUnavailableBoardSpace/);
assert.match(display, /If-None-Match/);
assert.match(display, /setInterval\(\(\)=>\{poll\(\)/);
assert.match(display, /renderMap/);
assert.match(display, /renderEncounter/);
assert.match(display, /renderConflict/);
assert.match(display, /function applyConflictSidebarLayout/);
assert.match(display, /quarterTurn \? sideHeight : sideWidth/);
assert.match(display, /quarterTurn \? sideWidth : sideHeight/);
assert.match(display, /--sidebar-rotation", `\$\{-effectiveRotation\}deg`/);
assert.match(display, /content\.classList\.toggle\("quarter-turn", quarterTurn\)/);
assert.match(display, /const normalized = Number\(rotation\) === 270 \? 270 : 90/);
assert.match(display, /const rotation=Number\(settings\.conflictRotation\)===270\?270:90/);
assert.match(display, /content\.classList\.toggle\("aibp-mirror", boardVisible === false\)/);
assert.match(display, /content\.style\.removeProperty\("--mirror-primary-width"\)/);
assert.match(display, /content\.style\.removeProperty\("--quarter-primary-width"\)/);
assert.match(display, /content\.style\.removeProperty\("--mirror-mob-card-height"\)/);
assert.match(display, /--mirror-mob-card-height",`\$\{mobCard\.offsetHeight\}px`/);
assert.match(display, /const primaryWidth=primary\.clientWidth/);
assert.match(display, /const scalableHeight=boss\.offsetHeight\+mob\.offsetHeight/);
assert.match(display, /const fixedHeight=fixedRows\.reduce\(\(sum,row\)=>sum\+row\.offsetHeight,0\)/);
assert.doesNotMatch(display, /primary\.getBoundingClientRect\(\)\.width|boss\.getBoundingClientRect\(\)\.height|mob\.getBoundingClientRect\(\)\.height/);
assert.match(display, /const fixedRows=boardVisible===false\?\[primary\?\.querySelector\("\.conflict-hero-clues"\),primary\?\.querySelector\("\.conflict-mirror-primary-cards"\)\]\.filter\(Boolean\):\[\]/);
assert.match(display, /const targetWidth=primaryWidth\*Math\.max\(1,availableHeight-fixedHeight-gapHeight\)\/Math\.max\(1,scalableHeight\)/);
assert.match(display, /const reservedWidth=boardVisible===false\?64:24/);
assert.match(display, /const property=boardVisible===false\?"--mirror-primary-width":"--quarter-primary-width"/);
assert.match(display, /content\.style\.setProperty\(property,`\$\{Math\.min\(targetWidth,maxWidth\)\}px`\)/);
assert.match(display, /--board-scale:\$\{scale\/100\}/);
assert.doesNotMatch(display, /--board-scale:\$\{scale\/100\};--rotation/);
assert.doesNotMatch(display, /board-quarter-turn/);
assert.doesNotMatch(display, /conflict-board-shell" style="width:\$\{scale\}%/);
assert.match(display, /boardState\.knightAssignments/);
assert.match(display, /bossSheetHtml\(monster,battle\)/);
assert.match(display, /aria-label="Boss 大卡"/);
assert.match(display, /publicMobTrack\(monster,battle,featureEntries\)/);
assert.match(display, /aria-label="杂兵 BP 轨"/);
assert.match(display, /const bossTrack=!standardSlots&&\["doppelganger","guardian"\]\.includes\(battle\?\.bossMobTrack\?\.type\)/);
assert.match(display, /if\(!standardSlots&&!bossTrack\)return \{html:"",used:0\}/);
assert.match(display, /const filler=!occupied&&fillers\[used\]\?\.card\?fillers\[used\+\+\]:null/);
assert.match(display, /data-public-feature/);
assert.match(display, /function conflictHeroClues\(state\)/);
assert.match(display, /clueValue\(hero,hero\.primary,"主要"\)\}\$\{clueValue\(hero,hero\.secondary,"次要"\)/);
assert.match(display, /const primaryFollowup=boardVisible\s*\? mobTrack\.html\s*: `\$\{mobTrack\.html\}\$\{heroClues\}\$\{featureSection\}\$\{mirrorPrimaryCards\}`/);
assert.doesNotMatch(display, /BOSS PANEL|怪物大卡|MOB BP TRACK|战术 \/ 公开特质/);
assert.match(display, /正在结算的卡牌/);
assert.match(display, /publicDeckSummary\(battle\)/);
assert.match(display, /battle\.aiDeckLevels/);
assert.match(display, /battle\.bpDeckLevels/);
assert.match(display, /AI、BP 等级顺序和损伤量/);
assert.match(display, /Array\.from\(\{length:10\}/);
assert.match(display, /data-track-slot-count="10"/);
assert.match(displayStyles, /\.display-mob-track\{display:grid;grid-template-columns:repeat\(10,minmax\(0,1fr\)\)/);
assert.match(displayStyles, /\.display-mob-slot\{[^}]*min-height:0;aspect-ratio:\.7/);
assert.match(displayStyles, /\.display-track-card\{position:absolute;inset:2px/);
assert.match(displayStyles, /\.display-track-stack\{position:absolute;inset:2px\}/);
assert.match(displayStyles, /\.display-guardian-figure\{position:absolute/);
assert.match(display, /slot\.occupied===true/);
assert.match(display, /slot\.revealed&&slot\.id/);
assert.match(display, /\/assets\/heroes\/\$\{esc\(knight\.heroId\)\}-avatar\.jpg/);
assert.match(display, /function applyBoardCrop/);
assert.match(display, /imageWidth\/cropWidth\*100/);
assert.match(displayStyles, /--board-image-width/);
assert.match(displayStyles, /--board-image-height/);
assert.match(displayStyles, /--board-track:calc\(\(100vh - 28px\)\*1\.4\)/);
assert.match(displayStyles, /\.conflict-board-shell\{[^}]*transform:scale\(var\(--board-scale,1\)\)/);
assert.doesNotMatch(displayStyles, /\.conflict-board-shell\{[^}]*rotate/);
assert.match(displayStyles, /\.conflict-side-content\{[^}]*rotate\(var\(--sidebar-rotation,0deg\)\)/);
assert.match(displayStyles, /\.conflict-side-content\.quarter-turn,\.conflict-side-content\.aibp-mirror\{grid-template-columns/);
assert.match(displayStyles, /\.conflict-scene\.board-hidden\{width:100%;height:100vh;min-height:100vh\}/);
assert.match(displayStyles, /\.conflict-scene\.board-hidden \.conflict-side\{width:100%;height:100%;min-height:100%;border:0\}/);
assert.match(displayStyles, /\.conflict-scene\.board-hidden \.conflict-side-content\.aibp-mirror\{[^}]*width:100%!important;height:100%!important;transform:none\}/);
assert.match(displayStyles, /\.conflict-side-content\.quarter-turn \.conflict-side-head,\.conflict-side-content\.aibp-mirror \.conflict-side-head\{display:none\}/);
assert.match(displayStyles, /@media\(orientation:portrait\)/);
assert.match(displayStyles, /\.conflict-side-content:not\(\.quarter-turn\):not\(\.aibp-mirror\) \.conflict-side-head\{display:none\}/);
assert.match(displayStyles, /\.conflict-side-content\.quarter-turn \.conflict-landscape-extras,\.conflict-side-content\.aibp-mirror \.conflict-landscape-extras\{display:none\}/);
assert.match(displayStyles, /\.conflict-side-content\.quarter-turn,\.conflict-side-content\.aibp-mirror\{grid-template-columns:minmax\(0,2\.05fr\) minmax\(0,1fr\)/);
assert.match(displayStyles, /\.conflict-side-content\.quarter-turn \.boss-sheet-block,\.conflict-side-content\.aibp-mirror \.boss-sheet-block\{display:grid;grid-template-rows:minmax\(0,1fr\);flex:1 1 0;[^}]*overflow:hidden\}/);
assert.match(displayStyles, /\.conflict-side-content\.quarter-turn \.boss-sheet-stage,\.conflict-side-content\.aibp-mirror \.boss-sheet-stage\{width:100%;height:100%;min-height:0;max-width:none;aspect-ratio:auto\}/);
assert.match(displayStyles, /\.conflict-side-content\.quarter-turn \.boss-sheet-spread,\.conflict-side-content\.aibp-mirror \.boss-sheet-spread\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);grid-template-rows:minmax\(0,1fr\);align-items:center\}/);
assert.match(displayStyles, /\.conflict-side-content\.quarter-turn \.display-mob-track-block,\.conflict-side-content\.aibp-mirror \.display-mob-track-block\{flex:0 0 auto;padding-bottom:0\}/);
assert.match(displayStyles, /\.conflict-side-content\.quarter-turn \.conflict-side-secondary,\.conflict-side-content\.aibp-mirror \.conflict-side-secondary\{display:grid;grid-template-columns:minmax\(0,1fr\);grid-template-rows:minmax\(0,1fr\)/);
assert.match(displayStyles, /\.conflict-side-content\.quarter-turn \.boss-sheet-spread img,\.conflict-side-content\.aibp-mirror \.boss-sheet-spread img\{object-fit:contain\}/);
assert.match(displayStyles, /\.conflict-side-content\.quarter-turn \.boss-sheet-block\{display:block;min-height:0;flex:none;[^}]*overflow:hidden\}/);
assert.match(displayStyles, /\.conflict-side-content\.quarter-turn \.boss-sheet-stage\{width:100%;height:auto;max-width:none;aspect-ratio:2\.916\/1\}/);
assert.match(displayStyles, /\.conflict-side-content\.quarter-turn \.conflict-resolving-block,\.conflict-side-content\.aibp-mirror \.conflict-resolving-block\{display:grid;grid-template-rows:minmax\(0,1fr\) auto;gap:8px;[^}]*height:100%/);
assert.match(displayStyles, /\.conflict-side-content\.quarter-turn \.conflict-resolving-block>\.conflict-block-title,\.conflict-side-content\.aibp-mirror \.conflict-resolving-block>\.conflict-block-title\{display:none\}/);
assert.match(displayStyles, /\.conflict-side-content\.quarter-turn \.active-public-cards,\.conflict-side-content\.aibp-mirror \.active-public-cards\{grid-template-columns:minmax\(0,1fr\);[^}]*height:100%/);
assert.match(displayStyles, /\.active-public-cards:has\(>\.public-card:nth-child\(2\)\)[^{]*\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
assert.match(displayStyles, /\.conflict-side-content\.quarter-turn \.active-public-cards \.public-card-art,\.conflict-side-content\.aibp-mirror \.active-public-cards \.public-card-art\{width:auto;height:100%;max-width:100%;max-height:100%;aspect-ratio:var\(--card-aspect,\.7\)\}/);
assert.match(displayStyles, /\.conflict-resolving-summary\{display:grid;gap:4px;[^}]*border-top:1px solid var\(--line\)/);
assert.match(displayStyles, /container-type:inline-size/);
assert.match(displayStyles, /\.conflict-side-content:not\(\.quarter-turn\):not\(\.aibp-mirror\) \.conflict-side-secondary\{display:grid;grid-column:2;grid-row:1;grid-template-columns:minmax\(0,1fr\)/);
assert.match(displayStyles, /\.conflict-side-content\.aibp-mirror \.conflict-side-primary\{display:flex;align-content:normal;gap:8px;overflow:hidden\}/);
assert.match(displayStyles, /\.conflict-side-content\.quarter-turn\{grid-template-columns:minmax\(0,var\(--quarter-primary-width,2\.5fr\)\) minmax\(0,1fr\)\}/);
assert.doesNotMatch(displayStyles, /\.conflict-deck-summary|\.display-deck-order|\.display-damage-summary/);
assert.match(displayStyles, /\.conflict-side-content\.aibp-mirror\{grid-template-columns:minmax\(0,var\(--mirror-primary-width,3fr\)\) minmax\(0,1fr\)\}/);
assert.match(displayStyles, /\.conflict-side-content\.aibp-mirror \.boss-sheet-stage\{width:100%;height:auto;max-width:none;aspect-ratio:2\.916\/1\}/);
assert.match(displayStyles, /\.conflict-side-content\.aibp-mirror \.conflict-feature-block\{display:none\}/);
assert.match(displayStyles, /\.conflict-side-content\.aibp-mirror \.conflict-mirror-primary-cards\{display:block;flex:0 0 var\(--mirror-mob-card-height,132px\);[^}]*overflow:hidden\}/);
assert.match(displayStyles, /\.conflict-mirror-primary-row\{display:flex;align-items:stretch;[^}]*overflow-x:auto/);
assert.match(displayStyles, /\.conflict-mirror-primary-row \.conflict-terrain-card\{align-self:stretch;height:100%;max-height:100%\}/);
assert.match(displayStyles, /\.conflict-side-content\.aibp-mirror \.conflict-side-secondary\{grid-template-columns:minmax\(0,1fr\);grid-template-rows:minmax\(0,1fr\)\}/);
assert.match(displayStyles, /\.conflict-side-content\.aibp-mirror \.conflict-resolving-block\{grid-column:1;grid-row:1\}/);
assert.match(displayStyles, /\.conflict-side-content\.aibp-mirror \.active-public-cards \.public-card\{align-self:stretch;height:100%;container-type:size\}/);
assert.match(displayStyles, /\.conflict-side-content\.aibp-mirror \.active-public-cards \.public-card figcaption\{display:none\}/);
assert.match(displayStyles, /\.conflict-side-content\.aibp-mirror \.active-public-cards \.public-card-art\{align-self:center;width:min\(100cqw,calc\(100cqh \* var\(--card-aspect,\.7\)\)\);height:auto;[^}]*aspect-ratio:var\(--card-aspect,\.7\)\}/);
assert.match(displayStyles, /\.conflict-side-content\.aibp-mirror \.conflict-hero-clues\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(96px,1fr\)\)/);
assert.match(displayStyles, /\.conflict-hero-clue\.clue-martial\{border-left-color:#b94747\}/);
assert.match(displayStyles, /\.active-public-cards:not\(:has\(>\.active-ai-card\)\)>\.active-bp-card\{grid-column:1\}/);
const renderConflictSource = display.match(/function renderConflict\(payload\)[\s\S]*?\n  function render\(payload\)/)?.[0] || "";
assert.match(renderConflictSource, /active-ai-card/);
assert.match(renderConflictSource, /active-bp-card/);
assert.match(renderConflictSource, /const mirrorTerrainCards=boardVisible\?"":terrainCards\.map/);
assert.match(renderConflictSource, /boardVisible=settings\.conflictBoardVisible!==false/);
assert.match(renderConflictSource, /const resolvingSummary=publicDeckSummary\(battle\)/);
assert.match(renderConflictSource, /active-public-cards[^`]*\$\{activeCards\|\|[^`]*<\/div>\$\{resolvingSummary\}<\/section>/);
assert.match(renderConflictSource, /class="conflict-mirror-primary-cards" aria-label="地形、特性与战术卡"/);
assert.match(renderConflictSource, /\$\{!boardVisible&&terrainCards\.length\?/);
assert.match(renderConflictSource, /const heroClues=conflictHeroClues\(payload\.modules\?\.map\)/);
assert.match(renderConflictSource, /const primaryFollowup=boardVisible\s*\? mobTrack\.html\s*: `\$\{mobTrack\.html\}\$\{heroClues\}\$\{featureSection\}\$\{mirrorPrimaryCards\}`/);
assert.doesNotMatch(renderConflictSource, /activeTerrainCards/);
assert.match(renderConflictSource, /conflict-side-primary">\$\{bossSheetHtml\(monster,battle\)\}\$\{primaryFollowup\}/);
assert.match(renderConflictSource, /const mobTrack=publicMobTrack\(monster,battle,featureEntries\)/);
assert.match(renderConflictSource, /const remainingFeatures=featureEntries\.slice\(mobTrack\.used\)/);
assert.match(renderConflictSource, /battle\.mobTacticCard/);
assert.doesNotMatch(renderConflictSource, /惯常|标志行为|ROUTINE|SIGNATURE/);
assert.doesNotMatch(display, /battle\.aiDeck(?!Count|Levels)/);
assert.doesNotMatch(display, /battle\.bpDeck(?!Count|Levels)/);
assert.match(main, /id="openDisplay"/);
assert.match(main, /id="toggleConflictBoard"/);
assert.match(main, /id="rotateConflict"[^>]*旋转第二屏 AI\/BP 区域 180 度/);
assert.match(main, /app\.js\?v=28/);
assert.match(mainApp, /function portraitConflictRotation\(value\)\{return Number\(value\)===270\?270:90\}/);
assert.match(mainApp, /portraitConflictRotation\(settings\.conflictRotation\)\+180/);
assert.match(index, /app\.js\?v=30/);

const trackContext = vm.createContext({ window: {} });
vm.runInContext(mapView, trackContext);
const compactClueMarkup = trackContext.window.KFMapView.renderClueTracking({state:{mainKnightId:"k0",knights:[
  {id:"k0",name:"Renholder",heroId:"renholder"},
  {id:"k1",name:"Stoneface",heroId:"stoneface",primary:"martial",secondary:"historic",clues:{martial:2,historic:1}},
  {id:"k2",name:"Kara",heroId:"kara",primary:"errant",secondary:"mystic",clues:{errant:3,mystic:2}},
  {id:"k3",name:"Bartos",heroId:"bartos",memberType:"squire",primary:"historic",secondary:"martial",clues:{historic:2,martial:1}}
]},assetBase:"/modules/map/"});
assert.strictEqual((compactClueMarkup.match(/class="display-clue-knight"/g) || []).length, 3);
assert.strictEqual((compactClueMarkup.match(/class="display-clue-value /g) || []).length, 6);
const compactClueVisibleText = compactClueMarkup.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
assert.match(compactClueVisibleText, /石面/);
assert.match(compactClueVisibleText, /卡拉/);
assert.match(compactClueVisibleText, /巴尔托什/);
assert.doesNotMatch(compactClueVisibleText, /Stoneface|Kara|Bartos|主要|次要|武艺|游侠|历史|神秘/);
const avatarMapData = { maps:{SK:{tiles:[{id:"tile-1",size:"S",number:1,x:0,y:0,rotation:180,image:{face:"tile.jpg",back:"tile-back.jpg",aspect:.6657}}]}},tokens:{markers:{},monsters:{}},monsters:[] };
const avatarMapState = hero => ({kingdom:"SK",mainKnightId:"main",knights:[{id:"main",name:hero.name,...hero}],maps:{SK:{placed:["tile-1"],tileState:{"tile-1":"explored"},current:"tile-1",partyPositions:{"tile-1":{x:50,y:50}},tileMarkers:[],pathMarkers:[],monsters:[]}}});
const legacyAvatarMap = trackContext.window.KFMapView.renderMapStage({state:avatarMapState({name:"Stoneface"}),data:avatarMapData,interactive:false});
assert.match(legacyAvatarMap, /\/assets\/heroes\/stoneface-avatar\.jpg/);
assert.doesNotMatch(legacyAvatarMap, /party-location-fallback/);
const explicitAvatarMap = trackContext.window.KFMapView.renderMapStage({state:avatarMapState({name:"自定义骑士名",heroId:"kara"}),data:avatarMapData,interactive:false});
assert.match(explicitAvatarMap, /\/assets\/heroes\/kara-avatar\.jpg/);
assert.doesNotMatch(explicitAvatarMap, /party-location-fallback/);
const readOnlyTracks = trackContext.window.KFMapView.renderDelveTracks({
  state: {
    kingdom: "SK",
    trackers: { threat: 7, curse: 2, time: 8 },
    trackNotes: { threat: { 7: "追猎" }, curse: {}, time: {} },
  },
  data: {
    kingdomRules: { SK: { limits: { threat: 9, curse: 4, time: 16 } } },
    tokens: { tracks: { threat: "threat.png", curse: "curse.png", time: "time.png" } },
  },
  assetBase: "/modules/map/",
  interactive: false,
});
assert.strictEqual((readOnlyTracks.match(/class="delve-track track-/g) || []).length, 3);
assert.strictEqual((readOnlyTracks.match(/<span class="delve-track-cell/g) || []).length, 32);
assert.match(readOnlyTracks, /威胁/);
assert.match(readOnlyTracks, /诅咒/);
assert.match(readOnlyTracks, /时间/);
assert.match(readOnlyTracks, /delve-track-cell active[^"]*noted/);
assert.match(readOnlyTracks, /追猎 1/);
assert.doesNotMatch(readOnlyTracks, /<button|<form|<input/);

const activeExploration = { id:"active-card",name:"激活探索卡",image:{face:"active-face.jpg",back:"card-back.jpg",width:10,height:3,index:2,aspect:.702} };
const districtExploration = { id:"district-card",name:"区域探索卡",image:{face:"district-face.jpg",back:"card-back.jpg",width:10,height:3,index:4,aspect:.702} };
const hiddenExploration = { id:"hidden-card",name:"未公开牌库卡",image:{face:"hidden-face.jpg",back:"card-back.jpg",width:10,height:3,index:7,aspect:.702} };
const explorationState = { kingdom:"SK",maps:{SK:{exploration:{activeEffect:"active-card",districtEffects:{drowned:"district-card"},deck:["hidden-card"],effectMarkers:{active:[{type:"generic",x:30,y:40}]}}}} };
const explorationData = { maps:{SK:{label:"沉没王国"}},kingdomRules:{SK:{panel:"kingdom-board.jpg",districts:[{id:"drowned",name:"淹没区"},{id:"marsh",name:"沼泽区"}],exploration:[activeExploration,districtExploration,hiddenExploration],specialExploration:[]}},tokens:{markers:{generic:"generic.png"},monsters:{}},monsters:[] };
const readOnlyKingdomBoard = trackContext.window.KFMapView.renderKingdomBoard({state:explorationState,data:explorationData,assetBase:"/modules/map/"});
assert.match(readOnlyKingdomBoard, /kingdom-active-exploration/);
assert.match(readOnlyKingdomBoard, /--active-width:31%/);
assert.match(readOnlyKingdomBoard, /激活探索卡/);
assert.match(readOnlyKingdomBoard, /display-exploration-marker/);
const readOnlyDistrictCards = trackContext.window.KFMapView.renderDistrictExplorationCards({state:explorationState,data:explorationData,assetBase:"/modules/map/"});
assert.match(readOnlyDistrictCards, /淹没区/);
assert.match(readOnlyDistrictCards, /区域探索卡/);
assert.match(readOnlyDistrictCards, /沼泽区/);
assert.match(readOnlyDistrictCards, /空卡位/);
assert.doesNotMatch(readOnlyKingdomBoard + readOnlyDistrictCards, /未公开牌库卡|hidden-face/);
const fourDistrictData = {kingdomRules:{POS:{districts:["noble","craftsman","merchant","port"].map(id=>({id,name:id})),exploration:[],specialExploration:[]}}};
const fourDistrictCards = trackContext.window.KFMapView.renderDistrictExplorationCards({state:{kingdom:"POS",maps:{POS:{exploration:{districtEffects:{}}}}},data:fourDistrictData});
assert.strictEqual((fourDistrictCards.match(/class="display-district-effect /g) || []).length, 4);

console.log("second screen: presentation sync, authenticated polling and hidden-deck isolation verified");
