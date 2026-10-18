import { decodePlayerAtlas } from './player-atlas-data.js?v=b258c395560209e8026ca4d5dec71424998d0de6';
import { decodeClassAtlas } from './class-atlas-data.js?v=b258c395560209e8026ca4d5dec71424998d0de6';
import { decodeClassDirectionAtlas } from './class-direction-data.js?v=b258c395560209e8026ca4d5dec71424998d0de6';

export const PLAYER_SPRITE_CLIPS = Object.freeze({
  idle: { row: 0, frames: 4, fps: 4, loop: true },
  walk: { row: 1, frames: 8, fps: 10, loop: true },
  attack: { row: 2, frames: 8, fps: 12, loop: false },
  hurt: { row: 3, frames: 4, fps: 12, loop: false },
  death: { row: 4, frames: 8, fps: 10, loop: false },
});
const caches = new WeakMap();
export const PLAYER_SPRITE_CLASSES = Object.freeze(['mage','paladin','barbarian','warlock','thief','archer']);
// Keep one bottom-up CPU buffer per atlas even after its last live texture is
// released. GPU sources remain scoped to THREE and are retired at zero users.
const pixelsByClass = new Map();
function atlasPixels(kind) {
  if (pixelsByClass.has(kind)) return pixelsByClass.get(kind);
  const [classId,direction] = kind.split(':');
  const {data,width,height} = direction ? decodeClassDirectionAtlas(classId,direction) : kind === 'player' ? decodePlayerAtlas() : decodeClassAtlas(kind);
  if (width !== 1024 || height !== 640 || !ArrayBuffer.isView(data) || data.length !== width * height * 4) throw new TypeError('Invalid player atlas for ' + kind);
  // Typed-array textures use explicit bottom-up rows in browser and Node.
  const bottomUp = new Uint8Array(data.length), stride = width * 4;
  for (let y = 0; y < height; y++) bottomUp.set(data.subarray(y * stride, (y + 1) * stride), (height - 1 - y) * stride);
  const pixels = {data:bottomUp,width,height}; pixelsByClass.set(kind,pixels); return pixels;
}
function acquire(THREE, kind) {
  let cache = caches.get(THREE);
  if (!cache) { cache = new Map(); caches.set(THREE, cache); }
  let entry = cache.get(kind);
  if (!entry) {
    const { data, width, height } = atlasPixels(kind);
    const base = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
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
  map.name = `${kind}-player-atlas`;
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
 * One draw for the player, upright cylindrical camera-facing billboard, feet at y=0.
 * Caller owns root movement/heading/scale and geometry cleanup.
 */
export function makePlayerSprite(THREE, { height = 1.7, seed = 0, classId } = {}) {
  const requested = typeof classId === 'string' ? classId.trim().toLowerCase() : '';
  const kind = PLAYER_SPRITE_CLASSES.includes(requested) ? requested : 'player';
  height = Number.isFinite(height) ? Math.max(0.1, Math.min(8, height)) : 1.7;
  const root = new THREE.Group();
  root.userData.classId = kind;
  root.name = `${kind}-sprite-adventurer`;
  const billboard = new THREE.Group();
  billboard.name = 'player-billboard';
  root.add(billboard);
  const { map, release } = acquire(THREE, kind);
  const directions = new Map([['front',{map,release}]]);
  let visibleDirection = 'front', mirrored = false;
  const material = new THREE.MeshBasicMaterial({ map, alphaTest: 0.5, transparent: false,
    depthTest: true, depthWrite: true, fog: true, side: THREE.DoubleSide, toneMapped: false });
  const planeHeight = height * 128 / 104;
  const geometry = new THREE.PlaneGeometry(planeHeight, planeHeight);
  geometry.translate(0, planeHeight * (120 / 128 - 0.5), 0);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'player-sprite-cutout';
  mesh.userData.ownGeometry = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  billboard.add(mesh);
  const cameraPosition = new THREE.Vector3(), location = new THREE.Vector3();
  const parentRotation = new THREE.Quaternion(), facing = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 1, 0);
  const worldForward = new THREE.Vector3();
  function faceCamera(camera) {
    if (!camera?.getWorldPosition) return;
    camera.getWorldPosition(cameraPosition);
    root.getWorldPosition(location);
    root.getWorldQuaternion(parentRotation);
    const dx = cameraPosition.x - location.x, dz = cameraPosition.z - location.z;
    if (dx * dx + dz * dz < 1e-12) return;
    // Game actors face local -Z. Compare their world heading with this render
    // camera, independently of the billboard's camera-facing quaternion.
    worldForward.set(0,0,-1).applyQuaternion(parentRotation);
    const horizontal = Math.hypot(worldForward.x,worldForward.z);
    const dot = horizontal > 1e-9 ? (worldForward.x*dx+worldForward.z*dz)/(horizontal*Math.hypot(dx,dz)) : 1;
    visibleDirection = kind === 'player' || state === 'death' ? 'front' : dot > Math.SQRT1_2 ? 'front' : dot < -Math.SQRT1_2 ? 'back' : 'side';
    mirrored = visibleDirection === 'side' && worldForward.x*dz-worldForward.z*dx > 0;
    if (!directions.has(visibleDirection)) directions.set(visibleDirection,acquire(THREE,kind+':'+visibleDirection));
    material.map = directions.get(visibleDirection).map;
    frame(root.userData.spriteState,root.userData.spriteFrame);
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
    const clip = PLAYER_SPRITE_CLIPS[name];
    index = Math.max(0, Math.min(clip.frames - 1, Math.floor(index)));
    // Every sprite owns its UV transforms even when CPU/GPU sources are shared.
    const activeMap = material.map;
    activeMap.repeat.set((mirrored ? -1 : 1) / 8,1/5);
    activeMap.offset.set((index + (mirrored ? 1 : 0)) / 8, 1 - (clip.row + 1) / 5);
    root.userData.spriteState = name;
    root.userData.spriteFrame = index;
    root.userData.spriteFacing = visibleDirection;
    root.userData.spriteMirrored = mirrored;
  }
  function setAnimation(name, time = lastTime, restart = false) {
    if (!Object.hasOwn(PLAYER_SPRITE_CLIPS, name)) name = 'idle';
    time = Number.isFinite(time) ? time : lastTime;
    if (state !== name || restart) {
      state = name; started = time;
      if (state === 'death') { visibleDirection = 'front'; mirrored = false; material.map = map; }
      frame(state, 0);
    }
  }
  root.userData.setAnimation = setAnimation;
  root.userData.faceCamera = faceCamera;
  root.userData.animate = ({ time = 0, moving = false, attacking = false, hurt = false, dead = false, state: requested, camera } = {}) => {
    time = Number.isFinite(time) ? time : lastTime;
    if (time < lastTime) started = time;
    lastTime = time;
    const previous = PLAYER_SPRITE_CLIPS[state];
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
    const clip = PLAYER_SPRITE_CLIPS[state];
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
    for (const entry of directions.values()) entry.release();
  };
  frame('idle', idlePhase);
  return root;
}

