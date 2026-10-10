// Fully flooded: the canvas swallows clicks until the water is out (tilt, Joy-Con, blow or drink).
// While locked, dragging anywhere on the screen tilts it (drains/tilt.js).

effects.push((f) => {
  const full = water.level >= 0.995 || (tiltIn.dragging && water.level >= 0.9);
  const pe = full ? 'auto' : 'none';
  if (canvas.style.pointerEvents !== pe) canvas.style.pointerEvents = pe;
  if (water.level < 0.995) return;
  outlinedText(f, LOCK_MESSAGE, f.w / 2, f.h / 2, 36, 'center');
  outlinedText(f, 'tilt (drag ↔ / 📷), scoop 🎮, blow 🌬️ or drink 👄 it out (bottom-left)', f.w / 2, f.h / 2 + 40 * f.d, 16, 'center');
});
