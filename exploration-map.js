const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const EXPLORATION_STORAGE_KEY = 'hollow:exploration-map:v1';
const MAX_MAPS = 32;
const validSize = size => Number.isInteger(size) && size >= 1 && size <= 64;
const validIndex = (index, size) => Number.isInteger(index) && index >= 0 && index < size * size;
const validSeed = seed => typeof seed === 'string' && seed.length <= 256;
const validFloor = floor => Number.isInteger(floor) && floor >= 0 && floor <= 255
  || typeof floor === 'string' && floor.length > 0 && floor.length <= 32;
const keyFor = (seed, floor, size) => JSON.stringify([seed, floor, size]);
function safeEdge(callback, a, b, d) {
  try { return typeof callback === 'function' && !!callback(a, b, d); }
  catch { return false; }
}

/** Center-to-center supercover LOS. At a corner BOTH routes must be open:
 * touching wall corners never create a diagonal peek into an unseen room. */
export function hasLineOfSight({size, from, to, canSeeEdge}) {
  if (!validSize(size) || !validIndex(from, size) || !validIndex(to, size)) return false;
  if (from === to) return true;
  let x = from % size, z = Math.floor(from / size);
  const endX = to % size, endZ = Math.floor(to / size), dx = endX - x, dz = endZ - z;
  const sx = Math.sign(dx), sz = Math.sign(dz), stepX = dx ? 1 / Math.abs(dx) : Infinity, stepZ = dz ? 1 / Math.abs(dz) : Infinity;
  let tx = stepX / 2, tz = stepZ / 2;
  const edge = (ax, az, bx, bz) => {
    if (ax < 0 || az < 0 || bx < 0 || bz < 0 || ax >= size || az >= size || bx >= size || bz >= size) return false;
    const d = DIRS.findIndex(([vx, vz]) => vx === bx - ax && vz === bz - az);
    return d >= 0 && safeEdge(canSeeEdge, az * size + ax, bz * size + bx, d);
  };
  for (let guard = 0; guard < size * 2; guard++) {
    if (x === endX && z === endZ) return true;
    if (Math.abs(tx - tz) < 1e-9) {
      if (!edge(x, z, x + sx, z) || !edge(x, z, x, z + sz)
        || !edge(x + sx, z, x + sx, z + sz) || !edge(x, z + sz, x + sx, z + sz)) return false;
      x += sx; z += sz; tx += stepX; tz += stepZ;
    } else if (tx < tz) {
      if (!edge(x, z, x + sx, z)) return false;
      x += sx; tx += stepX;
    } else {
      if (!edge(x, z, x, z + sz)) return false;
      z += sz; tz += stepZ;
    }
  }
  return x === endX && z === endZ;
}

export function computeVisibility({size, origin, radius = 4, canSeeEdge}) {
  const visible = new Set();
  if (!validSize(size) || !validIndex(origin, size) || !Number.isFinite(radius) || radius < 0 || radius > 32) return visible;
  const x = origin % size, z = Math.floor(origin / size), span = Math.ceil(radius);
  for (let zz = Math.max(0, z - span); zz <= Math.min(size - 1, z + span); zz++) {
    for (let xx = Math.max(0, x - span); xx <= Math.min(size - 1, x + span); xx++) {
      const index = zz * size + xx;
      if (Math.hypot(xx - x, zz - z) <= radius + 1e-9 && hasLineOfSight({size, from: origin, to: index, canSeeEdge})) visible.add(index);
    }
  }
  return visible;
}

function restore(value) {
  if (value?.version !== 1 || !Array.isArray(value.maps) || value.maps.length > MAX_MAPS) return null;
  const maps = new Map();
  for (const m of value.maps) {
    if (!validSeed(m?.seed) || !validFloor(m.floor) || !validSize(m.size) || !Array.isArray(m.cells) || m.cells.length > m.size * m.size) return null;
    const key = keyFor(m.seed, m.floor, m.size), known = new Map();
    if (maps.has(key)) return null;
    for (const cell of m.cells) {
      if (!Array.isArray(cell) || cell.length !== 4 || !validIndex(cell[0], m.size) || !Number.isInteger(cell[1]) || cell[1] < 0 || cell[1] > 15
        || ![0, 1].includes(cell[2]) || ![0, 1].includes(cell[3]) || known.has(cell[0])) return null;
      known.set(cell[0], {exits: cell[1], water: cell[2] === 1, stairs: cell[3] === 1});
    }
    maps.set(key, {seed: m.seed, floor: m.floor, size: m.size, known});
  }
  return maps;
}

