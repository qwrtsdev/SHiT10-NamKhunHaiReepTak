// "💧 NN%" label just under the water surface.

effects.push((f) => {
  if (water.level <= 0) return;
  const y = Math.min(f.h - 6 * f.d, f.top + 34 * f.d);
  outlinedText(f, `💧 ${Math.round(water.level * 100)}%`, 12 * f.d, y, 16);
});
