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
  return groups.map((g) => ({ ...g, share: g.n / total }));
};
export const exact = (colors) => cluster(colors, 0);

const pct = (share) => (share >= 0.1 ? `${Math.round(share * 100)}%` : `${(share * 100).toFixed(1)}%`);
