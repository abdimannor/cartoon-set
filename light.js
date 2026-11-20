// Gallery light: a warm spot follows the cursor across the wall via CSS custom properties.
// With reduced motion the light stays parked above the middle print.
const root = document.documentElement;
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
let frame = 0;
let target = [0.5, 0.35];

const paint = () => {
  frame = 0;
  root.style.setProperty("--lx", `${(target[0] * 100).toFixed(2)}%`);
  root.style.setProperty("--ly", `${(target[1] * 100).toFixed(2)}%`);
};

addEventListener("pointermove", (event) => {
  if (reduce.matches || event.pointerType === "touch") return;
  target = [event.clientX / innerWidth, event.clientY / innerHeight];
  root.classList.add("light-on");
  if (!frame) frame = requestAnimationFrame(paint);
}, { passive: true });

document.addEventListener("pointerleave", () => root.classList.remove("light-on"));
reduce.addEventListener("change", () => { target = [0.5, 0.35]; paint(); });
paint();
