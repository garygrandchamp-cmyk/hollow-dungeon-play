import {random} from './wfc.js?v=1908281481c3818581fa62f1b68e946e615fba61';
import {CLASSES} from './party-campaign.js?v=1908281481c3818581fa62f1b68e946e615fba61';
import {WEAPON_CATALOG} from './weapon-forge.js?v=1908281481c3818581fa62f1b68e946e615fba61';

export const INVENTORY_STORAGE_KEY = 'hollow:adventurer-inventory:v1';
export const GEAR_SLOTS = Object.freeze(['helm', 'chest', 'arms', 'legs', 'weapon', 'offhand']);
export const INVENTORY_CAPACITY = 16;
const ARMOUR = ['helm', 'chest', 'arms', 'legs'];
export const WEAPONS = Object.freeze(['sword', 'axe', 'mace', 'staff', 'bow', 'dagger', 'wand', 'hammer']);
export const ARMOR_TYPES = Object.freeze(['leather','brigandine','chainmail','scale','iron','knight','bone','occult','frost','blight']);
const STAT_KEYS = ['hp', 'armor', 'melee', 'magic', 'stamina'];
const LABELS = {helm: 'Helm', chest: 'Chest', arms: 'Arms', legs: 'Legs', weapon: 'Weapon', offhand: 'Off hand'};
const CLASS_ATTACK = {mage: [0, 6, 16], paladin: [2, 12, 8], barbarian: [1, 16, 3], warlock: [0, 7, 15], thief: [0, 12, 6], archer: [1, 11, 5]};
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const text = (value, max = 128) => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value) && !/^data:/i.test(value.trim());
const seedText = value => typeof value === 'string' && value.length <= 128 && !/[\u0000-\u001f]/.test(value) && !/^data:/i.test(value.trim());
const zeros = () => ({hp: 0, armor: 0, melee: 0, magic: 0, stamina: 0});
const emptyGear = () => Object.fromEntries(GEAR_SLOTS.map(slot => [slot, null]));
const copy = value => JSON.parse(JSON.stringify(value));
function hash(value) {let n = 2166136261; for (const char of value) n = Math.imul(n ^ char.charCodeAt(0), 16777619); return (n >>> 0).toString(16).padStart(8, '0');}

function armorMetadata(seed,slot){const rng=random(JSON.stringify([seed,slot,'armor-layout:v1']));return {armorType:ARMOR_TYPES[Math.floor(rng()*ARMOR_TYPES.length)],armorVariant:Math.floor(rng()*10)};}
function partCatalog(kind){return WEAPON_CATALOG[kind]??WEAPON_CATALOG[{dagger:'sword',wand:'staff'}[kind]]??null;}
function lootParts(seed,slot,kind,theme){const catalog=partCatalog(kind);if(!catalog)return {};const rng=random(JSON.stringify([seed,slot,kind,theme,'parts:v1']));return {blade:catalog.blades[Math.floor(rng()*catalog.blades.length)],base:catalog.bases[Math.floor(rng()*catalog.bases.length)]};}

/** Deterministic metadata, never pixels. Seed includes the drop/actor id at the
 * host boundary if distinct rolls are wanted; duplicate ids cannot be farmed. */
