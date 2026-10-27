const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = relative => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8').replace(/\r\n/g, '\n');
const plain = value => JSON.parse(JSON.stringify(value));
const mapSource = read('modules/map/app.js');
const mapFunction = (name, next) => mapSource.slice(mapSource.indexOf(`  function ${name}(`), mapSource.indexOf(`\n\n  function ${next}(`));

test('undo restores clue awards together with map time and preserves existing knight identity', () => {
  const c = vm.createContext({ console });
  vm.runInContext(`
    const deepCopy = value => JSON.parse(JSON.stringify(value));
    const normalizeTrackers = value => ({...value}), normalizeTrackNotes = value => ({...value});
    const MERCENARY_RULES = {normalizeState: value => value};
    const save = () => {}, toast = () => {}, addLog = () => {}, uid = () => 'id';
    const clueName = value => value, directionName = value => value, knightMatchesClue = () => true;
    const enterStep = index => state.step = index;
    let state = {kingdom:'SK', maps:{SK:{history:[],exploration:{}}}, trackers:{time:0}, trackNotes:{}, mercenaries:{}, step:0,round:1,knights:[{id:'k1',name:'K',clues:{martial:0}}]};
    const mapState = () => state.maps[state.kingdom];
    ${mapFunction('snapshotMap', 'undo')}
    ${mapFunction('undo', 'pathKey')}
    ${mapFunction('awardClueType', 'collectTileClues')}
    snapshotMap(mapState(), 'entering tile');
    awardClueType('martial', {direction:'east',source:'tile back',cardId:'card'});
    state.trackers.time++;
    undo();
    result = state;
  `, c);
  assert.equal(c.result.trackers.time, 0);
  assert.equal(c.result.knights[0].clues.martial, 0);
  assert.equal(c.result.knights[0].id, 'k1');
});

test('ordinary tile travel refuses unfinished resolutions, later phases and illegal destinations', () => {
  const c = vm.createContext({ console });
  vm.runInContext(`
    let state = {step:0,mercenaries:{}};
    const current = {current:'a',placed:['a','b'],tileState:{a:'explored',b:'hidden'},fog:{active:false},tileResolution:{tileId:'b',stage:'resolve'}};
    const mapState = () => current, tile = id => ({id,rules:{back:{time:1,clues:1}}});
    const tileLabel = value => value.id, legalUnexplored = () => ['b'];
    const toast = () => {}, snapshot = () => {}, save = () => {}, addLog = () => {};
    const enterStep = value => state.step = value;
    ${mapSource.slice(mapSource.indexOf('  function tileTravelBlockReason('),mapSource.indexOf('\n  function advanceTileResolution('))}
    const pending = current.tileResolution;
    beginTile('b');
    samePending = current.tileResolution === pending;
    current.tileResolution = null; state.step = 2; beginTile('b');
    blockedPhase = current.tileResolution === null;
    state.step = 0; beginTile('a'); illegalBlocked = current.tileResolution === null;
    beginTile('b'); validStage = current.tileResolution.stage; validStep = state.step;
  `, c);
  assert.equal(c.samePending, true);
  assert.equal(c.blockedPhase, true);
  assert.equal(c.illegalBlocked, true);
  assert.equal(c.validStage, 'back');
  assert.equal(c.validStep, 1);
});

