"""KF map alignment: detect the printed path exits on the tile faces and solve tile positions so
that neighbouring exits meet. Output feeds public/modules/map/data/map-layout.js.

Usage (from KF_Unified_Assistant/, needs numpy + Pillow and the tile images in public/assets/map):
  python tools/map-align/align_map.py detect public/assets/map tools/map-align/exits.json
  python tools/map-align/align_map.py solve tools/map-align/exits.json tools/map-align/layout.json
  python tools/map-align/align_map.py write tools/map-align/layout.json public/modules/map/data/map-layout.js

Coordinates
- Map units: TTS units, x right, y down (same as map-data.js x/y). 1 unit = PX_PER_UNIT image pixels.
- Image-local edges: top/right/bottom/left of the unrotated face image.
"""
import json, math, os, sys
import numpy as np
from PIL import Image

PX_PER_UNIT = 236.2
HERE = os.path.dirname(os.path.abspath(__file__))
EDGES = ('top', 'right', 'bottom', 'left')


MAP_DATA = os.path.join(HERE, '..', '..', 'public', 'modules', 'map', 'data', 'map-data.js')
PREFIX = 'window.KF_MOD_DATA='


def load_maps():
    with open(MAP_DATA, encoding='utf-8') as f:
        text = f.read()
    return json.loads(text[len(PREFIX):].rstrip(';\r\n'))['maps']


def tts_angle(rotation):
    r = rotation if rotation is not None else 180
    return ((r - 180 + 540) % 360) - 180


def tile_units(tile):
    """Unrotated image size in map units, from the image's own pixel size."""
    img = tile['image']
    return img['cellWidth'] / PX_PER_UNIT, img['cellHeight'] / PX_PER_UNIT


# --- exit detection -------------------------------------------------------

def edge_lines(arr, edge, depth_px):
    """Pixel line parallel to `edge`, `depth_px` inside the image, ordered along the edge
    (left->right for top/bottom, top->bottom for left/right)."""
    h, w = arr.shape[:2]
    d = int(round(depth_px))
    if edge == 'top':
        return arr[d, :]
    if edge == 'bottom':
        return arr[h - 1 - d, :]
    if edge == 'left':
        return arr[:, d]
    return arr[:, w - 1 - d]


def runs(mask):
    """(start, end) index pairs of True runs, end exclusive."""
    m = np.concatenate([[False], mask, [False]])
    diff = np.diff(m.astype(np.int8))
    starts = np.flatnonzero(diff == 1)
    ends = np.flatnonzero(diff == -1)
    return list(zip(starts, ends))


def detect_edge(gray, sat, edge, ppu, along_len_px):
    """Exit candidates on one edge: list of dicts with centre (px along edge), support, width."""
    bar_min, bar_max = 0.010 * ppu, 0.060 * ppu   # white bar width range
    flank = max(1, int(round(0.022 * ppu)))        # dark outline search distance
    depths = np.arange(max(1.0, 0.02 * ppu), 0.13 * ppu, max(1.0, 0.006 * ppu))
    corner = 0.06 * ppu
    hits = []
    for d in depths:
        g = edge_lines(gray, edge, d).astype(float)
        s = edge_lines(sat, edge, d).astype(float)
        bright = (g > 175) & (s < 70)
        dark = g < 105
        for a, b in runs(bright):
            width = b - a
            if width < bar_min or width > bar_max:
                continue
            c = (a + b - 1) / 2
            if c < corner or c > along_len_px - corner:
                continue
            left = dark[max(0, a - flank):a].any()
            right = dark[b:min(len(dark), b + flank)].any()
            if left and right:
                hits.append((c, width, d))
    if not hits:
        return []
    hits.sort()
    clusters, cur = [], [hits[0]]
    tol = 0.025 * ppu
    for h in hits[1:]:
        if h[0] - np.median([x[0] for x in cur]) <= tol:
            cur.append(h)
        else:
            clusters.append(cur)
            cur = [h]
    clusters.append(cur)
    out = []
    n_depths = len(depths)
    for cl in clusters:
        depth_set = {round(x[2], 2) for x in cl}
        support = len(depth_set) / n_depths
        near = [x for x in cl if x[2] <= 0.06 * ppu]
        out.append({
            'center': float(np.median([x[0] for x in cl])),
            'width': float(np.median([x[1] for x in cl])),
            'support': round(support, 3),
            'nearEdge': len({round(x[2], 2) for x in near}),
        })
    out.sort(key=lambda c: -c['support'])
    return out


