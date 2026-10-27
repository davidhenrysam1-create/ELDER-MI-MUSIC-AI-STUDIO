/**
 * Generates the PWA icon set for Elder Mi Music AI Studio.
 *
 * Written with Node's built-in zlib only (no image tooling), so icons can be
 * regenerated anywhere:  node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const OUT = {
  icon192: "public/icons/icon-192.png",
  icon512: "public/icons/icon-512.png",
  maskable512: "public/icons/icon-maskable-512.png",
  apple: "app/apple-icon.png",
  favicon: "app/icon.png",
  faviconSmall: "public/icons/favicon-32.png",
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function writePng(path, width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  mkdirSync(dirname(join(process.cwd(), path)), { recursive: true });
  writeFileSync(join(process.cwd(), path), png);
  return png.length;
}

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const mix = (a, b, t) => a + (b - a) * clamp(t);

/** Coverage of a rounded rectangle (0..1) with 1px-class antialiasing. */
function roundedRectCoverage(x, y, cx, cy, w, h, r, feather) {
  const dx = Math.abs(x - cx) - (w / 2 - r);
  const dy = Math.abs(y - cy) - (h / 2 - r);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const inside = Math.min(Math.max(dx, dy), 0);
  const distance = outside + inside - r;
  return clamp(0.5 - distance / feather);
}

function barCoverage(x, y, cx, cy, w, h, feather) {
  // Vertical bars with fully rounded ends.
  return roundedRectCoverage(x, y, cx, cy, w, h, w / 2, feather);
}

function render(size, { maskable }) {
  const rgba = Buffer.alloc(size * size * 4);
  const S = size;
  const inset = maskable ? S * 0.1 : 0;
  const radius = maskable ? S * 0.5 : S * 0.225;
  const centre = S / 2;

  // Waveform bar layout (fractions of the icon box).
  const bars = [
    { x: 0.272, h: 0.2, tone: 0 },
    { x: 0.357, h: 0.36, tone: 1 },
    { x: 0.442, h: 0.56, tone: 2 },
    { x: 0.5, h: 0.68, tone: 3 },
    { x: 0.558, h: 0.52, tone: 2 },
    { x: 0.643, h: 0.34, tone: 1 },
    { x: 0.728, h: 0.18, tone: 0 },
  ];
  const barWidth = S * 0.062;
  const palette = [
    [0xa8, 0x55, 0xf7],
    [0xc0, 0x5c, 0xe8],
    [0xe7, 0x4f, 0xa8],
    [0x22, 0xd3, 0xee],
  ];

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const px = x + 0.5;
      const py = y + 0.5;

      // Rounded-square (or circle) silhouette.
      const shape = maskable
        ? clamp(0.5 - (Math.hypot(px - centre, py - centre) - S * 0.5) / 1.5) * 0 +
          roundedRectCoverage(px, py, centre, centre, S - inset, S - inset, S * 0.24, 1.2)
        : roundedRectCoverage(px, py, centre, centre, S, S, radius, 1.2);

      if (shape <= 0.001) {
        rgba[i + 3] = 0;
        continue;
      }

      // Background: diagonal fusion of the brand gradient.
      const t = clamp((px + py) / (2 * S));
      const radial = Math.hypot(px - S * 0.22, py - S * 0.16) / (S * 1.1);
      let r = mix(0x1b, 0x09, t) + (1 - clamp(radial)) * 18;
      let g = mix(0x10, 0x09, t) + (1 - clamp(radial)) * 8;
      let b = mix(0x38, 0x1c, t) + (1 - clamp(radial)) * 30;

      // Soft violet bloom in the top-left, cyan in the bottom-right.
      const bloomA = Math.exp(-(((px - S * 0.22) ** 2 + (py - S * 0.18) ** 2) / (S * S * 0.09)));
      const bloomB = Math.exp(-(((px - S * 0.82) ** 2 + (py - S * 0.84) ** 2) / (S * S * 0.1)));
      r += bloomA * 70 + bloomB * 6;
      g += bloomA * 26 + bloomB * 48;
      b += bloomA * 96 + bloomB * 70;

      // Waveform bars with rounded caps and a soft halo.
      for (const bar of bars) {
        const bx = bar.x * S;
        const bh = bar.h * S;
        const cover = barCoverage(px, py, bx, centre, barWidth, bh, 1.1);
        if (cover > 0) {
          const [pr, pg, pb] = palette[bar.tone];
          r = mix(r, pr, cover);
          g = mix(g, pg, cover);
          b = mix(b, pb, cover);
        }
        const halo = barCoverage(px, py, bx, centre, barWidth * 1.55, bh * 1.12, 1.4);
        if (halo > 0 && cover < 0.5) {
          r += halo * 14;
          g += halo * 8;
          b += halo * 20;
        }
      }

      rgba[i] = Math.round(clamp(r, 0, 255));
      rgba[i + 1] = Math.round(clamp(g, 0, 255));
      rgba[i + 2] = Math.round(clamp(b, 0, 255));
      rgba[i + 3] = Math.round(shape * 255);
    }
  }
  return rgba;
}

const targets = [
  { path: OUT.icon192, size: 192, maskable: false },
  { path: OUT.icon512, size: 512, maskable: false },
  { path: OUT.maskable512, size: 512, maskable: true },
  { path: OUT.apple, size: 180, maskable: false },
  { path: OUT.favicon, size: 512, maskable: false },
  { path: OUT.faviconSmall, size: 32, maskable: false },
];

for (const target of targets) {
  const bytes = writePng(target.path, target.size, target.size, render(target.size, target));
  console.log(`${target.path.padEnd(38)} ${target.size}x${target.size}  ${(bytes / 1024).toFixed(1)} kB`);
}
