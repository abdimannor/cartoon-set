// Regenerates previews/palettes.json ({ file: [{ hex, n }] }, n = colour operations)
// from the .ai files, using the same paletteOf() the lightbox runs live. Needs a local static server on the repo root:
//   python3 -m http.server 8760   then   node scripts/palettes.mjs [playwright path]
import { writeFile } from "node:fs/promises";
const { chromium } = await import(process.argv[2] || "playwright");
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(process.env.SITE || "http://127.0.0.1:8760/");
const data = await page.evaluate(async () => {
  const { paletteOf } = await import("./lightbox.js");
  const out = {};
  for (const file of ["Cartoon1.ai", "Cartoon2.ai", "Cartoon3.ai"]) out[file] = await paletteOf(file);
  return out;
});
await writeFile(new URL("../previews/palettes.json", import.meta.url), JSON.stringify(data, null, 2) + "\n");
console.log(data);
await browser.close();
