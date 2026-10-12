const DRAINED_TIME = 5; // seconds
let wasWet = false, drainedAt = -Infinity;

effects.push((f) => {
  const wet = water.level > 0;
  if (wasWet && !wet && water.target <= 0) drainedAt = f.t;
  wasWet = wet;
  const k = f.t - drainedAt;
  if (k > DRAINED_TIME) return;
  const { ctx, d } = f, text = 'น้ำหมดแล้วทำงานต่อได้', size = Math.min(72, f.w / d / 14); // shrink to fit narrow windows
  ctx.font = `bold ${size * d}px system-ui, sans-serif`;
  const half = ctx.measureText(text).width / 2;
  const rainbow = ctx.createLinearGradient(f.w / 2 - half, 0, f.w / 2 + half, 0);
  for (let i = 0; i <= 6; i++) rainbow.addColorStop(i / 6, `hsl(${i * 60 + k * 360}, 90%, 50%)`);
  ctx.save();
  ctx.globalAlpha = Math.min(1, (DRAINED_TIME - k) / 0.4);
  outlinedText(f, text, f.w / 2, f.h / 2, size, 'center', rainbow);
  ctx.restore();
});
