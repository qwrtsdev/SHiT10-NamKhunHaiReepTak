// spray() / bubble() can be called from any effect.

const drops = [];

function spray(x, y, n, vx, vy, spread) {
  for (let i = 0; i < n && drops.length < 500; i++) {
    drops.push({
      x, y,
      vx: vx + (Math.random() - 0.5) * spread,
      vy: vy + (Math.random() - 0.5) * spread,
      r: 1.5 + Math.random() * 2.5,
      air: 0, // seconds in the air: don't merge back into the water you just left
    });
  }
}

function bubble(x, y, r = 2 + Math.random() * 3) {
  if (drops.length < 500) drops.push({ x, y, vx: 0, vy: -40 - r * 15, r, bubble: true, air: 0 });
}

effects.push((f) => {
  const { ctx, d, dt } = f;
  const gx = GRAVITY * Math.sin(sim.tilt), gy = GRAVITY * Math.cos(sim.tilt);

  for (const side of [0, 1]) {
    const p = sim.pour[side];
    if (p <= 0) continue;
    const x = side ? sim.W - 2 : 2, dir = side ? 1 : -1;
    const top = surfaceAt(x), depth = sim.H - top;
    const n = Math.min(12, Math.ceil((p / 20000) * dt * 60));
    for (let i = 0; i < n; i++) spray(x, top + Math.random() * Math.min(depth, 80), 1, dir * (250 + Math.random() * 350), -80, 160);
  }

  ctx.lineWidth = d;
  for (let i = drops.length - 1; i >= 0; i--) {
    const p = drops[i];
    p.air += dt;
    if (p.bubble) {
      p.x += Math.sin((p.air + p.r) * 9) * 20 * dt;
      p.y += p.vy * dt;
      if (p.y <= surfaceAt(p.x) + p.r || p.air > 6) { drops.splice(i, 1); continue; }
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(p.x * d, p.y * d, p.r * d, 0, 7);
      ctx.stroke();
      continue;
    }
    p.vx += gx * dt * 0.5; // droplets are drawn at half gravity so the arc is visible
    p.vy += gy * dt * 0.5;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if ((p.vy > 0 && p.air > 0.05 && p.y > surfaceAt(p.x)) || p.x < -20 || p.x > sim.W + 20 || p.y > sim.H + 20) {
      drops.splice(i, 1);
      continue;
    }
    ctx.fillStyle = 'rgba(190,225,255,0.85)';
    ctx.beginPath();
    ctx.arc(p.x * d, p.y * d, p.r * d, 0, 7);
    ctx.fill();
  }
});
