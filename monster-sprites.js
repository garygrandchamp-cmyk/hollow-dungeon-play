import { decodeMonsterAtlas } from './monster-atlas-data.js?v=1908281481c3818581fa62f1b68e946e615fba61';
import { makeEnemySprite } from './enemy-sprites.js?v=1908281481c3818581fa62f1b68e946e615fba61';

export const MONSTER_SPRITE_CLIPS = Object.freeze({
  idle: { row: 0, frames: 4, fps: 4, loop: true },
  walk: { row: 1, frames: 4, fps: 10, loop: true },
  attack: { row: 2, frames: 4, fps: 12, loop: false },
  hurt: { row: 3, frames: 4, fps: 12, loop: false },
  death: { row: 4, frames: 4, fps: 10, loop: false },
});

export const MONSTER_CATALOG = Object.freeze({
  skeleton: {name:'Skeleton',height:1.7,hp:2,speed:1.1,damage:8},
  goblin: {name:'Crypt goblin',height:1.7,hp:3,speed:1.6,damage:8},
  wraith: {name:'Wraith',height:1.9,hp:4,speed:1.4,damage:11},
  spider: {name:'Giant spider',height:.85,hp:3,speed:2,damage:7},
  slime: {name:'Sewer slime',height:.75,hp:5,speed:.65,damage:6},
  rat: {name:'Giant rat',height:.4,hp:2,speed:2.1,damage:5},
  bat: {name:'Cave bat',height:.55,hp:2,speed:2.3,damage:5,hover:.8},
  crawler: {name:'Crawling skeleton',height:.6,hp:3,speed:.75,damage:8},
  'skeletal-mage': {name:'Skeletal mage',height:1.8,hp:4,speed:.85,damage:10},
  drowned: {name:'Drowned',height:1.75,hp:6,speed:.7,damage:10},
});
export const MONSTER_KINDS = Object.freeze(Object.keys(MONSTER_CATALOG));

const caches = new WeakMap();
function acquire(THREE, kind) {
  let cache = caches.get(THREE);
  if (!cache) { cache = new Map(); caches.set(THREE, cache); }
  let entry = cache.get(kind);
  if (!entry) {
    const { data, width, height, standingPixels } = decodeMonsterAtlas(kind);
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
    entry = { base, refs: 0, standingPixels };
    cache.set(kind, entry);
  }
  entry.refs++;
  const map = entry.base.clone();
  map.name = `${kind}-enemy-atlas`;
  map.repeat.set(1 / 8, 1 / 5);
  map.needsUpdate = true;
  let released = false;
  return { map, standingPixels: entry.standingPixels, release() {
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
export function makeMonsterSprite(THREE, { kind = 'wraith', height, seed = 0 } = {}) {
  if (kind === 'skeleton' || kind === 'goblin') return makeEnemySprite(THREE, { kind, height: height ?? 1.7, seed });
  kind = ['wraith','spider','slime','rat','bat','crawler','skeletal-mage','drowned'].includes(kind) ? kind : 'wraith';
  height = height ?? MONSTER_CATALOG[kind].height;
  height = Number.isFinite(height) ? Math.max(0.1, Math.min(8, height)) : 1.7;
  const root = new THREE.Group();
  root.name = `${kind}-sprite-enemy`;
  const billboard = new THREE.Group();
  billboard.name = 'enemy-billboard';
  root.add(billboard);
  const { map, release, standingPixels } = acquire(THREE, kind);
  const material = new THREE.MeshBasicMaterial({ map, alphaTest: 0.5, transparent: false,
    depthTest: true, depthWrite: true, fog: true, side: THREE.DoubleSide, toneMapped: false });
  const planeHeight = height * 128 / standingPixels;
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
    const clip = MONSTER_SPRITE_CLIPS[name];
    index = Math.max(0, Math.min(clip.frames - 1, Math.floor(index)));
    map.offset.set(index / 8, 1 - (clip.row + 1) / 5);
    root.userData.spriteState = name;
    root.userData.spriteFrame = index;
  }
  function setAnimation(name, time = lastTime, restart = false) {
    if (!Object.hasOwn(MONSTER_SPRITE_CLIPS, name)) name = 'idle';
    time = Number.isFinite(time) ? time : lastTime;
    if (state !== name || restart) { state = name; started = time; frame(state, 0); }
  }
  root.userData.setAnimation = setAnimation;
  root.userData.faceCamera = faceCamera;
  root.userData.animate = ({ time = 0, moving = false, attacking = false, hurt = false, dead = false, state: requested, camera } = {}) => {
    time = Number.isFinite(time) ? time : lastTime;
    if (time < lastTime) started = time;
    lastTime = time;
    const previous = MONSTER_SPRITE_CLIPS[state];
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
    const clip = MONSTER_SPRITE_CLIPS[state];
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


// Drop-in game factory: existing enemy roots are scaled by1.4 in game.build.
export function makeCreature(THREE, options = {}) {
  const kind = MONSTER_KINDS.includes(options.kind) ? options.kind : 'wraith';
  return makeMonsterSprite(THREE, {...options, kind, height: options.height ?? MONSTER_CATALOG[kind].height / 1.4});
}