export function generateInventoryLoot({seed = 'loot', slot, level = 1, kind, theme} = {}) {
  seed = String(seed);
  if (!seedText(seed) || !integer(level, 1, 50) || slot !== undefined && !GEAR_SLOTS.includes(slot)) throw new TypeError('Invalid loot options.');
  const choice = random(seed), pick = values => values[Math.floor(choice() * values.length)];
  slot ??= kind === 'armor' ? pick(ARMOUR) : kind === 'shield' || kind === 'magic' ? 'offhand' : WEAPONS.includes(kind) ? 'weapon' : pick(GEAR_SLOTS);
  const requestedKind=kind;
  kind = ARMOUR.includes(slot) ? 'armor' : slot === 'offhand' ? kind === 'magic' ? 'magic' : 'shield' : WEAPONS.includes(kind) ? kind : pick(['sword', 'axe', 'mace', 'staff', 'bow']);
  if(slot==='weapon'&&!WEAPONS.includes(requestedKind)&&random(seed+':hammer-family:v1')()<.12)kind='hammer';
  theme = text(theme) ? theme : pick(['steel', 'ice', 'fire', 'poison', 'arcane']);
  const rng = random(JSON.stringify([seed, slot, kind, level, theme]));
  const roll = rng(), rarity = roll < .65 ? 'common' : roll < .92 ? 'uncommon' : 'rare', tier = ['common', 'uncommon', 'rare'].indexOf(rarity);
  const stats = zeros(), bonus = Math.floor(rng() * 4) + tier;
  if (slot === 'helm') {stats.hp = 2 + level * 2 + bonus; stats.armor = 1 + Math.floor(level / 3) + tier;}
  if (slot === 'chest') {stats.hp = 6 + level * 3 + bonus; stats.armor = 2 + Math.floor(level / 2) + tier;}
  if (slot === 'arms') {stats.hp = level + bonus; stats.armor = 1 + Math.floor(level / 4); stats.melee = 1 + Math.floor(level / 4) + tier; stats.stamina = 1 + Math.floor(level / 4);}
  if (slot === 'legs') {stats.hp = 4 + level * 2 + bonus; stats.armor = 1 + Math.floor(level / 3) + tier; stats.stamina = 2 + Math.floor(level / 2);}
  if (slot === 'weapon') stats[kind === 'staff' || kind === 'wand' ? 'magic' : 'melee'] = 2 + level + tier * 3 + bonus;
  if (slot === 'offhand') {if (kind === 'magic') stats.magic = 3 + level + bonus; else stats.armor = 2 + Math.floor(level / 2) + tier;}
  const name = (tier === 2 ? 'Runed ' : tier === 1 ? 'Tempered ' : 'Worn ') + (ARMOUR.includes(slot) ? LABELS[slot] : kind[0].toUpperCase() + kind.slice(1));
  return {id: 'gear-' + hash(JSON.stringify([seed, slot, level, kind, theme])), name, kind, slot, seed, level, rarity, theme, stats,...(ARMOUR.includes(slot)?armorMetadata(seed,slot):lootParts(seed,slot,kind,theme))};
}
export const generateLoot = generateInventoryLoot;

