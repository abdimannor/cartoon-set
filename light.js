// Gallery light: a warm spot follows the cursor across the wall via CSS custom properties.
// Motion is on by default; the motion button turns it off, and the choice is kept in
// localStorage and on <html data-motion> (set before paint in <head>).
// With motion off the light stays parked above the middle print.
const root = document.documentElement;
const button = document.querySelector("[data-motion-toggle]");
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
  const label = moving() ? "Pause motion" : "Play motion";
  button?.setAttribute("aria-pressed", String(moving()));
  button?.setAttribute("aria-label", label);
  if (button) button.title = label;
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
if (button) { button.addEventListener("click", () => choose(moving() ? "off" : "on")); }
sync();
paint();
