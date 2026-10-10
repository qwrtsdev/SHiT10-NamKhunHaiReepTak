// Fully flooded: the canvas swallows clicks until the water is drained (extension icon).

effects.push((f) => {
  const full = water.level >= 1;
  const pe = full ? 'auto' : 'none';
  if (canvas.style.pointerEvents !== pe) canvas.style.pointerEvents = pe;
  if (full) outlinedText(f, LOCK_MESSAGE, f.w / 2, f.h / 2, 36, 'center');
});
