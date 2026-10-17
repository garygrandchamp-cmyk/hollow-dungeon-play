import { batchStaticGroup } from './mesh-batch.js?v=64ad63ccf9b715304e37145621288e4cb455ca14';

const HALF_PI = Math.PI / 2;
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

/** Quarter-turn stair in world/room coordinates. Ascend west, then north.
 * Landings join the floor to the north gallery; geometry and collision share it.
 */
export function createCurvedStair({ left = 0, north = 0, width = 2.25, height = 3.4, radius = 3.4 } = {}) {
  left = finite(left, 0); north = finite(north, 0);
  width = Math.max(0.8, Math.min(4, finite(width, 2.25)));
  height = Math.max(0.3, Math.min(5, finite(height, 3.4)));
  radius = Math.max(width * 0.75, Math.min(6, finite(radius, 3.4)));
  const topX = left + width / 2, topZ = north + width;
  const centerX = topX + radius, centerZ = topZ;
  const bottomX = centerX, bottomZ = centerZ + radius;
  const landingDepth = Math.max(0.65, width * 0.55);
  const innerRadius = radius - width / 2, outerRadius = radius + width / 2;
  return {
    kind: 'quarter-turn', left, north, width, height, radius,
    topX, topZ, bottomX, bottomZ, centerX, centerZ, innerRadius, outerRadius,
    startAngle: HALF_PI, endAngle: Math.PI, steps: 32, landingDepth,
    top: { x: topX, z: topZ, height }, bottom: { x: bottomX, z: bottomZ, height: 0 },
    bounds: { left, right: centerX + landingDepth, north: topZ - landingDepth, south: centerZ + outerRadius },
  };
}

/** undefined = outside this stair, null = solid/unsafe side/height discontinuity.
 * A numeric result is the continuous walking ramp (rendered treads <=1 riser above).
 * Caller delegates undefined to its floor/gallery query, retaining previous height.
 */
export function curvedStairHeight(plan, x, z, previous = 0, radius = 0.18) {
  if (!plan || !Number.isFinite(x) || !Number.isFinite(z)) return undefined;
  previous = finite(previous, 0);
  radius = Math.max(0, Math.min(plan.width / 2, finite(radius, 0.18)));
  const { topX, topZ, bottomX, bottomZ, width, landingDepth, height } = plan;
  const safeHalf = width / 2 - radius;
  const continuous = h => Math.abs(h - previous) <= 0.26 + 1e-8 ? h : null;
  const dx = x - plan.centerX, dz = z - plan.centerZ;
  const distance = Math.hypot(dx, dz), angle = Math.atan2(dz, dx);
  const onArc = angle >= HALF_PI && angle <= Math.PI;
  // Preserve the curved ramp height inside the arc, including the transition
  // strips. Flattening those strips can disagree with a narrow inner tread.
  if (onArc && distance >= plan.innerRadius + radius && distance <= plan.outerRadius - radius) {
    return continuous(height * (angle - HALF_PI) / HALF_PI);
  }
  // At the open ends, do not inset the shared seam between ramp and landing.
  // Radius-sized transition strips avoid a one-frame hole when axis-sliding.
  const topSafe = Math.abs(x - topX) <= safeHalf && z >= topZ - landingDepth - radius && z <= topZ + radius;
  if (topSafe) return continuous(height);
  const bottomSafe = Math.abs(z - bottomZ) <= safeHalf && x >= bottomX - radius && x <= bottomX + landingDepth + radius;
  if (bottomSafe) return continuous(0);
  const expanded = (px, pz, minX, maxX, minZ, maxZ) => px >= minX - radius && px <= maxX + radius && pz >= minZ - radius && pz <= maxZ + radius;
  const nearTop = expanded(x, z, topX - width / 2, topX + width / 2, topZ - landingDepth, topZ);
  const nearBottom = expanded(x, z, bottomX, bottomX + landingDepth, bottomZ - width / 2, bottomZ + width / 2);
  const angularPadding = Math.asin(Math.min(1, radius / Math.max(distance, 0.001)));
  const nearArc = distance >= plan.innerRadius - radius && distance <= plan.outerRadius + radius
    && angle >= HALF_PI - angularPadding && angle <= Math.PI + angularPadding;
  // atan2 wraps immediately past PI; test the top end cap explicitly.
  const nearTopCap = Math.abs(z - topZ) <= radius && x >= plan.centerX - plan.outerRadius - radius && x <= plan.centerX - plan.innerRadius + radius;
  return nearTop || nearBottom || nearArc || nearTopCap ? null : undefined;
}

