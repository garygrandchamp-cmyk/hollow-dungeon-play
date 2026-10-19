// Experimental 3D first-person view model (behind the same toggle as model-actors.js).
//
// The adventurer's own GLB is parented to the first-person camera with its rest eye at the camera origin and
// its head collapsed. Only the arm chains animate: the fp_* clips (Models/Rigged_ARP/animation_manifest.json)
// are split at load into right-arm and left-arm halves, so the weapon hand and the off hand run independently.
// The 2D held sprites keep every bit of state (layout, torch fuel and light, magic theme); their materials are
// only hidden once the model has loaded, and they come back if it fails or is disposed.
import {PLAYER_MODELS, loadPlayerModel, modelTools} from './model-actors.js?v=84fc371936953c752f7d36674575129dbb0d8ea1';

// Weapon kind (item.kind before loadout-equipment's sprite remap) -> clip family.
const FAMILY = {sword: 'sword', axe: 'heavy', mace: 'heavy', hammer: 'heavy', dagger: 'dagger', staff: 'staff', wand: 'staff', bow: 'bow'};
// Prop mesh per held item: matched on the class's own model first, else borrowed from the listed model.
const PROPS = {
  sword: [/_Sword$/, 'Knight', 'Knight_Sword'], heavy: [/_Axe$/, 'Barbarian', 'Barbarian_Axe'],
  dagger: [/_Dagger_R$/, 'Rogue', 'Rogue_Dagger_R'], staff: [/_Staff$/, 'Wizard', 'Wizard_Staff'],
  bow: [/_Bow$/, 'Ranger', 'Ranger_Bow'], shield: [/_Shield$/, 'Knight', 'Knight_Shield'], torch: [/^Offhand_Torch/, 'Knight', 'Offhand_Torch'],
};
const ATTACK = {sword: 'fp_r_attack_sword', heavy: 'fp_r_attack_heavy', dagger: 'fp_r_attack_dagger', staff: 'fp_r_attack_staff', bow: 'fp_bow_shoot'};
// The model is shrunk about the eye so it reads the same on screen but stays close enough to the
// camera not to push weapons through nearby walls (near plane is 0.1).
const VIEW_SCALE = 0.5;
const FADE = 0.12;
// The camera lantern sits among the arms, and the 0.5x shrink halves their distance to it (about 4x the light), so
// view-model materials scale direct light down and then cap its peak. Emissive glow (torch, spell) is unaffected.
const DIRECT_LIGHT_SCALE = 0.3, DIRECT_LIGHT_CAP = 0.16;
// Close-up gear uses 2x texel density (128 texels/metre, like the 128-px HUD hand art). slim_glb.py writes these
// next to the 64 texels/metre world textures; if one is missing the world texture stays.
const fpTextures = new Map();
function fpTexture(THREE, name) {
  if (!fpTextures.has(name)) {
    fpTextures.set(name, new THREE.TextureLoader().loadAsync(new URL(`./assets/models/fp/${name}.png`, import.meta.url).href).then((t) => {
      t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapNearestFilter;
      t.name = name; return t;
    }).catch(() => null));
  }
  return fpTextures.get(name);
}
function viewModelMaterial(THREE, source, owned) {
  const m = source.clone();
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      reflectedLight.directDiffuse *= ${DIRECT_LIGHT_SCALE.toFixed(3)}; reflectedLight.directSpecular *= ${DIRECT_LIGHT_SCALE.toFixed(3)};
      {
        // Scale (not clamp) so hue survives: only the brightest channel is held to the cap.
        float fpPeak = max(max(reflectedLight.directDiffuse.r, reflectedLight.directDiffuse.g), reflectedLight.directDiffuse.b);
        if (fpPeak > ${DIRECT_LIGHT_CAP.toFixed(3)}) { float k = ${DIRECT_LIGHT_CAP.toFixed(3)} / fpPeak; reflectedLight.directDiffuse *= k; reflectedLight.directSpecular *= k; }
      }`);
  };
  m.customProgramCacheKey = () => 'fp-view-model';
  owned.push(m);
  const name = source.map?.name;
  if (name) fpTexture(THREE, name).then((t) => { if (t && !m.userData.disposed) { m.map = t; m.needsUpdate = true; } });
  return m;
}
function adoptMaterials(THREE, mesh, owned, cache) {
  const swap = (src) => { if (!src) return src; if (!cache.has(src)) cache.set(src, viewModelMaterial(THREE, src, owned)); return cache.get(src); };
  mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
}

function propRoot(o) {
  const p = o.parent;
  return p && !p.isBone && p.type === 'Group' && p.name && o.name.startsWith(p.name) ? p : o;
}
function armBones(hand) {
  let top = hand;
  while (top.parent?.isBone && !/spine|neck|root/.test(top.parent.name)) top = top.parent;
  const out = new Set();
  top.traverse((b) => { if (b.isBone) out.add(b.name); });
  return out;
}

export function attachFirstPersonModel(THREE, equipment, actor = {}, getKind = () => 'sword') {
  const spec = PLAYER_MODELS[actor.classId] ?? PLAYER_MODELS.player;
  const holder = new THREE.Group(); holder.name = 'fp-model';
  const pivot = new THREE.Group(); holder.add(pivot);
  const state = {ready: false, error: null, family: null, left: null, attacking: false, casting: false, blocking: false, lit: null};
  let model = null, mixer = null, clips = null, bones = null, props = new Map(), disposed = false, lastTime = null;
  const actions = {r: null, l: null};
  const hidden = new Set();
  const ownedMaterials = [], materialCache = new Map();

  function sprites() { return [equipment.right, equipment.leftShield, equipment.leftMagic, equipment.leftTorch].filter(Boolean); }
  function hideSprites() {
    for (const root of sprites()) root.traverse((o) => {
      for (const m of [o.material].flat()) if (m && m.visible !== false) { m.visible = false; hidden.add(m); }
    });
  }
  function restoreSprites() { for (const m of hidden) m.visible = true; hidden.clear(); }

  function play(side, name, once = false) {
    const clip = clips?.[side]?.[name];
    if (!clip) return false;
    const prev = actions[side], next = mixer.clipAction(clip);
    if (prev === next && !once) return true;
    next.reset(); next.enabled = true; next.setEffectiveWeight(1);
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity); next.clampWhenFinished = once;
    next.userData = {once};
    if (prev && prev !== next) next.crossFadeFrom(prev, FADE, false);
    next.play(); actions[side] = next;
    return true;
  }
  function rightIdle() { return state.family === 'bow' ? 'fp_bow_idle' : 'fp_r_idle_' + state.family; }
  function leftIdle() {
    if (state.family === 'bow') return 'fp_bow_idle';
    if (state.left === 'shield') return state.blocking ? 'fp_l_guard' : 'fp_l_idle_shield';
    if (state.left === 'magic') return 'fp_l_idle_magic';
    if (state.left === 'torch') return 'fp_l_idle_torch';
    return null;
  }
  function settle(side) {
    const name = side === 'r' ? rightIdle() : leftIdle();
    if (name) { play(side, name); return; }
    // Empty off hand: drop the arm out of view (the lowered key of the swap clip).
    if (play('l', 'fp_l_swap', true)) { actions.l.time = 0.2; actions.l.paused = true; }
  }

  function showProps() {
    const want = new Set([state.family === 'bow' ? 'bow' : state.family]);
    if (state.family !== 'bow' && (state.left === 'shield' || state.left === 'torch')) want.add(state.left);
    for (const [key, obj] of props) if (obj) obj.visible = want.has(key);
  }
  async function ensureProp(key) {
    if (props.has(key)) return;
    props.set(key, null);
    const [pattern, sourceModel, sourceName] = PROPS[key];
    let own = null;
    model.traverse((o) => { if (!own && o.isMesh && pattern.test(propRoot(o).name)) own = propRoot(o); });
    if (own) { props.set(key, own); showProps(); return; }
    const gltf = await loadPlayerModel(THREE, sourceModel);
    if (disposed) return;
    let src = null;
    gltf.scene.traverse((o) => { if (!src && o.name === sourceName) src = o; });
    if (!src) { props.delete(key); return; }
    const group = new THREE.Group(); group.name = 'fp-borrowed-' + sourceName;
    src.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const mesh = new THREE.SkinnedMesh(o.geometry, o.material);
      const mapped = o.skeleton.bones.map((b) => bones.get(b.name));
      if (mapped.some((b) => !b)) return;
      mesh.bind(new THREE.Skeleton(mapped, o.skeleton.boneInverses.map((m) => m.clone())), o.bindMatrix.clone());
      mesh.name = group.name + '_' + group.children.length; mesh.frustumCulled = false; mesh.renderOrder = 900;
      adoptMaterials(THREE, mesh, ownedMaterials, materialCache); group.add(mesh);
    });
    model.add(group); props.set(key, group); showProps();
  }
  function hideUnusedProps() {
    model.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const root = propRoot(o);
      if (root.name === spec.model) return;
      if (![...props.values()].includes(root)) root.visible = false;
    });
  }

  // Party view only flips the held sprites on while it renders the selected actor's viewport, so read the
  // off hand from the actor the way party-view.js does; solo play keeps the sprites' visibility current.
  function offhand() {
    const value = actor.leftHand ?? actor.offhand ?? actor.equipment?.offhand?.id;
    if (value != null) { const kind = typeof value === 'object' ? value?.id : value; return ['magic', 'torch'].includes(kind) ? kind : 'shield'; }
    return equipment.leftShield?.visible ? 'shield' : equipment.leftMagic?.visible ? 'magic' : equipment.leftTorch?.visible ? 'torch' : null;
  }
  // Mirror the weapon hand's visibility (hosts toggle it per viewport, right before rendering).
  const right = equipment.right;
  let rightVisible = right.visible;
  Object.defineProperty(right, 'visible', {configurable: true, enumerable: true, get: () => rightVisible, set: (v) => { rightVisible = v; holder.visible = !!v && !state.error; }});
  holder.visible = !!rightVisible;

  function refresh() {
    const family = FAMILY[getKind()] ?? 'sword';
    const left = offhand();
    if (family === state.family && left === state.left) return;
    const swapped = state.left !== null && left !== state.left && family !== 'bow';
    state.family = family; state.left = left;
    for (const k of family === 'bow' ? [family] : [family, left]) if (k && PROPS[k]) ensureProp(k).catch(() => props.delete(k));
    hideUnusedProps(); showProps();
    if (!actions.r?.userData?.once || family === 'bow') settle('r');
    if (swapped && left) play('l', 'fp_l_swap', true); else settle('l');
  }

  loadPlayerModel(THREE, spec.model).then(async (gltf) => {
    if (disposed) return;
    const {SkeletonUtils} = await modelTools();
    model = SkeletonUtils.clone(gltf.scene);
    bones = new Map();
    model.traverse((o) => { if (o.isBone) bones.set(o.name, o); if (o.isMesh) { o.frustumCulled = false; o.renderOrder = 900; adoptMaterials(THREE, o, ownedMaterials, materialCache); } });
    const handR = bones.get('handr'), handL = bones.get('handl'), head = bones.get('headx');
    if (!handR || !handL || !head) throw new Error('fp model missing arm bones');
    const sets = {r: armBones(handR), l: armBones(handL)};
    clips = {r: {}, l: {}};
    for (const clip of gltf.animations) {
      if (!clip.name.startsWith('fp_')) continue;
      for (const side of ['r', 'l']) {
        const tracks = clip.tracks.filter((t) => sets[side].has(t.name.split('.')[0]));
        clips[side][clip.name] = new THREE.AnimationClip(clip.name + '_' + side, clip.duration, tracks);
      }
    }
    if (!clips.r.fp_r_idle_sword) throw new Error('fp clips missing from ' + spec.model);
    // Rest eye in glTF space (model faces +Z, up +Y); matches the Blender eye camera used to author the clips.
    model.updateMatrixWorld(true);
    let body = null;
    model.traverse((o) => { if (o.isSkinnedMesh && propRoot(o).name === spec.model) body = o; });
    body.geometry.computeBoundingBox();
    const H = body.geometry.boundingBox.max.y - body.geometry.boundingBox.min.y;
    const eye = head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.05 * H, 0.06 * H));
    head.scale.setScalar(0.01);
    pivot.add(model);
    model.rotation.y = Math.PI;
    model.position.set(eye.x, -eye.y, eye.z);
    pivot.scale.setScalar(VIEW_SCALE);
    mixer = new THREE.AnimationMixer(model);
    mixer.addEventListener('finished', ({action}) => {
      if (action === actions.r) settle('r');
      else if (action === actions.l) settle('l');
    });
    state.ready = true;
    refresh();
  }).catch((err) => { state.error = String(err?.message ?? err); state.ready = false; holder.visible = false; restoreSprites(); });

  // Presentation only: a failure here falls back to the 2D held sprites instead of breaking the frame.
  function animate(options) {
    if (disposed || state.error) return;
    try { step(options); } catch (err) { state.error = String(err?.message ?? err); state.ready = false; holder.visible = false; restoreSprites(); }
  }
  function step({time = 0, moving = false, attacking = false, casting = false, blocking = false, torchLit} = {}) {
    const camera = equipment.right?.parent;
    if (camera && holder.parent !== camera) camera.add(holder);
    if (!state.ready) return;
    hideSprites();
    refresh();
    const dt = lastTime === null ? 0 : Math.max(0, Math.min(0.1, (time - lastTime) / 1000));
    lastTime = time;
    if (attacking && !state.attacking) {
      play('r', ATTACK[state.family], true);
      if (state.family === 'bow') play('l', ATTACK.bow, true);
    }
    if (state.family !== 'bow') {
      if (state.left === 'magic' && casting && !state.casting) play('l', 'fp_l_cast', true);
      if (state.left === 'shield' && blocking !== state.blocking) { state.blocking = blocking; if (!actions.l?.userData?.once) settle('l'); }
      const lit = torchLit ?? equipment.torchState?.lit;
      if (state.left === 'torch' && lit && state.lit === false) play('l', 'fp_l_torch_raise', true);
      state.lit = !!lit;
    }
    state.attacking = attacking; state.casting = casting;
    // Procedural walk bob on top of the clips.
    const t = time * 0.001, walk = moving ? 1 : 0;
    pivot.position.set(Math.sin(t * 5.2) * 0.012 * walk, -Math.abs(Math.cos(t * 5.2)) * 0.016 * walk + Math.sin(t * 1.4) * 0.003, 0);
    mixer.update(dt);
  }
  function playInteract() { return state.ready && state.family !== 'bow' && play('r', 'fp_r_interact', true); }
  // Host hook for a hit taken while the shield is raised.
  function playBlockImpact() { return state.ready && state.left === 'shield' && play('l', 'fp_l_block_impact', true); }
  function dispose() {
    if (disposed) return;
    disposed = true; restoreSprites();
    for (const m of ownedMaterials) { m.userData.disposed = true; m.dispose(); } delete right.visible; right.visible = rightVisible; mixer?.stopAllAction(); holder.removeFromParent();
    for (const obj of props.values()) if (obj?.name?.startsWith('fp-borrowed-')) obj.traverse((o) => o.skeleton?.dispose?.());
  }
  const api = {root: holder, animate, playInteract, playBlockImpact, dispose, state, get clip() { return {r: actions.r?.getClip().name ?? null, l: actions.l?.getClip().name ?? null}; }};
  return api;
}
