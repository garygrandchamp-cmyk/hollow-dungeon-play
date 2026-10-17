import {WORLD_PATTERN_SPANS,pixelsForSpan,tagTextureDensity,resamplePixelTile} from './pixel-density.js?v=f414c9209e497cfc5d04552110a70457733840b0';
// Fixed physical motifs, quantized to the character-referenced world grid.
const N = 128, TAU = Math.PI * 2;
const clamp = (x, lo = 0, hi = 255) => Math.max(lo, Math.min(hi, x));
function hash(x, y, seed) {
  let n = Math.imul(x ^ seed, 374761393) ^ Math.imul(y, 668265263);
  n = Math.imul(n ^ n >>> 13, 1274126177);
  return ((n ^ n >>> 16) >>> 0) / 4294967296;
}
const cellNoise = (x, y, size, seed) => hash(Math.floor(x / size), Math.floor(y / size), seed) - 0.5;
const recipes = {
  stone: { seed: 721, cols: 4, rows: 4, color: [79, 77, 78], relief: .64, variety: 16 },
  basalt: { seed: 723, cols: 4, rows: 4, color: [49, 53, 59], relief: .56, variety: 12 },
  brick: { seed: 727, cols: 8, rows: 8, color: [83, 57, 52], relief: .51, variety: 15 },
  rubble: { seed: 733, cols: 4, rows: 4, color: [72, 71, 67], relief: .71, variety: 21 },
};

function tile(paint,N=128) {
  const colors = new Uint8Array(N * N * 4), heights = new Float32Array(N * N), rough = new Uint8Array(colors.length);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const p = paint(x, y), i = (y * N + x) * 4;
    for (let c = 0; c < 3; c++) { colors[i + c] = Math.round(clamp(p.color[c])); rough[i + c] = Math.round(clamp(p.rough ?? 232)); }
    colors[i + 3] = rough[i + 3] = 255;
    heights[y * N + x] = p.height ?? .5;
  }
  const normal = new Uint8Array(colors.length);
  const h = (x, y) => heights[((y + N) % N) * N + (x + N) % N];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (h(x + 1, y) - h(x - 1, y)) * 1.45, dy = (h(x, y + 1) - h(x, y - 1)) * 1.45;
    const length = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
    normal[i] = Math.round((.5 - dx / length * .5) * 255);
    normal[i + 1] = Math.round((.5 + dy / length * .5) * 255);
    normal[i + 2] = Math.round((.5 + 1 / length * .5) * 255);
    normal[i + 3] = 255;
  }
  return { colors, normal, rough };
}

function masonry(recipe, floor = false,N=128) {
  const { seed, cols, rows, color } = recipe;
  return tile((x, y) => {
    const row = Math.floor(y * rows / N), fy = y * rows / N - row;
    const tx = x * cols / N + (row % 2) * (floor ? .25 : .5), col = Math.floor(tx), fx = tx - col;
    const stone = hash(col % cols, row, seed), grain = cellNoise(x, y, 2, seed + 1);
    const chip = hash(Math.floor(x / 3), Math.floor(y / 3), seed + 2) > .76 ? 1 : 0;
    const px = fx * 128 / cols, py = fy * 128 / rows;
    const edge = Math.min(px, 128 / cols - px, py, 128 / rows - py);
    const corner = Math.min(px + py, 128 / cols - px + py, px + 128 / rows - py, 128 / cols - px + 128 / rows - py);
    const cornerChip = corner < (recipe === recipes.brick ? 1 + Math.floor(stone * 2) : 2 + Math.floor(stone * 4));
    const missing = edge < (recipe === recipes.rubble ? 3 : 2) && chip || cornerChip;
    if (edge < 1 || missing) return { color: [21 + grain * 4, 21 + grain * 4, 23 + grain * 4], height: .12, rough: 247 };
    const soot = cellNoise(x, y, 8, seed + 5);
    const stain = soot > .12 ? -Math.round((soot + .1) * 22) : 0;
    const pock = hash(Math.floor(x / 2), Math.floor(y / 2), seed + 6) > .945 ? -9 : hash(x, y, seed + 9) > .94 ? -5 : 0;
    // Rare, independently angled cuts. No common repeating zigzag motif.
    const slope = (hash(col % cols, row, seed + 31) - .5) * .78;
    const bend = (hash(col % cols, row, seed + 32) - .5) * .4;
    const fracture = .15 + stone * .7 + slope * (fy - .5) + bend * (fy - .5) ** 2;
    const crack = stone > .88 && fy > .12 && fy < .84 && Math.abs(fx - fracture) < cols / N * .45;
    const upper = py < 2 || px < 2;
    const lower = py > 128 / rows - 2 || px > 128 / cols - 2;
    const bevel = edge < 2 ? (upper ? 4 : lower ? -10 : -5) : 0;
    const mineral = Math.round(cellNoise(x, y, 4, seed + 3) * 4) * 2 + Math.round(grain * 3) * 2 + Math.round(cellNoise(x, y, 1, seed + 12) * 4);
    const variation = Math.round((stone - .5) * recipe.variety / 3) * 3;
    const shade = variation + mineral + stain + pock + bevel - (crack ? 14 : 0);
    const moss = hash(Math.floor(x / 8), Math.floor(y / 8), seed + 7) > .83 && (edge < 4 || stain < 0);
    const base = moss ? color.map((v, c) => v * .8 + [45, 58, 33][c] * .2) : color;
    return { color: base.map(v => clamp(v + shade, 16, 136)), height: .15 + recipe.relief - (edge < 2 ? .17 : 0) - (crack ? .13 : 0) + grain * .025, rough: 219 + Math.round(stone * 5) * 3 };
  },N);
}

