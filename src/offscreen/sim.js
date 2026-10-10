// The one water simulation shared by every tab. Runs in the extension's offscreen document
// (created by background.js), so waves, tilt and pours are computed once instead of once per tab.
// Tabs connect a port named 'sim' while visible. They send { tilt } (focused tab only) and get
// { h, tilt, pour, level } every tick, plus { bucket: { x, amount } } when a Joy-Con scoop starts.
// A tab that is blowing or drinking also sends { take: { kind, x, amount, power } } (see take()).
// Offscreen documents only get chrome.runtime, so background.js relays chrome.storage both ways.

const TICK = 16; // ms between steps / broadcasts
const ports = new Set();
let ready = false, target = 0, speed = RISE_SPEED, held = 0;
let tiltTarget = 0, tiltFrom = null;
let written = -1, drainTimer = 0, lastTick = performance.now(), wasIdle = false;

simInit(0, SIM_W, SIM_H);

chrome.runtime.sendMessage({ type: 'simInit' }).then((s) => {
  target = s.target ?? 0;
  speed = s.speed ?? RISE_SPEED;
  simInit(target, SIM_W, SIM_H); // already flooded: start at the current level, no re-rise
  ready = true;
});

chrome.runtime.onMessage.addListener((m) => {
  if (m.type !== 'storage') return;
  if (m.speed != null) speed = m.speed;
  // Ignore the echo of our own drain write: we've poured more since then.
  if (m.target != null && m.target !== written) target = m.target;
  if (m.scoop) scoop(m.scoop.amount);
});

chrome.runtime.onConnect.addListener((p) => {
  if (p.name !== 'sim') return;
  ports.add(p);
  wasIdle = false; // send the newcomer the current state on the next tick
  p.onMessage.addListener((m) => {
    if (m.take) take(m.take);
    if (m.tilt == null) return;
    tiltTarget = Math.max(-MAX_TILT, Math.min(MAX_TILT, m.tilt));
    tiltFrom = p;
  });
  p.onDisconnect.addListener(() => {
    ports.delete(p);
    if (tiltFrom === p) tiltTarget = 0;
  });
});

// Water that poured off the edge leaves every tab. Writes are batched.
function drain(amount) {
  target = Math.max(0, target - amount);
  if (drainTimer) return;
  drainTimer = setTimeout(() => {
    drainTimer = 0;
    written = target;
    chrome.runtime.sendMessage({ type: 'setTarget', target }).catch(() => {});
  }, 150);
}

// A Joy-Con scoop: the joycon window already lowered the stored level. Keep that water on screen
// (held) until the 🪣 tabs draw at x reaches it, then take it out around x; the dent refills as waves.
function scoop(amount) {
  const level = simVolume();
  if (!ready || level <= 0) return;
  const x = SIM_W * (0.2 + Math.random() * 0.6), keep = Math.min(amount, level), radius = 90;
  held += keep;
  for (const p of ports) p.postMessage({ bucket: { x: x / SIM_W, amount } });
  setTimeout(() => {
    held = Math.max(0, held - keep);
    simRemove(Math.min(amount, simVolume()), (i) => {
      const dist = Math.abs((i + 0.5) * sim.dx - x);
      return dist < radius * 2 ? 1 + Math.cos((Math.PI * Math.min(dist, radius * 2)) / (radius * 2)) : 0;
    });
    splash(x, -60000); // water rushes back into the hole
  }, BUCKET_DIP * 1000);
}

// Blowing (kind 'blow') pushes the water away from x, so it leaves a dent that sloshes outward;
// drinking ('drink') sucks it out right at the mouth. Either way the water leaves every tab.
function take({ kind, x, amount, power = 0 }) {
  const level = simVolume();
  if (!ready || level <= 0 || !(amount > 0)) return;
  const cx = SIM_W * Math.max(0, Math.min(1, x)), radius = kind === 'blow' ? 220 : 70;
  const got = simRemove(Math.min(amount, level), (i) => {
    const dist = Math.abs((i + 0.5) * sim.dx - cx);
    return dist < radius ? 1 + Math.cos((Math.PI * dist) / radius) : 0;
  });
  drain(got);
  if (kind === 'blow') splash(cx, 45000 * power, 8);
  else splash(cx, -12000 * power, 3);
}

function step(dt) {
  sim.tilt += (tiltTarget - sim.tilt) * Math.min(1, dt * 6);
  // Follow the shared level: rise at the model's speed, or fall when the Joy-Con / cheat drained.
  const level = simVolume(), goal = Math.min(1, target + held);
  if (level < goal) simAdd(Math.min(speed * dt, goal - level));
  else if (level > goal + 1e-4) simRemove(Math.min(DRAIN_SPEED * dt, level - goal));
  const poured = simStep(dt, true);
  if (poured > 0) drain(poured);
}

setInterval(() => {
  const now = performance.now();
  // If the timer gets throttled, catch up in ≤50 ms steps instead of slowing the water down.
  let dt = Math.min(1, (now - lastTick) / 1000);
  lastTick = now;
  if (!ready) return;
  for (; dt > 0; dt -= 0.05) step(Math.min(dt, 0.05));

  let level = simVolume();
  if (target <= 0 && level < 0.002) sim.h.fill(0), sim.q.fill(0), (level = 0);
  const idle = level === 0 && held === 0 && Math.abs(sim.tilt - tiltTarget) < 1e-4;
  if (idle && wasIdle) return; // nothing moving: tabs keep the last frame
  wasIdle = idle;
  const msg = { h: Array.from(sim.h, (v) => Math.round(v * 10) / 10), tilt: sim.tilt, pour: sim.pour, level };
  for (const p of ports) p.postMessage(msg);
}, TICK);
