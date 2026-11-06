"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

// Aligned map layout (data/map-layout.js): tiles placed so the printed path exits meet, and the
// marker layer that draws path markers on those passages.
const context = { window: {} };
context.globalThis = context.window;
context.window.window = context.window;
vm.createContext(context.window);
for (const file of ["data/map-data.js", "data/map-layout.js", "map-view.js"]) {
  vm.runInContext(fs.readFileSync(`public/modules/map/${file}`, "utf8"), context.window);
}
const data = context.window.KF_MOD_DATA;
const layout = context.window.KF_MAP_LAYOUT;
const view = context.window.KFMapView;
const mapIndex = fs.readFileSync("public/modules/map/index.html", "utf8");
const displayIndex = fs.readFileSync("public/modules/display/index.html", "utf8");
const appSource = fs.readFileSync("public/modules/map/app.js", "utf8").replace(/\r\n/g, "\n");

assert.ok(layout && layout.version === 2, "stitched map layout data must be loaded");
const tiles = Object.values(data.maps).flatMap(kingdom => kingdom.tiles);
for (const tile of tiles) {
  const aligned = layout.tiles[tile.id];
  assert.ok(aligned, `${tile.id} must have an aligned position`);
  // Tiny scan-size differences must not open seams in the integral printed grid.
  assert.equal(aligned.width, Math.round(tile.image.cellWidth / layout.pxPerUnit), `${tile.id} width follows its printed grid`);
  assert.equal(aligned.height, Math.round(tile.image.cellHeight / layout.pxPerUnit), `${tile.id} height follows its printed grid`);
  assert.match(aligned.face, /^\/assets\/map\/aligned\/.+\.webp$/);
  assert.equal(tile.image.face, aligned.face, `${tile.id} map and detail previews share the corrected face`);
  assert.ok(aligned.warp?.points.length > 4, `${tile.id} has artwork rectification data`);
}

const byId = new Map(tiles.map(tile => [tile.id, tile]));
const extent = id => {
  const tile = byId.get(id);
  const aligned = layout.tiles[id];
  const turned = Math.abs((((Number(tile.rotation) || 180) - 180 + 540) % 360) - 180) === 90;
  const halfWidth = (turned ? aligned.height : aligned.width) / 2;
  const halfHeight = (turned ? aligned.width : aligned.height) / 2;
  return { left: aligned.x - halfWidth, right: aligned.x + halfWidth, top: aligned.y - halfHeight, bottom: aligned.y + halfHeight };
};
assert.equal(layout.seams.length, 199, "all physical seams, including edges without passages, are stitched");
for (const seam of layout.seams) {
  const a = extent(seam.a), b = extent(seam.b);
  const gap = seam.axis === "v" ? a.right - b.left : a.bottom - b.top;
  assert.ok(Math.abs(gap) < 1e-8, `${seam.a} ↔ ${seam.b}: the shared edge is exact`);
}
for (const kingdom of Object.values(data.maps)) {
  for (let i = 0; i < kingdom.tiles.length; i++) {
    for (const other of kingdom.tiles.slice(i + 1)) {
      const a = extent(kingdom.tiles[i].id), b = extent(other.id);
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      assert.ok(overlapX < 1e-8 || overlapY < 1e-8, `${kingdom.tiles[i].id} and ${other.id} never cover each other`);
    }
  }
}
assert.equal(layout.passages.length, 154, "all existing physical passages are preserved");
for (const passage of layout.passages) {
  const a = byId.get(passage.a);
  assert.ok(a && (a.neighbors.includes(passage.b) || byId.get(passage.b).neighbors.includes(passage.a)), `${passage.a} ↔ ${passage.b} must be a path connection`);
  const left = extent(passage.a);
  const right = extent(passage.b);
  const edge = passage.axis === "v"
    ? Math.min(...[left.left, left.right].flatMap(x => [right.left, right.right].map(y => Math.abs(x - y))))
    : Math.min(...[left.top, left.bottom].flatMap(x => [right.top, right.bottom].map(y => Math.abs(x - y))));
  assert.ok(edge < 1e-8, `${passage.a} ↔ ${passage.b}: the two tiles must meet edge to edge (gap ${edge.toFixed(3)})`);
  const onA = passage.axis === "v" ? Math.min(Math.abs(passage.x - left.left), Math.abs(passage.x - left.right)) : Math.min(Math.abs(passage.y - left.top), Math.abs(passage.y - left.bottom));
  assert.ok(onA < 1e-8, `${passage.a} ↔ ${passage.b}: the passage must sit on the shared edge`);
}

