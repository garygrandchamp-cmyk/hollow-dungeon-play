// 3D character models (rigged GLBs in assets/models): the default character presentation.
//
// Sprites remain the fallback: ?models=sprites once, or Options → Dev Options → unticking 3D character models, makes
// makeCreature / makePlayerSprite return the pixel-art sprites untouched. With models on the sprite is still built and
// still owns every bit of game-facing state (death progress, settle, clips, frame indices), but its
// billboard is hidden once the GLB has loaded and a skinned model plays clips chosen from the same
// animate() inputs plus the host AI phase the game already stores on the group (userData.enemyIntent).
// Presentation only: nothing here advances AI, damage or timers. If a GLB fails to load the sprite stays.
import {makeCreature as makeSpriteCreature, MONSTER_CATALOG} from './monster-sprites.js?v=84fc371936953c752f7d36674575129dbb0d8ea1';
import {makePlayerSprite as makeSpritePlayer} from './player-sprites.js?v=84fc371936953c752f7d36674575129dbb0d8ea1';
import {ENEMY_BEHAVIORS} from './enemy-behavior.js?v=84fc371936953c752f7d36674575129dbb0d8ea1';

const STORAGE_KEY = 'hollow.models';

export function modelsEnabled() {
  try {
    const v = new URLSearchParams(globalThis.location?.search ?? '').get('models');
    if (v === '3d' || v === 'sprites') { globalThis.localStorage?.setItem(STORAGE_KEY, v); return v === '3d'; }
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (stored === '3d' || stored === 'sprites') return stored === '3d';
    // Default on in a real browser; headless Node checks (no WebGL) keep the sprites unless they opt in.
    return typeof globalThis.WebGLRenderingContext !== 'undefined';
  } catch { return false; }
}
export function setModelsEnabled(on) {
  try { globalThis.localStorage?.setItem(STORAGE_KEY, on ? '3d' : 'sprites'); } catch { /* storage unavailable */ }
}

const PHASES = (p) => ({windup: p + '_windup', lunge: p + '_strike', recover: p + '_recover'});
const NO_WEAPON_PROPS = ['Skeleton_Sword', 'Skeleton_Shield'];
const ZOMBIE_PROPS = ['FatZombieB_Shield', 'FatZombieB_Cleaver'];
// Enemy type -> model + clip names (see Models/Rigged_ARP/animation_manifest.json).
export const ENEMY_MODELS = Object.freeze({
  skeleton: {model: 'Skeleton', idle: 'idle_carry', walk: 'walk_carry', phases: PHASES('skeleton_strike')},
  goblin: {model: 'Goblin', phases: PHASES('goblin_stab')},
  wraith: {model: 'Wraith', attack: 'wraith_claw'},
  'deathless-pursuer': {model: 'Wraith', attack: 'wraith_claw', phases: PHASES('pursuer_grasp')},
  'crypt-guardian': {model: 'FatZombieB', walk: 'shamble', phases: PHASES('guardian_sweep'), hideProps: ZOMBIE_PROPS},
  drowned: {model: 'FatZombieB', walk: 'shamble', phases: PHASES('drowned_sweep'), hideProps: ZOMBIE_PROPS},
  'skeletal-mage': {model: 'Lich', mage: PHASES('mage_bolt')},
  listener: {model: 'Ghoul', idle: 'listen', walk: 'listener_walk', investigate: 'listen', phases: PHASES('listener_claw'), hideProps: ['Ghoul_Bell']},
  // Catalog height is the prone crawl height; scale the model as a standing skeleton and let the crawl clips lay it down.
  crawler: {model: 'Skeleton', standingHeight: 1.7, idle: 'crawl_idle', walk: 'crawl', hurt: 'crawler_hurt', death: 'crawler_death', haul: 'crawler_drag',
    collect: 'crawl', phases: PHASES('crawler_lunge'), hideProps: NO_WEAPON_PROPS},
  spider: {model: 'SpiderA', phases: {windup: 'pounce_windup', lunge: 'pounce_lunge', recover: 'pounce_recover'}},
  'ceiling-widow': {model: 'SpiderB', idle: 'widow_perch', walk: 'widow_perch', attack: 'widow_cocoon', upsideDown: true},
  rat: {model: 'Rat', flee: 'run', hide: 'hide', collect: 'steal', phases: {windup: 'bite_windup', lunge: 'bite', recover: 'bite_backoff'}},
  bat: {model: 'Bat', phases: {windup: 'dive_windup', lunge: 'dive_strike', recover: 'dive_recover'}},
  slime: {model: 'Slime', phases: {windup: 'burst_windup', lunge: 'burst', recover: 'burst_recover'}},
});
// Player class -> model + default weapon clip (party-campaign.js CLASSES default weapons). Every hero GLB keeps `cast`.
export const PLAYER_MODELS = Object.freeze({
  paladin: {model: 'Knight', cast: 'cast', attack: 'attack_sword', idle: 'idle_carry', walk: 'walk_carry'},
  mage: {model: 'Wizard', cast: 'cast', attack: 'attack_staff'},
  barbarian: {model: 'Barbarian', cast: 'cast', attack: 'attack_heavy', idle: 'idle_carry', walk: 'walk_carry'},
  warlock: {model: 'Necromancer', cast: 'cast', attack: 'attack_staff'},
  thief: {model: 'Rogue', cast: 'cast', attack: 'attack_dagger'},
  archer: {model: 'Ranger', cast: 'cast', attack: 'shoot_bow', idle: 'idle_carry', walk: 'walk_carry'},
  player: {model: 'Knight', cast: 'cast', attack: 'attack_sword', idle: 'idle_carry', walk: 'walk_carry'},
});