/** Pure discovery model. Visibility is recomputed (never persisted); remembered
 * sockets/features update only when a cell is visible. Closed doors may change
 * between calls without moving the observer. Default tiles use 4.8m spacing.
 * Optional state.stairs/state.stairIndex/state.architecture.stair supplies marks.
 */
export function createExplorationModel({storage, radius = 4, tileSize = 4.8} = {}) {
  if (!Number.isFinite(radius) || radius < 0 || radius > 32 || !Number.isFinite(tileSize) || tileSize <= 0) throw new TypeError('Invalid exploration dimensions.');
  let maps = new Map(), persistenceError = null, current = null;
  try { if (storage === undefined) storage = globalThis.localStorage ?? null; }
  catch { storage = null; persistenceError = 'Map storage is unavailable.'; }
  try {
    const raw = storage?.getItem(EXPLORATION_STORAGE_KEY);
    if (raw) {
      const loaded = typeof raw === 'string' && raw.length <= 2_000_000 ? restore(JSON.parse(raw)) : null;
      if (loaded) maps = loaded;
      else persistenceError = 'Saved exploration map is invalid.';
    }
  } catch { persistenceError = 'Saved exploration map could not be read.'; }
  function snapshot() {
    return {version: 1, maps: [...maps.values()].map(m => ({seed: m.seed, floor: m.floor, size: m.size,
      cells: [...m.known].map(([index, info]) => [index, info.exits, +info.water, +info.stairs])}))};
  }
  function persist() {
    if (!storage) return false;
    try { storage.setItem(EXPLORATION_STORAGE_KEY, JSON.stringify(snapshot())); persistenceError = null; return true; }
    catch { persistenceError = 'Exploration map could not be saved.'; return false; }
  }
  function update(state) {
    current = null;
    const {seed, floor, size, grid, tiles, position} = state ?? {}, spacing = state?.tileSize ?? tileSize;
    if (!validSeed(seed) || !validFloor(floor) || !validSize(size) || !Array.isArray(grid) || grid.length !== size * size
      || !Array.isArray(tiles) || !Number.isFinite(position?.x) || !Number.isFinite(position?.z) || !Number.isFinite(spacing) || spacing <= 0) return null;
    const ox = Math.floor(position.x / spacing + size / 2), oz = Math.floor(position.z / spacing + size / 2);
    if (ox < 0 || oz < 0 || ox >= size || oz >= size) return null;
    const origin = oz * size + ox, cache = new Map();
    const sockets = i => tiles[grid[i]]?.s;
    const edge = (a, b, d) => {
      const key = a + ':' + d;
      if (cache.has(key)) return cache.get(key);
      const sa = sockets(a), sb = sockets(b);
      const valid = Array.isArray(sa) && sa.length === 4 && sa.every(v => [0, 1, 2].includes(v))
        && Array.isArray(sb) && sb.length === 4 && sb.every(v => [0, 1, 2].includes(v));
      const allowed = valid && (typeof state.canSeeEdge === 'function' ? safeEdge(state.canSeeEdge, a, b, d) : sa[d] !== 0 && sa[d] === sb[(d + 2) % 4]);
      cache.set(key, !!allowed); return !!allowed;
    };
    if (!Array.isArray(sockets(origin)) || sockets(origin).length !== 4 || !sockets(origin).every(v => [0, 1, 2].includes(v))) return null;
    const visible = computeVisibility({size, origin, radius, canSeeEdge: edge}), key = keyFor(seed, floor, size);
    let record = maps.get(key), changed = false;
    if (!record) { record = {seed, floor, size, known: new Map()}; maps.set(key, record); changed = true; }
    const stairs = new Set(), hasStairsMetadata = state.stairs !== undefined || state.stairIndex !== undefined || state.architecture?.stair !== undefined;
    const authoredStairs = state.stairs instanceof Set ? [...state.stairs] : Array.isArray(state.stairs) ? state.stairs : [];
    for (const candidate of [...authoredStairs, state.stairIndex, state.architecture?.stair]) {
      const index = typeof candidate === 'object' ? candidate?.index : candidate;
      if (validIndex(index, size)) stairs.add(index);
    }
    for (const index of visible) {
      let exits = 0;
      for (let d = 0; d < 4; d++) {
        const [dx, dz] = DIRS[d], x = index % size + dx, z = Math.floor(index / size) + dz;
        if (x >= 0 && z >= 0 && x < size && z < size && edge(index, z * size + x, d)) exits |= 1 << d;
      }
      const old = record.known.get(index), info = {exits, water: sockets(index).includes(2), stairs: hasStairsMetadata ? stairs.has(index) : old?.stairs ?? false};
      if (!old || old.exits !== info.exits || old.water !== info.water || old.stairs !== info.stairs) { record.known.set(index, info); changed = true; }
    }
    // Recently used maps are retained, keeping local-storage growth bounded.
    maps.delete(key); maps.set(key, record);
    while (maps.size > MAX_MAPS) { maps.delete(maps.keys().next().value); changed = true; }
    if (changed) persist();
    current = {key, seed, floor, size, origin: {index: origin, x: ox, z: oz}, radius,
      visible, explored: new Set(record.known.keys()), known: new Map([...record.known].map(([index, info]) => [index, {...info}]))};
    return current;
  }
  return {update, snapshot, persist, get current() {return current;}, get persistenceError() {return persistenceError;}};
}

