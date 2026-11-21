// Lightbox: renders the original .ai artwork (PDF-compatible) as vectors with pdf.js,
// re-rasterised at the current zoom so lines stay crisp. Wheel, pinch, drag and keys.
import { renderPalette, renderStory } from "./previews/palette.js";

const dialog = document.querySelector("#lightbox");
const view = document.querySelector("#lb-view");
const art = document.querySelector("#lb-art");
const canvas = document.querySelector("#lb-canvas");
const preview = document.querySelector("#lb-preview");
const title = document.querySelector("#lb-title");
const level = document.querySelector("#lb-level");
const items = [...document.querySelectorAll(".zoom-open")];

const MIN = 1, MAX = 12, MAX_PIXELS = 16_000_000;
const origCanvas = document.querySelector("#lb-orig");
const swatchBox = document.querySelector("#remix-swatches");
const compare = document.querySelector("#remix-compare");
const split = document.querySelector("#remix-split");
const s = { i: 0, zoom: 1, x: 0, y: 0, baseW: 1, baseH: 1, page: null, task: null, timer: 0 };
const docs = new Map();
let pdfjs;

const loadPdfjs = async () => {
  if (!pdfjs) {
    pdfjs = await import("./vendor/pdfjs/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
  }
  return pdfjs;
};

const getPage = async (file) => {
  if (!docs.has(file)) {
    const lib = await loadPdfjs();
    docs.set(file, lib.getDocument({ url: file, isEvalSupported: false }).promise.then((d) => d.getPage(1)));
  }
  return docs.get(file);
};

// Palette: the actual colours of the vector file, read from the pdf.js operator list.
// pdf.js normalises every fill and stroke (RGB, CMYK, grey) to a "#rrggbb" argument.
// Returns [{ hex, n }], most used first; n counts the operations that set the colour.
export const paletteOf = async (file) => {
  const page = await getPage(file);
  const { OPS } = pdfjs;
  const colorOps = new Set([OPS.setFillRGBColor, OPS.setStrokeRGBColor]);
  const { fnArray, argsArray } = await page.getOperatorList();
  const count = new Map();
  fnArray.forEach((fn, i) => {
    if (!colorOps.has(fn)) return;
    const hex = String(argsArray[i][0]).toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(hex)) count.set(hex, (count.get(hex) || 0) + 1);
  });
  return [...count].sort((a, b) => b[1] - a[1]).map(([hex, n]) => ({ hex, n }));
};

// Swatch strips. Prints read a precomputed palettes.json (made with paletteOf by
// scripts/palettes.mjs) so pdf.js still never loads with the page; the lightbox reads
// the opened file live.
const status = document.querySelector("#palette-status");
const lbPalette = document.querySelector("#lb-palette");
let stored = {};
document.addEventListener("click", async (event) => {
  const b = event.target.closest("[data-copy]");
  if (!b) return;
  try {
    await navigator.clipboard.writeText(b.dataset.copy);
    status.textContent = `Copied ${b.dataset.copy}`;
  } catch {
    status.textContent = `Copy failed. The colour is ${b.dataset.copy}`;
  }
  b.classList.add("is-copied");
  setTimeout(() => b.classList.remove("is-copied"), 1200);
});
const titles = Object.fromEntries(items.map((b) => [b.dataset.art, b.dataset.title]));
fetch("previews/palettes.json").then((r) => r.json()).then((data) => {
  stored = data;
  document.querySelectorAll("[data-palette]").forEach((el) => {
    renderPalette(el, data[el.dataset.palette] || [], titles[el.dataset.palette] || el.dataset.palette);
  });
  const story = document.querySelector("#story");
  if (story) renderStory(story, data, titles);
}).catch(() => {});

const apply = () => {
  const vw = view.clientWidth, vh = view.clientHeight;
  const w = s.baseW * s.zoom, h = s.baseH * s.zoom;
  // Keep the artwork on screen: centre when smaller than the view, clamp edges when larger.
  s.x = w <= vw ? (vw - w) / 2 : Math.min(0, Math.max(vw - w, s.x));
  s.y = h <= vh ? (vh - h) / 2 : Math.min(0, Math.max(vh - h, s.y));
  art.style.width = `${s.baseW}px`;
  art.style.height = `${s.baseH}px`;
  art.style.transform = `translate(${s.x}px, ${s.y}px) scale(${s.zoom})`;
  level.textContent = `${Math.round(s.zoom * 100)}%`;
  view.classList.toggle("is-zoomed", s.zoom > 1.01);
};

