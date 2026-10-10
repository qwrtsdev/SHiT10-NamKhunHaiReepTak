// What your mouth is doing to the water, drawn in the middle of the screen: 💨 gusts and spray while
// blowing into the mic (drains/blow.js), 👄 sipping at the surface while drinking (drains/drink.js).
// The shared sim makes the dent; this only draws.

let gustPhase = 0;

effects.push((f) => {
  if (water.level <= 0) return;
  const { ctx, d, dt, t } = f;
  const x = sim.W / 2, top = surfaceAt(x);
  const air = Math.max(top, 170); // keep the 💨 on screen when it's nearly full
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const s = blow.on ? blow.strength : 0;
  if (s > 0) {
    gustPhase += dt * (2 + 6 * s);
    // Spray flies off both sides of the dent, more and faster the harder you blow.
    if (Math.random() < 0.3 + s) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      spray(x + dir * (20 + Math.random() * 120), top, Math.ceil(4 * s), dir * (150 + 450 * s), -250 - 400 * s, 160);
    }
    for (let i = 0; i < 3; i++) {
      const k = (gustPhase + i / 3) % 1; // each gust falls from above onto the water and fades
      ctx.globalAlpha = (1 - k) * Math.min(1, 0.4 + s);
      ctx.font = `${(30 + 30 * s) * d}px serif`;
      ctx.fillText('💨', (x + (i - 1) * 60) * d, (air - 160 + 130 * k) * d);
    }
    ctx.globalAlpha = 1;
  }

  const o = drink.on ? drink.open : 0;
  if (o > 0) {
    // Droplets jump from around the lips into them.
    if (Math.random() < 0.4 + o) {
      const side = Math.random() < 0.5 ? -1 : 1;
      spray(x + side * (40 + Math.random() * 60), top + 6, 1, -side * 120, -160, 40);
    }
    if (Math.random() < o * 0.5) bubble(x + (Math.random() - 0.5) * 30, top + 30 + Math.random() * 40);
    const bob = Math.sin(t * 9) * 3 * o;
    ctx.font = `${(36 + 20 * o) * d}px serif`;
    ctx.fillText('👄', x * d, (Math.max(top, 40) - 8 + bob) * d);
  }
});
