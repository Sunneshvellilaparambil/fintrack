/**
 * Generate proper PNG launcher icons for Android.
 * No external dependencies — uses pure JavaScript PNG generation.
 * 
 * Run: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Android mipmap density sizes
const SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const RES_DIR = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

// ─── CRC32 ───────────────────────────────────────────────────────────────────
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

// ─── Color helpers ───────────────────────────────────────────────────────────
function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

function hexToRGB(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF];
}

function blendAlpha(fg, bg, alpha) {
  return Math.round(fg * alpha + bg * (1 - alpha));
}

// ─── PNG Creator with pixel-level drawing ────────────────────────────────────
function createPNG(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = createChunk('IHDR', ihdrData);

  // IDAT — build raw pixel rows with filter byte
  const rowLen = width * 4 + 1;
  const rawData = Buffer.alloc(rowLen * height);
  for (let y = 0; y < height; y++) {
    rawData[y * rowLen] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const srcOff = (y * width + x) * 4;
      const dstOff = y * rowLen + 1 + x * 4;
      rawData[dstOff] = pixels[srcOff];
      rawData[dstOff + 1] = pixels[srcOff + 1];
      rawData[dstOff + 2] = pixels[srcOff + 2];
      rawData[dstOff + 3] = pixels[srcOff + 3];
    }
  }

  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idat = createChunk('IDAT', compressed);
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// ─── Drawing primitives ──────────────────────────────────────────────────────
function setPixel(pixels, w, x, y, r, g, b, a) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || x >= w || y < 0 || y >= w) return;
  const off = (y * w + x) * 4;
  if (a >= 255) {
    pixels[off] = r;
    pixels[off + 1] = g;
    pixels[off + 2] = b;
    pixels[off + 3] = 255;
  } else {
    const alpha = a / 255;
    pixels[off] = blendAlpha(r, pixels[off], alpha);
    pixels[off + 1] = blendAlpha(g, pixels[off + 1], alpha);
    pixels[off + 2] = blendAlpha(b, pixels[off + 2], alpha);
    pixels[off + 3] = Math.min(255, pixels[off + 3] + a);
  }
}

function fillRect(pixels, w, x1, y1, x2, y2, r, g, b, a) {
  for (let y = Math.max(0, Math.floor(y1)); y < Math.min(w, Math.ceil(y2)); y++) {
    for (let x = Math.max(0, Math.floor(x1)); x < Math.min(w, Math.ceil(x2)); x++) {
      setPixel(pixels, w, x, y, r, g, b, a || 255);
    }
  }
}

function fillCircle(pixels, w, cx, cy, radius, r, g, b, a) {
  const r2 = radius * radius;
  for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(w - 1, Math.ceil(cy + radius)); y++) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(w - 1, Math.ceil(cx + radius)); x++) {
      const dx = x - cx, dy = y - cy;
      const dist2 = dx * dx + dy * dy;
      if (dist2 <= r2) {
        // Anti-alias the edge
        const edgeDist = radius - Math.sqrt(dist2);
        const alpha = Math.min(1, edgeDist) * (a / 255);
        setPixel(pixels, w, x, y, r, g, b, Math.round(alpha * 255));
      }
    }
  }
}

function fillRoundedRect(pixels, w, x1, y1, x2, y2, radius, r, g, b, a) {
  // Fill center regions
  fillRect(pixels, w, x1 + radius, y1, x2 - radius, y2, r, g, b, a);
  fillRect(pixels, w, x1, y1 + radius, x1 + radius, y2 - radius, r, g, b, a);
  fillRect(pixels, w, x2 - radius, y1 + radius, x2, y2 - radius, r, g, b, a);
  // Fill corners
  fillCircle(pixels, w, x1 + radius, y1 + radius, radius, r, g, b, a);
  fillCircle(pixels, w, x2 - radius, y1 + radius, radius, r, g, b, a);
  fillCircle(pixels, w, x1 + radius, y2 - radius, radius, r, g, b, a);
  fillCircle(pixels, w, x2 - radius, y2 - radius, radius, r, g, b, a);
}

function drawThickLine(pixels, w, x1, y1, x2, y2, thickness, r, g, b, a) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(len * 2);
  const halfT = thickness / 2;
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = x1 + dx * t;
    const cy = y1 + dy * t;
    fillCircle(pixels, w, cx, cy, halfT, r, g, b, a);
  }
}

// ─── Icon renderer ───────────────────────────────────────────────────────────
function renderIcon(size, isRound) {
  const pixels = Buffer.alloc(size * size * 4); // RGBA
  const s = size / 512;

  const bgColor = hexToRGB('#0D1220');
  const brandColors = [hexToRGB('#A89BFF'), hexToRGB('#7C6EFF'), hexToRGB('#5A4ECC')];
  const accentColors = [hexToRGB('#00E5A0'), hexToRGB('#00B87E')];

  // Draw background
  if (isRound) {
    fillCircle(pixels, size, size / 2, size / 2, size / 2, bgColor[0], bgColor[1], bgColor[2], 255);
  } else {
    const cornerR = Math.round(size * 0.22);
    fillRoundedRect(pixels, size, 0, 0, size, size, cornerR, bgColor[0], bgColor[1], bgColor[2], 255);
  }

  // Draw "F" with gradient (top-to-bottom brand gradient)
  const fPoints = [
    [150, 130, 330, 180],  // top bar
    [150, 180, 210, 400],  // vertical stroke
    [210, 240, 310, 290],  // middle bar
  ];

  for (const [fx1, fy1, fx2, fy2] of fPoints) {
    for (let y = Math.floor(fy1 * s); y < Math.ceil(fy2 * s); y++) {
      const t = Math.min(1, Math.max(0, (y / s - 100) / 320)); // gradient position
      let cr, cg, cb;
      if (t < 0.5) {
        const lt = t * 2;
        cr = lerp(brandColors[0][0], brandColors[1][0], lt);
        cg = lerp(brandColors[0][1], brandColors[1][1], lt);
        cb = lerp(brandColors[0][2], brandColors[1][2], lt);
      } else {
        const lt = (t - 0.5) * 2;
        cr = lerp(brandColors[1][0], brandColors[2][0], lt);
        cg = lerp(brandColors[1][1], brandColors[2][1], lt);
        cb = lerp(brandColors[1][2], brandColors[2][2], lt);
      }
      for (let x = Math.floor(fx1 * s); x < Math.ceil(fx2 * s); x++) {
        if (isRound) {
          const dx = x - size / 2, dy = y - size / 2;
          if (dx * dx + dy * dy > (size / 2) * (size / 2)) continue;
        }
        setPixel(pixels, size, x, y, cr, cg, cb, 242);
      }
    }
  }

  // Draw arrow (trending up)
  const lineWidth = Math.max(2, Math.round(9 * s));
  const arrowSegments = [
    [260, 360, 310, 280],
    [310, 280, 360, 310],
    [360, 310, 380, 160],
  ];
  const arrowHead = [
    [355, 170, 385, 150],
    [385, 150, 390, 185],
  ];

  for (const [lx1, ly1, lx2, ly2] of [...arrowSegments, ...arrowHead]) {
    const midY = ((ly1 + ly2) / 2 - 80) / 280;
    const t = Math.min(1, Math.max(0, midY));
    const cr = lerp(accentColors[0][0], accentColors[1][0], t);
    const cg = lerp(accentColors[0][1], accentColors[1][1], t);
    const cb = lerp(accentColors[0][2], accentColors[1][2], t);
    drawThickLine(pixels, size, lx1 * s, ly1 * s, lx2 * s, ly2 * s, lineWidth, cr, cg, cb, 255);
  }

  return createPNG(size, size, pixels);
}

// ─── Main ────────────────────────────────────────────────────────────────────
console.log('🎨 Generating FinTrack launcher icons...\n');

for (const [folder, size] of Object.entries(SIZES)) {
  const dir = path.join(RES_DIR, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const regular = renderIcon(size, false);
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), regular);

  const round = renderIcon(size, true);
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), round);

  console.log(`  ✅ ${folder}: ${size}×${size}px`);
}

console.log('\n🎉 All launcher icons generated successfully!');
console.log('   Location: android/app/src/main/res/mipmap-*/');
