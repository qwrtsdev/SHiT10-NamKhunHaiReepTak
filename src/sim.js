// Water physics. The viewport is a 2D tank split into columns COL px wide, simulated with the
// shallow-water equations on a staggered grid: depth h per column, flux q across column borders.
// That gives travelling waves, sloshing, splashes from objects, and — when the screen is tilted —
// a sloped surface with water pouring off the low edge.
// Units: px and seconds.
// Loaded in two places: the offscreen document (offscreen/sim.js) steps it in a fixed SIM_W × SIM_H
// tank, once for all tabs; each tab gets the height field, scaled to its viewport (core.js), and
// only uses the read helpers (surfaceAt, depthAt, slopeAt) to draw.

const sim = {
  n: 0, dx: COL, W: 0, H: 0,
  h: null, // depth per column (px)
  q: null, // flux across the border left of column i, n + 1 entries (px²/s, + = rightward)
  tilt: 0, // current screen tilt in radians, + = right edge down (eased toward the tabs' tilt)
  pour: [0, 0], // px²/s currently pouring out of the left / right edge
};

function simInit(level, W, H) {
  sim.W = W;
  sim.H = H;
  sim.n = Math.max(8, Math.round(sim.W / COL));
  sim.dx = sim.W / sim.n;
  sim.h = new Float32Array(sim.n).fill(level * sim.H);
  sim.q = new Float32Array(sim.n + 1);
}

// Water on screen as a fraction of the viewport area.
function simVolume() {
  let s = 0;
  for (const v of sim.h) s += v;
  return (s * sim.dx) / (sim.W * sim.H);
}

function simAdd(frac) {
  const d = frac * sim.H;
  for (let i = 0; i < sim.n; i++) sim.h[i] += d;
}

// Remove `frac` of the viewport's worth of water, weighted by weight(i) (default: evenly).
// Whatever the weighted columns can't supply comes evenly from the rest. Returns the fraction removed.
function simRemove(frac, weight = () => 1) {
  const { h, n } = sim;
  let left = (frac * sim.W * sim.H) / sim.dx; // in summed-depth units
  const total = left;
  for (const w of [weight, () => 1]) {
    for (let pass = 0; pass < 6 && left > 1e-6; pass++) {
      let ws = 0;
      for (let i = 0; i < n; i++) if (h[i] > 0) ws += w(i);
      if (ws <= 0) break;
      let took = 0;
      for (let i = 0; i < n; i++) {
        if (h[i] <= 0) continue;
        const t = Math.min(h[i], (left * w(i)) / ws);
        h[i] -= t;
        took += t;
      }
      left -= took;
    }
  }
  return ((total - left) * sim.dx) / (sim.W * sim.H);
}

function simCol(x) {
  return Math.max(0, Math.min(sim.n - 1, Math.floor(x / sim.dx)));
}

// Surface height (CSS px from the top) at x, linearly interpolated between column centres.
function surfaceAt(x) {
  if (!sim.h) return innerHeight;
  const c = Math.max(0, Math.min(sim.n - 1.001, x / sim.dx - 0.5));
  const i = Math.floor(c), k = c - i;
  return sim.H - (sim.h[i] * (1 - k) + sim.h[Math.min(sim.n - 1, i + 1)] * k);
}

function depthAt(x) {
  return sim.h ? sim.h[simCol(x)] : 0;
}

// dy/dx of the surface (screen coordinates, + = surface goes down to the right).
function slopeAt(x) {
  return (surfaceAt(x + sim.dx) - surfaceAt(x - sim.dx)) / (2 * sim.dx);
}

// Push water away from x (strength > 0, e.g. something falling in) or toward it (< 0).
// Mass-conserving: it only moves flux, so the dent becomes waves that run outward.
function splash(x, strength, spread = 5) {
  if (!sim.h) return;
  const c = simCol(x);
  for (let k = 0; k < spread; k++) {
    const s = (strength / spread) * (1 + Math.cos((Math.PI * k) / spread));
    if (c - k >= 1) sim.q[c - k] -= s;
    if (c + k + 1 <= sim.n - 1) sim.q[c + k + 1] += s;
  }
}

// How fast water pours off the low edge (px²/s) when tilted past TILT_LIP.
function spillFlux(depth, gy) {
  const t = Math.abs(sim.tilt);
  if (t < TILT_LIP || depth <= 0) return 0;
  const open = Math.min(1, 0.35 + (0.65 * (t - TILT_LIP)) / (MAX_TILT - TILT_LIP));
  const weir = SPILL_RATE * depth * Math.sqrt(gy * depth); // broad-crested weir: q ∝ h^1.5
  return open * Math.min(weir, MAX_POUR * sim.W * sim.H);
}

// Advance the simulation. With `open`, the low edge pours; returns the fraction of the screen that left.
function simStep(dt, open) {
  const { n, dx, h, q } = sim;
  const gx = GRAVITY * Math.sin(sim.tilt), gy = GRAVITY * Math.cos(sim.tilt);
  let maxH = 1;
  for (let i = 0; i < n; i++) if (h[i] > maxH) maxH = h[i];
  // CFL: a wave (speed √(g·h)) must not cross more than ~half a column per substep.
  const sub = Math.min(16, Math.max(1, Math.ceil(dt / ((0.45 * dx) / Math.sqrt(gy * maxH)))));
  const s = dt / sub;
  const damp = Math.pow(1 - WAVE_DAMP, s);
  const scale = new Float32Array(n);
  let out = 0;
  sim.pour[0] = sim.pour[1] = 0;

  for (let k = 0; k < sub; k++) {
    for (let i = 1; i < n; i++) {
      const d = (h[i - 1] + h[i]) / 2;
      if (d <= 0) { q[i] = 0; continue; }
      // Surface-height difference pushes water downhill; the tilt adds a sideways pull.
      q[i] = (q[i] + s * d * ((gy * (h[i - 1] - h[i])) / dx + gx)) * damp;
    }
    // A little viscosity: smooths grid-sized jitter while long waves keep sloshing.
    for (let i = 1, prev = q[0]; i < n; i++) {
      const cur = q[i];
      q[i] += VISCOSITY * (prev - 2 * cur + q[i + 1]);
      prev = cur;
    }
    q[0] = q[n] = 0;
    if (open && sim.tilt > 0) q[n] = spillFlux(h[n - 1], gy);
    if (open && sim.tilt < 0) q[0] = -spillFlux(h[0], gy);

    // Never let a column hand out more water than it holds.
    for (let i = 0; i < n; i++) {
      const o = (Math.max(0, q[i + 1]) + Math.max(0, -q[i])) * s;
      scale[i] = o > h[i] * dx ? (h[i] * dx) / o : 1;
    }
    for (let b = 0; b <= n; b++) {
      if (q[b] > 0 && b > 0) q[b] *= scale[b - 1];
      else if (q[b] < 0 && b < n) q[b] *= scale[b];
    }
    for (let i = 0; i < n; i++) h[i] = Math.max(0, h[i] + (s * (q[i] - q[i + 1])) / dx);

    sim.pour[0] += -q[0] / sub;
    sim.pour[1] += q[n] / sub;
    out += s * (q[n] - q[0]);
  }
  return out / (sim.W * sim.H);
}
