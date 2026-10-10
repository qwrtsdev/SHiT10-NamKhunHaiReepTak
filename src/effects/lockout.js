// Fully flooded: the canvas swallows clicks until the water is out (tilt cam or Joy-Con, from the toolbar popup).

effects.push((f) => {
  const full = water.level >= 0.995;
  const pe = full ? 'auto' : 'none';
  if (canvas.style.pointerEvents !== pe) canvas.style.pointerEvents = pe;
  if (!full) return;
  outlinedText(f, LOCK_MESSAGE, f.w / 2, f.h / 2, 36, 'center');
  outlinedText(f, 'click the extension icon: tilt the laptop 📷 or scoop with a Joy-Con 🎮', f.w / 2, f.h / 2 + 40 * f.d, 16, 'center');
});
