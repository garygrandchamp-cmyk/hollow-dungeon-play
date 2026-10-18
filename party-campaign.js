import {WEAPON_CATALOG} from './weapon-forge.js?v=b258c395560209e8026ca4d5dec71424998d0de6';
export const CAMPAIGN_STORAGE_KEY = 'hollow:party-campaign:v1';
export const INVENTORY_LIMIT = 16;
const MAX_GOLD = 1_000_000_000, MAX_OBJECTIVES = 1024;
const PHASES = ['lobby', 'active', 'partyVictory', 'dmVictory'];
const classDefinition = (id, name, maxHealth, maxMana, manaRegen, defaultWeapon, defaultOffhand) =>
  Object.freeze({id, name, maxHealth, maxMana, manaRegen, defaultWeapon, defaultOffhand});
/** Lowercase stable ids; names are presentation labels, not separate class ids. */
export const CLASSES = Object.freeze({
  mage: classDefinition('mage', 'Mage', 80, 140, 9, 'staff', 'magic'),
  paladin: classDefinition('paladin', 'Paladin', 140, 80, 5, 'sword', 'shield'),
  barbarian: classDefinition('barbarian', 'Barbarian', 160, 40, 3, 'axe', 'shield'),
  warlock: classDefinition('warlock', 'Warlock', 90, 130, 8, 'wand', 'magic'),
  thief: classDefinition('thief', 'Thief', 100, 60, 5, 'dagger', 'shield'),
  archer: classDefinition('archer', 'Archer', 100, 70, 5, 'bow', 'shield'),
});
const ARMOR_TYPES=['leather','brigandine','chainmail','scale','iron','knight','bone','occult','frost','blight'],ARMOR_SLOTS=['helm','chest','arms','legs'];
const lootCatalog=kind=>Object.hasOwn(WEAPON_CATALOG,kind)?WEAPON_CATALOG[kind]:kind==='dagger'?WEAPON_CATALOG.sword:kind==='wand'?WEAPON_CATALOG.staff:null;
const DEFAULT_CLASSES = ['paladin', 'mage', 'archer'];
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value, length = 128) => typeof value === 'string' && !!value.trim()
  && value.trim().length <= length && !/^data:/i.test(value.trim()) && !/[\u0000-\u001f]/.test(value);
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const classIdOf = value => typeof value === 'string' && Object.hasOwn(CLASSES, value.trim().toLowerCase()) ? value.trim().toLowerCase() : null;
const defaultEquipment = classId => ({weapon: {id: CLASSES[classId].defaultWeapon}, offhand: {id: CLASSES[classId].defaultOffhand}});
function reference(value) {
  if (typeof value === 'string') value = {id: value};
  if (!object(value) || !text(value.id)) return null;
  const result = {id: value.id.trim()};
  if (value.recipeId !== undefined) {
    if (!text(value.recipeId)) return null;
    result.recipeId = value.recipeId.trim();
  }
  return result;
}
function equipment(value) {
  if (!object(value)) return null;
  const weapon = reference(value.weapon), offhand = reference(value.offhand);
  return weapon && offhand ? {weapon, offhand} : null;
}
/** Metadata allowlist: never retain full recipes, RGBA, credentials or objects. */
function loot(value) {
  if (!object(value) || !text(value.id)) return null;
  const result = {id: value.id.trim()};
  for (const key of ['name', 'kind', 'recipeId', 'theme', 'rarity', 'weaponType']) {
    if (value[key] === undefined) continue;
    if (!text(value[key])) return null;
    result[key] = value[key].trim();
  }
  if(Object.hasOwn(value,'slot')){if(![...ARMOR_SLOTS,'weapon','offhand'].includes(value.slot))return null;result.slot=value.slot;}
  const family=result.weaponType??result.kind,catalog=lootCatalog(family),armorKind=result.kind==='armor'||ARMOR_SLOTS.includes(result.kind),armored=ARMOR_SLOTS.includes(result.slot)||result.slot===undefined&&armorKind;
  if(armorKind&&result.slot!==undefined&&!ARMOR_SLOTS.includes(result.slot)||armored&&catalog)return null;
  const hasType=Object.hasOwn(value,'armorType'),hasVariant=Object.hasOwn(value,'armorVariant');
  if((hasType||hasVariant)&&!armored)return null;
  if(hasType){if(!ARMOR_TYPES.includes(value.armorType))return null;result.armorType=value.armorType;}
  if(hasVariant){if(!integer(value.armorVariant,0,9))return null;result.armorVariant=value.armorVariant;}
  if(value.parts!==undefined&&!object(value.parts))return null;
  for(const part of ['blade','base']){const direct=Object.hasOwn(value,part),nested=Object.hasOwn(value.parts??{},part);if(!direct&&!nested)continue;const raw=direct?value[part]:value.parts[part];if(!catalog||!text(raw))return null;const normalized=raw.trim();if(!(part==='blade'?catalog.blades:catalog.bases).includes(normalized)||direct&&nested&&(!text(value.parts[part])||value.parts[part].trim()!==normalized))return null;result[part]=normalized;}
  // Seed text is opaque input to the forge hash: even whitespace/empty seeds
  // are meaningful and must not be trimmed during a persistence round-trip.
  if (value.seed !== undefined) {
    if (typeof value.seed !== 'string' || value.seed.length > 128 || /[\u0000-\u001f]/.test(value.seed) || /^data:/i.test(value.seed.trim())) return null;
    result.seed = value.seed;
  }
  if (value.color !== undefined) {
    if (typeof value.color !== 'string' || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.color)) return null;
    result.color = value.color;
  }
  for (const [key, min, max] of [['quantity', 1, 999], ['value', 0, MAX_GOLD]]) {
    if (value[key] === undefined) continue;
    if (!integer(value[key], min, max)) return null;
    result[key] = value[key];
  }
  return result;
}
const position = value => object(value) && ['x', 'y', 'z'].every(key =>
  typeof value[key] === 'number' && Number.isFinite(value[key]) && Math.abs(value[key]) <= 1_000_000)
  ? {x: value.x, y: value.y, z: value.z} : null;
