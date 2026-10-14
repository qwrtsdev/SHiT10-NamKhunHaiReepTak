// effects: effects.push(fn); fn(f) runs every frame in manifest order,
// with f = { ctx, t, dt, d, w, h } (t/dt seconds, d devicePixelRatio, w/h canvas size in device px).
// water.level is the volume actually on screen (it trails water.target while rising or draining).

const water = { level: 0, target: 0 };
const effects = [];
// shared events: waterHooks.rise.push(fn(amount)) when the level goes up,
// waterHooks.scoop.push(fn({ x, amount })) when a scoop starts (x = 0–1 across the screen).
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
  // clamp dt: a backgrounded tab resumes without a huge physics jump.
  const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
  lastFrame = now;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  const f = { ctx, t: now / 1000, dt, d: devicePixelRatio, w, h };
  for (const fx of effects) fx(f);
  requestAnimationFrame(frame);
}

// text outlined in white so it reads on light and dark pages. size is in CSS px.
function outlinedText({ ctx, d }, text, x, y, size, align = 'start', fill = 'rgb(15,60,130)') {
  ctx.font = `bold ${size * d}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.lineWidth = (size / 5) * d;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.fillStyle = fill;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

function applySim(s) {
  const n = s.h.length, ky = innerHeight / SIM_H;
  if (sim.n !== n) Object.assign(sim, { n, h: new Float32Array(n), q: new Float32Array(n + 1) });
  sim.W = innerWidth;
  sim.H = innerHeight;
  sim.dx = sim.W / n;
  for (let i = 0; i < n; i++) sim.h[i] = s.h[i] * ky;
  sim.tilt = s.tilt;
  sim.pour = s.pour;
  water.level = s.level;
}

let simPort = null, simConnecting = false;
async function simConnect() {
  if (simPort || simConnecting || document.hidden || !canvas.isConnected) return;
  simConnecting = true;
  try {
    await chrome.runtime.sendMessage({ type: 'ensureSim' });
    simPort = chrome.runtime.connect({ name: 'sim' });
  } catch {
    return; // the extension was reloaded: this copy of the script is orphaned
  } finally {
    simConnecting = false;
  }
  simPort.onMessage.addListener((m) => {
    if (m.h) applySim(m);
    if (m.bucket) for (const fn of waterHooks.scoop) fn(m.bucket);
  });
  simPort.onDisconnect.addListener(() => {
    simPort = null;
    setTimeout(simConnect, 500);
  });
  if (document.hidden) simDisconnect();
}

// hidden tabs don't draw, so they don't need the stream.
function simDisconnect() {
  simPort?.disconnect();
  simPort = null;
}
document.addEventListener('visibilitychange', () => (document.hidden ? simDisconnect() : simConnect()));

function applyWater(target) {
  water.target = target;
  if (target > 0 && !canvas.isConnected) {
    simInit(water.level, innerWidth, innerHeight);
    resize();
    addEventListener('resize', resize);
    document.body.append(canvas);
    requestAnimationFrame(frame);
    simConnect();
  }
}

chrome.storage.local.get({ target: 0 }, (s) => {
  water.level = s.target; // already-flooded page: start at the current level, no re-rise
  applyWater(s.target);
});
chrome.storage.onChanged.addListener((c) => {
  if (!c.target) return;
  const was = water.target, now = c.target.newValue ?? 0;
  applyWater(now);
  if (now > was + 1e-6) for (const fn of waterHooks.rise) fn(now - was);
});

function flood(chars, multiplier = 1) {
  const amount = chars * WATER_PER_CHAR * multiplier;
  chrome.storage.local.set({ target: Math.min(1, water.target + amount) });
}
