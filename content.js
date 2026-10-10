// Each prompt sent on claude.ai raises a 2D water overlay a bit higher, on every site.
// The level lives in chrome.storage so all tabs share it; clicking the extension icon drains it.
const STEP = 0.12; // fraction of viewport height added per prompt
const RISE_SPEED = 0.03; // viewport heights per second, at ×1
const SELECTOR = '[data-testid="model-selector-dropdown"]';
// Better model / higher effort = faster rise. Matched against the selector's label text;
// order matters ("xhigh" before "high").
const MODELS = { haiku: 1, sonnet: 1.5, opus: 2, fable: 2.5 };
const EFFORTS = { xhigh: 1.75, max: 2, high: 1.5, extended: 1.5, medium: 1.25, low: 1 };
// Audio gets muffled (lowpass cutoff falls from 20 kHz to 300 Hz) as water goes 60% → 70%.
const MUFFLE_FROM = 0.6, MUFFLE_TO = 0.7;

const canvas = document.createElement('canvas');
canvas.style.cssText =
  'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647';
const ctx = canvas.getContext('2d');
let level = 0, target = 0, last = 0, speed = RISE_SPEED;

const tag = document.createElement('span');
tag.title = 'Water rise speed for this model';
tag.style.cssText = 'align-self:center;margin:0 6px;font-size:12px;white-space:nowrap;opacity:.8;pointer-events:none';

function multiplier() {
  const label = document.querySelector(SELECTOR)?.textContent.toLowerCase() ?? '';
  const pick = (table) => Object.entries(table).find(([k]) => label.includes(k))?.[1] ?? 1;
  return pick(MODELS) * pick(EFFORTS);
}

// Keep the 💧 badge next to the model selector; React re-renders it, so re-check on DOM changes.
function badge() {
  const btn = document.querySelector(SELECTOR);
  if (!btn) return;
  if (btn.nextElementSibling !== tag) btn.after(tag);
  const text = `💧 ×${multiplier().toFixed(2).replace(/\.?0+$/, '')}`;
  if (tag.textContent !== text) tag.textContent = text; // only write when changed → no loop
}

// --- audio muffling ---
let actx, filter, muffling = false;
const hooked = new WeakSet();

const cutoff = () => {
  const k = Math.min(1, Math.max(0, (level - MUFFLE_FROM) / (MUFFLE_TO - MUFFLE_FROM)));
  return 20000 * (300 / 20000) ** k;
};

// ponytail: only <audio>/<video> elements in the DOM; page-made Web Audio and shadow-DOM media aren't muffled.
async function muffle(el) {
  if (hooked.has(el) || level < MUFFLE_FROM || !el.currentSrc) return;
  // Routing cross-origin media without CORS through Web Audio outputs silence, so leave it alone.
  if (new URL(el.currentSrc, location.href).origin !== location.origin && !el.crossOrigin) return;
  if (!actx) {
    actx = new AudioContext();
    filter = actx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.connect(actx.destination);
  }
  await actx.resume().catch(() => {});
  // A suspended context (no user gesture yet) would silence the element, so only route when running.
  if (actx.state !== 'running' || hooked.has(el)) return;
  hooked.add(el);
  try { actx.createMediaElementSource(el).connect(filter); } catch {}
}

document.addEventListener('play', (e) => muffle(e.target), true);

// --- water drawing ---
function resize() {
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
}

function wave(t, amp, len, speed, phase, color) {
  const { width: w, height: h } = canvas;
  const top = h * (1 - level);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w + 8; x += 8) {
    const y = amp * Math.sin(x / len + t * speed + phase) + amp * 0.4 * Math.sin(x / (len * 0.43) - t * speed * 1.7);
    ctx.lineTo(x, top + y);
  }
  ctx.lineTo(w, h);
  ctx.fill();
}

function frame(now) {
  const dt = last ? (now - last) / 1000 : 0;
  last = now;
  level = Math.min(target, level + speed * dt);
  const t = now / 1000, d = devicePixelRatio, h = canvas.height;
  ctx.clearRect(0, 0, canvas.width, h);
  if (level > 0) {
    wave(t, 10 * d, 90 * d, 1.2, 0, 'rgba(30,110,200,0.25)');
    wave(t, 14 * d, 140 * d, -0.9, 2, 'rgba(40,140,230,0.35)');
    // Percentage just under the surface, outlined so it reads on light and dark pages.
    const y = Math.min(h - 6 * d, h * (1 - level) + 34 * d);
    ctx.font = `bold ${16 * d}px system-ui, sans-serif`;
    ctx.lineWidth = 3 * d;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.fillStyle = 'rgb(15,60,130)';
    const pct = `💧 ${Math.round(level * 100)}%`;
    ctx.strokeText(pct, 12 * d, y);
    ctx.fillText(pct, 12 * d, y);
  }

  // Fully flooded: canvas swallows clicks until the water is drained (extension icon).
  const full = level >= 1;
  const pe = full ? 'auto' : 'none';
  if (canvas.style.pointerEvents !== pe) canvas.style.pointerEvents = pe;
  if (full) {
    ctx.font = `bold ${36 * d}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 6 * d;
    ctx.strokeText('กรุณาเทน้ำออกจากจอ', canvas.width / 2, h / 2);
    ctx.fillText('กรุณาเทน้ำออกจากจอ', canvas.width / 2, h / 2);
    ctx.textAlign = 'start';
  }

  if (level >= MUFFLE_FROM && !muffling) document.querySelectorAll('audio,video').forEach(muffle);
  muffling = level >= MUFFLE_FROM;
  filter?.frequency.setTargetAtTime(cutoff(), actx.currentTime, 0.05);

  requestAnimationFrame(frame);
}

function apply(state) {
  ({ target, speed } = state);
  if (target > 0 && !canvas.isConnected) {
    resize();
    addEventListener('resize', resize);
    document.body.append(canvas);
    requestAnimationFrame(frame);
  }
}

chrome.storage.local.get({ target: 0, speed: RISE_SPEED }, (s) => {
  level = s.target; // already-flooded page: start at the current level, no re-rise
  apply(s);
});
chrome.storage.onChanged.addListener((c) => {
  if (c.target) apply({ target: c.target.newValue ?? 0, speed: c.speed?.newValue ?? speed });
});

function flood() {
  chrome.storage.local.set({ target: Math.min(1, target + STEP), speed: RISE_SPEED * multiplier() });
}

// --- claude.ai prompt detection ---
if (location.hostname === 'claude.ai') {
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; badge(); });
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  badge();

  // Capture phase: runs before ProseMirror/React clear the input.
  document.addEventListener('keydown', (e) => {
    const input = e.target.closest?.('[data-testid="chat-input"]');
    if (input && e.key === 'Enter' && !e.shiftKey && !e.isComposing && input.textContent.trim()) flood();
  }, true);

  document.addEventListener('click', (e) => {
    const send = e.target.closest?.('[data-testid="chat-input-send"]');
    if (send && !send.disabled) flood();
  }, true);
}