function freshActor(index) {
  const classId = DEFAULT_CLASSES[index], profile = CLASSES[classId];
  return {id: `hero-${index + 1}`, classId, health: profile.maxHealth, mana: profile.maxMana,
    maxHealth: profile.maxHealth, maxMana: profile.maxMana, alive: true, escaped: false,
    gold: 0, inventory: [], equipment: defaultEquipment(classId), position: {x: 0, y: 0, z: 0}, yaw: 0, pitch: 0};
}
function readSnapshot(value) {
  if (!object(value) || value.version !== 1 || !object(value.state) || !Array.isArray(value.actors) || value.actors.length !== 3) return null;
  const s = value.state;
  if (!PHASES.includes(s.phase) || typeof s.seed !== 'string' || s.seed.length > 256
    || !integer(s.runNumber, 0, Number.MAX_SAFE_INTEGER) || !integer(s.requiredObjectives, 0, MAX_OBJECTIVES)
    || !Array.isArray(s.objectives) || s.objectives.length > s.requiredObjectives
    || s.objectives.some(key => !text(key)) || new Set(s.objectives).size !== s.objectives.length) return null;
  const actors = [];
  for (let index = 0; index < 3; index++) {
    const a = value.actors[index], classId = classIdOf(a?.classId), profile = CLASSES[classId];
    if (!object(a) || a.id !== `hero-${index + 1}` || !profile || a.classId !== classId
      || (!Number.isFinite(a.maxHealth)||a.maxHealth<profile.maxHealth||a.maxHealth>profile.maxHealth+10000) || a.maxMana !== profile.maxMana
      || !Number.isFinite(a.health) || a.health < 0 || a.health > a.maxHealth
      || !Number.isFinite(a.mana) || a.mana < 0 || a.mana > profile.maxMana
      || typeof a.alive !== 'boolean' || typeof a.escaped !== 'boolean' || a.alive !== (a.health > 0) || a.escaped && !a.alive
      || !integer(a.gold, 0, MAX_GOLD) || !Array.isArray(a.inventory) || a.inventory.length > INVENTORY_LIMIT
      || !Number.isFinite(a.yaw) || !Number.isFinite(a.pitch) || Math.abs(a.yaw) > 1_000_000 || Math.abs(a.pitch) > Math.PI / 2) return null;
    if(a.torchFuel!==undefined&&(!Number.isFinite(a.torchFuel)||a.torchFuel<0||a.torchFuel>120)||a.torchLit!==undefined&&typeof a.torchLit!=='boolean'||a.offhand!==undefined&&!['shield','magic','torch'].includes(a.offhand))return null;
    const torchFields={...(a.torchFuel!==undefined?{torchFuel:a.torchFuel}:{}),...(a.torchLit!==undefined?{torchLit:a.torchLit}:{}),...(a.offhand!==undefined?{offhand:a.offhand}:{})};
    const items = a.inventory.map(loot), gear = equipment(a.equipment), location = position(a.position);
    if (items.some(item => !item) || !gear || !location) return null;
    actors.push({...torchFields,id: a.id, classId, health: a.health, mana: a.mana, maxHealth: a.maxHealth, maxMana: profile.maxMana,
      alive: a.alive, escaped: a.escaped, gold: a.gold, inventory: items, equipment: gear, position: location, yaw: a.yaw, pitch: a.pitch});
  }
  const bossWin=s.endReason==='bossDefeated';if(s.endReason!==undefined&&s.endReason!==null&&s.endReason!=='bossDefeated')return null;const living = actors.filter(a => a.alive), complete = s.objectives.length >= s.requiredObjectives;
  if (actors.some(a => a.escaped) && !complete) return null;
  if (s.phase === 'dmVictory' && living.length || s.phase === 'partyVictory' && (!living.length || !bossWin&&(!complete || living.some(a => !a.escaped)))) return null;
  if (s.phase === 'active' && (!living.length || living.every(a => a.escaped))) return null;
  if(s.phase==='lobby'&&(s.objectives.length||s.runNumber===0&&actors.some(a=>!a.alive||a.escaped)))return null;
  if (s.phase !== 'lobby' && s.runNumber === 0) return null;
  return {state: {phase: s.phase, seed: s.seed, runNumber: s.runNumber, requiredObjectives: s.requiredObjectives, objectives: [...s.objectives],...(bossWin?{endReason:s.endReason}:{})}, actors};
}

