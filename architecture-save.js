import {validateRoomFootprint,roomCellIndices} from './room-footprint.js?v=9cd9b6e86f47bfdd3f9c26579aa4d1f076ab67a6';
import {plan} from './architecture.js?v=9cd9b6e86f47bfdd3f9c26579aa4d1f076ab67a6';

// Preserve the exact macro recipe, including void expanded by manual stamps.
export function saveArchitecture(architecture) {
  const {footprintSet, voidSet, protected: reserved, ...recipe} = architecture;
  return {...recipe, protected: [...reserved]};
}

export function restoreArchitecture(layout, size, scale = 'mixed', catalog) {
  if (layout.architecture === undefined) return plan(size, scale);
  const p = structuredClone(layout.architecture), count = size * size;
  const cell = i => Number.isInteger(i) && i >= 0 && i < count;
  const cells = values => Array.isArray(values) && values.length <= count && values.every(cell);
  const fail = () => { throw Error('Invalid saved architecture.'); };
  if (!p || ![undefined, 2].includes(p.layoutVersion) || !cell(p.start) || !cell(p.stair) ||
      !Array.isArray(p.rooms) || p.rooms.length > 32 || !p.rooms.length ||
      p.rooms.some(r => !validateRoomFootprint(r) || ![r.x,r.z,r.w,r.h].every(Number.isInteger) || r.w < 1 || r.h < 1 || r.x < 0 || r.z < 0 || r.x+r.w > size || r.z+r.h > size) ||
      !Array.isArray(p.doors) || p.doors.length > 128 || p.doors.some(d => !cell(d.index) || !Number.isInteger(d.d) || d.d < 0 || d.d > 3) ||
      !cells(p.protected)) fail();
  for (const list of [p.pins, p.optionalPins ?? []]) {
    if (!Array.isArray(list) || list.length > count) fail();
    for (const pin of list) {
      if (!cell(pin.index) || !Array.isArray(pin.sockets) || pin.sockets.length !== 4 || pin.sockets.some(s => ![null,0,1,2].includes(s))) fail();
      const actual = catalog?.[layout.grid[pin.index]]?.s;
      if (catalog && (!actual || pin.sockets.some((s,d) => s !== null && s !== actual[d]) || pin.tile !== undefined && pin.tile !== layout.grid[pin.index])) fail();
    }
  }
  if (p.layoutVersion === 2) {
    if (typeof p.layoutSeed !== 'string' || p.layoutSeed.length > 256 || !cells(p.footprint) || !cells(p.voidCells) ||
        !cells(p.objectiveIndices) || p.objectiveIndices.length !== 3 || new Set(p.objectiveIndices).size !== 3) fail();
    p.footprintSet = new Set(p.footprint); p.voidSet = new Set(p.voidCells);
    if (p.footprintSet.size + p.voidSet.size !== count || [...p.footprintSet].some(i => p.voidSet.has(i)) ||
        [p.start,p.stair,...p.objectiveIndices,...p.rooms.flatMap(r=>roomCellIndices(r,size))].some(i => !p.footprintSet.has(i)) ||
        catalog && p.voidCells.some(i => layout.grid[i] !== 0)) fail();
  }
  p.protected = new Set(p.protected);
  return p;
}

export function objectiveIndices(architecture, size) {
  return architecture.objectiveIndices ?? [architecture.start + 1, architecture.stair - 1, architecture.stair - size];
}
