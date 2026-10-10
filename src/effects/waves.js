// Draws the simulated water (sim.js): a lighter back layer, a front body that darkens with depth,
// a highlight along the surface, small wind ripples on top, and a blur of the page behind it.

let waterBlurLayer;

// Small ambient ripples layered on the simulated surface (visual only, no mass).
function waveOffset(x, t, amp, len, speed, phase) {
  return amp * Math.sin(x / len + t * speed + phase) +
    amp * 0.4 * Math.sin(x / (len * 0.43) - t * speed * 1.7);
}

function surfacePath({ ctx, d, w, h }, ys, step) {
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i < ys.length; i++) ctx.lineTo(Math.min(w, i * step * d), ys[i] * d);
  ctx.lineTo(w, h);
  ctx.closePath();
}

effects.push((f) => {
  if (water.level <= 0) {
    if (waterBlurLayer) waterBlurLayer.style.display = 'none';
    return;
  }

  if (!waterBlurLayer) {
    waterBlurLayer = document.createElement('div');
    waterBlurLayer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483646';
    document.body.append(waterBlurLayer);
  }

  const { ctx, t, d } = f;
  const step = 8, back = [], front = [];
  let highest = sim.H;
  for (let x = 0; x <= sim.W + step; x += step) {
    const s = surfaceAt(x);
    back.push(s - 5 + waveOffset(x, t, 4, 140, -0.9, 2));
    front.push(s + waveOffset(x, t, 2.5, 90, 1.2, 0));
    highest = Math.min(highest, s);
  }

  // Blur the page under the surface, stronger with depth and with how full the screen is.
  const points = [];
  for (let i = 0; i <= 64; i++) {
    const x = (sim.W * i) / 64;
    points.push(`${(i / 64) * 100}% ${(surfaceAt(x) / sim.H) * 100}%`);
  }
  points.push('100% 100%', '0% 100%');
  const blur = `blur(${6 * water.level}px)`;
  const depthMask = `linear-gradient(to bottom, transparent ${(highest / sim.H) * 100}%, black 100%)`;
  Object.assign(waterBlurLayer.style, {
    display: '',
    backdropFilter: blur,
    webkitBackdropFilter: blur,
    clipPath: `polygon(${points.join(',')})`,
    maskImage: depthMask,
    webkitMaskImage: depthMask,
  });

  ctx.fillStyle = 'rgba(30,110,200,0.22)';
  surfacePath(f, back, step);
  ctx.fill();

  const body = ctx.createLinearGradient(0, highest * d, 0, f.h);
  body.addColorStop(0, 'rgba(45,145,230,0.32)');
  body.addColorStop(1, 'rgba(10,55,135,0.55)');
  ctx.fillStyle = body;
  surfacePath(f, front, step);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1.5 * d;
  ctx.beginPath();
  front.forEach((y, i) => ctx.lineTo(Math.min(f.w, i * step * d), y * d));
  ctx.stroke();
});