// Remix: a colour map applied while pdf.js paints. pdf.js hands every fill and stroke
// colour to the 2D context as "#rrggbb", so an own fillStyle/strokeStyle accessor on
// the render context swaps mapped colours before they reach the canvas. The vectors are
// re-rendered, not the pixels, so edges and anti-aliasing stay true.
const remix = new Map();
const proto = CanvasRenderingContext2D.prototype;
const mapped = (ctx) => {
  for (const key of ["fillStyle", "strokeStyle"]) {
    const d = Object.getOwnPropertyDescriptor(proto, key);
    Object.defineProperty(ctx, key, {
      configurable: true,
      get() { return d.get.call(this); },
      set(v) { d.set.call(this, typeof v === "string" && remix.has(v.toLowerCase()) ? remix.get(v.toLowerCase()) : v); },
    });
  }
  return ctx;
};
const renderTo = (page, scale, withMap) => {
  const viewport = page.getViewport({ scale });
  const off = document.createElement("canvas");
  off.width = Math.floor(viewport.width);
  off.height = Math.floor(viewport.height);
  const ctx = off.getContext("2d");
  const task = page.render({ canvas: off, canvasContext: withMap ? mapped(ctx) : ctx, viewport, background: "#fff" });
  return { off, task };
};

const render = async () => {
  if (!s.page) return;
  const page = s.page;
  const unit = page.getViewport({ scale: 1 });
  let scale = (s.baseW / unit.width) * s.zoom * (devicePixelRatio || 1);
  const area = unit.width * unit.height * scale * scale;
  if (area > MAX_PIXELS) scale *= Math.sqrt(MAX_PIXELS / area);
  s.task?.cancel();
  s.origTask?.cancel();
  const main = renderTo(page, scale, remix.size > 0);
  s.task = main.task;
  const comparing = compare.checked && remix.size > 0;
  const orig = comparing ? renderTo(page, scale, false) : null;
  s.origTask = orig?.task;
  try {
    await Promise.all([main.task.promise, orig?.task.promise]);
  } catch {
    return;
  }
  if (page !== s.page) return;
  canvas.width = main.off.width;
  canvas.height = main.off.height;
  canvas.getContext("2d").drawImage(main.off, 0, 0);
  origCanvas.hidden = !orig;
  if (orig) {
    origCanvas.width = orig.off.width;
    origCanvas.height = orig.off.height;
    origCanvas.getContext("2d").drawImage(orig.off, 0, 0);
  }
  art.classList.add("is-vector");
};

const scheduleRender = () => {
  clearTimeout(s.timer);
  s.timer = setTimeout(render, 160);
};

const fit = () => {
  const ratio = preview.naturalHeight ? preview.naturalWidth / preview.naturalHeight : 1131 / 1600;
  const vw = view.clientWidth, vh = view.clientHeight;
  s.baseH = Math.min(vh, vw / ratio);
  s.baseW = s.baseH * ratio;
  s.zoom = 1;
  apply();
  scheduleRender();
};

const zoomAt = (factor, px = view.clientWidth / 2, py = view.clientHeight / 2) => {
  const next = Math.min(MAX, Math.max(MIN, s.zoom * factor));
  s.x = px - (px - s.x) * (next / s.zoom);
  s.y = py - (py - s.y) * (next / s.zoom);
  s.zoom = next;
  apply();
  scheduleRender();
};

const show = async (i) => {
  s.i = (i + items.length) % items.length;
  const item = items[s.i];
  title.textContent = item.dataset.title;
  art.classList.remove("is-vector");
  s.page = null;
  canvas.width = canvas.height = 0;
  remix.clear();
  swatchBox.replaceChildren();
  origCanvas.hidden = true;
  preview.src = item.dataset.preview;
  renderPalette(lbPalette, stored[item.dataset.art] || [], item.dataset.title);
  await preview.decode().catch(() => {});
  fit();
  try {
    const page = await getPage(item.dataset.art);
    if (items[s.i] !== item) return;
    s.page = page;
    render();
    const colors = await paletteOf(item.dataset.art).catch(() => stored[item.dataset.art] || []);
    if (items[s.i] === item) {
      renderPalette(lbPalette, colors, item.dataset.title);
      buildRemix(colors);
    }
  } catch {
    // The PNG preview stays visible if the vector file cannot load.
  }
};

// Warm pdf.js up on intent (hover or focus), never on page load.
const warm = () => loadPdfjs().catch(() => { pdfjs = undefined; });
items.forEach((item) => {
  item.addEventListener("pointerenter", warm, { once: true });
  item.addEventListener("focus", warm, { once: true });
});

items.forEach((item, i) => item.addEventListener("click", () => {
  dialog.showModal();
  show(i);
  view.focus();
}));

