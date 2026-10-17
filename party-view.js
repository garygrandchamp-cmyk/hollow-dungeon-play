import {CLASSES} from './party-campaign.js';
import {createHeldInput} from './held-input.js';
import {MONSTER_KINDS} from './monster-sprites.js';

const HERO_IDS = ['hero-1', 'hero-2', 'hero-3'];
const MOVEMENT = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright']);
const COMMANDS = {' ': 'attack', e: 'interact', r: 'swap', f: 'search'};
const TOOLS = ['select', ...MONSTER_KINDS.map(kind => 'monster:' + kind), 'trap:spikes', 'trap:pit', 'trap:crate', 'trap:rubble', 'trap:swinging-axe', 'trap:rolling-ball', 'trap:rat-cage', 'door:silver', 'door:named', 'door:select', 'key:silver', 'key:named', 'erase'];
const toolLabel = kind => ({select:'Inspect tile',erase:'Remove placed object','door:silver':'Silver lock (existing door)','door:named':'Named lock (existing door)','door:select':'Choose named lock','key:silver':'Silver key','key:named':'Matching named key'}[kind] ?? kind.split(':').at(-1).replaceAll('-', ' ').replace(/^./, c => c.toUpperCase()));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const axis = n => Number.isFinite(n) && Math.abs(n) > .18 ? Math.sign(n) * (Math.min(1, Math.abs(n)) - .18) / .82 : 0;

/** DOM rectangles and GL logical-pixel rectangles are separate: renderer DPR is
 * already applied by setViewport/setScissor. Odd sizes cover every pixel once. */
export function computePartyViewports(bounds, renderSize = {width: bounds?.width, height: bounds?.height}) {
  if (![bounds?.left, bounds?.top, bounds?.width, bounds?.height, renderSize?.width, renderSize?.height].every(Number.isFinite)
    || bounds.width <= 0 || bounds.height <= 0 || renderSize.width < 2 || renderSize.height < 2) return [];
  const width = Math.floor(renderSize.width), height = Math.floor(renderSize.height), leftWidth = Math.floor(width / 2), bottomHeight = Math.floor(height / 2);
  return ['dm', ...HERO_IDS].map((id, index) => {
    const column = index % 2, row = Math.floor(index / 2), w = bounds.width / 2, h = bounds.height / 2;
    return {id, index, left: bounds.left + column * w, top: bounds.top + row * h, width: w, height: h,
      right: bounds.left + (column + 1) * w, bottom: bounds.top + (row + 1) * h,
      glX: column ? leftWidth : 0, glY: row ? 0 : bottomHeight,
      glWidth: column ? width - leftWidth : leftWidth, glHeight: row ? bottomHeight : height - bottomHeight};
  });
}
export function hitPartyViewport(rectangles, x, y) {
  return rectangles.find(r => x >= r.left && x < r.right && y >= r.top && y < r.bottom) ?? null;
}

/**
 * One shared world, four views, NO adventure/AI/hazard tick ownership.
 * getWorld(): {world,paused?,busy?,isGenerating?,fogDensity?,fogDistance?,
 *   hideDuringParty?:Object3D[], dmResources?,placementCosts?,
 *   canSummonBoss?:boolean,canPossessBoss?:boolean,remoteActorId?:'hero-1'|'hero-2'|'hero-3'|null}.
 * moveActor(actor,{forward,side,dt}); onAction(actor,kind), null actor for boss
 * commands; onPlace(kind,Vector3,{hit,phase}); onValidate()->{valid,errors?};
 * onStart({campaign,validation}) may return a promise/false. Host owns all costs.
 * getWorld().loadoutChoices[heroId][weapon|offhand] is an array of owned
 * {id,label} choices; starter is always added. equippedIds[heroId][slot] is
 * the selected owned ID or literal 'starter'. Missing fields show starter only.
 * inputSettings: {fov:55..100,sensitivity:.25..3,invertY:boolean}; defaults72/1/false.
 * layoutEquipment(set,aspect,fov,actor). Optional onLoadout(actor,slot,id),
 * onClass(actor,classId). Remote choices call these without local mutation.
 * Capture-phase inputs consume party keys; host should skip its solo frame when
 * enabled, call tick ONCE, then render ONCE instead of its normal render.
 */
