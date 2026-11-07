// Generates the placeholder "photos" (public/photos/NN.svg) for every Memory in content/memories.ts.
// Run once: node scripts/make-placeholders.mjs   (needs Node 22.18+ to read the .ts file)
// Delete these files and drop real photos in when they are ready.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CHAPTERS } from "../content/memories.ts";

const dir = path.resolve(import.meta.dirname, "..", "public", "photos");
await mkdir(dir, { recursive: true });

const palettes = [
  ["#ffd1e1", "#ff8fb8"],
  ["#ffe1d0", "#ff9fa8"],
  ["#e9d4ff", "#ff94c8"],
  ["#d6ecff", "#ff9fc4"],
  ["#fff0c9", "#ff9db3"],
  ["#ffd6dc", "#c66a94"],
];

const W = 1200;
let n = 0;

for (const chapter of CHAPTERS) {
  for (const memory of chapter.memories) {
    const h = Math.round(W / (memory.ratio ?? 0.8));
    const [light, deep] = palettes[n % palettes.length];
    const label = String(n + 1).padStart(2, "0");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
  </defs>
  <rect width="${W}" height="${h}" fill="url(#g)"/>
  <circle cx="${W * 0.72}" cy="${h * 0.28}" r="${W * 0.1}" fill="#fff" opacity="0.7"/>
  <path d="M0 ${h * 0.78} Q ${W * 0.3} ${h * 0.6} ${W * 0.55} ${h * 0.76} T ${W} ${h * 0.7} V ${h} H 0 Z" fill="#fff" opacity="0.35"/>
  <path d="M0 ${h * 0.88} Q ${W * 0.4} ${h * 0.74} ${W * 0.75} ${h * 0.88} T ${W} ${h * 0.84} V ${h} H 0 Z" fill="#fff" opacity="0.45"/>
  <text x="50%" y="${h * 0.46}" text-anchor="middle" font-family="Georgia, serif" font-size="${W * 0.2}" fill="#0a0a0a" opacity="0.8">${label}</text>
  <text x="50%" y="${h * 0.54}" text-anchor="middle" font-family="Georgia, serif" font-size="${W * 0.04}" fill="#0a0a0a" opacity="0.55">placeholder photo</text>
</svg>
`;
    const file = path.join(dir, path.basename(memory.src));
    await writeFile(file, svg);
    n += 1;
  }
}

console.log(`Wrote ${n} placeholder photos to ${dir}`);