let mapSequence = 0;
const STYLE_ID = 'hollow-exploration-map-style';
function installStyle(document) {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style'); style.id = STYLE_ID;
  style.textContent = `
 .hollow-map{position:fixed;right:10px;top:112px;width:166px;margin:0;box-sizing:border-box;background:#090c12;border:3px double #938064;color:#c7bc9e;z-index:36;font:10px/1.3 "Lucida Console","Courier New",monospace;box-shadow:2px 2px 0 #000;pointer-events:auto}
 .hollow-map[hidden]{display:none!important}.hollow-map header{position:static;height:auto;display:flex;justify-content:space-between;align-items:center;padding:4px 5px;background:#171c29;border:0;border-bottom:1px solid #686556;letter-spacing:0;font-size:10px}
 .hollow-map button{min-height:20px;padding:2px 4px;background:#272d39;border:1px solid #8d816c;border-radius:0;color:#d4c5a4;font:10px monospace;pointer-events:auto}.hollow-map button:focus-visible{outline:2px solid #d7b97d}
 .hollow-map canvas{display:block;width:100%;height:auto;aspect-ratio:1;image-rendering:pixelated;background:#000}.hollow-map figcaption{padding:3px 5px;border-top:1px solid #393c43;color:#a9a799;font-size:9px}
 .party-pane .hollow-map{position:absolute;width:126px;right:6px;top:48px;bottom:auto;pointer-events:auto}
 .hollow-map.expanded,.party-pane .hollow-map.expanded{position:fixed;left:50%;top:50%;right:auto;bottom:auto;transform:translate(-50%,-50%);width:min(620px,calc(100vw - 30px),calc(100dvh - 120px));z-index:170}
 @media(max-width:700px){.hollow-map{width:132px}.party-pane .hollow-map{width:100px}.hollow-map.expanded{width:min(520px,calc(100vw - 24px),calc(100dvh - 100px))}}`;
  document.head.appendChild(style);
}
function paint(canvas, map, yaw) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const cell = 12, pad = 4, span = map.size * cell + pad * 2;
  if (canvas.width !== span || canvas.height !== span) { canvas.width = span; canvas.height = span; }
  ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, span, span);
  for (const [index, info] of map.known) {
    const visible = map.visible.has(index), x = pad + index % map.size * cell, z = pad + Math.floor(index / map.size) * cell;
    ctx.fillStyle = info.water ? visible ? '#568c99' : '#263b43' : visible ? '#99988a' : '#383c42';
    ctx.fillRect(x, z, cell, cell); ctx.strokeStyle = visible ? '#171a20' : '#0b0e13'; ctx.lineWidth = 2;
    for (let d = 0; d < 4; d++) if (!(info.exits & 1 << d)) {
      const ends = [[x, z, x + cell, z], [x + cell, z, x + cell, z + cell], [x, z + cell, x + cell, z + cell], [x, z, x, z + cell]][d];
      ctx.beginPath(); ctx.moveTo(ends[0], ends[1]); ctx.lineTo(ends[2], ends[3]); ctx.stroke();
    }
    if (info.stairs) {
      ctx.fillStyle = visible ? '#e0bd76' : '#74613f';
      for (let step = 0; step < 3; step++) ctx.fillRect(x + 2 + step * 2, z + 2 + step * 2, 6 - step * 2, 2);
    }
  }
  ctx.save(); ctx.translate(pad + (map.origin.x + .5) * cell, pad + (map.origin.z + .5) * cell); ctx.rotate(-yaw);
  ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(4, 4); ctx.lineTo(0, 2); ctx.lineTo(-4, 4); ctx.closePath();
  ctx.fillStyle = '#f2c66e'; ctx.strokeStyle = '#080a0e'; ctx.lineWidth = 1; ctx.fill(); ctx.stroke(); ctx.restore();
}