function normalizeItem(value) {
  if (!object(value) || !text(value.id)) return null;
  const inferred = ARMOUR.includes(value.kind) ? value.kind : value.kind === 'shield' || value.kind === 'magic' ? 'offhand' : WEAPONS.includes(value.kind) ? 'weapon' : null;
  const slot = value.slot ?? inferred;
  if (!GEAR_SLOTS.includes(slot) || value.slot !== undefined && !GEAR_SLOTS.includes(value.slot)) return null;
  const level = value.level ?? 1;
  if (!integer(level, 1, 50)) return null;
  const seed = value.seed ?? value.id;
  if (!seedText(seed)) return null;
  const kind = ARMOUR.includes(slot) ? 'armor' : slot === 'weapon' ? value.kind ?? 'sword' : value.kind ?? 'shield';
  if (slot === 'weapon' && !WEAPONS.includes(kind) || slot === 'offhand' && !['shield', 'magic'].includes(kind)) return null;
  const result = {id: value.id.trim(), name: value.name ?? (ARMOUR.includes(slot) ? LABELS[slot] : kind), kind, slot, seed, level};
  if (!text(result.name)) return null;
  for (const key of ['recipeId', 'theme', 'rarity']) {
    const raw = value[key];
    if (raw === undefined) continue;
    if (!text(raw)) return null;
    result[key] = raw;
  }
  const armored=ARMOUR.includes(slot),hasType=Object.hasOwn(value,'armorType'),hasVariant=Object.hasOwn(value,'armorVariant');
  if(!armored&&(hasType||hasVariant))return null;
  if(armored){if(hasType&&!ARMOR_TYPES.includes(value.armorType)||hasVariant&&!integer(value.armorVariant,0,9))return null;Object.assign(result,armorMetadata(seed,slot),hasType?{armorType:value.armorType}:{},hasVariant?{armorVariant:value.armorVariant}:{});}
  if(value.parts!==undefined&&!object(value.parts))return null;
  for(const part of ['blade','base']){const has=Object.hasOwn(value,part)||Object.hasOwn(value.parts??{},part);if(!has)continue;const raw=Object.hasOwn(value,part)?value[part]:value.parts[part],nested=value.parts?.[part],catalog=partCatalog(kind);if(!catalog||!text(raw)||!(part==='blade'?catalog.blades:catalog.bases).includes(raw)||Object.hasOwn(value,part)&&Object.hasOwn(value.parts??{},part)&&raw!==nested)return null;result[part]=raw;}
  if (value.color !== undefined) {if (typeof value.color !== 'string' || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.color)) return null; result.color = value.color;}
  if (value.stats !== undefined && !object(value.stats)) return null;
  let stats;
  if (!value.stats) stats = generateInventoryLoot({seed, slot, kind, level, theme: result.theme}).stats;
  else {
    stats = {hp: value.stats.hp ?? value.stats.maxHealth ?? 0, armor: value.stats.armor ?? value.stats.defense ?? 0,
      melee: value.stats.melee ?? (slot === 'weapon' && !['staff', 'wand'].includes(kind) ? value.stats.damage ?? 0 : 0),
      magic: value.stats.magic ?? (slot === 'weapon' && ['staff', 'wand'].includes(kind) ? value.stats.damage ?? 0 : 0), stamina: value.stats.stamina ?? value.stats.maxStamina ?? 0};
  }
  if (STAT_KEYS.some(key => !integer(stats[key], 0, key === 'hp' ? 500 : 250))) return null;
  result.stats = {...stats}; return result;
}
function restore(payload) {
  if (payload?.version !== 1 || !Array.isArray(payload.actors) || payload.actors.length > 32) return null;
  const records = new Map();
  for (const a of payload.actors) {
    if (!text(a?.id, 96) || records.has(a.id) || !Array.isArray(a.items) || a.items.length > INVENTORY_CAPACITY || !object(a.equipped)) return null;
    const items = a.items.map(normalizeItem);
    if (items.some(item => !item) || new Set(items.map(item => item.id)).size !== items.length || Object.keys(a.equipped).some(slot => !GEAR_SLOTS.includes(slot))) return null;
    const equipped = emptyGear();
    for (const slot of GEAR_SLOTS) {
      const id = a.equipped[slot] ?? null;
      if (id !== null && !items.some(item => item.id === id && item.slot === slot)) return null;
      equipped[slot] = id;
    }
    records.set(a.id, {id: a.id, items, equipped});
  }
  return records;
}

/** Independent inventory authority. It does not mutate campaign actor.inventory,
 * actor.equipment, health or class maxima. Host supplies baseStats when needed,
 * consumes stats() for combat/max HP, and bridges campaign carry explicitly.
 * The fallback solo actor is used only when getActor is not provided. */
