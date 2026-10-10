// Random junk (OBJECTS in config.js) that falls in with each prompt, then floats or drowns.
// Each object is a disc with a density: buoyancy ∝ how much of it is under the surface, so light
// things bob on the waves and lean with the surface, heavy things sink, slide along the bottom when
// tilted, and soggy things (soak) take on water until they sink. Splashes go back into the sim.
// Drawn before waves.js, so whatever is under water gets tinted by it.

const junk = [];
let junkSeeded = false, junkNextRandom = 0, junkPending = 0;

function spawnJunk(inWater = false) {
  if (junk.length >= MAX_OBJECTS || !sim.h) return;
  const kind = OBJECTS[Math.floor(Math.random() * OBJECTS.length)];
  const r = kind.size / 2;
  const x = r + Math.random() * (sim.W - 2 * r);
  const top = surfaceAt(x);
  junk.push({
    kind, r, x,
    y: inWater ? top + (kind.density < 1 ? 0 : Math.random() * (sim.H - top)) : -r - Math.random() * 150,
    vx: (Math.random() - 0.5) * 120,
    vy: inWater ? 0 : 100 + Math.random() * 200,
    a: Math.random() * 6.28,
    va: (Math.random() - 0.5) * 4,
    density: kind.density,
    sub: inWater ? 0.5 : 0, // submerged fraction 0–1
    stranded: 0,
    gone: false,
  });
}

// Take floating junk near x out of the water (the Joy-Con bucket scoops it up).
function grabJunk(x, radius) {
  const got = junk.filter((o) => !o.gone && o.sub > 0 && o.sub < 1 && Math.abs(o.x - x) < radius);
  for (const o of got) o.gone = true;
  return got;
}

function drawJunk({ ctx, d }, o, x, y, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha * Math.min(1, (4 - o.stranded) / 1.5); // fades out over the last 1.5 s stranded
  ctx.translate(x * d, y * d);
  ctx.rotate(o.a);
  ctx.font = `${o.kind.size * d}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(o.kind.e, 0, 0);
  ctx.restore();
}

// 1–2 new things per prompt (spawned on the next frame, once the sim exists).
waterHooks.rise.push(() => (junkPending += Math.random() < 0.5 ? 2 : 1));

function stepJunk(o, dt, gx, gy) {
  const { r } = o;
  const top = surfaceAt(o.x);
  const wet = depthAt(o.x) > 2;
  const was = o.sub;
  o.sub = wet ? Math.max(0, Math.min(1, (o.y - top + r) / (2 * r))) : 0;

  // Gravity minus buoyancy, both along the (tilted) gravity vector.
  const lift = 1 - o.sub / o.density;
  let ax = gx * lift, ay = gy * lift;
  if (o.sub > 0) {
    // Water drag pulls the object toward the water's own motion; floaters also slide down wave slopes.
    ax += (flowAt(o.x) - o.vx) * 3 * o.sub - slopeAt(o.x) * gy * 0.5 * (o.sub < 1 ? 1 : 0);
    ay += -o.vy * 3.5 * o.sub;
  }
  o.vx += ax * dt;
  o.vy += ay * dt;
  o.x += o.vx * dt;
  o.y += o.vy * dt;

  // Hitting the water: dent the surface and throw spray.
  if (was === 0 && o.sub > 0 && o.vy > 150) {
    splash(o.x, Math.min(150000, o.vy * r * 6));
    spray(o.x, top, Math.min(18, o.vy / 40), 0, -o.vy * 0.5, o.vy * 0.6);
  }

  // Floaters lean with the surface; everything else spins freely or rolls on the bottom.
  if (o.sub > 0 && o.sub < 1) o.va += (Math.atan(slopeAt(o.x)) - wrapAngle(o.a)) * 10 * dt - o.va * 4 * dt;
  else if (o.sub > 0) o.va -= o.va * 2 * dt;
  o.a += o.va * dt;

  // Soggy things drown, bubbling as they go.
  if (o.kind.soak && o.sub > 0.4) o.density = Math.min(1.3, o.density + o.kind.soak * dt);
  if (o.sub === 1 && o.vy > 15 && Math.random() < dt * 2.5) bubble(o.x + (Math.random() - 0.5) * r, o.y - r * 0.5);

  // Bottom: friction, unless the tilt is steep enough to slide.
  if (o.y > sim.H - r) {
    o.y = sim.H - r;
    if (o.vy > 0) o.vy *= -0.15;
    const normal = Math.max(0, gy * lift);
    o.vx -= Math.sign(o.vx) * Math.min(Math.abs(o.vx), 0.35 * normal * dt);
    o.va = o.vx / r;
  }
  // Walls, except the edge that is pouring: floating junk gets washed out with the water.
  const pouring = (side) => sim.pour[side] > 0 && o.sub > 0;
  if (o.x < r && !pouring(0)) { o.x = r; o.vx = Math.abs(o.vx) * 0.3; }
  if (o.x > sim.W - r && !pouring(1)) { o.x = sim.W - r; o.vx = -Math.abs(o.vx) * 0.3; }
  if (o.x < -2 * r || o.x > sim.W + 2 * r || o.y < -sim.H) o.gone = true;

  // Left high and dry: fade away after a while instead of littering the page forever.
  o.stranded = !wet && o.y >= sim.H - r - 1 ? o.stranded + dt : 0;
  if (o.stranded > 4) o.gone = true;
}

function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

// Push overlapping objects apart so sunk junk piles up instead of overlapping.
function separateJunk() {
  for (let i = 0; i < junk.length; i++) {
    for (let j = i + 1; j < junk.length; j++) {
      const a = junk[i], b = junk[j];
      const dx = b.x - a.x, dy = b.y - a.y, min = (a.r + b.r) * 0.8;
      const dist = Math.hypot(dx, dy);
      if (dist >= min || dist === 0) continue;
      const push = (min - dist) / 2, nx = dx / dist, ny = dy / dist;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        a.vx += rel * nx * 0.5; a.vy += rel * ny * 0.5;
        b.vx -= rel * nx * 0.5; b.vy -= rel * ny * 0.5;
      }
    }
  }
}

effects.push((f) => {
  if (!junkSeeded && water.level > 0.02) {
    // Page opened on an already-flooded screen: some junk is already in there.
    junkSeeded = true;
    for (let i = Math.round(water.level * 8); i > 0; i--) spawnJunk(true);
  }
  for (; junkPending > 0; junkPending--) spawnJunk();
  if (water.level > 0.15 && f.t > junkNextRandom) {
    if (junkNextRandom) spawnJunk();
    junkNextRandom = f.t + 20 + Math.random() * 25;
  }

  const gx = GRAVITY * Math.sin(sim.tilt), gy = GRAVITY * Math.cos(sim.tilt);
  const steps = 2, dt = f.dt / steps;
  for (let s = 0; s < steps; s++) for (const o of junk) stepJunk(o, dt, gx, gy);
  separateJunk();
  for (let i = junk.length - 1; i >= 0; i--) if (junk[i].gone) junk.splice(i, 1);
  for (const o of junk) drawJunk(f, o, o.x, o.y);
});