/** Host calls tick once per simulation frame; no RAF or app listeners are owned.
 * M toggles the map only for a focused first-person observer (focused defaults
 * true). Pass parent to mount within a party pane. Optional stairs metadata is
 * needed to draw stair icons; it is always filtered through discovery first.
 */
export function createExplorationMap({getState, storage, radius = 4, tileSize = 4.8, parent} = {}) {
  if (typeof getState !== 'function') throw new TypeError('Exploration map requires getState.');
  const document = globalThis.document;
  if (!document?.createElement || !document.body || !document.head) throw new Error('Exploration map UI requires a document. Use createExplorationModel for headless logic.');
  installStyle(document);
  const model = createExplorationModel({storage, radius, tileSize});
  const element = document.createElement('figure'); element.className = 'hollow-map'; element.id = 'hollow-map-' + ++mapSequence; element.hidden = true;
  const header = document.createElement('header'), label = document.createElement('span'), button = document.createElement('button'), canvas = document.createElement('canvas'), caption = document.createElement('figcaption');
  label.textContent = 'EXPLORED MAP'; button.type = 'button'; button.textContent = '[M] Expand'; button.setAttribute('aria-expanded', 'false');
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Discovered dungeon floor, showing visible and previously explored cells.');
  header.appendChild(label); header.appendChild(button); element.appendChild(header); element.appendChild(canvas); element.appendChild(caption); (parent ?? document.body).appendChild(element);
  let expanded = false, destroyed = false;
  function setExpanded(value) {
    if (destroyed) return;
    expanded = !!value; element.classList.toggle('expanded', expanded); button.textContent = expanded ? '[M] Close' : '[M] Expand'; button.setAttribute('aria-expanded', String(expanded));
  }
  const read = () => { try {return getState();} catch {return null;} };
  const keydown = event => {
    if (destroyed || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.key?.toLowerCase() !== 'm') return;
    const active = document.activeElement;
    if (active?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(active?.tagName) || document.querySelector?.('dialog[open]')) return;
    const state = read(); if (!state?.firstPerson || state.focused === false || element.hidden) return;
    event.preventDefault(); setExpanded(!expanded);
  };
  const click = () => setExpanded(!expanded);
  document.addEventListener('keydown', keydown); button.addEventListener('click', click);
  function tick() {
    if (destroyed) return null;
    const state = read(), map = state?.firstPerson && !state.paused ? model.update(state) : null;
    element.hidden = !map || !state?.firstPerson || state.display===false;
    if (element.hidden) {setExpanded(false); return map;}
    const yaw = Number.isFinite(state.yaw) ? state.yaw : 0;
    paint(canvas, map, yaw); label.textContent = 'FLOOR ' + String(state.floor);
    caption.textContent = `${map.visible.size} visible / ${map.explored.size} explored`;
    return map;
  }
  return {model, element, canvas, tick, setExpanded, get expanded() {return expanded;}, destroy() {
    if (destroyed) return;
    destroyed = true; document.removeEventListener('keydown', keydown); button.removeEventListener('click', click); element.remove();
  }};
}
