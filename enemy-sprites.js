import { decodeEnemyAtlas } from './enemy-atlas-data.js?v=4bd264fda816e55230532703e5373771ce7389ce';

export const ENEMY_SPRITE_CLIPS = Object.freeze({
  idle: { row: 0, frames: 4, fps: 4, loop: true },
  walk: { row: 1, frames: 8, fps: 10, loop: true },
  attack: { row: 2, frames: 8, fps: 12, loop: false },
  hurt: { row: 3, frames: 4, fps: 12, loop: false },
  death: { row: 4, frames: 8, fps: 10, loop: false },
});
const caches = new WeakMap();
function acquire(THREE, kind) {
  let cache = caches.get(THREE);
  if (!cache) { cache = new Map(); caches.set(THREE, cache); }
  let entry = cache.get(kind);
  if (!entry) {
    const { data, width, height } = decodeEnemyAtlas(kind);
    // Explicit bottom-up rows avoid relying on browser unpack-flip behavior
    // for typed-array textures. The packed PNG/data decoder uses top-down rows.
    const bottomUp = new Uint8Array(data.length), stride = width * 4;
    for (let y = 0; y < height; y++) bottomUp.set(data.subarray(y * stride, (y + 1) * stride), (height - 1 - y) * stride);
    const base = new THREE.DataTexture(bottomUp, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
    base.flipY = false;
    base.colorSpace = THREE.SRGBColorSpace;
    base.magFilter = base.minFilter = THREE.NearestFilter;
    base.generateMipmaps = false;
    base.wrapS = base.wrapT = THREE.ClampToEdgeWrapping;
    base.needsUpdate = true;
    entry = { base, refs: 0 };
    cache.set(kind, entry);
  }
  entry.refs++;
  const map = entry.base.clone();
  map.name = `${kind}-enemy-atlas`;
  map.repeat.set(1 / 8, 1 / 5);
  map.needsUpdate = true;
  let released = false;
  return { map, release() {
    if (released) return;
    released = true;
    map.dispose();
    if (--entry.refs === 0) { entry.base.dispose(); cache.delete(kind); }
  } };
}

/** PixelLab art, CPU-backed DataTexture: works in browser and headless Node.
 * One draw per enemy, upright cylindrical camera-facing billboard, feet at y=0.
 * Caller owns root movement/heading/scale and geometry cleanup.
 */
export function makeEnemySprite(THREE, { kind = 'skeleton', height = 1.7, seed = 0 } = {}) {
  kind = kind === 'goblin' ? 'goblin' : 'skeleton';
  height = Number.isFinite(height) ? Math.max(0.1, Math.min(8, height)) : 1.7;
  const root = new THREE.Group();
  root.name = `${kind}-sprite-enemy`;
  const billboard = new THREE.Group();
  billboard.name = 'enemy-billboard';
  root.add(billboard);
  const { map, release } = acquire(THREE, kind);
  const material = new THREE.MeshBasicMaterial({ map, alphaTest: 0.5, transparent: false,
    depthTest: true, depthWrite: true, fog: true, side: THREE.DoubleSide, toneMapped: false });
  const planeHeight = height * 128 / 104;
  const geometry = new THREE.PlaneGeometry(planeHeight, planeHeight);
  geometry.translate(0, planeHeight * (120 / 128 - 0.5), 0);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'enemy-sprite-cutout';
  mesh.userData.ownGeometry = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  billboard.add(mesh);
  const cameraPosition = new THREE.Vector3(), location = new THREE.Vector3();
  const parentRotation = new THREE.Quaternion(), facing = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 1, 0);
  function faceCamera(camera) {
    if (!camera?.getWorldPosition) return;
    camera.getWorldPosition(cameraPosition);
    root.getWorldPosition(location);
    root.getWorldQuaternion(parentRotation);
    const dx = cameraPosition.x - location.x, dz = cameraPosition.z - location.z;
    if (dx * dx + dz * dz < 1e-12) return;
    facing.setFromAxisAngle(axis, Math.atan2(dx, dz));
    billboard.quaternion.copy(parentRotation).invert().multiply(facing);
    billboard.updateMatrixWorld(true);
  }
  mesh.onBeforeRender = (renderer, scene, camera) => faceCamera(camera);
  let hash = 0;
  for (const c of String(seed)) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) | 0;
  const idlePhase = (hash >>> 0) % 4;
  let state = 'idle', started = 0, lastTime = 0, disposed = false;
  function frame(name, index) {
    const clip = ENEMY_SPRITE_CLIPS[name];
    index = Math.max(0, Math.min(clip.frames - 1, Math.floor(index)));
    map.offset.set(index / 8, 1 - (clip.row + 1) / 5);
    root.userData.spriteState = name;
    root.userData.spriteFrame = index;
  }
  function setAnimation(name, time = lastTime, restart = false) {
    if (!Object.hasOwn(ENEMY_SPRITE_CLIPS, name)) name = 'idle';
    time = Number.isFinite(time) ? time : lastTime;
    if (state !== name || restart) { state = name; started = time; frame(state, 0); }
  }
  root.userData.setAnimation = setAnimation;
  root.userData.faceCamera = faceCamera;
  root.userData.animate = ({ time = 0, moving = false, attacking = false, hurt = false, dead = false, state: requested, camera } = {}) => {
    time = Number.isFinite(time) ? time : lastTime;
    if (time < lastTime) started = time;
    lastTime = time;
    const previous = ENEMY_SPRITE_CLIPS[state];
    const finished = !previous.loop && time - started >= previous.frames / previous.fps;
    if (requested) setAnimation(requested, time);
    else if (dead) setAnimation('death', time);
    else if (state !== 'death') {
      if (hurt) setAnimation('hurt', time, state === 'hurt' && finished);
      else if ((state !== 'attack' && state !== 'hurt') || finished) {
        const next = attacking ? 'attack' : moving ? 'walk' : 'idle';
        setAnimation(next, time, state === next && finished);
      }
    }
    const clip = ENEMY_SPRITE_CLIPS[state];
    const elapsed = Math.max(0, time - started);
    let index = Math.floor(elapsed * clip.fps);
    if (clip.loop) index = (index + (state === 'idle' ? idlePhase : 0)) % clip.frames;
    else if (index >= clip.frames && state !== 'death') { setAnimation(moving ? 'walk' : 'idle', time); index = 0; }
    frame(state, index);
    if (camera) faceCamera(camera);
  };
  root.userData.disposeMaterials = () => {
    if (disposed) return;
    disposed = true;
    material.dispose();
    release();
  };
  frame('idle', idlePhase);
  return root;
}

// Convenient replacement for a previous makeCreature import; default local
// art height 1.2m matches an integrating game's existing root scale of 1.4.
export function makeCreature(THREE, options = {}) {
  return makeEnemySprite(THREE, { height: 1.2, ...options });
}