function rogueHarness(entries, bootstrap = { campaignId: 'B', serverState: {}, offline: false }) {
  const storage = new Map([['kfActiveCampaign', 'B'], ...entries]);
  const source = read('modules/rogue/app.js');
  const functions = (first, next) => {
    const start = source.indexOf(`  function ${first}(`);
    const end = source.indexOf(`\n  function ${next}(`, start);
    assert.ok(start >= 0 && end > start, `Rogue harness function boundaries: ${first} → ${next}`);
    return source.slice(start, end);
  };
  const c = vm.createContext({
    window: { KF_MODULE_BOOTSTRAP: bootstrap },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  });
  vm.runInContext(`
    const KEY='kf-rogue-path-v2', SLOTS_KEY='kf-rogue-path-slots-v1', ACTIVE_SLOT_KEY='kf-rogue-path-active-slot-v1';
    const RULES={normalizeState:raw=>({...raw,nodes:raw.nodes||[]}),freshState:()=>({schemaVersion:1,partyName:'fresh',nodes:[]})};
    const $=()=>({}); const renderSaveSlots=()=>{},render=()=>{};
    const campaignId=()=>window.KF_MODULE_BOOTSTRAP?.campaignId||localStorage.getItem('kfActiveCampaign')||'';
    const slotsKey=()=>SLOTS_KEY+':'+campaignId(),activeSlotKey=()=>ACTIVE_SLOT_KEY+':'+campaignId();
    let slots=[],activeSlotId='';
    ${functions('load', 'refreshLabelOverrides')}
    ${functions('save', 'renderSaveSlots')}
    ${functions('switchSlot', 'createNewSlot')}
    let state=load(),linkEditorOpen=false,linkAnchorId=null,selectedNodeId=null,viewStage='rosegraal';
    getState=()=>state; changeSlot=id=>switchSlot(id);
  `, c);
  return { c, storage };
}

test('rogue restores server run B instead of global local slots A', () => {
  const { c, storage } = rogueHarness([
    ['kf-rogue-path-v2', JSON.stringify({ partyName: 'B', nodes: [] })],
    ['kf-rogue-path-slots-v1', JSON.stringify([{ id: 'A', state: { partyName: 'A', nodes: [] } }])],
  ]);
  assert.equal(c.getState().partyName, 'B');
  assert.equal(JSON.parse(storage.get('kf-rogue-path-v2')).slots.length, 1);
  assert.equal(JSON.parse(storage.get('kf-rogue-path-v2')).campaignId, 'B');
});

test('rogue synchronizes all slots and selecting a slot updates the top-level second-screen run', () => {
  const envelope = { schemaVersion: 2, campaignId: 'B', activeSlotId: 'one', slots: [
    { id: 'one', state: { partyName: 'first', nodes: [] } }, { id: 'two', state: { partyName: 'second', nodes: [] } },
  ] };
  const { c, storage } = rogueHarness([['kf-rogue-path-v2', JSON.stringify(envelope)]]);
  assert.equal(c.getState().partyName, 'first');
  c.changeSlot('two');
  const saved = JSON.parse(storage.get('kf-rogue-path-v2'));
  assert.equal(saved.partyName, 'second'); assert.equal(saved.activeSlotId, 'two'); assert.equal(saved.slots.length, 2);
  assert.equal(saved.slots[0].state.slots, undefined, 'bundles must not recursively nest');
  const restored = rogueHarness([['kf-rogue-path-v2', JSON.stringify(saved)]]);
  assert.equal(restored.c.getState().partyName, 'second');
});

test('an authoritative empty rogue campaign ignores unrelated local slots', () => {
  const { c } = rogueHarness([['kf-rogue-path-slots-v1:B', JSON.stringify([{ id: 'old', state: { partyName: 'old' } }])]], { campaignId: 'B', serverState: null, offline: false });
  assert.equal(c.getState().partyName, 'fresh');
});

test('matching legacy rogue slots migrate together without dropping inactive runs', () => {
  const legacy = { partyName: 'current', nodes: [] };
  const { storage } = rogueHarness([
    ['kf-rogue-path-v2', JSON.stringify(legacy)],
    ['kf-rogue-path-slots-v1', JSON.stringify([{ id: 'first', state: { partyName: 'other', nodes: [] } }, { id: 'current', state: legacy }])],
  ]);
  const saved = JSON.parse(storage.get('kf-rogue-path-v2'));
  assert.equal(saved.slots.length, 2); assert.equal(saved.activeSlotId, 'current');
});
