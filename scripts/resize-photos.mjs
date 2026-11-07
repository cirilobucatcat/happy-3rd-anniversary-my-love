// Scales dropped-in photos in public/photos so the longest edge is about 1600 px.
// Usage: npm run resize-photos        (resizes jpg, jpeg, png and webp in place)
// Photos already 1600 px or smaller are left alone. SVG placeholders are skipped.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const MAX_EDGE = 1600;
const dir = path.resolve(import.meta.dirname, "..", "public", "photos");
const exts = new Set([".jpg", ".jpeg", ".png", ".webp"]);

let resized = 0;
let skipped = 0;

for (const name of await readdir(dir)) {
  const ext = path.extname(name).toLowerCase();
  if (!exts.has(ext)) continue;
  const file = path.join(dir, name);
  const input = await readFile(file);
  // rotate() bakes in the phone's EXIF orientation so photos are not sideways.
  const image = sharp(input).rotate();
  const { width = 0, height = 0, orientation = 1 } = await image.metadata();
  // Small photos are left alone, unless they carry a rotation flag that still needs baking in.
  if (Math.max(width, height) <= MAX_EDGE && orientation <= 1) {
    skipped += 1;
    continue;
  }
  const output = await image
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .toBuffer();
  await writeFile(file, output);
  resized += 1;
  console.log(`resized ${name}`);
}

console.log(`Done: ${resized} resized, ${skipped} already small enough.`);
