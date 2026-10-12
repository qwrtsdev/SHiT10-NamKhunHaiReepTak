// Only draws the 🪣; offscreen/sim.js takes the water out when the bucket reaches it.

const buckets = [];
const BUCKET_TIME = 1.1; // seconds

waterHooks.scoop.push(({ x }) => buckets.push({ x, t0: performance.now() / 1000, dipped: false }));

effects.push((f) => {
  const now = performance.now() / 1000;
  for (let i = buckets.length - 1; i >= 0; i--) {
    const b = buckets[i], k = now - b.t0, x = b.x * sim.W;
    if (k > BUCKET_TIME) { buckets.splice(i, 1); continue; }
    if (k > BUCKET_DIP && !b.dipped) {
      b.dipped = true;
      spray(x, surfaceAt(x), 14, 0, -350, 300);
    }
    const low = surfaceAt(x) + 10;
    const y = k < BUCKET_DIP
      ? -60 + (low + 60) * Math.sin(((k / BUCKET_DIP) * Math.PI) / 2)
      : low - (low + 120) * ((k - BUCKET_DIP) / (BUCKET_TIME - BUCKET_DIP)) ** 2;
    const tip = k < BUCKET_DIP ? 0.6 * (1 - k / BUCKET_DIP) : -0.15;
    if (b.dipped && Math.random() < 0.6) spray(x + (Math.random() - 0.5) * 40, y + 20, 1, 0, 60, 40);
    const { ctx, d } = f;
    ctx.save();
    ctx.translate(x * d, y * d);
    ctx.rotate(tip);
    ctx.font = `${64 * d}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🪣', 0, 0);
    ctx.restore();
  }
});
