// A Joy-Con scoop (joycon/joycon.js) shows up here as a 🪣 that dips into the water, takes the
// scooped amount out around it (the dent then refills as waves), and lifts away dripping.

const buckets = [];
const DIP_AT = 0.3, BUCKET_TIME = 1.1; // seconds

function dipBucket(b) {
  const radius = 90;
  water.held = Math.max(0, water.held - b.held);
  simRemove(Math.min(b.amount, water.level), (i) => {
    const dist = Math.abs((i + 0.5) * sim.dx - b.x);
    return dist < radius * 2 ? 1 + Math.cos((Math.PI * Math.min(dist, radius * 2)) / (radius * 2)) : 0;
  });
  splash(b.x, -60000); // water rushes back into the hole
  spray(b.x, surfaceAt(b.x), 14, 0, -350, 300);
  b.dipped = true;
}

waterHooks.scoop.push(({ amount }) => {
  if (!sim.h || water.level <= 0) return;
  const b = { x: sim.W * (0.2 + Math.random() * 0.6), amount, t0: performance.now() / 1000, dipped: false, held: 0 };
  if (document.hidden) return dipBucket(b); // no animation frames in a hidden tab: just take the water
  b.held = Math.min(amount, water.level);
  water.held += b.held; // keep it on screen until the bucket gets there
  buckets.push(b);
});

effects.push((f) => {
  const now = performance.now() / 1000;
  for (let i = buckets.length - 1; i >= 0; i--) {
    const b = buckets[i], k = now - b.t0;
    if (k > DIP_AT && !b.dipped) dipBucket(b);
    if (k > BUCKET_TIME) { buckets.splice(i, 1); continue; }
    const low = surfaceAt(b.x) + 10;
    const y = k < DIP_AT
      ? -60 + (low + 60) * Math.sin(((k / DIP_AT) * Math.PI) / 2)
      : low - (low + 120) * ((k - DIP_AT) / (BUCKET_TIME - DIP_AT)) ** 2;
    const tip = k < DIP_AT ? 0.6 * (1 - k / DIP_AT) : -0.15;
    if (b.dipped && Math.random() < 0.6) spray(b.x + (Math.random() - 0.5) * 40, y + 20, 1, 0, 60, 40);
    const { ctx, d } = f;
    ctx.save();
    ctx.translate(b.x * d, y * d);
    ctx.rotate(tip);
    ctx.font = `${64 * d}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🪣', 0, 0);
    ctx.restore();
  }
});
