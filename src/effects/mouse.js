// A stream of mice runs across the screen when high water starts pouring.

const mice = [];
const MICE_PER_POUR = 24;
const MOUSE_SPAWN_GAP = 0.09;
let miceToSpawn = 0;
let nextMouseSpawn = 0;
let wasPouring = false;

effects.push((f) => {
  const pouring = sim.pour[0] > 0 || sim.pour[1] > 0;
  if (pouring && !wasPouring && water.level >= MOUSE_SHOW_AT) {
    miceToSpawn = MICE_PER_POUR;
    nextMouseSpawn = f.t;
  }
  wasPouring = pouring;

  while (miceToSpawn > 0 && f.t >= nextMouseSpawn) {
    mice.push({
      x: -32,
      speed: Math.max(90, sim.W * 0.2) * (0.8 + Math.random() * 0.4),
      size: 24 + Math.random() * 12,
      offset: (Math.random() - 0.5) * 36,
      phase: Math.random() * Math.PI * 2,
    });
    miceToSpawn--;
    nextMouseSpawn += MOUSE_SPAWN_GAP;
  }

  const { ctx, d } = f;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = mice.length - 1; i >= 0; i--) {
    const mouse = mice[i];
    mouse.x += mouse.speed * f.dt;
    if (mouse.x > sim.W + 32) {
      mice.splice(i, 1);
      continue;
    }
    const x = Math.max(0, Math.min(sim.W, mouse.x));
    const y = Math.max(20, surfaceAt(x) - 16 + mouse.offset + Math.sin(f.t * 18 + mouse.phase) * 2);
    ctx.font = `${mouse.size * d}px serif`;
    ctx.fillText('🐁', mouse.x * d, y * d);
  }
});