function mosaic(N=128) {
  const palette = [[76, 79, 68], [91, 85, 67], [59, 74, 68], [72, 66, 59], [94, 93, 78]];
  return tile((x, y) => {
    const u=x*128/N,v=y*128/N,col=Math.floor(u/8),row=Math.floor(v/8),px=u%8,py=v%8;
    const value = hash(col, row, 819), missing = value > .97;
    if (px<1 || py<1 || missing) return { color: [29, 32, 27], height: .15 };
    const distance = Math.abs(col - 7.5) + Math.abs(row - 7.5);
    const ring = Math.abs(distance - 6) < .6 || Math.abs(distance - 11) < .6;
    const base = ring ? [48, 69, 61] : palette[Math.floor(value * palette.length) % palette.length];
    const tone = px<2 || py<2 ? 8 : px>=7 || py>=7 ? -7 : 0;
    return { color: base.map(v => v + tone), height: .7, rough: 211 + Math.floor(value * 4) * 5 };
  },N);
}

function timber(N=128) {
  return tile((x, y) => {
    const u=x*128/N,v=y*128/N,col=Math.floor(u/32),px=u%32,value=hash(col,0,887);
    const joint = 14 + Math.floor(value * 95);
    if (px < 2 || Math.abs(v-joint)<.5) return { color: [26, 23, 19], height: .16 };
    const fiber = Math.round(px + Math.sin(y / N * TAU + col) * 1.8 + Math.sin(y / N * TAU * 3) * .6) % 7;
    const tone = Math.round(value * 4) * 3 + (fiber === 0 ? -13 : fiber === 1 ? 7 : 0) + Math.round(cellNoise(x, y, 2, 889) * 2) * 3;
    const nail = (Math.abs(px-6)<.5 || Math.abs(px-25)<.5) && Math.abs(v-joint)>=3 && Math.abs(v-joint)<5;
    return { color: nail ? [35, 37, 33] : [79 + tone, 60 + tone, 40 + tone], height: .66 + (fiber === 0 ? -.045 : 0), rough: 226 };
  },N);
}

function water(N=128) {
  const palette = [[13, 33, 36], [16, 40, 42], [20, 48, 49], [27, 60, 60], [38, 74, 70]];
  return tile((x, y) => {
    const u = x / N * TAU, v = y / N * TAU;
    const wave = Math.sin(v * 4 + Math.sin(u * 2) * .8) * .7 + Math.sin(v * 2 - u * 2) * .3;
    const band = wave > .91 ? 4 : wave > .79 ? 3 : wave > .25 ? 2 : wave > -.5 ? 1 : 0;
    return { color: palette[band], height: .5 + wave * .025, rough: 76 };
  },N);
}

/** No DOM required. All maps: nearest filters, RepeatWrapping, mipmaps disabled.
 * Caller owns returned textures. Mutate all 3 matching maps' repeats together.
 */
export function createRetroTextures(THREE) {
  function texture(data, name, color = true,span=[2,2],sourceSize=128) {
    const width=pixelsForSpan(span[0]),height=pixelsForSpan(span[1]),pixels=sourceSize===width&&width===height?data:resamplePixelTile(data,sourceSize,sourceSize,width,height);
    const bottomUp = new Uint8Array(pixels.length), stride = width * 4;
    for (let y = 0; y < height; y++) bottomUp.set(pixels.subarray(y * stride, (y + 1) * stride), (height - 1 - y) * stride);
    const t = new THREE.DataTexture(bottomUp, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.name = `retro-${name}`;
    t.flipY = false;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.anisotropy = 1;
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.needsUpdate = true;
    return tagTextureDensity(t,span);
  }
  const walls = Object.fromEntries(Object.entries(recipes).map(([name, recipe]) => {
    const pixels = masonry(recipe);
    const span=WORLD_PATTERN_SPANS[name];return [name, { map: texture(pixels.colors, `${name}-albedo`,true,span), normalMap: texture(pixels.normal, `${name}-normal`, false,span), roughnessMap: texture(pixels.rough, `${name}-roughness`, false,span) }];
  }));
  const floorRecipe = { ...recipes.stone, seed: 797, color: [66, 65, 65], variety: 20 };
  const floorSize=pixelsForSpan(4.8),waterSize=pixelsForSpan(2.4);
  const surfaces = { flagstone: masonry(floorRecipe, true,floorSize), mosaic: mosaic(floorSize), timber: timber(floorSize), water: water(waterSize) };
  return { masonry: walls, surfaces: Object.fromEntries(Object.entries(surfaces).map(([name, pixels]) => [name, texture(pixels.colors, name,true,WORLD_PATTERN_SPANS[name],name==='water'?waterSize:floorSize)])) };
}
