import { batchStaticGroup } from './mesh-batch.js?v=c9a9bc6ffe6f41314b36d0ecab8f6285887953ea';

const finite = (n, fallback) => Number.isFinite(n) ? n : fallback;
function tools(THREE, group, box) {
  function mesh(geometry, material, x = 0, y = 0, z = 0) {
    const item = new THREE.Mesh(geometry, material);
    item.position.set(x, y, z);
    item.userData.ownGeometry = true;
    item.castShadow = item.receiveShadow = true;
    group.add(item);
    return item;
  }
  const block = (x, y, z, w, h, d, material) => box(group, x, y, z, w, h, d, material);
  function line(points, radius, material) {
    if (points.length < 2) return;
    const curve = new THREE.CurvePath();
    for (let i = 1; i < points.length; i++) curve.add(new THREE.LineCurve3(new THREE.Vector3(...points[i - 1]), new THREE.Vector3(...points[i])));
    return mesh(new THREE.TubeGeometry(curve, Math.max(2, points.length * 2), radius, 5, false), material);
  }
  const column = (x, y, z, radius, height, material, top = radius) => mesh(new THREE.CylinderGeometry(top, radius, height, 8), material, x, y, z);
  const spire = (x, y, z, radius, height, material) => mesh(new THREE.ConeGeometry(radius, height, 6), material, x, y, z);
  return { mesh, block, line, column, spire };
}

function finish(THREE, parent, ornament) {
  batchStaticGroup(THREE, ornament);
  parent?.add(ornament);
  return ornament;
}

/** Adds and returns a batched child. Floor-level doors and breached walls stay clear.
 * Coordinates are wall-local; rose X radii compensate for the main wall's X2 scale.
 */
export function addWindowTracery(THREE, { group, params = {}, mat, box } = {}) {
  const ornament = new THREE.Group();
  ornament.name = 'gothic-window-tracery';
  const sill = finite(params.sill, 0), height = finite(params.height, 2.4);
  const width = Math.max(0, finite(params.width, 1.1)), opening = Math.min(finite(params.openingHeight, 1.7), height - sill);
  const offset = finite(params.offset, 0);
  if (params.opening !== 'gothic' || sill < 0.35 || finite(params.ruin, 0) >= 0.82 || opening < 0.65 || width < 0.45 || Math.abs(offset) + width / 2 > 1.2) return finish(THREE, group, ornament);
  const stone = mat('gothicTraceStone', 0x8c8b7c, { roughness: 0.9 });
  const iron = mat('gothicTraceIron', 0x333a36, { metalness: 0.35, roughness: 0.77 });
  const t = tools(THREE, ornament, box);
  const depth = Math.max(0.04, finite(params.thickness, 0.36));
  const z = -depth / 2 - 0.026;
  const y0 = sill + 0.045;
  const stemRadius = Math.min(0.016, width * 0.023);
  // Two pointed lancets, with slender lower uprights rather than a solid grille.
  for (const sign of [-1, 1]) {
    const center = offset + sign * width * 0.225;
    const half = width * 0.182;
    const spring = sill + opening * 0.38, peak = sill + opening * 0.61;
    for (const side of [-1, 1]) {
      t.line([[center + side * half, y0, z], [center + side * half, spring, z]], stemRadius, stone);
      const arc = [];
      for (let i = 0; i <= 10; i++) {
        const u = i / 10;
        arc.push([center + side * half * (1 - u), spring + (peak - spring) * (u * 0.65 + Math.sin(u * Math.PI / 2) * 0.35), z]);
      }
      t.line(arc, stemRadius, stone);
    }
  }
  t.line([[offset, y0, z], [offset, sill + opening * 0.57, z]], stemRadius * 1.1, stone);
  // Circular rose with four open lobes, all real tubes and open centers.
  const r = Math.min(opening * 0.115, width * 0.18);
  const roseY = sill + opening * 0.765;
  function ring(cx, cy, radius, material, thickness) {
    const points = Array.from({ length: 33 }, (_, i) => {
      const a = i / 32 * Math.PI * 2;
      return [cx + Math.cos(a) * radius * 0.5, cy + Math.sin(a) * radius, z];
    });
    t.line(points, thickness, material);
  }
  ring(offset, roseY, r, stone, stemRadius * 0.8);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    ring(offset + Math.cos(a) * r * 0.245, roseY + Math.sin(a) * r * 0.49, r * 0.46, iron, stemRadius * 0.43);
  }
  return finish(THREE, group, ornament);
}

