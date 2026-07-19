/**
 * Generate a dark-mode variant of the DUX logo from the existing light-mode
 * artwork. The source is black line-art on a transparent background, which
 * disappears on dark surfaces. We map each pixel's darkness to alpha and paint
 * it near-white, so the same owl reads cleanly as light strokes on any dark
 * background — no manual redraw, always in sync with the source logo.
 *
 * Run: node scripts/generate_dark_logo.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PNG } from "pngjs";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "public");

const source = PNG.sync.read(readFileSync(join(publicDir, "logo.png")));
const { width, height, data } = source;

// Near-white ink so the strokes stay soft rather than a harsh pure white.
const INK = { r: 245, g: 246, b: 248 };

for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const a = data[i + 3];

  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  // Dark source pixels become opaque ink; light/background pixels fade out.
  const inkAlpha = Math.round(((255 - luminance) / 255) * a);

  data[i] = INK.r;
  data[i + 1] = INK.g;
  data[i + 2] = INK.b;
  data[i + 3] = inkAlpha;
}

const out = new PNG({ width, height });
source.data.copy(out.data);
data.copy(out.data);
writeFileSync(join(publicDir, "logo-dark.png"), PNG.sync.write(out));

console.log(`Wrote public/logo-dark.png (${width}x${height})`);
