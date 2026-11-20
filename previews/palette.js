// Palette tools: perceptual clustering (CIEDE2000), swatch strips with an exact-colour
// toggle, client-side downloads (CSS, GIMP .gpl, JSON) and the colour story table.
// Colours arrive as [{ hex, n }] where n counts the fill and stroke operations using it.

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const lab = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
  const fy = f(0.2126729 * r + 0.7151522 * g + 0.072175 * b);
  const fz = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};

// CIEDE2000 colour difference between two CIELAB triples (Sharma, Wu and Dalal 2005).
export const deltaE00 = ([L1, a1, b1], [L2, a2, b2]) => {
  const rad = Math.PI / 180;
  const C7 = (c) => Math.sqrt(c ** 7 / (c ** 7 + 25 ** 7));
  const G = 0.5 * (1 - C7((Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hue = (b, a) => (a || b ? (Math.atan2(b, a) / rad + 360) % 360 : 0);
  const h1p = hue(b1, a1p), h2p = hue(b2, a2p);
  const both = C1p * C2p !== 0;
  let dh = both ? h2p - h1p : 0;
  if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh / 2) * rad);
  const Lb = (L1 + L2) / 2, Cb = (C1p + C2p) / 2;
  let hb = h1p + h2p;
  if (both) hb = Math.abs(h1p - h2p) > 180 ? (hb < 360 ? hb + 360 : hb - 360) / 2 : hb / 2;
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad)
    + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad);
  const SL = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2);
  const SC = 1 + 0.045 * Cb, SH = 1 + 0.015 * Cb * T;
  const RT = -Math.sin(2 * 30 * Math.exp(-(((hb - 275) / 25) ** 2)) * rad) * 2 * C7(Cb);
  const l = (L2 - L1) / SL, c = (C2p - C1p) / SC, h = dHp / SH;
  return Math.sqrt(l * l + c * c + h * h + RT * c * h);
};
export const distance = (x, y) => deltaE00(lab(x), lab(y));

// Below this CIEDE2000 difference two colours read as the same ink (about two "just
// noticeable differences"); the many near-blacks of the files collapse into one.
export const THRESHOLD = 4;

// Greedy clustering: the most used colour leads; each colour joins the first leader
// within the threshold. Shares are of all colour operations in the file.
export const cluster = (colors, t = THRESHOLD) => {
  const total = colors.reduce((sum, c) => sum + c.n, 0) || 1;
  const groups = [];
  for (const c of [...colors].sort((a, b) => b.n - a.n)) {
    const g = groups.find((g) => distance(g.hex, c.hex) < t);
    if (g) { g.n += c.n; g.members.push(c.hex); } else groups.push({ hex: c.hex, n: c.n, members: [c.hex] });
  }
  return groups.sort((a, b) => b.n - a.n).map((g) => ({ ...g, share: g.n / total }));
};
export const exact = (colors) => cluster(colors, 0);

const pct = (share) => (share >= 0.1 ? `${Math.round(share * 100)}%` : `${(share * 100).toFixed(1)}%`);

const el = (tag, props = {}, ...kids) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids);
  return node;
};
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// Downloads: built in the browser and handed over as Blobs, nothing leaves the page.
export const formats = {
  css: (name, list) => `/* ${name} palette */\n:root {\n${list.map((c, i) => `  --${slug(name)}-${i + 1}: ${c.hex}; /* ${pct(c.share)} */`).join("\n")}\n}\n`,
  gpl: (name, list) => `GIMP Palette\nName: ${name}\nColumns: ${Math.min(list.length, 8)}\n#\n${list.map((c) => `${rgb(c.hex).map((v) => String(v).padStart(3)).join(" ")}\t${c.hex} ${pct(c.share)}`).join("\n")}\n`,
  json: (name, list, mode) => JSON.stringify({ name, mode, colors: list.map(({ hex, share, members }) => ({ hex, share: +share.toFixed(4), members })) }, null, 2) + "\n",
};
const types = { css: "text/css", gpl: "text/plain", json: "application/json" };
const download = (name, list, mode, kind) => {
  const url = URL.createObjectURL(new Blob([formats[kind](name, list, mode)], { type: types[kind] }));
  const a = el("a", { href: url, download: `${slug(name)}-${mode}.${kind}` });
  document.body.append(a);
  a.click();
  a.remove();
  queueMicrotask(() => URL.revokeObjectURL(url));
};

