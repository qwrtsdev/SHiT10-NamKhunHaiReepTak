// Tilting the screen pours the water out of the low edge. Tilt comes from (added together):
//  - the webcam (drains/camera.js), an estimate from the angle of straight edges it sees,
//  - the device's motion sensor, on tablets / 2-in-1s / Chromebooks that have one,
//  - dragging: the 🫗 grip in the dock, or anywhere on the screen once it's 100% full.
// The focused tab sends the sum (radians, + = right edge down) to the shared sim (offscreen/sim.js).
// Other tabs stay quiet, so only the tab you're looking at tilts and pours.

const tiltIn = { sensor: 0, sensorAt: 0, drag: 0, dragging: false };

addEventListener('devicemotion', (e) => {
  const a = e.accelerationIncludingGravity;
  if (a?.x == null || a.y == null) return;
  // a is the reaction to gravity in device axes (x right, y up). Rotate it into screen axes (y down)
  // for the current screen orientation; gravity is the opposite vector.
  const r = ((screen.orientation?.angle ?? 0) * Math.PI) / 180;
  const gx = -a.x * Math.cos(r) + a.y * Math.sin(r);
  const gy = a.x * Math.sin(r) + a.y * Math.cos(r);
  // Lying flat there's no in-plane gravity to speak of, so the angle would be noise.
  tiltIn.sensor = Math.hypot(gx, gy) > 3 ? Math.atan2(gx, gy) : 0;
  tiltIn.sensorAt = performance.now();
});

// Horizontal drag distance → tilt: half the screen width ≈ 45°.
function dragTilter(el, onEnd) {
  let x0 = 0;
  el.addEventListener('pointerdown', (e) => {
    x0 = e.clientX;
    tiltIn.dragging = true;
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  });
  el.addEventListener('pointermove', (e) => {
    if (tiltIn.dragging) tiltIn.drag = ((e.clientX - x0) / (innerWidth / 2)) * MAX_TILT;
  });
  const end = () => {
    tiltIn.dragging = false;
    tiltIn.drag = 0; // let go: the screen swings back upright
    onEnd?.();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

dragTilter(canvas); // only receives pointer events while locked out at 100% (lockout.js)

let sentTilt = NaN, tiltPort = null;
effects.push(() => {
  if (!simPort || !document.hasFocus()) return;
  const sensor = performance.now() - tiltIn.sensorAt < 1000 ? tiltIn.sensor : 0;
  const t = Math.max(-MAX_TILT, Math.min(MAX_TILT, sensor + tiltIn.drag + (cam.on ? (cam.angle * Math.PI) / 180 : 0)));
  if (simPort === tiltPort && Math.abs(t - sentTilt) < 1e-3) return; // a new port always gets one
  sentTilt = t;
  tiltPort = simPort;
  simPort.postMessage({ tilt: t });
});
addEventListener('blur', () => {
  sentTilt = NaN; // resend on focus
  simPort?.postMessage({ tilt: 0 });
});