export function createInventoryModel({getActor, storage} = {}) {
  if (getActor !== undefined && typeof getActor !== 'function') throw new TypeError('getActor must be a function.');
  const solo = {id: 'solo-hero', name: 'Adventurer', classId: 'adventurer', health: 100, maxHealth: 100, alive: true};
  let records = new Map(), persistenceError = null;
  const baseCache = new Map(), listeners = new Set();
  try {if (storage === undefined) storage = globalThis.localStorage ?? null;} catch {storage = null; persistenceError = 'Inventory storage is unavailable.';}
  try {
    const raw = storage?.getItem(INVENTORY_STORAGE_KEY);
    if (raw) {
      const parsed = typeof raw === 'string' && raw.length <= 262144 ? restore(JSON.parse(raw)) : null;
      if (parsed) records = parsed; else persistenceError = 'Saved inventory is invalid.';
    }
  } catch {persistenceError = 'Saved inventory could not be read.';}
  function actor() {try {const a = getActor ? getActor() : solo; return a && text(a.id, 96) ? a : null;} catch {return null;}}
  function record() {
    const a = actor(); if (!a) return null;
    if (!records.has(a.id)) {if (records.size >= 32) return null; records.set(a.id, {id: a.id, items: [], equipped: emptyGear()});}
    return records.get(a.id);
  }
  function snapshot() {return {version: 1, actors: [...records.values()].map(r => ({id: r.id, items: r.items.map(copy), equipped: {...r.equipped}}))};}
  function persist() {
    if (!storage) return false;
    try {storage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(snapshot())); persistenceError = null; return true;}
    catch {persistenceError = 'Inventory could not be saved. Your equipment is still available in this session.'; return false;}
  }
  function changed() {persist(); for (const fn of listeners) {try {fn();} catch { /* UI listeners cannot undo a committed item. */ }}}
  function baseStats(a) {
    if (!a) return zeros();
    const classId = String(a.classId ?? '').toLowerCase(), profile = Object.hasOwn(CLASSES, classId) ? CLASSES[classId] : null, base = a.baseStats;
    const key = a.id + ':' + classId;
    if (!baseCache.has(key)) {
      const hp = profile?.maxHealth ?? (Number.isFinite(a.baseMaxHealth) ? a.baseMaxHealth : Number.isFinite(a.maxHealth) ? a.maxHealth : 100);
      const [armor, melee, magic] = Object.hasOwn(CLASS_ATTACK, classId) ? CLASS_ATTACK[classId] : [0, 10, 10];
      const stamina = Number.isFinite(a.baseMaxStamina) ? a.baseMaxStamina : Number.isFinite(a.maxStamina) ? a.maxStamina : 0;
      baseCache.set(key, {hp: Math.max(1, Math.min(10000, hp)), armor, melee, magic, stamina: Math.max(0, Math.min(10000, stamina))});
    }
    const result = {...baseCache.get(key)};
    if (object(base)) for (const stat of STAT_KEYS) if (Number.isFinite(base[stat]) && base[stat] >= (stat === 'hp' ? 1 : 0) && base[stat] <= 10000) result[stat] = base[stat];
    return result;
  }
  function stats() {
    const a = actor(), r = record(), base = baseStats(a), bonuses = zeros();
    if (r) for (const slot of GEAR_SLOTS) {
      const item = r.items.find(item => item.id === r.equipped[slot]);
      if (item) for (const stat of STAT_KEYS) bonuses[stat] += item.stats[stat];
    }
    return {...Object.fromEntries(STAT_KEYS.map(stat => [stat, base[stat] + bonuses[stat]])), base, bonuses};
  }
  function grantLoot(item) {
    const a = actor(), clean = normalizeItem(item), r = record();
    if (!a || a.alive === false || !r || !clean || r.items.length >= INVENTORY_CAPACITY || r.items.some(existing => existing.id === clean.id)) return false;
    r.items.push(clean); changed(); return true;
  }
  function equip(id) {
    const a = actor(), r = record(), item = r?.items.find(item => item.id === id);
    if (!a || a.alive === false || !item) return false;
    if (r.equipped[item.slot] === id) return true;
    r.equipped[item.slot] = id; changed(); return true;
  }
  function unequip(slot) {
    const a = actor(), r = record();
    if (!a || a.alive === false || !r || !GEAR_SLOTS.includes(slot) || !r.equipped[slot]) return false;
    r.equipped[slot] = null; changed(); return true;
  }
  function reset({keepLoot = false} = {}) {
    const r = record(); if (!r) return false;
    if (!keepLoot) {r.items = []; r.equipped = emptyGear();}
    changed(); return true;
  }
  function getEquipped(slot) {const r = record(), item = r?.items.find(item => item.id === r.equipped[slot]); return item ? copy(item) : null;}
  function applySnapshot(value){const next=restore(value);if(!next)return false;if(JSON.stringify(snapshot())===JSON.stringify(value))return true;records=next;changed();return true;}
  return {applySnapshot,grantLoot, equip, unequip, stats, reset, persist, snapshot, getEquipped, generateLoot: generateInventoryLoot,
    subscribe(fn) {if (typeof fn !== 'function') throw new TypeError('Inventory subscriber must be a function.'); listeners.add(fn); return () => listeners.delete(fn);},
    get actor() {return actor();}, get items() {return record()?.items.map(copy) ?? [];}, get equipped() {return {...(record()?.equipped ?? emptyGear())};},
    get persistenceError() {return persistenceError;}};
}

