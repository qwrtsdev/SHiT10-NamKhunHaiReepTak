// Fully flooded: the canvas swallows clicks until the water is out (tilt cam or Joy-Con, from the toolbar popup).

effects.push((f) => {
  const full = water.level >= 0.995;
  const pe = full ? 'auto' : 'none';
  if (canvas.style.pointerEvents !== pe) canvas.style.pointerEvents = pe;
  if (!full) return;
  const big = Math.min(64, f.w / f.d / 16); // shrink on narrow screens so the line fits
  // Flicker 1.5 times a second: under the 3 flashes/s seizure limit (WCAG 2.3.1).
  if (Math.floor(f.t * 3) % 2 === 0) {
    outlinedText(f, '🚨 พอแล้ว เลิกแล้ว ไม่เอาแล้ว 🚨', f.w / 2, f.h / 2 - big * 0.3 * f.d, big, 'center', 'rgb(220,20,20)');
    outlinedText(f, 'น้ำท่วมจอไปหมดแล้ว', f.w / 2, f.h / 2 + big * 0.9 * f.d, big * 0.75, 'center', 'rgb(220,20,20)');
  }
});