/**
 * Pure local campaign. actors and their object identities remain stable.
 * state.objectives is a Set. Equipment slots hold {id,recipeId?} references.
 * Mutators persist best-effort; persistence failure never rolls back gameplay.
 * beginRun can force the next run while active: living carry, dead lose gear.
 */
export function createPartyCampaign(options = {}) {
  let storage = null, persistenceError = null;
  try { storage = options.storage === undefined ? globalThis.localStorage ?? null : options.storage; }
  catch { persistenceError = 'Campaign storage is unavailable.'; }
  const actors = [0, 1, 2].map(freshActor);
  const state = {phase: 'lobby', seed: '', runNumber: 0, requiredObjectives: 6, objectives: new Set()};
  try {
    const raw = storage?.getItem(CAMPAIGN_STORAGE_KEY);
    if (raw) {
      const saved = typeof raw === 'string' && raw.length <= 262144 ? readSnapshot(JSON.parse(raw)) : null;
      if (!saved) persistenceError = 'Saved campaign is invalid; a new lobby was created.';
      else {
        Object.assign(state, saved.state, {objectives: new Set(saved.state.objectives)});
        saved.actors.forEach((actor, index) => Object.assign(actors[index], actor));
      }
    }
  } catch { persistenceError = 'Saved campaign could not be read; a new lobby was created.'; }
  const actor = id => {
    const found = actors.find(a => a.id === id);
    if (!found) throw new RangeError('Unknown party actor.');
    return found;
  };
  const canAct = a => state.phase === 'active' && a.alive && !a.escaped;
  function snapshot() {
    const raw = {version: 1, state: {...state, objectives: [...state.objectives]}, actors};
    const clean = readSnapshot(raw);
    if (!clean) throw new TypeError('Campaign state is invalid.');
    return {version: 1, ...clean};
  }
  function persist() {
    if (!storage) return false;
    try { storage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(snapshot())); persistenceError = null; return true; }
    catch { persistenceError = 'Campaign could not be saved. Gameplay remains available.'; return false; }
  }
  function evaluate() {
    if (state.phase !== 'active') return state.phase;
    const living = actors.filter(a => a.alive);
    if (!living.length) state.phase = 'dmVictory';
    else if (state.objectives.size >= state.requiredObjectives && living.every(a => a.escaped)) state.phase = 'partyVictory';
    return state.phase;
  }
  function beginRun({seed, spawn, requiredObjectives = 6} = {}) {
    const location = position(spawn);
    if (typeof seed !== 'string' || seed.length > 256 || !location || !integer(requiredObjectives, 0, MAX_OBJECTIVES)) throw new TypeError('Invalid run options.');
    if (state.runNumber >= Number.MAX_SAFE_INTEGER) throw new RangeError('Campaign run limit reached.');
    for (const a of actors) {
      const profile = CLASSES[a.classId];
      if (!a.alive) { a.gold = 0; a.inventory = []; a.equipment = defaultEquipment(a.classId); }
      a.maxHealth = profile.maxHealth; a.maxMana = profile.maxMana; a.health = a.maxHealth; a.mana = a.maxMana;
      a.alive = true; a.escaped = false; Object.assign(a.position, location); a.yaw = 0; a.pitch = 0;
    }
    delete state.endReason;state.phase = 'active'; state.seed = seed; state.runNumber++; state.requiredObjectives = requiredObjectives; state.objectives.clear();
    persist(); return state;
  }
  function damage(id, amount) {
    const a = actor(id);
    if (canAct(a) && positive(amount)) {
      a.health = Math.max(0, a.health - amount);
      if (a.health === 0) { a.alive = false; a.mana = 0; }
      evaluate(); persist();
    }
    return {health: a.health, dead: !a.alive};
  }
  function heal(id, amount) {
    const a = actor(id);
    if (canAct(a) && positive(amount)) { a.health = Math.min(a.maxHealth, a.health + amount); persist(); }
    return a.health;
  }
  function spendMana(id, amount) {
    const a = actor(id);
    if (!canAct(a) || !positive(amount) || amount > a.mana) return false;
    a.mana -= amount; persist(); return true;
  }
  function regen(seconds) {
    if (state.phase !== 'active' || !positive(seconds)) return false;
    let changed = false;
    for (const a of actors) if (canAct(a) && a.mana < a.maxMana) {
      a.mana = Math.min(a.maxMana, a.mana + seconds * CLASSES[a.classId].manaRegen); changed = true;
    }
    if (changed) persist(); return changed;
  }
  function grantLoot(id, item) {
    const a = actor(id), clean = loot(item);
    if (!canAct(a) || !clean || a.inventory.length >= INVENTORY_LIMIT) return false;
    a.inventory.push(clean); persist(); return true;
  }
  function grantGold(id, amount) {
    const a = actor(id);
    if (!canAct(a) || !integer(amount, 1, MAX_GOLD) || a.gold + amount > MAX_GOLD) return false;
    a.gold += amount; persist(); return true;
  }
  function collectObjective(key) {
    if (state.phase !== 'active' || !text(key) || state.objectives.has(key.trim()) || state.objectives.size >= state.requiredObjectives) return false;
    state.objectives.add(key.trim()); persist(); return true;
  }
  function escape(id) {
    const a = actor(id);
    if (!canAct(a) || state.objectives.size < state.requiredObjectives) return false;
    a.escaped = true; evaluate(); persist(); return true;
  }
  function setClass(id, value) {
    const a = actor(id), classId = classIdOf(value);
    if (state.phase === 'active' || !classId) return false;
    if (a.classId === classId) return true;
    const profile = CLASSES[classId]; a.classId = classId; a.maxHealth = profile.maxHealth; a.maxMana = profile.maxMana;
    a.health = a.alive ? a.maxHealth : 0; a.mana = a.alive ? a.maxMana : 0; a.equipment = defaultEquipment(classId);
    persist(); return true;
  }
  function bossDefeated(){if(state.phase!=='active'||!actors.some(a=>a.alive))return false;state.phase='partyVictory';state.endReason='bossDefeated';persist();return true;}
  return {actors, state, actor, beginRun,bossDefeated, damage, heal, spendMana, regen, grantLoot, grantGold, collectObjective, escape, evaluate, setClass, persist, snapshot,
    get phase() {return state.phase;}, get seed() {return state.seed;}, get runNumber() {return state.runNumber;},
    get objectives() {return state.objectives;}, get persistenceError() {return persistenceError;}};
}
