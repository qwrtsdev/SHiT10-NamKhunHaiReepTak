// Shared water state, the overlay canvas and the frame loop.
// The level lives in chrome.storage so every tab floods together.
// Effects register with effects.push(fn); each fn(f) runs every frame in manifest order,
// with f = { ctx, t, dt, d, w, h } (t/dt seconds, d devicePixelRatio, w/h canvas size in device px).
// water.level is the volume actually on screen (sim.js moves it toward water.target).

// water.held = water a 🪣 is about to take out (scoop.js): the sim leaves it alone until then.
const water = { level: 0, target: 0, speed: RISE_SPEED, held: 0 };
const effects = [];
// Shared events: waterHooks.rise.push(fn(amount)) when the level goes up,
// waterHooks.scoop.push(fn({ amount, t })) when a Joy-Con scoop took water out.
const waterHooks = { rise: [], scoop: [] };

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
  // Clamp dt: a backgrounded tab resumes without a huge physics jump.
  const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
  lastFrame = now;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  const f = { ctx, t: now / 1000, dt, d: devicePixelRatio, w, h };
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
  if (c.scoop?.newValue) for (const fn of waterHooks.scoop) fn(c.scoop.newValue);
  if (!c.target) return;
  const was = water.target, now = c.target.newValue ?? 0;
  applyWater({ target: now, speed: c.speed?.newValue ?? water.speed });
  if (now > was + 1e-6) for (const fn of waterHooks.rise) fn(now - was);
});

// Raise the shared water level. Called by systems (e.g. systems/claude.js on prompt send).
function flood(multiplier = 1) {
  chrome.storage.local.set({ target: Math.min(1, water.target + STEP), speed: RISE_SPEED * multiplier });
}

// Only the focused tab drains for real (pouring); other tabs follow through storage.
// Otherwise every visible tab would subtract the same pour.
function canDrainHere() {
  return document.hasFocus();
}

// Lower the shared level by `amount` (water that left the screen). Writes are batched.
let drainTimer = 0;
function drain(amount) {
  water.target = Math.max(0, water.target - amount);
  if (drainTimer) return;
  drainTimer = setTimeout(() => {
    drainTimer = 0;
    chrome.storage.local.set({ target: water.target });
  }, 150);
}
