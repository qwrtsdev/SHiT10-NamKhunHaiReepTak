// Shared water state, the overlay canvas and the frame loop.
// The level lives in chrome.storage so every tab floods together.
// Effects register with effects.push(fn); each fn(f) runs every frame in manifest order,
// with f = { ctx, t, d, w, h, top } (t seconds, d devicePixelRatio, top = water surface y).

const water = { level: 0, target: 0, speed: RISE_SPEED };
const effects = [];

const canvas = document.createElement('canvas');
canvas.style.cssText =
  'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647';
const ctx = canvas.getContext('2d');
let lastFrame = 0;

function resize() {
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
}

function frame(now) {
  const dt = lastFrame ? (now - lastFrame) / 1000 : 0;
  lastFrame = now;
  water.level = Math.min(water.target, water.level + water.speed * dt);
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  const f = { ctx, t: now / 1000, d: devicePixelRatio, w, h, top: h * (1 - water.level) };
  for (const fx of effects) fx(f);
  requestAnimationFrame(frame);
}

// Text outlined in white so it reads on light and dark pages. size is in CSS px.
function outlinedText({ ctx, d }, text, x, y, size, align = 'start') {
  ctx.font = `bold ${size * d}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.lineWidth = (size / 5) * d;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.fillStyle = 'rgb(15,60,130)';
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

function applyWater({ target, speed }) {
  water.target = target;
  water.speed = speed;
  if (target > 0 && !canvas.isConnected) {
    resize();
    addEventListener('resize', resize);
    document.body.append(canvas);
    requestAnimationFrame(frame);
  }
}

chrome.storage.local.get({ target: 0, speed: RISE_SPEED }, (s) => {
  water.level = s.target; // already-flooded page: start at the current level, no re-rise
  applyWater(s);
});
chrome.storage.onChanged.addListener((c) => {
  if (c.target) applyWater({ target: c.target.newValue ?? 0, speed: c.speed?.newValue ?? water.speed });
});

// Raise the shared water level. Called by systems (e.g. systems/claude.js on prompt send).
function flood(multiplier = 1) {
  chrome.storage.local.set({ target: Math.min(1, water.target + STEP), speed: RISE_SPEED * multiplier });
}
