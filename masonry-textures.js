const SIZE = 512;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function hash(x, y, seed) {
  let h = Math.imul(x ^ seed, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return ((h ^ h >>> 16) >>> 0) / 4294967295;
}
function noise(u, v, period, seed) {
  const x = u * period, y = v * period, ix = Math.floor(x), iy = Math.floor(y);
  const fx = smooth(0, 1, x - ix), fy = smooth(0, 1, y - iy);
  const h = (a, b) => hash((a % period + period) % period, (b % period + period) % period, seed);
  const a = h(ix, iy) * (1 - fx) + h(ix + 1, iy) * fx;
  const b = h(ix, iy + 1) * (1 - fx) + h(ix + 1, iy + 1) * fx;
  return a * (1 - fy) + b * fy;
}

const recipes = {
  stone: { seed: 1871, rows: 4, cols: 3, color: [94, 94, 85], relief: 0.66, variation: 19, moss: 0.16 },
  basalt: { seed: 4289, rows: 4, cols: 3, color: [62, 66, 65], relief: 0.62, variation: 13, moss: 0.09 },
  brick: { seed: 6563, rows: 8, cols: 4, color: [102, 77, 65], relief: 0.52, variation: 15, moss: 0.08 },
  rubble: { seed: 9013, rows: 6, cols: 4, color: [87, 88, 77], relief: 0.72, variation: 23, moss: 0.20 },
};

function pixelsFor(recipe) {
  const albedo = new Uint8ClampedArray(SIZE * SIZE * 4);
  const roughness = new Uint8ClampedArray(albedo.length);
  const normal = new Uint8ClampedArray(albedo.length);
  const height = new Float32Array(SIZE * SIZE);
  const { seed, rows, cols } = recipe;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const u = x / SIZE, v = y / SIZE;
    const broad = noise(u, v, 4, seed);
    const medium = noise(u, v, 32, seed + 1);
    const fine = noise(u, v, 128, seed + 2);
    const grit = hash(x, y, seed + 3);
    // Both row count and stagger repeat exactly across texture boundaries.
    const row = Math.floor(v * rows);
    const cy = v * rows - row;
    const tx = u * cols + (row % 2) * 0.5;
    const column = Math.floor(tx), cx = tx - column;
    const stoneSeed = hash(column % cols, row, seed + 4);
    const chipped = noise(u, v, 64, seed + 5);
    const edge = Math.min(cx * SIZE / cols, (1 - cx) * SIZE / cols,
      cy * SIZE / rows, (1 - cy) * SIZE / rows);
    const mortarWidth = recipe === recipes.brick ? 1.7 : 2.2;
    const boundary = mortarWidth + (chipped - 0.5) * 2.6;
    const bevel = smooth(boundary, boundary + 3.5, edge);
    // One meandering branching fracture per selected stone, fading at its ends.
    const fractureX = 0.24 + stoneSeed * 0.45 + Math.sin(cy * 15 + stoneSeed * 27) * 0.025
      + (medium - 0.5) * 0.025;
    const mainCrack = 1 - smooth(0.0015, 0.008, Math.abs(cx - fractureX));
    const branchX = fractureX + (cy - 0.52) * 0.6;
    const branch = (1 - smooth(0.001, 0.006, Math.abs(cx - branchX))) * smooth(0.48, 0.6, cy);
    const crack = stoneSeed > 0.42 ? Math.max(mainCrack, branch * 0.7) * smooth(0.03, 0.15, cy) * (1 - smooth(0.83, 0.98, cy)) : 0;
    const stain = smooth(0.52, 0.86, noise(u, v, 8, seed + 6));
    const moss = smooth(0.62, 0.88, noise(u, v, 16, seed + 7)) * recipe.moss;
    const mineral = (broad - 0.5) * 10 + (medium - 0.5) * 9 + (fine - 0.5) * 6 + (grit - 0.5) * 3;
    const tone = (stoneSeed - 0.5) * recipe.variation;
    const i = (y * SIZE + x) * 4;
    for (let c = 0; c < 3; c++) {
      const mortar = [48, 47, 42][c] + (medium - 0.5) * 5 + (fine - 0.5) * 3;
      const stone = (recipe.color[c] + tone + mineral) * (1 - stain * 0.14 - crack * 0.29);
      const mossColor = [62, 72, 49][c];
      // No directional light or baked highlights: bevel only affects height.
      albedo[i + c] = mortar * (1 - bevel) + (stone * (1 - moss) + mossColor * moss) * bevel;
      roughness[i + c] = 242 * (1 - bevel) + (207 + medium * 27 + stain * 8) * bevel;
    }
    albedo[i + 3] = roughness[i + 3] = 255;
    height[y * SIZE + x] = 0.15 + bevel * (recipe.relief + (medium - 0.5) * 0.07 + (fine - 0.5) * 0.035 - crack * 0.18);
  }
  // Periodic central differences produce tangent-space normals (OpenGL +Y).
  const h = (x, y) => height[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const dx = (h(x + 1, y) - h(x - 1, y)) * 2.3;
    const dy = (h(x, y + 1) - h(x, y - 1)) * 2.3;
    // Canvas rows grow downward, opposite to the texture's tangent +Y.
    const length = Math.hypot(dx, dy, 1), i = (y * SIZE + x) * 4;
    normal[i] = (0.5 - dx / length * 0.5) * 255;
    normal[i + 1] = (0.5 + dy / length * 0.5) * 255;
    normal[i + 2] = (0.5 + 1 / length * 0.5) * 255;
    normal[i + 3] = 255;
  }
  return { albedo, roughness, normal };
}

/** Returns independently owned textures; dispose all twelve on scene teardown. */
export function createMasonryTextures(THREE) {
  const texture = (name, data, color) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Masonry textures require a Canvas 2D context.');
    const image = ctx.createImageData(SIZE, SIZE);
    image.data.set(data);
    ctx.putImageData(image, 0, 0);
    const map = new THREE.CanvasTexture(canvas);
    map.name = name;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 4;
    map.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return map;
  };
  return Object.fromEntries(Object.entries(recipes).map(([name, recipe]) => {
    const pixels = pixelsFor(recipe);
    return [name, {
      map: texture(`${name}-albedo`, pixels.albedo, true),
      normalMap: texture(`${name}-normal`, pixels.normal, false),
      roughnessMap: texture(`${name}-roughness`, pixels.roughness, false),
    }];
  }));
}