// ------------------------------------------------------------------ loading (shared per model)
let toolsPromise = null;
const gltfCache = new Map();
function tools() {
  toolsPromise ??= Promise.all([import('./vendor/GLTFLoader.js?v=84fc371936953c752f7d36674575129dbb0d8ea1'), import('./vendor/SkeletonUtils.js?v=84fc371936953c752f7d36674575129dbb0d8ea1')])
    .then(([{GLTFLoader}, SkeletonUtils]) => ({loader: new GLTFLoader(), SkeletonUtils}));
  return toolsPromise;
}
function loadModel(THREE, name) {
  if (!gltfCache.has(name)) {
    gltfCache.set(name, tools().then(({loader}) => loader.loadAsync(new URL(`./assets/models/${name}.glb`, import.meta.url).href)).then((gltf) => {
      // Pixel-art direction: textures are pre-pixelated to 64 texels/metre (Models/viewer/slim_glb.py); sample them crisp.
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (m?.map) { m.map.magFilter = THREE.NearestFilter; m.map.minFilter = THREE.NearestMipmapNearestFilter; m.map.anisotropy = 1; m.map.needsUpdate = true; }
        }
      });
      return gltf;
    }));
  }
  return gltfCache.get(name);
}

// Shared with first-person-models.js (same cache, so the camera view model and the third-person actor load once).
export const loadPlayerModel = loadModel;
export const modelTools = tools;

function bodyBounds(THREE, scene) {
  let best = null;
  scene.traverse((o) => { if (o.isSkinnedMesh && (!best || o.geometry.attributes.position.count > best.geometry.attributes.position.count)) best = o; });
  const box = new THREE.Box3();
  if (best) { best.geometry.computeBoundingBox(); box.copy(best.geometry.boundingBox); }
  else box.setFromObject(scene);
  return box;
}
function propKey(o) {
  const p = o.parent;
  return p && !p.isBone && p.type === 'Group' && p.name && o.name.startsWith(p.name) ? p.name : o.name;
}