// The actual printed source exits and saved marker positions use the same warp.
for (const kingdom of Object.keys(data.maps)) {
  const geometry = view.stageGeometry({ kingdom, maps: { [kingdom]: { showAll: true } } }, data);
  for (const passage of layout.passages.filter(p => geometry.boxes.has(p.a))) {
    for (const [id, source] of [[passage.a, passage.sourceA], [passage.b, passage.sourceB]]) {
      const world = view.tileLocalToWorld(geometry.boxes.get(id), { x: source[0] * 100, y: source[1] * 100 });
      assert.ok(Math.hypot(world.x - passage.x, world.y - passage.y) < 2e-8,
        `${id}: its printed exit lands exactly on the common passage`);
    }
  }
  for (const box of geometry.boxes.values()) {
    for (const x of [0, 13, 37, 62, 89, 100]) {
      for (const y of [0, 19, 44, 72, 100]) {
        const world = view.tileLocalToWorld(box, { x, y });
        const local = view.worldToTileLocal(box, world);
        assert.ok(Math.abs(local.x - x) < .01 && Math.abs(local.y - y) < .01, `${box.item.id}: rectified marker round trip`);
      }
    }
  }
}

// Rendering uses the aligned geometry.
const state = {
  kingdom: "POS",
  maps: { POS: {
    placed: ["POS_Tile_S:5", "POS_Tile_M:3"],
    tileState: { "POS_Tile_S:5": "explored", "POS_Tile_M:3": "hidden" },
    current: "POS_Tile_S:5",
    pathMarkers: [{ id: "door", from: "POS_Tile_S:5", to: "POS_Tile_M:3", type: "armored", printed: true }],
    tileMarkers: [{ id: "clue", tileId: "POS_Tile_S:5", type: "martial", position: { x: 25, y: 75 } }],
    monsters: []
  } }
};
const geometry = view.stageGeometry(state, data);
const html = view.renderMapStage({ state, data, interactive: true });
const passage = view.passagePoint(geometry, "POS_Tile_S:5", "POS_Tile_M:3");
assert.ok(passage && !passage.estimated, "the S-5 ↔ M-3 passage comes from the aligned data");
const left = (passage.x - geometry.minX) / geometry.worldWidth * 100;
const top = (passage.y - geometry.minY) / geometry.worldHeight * 100;
const doorToken = html.match(/<img class="map-marker-token on-passage"[^>]*data-map-marker="door"[^>]*>/)?.[0] || "";
assert.ok(doorToken, "a bound door is drawn on the marker layer");
assert.match(doorToken, new RegExp(`left:${left}%;top:${top}%`), "the door sits exactly on the passage");
assert.match(html, /data-map-marker="clue"[^>]*data-marker-kind="tile"/, "tile markers are drawn on the marker layer and draggable");
assert.doesNotMatch(html, /data-map-token="door"|data-map-token="clue"/, "markers are no longer clipped inside a tile");
const readOnly = view.renderMapStage({ state, data, interactive: false });
assert.match(readOnly, /map-marker-layer read-only/);
assert.doesNotMatch(readOnly, /data-map-marker=/, "the second screen shows markers without drag handles");

// Local tile coordinates survive the round trip through world coordinates, also on turned tiles.
for (const id of ["POS_Tile_S:5", "POS_Tile_M:3"]) {
  const box = geometry.boxes.get(id);
  const world = view.tileLocalToWorld(box, { x: 20, y: 70 });
  const local = view.worldToTileLocal(box, world);
  assert.ok(Math.abs(local.x - 20) < .02 && Math.abs(local.y - 70) < .02, `${id}: tile-local round trip`);
  assert.equal(view.tileAtWorld(geometry, world)?.item.id, id, `${id}: the point lies on the tile`);
}
const passages = view.mapPassages(state, data, geometry);
assert.ok(passages.some(item => [item.a, item.b].sort().join("|") === "POS_Tile_M:3|POS_Tile_S:5"));
assert.equal(view.nearestPassage(passages, { x: passage.x + .3, y: passage.y - .2 })?.a !== undefined, true, "a drop near the passage snaps to it");
assert.equal(view.nearestPassage(passages, { x: passage.x + 3, y: passage.y + 3 }), null, "a drop far from every passage does not snap");

// Adjacency rules in the map app use the same aligned geometry.
assert.match(appSource, /function alignedTileLayout\(item\)[\s\S]*?KF_MAP_LAYOUT\?\.tiles/);
assert.match(appSource, /const centerX = aligned \? aligned\.x : item\.x;/);
assert.match(mapIndex, /data\/map-layout\.js\?v=2"><\/script>\s*<script src="map-view\.js\?v=\d+">/);
assert.match(displayIndex, /\.\.\/map\/data\/map-layout\.js\?v=2"><\/script>\s*<script src="\.\.\/map\/map-view\.js\?v=\d+">/);

// Printed panzergates recorded on the tile faces.
const printed = tiles.flatMap(tile => (tile.rules?.front?.armoredDoors || []).map(door => ({ tile, door })));
assert.equal(printed.length, 13, "13 printed panzergates on the Principality of Stone tiles");
for (const { tile, door } of printed) {
  assert.ok(tile.neighbors.includes(door.target), `${tile.id}: printed door leads to a neighbour`);
  assert.ok(["armored", "triple-armored"].includes(door.type), `${tile.id}: printed door type`);
  assert.ok(layout.passages.some(item => [item.a, item.b].sort().join("|") === [tile.id, door.target].sort().join("|")),
    `${tile.id} ↔ ${door.target}: the printed door has a passage to sit on`);
}

console.log("map aligned layout: 199 exact seams, no overlapping tiles, 154 rectified passages, marker round trips and printed doors verified");
