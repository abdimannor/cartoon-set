// Checks the CIEDE2000 implementation against Sharma, Wu and Dalal's published test pairs
// and the clustering on the committed palettes:   node scripts/palette-test.mjs
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { deltaE00, cluster, exact } from "../previews/palette.js";

const pairs = [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
  [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0],
  [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
  [[50, 2.5, 0], [73, 25, -18], 27.1492],
  [[50, 2.49, -0.001], [50, -2.49, 0.0011], 7.2195],
  [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
];
for (const [a, b, want] of pairs) assert.equal(+deltaE00(a, b).toFixed(4), want);

const data = JSON.parse(readFileSync(new URL("../previews/palettes.json", import.meta.url)));
for (const [file, colors] of Object.entries(data)) {
  const merged = cluster(colors);
  assert.ok(merged.length <= colors.length, file);
  assert.equal(exact(colors).length, colors.length, file);
  assert.ok(Math.abs(merged.reduce((s, c) => s + c.share, 0) - 1) < 1e-9, file);
  console.log(`${file}: ${colors.length} exact -> ${merged.length} merged`);
}
console.log("ok");
