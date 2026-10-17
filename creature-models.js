import { batchStaticGroup } from './mesh-batch.js?v=f414c9209e497cfc5d04552110a70457733840b0';

/** Small, -Z facing monsters. Owns geometry; materials belong to mat's cache.
 * animate takes absolute seconds and never changes the returned root transform.
 */
export function makeCreature(THREE, { kind = 'skeleton', mat, box, seed = 0 } = {}) {
  const goblin = kind === 'goblin';
  const root = new THREE.Group();
  root.name = goblin ? 'crypt-goblin' : 'crypt-skeleton';
  const rig = new THREE.Group();
  root.add(rig);
  const torso = new THREE.Group();
  torso.name = 'static-torso-and-head';
  rig.add(torso);
  let hash = 2166136261;
  for (const c of String(seed)) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  const phase = (hash >>> 0) / 4294967296 * Math.PI * 2;
  const bone = mat('creatureAgedBone', 0xa29b7f, { roughness: 0.96 });
  const skin = mat('creatureGoblinSkin', 0x536247, { roughness: 0.93 });
  const leather = mat('creatureOldLeather', 0x42352d, { roughness: 0.96 });
  const steel = mat('creatureBatteredIron', 0x606567, { metalness: 0.65, roughness: 0.72 });
  const dark = mat('creatureDeepSockets', 0x141713, { roughness: 1 });
  const eyes = mat('creatureRedEyes', 0xa33721, { emissive: 0xd52b0d, emissiveIntensity: 1.5, roughness: 0.7 });
  const tooth = mat('creatureTeeth', 0xb6ac8d, { roughness: 0.93 });
  const bodyMaterial = goblin ? skin : bone;
  function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
    const item = new THREE.Mesh(geometry, material);
    item.position.set(x, y, z);
    item.userData.ownGeometry = true;
    item.castShadow = item.receiveShadow = true;
    parent.add(item);
    return item;
  }
  function oval(parent, x, y, z, sx, sy, sz, material, segments = 8) {
    const item = mesh(parent, new THREE.SphereGeometry(1, segments, 5), material, x, y, z);
    item.scale.set(sx, sy, sz);
    return item;
  }
  function block(parent, x, y, z, w, h, d, material) {
    // box uses an app-owned shared geometry, which batchStaticGroup preserves.
    return box(parent, x, y, z, w, h, d, material);
  }
  function tube(parent, points, radius, material) {
    const path = new THREE.CurvePath();
    for (let i = 1; i < points.length; i++) path.add(new THREE.LineCurve3(new THREE.Vector3(...points[i - 1]), new THREE.Vector3(...points[i])));
    return mesh(parent, new THREE.TubeGeometry(path, points.length + 1, radius, 4, false), material);
  }
  function ear(sign) {
    const vertices = [sign * 0.13, 1.04, -0.07, sign * 0.33, 1.13, 0.015, sign * 0.15, 0.98, 0.035, sign * 0.16, 1.06, 0.07];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(sign > 0 ? [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3] : [0, 1, 2, 0, 3, 1, 0, 2, 3, 1, 3, 2]);
    geometry.computeVertexNormals();
    mesh(torso, geometry, skin);
  }
  if (goblin) {
    // Hunched shoulder mass, tapered leather cuirass and overlapping iron plates.
    oval(torso, 0, 0.77, 0.055, 0.2, 0.19, 0.14, skin);
    const cuirass = mesh(torso, new THREE.CylinderGeometry(0.18, 0.13, 0.27, 7), leather, 0, 0.69, 0);
    cuirass.scale.z = 0.74;
    for (let i = 0; i < 3; i++) {
      const plate = block(torso, (i % 2 ? -1 : 1) * 0.012, 0.64 + i * 0.065, -0.11, 0.26 - i * 0.025, 0.075, 0.045, steel);
      plate.rotation.z = (i - 1) * 0.05;
    }
    block(torso, 0, 0.56, 0, 0.29, 0.07, 0.19, leather);
    block(torso, 0, 0.56, -0.108, 0.055, 0.05, 0.025, steel);
    // Forward-set cranium, pronounced muzzle, long nose and swept pointed ears.
    oval(torso, 0, 1.035, -0.065, 0.18, 0.153, 0.142, skin);
    oval(torso, 0, 0.955, -0.163, 0.122, 0.063, 0.07, skin, 6);
    const nose = mesh(torso, new THREE.ConeGeometry(0.043, 0.115, 5), skin, 0, 1.007, -0.222);
    nose.rotation.x = -Math.PI / 2;
    for (const sign of [-1, 1]) {
      ear(sign);
      const brow = oval(torso, sign * 0.076, 1.067, -0.184, 0.088, 0.033, 0.035, skin, 6);
      brow.rotation.z = sign * 0.25;
      oval(torso, sign * 0.07, 1.035, -0.196, 0.047, 0.027, 0.017, dark, 6);
      oval(torso, sign * 0.07, 1.036, -0.211, 0.018, 0.014, 0.008, eyes, 6);
      const fang = mesh(torso, new THREE.ConeGeometry(0.016, 0.07, 4), tooth, sign * 0.074, 0.955, -0.222);
      fang.rotation.z = sign * 0.16;
    }
    block(torso, 0, 0.939, -0.218, 0.125, 0.013, 0.014, dark);
    // Asymmetric battered pauldron makes the silhouette readable from behind.
    const shoulder = mesh(torso, new THREE.SphereGeometry(0.105, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), steel, -0.205, 0.815, 0.015);
    shoulder.scale.y = 0.65;
  } else {
    // Open ribs curl from a visible vertebral column to the sternum.
    for (let i = 0; i < 6; i++) oval(torso, 0, 0.55 + i * 0.061, 0.067, 0.035, 0.028, 0.035, bone, 6);
    for (let row = 0; row < 4; row++) for (const sign of [-1, 1]) {
      const y = 0.64 + row * 0.057, width = 0.105 + Math.sin(row / 3 * Math.PI) * 0.035;
      tube(torso, [[0, y + 0.017, 0.066], [sign * width, y + 0.008, 0.035], [sign * width, y - 0.018, -0.055], [sign * width * 0.58, y - 0.037, -0.105], [0, y - 0.03, -0.105]], 0.014, bone);
    }
    block(torso, 0, 0.725, -0.108, 0.026, 0.21, 0.025, bone);
    for (const sign of [-1, 1]) {
      tube(torso, [[0, 0.848, 0.025], [sign * 0.09, 0.866, 0], [sign * 0.2, 0.835, 0]], 0.018, bone);
      tube(torso, [[sign * 0.055, 0.577, 0.025], [sign * 0.13, 0.555, 0], [sign * 0.12, 0.488, -0.025], [sign * 0.04, 0.49, -0.02], [0, 0.527, 0.025]], 0.023, bone);
    }
    oval(torso, 0, 0.929, 0.015, 0.035, 0.05, 0.035, bone, 6);
    oval(torso, 0, 1.077, 0.005, 0.126, 0.127, 0.107, bone);
    // Separate narrow jaw and cheekbones avoid a cuboid skull silhouette.
    oval(torso, 0, 0.976, -0.025, 0.085, 0.033, 0.073, bone, 6);
    block(torso, 0, 1.005, -0.084, 0.106, 0.029, 0.022, dark);
    for (const sign of [-1, 1]) {
      oval(torso, sign * 0.091, 1.027, -0.055, 0.037, 0.044, 0.045, bone, 6);
      oval(torso, sign * 0.051, 1.068, -0.094, 0.045, 0.045, 0.02, dark, 6);
      oval(torso, sign * 0.051, 1.068, -0.113, 0.013, 0.014, 0.007, eyes, 6);
    }
    const nasal = mesh(torso, new THREE.ConeGeometry(0.022, 0.046, 3), dark, 0, 1.027, -0.102);
    nasal.rotation.z = Math.PI;
    for (let i = 0; i < 5; i++) block(torso, (i - 2) * 0.02, 0.997, -0.101, 0.012, 0.019, 0.011, bone);
  }
  // Only the torso/head is merged. Pivots and every limb mesh stay separate.
  batchStaticGroup(THREE, torso);
  const limbs = [];
  const pivot = (parent, name, x, y, z) => {
    const g = new THREE.Group(); g.name = name; g.position.set(x, y, z);
    g.userData.dynamic = true;
    parent.add(g);
    return g;
  };
  function boneSegment(parent, length, radius, material) {
    return mesh(parent, new THREE.CylinderGeometry(radius * 0.78, radius, length, 6), material, 0, -length / 2, 0);
  }
  for (const sign of [-1, 1]) {
    const leg = pivot(rig, `hip-${sign}`, sign * (goblin ? 0.112 : 0.09), 0.49, 0.015);
    boneSegment(leg, 0.21, goblin ? 0.052 : 0.028, goblin ? leather : bone);
    const knee = pivot(leg, `knee-${sign}`, 0, -0.21, 0);
    boneSegment(knee, 0.205, goblin ? 0.04 : 0.024, bodyMaterial);
    const foot = oval(knee, 0, -0.218, -0.035, goblin ? 0.061 : 0.045, 0.04, 0.09, goblin ? leather : bone, 6);
    foot.name = `foot-${sign}`;
    const arm = pivot(rig, `shoulder-${sign}`, sign * (goblin ? 0.22 : 0.205), 0.825, 0);
    boneSegment(arm, 0.19, goblin ? 0.046 : 0.024, bodyMaterial);
    const elbow = pivot(arm, `elbow-${sign}`, 0, -0.19, 0);
    boneSegment(elbow, 0.18, goblin ? 0.035 : 0.02, bodyMaterial);
    oval(elbow, 0, -0.19, 0, 0.032, 0.04, 0.034, bodyMaterial, 6);
    limbs.push({ sign, leg, knee, arm, elbow });
    if (sign === 1) {
      // A notched blade with integral tang/guard keeps the weapon to one draw.
      const shape = new THREE.Shape();
      const length = goblin ? 0.28 : 0.41;
      const outline = [[-0.014, -0.09], [0.014, -0.09], [0.014, -0.012], [0.075, -0.012], [0.075, 0.01], [0.031, 0.01], [0.032, length * 0.5], [0.016, length * 0.56], [0.03, length * 0.62], [0.017, length * 0.86], [0, length], [-0.029, length * 0.8], [-0.032, 0.01], [-0.075, 0.01], [-0.075, -0.012], [-0.014, -0.012]];
      outline.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
      shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.016, bevelEnabled: false });
      geometry.translate(0, 0, -0.008);
      const weapon = mesh(elbow, geometry, steel, 0, -0.19, -0.028);
      weapon.rotation.x = -0.8;
      weapon.name = 'battered-blade';
    } else if (!goblin) {
      const shield = mesh(elbow, new THREE.CylinderGeometry(0.145, 0.16, 0.028, 7), steel, -0.015, -0.105, -0.055);
      shield.rotation.x = Math.PI / 2;
      shield.scale.z = 1.15;
      shield.name = 'battered-buckler';
    }
  }
  root.userData.animate = ({ time = 0, moving = false, attacking = false } = {}) => {
    time = Number.isFinite(time) ? time : 0;
    const walk = moving ? 1 : 0;
    const stride = Math.sin(time * (goblin ? 8 : 6.5) + phase) * walk;
    // Numeric attacking is normalized attack progress; true loops a windup/strike.
    const progress = typeof attacking === 'number' ? Math.max(0, Math.min(1, Number.isFinite(attacking) ? attacking : 0)) : ((time % 0.9 + 0.9) % 0.9) / 0.9;
    const attack = attacking ? 1 : 0;
    const windup = progress < 0.4 ? progress / 0.4 : Math.max(0, 1 - (progress - 0.4) / 0.22);
    const follow = progress > 0.4 ? Math.sin(Math.min(1, (progress - 0.4) / 0.6) * Math.PI) : 0;
    rig.position.y = Math.abs(stride) * 0.016;
    torso.rotation.x = (goblin ? 0.05 : 0) + Math.sin(time * 1.7 + phase) * 0.012 - follow * attack * 0.09;
    torso.rotation.y = stride * 0.035 - windup * attack * 0.15;
    for (const limb of limbs) {
      const s = limb.sign;
      limb.leg.rotation.x = stride * s * 0.34;
      limb.leg.rotation.z = goblin ? -s * 0.07 : 0;
      limb.knee.rotation.x = -Math.max(0, -stride * s) * 0.48;
      limb.arm.rotation.z = -s * (goblin ? 0.15 : 0.085);
      limb.arm.rotation.x = -stride * s * 0.26 - 0.08;
      limb.elbow.rotation.x = -0.18 - Math.max(0, stride * s) * 0.14;
      if (s === 1 && attack) {
        limb.arm.rotation.x = -0.18 - windup * 1.65 + follow * 0.8;
        limb.arm.rotation.z = -0.15 - windup * 0.28;
        limb.elbow.rotation.x = -0.18 - windup * 0.8;
      }
    }
  };
  root.userData.animate({ time: 0 });
  return root;
}
