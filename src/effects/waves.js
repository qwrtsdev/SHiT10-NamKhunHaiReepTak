// Two semi-transparent sine-wave layers moving in opposite directions.

function waveLayer({ ctx, t, w, h, top }, amp, len, speed, phase, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w + 8; x += 8) {
    const y = amp * Math.sin(x / len + t * speed + phase) + amp * 0.4 * Math.sin(x / (len * 0.43) - t * speed * 1.7);
    ctx.lineTo(x, top + y);
  }
  ctx.lineTo(w, h);
  ctx.fill();
}

effects.push((f) => {
  if (water.level <= 0) return; // crests would peek above the bottom edge at 0%
  waveLayer(f, 10 * f.d, 90 * f.d, 1.2, 0, 'rgba(30,110,200,0.25)');
  waveLayer(f, 14 * f.d, 140 * f.d, -0.9, 2, 'rgba(40,140,230,0.35)');
});
