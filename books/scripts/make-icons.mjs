// Generates the app icons with no external libraries. Draws the OneDay Books
// mark (a sound equalizer on a brand colored tile) and writes PNG files.
// Run with: npm run make-icons

import zlib from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "public");
const iconsDir = join(publicDir, "icons");
mkdirSync(iconsDir, { recursive: true });

// ---- tiny PNG encoder (8 bit RGBA) ----
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- draw the mark ----
function makeIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const bg = [0x6c, 0x5c, 0xff]; // brand
  const bgDark = [0x53, 0x45, 0xe0];
  const white = [0xff, 0xff, 0xff];

  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = 255;
  };

  // Full bleed brand background with a soft vertical shade.
  for (let y = 0; y < size; y++) {
    const t = y / size;
    const c = [
      Math.round(bg[0] + (bgDark[0] - bg[0]) * t),
      Math.round(bg[1] + (bgDark[1] - bg[1]) * t),
      Math.round(bg[2] + (bgDark[2] - bg[2]) * t),
    ];
    for (let x = 0; x < size; x++) set(x, y, c);
  }

  // Equalizer bars in white, centered.
  const bars = [0.42, 0.68, 0.9, 0.6, 0.34];
  const count = bars.length;
  const area = size * 0.52;
  const gap = area * 0.08;
  const barW = (area - gap * (count - 1)) / count;
  const startX = (size - area) / 2;
  const baseY = size * 0.72;

  for (let b = 0; b < count; b++) {
    const h = area * bars[b];
    const x0 = Math.round(startX + b * (barW + gap));
    const x1 = Math.round(x0 + barW);
    const y0 = Math.round(baseY - h);
    const y1 = Math.round(baseY);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) set(x, y, white);
    }
  }

  return encodePNG(size, size, px);
}

const targets = [
  ["icons/icon-192.png", 192],
  ["icons/icon-512.png", 512],
  ["apple-touch-icon.png", 180],
];

for (const [name, size] of targets) {
  const buf = makeIcon(size);
  writeFileSync(join(publicDir, name), buf);
  console.log(`wrote ${name} (${size}x${size}, ${buf.length} bytes)`);
}
