// Two semi-transparent sine-wave layers moving in opposite directions.

let waterBlurLayer;

function waveOffset(x, t, amp, len, speed, phase) {
  return amp * Math.sin(x / len + t * speed + phase) +
    amp * 0.4 * Math.sin(x / (len * 0.43) - t * speed * 1.7);
}

function waveLayer({ ctx, t, w, h, top }, amp, len, speed, phase, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w + 8; x += 8) {
    ctx.lineTo(x, top + waveOffset(x, t, amp, len, speed, phase));
  }
  ctx.lineTo(w, h);
  ctx.fill();
}

effects.push((f) => {
  if (water.level <= 0) {
    if (waterBlurLayer) {
      waterBlurLayer.style.backdropFilter = 'blur(0px)';
      waterBlurLayer.style.webkitBackdropFilter = 'blur(0px)';
      waterBlurLayer.style.clipPath = 'none';
      waterBlurLayer.style.maskImage = 'none';
      waterBlurLayer.style.webkitMaskImage = 'none';
    }
    return;
  }

  if (!waterBlurLayer) {
    waterBlurLayer = document.createElement('div');
    waterBlurLayer.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:2147483646';
    document.body.append(waterBlurLayer);
  }

  const points = [];
  for (let i = 0; i <= 64; i++) {
    const x = f.w * i / 64;
    const y = f.top + waveOffset(x, f.t, 10 * f.d, 90 * f.d, 1.2, 0);
    points.push(`${(i / 64) * 100}% ${(y / f.h) * 100}%`);
  }
  points.push('100% 100%', '0% 100%');
  const surface = (f.top / f.h) * 100;
  const blur = 6 * water.level;
  waterBlurLayer.style.backdropFilter = `blur(${blur}px)`;
  waterBlurLayer.style.webkitBackdropFilter = `blur(${blur}px)`;
  waterBlurLayer.style.clipPath = `polygon(${points.join(',')})`;
  const depthMask = `linear-gradient(to bottom, transparent ${surface}%, black 100%)`;
  waterBlurLayer.style.maskImage = depthMask;
  waterBlurLayer.style.webkitMaskImage = depthMask;

  waveLayer(f, 10 * f.d, 90 * f.d, 1.2, 0, 'rgba(30,110,200,0.25)');
  waveLayer(f, 14 * f.d, 140 * f.d, -0.9, 2, 'rgba(40,140,230,0.35)');
});
