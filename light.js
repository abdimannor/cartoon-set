// Gallery light: a warm spot follows the cursor across the wall via CSS custom properties.
// The OS reduced-motion setting is the default; the visible switch overrides it, and the
// choice is kept in localStorage and on <html data-motion> (set before paint in <head>).
// With motion off the light stays parked above the middle print.
const root = document.documentElement;
const os = matchMedia("(prefers-reduced-motion: reduce)");
const button = document.querySelector("[data-motion-toggle]");
const notice = document.querySelector("[data-motion-notice]");
let saved = null;
try { saved = localStorage.getItem("motion"); } catch {}
let frame = 0;
let target = [0.5, 0.35];

const paint = () => {
  frame = 0;
  root.style.setProperty("--lx", `${(target[0] * 100).toFixed(2)}%`);
  root.style.setProperty("--ly", `${(target[1] * 100).toFixed(2)}%`);
};
const moving = () => root.dataset.motion === "on";

const sync = () => {
  button?.setAttribute("aria-pressed", String(moving()));
  if (notice) notice.hidden = !(saved === null && os.matches && !moving());
  if (!moving()) { target = [0.5, 0.35]; root.classList.remove("light-on"); paint(); }
};
const choose = (value) => {
  saved = value;
  try { localStorage.setItem("motion", value); } catch {}
  root.dataset.motion = value;
  sync();
};

addEventListener("pointermove", (event) => {
  if (!moving() || event.pointerType === "touch") return;
  target = [event.clientX / innerWidth, event.clientY / innerHeight];
  root.classList.add("light-on");
  if (!frame) frame = requestAnimationFrame(paint);
}, { passive: true });

document.addEventListener("pointerleave", () => root.classList.remove("light-on"));
os.addEventListener("change", () => { if (saved === null) root.dataset.motion = os.matches ? "off" : "on"; sync(); });
if (button) { button.hidden = false; button.addEventListener("click", () => choose(moving() ? "off" : "on")); }
notice?.querySelector("button")?.addEventListener("click", () => { choose("on"); button?.focus(); });
sync();
paint();