const STYLE_ID = 'hollow-adventurer-inventory-style';
function inventoryStyle(document) {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style'); style.id = STYLE_ID;
  style.textContent = `
 #inventoryQuick{position:fixed;right:10px;top:76px;z-index:38;padding:5px 8px;background:#1a202c;border:2px outset #958064;border-radius:0;color:#d4c5a4;font:11px monospace}
 .adventurer-inventory{width:min(760px,calc(100vw - 24px));max-height:calc(100dvh - 80px);overflow:auto;padding:12px;background:#151923;color:#ded6c2;border:4px double #9a835e;border-radius:0;font:12px/1.4 "Lucida Console","Courier New",monospace}
 .adventurer-inventory[hidden]{display:none!important}.adventurer-inventory::backdrop{background:#020409c9}.adventurer-inventory .inventory-head{display:flex;gap:10px;align-items:center;justify-content:space-between;padding-bottom:8px;border-bottom:1px solid #65615a}.adventurer-inventory h2{font:16px monospace;margin:0;color:#d3b780}
 .adventurer-inventory .inventory-stats{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0;padding:7px;background:#0c1018;border:2px inset #64666c}.adventurer-inventory .inventory-slots{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-bottom:12px}.adventurer-inventory .inventory-slot{padding:6px;border:2px inset #68645b;background:#10141c;font-size:11px;min-width:0;overflow-wrap:anywhere}
 .adventurer-inventory button{padding:4px 7px;background:#292e39;border:2px outset #8f8573;border-radius:0;color:#e0d4ba;font:11px monospace}.adventurer-inventory button:disabled{color:#74777c}.adventurer-inventory button:focus-visible{outline:2px solid #d6b778}.adventurer-inventory table{width:100%;border-collapse:collapse;font-size:11px}.adventurer-inventory td,.adventurer-inventory th{padding:5px;text-align:left;border-bottom:1px solid #45464b}.adventurer-inventory canvas{display:inline-block;width:32px;height:32px;image-rendering:pixelated;vertical-align:middle;margin-right:6px}.adventurer-inventory .inventory-note{font-size:10px;color:#a8a493}.adventurer-inventory .inventory-actions{display:flex;gap:6px;align-items:center}
 @media(max-width:600px){.adventurer-inventory .inventory-slots{grid-template-columns:repeat(2,minmax(0,1fr))}.adventurer-inventory td,.adventurer-inventory th{padding:4px 2px}.adventurer-inventory canvas{width:24px;height:24px}}`;
  document.head.appendChild(style);
}
function simpleIcon(item, canvas) {
  canvas.width = canvas.height = 24; const c = canvas.getContext('2d'); if (!c) return;
  c.imageSmoothingEnabled = false; c.clearRect(0, 0, 24, 24); c.fillStyle = '#090c12'; c.fillRect(0, 0, 24, 24); c.fillStyle = item.color ?? '#999582';
  const rect = (...args) => c.fillRect(...args);
  if (item.slot === 'helm') {rect(5, 5, 14, 11); rect(3, 13, 18, 3); c.fillStyle = '#1a1e28'; rect(8, 11, 8, 3);}
  else if (item.slot === 'chest') {rect(6, 5, 12, 15); rect(3, 5, 5, 7); rect(16, 5, 5, 7);}
  else if (item.slot === 'arms') {rect(4, 5, 6, 15); rect(14, 5, 6, 15);}
  else if (item.slot === 'legs') {rect(6, 3, 12, 6); rect(6, 8, 5, 13); rect(13, 8, 5, 13);}
  else if (item.slot === 'offhand') {rect(5, 4, 14, 12); rect(8, 16, 8, 4);}
  else {rect(11, 3, 3, 14); rect(6, 16, 13, 2); c.fillStyle = '#81613d'; rect(11, 18, 3, 4);}
}