export function createPartyView(options = {}) {
  const {THREE, renderer, scene, dmCamera, roof, campaign, makePlayerSprite, createEquipmentSprites,
    layoutEquipment, moveActor = () => {}, onAction, onStart, onNewDungeon,onOpenLab, onPlace, onValidate, onInventory, onLoadout, onClass, onNamedLock,
    notify = () => {}} = options;
  if (!THREE || !renderer?.domElement || !scene?.add || !dmCamera || !Array.isArray(campaign?.actors) || campaign.actors.length !== 3) throw new TypeError('Party view requires THREE, renderer, scene, DM camera and three campaign actors.');
  if (campaign.actors.some((a, i) => a.id !== HERO_IDS[i])) throw new TypeError('Party actors must use stable hero-1 through hero-3 ids.');
  const document = options.document ?? globalThis.document, window = options.window ?? document?.defaultView ?? globalThis;
  const canvas = renderer.domElement, root = new THREE.Group(); root.name = 'party-view-owned-actors'; root.visible = false; scene.add(root);
  // Canvas must accept focus after a label/button click; otherwise BUTTON stays
  // active and the intentional keyboard shortcut guard suppresses WASD.
  const originalTabIndex = canvas.getAttribute?.('tabindex') ?? null;
  canvas.tabIndex = 0;
  // Physical keyboard holds must not depend on browser/OS repeat delivery.
  const records = new Map(), keys = createHeldInput({now: options.inputNow ?? (() => performance.now()), timeout: Infinity}), focusReleaseKeys = new Set(), guards = new Map(), padOwners = new Map(), padButtons = new Map(), ui = new Map(), removers = [];
  let enabled = false, focusedId = 'dm', drag = null, tool = 'select', dmOpen = false, starting = false, destroyed = false, now = 0, lastValidation = -Infinity;
  let validation = {valid: false, errors: ['Validate the dungeon before starting.']};
  let lastRemoteId = null, dmPane = null, dmLabel = null, dmHint = null, title = null;
  const hostControls = [];
  let placementRevision=0;let namedLockSelect=null,namedLockOptions='',toolStatus=null,tileStatus=null,placementStatus=null,selectedTile=null;
  const tileMarker=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0xc8b778,transparent:true,opacity:.28,depthTest:false,depthWrite:false,side:THREE.DoubleSide}));tileMarker.name='dm-target-tile';tileMarker.rotation.x=-Math.PI/2;tileMarker.renderOrder=1000;tileMarker.userData.dmOnly=true;tileMarker.visible=false;scene.add(tileMarker);
  let shell = null, toolbar = null, palette = null, launcher = null, startButton = null,newDungeonButton=null,workflowStatus=null, validationLabel = null, resourceLabel = null, result = null, resultKey = '', dismissedResultKey = '';
  const world = () => {try {return options.getWorld?.() ?? {};} catch {return {paused: true};}};
  // An invalid non-null assignment waits without exposing a host viewport.
  const remoteId = () => {const id = world().remoteActorId; return id == null ? null : HERO_IDS.includes(id) ? id : 'unassigned';};
  const inputSettings = () => {const value=world().inputSettings??{};return {fov:Number.isFinite(value.fov)?clamp(value.fov,55,100):72,sensitivity:Number.isFinite(value.sensitivity)?clamp(value.sensitivity,.25,3):1,invertY:value.invertY===true};};
  const cameraFar = () => {const visibility=world().fogDistance,far=Number.isFinite(visibility)?Math.max(40,visibility*1.6):40;return Number.isFinite(far)?far:40;};
  const loadoutOptionKeys=new WeakMap();
  function loadoutChoices(a,slot,w=world()) {const starter=CLASSES[a.classId]?.[slot==='weapon'?'defaultWeapon':'defaultOffhand']??slot,choices=[{id:'starter',label:'Starter - '+starter}],seen=new Set(['starter']),owned=w.loadoutChoices?.[a.id]?.[slot];for(const item of (Array.isArray(owned)?owned.slice(0,128):[])){if(!item||typeof item.id!=='string'||!item.id.trim()||item.id.length>128||/[\u0000-\u001f]/.test(item.id)||seen.has(item.id)||typeof item.label!=='string'||!item.label.trim()||item.label.length>160)continue;choices.push({id:item.id,label:item.label});seen.add(item.id);}return choices;}
  function refreshLoadout(node,a,slot,w){const choices=loadoutChoices(a,slot,w),signature=JSON.stringify(choices);if(loadoutOptionKeys.get(node)!==signature){node.replaceChildren();for(const choice of choices){const option=make('option',choice.label);option.value=choice.id;node.appendChild(option);}loadoutOptionKeys.set(node,signature);}const selected=w.equippedIds?.[a.id]?.[slot]??'starter';node.value=choices.some(c=>c.id===selected)?selected:'starter';}
  const phase = () => campaign.state?.phase ?? campaign.phase ?? 'lobby';
  const actor = id => campaign.actors.find(a => a.id === id) ?? null;
  const living = a => a && a.alive !== false && !(Number.isFinite(a.health) && a.health <= 0) && !a.escaped && !a.fainted;
  const busy = () => {const w = world(); return starting || !!(w.paused || w.busy || w.isGenerating) || !!document?.querySelector?.('dialog[open]');};
  const locallyOwned = a => !!a && (remoteId()?a.id===remoteId():!(world().remoteOwned??[]).includes(a.id));
  const playable = a => enabled && phase() === 'active' && !busy() && living(a) && locallyOwned(a);
  const typing = (e=document?.activeElement) => e?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e?.tagName);
  const hand = a => {const value = a.leftHand ?? a.offhand ?? a.equipment?.offhand?.id; const kind=typeof value==='object'?value?.id:value;return ['magic','torch'].includes(kind)?kind:'shield';};
  function listen(target, type, fn, capture = false) {target?.addEventListener?.(type, fn, capture); removers.push(() => target?.removeEventListener?.(type, fn, capture));}
  function report(error) {notify(error?.message ?? 'Party action could not be completed.');}
  function emit(a, kind) {
    if (!playable(a) || typeof onAction !== 'function') return false;
    try {
      const accepted = onAction(a, kind); accepted?.catch?.(report);
      if (accepted === false) return false;
      const r = records.get(a.id);
      if (r && kind === 'attack') r.attackUntil = now + 280;
      if (r && kind === 'guard' && hand(a) === 'magic') r.castUntil = now + 380;
      return true;
    } catch (error) {report(error); return false;}
  }
  function release(source) {
    const id = guards.get(source); if (!id) return;
    guards.delete(source);
    if (locallyOwned(actor(id)) && ![...guards.values()].includes(id)) {try {onAction?.(actor(id), 'release');} catch (error) {report(error);}}
  }
  function guard(a, source) {
    if (guards.get(source) === a.id) return;
    release(source);
    if (!playable(a)) return;
    if ([...guards.values()].includes(a.id) || emit(a, 'guard')) guards.set(source, a.id);
  }
  function clearInputs() {keys.clear(); focusReleaseKeys.clear(); drag = null; for (const source of [...guards.keys()]) release(source); padButtons.clear();}
  function syncMode() {
    const id = remoteId();
    if (id !== lastRemoteId) {clearInputs(); padOwners.clear(); focusedId = id ?? 'dm'; lastRemoteId = id; dmOpen = false;}
    return id;
  }
  function focus(id) {
    const remote = syncMode(); if (remote && id !== remote) return false;
    if (id !== 'dm' && !locallyOwned(actor(id))) return false;
    if (id !== focusedId) {for(const key of [...MOVEMENT,'q'])if(keys.has(key))focusReleaseKeys.add(key);keys.clear(); drag = null; release('keyboard'); focusedId = id;}
    if(id!=='dm'&&dmOpen)setDMOpen(false);canvas.focus?.({preventScroll: true}); updateUI(); return true;
  }
  const buildWorkspace=()=>dmOpen&&!remoteId()&&world().dmBuildWorkspace===true;
  function getViewports() {
    const bounds = canvas.getBoundingClientRect(), size = new THREE.Vector2();
    if (renderer.getSize) renderer.getSize(size); else size.set(bounds.width, bounds.height);
    const remote = syncMode(), rectangles = computePartyViewports(bounds, {width: size.x, height: size.y});
    if(world().mobileLayout){const id=remote??focusedId;if(!['dm',...HERO_IDS].includes(id))return [];return [{id,index:['dm',...HERO_IDS].indexOf(id),left:bounds.left,top:bounds.top,right:bounds.left+bounds.width,bottom:bounds.top+bounds.height,width:bounds.width,height:bounds.height,glX:0,glY:0,glWidth:Math.floor(size.x),glHeight:Math.floor(size.y)}];}
    if (!remote&&buildWorkspace()){const inset=Math.min(bounds.width*.55,Math.max(0,(palette?.getBoundingClientRect?.().right??350)-bounds.left+10)),glX=Math.ceil(inset*size.x/bounds.width);return [{id:'dm',index:0,left:bounds.left+inset,top:bounds.top,right:bounds.left+bounds.width,bottom:bounds.top+bounds.height,width:bounds.width-inset,height:bounds.height,glX,glY:0,glWidth:Math.floor(size.x)-glX,glHeight:Math.floor(size.y)}];}
    if (!remote) return rectangles;
    if (!HERO_IDS.includes(remote) || !rectangles.length) return [];
    return [{id: remote, index: HERO_IDS.indexOf(remote) + 1, left: bounds.left, top: bounds.top, right: bounds.left + bounds.width, bottom: bounds.top + bounds.height,
      width: bounds.width, height: bounds.height, glX: 0, glY: 0, glWidth: Math.floor(size.x), glHeight: Math.floor(size.y)}];
  }
  function getViewportRect(id) {const wanted = id ?? remoteId() ?? 'dm'; return getViewports().find(r => r.id === wanted || r.index === wanted) ?? null;}
  function disposeSprite(sprite) {
    const owned = new Set(); sprite?.traverse(o => {o.userData.disposeMaterials?.(); if (o.userData.ownGeometry && o.geometry) owned.add(o.geometry);}); owned.forEach(g => g.dispose()); sprite?.removeFromParent();
  }
  function equipmentNodes(set) {return [...new Set([set?.right, set?.leftShield, set?.leftMagic,set?.leftTorch].filter(Boolean))];}
  function attachActors() {
    if (destroyed) return;
    for (const a of campaign.actors) {
      let r = records.get(a.id);
      if (!r) {
        const camera = new THREE.PerspectiveCamera(inputSettings().fov, 1, .1, cameraFar()); camera.rotation.order = 'YXZ'; root.add(camera);
        const light = new THREE.PointLight(0xc6c3ba, 1.1, 8, 2); light.position.set(.1, -.2, -.2); light.visible = false; camera.add(light);
        r = {actor: a, camera, light, sprite: null, equipment: null, visualKey: '', moving: false, attackUntil: 0, castUntil: 0}; records.set(a.id, r);
      }
      r.actor = a;const fov=inputSettings().fov,far=cameraFar();if(r.camera.fov!==fov||r.camera.far!==far){r.camera.fov=fov;r.camera.far=far;r.camera.updateProjectionMatrix();}
      const visualKey = JSON.stringify([a.classId, a.equipment?.weapon, a.equipment?.offhand]);
      if (r.visualKey !== visualKey || !r.sprite) {
        disposeSprite(r.sprite); r.equipment?.dispose?.();
        // Class atlases carry their own colors; retain the factory's materials.
        r.sprite = makePlayerSprite?.(THREE, {height: 1.7, seed: a.id, classId: a.classId, actor: a}) ?? new THREE.Group(); root.add(r.sprite);
        // A class update can render before the next simulation tick. Keep the
        // replacement body at the actor's current pose instead of world origin.
        r.sprite.position.set(a.position.x,a.position.y,a.position.z);r.sprite.rotation.y=a.yaw??0;
        r.equipment = createEquipmentSprites?.(THREE, a) ?? null;
        for (const node of equipmentNodes(r.equipment)) {node.visible = false; r.camera.add(node);}
        r.visualKey = visualKey;
      }
    }
  }
  function validate(show=false) {
    if (remoteId()) {validation = {valid: false, reason: 'The host validates this dungeon.'}; updateUI(); return validation;}
    try {const check = onValidate?.({show}); validation = check && typeof check.then !== 'function' ? {...check, valid: check.valid === true} : {valid: false, errors: ['Host validation is pending.']};}
    catch (error) {validation = {valid: false, errors: [error.message ?? 'Validation failed.']};}
    lastValidation = now; updateUI(); return validation;
  }
  async function start() {
    if (!enabled || remoteId() || starting || phase() === 'active' || busy() || typeof onStart !== 'function') return false;
    const checked = phase()==='lobby'?validate():{valid:true}; if (!checked.valid) return false;
    starting = true; clearInputs(); updateUI();
    let accepted=false;try {accepted=await onStart({campaign,validation:checked})!==false;if(accepted)setDMOpen(false);return accepted;}
    catch (error) {report(error); return false;}
    finally {starting = false;if(!accepted&&phase()==='lobby')setDMOpen(true);updateUI();}
  }
  function setDMOpen(value) {dmOpen = !!value && enabled && !remoteId(); if (palette) palette.hidden = !dmOpen; if(!dmOpen){tileMarker.visible=false;tool='select';drag=null;placementRevision++;} document?.body?.classList.toggle('dm-open', dmOpen);}
  function setEnabled(value) {
    if (destroyed || enabled === !!value) return;
    clearInputs(); enabled = !!value; root.visible = enabled;
    document?.body?.classList.toggle('party-active', enabled);
    if (enabled) {document?.exitPointerLock?.(); attachActors(); focus(syncMode() ?? 'dm'); setDMOpen(phase() !== 'active'); validate();}
    else setDMOpen(false);
    if (shell) shell.hidden = !enabled; if (toolbar) toolbar.hidden = !enabled; if (launcher) launcher.hidden = enabled;
    if (!enabled && result) result.hidden = true;
    updateUI();
  }
  function loadout(a, slot, id) {
    if (phase() === 'active' || starting || !['weapon','offhand'].includes(slot) || !loadoutChoices(a,slot).some(choice=>choice.id===id)) return;
    if (remoteId()) {if (a.id === remoteId()) {try {onLoadout?.(a, slot, id)?.catch?.(report);} catch (error) {report(error);}} updateUI(); return;}
    if (onLoadout) {try {onLoadout(a, slot, id)?.catch?.(report);} catch(error) {report(error);}}
    else {const equipped=id==='starter'?CLASSES[a.classId]?.[slot==='weapon'?'defaultWeapon':'defaultOffhand']:id;a.equipment ??= {};a.equipment[slot]={id:equipped};if(slot==='offhand')a.offhand=equipped;campaign.persist?.();}
    attachActors(); updateUI();
  }
  function setClass(a, id) {
    if (phase() === 'active' || starting) return;
    if (remoteId()) {if (a.id === remoteId()) {try {onClass?.(a, id)?.catch?.(report);} catch (error) {report(error);}} updateUI(); return;}
    if (campaign.setClass?.(a.id, id)) {a.offhand = a.equipment?.offhand?.id ?? CLASSES[id]?.defaultOffhand; attachActors(); updateUI();}
  }
  function openInventory(a) {if (remoteId() && a.id !== remoteId()) return; focus(a.id); onInventory?.(a);}
  function bossAction(kind) {
    const w = world(), available = kind === 'summonBoss' ? w.canSummonBoss : w.canPossessBoss;
    if (!enabled || remoteId() || phase() !== 'active' || busy() || available !== true || typeof onAction !== 'function') return;
    try {onAction(null, kind)?.catch?.(report);} catch (error) {report(error);}
  }
  function updateUI() {
    if (!toolbar) return;
    const remote = syncMode(), w = world(), active = phase() === 'active', dm = w.dmResources;
    for (const control of hostControls) control.hidden = !!remote;
    if (title) title.textContent = remote ? 'HOLLOW · ' + remote : 'HOLLOW · DM + 3';
    if (launcher) launcher.hidden = enabled || !!remote;
    shell.style.gridTemplateColumns = remote||w.mobileLayout ? '1fr' : ''; shell.style.gridTemplateRows = remote||w.mobileLayout ? '1fr' : '';
    dmPane.hidden = !!remote||!!w.mobileLayout&&focusedId!=='dm';dmPane.style.cssText=buildWorkspace()&&!w.mobileLayout?'position:absolute;left:360px;right:0;top:0;bottom:0':''; palette.hidden = !!remote || !dmOpen;
    dmPane.classList.toggle('focused', !remote && focusedId === 'dm');dmPane.dataset.focused=String(!remote && focusedId==='dm');
    dmLabel.textContent=focusedId==='dm'&&!remote?'0 · DM · ACTIVE CONTROL':'0 · DM · overhead / edit';dmLabel.setAttribute('aria-pressed',String(!remote&&focusedId==='dm'));
    dmHint.textContent=dmOpen?'Choose a tool, then click a highlighted tile. Drag map to orbit. Esc cancels.':active?'Local controls: 1 / 2 / 3 select hero · 0 DM · or click a pane':'Local test: 1 / 2 / 3 select hero · Start expedition to move';
    document?.body?.classList.toggle('dm-open', !remote && dmOpen && enabled);
    startButton.disabled = !enabled || !!remote || active || starting || (phase()==='lobby'&&!validation.valid) || !!(w.busy || w.isGenerating || w.paused) || typeof onStart !== 'function';
    startButton.textContent = starting ? 'Preparing…' : phase() === 'lobby' ? 'Start expedition' : 'Next expedition';
    if(newDungeonButton)newDungeonButton.disabled=!!remote||active||starting||!!(w.busy||w.isGenerating)||typeof onNewDungeon!=='function';
    if(workflowStatus)workflowStatus.textContent=(active?'EXPEDITION IN PROGRESS':'SETUP — build dungeon + choose loadouts')+(w.seed?' · Seed: '+w.seed:'');
    validationLabel.textContent = validation.valid ? (validation.metrics?'Route ready · '+validation.metrics.metres+' m · '+validation.metrics.turns+' turns':'Route ready') : (validation.errors?.[0] ?? validation.reason ?? 'Route not ready');
    resourceLabel.textContent = dm ? active?`DM stamina ${Math.floor(dm.stamina??0)} / ${dm.maxStamina??'?'}`:`Setup budget ${dm.remainingBudget??'?'} / ${dm.budget??'?'}` : 'DM resources pending';
    for (const [id, controls] of ui) {
      const a = actor(id); if (!a) continue;
      controls.pane.hidden = buildWorkspace() || !!remote && id !== remote || !!w.mobileLayout&&id!==(remote??focusedId);
      controls.row.hidden = !!remote && (id !== remote || active);
      const rowParent = remote === id ? controls.pane : partySetup;
      if (controls.row.parentNode !== rowParent && controls.row.parent !== rowParent) rowParent.appendChild(controls.row);
      controls.row.style.cssText = remote === id ? 'position:absolute;left:12px;top:76px;pointer-events:auto;max-width:calc(100% - 24px)' : '';
      const owned=locallyOwned(a),selected=focusedId===id&&owned;
      controls.label.textContent = `${id.slice(-1)} · ${CLASSES[a.classId]?.name ?? a.classId ?? 'Adventurer'}${!owned?' · REMOTE CONTROL':w.botIds?.includes(id)?' · BOT':selected?' · ACTIVE CONTROL':''}`;
      controls.label.disabled=!owned;controls.label.setAttribute('aria-pressed',String(selected));controls.label.title=owned?(remote?'Your adventurer':`Click this pane or press ${id.slice(-1)} to control this adventurer`):'Controlled by a remote player';
      controls.pane.dataset.focused=String(selected);controls.hint.hidden=!selected;
      controls.hint.textContent=remote?'ACTIVE CONTROL · WASD move · drag look · Space strike · E interact':active?'ACTIVE CONTROL · 1 / 2 / 3 switch hero · 0 DM · WASD move':'ACTIVE CONTROL · 1 / 2 / 3 switch hero · Start expedition to move';
      controls.pane.classList.toggle('focused', selected); controls.pane.classList.toggle('dead', !living(a) && !a.escaped); controls.pane.classList.toggle('escaped', !!a.escaped);
      controls.stats.textContent = `${a.escaped ? 'ESCAPED · ' : !living(a) ? 'DOWN · ' : ''}HP ${Math.ceil(a.health ?? 0)}/${a.maxHealth ?? '?'} · MP ${Math.floor(a.mana ?? 0)}/${a.maxMana ?? '?'}${Number.isFinite(a.stamina) ? ' · STA ' + Math.floor(a.stamina) : ''} · G ${a.gold ?? 0}${hand(a)==='torch'?' · TORCH '+Math.ceil(a.torchFuel??120)+'s'+(a.torchLit===false?' (out)':''):''}`;
      controls.classSelect.value = a.classId; controls.classSelect.disabled = active || starting || !!remote && typeof onClass !== 'function';
      refreshLoadout(controls.weapon,a,'weapon',w); controls.weapon.disabled = active || starting || !!remote && typeof onLoadout !== 'function';
      refreshLoadout(controls.offhand,a,'offhand',w); controls.offhand.disabled = active || starting || !!remote && typeof onLoadout !== 'function';
    }
    if(namedLockSelect){const locks=w.namedLocks??[],signature=JSON.stringify(locks.map(l=>[l.id,l.name,l.floor,l.doorKey]));if(signature!==namedLockOptions){namedLockOptions=signature;namedLockSelect.replaceChildren();const empty=make('option','Choose the exact named lock');empty.value='';namedLockSelect.appendChild(empty);for(const l of locks){const option=make('option',l.name+' - floor '+(l.floor+1)+' / '+l.doorKey);option.value=l.id;namedLockSelect.appendChild(option);}}namedLockSelect.value=w.selectedNamedLockId??'';namedLockSelect.disabled=!!remote||phase()!=='lobby'||starting;}
    for (const button of palette.querySelectorAll?.('[data-placement]') ?? []) {
      const kind = button.dataset.placement, cost = w.placementCosts?.[kind], amount = typeof cost === 'number' ? cost : active ? cost?.stamina : cost?.budget;

      button.textContent = toolLabel(kind) + (Number.isFinite(amount) ? ` · ${amount} ${active ? 'STA' : 'budget'}` : '');
      button.hidden = !!remote;
      button.disabled = starting || !!(w.busy || w.isGenerating) || typeof onPlace !== 'function' || ((kind.startsWith('door:')||kind.startsWith('key:'))&&phase()!=='lobby') || (kind==='key:named'&&!(w.namedLocks??[]).some(l=>l.id===w.selectedNamedLockId));
      button.classList.toggle('active', tool === kind);button.setAttribute('aria-pressed',String(tool===kind));
    }
    if(toolStatus)toolStatus.textContent='Tool: '+toolLabel(tool)+(tool==='select'?' — click a tile to inspect':' — click map once to place; repeat to place more');
    if(tileStatus&&selectedTile)tileStatus.textContent=tileDescription(selectedTile);
    for (const [kind, capability] of [['summonBoss', 'canSummonBoss'], ['possessBoss', 'canPossessBoss']]) {
      const button = toolbar.querySelector?.('[data-action="' + kind + '"]'); if (!button) continue;
      button.hidden=!!remote||!active;const available = w[capability] === true; button.disabled = !active || busy() || !available || typeof onAction !== 'function';
      button.textContent = (kind === 'summonBoss' ? 'Summon boss' : 'Possess boss');
    }
    if (result) {
      const ending = ['partyVictory', 'dmVictory'].includes(phase());
      const key = JSON.stringify([remote, phase(), campaign.runNumber, campaign.actors.map(a => [a.alive, a.escaped, a.gold, a.inventory?.length])]);
      result.hidden = !enabled || !ending || dismissedResultKey === key;
      if (!ending) dismissedResultKey = '';
      if (ending && key !== resultKey) {
        resultKey = key; result.replaceChildren();
        result.appendChild(make('h2', phase() === 'partyVictory' ? 'PARTY VICTORY' : 'DM VICTORY'));
        for (const a of campaign.actors.filter(a => !remote || a.id === remote)) result.appendChild(make('p', `${a.id}: ${a.alive ? 'survived · ' + (a.gold ?? 0) + ' gold / ' + (a.inventory?.length ?? 0) + ' items carry forward' : 'dead · starts next run empty'}`));
        const next = make('button', remote ? 'Close result' : 'Return to DM setup'); listen(next, 'click', () => {dismissedResultKey = key; result.hidden = true; focus(remoteId() ?? 'dm'); setDMOpen(true);}); result.appendChild(next);
      }
    }
  }
  function make(tag, text) {const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node;}
  function button(text, action) {const node = make('button', text); node.type = 'button'; listen(node, 'click', action); return node;}
  function select(values, action) {const node = make('select'); for (const [value, label] of values) {const option = make('option', label); option.value = value; node.appendChild(option);} listen(node, 'change', () => action(node.value)); return node;}
  let partySetup=null;
  function tileDescription(tile){return `Floor ${tile.floor ?? '?'} · tile ${tile.column ?? '?'}, ${tile.row ?? '?'} (ID ${tile.index}) · ${tile.contents?.length?tile.contents.join(', '):'No placed objects'}`;}
  function targetTile(position){const w=world();if(typeof w.describeDMTile==='function')return w.describeDMTile(position);const m=w.moduleSize??4.8,size=w.size??16,col=Math.floor(position.x/m+size/2),row=Math.floor(position.z/m+size/2);return col<0||row<0||col>=size||row>=size?null:{index:row*size+col,column:col+1,row:row+1,floor:(w.floor??0)+1,x:(col-(size-1)/2)*m,z:(row-(size-1)/2)*m,height:position.y,moduleSize:m,contents:[]};}
  function preview(position){const tile=targetTile(position);tileMarker.visible=!!tile&&enabled&&dmOpen&&!remoteId();if(tile){tileMarker.scale.set(tile.moduleSize??4.8,tile.moduleSize??4.8,1);tileMarker.position.set(tile.x,(tile.height??0)+.08,tile.z);tileMarker.material.color.setHex(tile.supported===false?0x9d5145:0xc8b778);if(tileStatus)tileStatus.textContent='Target: '+tileDescription(tile);}return tile;}
  if (document?.createElement && document.body) {
    launcher = button('Party: DM + 3', () => setEnabled(true)); launcher.id = 'partyToggle'; launcher.style.cssText = 'position:fixed;left:310px;top:75px;z-index:40'; document.body.appendChild(launcher);
    toolbar = make('div'); toolbar.id = 'partyToolbar'; toolbar.hidden = true;
    title = make('b', 'HOLLOW · DM + 3'); toolbar.appendChild(title);
    const soloButton = button('Dungeon Lab', () => {if (!remoteId()){setEnabled(false);onOpenLab?.();}}), toolsButton = button('DM tools', () => {focus('dm'); setDMOpen(!dmOpen);});
    toolbar.appendChild(soloButton); toolbar.appendChild(toolsButton);hostControls.push(soloButton,toolsButton);
    newDungeonButton=button('New dungeon',async()=>{if(remoteId()||phase()==='active'||starting||busy()||typeof onNewDungeon!=='function')return;starting=true;clearInputs();focus('dm');setDMOpen(true);updateUI();try{await onNewDungeon();validate();}catch(error){report(error);}finally{starting=false;updateUI();}});newDungeonButton.dataset.action='newDungeon';toolbar.appendChild(newDungeonButton);hostControls.push(newDungeonButton);
    startButton = button('Start expedition', () => {void start();}); toolbar.appendChild(startButton);
    const pathButton = button('Show completion path', () => validate(true)); toolbar.appendChild(pathButton); hostControls.push(startButton, pathButton);
    for (const kind of ['summonBoss', 'possessBoss']) {const b = button(kind, () => bossAction(kind)); b.dataset.action = kind; toolbar.appendChild(b); hostControls.push(b);}
    validationLabel = make('span'); toolbar.appendChild(validationLabel); resourceLabel = make('span'); toolbar.appendChild(resourceLabel); hostControls.push(validationLabel, resourceLabel); document.body.appendChild(toolbar);
    shell = make('div'); shell.id = 'partyShell'; shell.hidden = true; shell.style.gap = '0';
    dmPane = make('section'); dmPane.className = 'party-pane'; dmLabel = button('0 · DM · overhead / edit', () => focus('dm')); dmLabel.className = 'party-label'; dmPane.appendChild(dmLabel);dmHint=make('span');dmHint.className='party-hud';dmPane.appendChild(dmHint);shell.appendChild(dmPane);
    palette = make('section'); palette.id = 'dmPalette'; palette.hidden = true; palette.appendChild(make('h2', 'Dungeon master'));
    const guide=make('div');guide.className='dm-placement-guide';workflowStatus=make('p');workflowStatus.id='dmWorkflowStatus';guide.appendChild(workflowStatus);guide.appendChild(make('b','1. Choose a tool  →  2. Click a tile'));guide.appendChild(make('p','Placement is a single click, not a drag. Drag the map to orbit. Gold shows the target tile; red means unsupported floor. Esc returns to Inspect.'));toolStatus=make('p');toolStatus.id='dmToolStatus';guide.appendChild(toolStatus);tileStatus=make('p','No tile selected. Point at the DM map to preview a tile.');tileStatus.id='dmTileStatus';guide.appendChild(tileStatus);placementStatus=make('p','Ready to inspect.');placementStatus.id='dmPlacementStatus';placementStatus.setAttribute('role','status');guide.appendChild(placementStatus);palette.appendChild(guide);
    partySetup=make('details');partySetup.appendChild(make('summary','Adventurers & loadouts'));palette.appendChild(partySetup);
    for (const a of campaign.actors) {
      const pane = make('section'); pane.className = 'party-pane'; pane.dataset.actor = a.id;
      const label = button(a.id, () => focus(a.id)); label.className = 'party-label'; pane.appendChild(label);
      const hud = make('div'); hud.className = 'party-hud'; const stats = make('span'); hud.appendChild(stats); hud.appendChild(button('Inventory', () => openInventory(a)));const hint=make('span');hint.className='party-control-hint';hint.style.flexBasis='100%';hint.hidden=true;hud.appendChild(hint);pane.appendChild(hud); shell.appendChild(pane);
      const row = make('div'); row.className = 'party-setup-row'; row.appendChild(make('b', a.id));
      const classSelect = select(Object.values(CLASSES).map(c => [c.id, c.name]), id => setClass(a, id)); classSelect.setAttribute('aria-label', a.id + ' class'); row.appendChild(classSelect);
      const weapon = select([], id => loadout(a, 'weapon', id)); weapon.setAttribute('aria-label', a.id + ' weapon'); row.appendChild(weapon);
      const offhand = select([], id => loadout(a, 'offhand', id)); offhand.setAttribute('aria-label', a.id + ' offhand'); row.appendChild(offhand);
      row.appendChild(button('Inventory', () => openInventory(a))); partySetup.appendChild(row); ui.set(a.id, {pane, row, label, stats, hint, classSelect, weapon, offhand});
    }
    const groups=[['Inspect & remove',['select','erase']],['Monsters',TOOLS.filter(k=>k.startsWith('monster:'))],['Traps & obstacles',TOOLS.filter(k=>k.startsWith('trap:'))],['Locks & keys',TOOLS.filter(k=>k.startsWith('door:')||k.startsWith('key:'))]];
    for(const [label,kinds]of groups){const section=make('details');section.open=label==='Monsters'||label==='Inspect & remove';section.className='dm-tool-group';section.appendChild(make('summary',label));
      if(label==='Locks & keys'){section.appendChild(make('p','Click an existing door to lock it. Choose a named lock below, then place its matching key before that door. Show completion path checks the sequence.'));namedLockSelect=select([['','Choose the exact named lock']],id=>{if(remoteId()||phase()!=='lobby')return;onNamedLock?.(id);updateUI();});namedLockSelect.id='dmNamedLock';namedLockSelect.setAttribute('aria-label','Named lock for matching key');section.appendChild(namedLockSelect);}
      const grid=make('div');grid.className='dm-tool-grid';for(const kind of kinds){const b=button(toolLabel(kind),()=>{if(remoteId())return;focus('dm');tool=kind;placementRevision++;if(placementStatus)placementStatus.textContent=kind==='select'?'Click a tile to inspect its contents.':'Selected '+toolLabel(kind)+'. Click a tile in the DM map.';updateUI();});b.dataset.placement=kind;grid.appendChild(b);}section.appendChild(grid);palette.appendChild(section);
    }
    palette.appendChild(make('p', 'Local test: press 1 / 2 / 3 or click a hero pane/label to control that adventurer; 0 returns to DM. Start expedition before moving. WASD move · drag look · Space strike · E interact · Q offhand · R swap · F search. Gamepads: left stick move, right stick look, A interact, X/RT strike, Y search, RB swap, LT guard, LB inventory.'));
    const aside = null; // Dedicated DM drawer; world-generation controls stay separate.
    if (aside) {palette.style.cssText = 'position:static;width:auto;max-height:none;padding:0;border:0;box-shadow:none;overflow:visible'; aside.insertBefore(palette, aside.firstChild);}
    else document.body.appendChild(palette);
    document.body.appendChild(shell); result = make('section'); result.id = 'partyResult'; result.hidden = true; result.setAttribute('role', 'status'); document.body.appendChild(result);
  }
  const keydown = event => {
    syncMode();
    const key = event.key?.toLowerCase(); if (!enabled || typing() || typing(event.target)) return;
    if(key==='escape'&&!remoteId()&&dmOpen){event.preventDefault();event.stopImmediatePropagation?.();tool='select';placementRevision++;drag=null;tileMarker.visible=false;updateUI();return;}
    const digit=/^Digit[0-3]$/.test(event.code??'')?event.code.slice(-1):!event.code&&/^[0-3]$/.test(key??'')?key:null;
    if(digit!==null){if(remoteId()||busy()||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;const wanted=digit==='0'?'dm':'hero-'+digit;if(focus(wanted)){event.preventDefault();event.stopImmediatePropagation?.();}return;}
    if(document?.activeElement?.tagName==='BUTTON')return;
    if (!MOVEMENT.has(key) && !Object.hasOwn(COMMANDS, key) && key !== 'q') return;
    event.preventDefault(); event.stopImmediatePropagation?.();
    if(focusReleaseKeys.has(key)){if(event.repeat)return;focusReleaseKeys.delete(key);}
    const a = actor(focusedId); if (!playable(a)) return;
    if (MOVEMENT.has(key) || key === 'q') keys.add(key);
    if (key === 'q') {if (!event.repeat) guard(a, 'keyboard');}
    else if (!MOVEMENT.has(key) && !event.repeat) emit(a, COMMANDS[key]);
  };
  const keyup = event => {const key = event.key?.toLowerCase(); keys.delete(key);focusReleaseKeys.delete(key); if (key === 'q') release('keyboard');};
  listen(document, 'keydown', keydown, true); listen(document, 'keyup', keyup, true); listen(window, 'blur', clearInputs);
  listen(canvas, 'blur', clearInputs);
  listen(document, 'visibilitychange', () => {if (document.hidden) clearInputs();});
  listen(document, 'pointerlockchange', clearInputs);
  listen(window, 'focus', clearInputs);
  function raycast(clientX, clientY) {
    const rect = getViewportRect('dm'); if (!rect) return null;
    const aspect = dmCamera.aspect, oldView = dmCamera.view ? {...dmCamera.view} : null;
    try {
      dmCamera.aspect = rect.width / rect.height; dmCamera.clearViewOffset?.(); dmCamera.updateProjectionMatrix(); scene.updateMatrixWorld(true); dmCamera.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1), dmCamera);
      const w = world(), target = w.isObject3D ? w : w.world ?? w.group ?? w.root;
      const hits = target ? ray.intersectObject(target, true).filter(hit => {
        for (let p = hit.object; p; p = p.parent) if (p === roof || p === root || !p.visible) return false;
        return true;
      }) : [];
      if (hits[0]) return {position: hits[0].point.clone(), hit: hits[0]};
      const point = new THREE.Vector3(); return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), point) ? {position: point, hit: null} : null;
    } finally {dmCamera.aspect = aspect; dmCamera.view = oldView; dmCamera.updateProjectionMatrix();}
  }
  listen(canvas, 'pointerdown', event => {
    if (!enabled || event.button > 0) return;
    const rect = hitPartyViewport(getViewports(), event.clientX, event.clientY); if (!rect) return;
    if(!focus(rect.id))return;drag = {id: rect.id, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY};
    try {canvas.setPointerCapture?.(event.pointerId);} catch { /* Capture may be denied for a canceled pointer. */ }
    if (rect.id !== 'dm') {event.preventDefault(); event.stopImmediatePropagation?.();}
  }, true);
  listen(canvas, 'pointermove', event => {
    if(drag?.id==='dm'&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>5)drag.orbit=true;
    if(enabled&&!remoteId()&&dmOpen&&hitPartyViewport(getViewports(),event.clientX,event.clientY)?.id==='dm'){const point=raycast(event.clientX,event.clientY);if(point)preview(point.position);else tileMarker.visible=false;}else tileMarker.visible=false;
    if (!enabled || !drag || drag.id === 'dm') return;
    const a = actor(drag.id); if (playable(a)) {const settings=inputSettings(),speed=.004*settings.sensitivity;a.yaw=(a.yaw??0)-(event.clientX-drag.x)*speed;a.pitch=clamp((a.pitch??0)-(event.clientY-drag.y)*speed*(settings.invertY?-1:1),-1.25,1.25);}
    drag.x = event.clientX; drag.y = event.clientY; event.preventDefault(); event.stopImmediatePropagation?.();
  }, true);
  listen(canvas, 'pointerup', event => {
    const was = drag; drag = null;options.onMapPointerEnd?.(); if (!enabled || !dmOpen || remoteId() || !was || was.id !== 'dm' || busy() || typeof onPlace !== 'function') return;
    if (was.orbit||Math.hypot(event.clientX - was.startX, event.clientY - was.startY) > 5 || hitPartyViewport(getViewports(), event.clientX, event.clientY)?.id !== 'dm') return;
    const point = raycast(event.clientX, event.clientY); if (!point) return;
    const revision=++placementRevision,placedKind=tool;selectedTile=preview(point.position);if(!selectedTile)return;const placedTile=selectedTile;
    if(tool==='select'){if(placementStatus)placementStatus.textContent='Inspecting '+tileDescription(selectedTile);}
    else try {const placed=onPlace(tool,point.position,{hit:point.hit,phase:phase()});const feedback=ok=>{if(revision!==placementRevision||destroyed)return;if(placementStatus)placementStatus.textContent=ok===false?'Could not place '+toolLabel(placedKind)+' here. Check the message and choose another tile.':toolLabel(placedKind)+' placed at tile '+placedTile.column+', '+placedTile.row+'.';selectedTile=targetTile(point.position);updateUI();};if(placed?.then)placed.then(feedback).catch(report);else feedback(placed);lastValidation=-Infinity;}catch(error){report(error);}
    event.preventDefault();event.stopImmediatePropagation?.();
  }, true);
  listen(canvas,'pointerleave',()=>{tileMarker.visible=false;});
  listen(canvas, 'pointercancel', () => {drag = null;});
  const gamepads = () => {try {return options.getGamepads?.() ?? globalThis.navigator?.getGamepads?.() ?? [];} catch {return [];}};
  function tick(dt, time) {
    if (!enabled || destroyed) return;
    const remote = syncMode();
    now = Number.isFinite(time) ? time : now; dt = clamp(Number.isFinite(dt) ? dt : 0, 0, .05); attachActors();
    if (now - lastValidation >= 500 && phase() !== 'active' && !starting) validate();
    const intents = new Map(campaign.actors.map(a => [a.id, {forward: 0, side: 0, dt}]));
    if (phase() !== 'active' || busy()) {const mapDrag=!busy()&&drag?.id==='dm'?drag:null;clearInputs();drag=mapDrag;}
    else {
      if (!keys.has('q')) release('keyboard');
      const focused = actor(focusedId);
      if (playable(focused) && !typing()) {const input = intents.get(focused.id); input.forward += (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0); input.side += (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);}
      else {keys.clear(); release('keyboard');}
      const touch=world().touchInput;if(touch?.actorId===focused?.id&&playable(focused)){const input=intents.get(focused.id);input.forward+=clamp(touch.forward??0,-1,1);input.side+=clamp(touch.side??0,-1,1);}
      const connected = new Set(); let remotePadSeen = false;
      for (const [index, pad] of Array.from(gamepads()).entries()) {
        if (!pad || pad.connected === false) continue;
        if (remote && remotePadSeen) continue;
        if (remote) remotePadSeen = true;
        const padId = Number.isInteger(pad.index) ? pad.index : index; connected.add(padId);
        if (!padOwners.has(padId)) {const available = remote ? actor(remote) : campaign.actors.find(a => ![...padOwners.values()].includes(a.id)); if (!available) continue; padOwners.set(padId, available.id);}
        const a = actor(padOwners.get(padId)), previous = padButtons.get(padId) ?? new Set(), pressed = new Set();
        for (let i = 0; i < (pad.buttons?.length ?? 0); i++) if (pad.buttons[i]?.pressed || pad.buttons[i]?.value > .5) pressed.add(i);
        padButtons.set(padId, pressed);
        if (!playable(a)) {release('pad:' + padId); continue;}
        const input = intents.get(a.id); input.side += axis(pad.axes?.[0]); input.forward -= axis(pad.axes?.[1]);
        const settings=inputSettings();a.yaw=(a.yaw??0)-axis(pad.axes?.[2])*dt*2.1*settings.sensitivity;a.pitch=clamp((a.pitch??0)-axis(pad.axes?.[3])*dt*1.7*settings.sensitivity*(settings.invertY?-1:1),-1.25,1.25);
        if (pressed.has(6)) guard(a, 'pad:' + padId); else release('pad:' + padId);
        for (const [button, kind] of [[0, 'interact'], [2, 'attack'], [7, 'attack'], [3, 'search'], [5, 'swap']]) if (pressed.has(button) && !previous.has(button)) emit(a, kind);
        if (pressed.has(4) && !previous.has(4)) onInventory?.(a);
      }
      for (const padId of [...padOwners.keys()]) if (!connected.has(padId)) {release('pad:' + padId); padOwners.delete(padId); padButtons.delete(padId);}
    }
    for (const r of records.values()) {
      const a = r.actor, input = intents.get(a.id), botInput=world().autoplayInputs?.[a.id];if(botInput&&playable(a)){input.forward=clamp(botInput.forward??0,-1,1);input.side=clamp(botInput.side??0,-1,1);}const length = Math.hypot(input.forward, input.side); r.moving = false;
      if (length && playable(a)) {
        if (length > 1) {input.forward /= length; input.side /= length;}
        const before = [a.position.x, a.position.y, a.position.z];
        try {const moved = moveActor(a, input); r.moving = moved === true || before.some((value, i) => value !== a.position[['x', 'y', 'z'][i]]);} catch (error) {report(error);}
      }
      r.sprite.position.set(a.position.x, a.position.y, a.position.z); r.sprite.rotation.y = a.yaw ?? 0;
      r.sprite.userData.animate?.({time: now / 1000, moving: r.moving, attacking: now < r.attackUntil||now<(a.lastAttack??-Infinity)+280, dead: a.alive === false, hurt: now < (a.hurtUntil ?? 0)});
      r.camera.position.set(a.position.x, a.position.y + 1.48, a.position.z); r.camera.rotation.set(a.pitch ?? 0, a.yaw ?? 0, 0);
      r.equipment?.setTorchState?.({fuel:a.torchFuel??120,lit:a.torchLit!==false});
      r.equipment?.animate?.({time: now, moving: r.moving, attacking: now < r.attackUntil||now<(a.lastAttack??-Infinity)+280, casting: now < r.castUntil || now < (a.castingUntil ?? 0)||now<(a.lastCast??-Infinity)+380, blocking: hand(a) === 'shield' && ([...guards.values()].includes(a.id)||!!a.guarding)});
    }
    updateUI();
  }
  function render() {
    if (!enabled || destroyed) return false;
    attachActors(); updateUI();
    const rectangles = getViewports(); if (rectangles.length !== (remoteId()||buildWorkspace()||world().mobileLayout ? 1 : 4)) return false;
    const savedViewport = renderer.getViewport?.(new THREE.Vector4()), savedScissor = renderer.getScissor?.(new THREE.Vector4()), savedScissorTest = renderer.getScissorTest?.() ?? false, savedAutoClear = renderer.autoClear;
    const oldAspect = dmCamera.aspect, oldView = dmCamera.view ? {...dmCamera.view} : null, oldFog = scene.fog?.density;
    const w = world(), hidden = (w.hideDuringParty ?? []).filter(Boolean), dmOnly = [];const dmLights=(w.dmLights??[]).filter(l=>Number.isFinite(l?.intensity)),lightPowers=new Map(dmLights.map(l=>[l,l.intensity]));
    scene.traverse(o => {if (o.userData?.dmOnly) dmOnly.push(o);});
    const atmosphere=[];scene.traverse(o=>{if(o.userData?.atmosphere)atmosphere.push(o);});
    const tracked = [...atmosphere,...hidden,...(w.dmBoss?.mesh?[w.dmBoss.mesh]:[]), ...dmOnly, ...(roof ? [roof] : [])];
    for (const r of records.values()) tracked.push(r.sprite, r.light, ...equipmentNodes(r.equipment));
    const visibility = new Map(tracked.map(o => [o, o.visible]));
    try {
      renderer.autoClear = false; renderer.setScissorTest(true);
      for (const rect of rectangles) {
        const selected = records.get(rect.id), camera = selected?.camera ?? dmCamera;for(const light of dmLights)light.intensity=rect.id==='dm'&&!w.dmBoss?Math.max(lightPowers.get(light),light.isAmbientLight||light.isHemisphereLight?5:3.2):lightPowers.get(light);
        for(const object of atmosphere)object.visible=rect.id!=='dm'&&visibility.get(object);
        for (const object of hidden) object.visible = false;if(w.dmBoss?.mesh)w.dmBoss.mesh.visible=rect.id!=='dm';
        for (const object of dmOnly) object.visible = rect.id === 'dm' && visibility.get(object);
        if (roof) roof.visible = rect.id !== 'dm'||!!w.dmBoss;
        if (scene.fog && Number.isFinite(oldFog)) scene.fog.density = rect.id === 'dm'&&!w.dmBoss ? .002 : Number.isFinite(w.fogDensity) ? w.fogDensity : Number.isFinite(w.fogDistance) ? 1.8 / Math.max(1, w.fogDistance) : oldFog;
        for (const r of records.values()) {
          r.sprite.visible = r !== selected && !r.actor.escaped;
          r.light.visible = r === selected && living(r.actor);
          for (const node of equipmentNodes(r.equipment)) node.visible = false;
        }
        if (selected?.equipment && living(selected.actor)) {selected.equipment.right.visible = true; if (hand(selected.actor) === 'magic') selected.equipment.leftMagic.visible = true; else if(hand(selected.actor)==='torch'){if(selected.equipment.leftTorch)selected.equipment.leftTorch.visible=true;}else selected.equipment.leftShield.visible = true;}
        camera.aspect = rect.width / rect.height; camera.clearViewOffset?.(); camera.updateProjectionMatrix();
        if (selected?.equipment) layoutEquipment?.(selected.equipment, camera.aspect, camera.fov, selected.actor);
        renderer.setViewport(rect.glX, rect.glY, rect.glWidth, rect.glHeight); renderer.setScissor(rect.glX, rect.glY, rect.glWidth, rect.glHeight); renderer.clear(true, true, true); renderer.render(scene, camera);
      }
    } finally {
      for(const [light,power]of lightPowers)light.intensity=power;
      for (const [object, visible] of visibility) object.visible = visible;
      if (scene.fog && Number.isFinite(oldFog)) scene.fog.density = oldFog;
      dmCamera.aspect = oldAspect; dmCamera.view = oldView; dmCamera.updateProjectionMatrix(); renderer.autoClear = savedAutoClear;
      if (savedViewport) renderer.setViewport(savedViewport.x, savedViewport.y, savedViewport.z, savedViewport.w);
      if (savedScissor) renderer.setScissor(savedScissor.x, savedScissor.y, savedScissor.z, savedScissor.w);
      renderer.setScissorTest(savedScissorTest);
    }
    return true;
  }
  function destroy() {
    if (destroyed) return; setEnabled(false); clearInputs(); destroyed = true; removers.forEach(fn => fn());
    for (const r of records.values()) {disposeSprite(r.sprite); r.equipment?.dispose?.();} records.clear(); root.removeFromParent();tileMarker.removeFromParent();tileMarker.geometry.dispose();tileMarker.material.dispose();
    for (const node of [launcher, toolbar, shell, palette, result]) node?.remove();
    if (originalTabIndex === null) canvas.removeAttribute?.('tabindex'); else canvas.setAttribute?.('tabindex', originalTabIndex);
  }
  return {setEnabled, focus, attachActors, getViewportRect, tick, render, start, validate, clearInputs, act:(id,kind)=>emit(actor(id),kind), destroy, dispose: destroy,
    get enabled() {return enabled;}, set enabled(value) {setEnabled(value);}, get focusedActor() {syncMode(); return actor(focusedId);}, get focusedId() {syncMode(); return focusedId;},
    get actorRoot() {return root;}, get toolbar() {return toolbar;}, get palette() {return palette;}, get shell() {return shell;},
    getCamera(id) {if (remoteId() && id !== remoteId()) return null; return records.get(id)?.camera ?? (id === 'dm' ? dmCamera : null);}, get validation() {return validation;}};
}
