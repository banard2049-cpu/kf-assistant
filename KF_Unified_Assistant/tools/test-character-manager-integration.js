"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function pngDimensions(file) {
  const image = fs.readFileSync(file);
  assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${file} must be a PNG`);
  return {width: image.readUInt32BE(16), height: image.readUInt32BE(20)};
}

const index = fs.readFileSync("public/index.html", "utf8");
const app = fs.readFileSync("public/app.js", "utf8");
const styles = fs.readFileSync("public/styles.css", "utf8");
const knightPoolStyles = styles.slice(styles.indexOf(".knight-pool-strip"), styles.indexOf(".knight-turn-guide"));
const desktopKnightStyles = styles.slice(styles.indexOf(".knight-board-shell"), styles.indexOf("@container(max-width:910px)"));
const tabletKnightStyles = styles.slice(styles.indexOf("@container(max-width:910px)"), styles.indexOf("@container(max-width:640px)"));
const mobileKnightStyles = styles.slice(styles.indexOf("@container(max-width:640px)"), styles.indexOf("@media(min-width:901px)"));
const outpostStyles = styles.slice(styles.indexOf(".outpost-module"));
const outpostDesktopStyles = outpostStyles.slice(0, outpostStyles.indexOf("@container(max-width:760px)"));
const api = fs.readFileSync("public/api.php", "utf8");
const gitignore = fs.readFileSync("../.gitignore", "utf8");
const data = require("../public/data/character-runtime-data.js");
const runtime = require("../public/data/character-runtime.js");
const attributeRenderer = app.slice(app.indexOf("function renderRuntimeAttributes"), app.indexOf("function renderRuntimeCurves"));
const squireCurvesRenderer = app.slice(app.indexOf("function renderRuntimeCurves"), app.indexOf("function runtimeFlippableArt"));
const knightCoreRenderer = app.slice(app.indexOf("function renderKnightCoreCards"), app.indexOf("function runtimeEquipmentCard"));
const professionZoneRenderer = knightCoreRenderer.slice(knightCoreRenderer.indexOf("const professionZone="), knightCoreRenderer.indexOf("const heroicZone="));
const heroicZoneRenderer = knightCoreRenderer.slice(knightCoreRenderer.indexOf("const heroicZone="), knightCoreRenderer.indexOf("const perilZone="));
const perilZoneRenderer = knightCoreRenderer.slice(knightCoreRenderer.indexOf("const perilZone="), knightCoreRenderer.indexOf("const portraitZone="));
const knightBoardRenderer = app.slice(app.indexOf("function renderKnightBoard"), app.indexOf("function mettleRollName"));
const squireBoardRenderer = app.slice(app.indexOf("function renderSquireBoard"), app.indexOf("function renderKnightBoard"));
const equipmentRenderer = app.slice(app.indexOf("function renderRuntimeEquipment"), app.indexOf("function renderRuntimeHand"));
const handRenderer = app.slice(app.indexOf("function renderRuntimeHand"), app.indexOf("function renderKnightBoard"));
const knightRoundGuideRenderer = app.slice(app.indexOf("function renderKnightRoundGuide"), app.indexOf("function renderKnightBoard"));
const knightPoolRenderer = app.slice(app.indexOf("function renderKnightPool"), app.indexOf("function renderPartyManager"));
const partyRenderer = app.slice(app.indexOf("function renderPartyManager"), app.indexOf("function renderMap"));
const partyClickHandler = app.slice(app.indexOf('$("#partyModule").addEventListener("click"'), app.indexOf('$("#partyModule").addEventListener("change"'));
const partyChangeHandler = app.slice(app.indexOf('$("#partyModule").addEventListener("change"'), app.indexOf('$("#printButton").onclick'));
const outpostRenderer = app.slice(app.indexOf("function outpostSheetTier"), app.indexOf("function runtimeAtlasArt"));
const outpostEvents = app.slice(app.indexOf('$("#outpostModule").addEventListener("pointerover"'), app.indexOf('$("#partyModule").addEventListener("pointerover"'));
const flippableRenderer = app.slice(app.indexOf("function runtimeFlippableArt"), app.indexOf("function renderKnightCoreCards"));

assert.match(index, /data-module="outpost"/);
assert.match(index, /data-module="party"/);
assert.match(index, /id="outpostModule"/);
assert.match(index, /id="outpostSummary"/);
assert.match(index, /id="outpostKingdomSelect"/);
assert.match(index, /id="outpostKingdomWarning"/);
assert.match(index, /id="outpostKingdomOverview"/);
assert.match(index, /id="outpostEmpty"/);
assert.match(index, /id="outpostContent"/);
assert.match(index, /id="outpostDistricts"/);
assert.match(index, /id="outpostRulebookReference"/);
assert.match(index, /id="outpostRulebookPages"/);
assert.match(index, /id="outpostScoutingSection"/);
assert.match(index, /id="outpostScoutingPages"/);
assert.match(index, /id="outpostContractsSection"/);
assert.match(index, /id="outpostContractPages"/);
assert.match(index, /id="outpostMercenaries"/);
assert.match(index, /id="outpostHiredMercenaries"/, "the hired mercenary count must be backed by a visible named roster");
assert.match(index, /id="outpostMerchantGear"/);
assert.match(index, /id="outpostGearTier"/);
assert.match(index, /id="outpostGearType"/);
assert.match(index, /id="outpostGearSearch"/);
assert.match(index, /id="clearOutpostSelections"/);
assert.match(index, /OUTPOST ACTIVITIES/);
assert.match(index, /PREPARING LOADOUTS/);
assert.match(index, /ONWARD/);
assert.ok(index.indexOf('data-module="overview"') < index.indexOf('data-module="outpost"'));
assert.ok(index.indexOf('data-module="outpost"') < index.indexOf('data-module="party"'));
assert.match(index, /id="partyModule"/);
assert.match(index, /id="partyMemberTabs"/);
assert.match(index, /id="partyMemberPanel"/);
assert.match(index, /id="mettleManagerPanel"/);
assert.match(index, /id="runtimeCardPreview"/);
assert.match(index, /styles\.css\?v=58/);
assert.ok(index.indexOf("/data/character-runtime-data.js?v=9") < index.indexOf("/app.js?v=57"));
assert.ok(index.indexOf("/data/character-runtime.js?v=5") < index.indexOf("/app.js?v=57"));

assert.match(app, /function hideGameViews\(\)\{\$\$\("#outpostModule,#partyModule/);
assert.match(app, /if\(viewMode==="outpost"\)renderOutpost\(\)/);
assert.match(app, /function renderOutpost\(\)/);
for (const districtId of ["mercenary-guild", "scouts-guild", "saints-altar", "inn", "merchant-workshop", "notice-board"]) {
  assert.match(app, new RegExp(`id:"${districtId}"`), `outpost must expose ${districtId}`);
}
assert.match(app, /id:"notice-board",name:"公告板",en:"NOTICE BOARD"/, "the sixth visible district must be the Notice Board");
assert.match(app, /id:"scouts-guild"[^\n]*target:"outpostScoutingSection"/);
assert.match(app, /id:"notice-board"[^\n]*target:"outpostContractsSection"/);
assert.doesNotMatch(app, /8742f3|Bonus Contract/, "Stoneface's personal Bonus Contract must not enter the kingdom Notice Board");
for (const asset of [
  "sunken-outpost-overview.png", "stone-outpost-overview.png",
  "sunken-outpost-1.png", "sunken-outpost-2.png",
  "stone-outpost-1.png", "stone-outpost-2.png", "stone-outpost-3.png",
  "sunken-scouting.png", "stone-scouting.png",
  "sunken-contracts-1.png", "sunken-contracts-2.png", "sunken-contracts-3.png",
  "stone-contracts-1.png", "stone-contracts-2.png", "stone-contracts-3.png",
]) {
  assert.ok(fs.existsSync(`public/assets/outpost/${asset}`), `missing complete outpost rule page ${asset}`);
  assert.match(app, new RegExp(`/assets/outpost/${asset.replace(".", "\\.")}`));
}
for (const asset of [
  "sunken-outpost-overview.png", "stone-outpost-overview.png",
  "sunken-scouting.png", "stone-scouting.png",
  "sunken-contracts-1.png", "sunken-contracts-2.png", "sunken-contracts-3.png",
  "stone-contracts-1.png", "stone-contracts-2.png", "stone-contracts-3.png",
]) {
  const {width, height} = pngDimensions(`public/assets/outpost/${asset}`);
  assert.ok(width >= 1000 && height >= 1400, `${asset} must remain sharp when enlarged on desktop`);
}
assert.match(outpostRenderer, /function renderOutpostDistricts\(kingdom\)/);
assert.match(outpostRenderer, /function renderOutpostKingdomOverview\(kingdom\)/);
assert.match(outpostRenderer, /function renderOutpostRulebookPages\(kingdom\)/);
assert.match(outpostRenderer, /function renderOutpostDetailPages\(kingdom,kind\)/);
assert.match(outpostRenderer, /#outpostKingdomSelect/);
assert.match(outpostRenderer, /#outpostKingdomOverview/);
assert.match(outpostRenderer, /#outpostKingdomWarning/);
assert.match(outpostRenderer, /#outpostDistricts/);
assert.match(outpostRenderer, /#outpostRulebookPages/);
assert.match(outpostRenderer, /#outpostScoutingPages/);
assert.match(outpostRenderer, /#outpostContractPages/);
assert.match(outpostRenderer, /characterRuntime\.getOutpostView\(manager,context,characterData\)/);
assert.match(outpostRenderer, /view\.mercenaries\.filter\(item=>item\.assignment\|\|item\.card\.kingdom==="both"\|\|item\.card\.kingdom===view\.kingdom\)/);
assert.match(outpostRenderer, /#outpostHiredMercenaries/);
assert.match(outpostRenderer, /view\.mercenaries\.filter\(item=>item\.assignment\)/);
assert.match(outpostRenderer, /sort\(\(left,right\)=>Number\(Boolean\(right\.assignment\)\)-Number\(Boolean\(left\.assignment\)\)\)/);
assert.match(outpostRenderer, /outpost-selected-mark">已雇佣/);
assert.match(outpostRenderer, /尚未雇佣佣兵/);
const qaMemberKey = "knight:mercenary-roster-qa";
const qaContext = {kingdom:"stone",leaderTier:1,memberKeys:[qaMemberKey],memberTiers:{[qaMemberKey]:1},unlockedMercenaryIds:[]};
let qaManager = runtime.ensureManager(null,[{key:qaMemberKey,kind:"knight",sourceId:"paracelsa",name:"测试骑士"}],data,()=>0);
qaManager = runtime.applyOutpostAction(qaManager,{type:"assign-mercenary",catalogId:"mercenary:26606",memberKey:qaMemberKey},qaContext,data);
const qaView = runtime.getOutpostView(qaManager,qaContext,data);
const qaMage = qaView.mercenaries.find(item=>item.assignment);
assert.equal(qaView.outpost.mercenaries.length,1);
assert.equal(qaMage.card.name,"Mage");
const hiredRendererSource = outpostRenderer.slice(outpostRenderer.indexOf("function outpostHiredMercenary"),outpostRenderer.indexOf("function outpostGearCard"));
const renderHiredMercenary = vm.runInNewContext(`(${hiredRendererSource})`,{esc:value=>String(value),outpostReasonText:reason=>reason});
const qaRosterMarkup = renderHiredMercenary(qaMage,qaView.members);
assert.match(qaRosterMarkup,/法师/);
assert.match(qaRosterMarkup,/负责人：测试骑士/);
assert.match(outpostRenderer, /view\.merchantGear\.filter\(/);
assert.match(outpostRenderer, /runtimeFlippableArt\(card\.art,card\.backArt,`outpost:mercenary:/);
assert.match(outpostRenderer, /runtimeFlippableArt\(card\.art,card\.backArt,`outpost:gear:/);
assert.match(outpostRenderer, /data-outpost-\$\{kind\}/);
assert.match(outpostRenderer, /全队最多雇佣 4 名佣兵上限|mercenary-limit/);
assert.match(outpostRenderer, /侍从只能借用商人武器/);
for (const event of ["pointerover", "pointerout", "focusin", "focusout", "click", "change"]) {
  assert.match(outpostEvents, new RegExp(`\\$\\("#outpostModule"\\)\\.addEventListener\\("${event}"`));
}
assert.match(outpostEvents, /type:"assign-mercenary"/);
assert.match(outpostEvents, /type:"assign-merchant-gear"/);
assert.match(outpostRenderer, /loanOptions/);
assert.match(outpostEvents, /squireEligibilityConfirmed/);
assert.match(outpostEvents, /type:"clear-outpost"/);
assert.match(outpostEvents, /#outpostKingdomSelect/);
assert.match(outpostEvents, /setCampaignKingdom\(e\.target\.value\)/);
assert.match(app, /function setCampaignKingdom\(value\)[^{]*\{[^}]*gameSettings\.kingdom=kingdom[^}]*campaignOp\("kingdom",kingdom\)/);
assert.match(outpostEvents, /#outpostGearTier/);
assert.match(outpostEvents, /#outpostGearType/);
assert.match(outpostEvents, /#outpostGearSearch/);
assert.match(outpostEvents, /characterRuntime\.applyOutpostAction/);
assert.match(app, /function renderPartyManager\(\)/);
assert.doesNotMatch(app, /规则文字以实体卡为准/, "empty Squire cards must not show a redundant rules disclaimer");
assert.match(app, /function renderSquireBoard\(member,manager\)/);
assert.match(squireCurvesRenderer, /steps\?`<ol class="squire-heroic-steps">\$\{steps\}<\/ol>`:""/);
assert.match(squireCurvesRenderer, /steps\?"has-steps":"card-only"/);
assert.match(app, /characterRuntime\.setSquireTier/);
assert.match(app, /characterRuntime\.moveTechnique/);
assert.match(app, /characterRuntime\.upgradeMettle/);
assert.match(app, /data-runtime-curve-field="peril\|danger"/);
assert.match(attributeRenderer, /data-runtime-curve-field="peril\|danger"/);
assert.match(attributeRenderer, /<small>ATTRIBUTES<\/small><strong>骑士属性<\/strong>/);
assert.doesNotMatch(knightCoreRenderer, /data-runtime-curve-field="peril\|danger"/);
assert.match(app, /data-runtime-card-flip/);
assert.match(app, /data-runtime-knight-card/);
assert.match(app, /characterRuntime\.setKnightCard/);
assert.match(app, /function renderKnightCoreCards\(member\)/);
assert.doesNotMatch(knightCoreRenderer, /KNIGHT BOARD|骑士面板|<header>/,
  "the knight board must begin with its controls instead of a redundant outer title");
assert.match(knightCoreRenderer, /<section class="runtime-panel knight-board-core"><div class="knight-board-deck">/);
assert.doesNotMatch(knightCoreRenderer, /knight-board-letter|knight-board-edge|DISCARD|COOLDOWN|双面板骑士配置/);
assert.match(knightCoreRenderer, /class="knight-primary-selectors"/);
assert.match(knightCoreRenderer, /selector\("portrait","肖像"[\s\S]*selector\("profession","职业"[\s\S]*selector\("heroic","英勇曲线"[\s\S]*selector\("peril","危险曲线"[\s\S]*runtimeEquipmentAddSelect\(member/);
assert.doesNotMatch(professionZoneRenderer, /selector\(/);
assert.doesNotMatch(heroicZoneRenderer, /selector\(/);
assert.doesNotMatch(perilZoneRenderer, /selector\(/);
assert.match(professionZoneRenderer, /knight-profession-art/);
assert.match(heroicZoneRenderer, /knight-curve-art/);
assert.match(perilZoneRenderer, /knight-curve-art/);
assert.match(knightCoreRenderer, /class="knight-board-zone knight-curves-zone"/);
assert.doesNotMatch(knightCoreRenderer, /knight-board-left|knight-board-right|knight-board-panel/);
assert.ok(knightCoreRenderer.indexOf("${portraitZone}") < knightCoreRenderer.indexOf("${professionZone}"), "portrait card must be the first board card in DOM order");
assert.ok(knightCoreRenderer.indexOf("${professionZone}") < knightCoreRenderer.indexOf("${curvesZone}"));
assert.ok(knightCoreRenderer.indexOf("${curvesZone}") < knightCoreRenderer.indexOf("${renderRuntimeAttributes(member,true)}"));
assert.ok(knightCoreRenderer.indexOf("${renderRuntimeAttributes(member,true)}") < knightCoreRenderer.indexOf("${renderRuntimeEquipment(member,true)}"));
assert.match(app, /function renderKnightBoard\(member,manager\)/);
assert.match(app, /function renderKnightRoundGuide\(\)/);
for (const step of ["start", "turn", "end"]) assert.match(knightRoundGuideRenderer, new RegExp(`data-knight-round-step="${step}"`));
for (const step of ["refresh", "actions", "end"]) assert.match(knightRoundGuideRenderer, new RegExp(`data-knight-turn-step="${step}"`));
for (const step of ["heat", "cooldown", "delay"]) assert.match(knightRoundGuideRenderer, new RegExp(`data-refresh-step="${step}"`));
for (const action of ["movement", "combat", "free"]) assert.match(knightRoundGuideRenderer, new RegExp(`data-knight-turn-action="${action}"`));
assert.match(knightRoundGuideRenderer, /行动顺序自选/);
assert.match(knightRoundGuideRenderer, /弃置不动/);
assert.ok(knightRoundGuideRenderer.indexOf('data-knight-turn-step="refresh"') < knightRoundGuideRenderer.indexOf('data-knight-turn-step="actions"'));
assert.ok(knightRoundGuideRenderer.indexOf('data-knight-turn-step="actions"') < knightRoundGuideRenderer.indexOf('data-knight-turn-step="end"'));
assert.match(app, /function renderRuntimeEquipment\(member,embedded=false\)/);
assert.match(app, /renderRuntimeEquipment\(member,true\)/);
assert.doesNotMatch(knightBoardRenderer, /renderRuntimeEquipment/);
assert.ok(knightCoreRenderer.indexOf("${portraitZone}") < knightCoreRenderer.indexOf("${renderRuntimeEquipment(member,true)}"));
assert.match(app, /selector\("portrait","肖像"/);
assert.doesNotMatch(knightCoreRenderer.slice(knightCoreRenderer.indexOf("const portraitZone=")), /selector\("portrait"/);
assert.match(app, /data-runtime-card-preview/);
assert.match(app, /tabindex="0"/);
assert.match(app, /data-hand-zone=/);
assert.match(app, /data-runtime-card-zone=/);
assert.match(app, /data-runtime-equipment-add/);
assert.match(app, /data-runtime-equipment-remove/);
assert.match(app, /data-runtime-equipment-action/);
assert.match(app, /characterRuntime\.getLoadoutOptions/);
assert.match(app, /characterRuntime\.setLoadoutSelection/);
assert.match(app, /function runtimeLoadoutReasonText\(reason,card\)/);
assert.match(app, /"already-equipped":"已装备"/);
assert.match(app, /"upgrade-incompatible":"升级不兼容"/);
assert.match(app, /"merchant-gear":"商人装备不可升级"/);
assert.match(app, /"incompatible":"类型不匹配"/);
assert.match(app, /"type-mismatch":"类型不匹配"/);
assert.match(app, /data-runtime-equipment-card=/);
assert.match(app, /data-runtime-equipment-upgrade=/);
assert.match(equipmentRenderer, /class="runtime-equipment-stack/);
assert.match(equipmentRenderer, /class="runtime-equipment-card-layer"/);
assert.match(equipmentRenderer, /class="runtime-equipment-upgrade-layer"/);
assert.match(equipmentRenderer, /class="runtime-equipment-stack-slot"/);
assert.match(equipmentRenderer, /characterData\.chargeTokenAsset/);
assert.match(equipmentRenderer, /class="runtime-charge-count"/);
for (const icon of ["equipment-exhaust.png", "equipment-discard.png", "equipment-spend-charge.png"]) {
  assert.match(equipmentRenderer, new RegExp(`/assets/icons/${icon.replace(".", "\\.")}`));
  assert.ok(fs.existsSync(`public/assets/icons/${icon}`), `${icon} must exist`);
}
assert.match(styles, /\.runtime-equipment-action-icon\{display:block;width:16px;height:16px;object-fit:contain;pointer-events:none\}/);
assert.match(styles, /\.runtime-equipment\.discarded \.runtime-equipment-stack\{transform:none\}/);
assert.match(equipmentRenderer, /runtimeAtlasArt\(upgrade\.art[\s\S]*runtime-equipment-upgrade-art/);
assert.match(equipmentRenderer, /gear:\$\{item\.id\}:\$\{catalogId\}/, "equipment flip state must be isolated by the selected catalog card");
assert.match(handRenderer, /data-runtime-card-catalog=/);
assert.match(handRenderer, /data-runtime-card-zone=/);
assert.match(handRenderer, /data-runtime-zone-icon=/);
assert.match(handRenderer, /ready:"✦"/);
for (const icon of ["hand-cooldown.png", "hand-delay.png", "hand-discard.png"]) {
  assert.match(handRenderer, new RegExp(`/assets/icons/${icon.replace(".", "\\.")}`));
  assert.ok(fs.existsSync(`public/assets/icons/${icon}`), `${icon} must exist`);
}
assert.match(handRenderer, /class="runtime-zone-icon-image"[^>]*alt=""/);
assert.match(handRenderer, /runtime-zone-icon \$\{zone==="ready"\?"":"has-image"\}/);
assert.match(handRenderer, /data-runtime-hand-action="advance-technique-zone"/);
assert.match(handRenderer, /data-runtime-hand-action="return-all-techniques"/);
assert.match(handRenderer, /technique:\$\{card\.id\}:\$\{catalogId\}/, "technique flip state must be isolated by the selected catalog card");
assert.doesNotMatch(partyClickHandler, /prompt\(/, "catalog additions must not fall back to free-text prompts");
assert.match(partyChangeHandler, /\{kind:"equipment",catalogId:e\.target\.value\}/);
assert.match(partyChangeHandler, /\{kind:"equipment",targetId:e\.target\.dataset\.runtimeEquipmentCard,catalogId:e\.target\.value\}/);
assert.match(partyChangeHandler, /\{kind:"upgrade",targetId:e\.target\.dataset\.runtimeEquipmentUpgrade,catalogId:e\.target\.value\}/);
assert.match(partyChangeHandler, /\{kind:"technique",catalogId:e\.target\.value\}/);
assert.match(partyChangeHandler, /\{kind:"technique",targetId:e\.target\.dataset\.runtimeCardCatalog,catalogId:e\.target\.value\}/);
assert.match(partyClickHandler, /\{kind:"advance-technique-zone"\}/);
assert.match(partyClickHandler, /\{kind:"return-all-techniques"\}/);
assert.match(partyClickHandler, /\{kind:"toggle-equipment-ready",equipmentId/);
assert.match(partyClickHandler, /\{kind:"toggle-equipment-discarded",equipmentId/);
assert.match(partyClickHandler, /\{kind:"change-equipment-charges",equipmentId,delta/);
assert.match(partyClickHandler, /\{kind:"adjust-knight-pool",tokenId,delta/);
assert.match(partyClickHandler, /\{kind:"clear-knight-pool"\}/);
assert.match(partyClickHandler, /characterRuntime\.applyRuntimeAction\(manager,manager\.activeMemberKey/);
assert.match(app, /addEventListener\("pointerover"/);
assert.match(app, /addEventListener\("pointerout"/);
assert.match(app, /addEventListener\("focusin"/);
assert.match(app, /addEventListener\("focusout"/);
assert.match(app, /runtimeHoveredPreviewCard/);
assert.match(app, /runtimeFocusedPreviewCard/);
assert.match(app, /scheduleRuntimeCardPreviewSync/);
assert.doesNotMatch(app, /data-runtime-curve-field="(?:heroic|peril)\|notes"/);
assert.doesNotMatch(app, /knightViewLabels|data-runtime-view/);
assert.match(outpostStyles, /\.outpost-module\{[^}]*max-width:1440px[^}]*container-type:inline-size/);
assert.match(outpostStyles, /\.outpost-phase-guide\{[^}]*display:grid[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
assert.match(outpostStyles, /\.outpost-district-layout\{[^}]*display:grid[^}]*grid-template-columns:minmax\(420px,1\.7fr\) minmax\(230px,\.72fr\)/);
assert.match(outpostStyles, /\.outpost-kingdom-overview img\{[^}]*width:100%[^}]*height:auto/);
assert.match(outpostDesktopStyles, /\.outpost-district-grid\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/, "all six district entries must fit in a visible 2 x 3 desktop grid");
assert.match(outpostStyles, /\.outpost-rulebook-pages\{[^}]*display:grid[^}]*grid-template-columns:repeat\(auto-fit,minmax\(280px,1fr\)\)/);
assert.match(outpostStyles, /\.outpost-rulebook-page img\{[^}]*width:100%[^}]*height:auto/);
assert.match(outpostStyles, /\.outpost-market-section\{[^}]*background:#eee4d2[^}]*color:var\(--ink\)/);
assert.match(outpostStyles, /\.outpost-detail-sections\{[^}]*display:grid/);
assert.match(outpostStyles, /\.outpost-detail-pages\{[^}]*display:grid/);
assert.match(outpostStyles, /\.outpost-contract-pages\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
assert.match(outpostStyles, /\.outpost-detail-page img\{[^}]*width:100%[^}]*height:auto[^}]*object-fit:contain/);
assert.match(outpostStyles, /\.outpost-card-grid\{[^}]*display:grid[^}]*grid-template-columns:repeat\(auto-fill,minmax\(180px,1fr\)\)/);
assert.match(outpostStyles, /\.outpost-hired-mercenaries\{[^}]*display:grid/);
assert.match(outpostStyles, /\.outpost-card\.selected\{/);
assert.match(outpostStyles, /\.outpost-card\.locked\{/);
assert.match(outpostStyles, /\.outpost-assignment select\{[^}]*width:100%/);
assert.match(outpostStyles, /\.outpost-market-filters\{[^}]*position:sticky[^}]*grid-template-columns:140px 140px minmax\(180px,1fr\) auto/);
assert.match(outpostStyles, /@container\(max-width:760px\)\{[\s\S]*?\.outpost-phase-guide\{grid-template-columns:1fr\}/);
assert.match(outpostStyles, /@container\(max-width:760px\)\{[\s\S]*?\.outpost-district-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(outpostStyles, /@container\(max-width:760px\)\{[\s\S]*?\.outpost-district-grid\{[^}]*order:-1/, "mobile must show all district entries before the tall rulebook overview");
assert.match(outpostStyles, /@container\(max-width:760px\)\{[\s\S]*?\.outpost-district-layout\{grid-template-columns:1fr/);
assert.match(outpostStyles, /@container\(max-width:760px\)\{[\s\S]*?\.outpost-detail-sections,\.outpost-contract-pages\{grid-template-columns:1fr/);
assert.match(outpostStyles, /@container\(max-width:430px\)\{[\s\S]*?\.outpost-rulebook-pages\{grid-template-columns:1fr/);
assert.match(outpostStyles, /@container\(max-width:430px\)\{[\s\S]*?\.outpost-contract-pages\{grid-template-columns:1fr/);
assert.match(outpostStyles, /@container\(max-width:430px\)\{[\s\S]*?\.outpost-card-grid,\.outpost-mercenary-grid\{grid-template-columns:1fr 1fr/);
assert.match(gitignore, /!KF_Unified_Assistant\/public\/assets\/outpost\//);
assert.match(styles, /\.character-manager-grid/);
assert.match(styles, /\.runtime-card-art/);
assert.match(styles, /\.knight-board-shell/);
assert.match(desktopKnightStyles, /\.knight-board-shell\{[^}]*--primary-card-height:/);
assert.doesNotMatch(styles, /--profession-card-unit|--arc-card-unit/, "the four primary cards must share one height source");
assert.match(styles, /\.knight-board-deck/);
assert.match(desktopKnightStyles, /grid-template-areas:"selectors selectors selectors selectors selectors" "portrait profession curves attributes equipment"/);
assert.match(styles, /@container\(max-width:910px\)/);
assert.match(tabletKnightStyles, /grid-template-areas:"selectors selectors selectors" "portrait profession equipment" "curves curves equipment" "attributes attributes equipment"/);
assert.match(mobileKnightStyles, /grid-template-areas:"selectors" "portrait" "profession" "curves" "attributes" "equipment"/);
assert.match(desktopKnightStyles, /\.knight-board-deck\{[^}]*position:relative[^}]*border:2px solid #927441[^}]*background:#203344/);
assert.match(desktopKnightStyles, /\.knight-board-deck:after\{[^}]*inset:8px/);
assert.doesNotMatch(desktopKnightStyles, /\.knight-board-core>header/,
  "removed knight board title styles must not leave dead layout space");
assert.match(styles, /\.knight-primary-selectors\{[^}]*display:grid;grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
assert.match(desktopKnightStyles, /\.knight-profession-zone\{[^}]*grid-template-columns:1fr;[^}]*grid-template-areas:"heading" "card" "role"/);
assert.match(desktopKnightStyles, /\.knight-profession-zone \.runtime-flippable-card\{[^}]*align-self:start;justify-self:center/);
assert.match(desktopKnightStyles, /\.knight-arc-zone\{[^}]*gap:2px/);
assert.match(desktopKnightStyles, /\.knight-arc-zone \.knight-zone-heading\{margin-bottom:0\}/);
assert.match(desktopKnightStyles, /\.knight-arc-zone \.runtime-card-art\{[^}]*align-self:start/);
assert.match(flippableRenderer, /--card-aspect:\$\{(?:aspect|cardAspect)\}/, "flippable wrappers must expose the selected face ratio");
assert.match(desktopKnightStyles, /\.knight-board-core \.knight-portrait-zone \.runtime-flippable-card/);
assert.match(desktopKnightStyles, /\.knight-board-core \.knight-profession-zone \.runtime-flippable-card/);
assert.match(desktopKnightStyles, /\.knight-board-core \.knight-arc-zone>\.runtime-card-art/);
const primaryCardWidthFormula = /calc\(var\(--primary-card-height\)\s*\*\s*var\(--card-aspect\)\)/g;
assert.ok((desktopKnightStyles.match(primaryCardWidthFormula) || []).length >= 2, "portrait, profession and arc cards must derive width from one height and their own aspect ratios");
assert.match(styles, /@media\(min-width:901px\) and \(max-height:800px\)\{(?:(?!@media\().)*?\.knight-board-shell\{[^}]*--primary-card-height:153px/s);
assert.match(styles, /@media\(min-height:801px\)\{@container\(min-width:1120px\)\{\.knight-board-shell\{--primary-card-height:210px\}/);
assert.match(styles, /\.knight-curves-zone\{grid-area:curves/);
assert.match(styles, /\.knight-track-panel\{grid-area:attributes/);
assert.match(styles, /\.knight-portrait-zone\{grid-area:portrait/);
assert.match(styles, /\.knight-equipment-zone\{grid-area:equipment/);
assert.doesNotMatch(styles, /\.knight-board-left|\.knight-board-right|\.knight-board-panel/);
assert.doesNotMatch(styles, /\.knight-board-letter|\.knight-board-edge/);
assert.match(styles, /\.knight-equipment-zone/);
assert.match(styles, /\.knight-equipment-zone \.runtime-equipment-list\{grid-template-columns:minmax\(0,1fr\)/);
assert.match(styles, /\.knight-equipment-zone \.runtime-equipment-controls>span\{[^}]*text-overflow:ellipsis[^}]*white-space:nowrap/);
assert.match(styles, /\.runtime-equipment-upgrade-layer\{[^}]*position:absolute[^}]*bottom:0/);
assert.match(styles, /\.runtime-equipment-stack\.has-upgrade\{[^}]*padding-bottom:var\(--upgrade-reveal\)/);
assert.match(styles, /\.knight-equipment-zone \.runtime-equipment-stack\{[^}]*--upgrade-reveal:/);
assert.match(styles, /\.runtime-equipment-stack\.has-upgrade \.runtime-flip-button\{[^}]*left:3px/);
assert.match(styles, /\.runtime-equipment-selectors\{display:grid/);
assert.match(styles, /\.runtime-equipment-actions\{[^}]*display:flex/);
assert.match(styles, /\.runtime-charge-count img\{[^}]*object-fit:cover/);
assert.match(styles, /\.runtime-equipment\.stowed \.runtime-equipment-stack\{[^}]*transform:rotate\(90deg\)/);
assert.match(styles, /\.runtime-equipment\.discarded \.runtime-equipment-stack/);
assert.match(styles, /\.runtime-technique-controls\{grid-template-columns:minmax\(0,1\.45fr\) minmax\(42px,\.65fr\) auto/);
assert.doesNotMatch(styles, /\.runtime-equipment \.runtime-equipment-upgrade-art\{[^}]*height:/, "upgrade thumbnails must retain atlas aspect ratio");
assert.match(styles, /\.runtime-card-preview\{position:fixed/);
assert.match(styles, /pointer-events:none/);
assert.match(styles, /\.runtime-card-art\[data-runtime-card-preview\]:hover/);
assert.match(styles, /\.runtime-card-art\[data-runtime-card-preview\]:focus-visible/);
assert.match(styles, /\.knight-technique-rack/);
assert.match(styles, /\.runtime-zone-icon/);
assert.match(styles, /\.runtime-zone-icon-image\{display:block;width:15px;height:15px;object-fit:contain;pointer-events:none;filter:brightness\(0\) invert\(1\)\}/);
assert.match(styles, /\.runtime-zone-icon\.has-image\{border-color:transparent;border-radius:0;background:transparent\}/);
assert.match(styles, /\.runtime-hand-actions/);
assert.match(styles, /\.knight-pool-strip/);
assert.match(styles, /\.knight-pool-token/);
assert.match(knightPoolStyles, /\.knight-pool-groups\{display:grid;grid-template-columns:minmax\(0,1fr\) max-content;[^}]*overflow:visible/);
assert.match(knightPoolStyles, /\.knight-pool-group\{display:grid;grid-template-columns:max-content minmax\(0,1fr\);[^}]*min-width:0/);
assert.match(knightPoolStyles, /\.knight-pool-tokens\{display:flex;flex-wrap:wrap/);
assert.doesNotMatch(knightPoolStyles, /overflow-x:(?:auto|scroll)/);
assert.doesNotMatch(knightPoolStyles, /\.knight-pool-group\{[^}]*min-width:max-content/);
assert.match(mobileKnightStyles, /\.knight-pool-groups\{grid-area:groups;grid-template-columns:1fr/);
assert.match(styles, /\.knight-turn-guide\{display:grid/);
assert.match(styles, /\.knight-round-stages\{display:grid/);
assert.match(styles, /@container\(max-width:910px\)\{(?:(?!@container\().)*?\.knight-turn-guide>header\{display:none\}/s);
assert.match(styles, /@media\(min-width:901px\) and \(max-height:800px\)\{(?:(?!@media\().)*?\.knight-turn-guide\{padding:2px 4px/s);
assert.match(styles, /--board-card-unit:/);
assert.match(styles, /--hand-card-unit:/);
assert.match(styles, /@container\(min-width:911px\)\{\.knight-track-panel\{padding:6px 3px 3px/);
assert.match(styles, /\.knight-track-panel>\.knight-zone-heading\{height:29px;margin-bottom:4px;padding-bottom:3px;text-align:left\}/);
assert.match(styles, /\.knight-track-panel>\.knight-zone-heading small\{display:block;overflow:hidden;white-space:nowrap\}/);
assert.match(styles, /\.knight-track-panel>\.knight-zone-heading strong\{white-space:nowrap\}/);
assert.match(styles, /grid-template-columns:minmax\(32px,1fr\) 22px 3px 22px/);
assert.match(styles, /grid-template-areas:"label current divider maximum"/);
assert.match(styles, /grid-template-columns:minmax\(32px,1fr\) 24px/);
assert.match(styles, /grid-template-columns:minmax\(32px,1fr\) 46px/);
assert.doesNotMatch(desktopKnightStyles, /\.knight-track-panel \.runtime-track span\{[^}]*font-size:0/);
assert.match(styles, /--board-card-unit:40px;[^}]*--primary-card-height:153px;[^}]*--hand-card-unit:90px/);
assert.match(styles, /\.knight-track-panel\{padding:5px 3px 3px\}/);
assert.match(styles, /\.knight-profession-zone\{grid-template-rows:28px 1fr auto\}/);
assert.match(styles, /\.knight-arc-zone,\.knight-portrait-zone\{grid-template-rows:28px 1fr\}/);
assert.match(styles, /\.knight-track-panel>\.knight-zone-heading\{height:28px;margin-bottom:3px;padding-bottom:2px\}/);
assert.match(styles, /\.knight-track-panel \.knight-board-track-grid\{gap:1px\}/);
assert.match(styles, /\.knight-track-panel \.knight-board-track-grid \.runtime-track,\.knight-track-panel \.knight-board-track-grid \.runtime-track\.single\{grid-template-rows:18px\}/);
assert.doesNotMatch(styles, /\.knight-portrait-zone>\.knight-card-selector/);
assert.match(styles, /\.knight-equipment-zone \.runtime-equipment-list\{max-height:180px\}/);
assert.doesNotMatch(styles, /\.knight-(?:profession|curve)-art\{[^}]*aspect-ratio/);
assert.doesNotMatch(styles, /runtime-card-art[^}]*transform:\s*scale/);
assert.doesNotMatch(styles, /\.knight-view-tabs/);
assert.match(api, /'partyManager'=>\['schemaVersion'=>4[^\r\n]*'knightPool'=>\(object\)\[\][^\r\n]*'outpost'=>\['mercenaries'=>\[\],'merchantGear'=>\[\]\]/);
assert.match(api, /in_array\(\$path,\['partyManager','harvest'\],true\) \? 500_000 : 20_000/, "partyManager and Harvest need room for complete bounded aggregates");

assert.match(app, /function renderKnightPool\(manager\)/);
assert.match(knightPoolRenderer, /characterData\.knightPoolTokens/);
assert.match(knightPoolRenderer, /token\.kind==="knight"/);
assert.match(knightPoolRenderer, /共享资源<small>清理时保留/);
assert.match(knightPoolRenderer, /清理骑士指示物/);
assert.match(app, /token\?\.iconAsset/);
assert.match(app, /token\?\.iconCrop/);
assert.match(styles, /\.knight-pool-icon-texture\{[^}]*background-image:var\(--token-image\)[^}]*background-size:var\(--token-size-x\) var\(--token-size-y\)[^}]*background-position:var\(--token-pos-x\) var\(--token-pos-y\)/);
assert.match(knightPoolRenderer, /data-runtime-knight-pool-action="decrement"/);
assert.match(knightPoolRenderer, /data-runtime-knight-pool-action="increment"/);
assert.match(knightPoolRenderer, /data-runtime-knight-pool-action="clear"/);
const guideAt = knightBoardRenderer.indexOf("${renderKnightRoundGuide()}");
const coreAt = knightBoardRenderer.indexOf("${renderKnightCoreCards(member)}");
const poolAt = knightBoardRenderer.indexOf("${renderKnightPool(manager)}");
const handAt = knightBoardRenderer.indexOf("${renderRuntimeHand(member)}");
assert.ok(guideAt >= 0 && guideAt < coreAt, "Knight Round guide must sit above the Knight Board");
assert.ok(coreAt < poolAt && poolAt < handAt, "shared Knight Pool must sit between the Knight Board and technique hand");
assert.equal((knightBoardRenderer.match(/renderKnightPool\(manager\)/g) || []).length, 1, "Knight Board must render the shared pool exactly once");
assert.match(partyRenderer, /member\.kind==="knight"\?renderKnightBoard\(member,manager\)/);
assert.match(partyRenderer, /:renderSquireBoard\(member,manager\)/, "squire workspace must use the compact shared board");
const squirePoolAt = squireBoardRenderer.indexOf("${renderKnightPool(manager)}");
const squireCardAt = squireBoardRenderer.indexOf("${renderRuntimeCurves(member,true)}");
const squireAttributesAt = squireBoardRenderer.indexOf("${renderRuntimeAttributes(member,true)}");
const squireEquipmentAt = squireBoardRenderer.indexOf("${renderRuntimeEquipment(member,true)}");
assert.ok(squirePoolAt >= 0 && squirePoolAt < squireCardAt, "Squire board must retain the shared Knight Pool above the board row");
assert.ok(squireCardAt < squireAttributesAt && squireAttributesAt < squireEquipmentAt, "Squire card, attributes and equipment must share one ordered row");
assert.equal((squireBoardRenderer.match(/renderKnightPool\(manager\)/g) || []).length, 1);
assert.doesNotMatch(partyRenderer, /<\/header>\$\{renderKnightPool\(manager\)\}\$\{member\.kind/, "shared pool must no longer render unconditionally below the member header");

assert.match(styles, /\.squire-board-deck\{[^}]*grid-template-columns:minmax\(230px,1\.15fr\) minmax\(100px,\.55fr\) minmax\(180px,\.85fr\)[^}]*grid-template-areas:"selectors selectors selectors" "card attributes equipment"/);
assert.match(styles, /\.squire-primary-selectors\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(styles, /\.squire-card-zone\{grid-area:card/);
assert.match(styles, /\.squire-board-deck \.squire-runtime-card\.card-only\{grid-template-columns:1fr/);
assert.match(mobileKnightStyles, /\.squire-board-deck\{grid-template-columns:1fr;grid-template-areas:"selectors" "card" "attributes" "equipment"/);

assert.equal(Object.keys(data.knights).length, 7);
assert.equal(Object.keys(data.squires).length, 8);
assert.equal(Object.values(data.squires).flatMap(squire => squire.tiers).length, 24);
assert.equal(Object.keys(data.mettle.cards).length, 40);
assert.equal(data.mettle.startingCardIds.length, 18);
assert.equal(Object.values(data.knights).filter(knight => knight.profession?.art && knight.profession?.backArt).length, 7);
assert.ok(Object.values(data.knights).every(knight => knight.techniques.length === 26));
assert.ok(Object.values(data.knights).every(knight => knight.startingTechniqueIds.length === 5));
assert.equal(Object.values(data.knights).flatMap(knight => knight.techniques).filter(card => card.art && card.backArt).length, 182);
assert.ok(Object.values(data.knights).every(knight => knight.professions.length === 5));
assert.ok(Object.values(data.knights).every(knight => knight.heroicArcs.length === 8));
assert.ok(Object.values(data.knights).every(knight => knight.perilArcs.length === 8));
const portraitCatalog = {
  fleischritter: { cardIds: [1000, 1002, 1003], backCardId: 1001, refresh: [3, 4, 5] },
  kara: { cardIds: [1004, 1006, 1007], backCardId: 1005, refresh: [3, 4, 5] },
  paracelsa: { cardIds: [1008, 1010, 1011], backCardId: 1009, refresh: [2, 3, 4] },
  renholder: { cardIds: [1012, 1014, 1015], backCardId: 1013, refresh: [3, 4, 6] },
  "ser-sonch": { cardIds: [1016, 1018, 1019], backCardId: 1017, refresh: [3, 4, 5] },
  stoneface: { cardIds: [1020, 1022, 1023], backCardId: 1021, refresh: [2, 3, 4] },
  "ser-ubar": { cardIds: [1024, 1026, 1027], backCardId: 1025, refresh: [3, 4, 5] },
};
for (const [knightId, expected] of Object.entries(portraitCatalog)) {
  const portraits = data.knights[knightId].portraits;
  assert.deepEqual(portraits.map(card => card.cardId), expected.cardIds);
  assert.deepEqual(portraits.map(card => card.cardRefresh), expected.refresh);
  assert.deepEqual(portraits.map(card => card.name), ["初始肖像", "封臣级肖像", "恶魔级肖像"]);
  assert.equal(portraits[0].backCardId, expected.backCardId);
  assert.ok(portraits[0].art && portraits[0].backArt, `${knightId} initial portrait must include its round-overview back`);
  assert.ok(portraits.slice(1).every(card => card.art && !Object.hasOwn(card, "backArt")), `${knightId} advanced portraits must be independent face cards`);
}
assert.ok(Object.values(data.knights).every(knight => knight.portrait?.art?.scale === 2));
assert.equal(data.knightPoolTokens.length, 16);
assert.equal(data.knightPoolTokens.filter(token => token.kind === "knight").length, 13);
assert.equal(data.knightPoolTokens.filter(token => token.kind === "resource").length, 3);
const resourceIconCrops = {
  magic: { x: 0.018743, y: 0.018136, width: 0.473645, height: 0.473339 },
  fleisch: { x: 0.037603, y: 0.043988, width: 0.595743, height: 0.583743 },
  zeal: { x: 0.025175, y: 0.032297, width: 0.653033, height: 0.653742 },
};
for (const token of data.knightPoolTokens.filter(token => token.kind === "resource")) assert.deepEqual(token.iconCrop, resourceIconCrops[token.id], `${token.id} must crop the authoritative front face from its TTS mesh texture`);
assert.deepEqual(data.knightPoolTokens.filter(token => token.kind === "resource").map(token => token.id), ["magic", "fleisch", "zeal"]);
assert.ok(data.knightPoolTokens.every(token => token.nameZhCn && token.iconAsset && fs.existsSync(`public${token.iconAsset}`)));
assert.ok(data.chargeTokenAsset && fs.existsSync(`public${data.chargeTokenAsset}`));
assert.equal(data.gearCards.length, 202);
assert.ok(data.gearCards.some(card => card.name === "Knighves"));
assert.equal(data.gearCards.filter(card => card.art && card.backArt).length, data.gearCards.length);
assert.equal(new Set(data.gearCards.map(card => card.catalogId)).size, data.gearCards.length);
assert.equal(data.gearUpgrades.length, 40);
assert.equal(data.gearUpgrades.filter(card => card.art && card.backArt).length, data.gearUpgrades.length);
assert.equal(new Set(data.gearUpgrades.map(card => card.catalogId)).size, data.gearUpgrades.length);
const expectedMercenaries = [
  [26600, "Bard", "吟游诗人", 1, 3, "both"],
  [26601, "Bard", "吟游诗人", 2, 4, "both"],
  [26602, "Bard", "吟游诗人", 3, 7, "both"],
  [26603, "Healer", "医师", 1, 2, "both"],
  [26604, "Healer", "医师", 2, 4, "both"],
  [26605, "Healer", "医师", 3, 8, "both"],
  [26606, "Mage", "法师", 1, 3, "both"],
  [26607, "Mage", "法师", 2, 5, "both"],
  [26608, "Mage", "法师", 3, 9, "both"],
  [26609, "Rogue", "盗贼", 1, 3, "both"],
  [26610, "Rogue", "盗贼", 2, 5, "both"],
  [26611, "Rogue", "盗贼", 3, 9, "both"],
  [26612, "Warrior", "战士", 1, 2, "both"],
  [26613, "Warrior", "战士", 2, 5, "both"],
  [26614, "Warrior", "战士", 3, 8, "both"],
  [26615, "Swamp Strider", "沼地摆渡人", 1, 3, "sunken"],
  [26616, "Ruin Stalker", "废墟追踪者", 1, 6, "stone"],
];
assert.equal(data.mercenaries.length, 17);
assert.deepEqual(
  data.mercenaries.map(card => [card.cardId, card.name, card.nameZhCn, card.level, card.cost, card.kingdom]),
  expectedMercenaries,
);
assert.deepEqual(data.mercenaries.map(card => card.id), data.mercenaries.map(card => `mercenary:${card.cardId}`));
assert.deepEqual(data.mercenaries.map(card => card.catalogId), data.mercenaries.map(card => card.id));
assert.equal(new Set(data.mercenaries.map(card => card.catalogId)).size, expectedMercenaries.length);
assert.ok(data.mercenaries.every(card => card.art && card.backArt), "mercenary catalog must include authoritative front and back atlas art");
assert.ok(data.mercenaries.every(card => fs.existsSync(`public${card.art.asset}`) && fs.existsSync(`public${card.backArt.asset}`)), "mercenary atlas assets must be copied into the public card catalog");
for (const asset of ["ca569066ae85be04.jpg", "81d0c6a856a44910.jpg"]) assert.match(gitignore, new RegExp(`!KF_Unified_Assistant/public/assets/characters/knight-cards/${asset.replace(".", "\\.")}`), `${asset} must be publishable rather than ignored`);
assert.ok(Array.isArray(data.knightPoolTokens));
assert.ok(data.knightPoolTokens.length >= 7);
assert.ok(data.knightPoolTokens.every(token => token.id && (token.name || token.label || token.nameZhCn) && token.iconAsset), "knight pool token catalog must expose names and icon art");
assert.ok(data.knightPoolTokens.filter(token => token.kind === "resource").length >= 3, "Magic, Fleisch and Zeal must be modeled as persistent shared resources");
for (const knight of Object.values(data.knights)) {
  assert.ok(knight.startingGear.fixed.every(card => card.art && card.backArt), `${knight.id} starting gear must show card art`);
}

console.log("character manager integration: UI, persistence and authoritative catalogs verified");