// One switch for every strip: merged inks by default, the raw list on request.
let showExact = false;
const strips = new Map();
export const renderPalette = (target, colors, name) => {
  strips.set(target, { colors, name });
  const mode = showExact ? "exact" : "merged";
  const list = showExact ? exact(colors) : cluster(colors);
  const chips = list.map((c) => {
    const b = el("button", { type: "button", className: "swatch" });
    b.style.setProperty("--c", c.hex);
    b.dataset.copy = c.hex;
    b.innerHTML = `<span class="chip" aria-hidden="true"></span><span class="hex">${c.hex}</span> <span class="share">${pct(c.share)}</span>`;
    const merged = c.members.length > 1 ? `, merges ${c.members.length} near-identical colours` : "";
    b.setAttribute("aria-label", `Copy ${c.hex} ${pct(c.share)} of the colour operations${merged}`);
    if (c.members.length > 1) b.title = c.members.join(" ");
    return b;
  });
  if (!list.length) return target.replaceChildren();
  const all = el("button", { type: "button", className: "swatch-all", textContent: "Copy all" });
  all.dataset.copy = list.map((c) => c.hex).join(" ");
  all.setAttribute("aria-label", `Copy all ${list.length} colours of ${name}`);
  const toggle = el("button", { type: "button", className: "palette-exact", textContent: "Exact colours" });
  toggle.setAttribute("aria-pressed", String(showExact));
  toggle.dataset.exactToggle = "";
  const tools = el("span", { className: "palette-tools" }, all, toggle,
    ...["css", "gpl", "json"].map((kind) => {
      const d = el("button", { type: "button", className: "palette-dl", textContent: { css: "CSS", gpl: "GIMP", json: "JSON" }[kind] });
      d.dataset.download = kind;
      d.setAttribute("aria-label", `Download ${name} palette as ${{ css: "CSS custom properties", gpl: "a GIMP .gpl palette", json: "JSON" }[kind]}`);
      d.addEventListener("click", () => download(name, list, mode, kind));
      return d;
    }));
  target.replaceChildren(...chips, tools);
};
document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-exact-toggle]")) return;
  showExact = !showExact;
  const focusIn = event.target.closest(".palette");
  for (const [target, { colors, name }] of strips) renderPalette(target, colors, name);
  focusIn?.querySelector("[data-exact-toggle]")?.focus();
});

// Colour story: the three palettes clustered together, so a shared ink lines up in one row.
export const renderStory = (root, data, titles) => {
  const files = Object.keys(data);
  const totals = files.map((f) => data[f].reduce((sum, c) => sum + c.n, 0) || 1);
  const pooled = files.flatMap((f, i) => data[f].map((c) => ({ ...c, f: i })));
  const groups = [];
  for (const c of pooled.sort((a, b) => b.n / totals[b.f] - a.n / totals[a.f])) {
    const g = groups.find((g) => distance(g.hex, c.hex) < THRESHOLD);
    const share = c.n / totals[c.f];
    if (g) g.shares[c.f] += share; else groups.push({ hex: c.hex, shares: files.map((_, i) => (i === c.f ? share : 0)) });
  }
  const used = (g) => g.shares.filter(Boolean).length;
  const bands = [[files.length, "In all three"], [2, "In two"], [1, "Only in one"]];

  const stacks = el("div", { className: "story-stacks" });
  stacks.setAttribute("aria-hidden", "true");
  files.forEach((f, i) => {
    const bar = el("div", { className: "story-bar" });
    groups.filter((g) => g.shares[i]).sort((a, b) => b.shares[i] - a.shares[i]).forEach((g) => {
      const seg = el("span");
      seg.style.cssText = `--c:${g.hex};flex-grow:${g.shares[i]}`;
      bar.append(seg);
    });
    stacks.append(el("div", { className: "story-row" }, el("span", { className: "story-name", textContent: titles[f] }), bar));
  });

  const table = el("table", { className: "story-table" });
  table.innerHTML = `<caption class="visually-hidden">Share of each merged colour in the three illustrations</caption>
    <thead><tr><th scope="col">Colour</th>${files.map((f) => `<th scope="col">${titles[f]}</th>`).join("")}</tr></thead>`;
  for (const [count, label] of bands) {
    const rows = groups.filter((g) => used(g) === count);
    if (!rows.length) continue;
    const body = el("tbody");
    body.innerHTML = `<tr class="story-band"><th scope="rowgroup" colspan="${files.length + 1}">${label} <span>${rows.length}</span></th></tr>`
      + rows.map((g) => `<tr><th scope="row"><span class="chip" style="--c:${g.hex}" aria-hidden="true"></span><span class="hex">${g.hex}</span></th>${
        g.shares.map((s) => (s ? `<td><span class="story-cell" style="--c:${g.hex};--w:${Math.max(s * 100, 2).toFixed(1)}%"></span>${pct(s)}</td>` : `<td class="story-none"><span class="visually-hidden">not used</span></td>`)).join("")}</tr>`).join("");
    table.append(body);
  }
  root.replaceChildren(stacks, el("div", { className: "story-scroll" }, table));
};
