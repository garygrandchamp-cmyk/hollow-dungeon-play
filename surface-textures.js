// Procedural, repeating color maps. No network requests or external assets.
const SIZE = 256;
const TAU = Math.PI * 2;

function random(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let n = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function polygon(ctx, points, fill, stroke, width = 1) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

// Draw border-crossing features on the opposite side too.
function wrapped(ctx, draw) {
  for (const x of [-SIZE, 0, SIZE]) {
    for (const y of [-SIZE, 0, SIZE]) {
      ctx.save();
      ctx.translate(x, y);
      draw();
      ctx.restore();
    }
  }
}

function grain(ctx, rng, strength) {
  const pixels = ctx.getImageData(0, 0, SIZE, SIZE);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const shift = (rng() - 0.5) * strength;
    for (let c = 0; c < 3; c++) pixels.data[i + c] += shift;
  }
  ctx.putImageData(pixels, 0, 0);
}

function flagstone(ctx) {
  const rng = random(1843);
  ctx.fillStyle = '#292724';
  ctx.fillRect(0, 0, SIZE, SIZE);
  const rows = 4;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * 64 + (row % 2) * 32;
      const y = row * 64;
      const inset = () => 2 + rng() * 4;
      const points = [[x + inset(), y + inset()], [x + 34, y + 2 + rng() * 3],
        [x + 64 - inset(), y + inset()], [x + 62, y + 33],
        [x + 64 - inset(), y + 64 - inset()], [x + 27, y + 62],
        [x + inset(), y + 64 - inset()], [x + 2, y + 30]];
      const tone = Math.floor(rng() * 22);
      const color = `rgb(${83 + tone},${77 + tone},${65 + tone})`;
      const crack = rng() < 0.7;
      const bend = rng() * 18 - 9;
      wrapped(ctx, () => {
        polygon(ctx, points, color, '#37342d', 2);
        ctx.save();
        ctx.beginPath();
        points.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
        ctx.closePath();
        ctx.clip();
        const shade = ctx.createLinearGradient(x, y, x + 60, y + 64);
        shade.addColorStop(0, 'rgba(177,164,133,0.17)');
        shade.addColorStop(1, 'rgba(15,19,16,0.23)');
        ctx.fillStyle = shade;
        ctx.fillRect(x, y, 64, 64);
        if (crack) {
          ctx.beginPath();
          ctx.moveTo(x + 15, y + 2);
          ctx.lineTo(x + 26 + bend, y + 23);
          ctx.lineTo(x + 24, y + 34);
          ctx.lineTo(x + 43 + bend, y + 62);
          ctx.moveTo(x + 24, y + 34);
          ctx.lineTo(x + 8, y + 44);
          ctx.strokeStyle = 'rgba(25,26,22,0.65)';
          ctx.lineWidth = 1.15;
          ctx.stroke();
        }
        ctx.restore();
      });
    }
  }
  grain(ctx, rng, 10);
}

function mosaic(ctx) {
  const rng = random(7291);
  ctx.fillStyle = '#302f28';
  ctx.fillRect(0, 0, SIZE, SIZE);
  const palette = ['#777361', '#696e62', '#847962', '#575e58', '#756150'];
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 16; col++) {
      // A worn diamond medallion, repeating across each tile boundary.
      const distance = Math.abs(col - 7.5) + Math.abs(row - 7.5);
      const ring = Math.abs(distance - 6) < 0.7 || Math.abs(distance - 11) < 0.7;
      const fill = ring ? '#4d625b' : palette[Math.floor(rng() * palette.length)];
      const x = col * 16, y = row * 16;
      if (rng() < 0.065) continue; // Missing tesserae expose dark bedding.
      polygon(ctx, [[x + 1 + rng(), y + 1], [x + 14, y + 1 + rng()],
        [x + 14 - rng(), y + 14], [x + 1, y + 14 - rng()]], fill, '#414139', 0.8);
      if (rng() < 0.2) {
        ctx.strokeStyle = '#3b3c32';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x + 3, y + 1);
        ctx.lineTo(x + 9, y + 8);
        ctx.lineTo(x + 7, y + 14);
        ctx.stroke();
      }
    }
  }
  grain(ctx, rng, 9);
}

function timber(ctx) {
  const rng = random(9137);
  ctx.fillStyle = '#26231d';
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let plank = 0; plank < 4; plank++) {
    const x = plank * 64;
    const tone = rng() * 16;
    ctx.fillStyle = `rgb(${86 + tone},${64 + tone},${43 + tone})`;
    ctx.fillRect(x + 2, 0, 60, SIZE);
    ctx.fillStyle = 'rgba(174,141,93,0.22)';
    ctx.fillRect(x + 3, 0, 1, SIZE);
    // Periodic fibers maintain a continuous grain at the top/bottom seam.
    for (let fiber = 0; fiber < 35; fiber++) {
      const center = x + 4 + rng() * 56;
      const phase = rng() * TAU;
      const amplitude = 0.3 + rng() * 1.2;
      ctx.beginPath();
      for (let y = 0; y <= SIZE; y += 2) {
        const px = center + Math.sin(y / SIZE * TAU + phase) * amplitude
          + Math.sin(y / SIZE * TAU * 3 + phase) * 0.35;
        y ? ctx.lineTo(px, y) : ctx.moveTo(px, y);
      }
      ctx.strokeStyle = fiber % 4 ? 'rgba(32,25,19,0.28)' : 'rgba(181,150,103,0.21)';
      ctx.lineWidth = 0.5 + rng() * 0.7;
      ctx.stroke();
    }
    const joint = 36 + Math.floor(rng() * 180);
    ctx.fillStyle = '#31281e';
    ctx.fillRect(x + 2, joint, 60, 2);
    for (const nailX of [x + 8, x + 55]) {
      for (const nailY of [joint - 6, joint + 8]) {
        ctx.beginPath();
        ctx.arc(nailX, nailY, 1.25, 0, TAU);
        ctx.fillStyle = '#292a24';
        ctx.fill();
      }
    }
  }
  grain(ctx, rng, 8);
}

function water(ctx) {
  const pixels = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE * TAU, v = y / SIZE * TAU;
      const flow = Math.sin(v * 5 + Math.sin(u * 2) * 0.65)
        + Math.sin(v * 3 - u * 2 + Math.sin(u + v) * 0.4) * 0.45;
      const broad = Math.sin(u + v * 2) * 0.5 + Math.cos(u * 2 - v) * 0.5;
      const highlight = Math.pow(Math.max(0, flow / 1.45), 7) * 21;
      const i = (y * SIZE + x) * 4;
      pixels.data[i] = 22 + broad * 3 + highlight * 0.65;
      pixels.data[i + 1] = 46 + broad * 5 + highlight;
      pixels.data[i + 2] = 45 + broad * 5 + highlight;
      pixels.data[i + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
}

/** Caller owns textures and should dispose them when the scene is torn down.
 * Set each texture.repeat to the number of 256px pattern repeats per surface.
 * These are color maps; water movement/roughness belongs to the material.
 */
export function createSurfaceTextures(THREE) {
  return Object.fromEntries(Object.entries({ flagstone, mosaic, timber, water }).map(([name, paint]) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Surface textures require a Canvas 2D context.');
    paint(ctx);
    const texture = new THREE.CanvasTexture(canvas);
    texture.name = `dungeon-${name}`;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    return [name, texture];
  }));
}