def detect_tile(path, tile):
    im = Image.open(path).convert('RGB')
    arr = np.asarray(im).astype(np.int16)
    gray = arr.mean(axis=2)
    sat = arr.max(axis=2) - arr.min(axis=2)
    h, w = gray.shape
    uw, uh = tile_units(tile)
    ppu = (w / uw + h / uh) / 2
    result = {'imageSize': [w, h], 'ppu': ppu, 'edges': {}}
    for edge in EDGES:
        along = w if edge in ('top', 'bottom') else h
        cands = detect_edge(gray, sat, edge, ppu, along)
        # store along-edge offsets from the edge midpoint, in map units
        for c in cands:
            c['offset'] = round((c['center'] - (along - 1) / 2) / ppu, 4)
        result['edges'][edge] = cands
    return result


def cmd_detect(image_dir, out_path):
    maps = load_maps()
    out = {}
    for code, kingdom in maps.items():
        for tile in kingdom['tiles']:
            face = os.path.basename(tile['image']['face'])
            p = os.path.join(image_dir, face)
            if not os.path.exists(p):
                p = os.path.join(image_dir, os.path.splitext(face)[0] + '.jpg')
            if not os.path.exists(p):
                print('missing', face)
                continue
            out[tile['id']] = detect_tile(p, tile)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print('tiles', len(out))


# --- geometry --------------------------------------------------------------

OPP = {'N': 'S', 'S': 'N', 'E': 'W', 'W': 'E'}
# map direction of each image edge for a given clockwise CSS rotation
EDGE_TO_DIR = {
    0: {'top': 'N', 'right': 'E', 'bottom': 'S', 'left': 'W'},
    90: {'top': 'E', 'right': 'S', 'bottom': 'W', 'left': 'N'},
    -90: {'top': 'W', 'right': 'N', 'bottom': 'E', 'left': 'S'},
    180: {'top': 'S', 'right': 'W', 'bottom': 'N', 'left': 'E'},
}


def rot(dx, dy, angle):
    t = math.radians(angle)
    return dx * math.cos(t) - dy * math.sin(t), dx * math.sin(t) + dy * math.cos(t)


class Tile:
    def __init__(self, raw, code):
        self.raw, self.id, self.code = raw, raw['id'], code
        self.angle = tts_angle(raw.get('rotation'))
        if self.angle == -180:
            self.angle = 180
        self.uw, self.uh = tile_units(raw)
        swap = abs(self.angle) == 90
        self.W, self.H = (self.uh, self.uw) if swap else (self.uw, self.uh)
        # TTS geometry (as the app renders it today)
        th = 3.06 * raw['scale']
        tw = th * raw['image']['aspect']
        self.tW, self.tH = (th, tw) if swap else (tw, th)
        self.x0, self.y0 = raw['x'], raw['y']

    def exit_offset(self, edge, offset):
        """Map-space offset (dx, dy) from the tile centre of an exit on an image edge."""
        hw, hh = self.uw / 2, self.uh / 2
        p = {'top': (offset, -hh), 'bottom': (offset, hh), 'left': (-hw, offset), 'right': (hw, offset)}[edge]
        return rot(p[0], p[1], self.angle)


def connections(maps):
    """Unordered tile pairs with the map direction from the first to the second tile."""
    seen = {}
    for code, kingdom in maps.items():
        for t in kingdom['tiles']:
            for p in t['rules'].get('paths', []):
                key = tuple(sorted((t['id'], p['target'])))
                if key in seen:
                    continue
                a, b = t['id'], p['target']
                seen[key] = (a, b, p['direction'], code)
    return list(seen.values())


def facing(ta, tb, d, use_tts=True):
    """Gap between facing edges and overlap along them (TTS layout by default)."""
    ax, ay, bx, by = ta.x0, ta.y0, tb.x0, tb.y0
    aW, aH, bW, bH = (ta.tW, ta.tH, tb.tW, tb.tH) if use_tts else (ta.W, ta.H, tb.W, tb.H)
    if d in ('E', 'W'):
        s = 1 if d == 'E' else -1
        gap = s * (bx - ax) - (aW + bW) / 2
        overlap = min(ay + aH / 2, by + bH / 2) - max(ay - aH / 2, by - bH / 2)
    else:
        s = 1 if d == 'S' else -1
        gap = s * (by - ay) - (aH + bH) / 2
        overlap = min(ax + aW / 2, bx + bW / 2) - max(ax - aW / 2, bx - bW / 2)
    return gap, overlap


