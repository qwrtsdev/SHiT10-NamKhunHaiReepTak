// Tilting the screen pours the water out of the low edge. Tilt comes from (added together):
//  - the webcam (drains/camera.js), an estimate from the angle of straight edges it sees,
//  - the device's motion sensor, on tablets / 2-in-1s / Chromebooks that have one.
// The focused tab sends the sum (radians, + = right edge down) to the shared sim (offscreen/sim.js);
// other tabs stay quiet, so only the tab you're looking at tilts and pours. The tab running the tilt
// cam always sends: its controls are in the toolbar popup, which takes the page's focus while open.

const tiltIn = { sensor: 0, sensorAt: 0 };

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


let sentTilt = NaN, tiltPort = null, camWasOn = false;
effects.push(() => {
  const camStopped = camWasOn && !cam.on; // send the swing back to level once
  camWasOn = cam.on;
  if (!simPort || !(cam.on || camStopped || document.hasFocus())) return;
  const sensor = performance.now() - tiltIn.sensorAt < 1000 ? tiltIn.sensor : 0;
  const t = Math.max(-MAX_TILT, Math.min(MAX_TILT, sensor + (cam.on ? (cam.angle * Math.PI) / 180 : 0)));
  if (simPort === tiltPort && Math.abs(t - sentTilt) < 1e-3) return; // a new port always gets one
  sentTilt = t;
  tiltPort = simPort;
  simPort.postMessage({ tilt: t });
});
addEventListener('blur', () => {
  if (cam.on) return;
  sentTilt = NaN; // resend on focus
  simPort?.postMessage({ tilt: 0 });
});