/** Adds and returns a batched room-local child. Width/depth are world meters.
 * Landmarks sit toward the far (-Z) wall, leaving the room origin open.
 */
export function addRoomLandmark(THREE, { group, theme = 'crypt', width = 9.6, depth = 9.6, mat, box, seed = 0 } = {}) {
  const ornament = new THREE.Group();
  ornament.name = `room-landmark-${theme}`;
  width = Math.max(2.4, finite(width, 9.6));
  depth = Math.max(2.4, finite(depth, 9.6));
  const size = Math.max(0.2, Math.min(1.25, (width - 0.7) / 4, (depth - 0.7) / 7));
  const t = tools(THREE, ornament, box);
  const stone = mat('landmarkStone', 0x77786e, { roughness: 0.94 });
  const trim = mat('landmarkTrim', 0x929281, { roughness: 0.88 });
  const wood = mat('landmarkWood', 0x47382a, { roughness: 0.91 });
  const metal = mat('landmarkIron', 0x363c3d, { metalness: 0.6, roughness: 0.6 });
  const gold = mat('landmarkBronze', 0x8d7851, { metalness: 0.65, roughness: 0.54 });
  let hash = 0;
  for (const char of String(seed)) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  const cloth = mat(`landmarkBanner${(hash >>> 0) % 3}`, [0x573b3b, 0x374b48, 0x4c4058][(hash >>> 0) % 3], { side: THREE.DoubleSide, roughness: 1 });
  if (theme === 'crypt') {
    t.block(0, 0.09, 0, 3.0, 0.18, 1.65, stone);
    t.block(0, 0.24, 0, 2.45, 0.16, 1.23, trim);
    for (const x of [-0.8, 0.8]) for (const z of [-0.32, 0.32]) t.column(x, 0.56, z, 0.105, 0.6, stone, 0.075);
    t.block(0, 0.88, 0, 2.25, 0.18, 0.96, trim);
    // Open reliquary cage, slender pinnacles and a small bronze casket.
    t.block(0, 1.06, 0, 0.94, 0.22, 0.42, gold);
    for (const x of [-1.0, 1.0]) for (const z of [-0.38, 0.38]) {
      t.column(x, 1.27, z, 0.045, 0.74, stone, 0.035);
      t.spire(x, 1.85, z, 0.11, 0.45, trim);
    }
    for (const z of [-0.38, 0.38]) t.line([[-1, 1.52, z], [-0.52, 1.64, z], [0, 1.88, z], [0.52, 1.64, z], [1, 1.52, z]], 0.035, stone);
    t.block(0, 1.99, 0, 0.055, 0.34, 0.055, gold);
    t.block(0, 2.04, 0, 0.25, 0.04, 0.055, gold);
  } else if (theme === 'library') {
    // Curved horseshoe lectern with an open reader's side.
    const ring = new THREE.Shape();
    ring.absarc(0, 0, 1.15, Math.PI * 0.08, Math.PI * 0.92, false);
    ring.absarc(0, 0, 0.78, Math.PI * 0.92, Math.PI * 0.08, true);
    ring.closePath();
    const geometry = new THREE.ExtrudeGeometry(ring, { depth: 0.1, bevelEnabled: false, curveSegments: 16 });
    geometry.rotateX(-Math.PI / 2);
    t.mesh(geometry, wood, 0, 1.02, 0.35);
    for (const x of [-0.85, 0.85]) {
      t.column(x, 0.52, -0.2, 0.075, 1.04, wood);
      t.block(x, 0.07, -0.2, 0.47, 0.12, 0.5, wood);
    }
    const pages = mat('landmarkParchment', 0xb5a68a, { roughness: 0.96 });
    const stand = t.block(0, 1.14, -0.6, 0.9, 0.09, 0.56, wood);
    stand.rotation.x = -0.28;
    for (const sign of [-1, 1]) {
      const page = t.block(sign * 0.205, 1.21, -0.6, 0.39, 0.035, 0.46, pages);
      page.rotation.set(-0.28, 0, sign * -0.09);
    }
    for (const x of [-1.05, 1.05]) {
      t.column(x, 0.53, 0.7, 0.29, 0.09, wood);
      for (const dx of [-0.16, 0.16]) for (const dz of [-0.13, 0.13]) t.column(x + dx, 0.25, 0.7 + dz, 0.035, 0.5, wood);
    }
  } else if (theme === 'barracks') {
    for (const x of [-1.1, 1.1]) {
      t.block(x, 0.08, 0, 0.45, 0.15, 0.8, wood);
      t.block(x, 1.0, 0, 0.1, 1.85, 0.1, wood);
      t.spire(x, 2.02, 0, 0.08, 0.23, metal);
    }
    for (const y of [0.5, 1.35]) t.block(0, y, 0, 2.3, 0.1, 0.12, wood);
    for (const x of [-0.85, -0.48, 0.48, 0.85]) {
      t.column(x, 1.01, 0.12, 0.025, 1.8, wood);
      t.spire(x, 2.03, 0.12, 0.075, 0.3, metal);
    }
    // Waving, fork-tailed banner, authored as cloth geometry rather than a box.
    const vertices = [], uvs = [];
    const point = (u, v) => [-0.32 + u * 0.64, 1.83 - v * (1.12 - 0.15 * (1 - Math.abs(u * 2 - 1))), -0.08 + Math.sin(u * Math.PI * 3) * 0.035];
    for (let i = 0; i < 8; i++) {
      const a = i / 8, b = (i + 1) / 8;
      for (const [u, v] of [[a, 0], [b, 0], [b, 1], [a, 0], [b, 1], [a, 1]]) { vertices.push(...point(u, v)); uvs.push(u, v); }
    }
    const banner = new THREE.BufferGeometry();
    banner.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    banner.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    banner.computeVertexNormals();
    t.mesh(banner, cloth);
    t.block(0, 1.37, -0.135, 0.055, 0.34, 0.025, gold);
    t.block(0, 1.44, -0.135, 0.25, 0.055, 0.025, gold);
  } else if (theme === 'flooded') {
    t.column(0, 0.08, 0, 1.4, 0.16, stone);
    t.column(0, 0.20, 0, 1.25, 0.13, trim);
    // Ring-shaped octagonal rim preserves an open visible basin.
    for (let i = 0; i < 8; i++) {
      const a = (i + 0.5) * Math.PI / 4;
      const rim = t.block(Math.cos(a) * 1.12, 0.37, Math.sin(a) * 1.12, 0.94, 0.3, 0.16, stone);
      rim.rotation.y = -a + Math.PI / 2;
    }
    const water = mat('landmarkShrineWater', 0x285457, { roughness: 0.19, metalness: 0.22, emissive: 0x0b2224, emissiveIntensity: 0.27 });
    const disc = new THREE.CircleGeometry(1.04, 8);
    disc.rotateX(-Math.PI / 2);
    t.mesh(disc, water, 0, 0.34, 0);
    t.column(0, 0.57, 0, 0.19, 0.65, stone, 0.12);
    t.column(0, 0.94, 0, 0.39, 0.12, trim, 0.47);
    t.spire(0, 1.26, 0, 0.14, 0.58, gold);
    for (const sign of [-1, 1]) {
      const points = Array.from({ length: 13 }, (_, i) => { const u = i / 12; return [sign * (0.22 + u * 0.46), 0.96 - 0.6 * u * u, 0]; });
      t.line(points, 0.014, water);
    }
  }
  // Batch before transforming, so all merged geometry remains room-local.
  batchStaticGroup(THREE, ornament);
  ornament.scale.setScalar(size);
  ornament.position.z = -depth / 2 + 1.5 * size + 0.12;
  group?.add(ornament);
  return ornament;
}