def pick_exit(tile, exits, d, other, min_support):
    """Best detected exit on `tile`'s edge facing direction d that lands on `other`'s side."""
    edge = next(e for e, dd in EDGE_TO_DIR[tile.angle].items() if dd == d)
    best = None
    for c in exits[tile.id]['edges'][edge]:
        if c['support'] < min_support:
            continue
        dx, dy = tile.exit_offset(edge, c['offset'])
        ax, ay = tile.x0 + dx, tile.y0 + dy
        if d in ('E', 'W'):
            inside = other.y0 - other.tH / 2 - 0.05 <= ay <= other.y0 + other.tH / 2 + 0.05
        else:
            inside = other.x0 - other.tW / 2 - 0.05 <= ax <= other.x0 + other.tW / 2 + 0.05
        if not inside:
            continue
        score = c['support']
        if best is None or score > best[0]:
            best = (score, edge, c, (dx, dy))
    return best


def cmd_solve(exits_path, out_path, min_support=0.3):
    maps = load_maps()
    exits = json.load(open(exits_path, encoding='utf-8'))
    tiles = {t['id']: Tile(t, code) for code, k in maps.items() for t in k['tiles']}
    ids = sorted(tiles)
    index = {tid: i for i, tid in enumerate(ids)}
    rows_x, rows_y = [], []   # (coefficients dict, rhs, weight)
    report = []
    conns = connections(maps)
    path_pairs = set()
    for a, b, d, code in conns:
        ta, tb = tiles[a], tiles[b]
        if a == b:
            report.append({'a': a, 'b': b, 'dir': d, 'kingdom': code, 'status': 'self-loop'})
            continue
        gap, overlap = facing(ta, tb, d)
        # The labelled direction is occasionally wrong in the data; trust the side the two
        # tiles actually share in the TTS layout when that is unambiguous.
        geo = min(((abs(facing(ta, tb, dd)[0]), dd) for dd in 'NESW' if facing(ta, tb, dd)[1] > 0.2), default=None)
        labelled = d
        if geo and geo[0] < 0.8 and (abs(gap) >= 0.8 or overlap <= 0.2):
            d = geo[1]
            gap, overlap = facing(ta, tb, d)
        physical = abs(gap) < 0.8 and overlap > 0.2
        entry = {'a': a, 'b': b, 'dir': d, 'kingdom': code, 'ttsGap': round(gap, 3), 'physical': physical}
        if d != labelled:
            entry['labelledDir'] = labelled
        if not physical:
            entry['status'] = 'virtual'
            report.append(entry)
            continue
        path_pairs.add(tuple(sorted((a, b))))
        ea = pick_exit(ta, exits, d, tb, min_support)
        eb = pick_exit(tb, exits, OPP[d], ta, min_support)
        normal, along = (rows_x, rows_y) if d in ('E', 'W') else (rows_y, rows_x)
        s = 1 if d in ('E', 'S') else -1
        size = (ta.W + tb.W) / 2 if d in ('E', 'W') else (ta.H + tb.H) / 2
        normal.append(({index[b]: 1, index[a]: -1}, s * size, 10.0))
        if ea and eb:
            # along-edge: centre_a + offset_a == centre_b + offset_b
            ka = 1 if d in ('E', 'W') else 0   # along axis component index of the offset
            oa, ob = ea[3][ka], eb[3][ka]
            along.append(({index[a]: 1, index[b]: -1}, ob - oa, 10.0))
            entry.update(status='matched', exitA=[ea[1], ea[2]['offset'], ea[2]['support']],
                         exitB=[eb[1], eb[2]['offset'], eb[2]['support']], offA=ea[3], offB=eb[3])
        else:
            entry.update(status='abut-only', foundA=bool(ea), foundB=bool(eb))
        report.append(entry)
    # weak abutment for touching tiles without a path between them
    by_code = {}
    for t in tiles.values():
        by_code.setdefault(t.code, []).append(t)
    for code, lst in by_code.items():
        for i in range(len(lst)):
            for j in range(i + 1, len(lst)):
                ta, tb = lst[i], lst[j]
                if tuple(sorted((ta.id, tb.id))) in path_pairs:
                    continue
                for d in ('E', 'S'):
                    for (p, q) in ((ta, tb), (tb, ta)):
                        gap, overlap = facing(p, q, d)
                        if abs(gap) < 0.35 and overlap > 0.5:
                            normal = rows_x if d == 'E' else rows_y
                            size = (p.W + q.W) / 2 if d == 'E' else (p.H + q.H) / 2
                            normal.append(({index[q.id]: 1, index[p.id]: -1}, size, 2.0))
    # weak prior to the TTS position
    for tid, t in tiles.items():
        rows_x.append(({index[tid]: 1}, t.x0, 0.05))
        rows_y.append(({index[tid]: 1}, t.y0, 0.05))

    def lsq(rows):
        A = np.zeros((len(rows), len(ids)))
        rhs = np.zeros(len(rows))
        for r, (coef, val, w) in enumerate(rows):
            for k, v in coef.items():
                A[r, k] = v * w
            rhs[r] = val * w
        return np.linalg.lstsq(A, rhs, rcond=None)[0]

    X, Y = lsq(rows_x), lsq(rows_y)
    layout = {'version': 1, 'pxPerUnit': PX_PER_UNIT, 'source': 'kf_align.py', 'tiles': {}, 'passages': []}
    for tid, t in tiles.items():
        i = index[tid]
        layout['tiles'][tid] = {'x': round(float(X[i]), 4), 'y': round(float(Y[i]), 4),
                                'width': round(t.uw, 4), 'height': round(t.uh, 4)}
    errs = []
    for e in report:
        if e['status'] not in ('matched', 'abut-only'):
            continue
        ta, tb = tiles[e['a']], tiles[e['b']]
        ia, ib = index[e['a']], index[e['b']]
        d = e['dir']
        if d in ('E', 'W'):
            s = 1 if d == 'E' else -1
            gap = s * (X[ib] - X[ia]) - (ta.W + tb.W) / 2
            edge_x = X[ia] + s * ta.W / 2
            if e['status'] == 'matched':
                ya, yb = Y[ia] + e['offA'][1], Y[ib] + e['offB'][1]
                mis = ya - yb
                px, py = edge_x, (ya + yb) / 2
            else:
                lo = max(Y[ia] - ta.H / 2, Y[ib] - tb.H / 2); hi = min(Y[ia] + ta.H / 2, Y[ib] + tb.H / 2)
                mis, px, py = None, edge_x, (lo + hi) / 2
            axis = 'v'
        else:
            s = 1 if d == 'S' else -1
            gap = s * (Y[ib] - Y[ia]) - (ta.H + tb.H) / 2
            edge_y = Y[ia] + s * ta.H / 2
            if e['status'] == 'matched':
                xa, xb = X[ia] + e['offA'][0], X[ib] + e['offB'][0]
                mis = xa - xb
                px, py = (xa + xb) / 2, edge_y
            else:
                lo = max(X[ia] - ta.W / 2, X[ib] - tb.W / 2); hi = min(X[ia] + ta.W / 2, X[ib] + tb.W / 2)
                mis, px, py = None, (lo + hi) / 2, edge_y
            axis = 'h'
        e['gapAfter'] = round(float(gap), 4)
        e['misAfter'] = None if mis is None else round(float(mis), 4)
        if mis is not None:
            errs.append(abs(mis))
        layout['passages'].append({'a': e['a'], 'b': e['b'], 'x': round(float(px), 4), 'y': round(float(py), 4),
                                   'axis': axis, 'estimated': e['status'] != 'matched'})
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(layout, f, ensure_ascii=False, indent=1)
    with open(os.path.splitext(out_path)[0] + '_report.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
    counts = {}
    for e in report:
        counts[e['status']] = counts.get(e['status'], 0) + 1
    errs = np.array(errs) * PX_PER_UNIT
    gaps = np.array([abs(e['gapAfter']) for e in report if 'gapAfter' in e]) * PX_PER_UNIT
    print('connections', counts)
    if len(errs):
        print('along-edge misalignment after (px @ full res): median %.1f p90 %.1f max %.1f' % (
            np.median(errs), np.percentile(errs, 90), errs.max()))
    print('edge gap after (px): median %.1f p90 %.1f max %.1f' % (np.median(gaps), np.percentile(gaps, 90), gaps.max()))


def cmd_write(layout_path, out_path):
    layout = json.load(open(layout_path, encoding='utf-8'))
    out = {
        'version': 1,
        'source': 'tools/map-align/align_map.py（按卡面通道出口自动对齐）',
        'pxPerUnit': layout['pxPerUnit'],
        'tiles': {k: {kk: round(v, 3) for kk, v in t.items()} for k, t in sorted(layout['tiles'].items())},
        'passages': [{'a': p['a'], 'b': p['b'], 'x': round(p['x'], 3), 'y': round(p['y'], 3), 'axis': p['axis']}
                     for p in sorted(layout['passages'], key=lambda p: (p['a'], p['b']))],
    }
    text = 'window.KF_MAP_LAYOUT=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    print(len(out['tiles']), 'tiles', len(out['passages']), 'passages')


if __name__ == '__main__':
    if sys.argv[1] == 'detect':
        cmd_detect(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == 'solve':
        cmd_solve(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == 'write':
        cmd_write(sys.argv[2], sys.argv[3])