// ------------------------------------------------------------------ hybrid actor
// Heroes share a spawn point before a run, and a full-size model can stand inside another hero's first-person
// camera. A model whose root is closer than this to the camera being rendered is cut away for that view only
// (per viewport, so split screen still shows it to everyone else).
const NEAR_CAMERA_CULL = 0.75;
function nearCameraMaterial(source, root) {
  const m = source.clone();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uModelRoot = {value: root};
    shader.fragmentShader = shader.fragmentShader.replace('void main() {',
      `uniform vec3 uModelRoot;
void main() {
  if (distance(cameraPosition.xz, uModelRoot.xz) < ${NEAR_CAMERA_CULL.toFixed(3)}) discard;`);
  };
  m.customProgramCacheKey = () => 'near-camera-cull';
  return m;
}

function attachModel(THREE, sprite, spec, {height, hover = 0, enemyType = null, nearCull = false}) {
  const billboard = sprite.children.find((c) => /billboard/.test(c.name)) ?? sprite.children[0];
  const pivot = new THREE.Group();
  pivot.name = 'model-pivot';
  pivot.rotation.y = Math.PI;                          // GLBs face +Z; game roots face -Z
  if (spec.upsideDown) { pivot.rotation.x = Math.PI; pivot.position.y = hover + height; }
  else pivot.position.y = hover;
  sprite.add(pivot);
  const profile = enemyType ? ENEMY_BEHAVIORS[enemyType] : null;
  const st = {ready: false, disposed: false, mixer: null, actions: new Map(), current: null, queue: [], oneShotUntil: 0,
    last: {}, lastTime: null, intent: null, attacking: false, casting: false, hurt: false, settled: false, callerFacing: false, autoYaw: null,
    prevPos: new THREE.Vector3(), havePos: false, deathStart: null};

  loadModel(THREE, spec.model).then(({scene, animations}) => tools().then(({SkeletonUtils}) => {
    if (st.disposed) return;
    const model = SkeletonUtils.clone(scene);
    const box = bodyBounds(THREE, scene);
    const s = height / Math.max(1e-3, box.max.y - box.min.y);
    model.scale.setScalar(s);
    model.position.y = -box.min.y * s;
    const root = new THREE.Vector3(), owned = new Map();
    st.ownedMaterials = owned;
    model.traverse((o) => {
      if (o.isMesh) {
        o.frustumCulled = false;
        if (nearCull) {
          const swap = (m) => { if (!m) return m; if (!owned.has(m)) owned.set(m, nearCameraMaterial(m, root)); return owned.get(m); };
          o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
          o.onBeforeRender = () => { pivot.getWorldPosition(root); };
        }
        const k = propKey(o);
        if (k.startsWith('Offhand_Torch') || (spec.hideProps ?? []).includes(k)) o.visible = false;
      }
    });
    pivot.add(model);
    st.mixer = new THREE.AnimationMixer(model);
    for (const clip of animations) st.actions.set(clip.name, st.mixer.clipAction(clip));
    st.ready = true;
    if (billboard) billboard.visible = false;
    sprite.userData.modelReady = true;
    if (st.settled) settle();
    else if (st.lastState === 'death') {
      // Died while the GLB was loading: catch the collapse up to where the sprite is.
      const death = spec.death ?? 'death';
      play(death, {once: true, restart: true, fade: 0});
      const a = st.actions.get(death);
      if (a) { a.time = Math.min(a.getClip().duration, Math.max(0, (st.lastTime ?? 0) - (st.deathStart ?? st.lastTime ?? 0))); st.mixer.update(0); }
    } else play(st.want ?? (spec.idle ?? 'idle'), {fade: 0});
  })).catch((error) => {
    sprite.userData.modelError = String(error?.message ?? error);
    console.warn('3D model unavailable, keeping sprite:', spec.model, error);
  });

  function clipLength(name) { return st.actions.get(name)?.getClip().duration ?? 0; }
  function play(name, {fade = 0.15, once = false, restart = false, hold = false} = {}) {
    st.want = name;
    if (!st.ready) return;
    const next = st.actions.get(name) ?? st.actions.get('idle');
    if (!next) return;
    if (st.current === next && !restart) return;
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once || hold;
    next.enabled = true;
    if (st.current && st.current !== next && fade > 0) next.crossFadeFrom(st.current, fade, false);
    else if (st.current && st.current !== next) st.current.stop();
    next.play();
    st.current = next;
    st.currentName = name;
    sprite.userData.modelClip = name;
  }
  function oneShot(names, now) {
    // Queue of one-shot clips (e.g. strike -> recover); each holds its last frame until the next starts.
    st.queue = names.filter((n) => st.actions.has(n) || !st.ready);
    st.queueStart = now;
    advanceQueue(now, true);
  }
  function advanceQueue(now, first = false) {
    if (!st.queue.length) return false;
    const name = st.queue[0];
    if (first || st.currentName !== name) { play(name, {once: true, restart: true, fade: first ? 0.1 : 0.05}); st.oneShotUntil = now + clipLength(name); }
    if (now >= st.oneShotUntil && st.ready) {
      st.queue.shift();
      if (st.queue.length) { play(st.queue[0], {once: true, restart: true, fade: 0.05}); st.oneShotUntil = now + clipLength(st.queue[0]); }
    }
    return st.queue.length > 0;
  }
  function settle() {
    const death = spec.death ?? 'death';
    play(death, {once: true, restart: true, fade: 0});
    const a = st.actions.get(death);
    if (a) { a.time = a.getClip().duration; st.mixer.update(0); }
    if (hover && !spec.upsideDown) pivot.position.y = 0;
  }

  function drive({time = 0, moving = false, attacking = false, casting = false, hurt = false, dead = false, state: requested} = {}) {
    if (!Number.isFinite(time)) return;
    const dt = st.lastTime == null ? 0 : Math.max(0, Math.min(0.1, time - st.lastTime));
    st.lastTime = time;
    // Facing: game rotates enemy and party roots itself; a root it never rotates gets faced along its motion.
    if (Math.abs(sprite.rotation.y) > 1e-6) st.callerFacing = true;
    if (!st.callerFacing) {
      const p = sprite.getWorldPosition(new THREE.Vector3());
      if (st.havePos) {
        const dx = p.x - st.prevPos.x, dz = p.z - st.prevPos.z;
        if (dx * dx + dz * dz > 1e-6) st.autoYaw = Math.atan2(dx, dz);
      }
      st.prevPos.copy(p); st.havePos = true;
      if (st.autoYaw != null) pivot.rotation.y = st.autoYaw;
    }
    const intent = sprite.userData.enemyIntent ?? null;
    const phase = intent === 'windup' || intent === 'lunge' || intent === 'recover' ? intent : null;
    const now = time;
    if (dead || requested === 'death') {
      if (st.lastState !== 'death') { st.queue = []; play(spec.death ?? 'death', {once: true, restart: true, fade: 0.1}); st.deathStart = now; }
      st.lastState = 'death';
      if (hover && !spec.upsideDown) pivot.position.y = hover * Math.max(0, 1 - (now - st.deathStart) / 0.5);
    } else {
      if (st.lastState === 'death') { pivot.position.y = spec.upsideDown ? hover + height : hover; st.lastState = null; }
      const hurtEdge = hurt && !st.hurt;
      if (hurtEdge) { oneShot([spec.hurt ?? 'hurt'], now); st.lastState = 'hurt'; }
      else if (spec.phases && phase && phase !== st.intent && profile) {
        if (phase === 'windup') oneShot([spec.phases.windup], now);
        else if (phase === 'lunge') oneShot([spec.phases.lunge], now);
        else oneShot(profile.lunge ? [spec.phases.recover] : [spec.phases.lunge, spec.phases.recover], now);
        st.lastState = 'phase';
      } else if (spec.mage && attacking && !st.attacking) { oneShot([spec.mage.windup], now); st.lastState = 'cast'; }
      else if (spec.mage && !attacking && st.attacking) { oneShot([spec.mage.lunge, spec.mage.recover], now); }
      else if (!spec.phases && !spec.mage && attacking && !st.attacking && spec.attack) { oneShot([spec.attack], now); st.lastState = 'attack'; }
      else if (spec.phases && !profile && attacking && !st.attacking && spec.attack) { oneShot([spec.attack], now); }   // boss / controlled
      else if (spec.cast && casting && !st.casting) { oneShot([spec.cast], now); st.lastState = 'cast'; }   // heroes: off-hand spell
      const busy = advanceQueue(now) || (st.queue.length === 0 && now < st.oneShotUntil);
      if (!busy) {
        let loop = moving ? (spec.walk ?? 'walk') : (spec.idle ?? 'idle');
        if (intent === 'haul' && spec.haul) loop = spec.haul;
        else if (intent === 'collect' && spec.collect) loop = spec.collect;
        else if (intent === 'flee' && spec.flee) loop = spec.flee;
        else if (intent === 'hide' && spec.hide) loop = spec.hide;
        else if (intent === 'investigate' && spec.investigate && !moving) loop = spec.investigate;
        play(loop);
        st.lastState = 'loop';
      }
    }
    st.intent = phase; st.attacking = attacking; st.casting = casting; st.hurt = hurt;
    if (st.ready) st.mixer.update(dt);
  }

  const spriteAnimate = sprite.userData.animate;
  sprite.userData.animate = (args = {}) => { spriteAnimate?.(args); drive(args); };
  const spriteSettle = sprite.userData.settleDeath;
  sprite.userData.settleDeath = (time) => { spriteSettle?.(time); st.settled = true; st.lastState = 'death'; if (st.ready) settle(); };
  const spriteSet = sprite.userData.setAnimation;
  sprite.userData.setAnimation = (name, time, restart) => {
    spriteSet?.(name, time, restart);
    // Telegraph calls (setAnimation('attack', t, true)) on enemies without host phases: start the attack clip.
    if (name === 'attack' && restart && !spec.phases && !spec.mage && spec.attack) oneShot([spec.attack], Number.isFinite(time) ? time : st.lastTime ?? 0);
  };
  const spriteDispose = sprite.userData.disposeMaterials;
  sprite.userData.disposeMaterials = () => {
    spriteDispose?.();
    st.disposed = true;
    st.mixer?.stopAllAction();
    // Geometry, materials and textures are shared through the GLB cache; only the clone (and any near-camera
    // material copies it owns) is dropped.
    for (const m of st.ownedMaterials?.values() ?? []) m.dispose();
    pivot.removeFromParent();
  };
  sprite.userData.modelSpec = spec.model;
  return sprite;
}