/** Adds/returns a batched child. Supply the same plan used by walking queries. */
export function buildCurvedStair({ THREE, group, box, mat, plan } = {}) {
  const g = new THREE.Group();
  g.name = 'gallery-quarter-turn-stair';
  if (!plan) { group?.add(g); return g; }
  const stone = mat('curvedGalleryStone', 0x737367, { roughness: 0.96 });
  const trim = mat('curvedGalleryTrim', 0x858575, { roughness: 0.9 });
  const iron = mat('curvedGalleryIron', 0x353c3b, { metalness: 0.55, roughness: 0.7 });
  function mesh(geometry, material) {
    const m = new THREE.Mesh(geometry, material);
    m.userData.ownGeometry = true;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  }
  const { steps, height, width, centerX, centerZ, innerRadius, outerRadius } = plan;
  for (let i = 0; i < steps; i++) {
    const a = HALF_PI + HALF_PI * i / steps, b = HALF_PI + HALF_PI * (i + 1) / steps;
    const shape = new THREE.Shape();
    const points = [];
    for (let j = 0; j <= 4; j++) { const t = a + (b - a) * j / 4; points.push([centerX + Math.cos(t) * outerRadius, -(centerZ + Math.sin(t) * outerRadius)]); }
    for (let j = 4; j >= 0; j--) { const t = a + (b - a) * j / 4; points.push([centerX + Math.cos(t) * innerRadius, -(centerZ + Math.sin(t) * innerRadius)]); }
    points.forEach(([x, y], k) => k ? shape.lineTo(x, y) : shape.moveTo(x, y));
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: height * (i + 1) / steps, bevelEnabled: false, curveSegments: 1 });
    geometry.rotateX(-Math.PI / 2);
    mesh(geometry, stone);
  }
  // Continuous solid landings. Bottom landing is flush with floor y=0.
  function landing(x, z, w, d, top) {
    const slab = mesh(new THREE.BoxGeometry(w, 0.16, d), trim);
    slab.position.set(x, top - 0.08, z);
  }
  landing(plan.topX, plan.topZ - plan.landingDepth / 2, width, plan.landingDepth, height);
  landing(plan.bottomX + plan.landingDepth / 2, plan.bottomZ, plan.landingDepth, width, 0);
  const up = new THREE.Vector3(0, 1, 0);
  function railSegment(a, b) {
    const delta = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
    const m = mesh(new THREE.CylinderGeometry(0.035, 0.035, delta.length(), 6), trim);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(up, delta.normalize());
  }
  for (const radial of [innerRadius + 0.055, outerRadius - 0.055]) {
    let last;
    for (let j = 0; j <= 24; j++) {
      const t = j / 24, angle = HALF_PI + t * HALF_PI;
      const x = centerX + Math.cos(angle) * radial, z = centerZ + Math.sin(angle) * radial;
      // Put each post on the actual tread top, avoiding floating rail feet.
      const tread = Math.min(steps, Math.floor(t * steps + 1e-7) + 1) * height / steps;
      if (j % 2 === 0) {
        const post = mesh(new THREE.CylinderGeometry(0.027, 0.034, 0.94, 6), iron);
        post.position.set(x, tread + 0.47, z);
      }
      const next = new THREE.Vector3(x, height * t + 1.02, z);
      if (last) railSegment(last, next);
      last = next;
    }
  }
  // Side rails on landings continue the curve; both transverse entries stay open.
  for (const side of [-1, 1]) {
    const topX = plan.topX + side * (width / 2 - 0.055);
    railSegment(new THREE.Vector3(topX, height + 1.02, plan.topZ), new THREE.Vector3(topX, height + 1.02, plan.topZ - plan.landingDepth));
    const bottomZ = plan.bottomZ + side * (width / 2 - 0.055);
    railSegment(new THREE.Vector3(plan.bottomX, 1.02, bottomZ), new THREE.Vector3(plan.bottomX + plan.landingDepth, 1.02, bottomZ));
  }
  batchStaticGroup(THREE, g);
  group?.add(g);
  return g;
}