/** Optional DOM wrapper, usable headlessly too. getActor may select a party hero;
 * UI actions recheck that id so stale rows cannot equip the wrong actor. tick()
 * refreshes an open panel after host actor selection; no RAF/app edits required.
 */
export function createInventory(options = {}) {
  const api = createInventoryModel(options), document = globalThis.document;
  let opened = false, destroyed = false, renderedKey = '', render = () => {}, element = null, launcher = null, staminaLabel = null, keydown = null, unsubscribe = () => {};
  const viewKey = () => {const a = api.actor; return JSON.stringify([a?.id, a?.name, a?.classId, a?.alive, api.stats()]);};
  function close() {if (destroyed) return; opened = false; if (element) {if (element.open && element.close) element.close(); element.hidden = true;} launcher?.setAttribute('aria-expanded', 'false');}
  function open() {if (destroyed) return false; opened = true; render(); if (element) {element.hidden = false; if (!element.open) element.showModal?.();} launcher?.setAttribute('aria-expanded', 'true'); return true;}
  function toggle() {if (opened) close(); else open(); return opened;}
  if (options.ui !== false && document?.createElement && document.body && document.head) {
    inventoryStyle(document);
    const make = (tag, text) => {const e = document.createElement(tag); if (text !== undefined) e.textContent = text; return e;};
    launcher = make('button', 'Inventory [I]'); launcher.type = 'button'; launcher.id = 'inventoryQuick'; launcher.setAttribute('aria-expanded', 'false'); launcher.addEventListener('click', toggle);
    element = make('dialog'); element.className = 'adventurer-inventory'; element.hidden = true; element.setAttribute('aria-label', 'Adventurer equipment and inventory');
    (options.parent ?? document.body).appendChild(launcher); document.body.appendChild(element);
    const paintIcon=(item,canvas)=>{try{if(typeof options.drawIcon==='function')options.drawIcon(item,canvas);else simpleIcon(item,canvas);}catch{try{simpleIcon(item,canvas);}catch{/* A restricted or headless canvas must not break inventory. */}}};
    const bonusText = stats => STAT_KEYS.filter(key => stats[key]).map(key => (key === 'hp' ? 'Max HP' : key) + ' +' + stats[key]).join(' / ') || 'No bonuses';
    render = () => {
      renderedKey = viewKey();
      staminaLabel = null;
      element.replaceChildren();
      const actor = api.actor, actorId = actor?.id, head = make('div'); head.className = 'inventory-head';
      head.appendChild(make('h2', (actor?.name ?? actor?.classId ?? 'Adventurer') + ' — Inventory'));
      const dismiss = make('button', 'Close [I]'); dismiss.type = 'button'; dismiss.setAttribute('aria-label','Close inventory'); dismiss.addEventListener('click', close); head.appendChild(dismiss); element.appendChild(head);
      if (!actor) {element.appendChild(make('p', 'Select an adventurer.')); return;}
      const total = api.stats(), summary = make('div'); summary.className = 'inventory-stats';
      for (const key of STAT_KEYS) {
        if (key === 'stamina' && !Number.isFinite(actor.stamina) && !Number.isFinite(actor.maxStamina) && !total.stamina) continue;
        const label = make('span', (key === 'hp' ? 'Max HP' : key.toUpperCase()) + ' ' + total[key]);
        if (key === 'stamina') {staminaLabel = label; if (Number.isFinite(actor.stamina)) label.textContent = 'STAMINA ' + Math.floor(actor.stamina) + ' / ' + total.stamina;}
        summary.appendChild(label);
      }
      element.appendChild(summary);
      const slots = make('div'); slots.className = 'inventory-slots';
      for (const slot of GEAR_SLOTS) {
        const cell = make('div'); cell.className = 'inventory-slot'; const item = api.getEquipped(slot);
        cell.appendChild(make('b', LABELS[slot]));if(item){const icon=make('canvas');paintIcon(item,icon);cell.appendChild(icon);}cell.appendChild(make('div', item?.name ?? 'Starter gear'));
        if (item) {const remove = make('button', 'Unequip'); remove.type = 'button'; remove.disabled = actor.alive === false; remove.addEventListener('click', () => {if (api.actor?.id === actorId) api.unequip(slot); else render();}); cell.appendChild(remove);}
        slots.appendChild(cell);
      }
      element.appendChild(slots);
      const items = api.items, note = make('p', `${items.length}/${INVENTORY_CAPACITY} items · Equipment bonuses apply while worn.`); note.className = 'inventory-note'; element.appendChild(note);
      if (!items.length) element.appendChild(make('p', 'No loot yet. Explore and open treasure chests.'));
      else {
        const table = make('table'), thead = make('thead'), labels = make('tr');
        for (const text of ['Item', 'Bonuses', '']) labels.appendChild(make('th', text)); thead.appendChild(labels); table.appendChild(thead);
        const tbody = make('tbody');
        for (const item of items) {
          const row = make('tr'), name = make('td'), icon = make('canvas');
          paintIcon(item,icon);
          name.appendChild(icon); name.appendChild(make('span', item.name + ' [' + LABELS[item.slot] + ']')); row.appendChild(name); row.appendChild(make('td', bonusText(item.stats)));
          const actions = make('td'), button = make('button', api.equipped[item.slot] === item.id ? 'Equipped' : 'Equip'); button.type = 'button'; button.disabled = actor.alive === false || api.equipped[item.slot] === item.id;
          button.addEventListener('click', () => {if (api.actor?.id === actorId) api.equip(item.id); else render();}); actions.appendChild(button); row.appendChild(actions); tbody.appendChild(row);
        }
        table.appendChild(tbody); element.appendChild(table);
      }
      if (api.persistenceError) {const message = make('p', api.persistenceError); message.className = 'inventory-note'; element.appendChild(message);}
    };
    keydown = event => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.key?.toLowerCase() !== 'i') return;
      const active = document.activeElement, dialog = document.querySelector?.('dialog[open]');
      if (active?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(active?.tagName) || dialog && dialog !== element) return;
      event.preventDefault(); toggle();
    };
    document.addEventListener('keydown', keydown);
    element.addEventListener('cancel', event => {event.preventDefault(); close();});
    element.addEventListener('close', () => {opened = false; element.hidden = true; launcher.setAttribute('aria-expanded', 'false');});
    unsubscribe = api.subscribe(() => {if (opened) render();});
  }
  Object.assign(api, {open, close, toggle, tick() {if (!destroyed && opened) {if (viewKey() !== renderedKey) render(); else if (staminaLabel && Number.isFinite(api.actor?.stamina)) staminaLabel.textContent = 'STAMINA ' + Math.floor(api.actor.stamina) + ' / ' + api.stats().stamina;}}, destroy() {
    if (destroyed) return; close(); destroyed = true; unsubscribe(); if (keydown) document.removeEventListener('keydown', keydown); launcher?.remove(); element?.remove();
  }});
  Object.defineProperties(api, {isOpen: {get: () => opened}, element: {get: () => element}});
  return api;
}