dialog.addEventListener("click", (event) => {
  const action = event.target.closest("[data-lb]")?.dataset.lb;
  if (action === "in") zoomAt(1.5);
  if (action === "out") zoomAt(1 / 1.5);
  if (action === "fit") fit();
  if (action === "prev") show(s.i - 1);
  if (action === "next") show(s.i + 1);
  if (action === "close") dialog.close();
  if (event.target === dialog) dialog.close();
});

dialog.addEventListener("close", () => items[s.i].focus());

view.addEventListener("wheel", (event) => {
  event.preventDefault();
  const r = view.getBoundingClientRect();
  zoomAt(Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0025)), event.clientX - r.left, event.clientY - r.top);
}, { passive: false });

// Drag to pan, two pointers to pinch.
const pointers = new Map();
let pinch = 0;
view.addEventListener("pointerdown", (event) => {
  view.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, [event.clientX, event.clientY]);
  view.classList.add("is-dragging");
});
view.addEventListener("pointermove", (event) => {
  if (!pointers.has(event.pointerId)) return;
  const [px, py] = pointers.get(event.pointerId);
  pointers.set(event.pointerId, [event.clientX, event.clientY]);
  if (pointers.size === 2) {
    const [[ax, ay], [bx, by]] = [...pointers.values()];
    const dist = Math.hypot(ax - bx, ay - by);
    const r = view.getBoundingClientRect();
    if (pinch) zoomAt(dist / pinch, (ax + bx) / 2 - r.left, (ay + by) / 2 - r.top);
    pinch = dist;
    return;
  }
  s.x += event.clientX - px;
  s.y += event.clientY - py;
  apply();
});
const release = (event) => {
  pointers.delete(event.pointerId);
  pinch = 0;
  if (!pointers.size) view.classList.remove("is-dragging");
};
view.addEventListener("pointerup", release);
view.addEventListener("pointercancel", release);

view.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 160 : 48;
  const keys = {
    "+": () => zoomAt(1.25), "=": () => zoomAt(1.25), "-": () => zoomAt(0.8), "0": fit,
    ArrowLeft: () => { s.x += step; apply(); }, ArrowRight: () => { s.x -= step; apply(); },
    ArrowUp: () => { s.y += step; apply(); }, ArrowDown: () => { s.y -= step; apply(); },
    PageDown: () => show(s.i + 1), PageUp: () => show(s.i - 1),
  };
  if (!keys[event.key]) return;
  event.preventDefault();
  keys[event.key]();
});

addEventListener("resize", () => dialog.open && fit());

// Remix controls: one colour input per ink (most used first), a reset, a compare split
// and a PNG download rendered from the vectors at print-friendly size.
const REMIX_MAX = 12;
const buildRemix = (colors) => {
  swatchBox.replaceChildren(...colors.slice(0, REMIX_MAX).map(({ hex }) => {
    const label = document.createElement("label");
    label.className = "remix-swatch";
    const input = document.createElement("input");
    input.type = "color";
    input.value = hex;
    input.dataset.from = hex;
    const text = document.createElement("span");
    text.className = "visually-hidden";
    text.textContent = `Replace ${hex}`;
    label.append(input, text);
    return label;
  }));
};
swatchBox.addEventListener("input", (event) => {
  const input = event.target.closest("input[data-from]");
  if (!input) return;
  if (input.value.toLowerCase() === input.dataset.from) remix.delete(input.dataset.from);
  else remix.set(input.dataset.from, input.value.toLowerCase());
  input.parentElement.classList.toggle("is-changed", remix.has(input.dataset.from));
  scheduleRender();
});
const setSplit = () => art.style.setProperty("--split", `${split.value}%`);
compare.addEventListener("change", () => {
  split.disabled = !compare.checked;
  art.classList.toggle("is-comparing", compare.checked);
  setSplit();
  render();
});
split.addEventListener("input", setSplit);
document.querySelector("#remix-reset").addEventListener("click", () => {
  remix.clear();
  swatchBox.querySelectorAll("input[data-from]").forEach((input) => {
    input.value = input.dataset.from;
    input.parentElement.classList.remove("is-changed");
  });
  render();
});
document.querySelector("#remix-download").addEventListener("click", async () => {
  if (!s.page) return;
  const unit = s.page.getViewport({ scale: 1 });
  const scale = Math.sqrt(8_000_000 / (unit.width * unit.height));
  const { off, task } = renderTo(s.page, scale, remix.size > 0);
  try { await task.promise; } catch { return; }
  off.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${items[s.i].dataset.art.replace(/\.ai$/, "")}${remix.size ? "-remix" : ""}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, "image/png");
});