// ------------------------------------------------------------------ drop-in factories
export function makeCreature(THREE, options = {}) {
  const sprite = makeSpriteCreature(THREE, options);
  if (!modelsEnabled()) return sprite;
  const kind = MONSTER_CATALOG[options.kind] ? options.kind : 'wraith';
  const spec = ENEMY_MODELS[kind];
  if (!spec) return sprite;
  const height = options.height ?? MONSTER_CATALOG[kind].height / 1.4;
  const hover = (MONSTER_CATALOG[kind].hover ?? 0) * height / MONSTER_CATALOG[kind].height;
  // Same root-relative factor the sprite uses (catalog height / 1.4 under a 1.4 root scale).
  const modelHeight = spec.standingHeight ? spec.standingHeight * height / MONSTER_CATALOG[kind].height : height;
  return attachModel(THREE, sprite, spec, {height: modelHeight, hover, enemyType: kind});
}

export function makePlayerSprite(THREE, options = {}) {
  const sprite = makeSpritePlayer(THREE, options);
  if (!modelsEnabled()) return sprite;
  const spec = PLAYER_MODELS[sprite.userData.classId] ?? PLAYER_MODELS.player;
  return attachModel(THREE, sprite, spec, {height: Number.isFinite(options.height) ? options.height : 1.7, nearCull: true});
}
