// Webcam as a tilt sensor. Started from the toolbar popup, which messages the active tab (see the end).
// Each frame (~10/s) is shrunk to 160×120 grayscale; Sobel gradients of strong edges vote into a
// 36-bin × 5° orientation histogram. Room edges are mostly horizontal + vertical, so bins 90° apart
// are folded together, the strongest orientation is refined with a weighted circular mean, and the
// difference from a level reference (first clear frame, or "Calibrate level") is the estimated tilt.
// It is a visual estimate, not a measurement: it needs a stable scene with straight lines.
// Frames are analysed locally in this page and never stored or sent anywhere.

const CAM_W = 160, CAM_H = 120;
const cam = {
  on: false,
  angle: 0, // smoothed estimated tilt, degrees, + = right edge down
  conf: 0,
  raw: null, // last confident orientation (degrees, 0–90)
  ref: null, // level reference orientation
  status: '',
  video: null,
  stream: null,
  timer: 0,
};
const camCanvas = document.createElement('canvas');
camCanvas.width = CAM_W;
camCanvas.height = CAM_H;
const camCtx = camCanvas.getContext('2d', { willReadFrequently: true });

async function camStart() {
  if (cam.on || cam.starting) return;
  cam.starting = true;
  cam.status = 'Asking for camera…';
  try {
    cam.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 12, max: 15 } },
    });
  } catch (e) {
    cam.status = `Camera unavailable (${e.name}). Try the Joy-Con instead.`;
    return;
  } finally {
    cam.starting = false;
  }
  cam.video = document.createElement('video');
  cam.video.muted = true;
  cam.video.playsInline = true;
  cam.video.srcObject = cam.stream;
  await cam.video.play().catch(() => {});
  Object.assign(cam, { on: true, angle: 0, ref: null, raw: null, status: 'Keep the laptop level…' });
  cam.timer = setInterval(camAnalyze, 100);
}

function camStop() {
  clearInterval(cam.timer);
  cam.stream?.getTracks().forEach((t) => t.stop());
  Object.assign(cam, { on: false, angle: 0, stream: null, video: null, status: '' });
}

// Use the current view as "level". Only accepted when the frame is clear enough.
function camCalibrate() {
  if (cam.raw == null || cam.conf < CAM_MIN_CONFIDENCE) {
    cam.status = 'Need a clearer view to calibrate: point at a door, window or shelf.';
    return;
  }
  cam.ref = cam.raw;
  cam.angle = 0;
  cam.status = 'Level set.';
}

// Wrap a difference between orientations (they repeat every 90°) into [−45, 45).
function wrap90(a) {
  return ((((a + 45) % 90) + 90) % 90) - 45;
}

function camAnalyze() {
  const v = cam.video;
  if (!v || document.hidden || v.readyState < 2) return;
  camCtx.drawImage(v, 0, 0, CAM_W, CAM_H);
  const px = camCtx.getImageData(0, 0, CAM_W, CAM_H).data;
  const g = new Float32Array(CAM_W * CAM_H);
  for (let i = 0; i < g.length; i++) g[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];

  const hist = new Float32Array(36);
  const angs = [], mags = [];
  for (let y = 1; y < CAM_H - 1; y++) {
    for (let x = 1; x < CAM_W - 1; x++) {
      const i = y * CAM_W + x;
      const gx = g[i - CAM_W + 1] + 2 * g[i + 1] + g[i + CAM_W + 1] - g[i - CAM_W - 1] - 2 * g[i - 1] - g[i + CAM_W - 1];
      const gy = g[i + CAM_W - 1] + 2 * g[i + CAM_W] + g[i + CAM_W + 1] - g[i - CAM_W - 1] - 2 * g[i - CAM_W] - g[i - CAM_W + 1];
      const m = Math.hypot(gx, gy);
      if (m < 80) continue; // weak gradient: ignore
      const a = (((Math.atan2(gy, gx) * 180) / Math.PI) % 180 + 180) % 180; // undirected, 0–180
      hist[Math.min(35, Math.floor(a / 5))] += m;
      angs.push(a % 90);
      mags.push(m);
    }
  }

  // Fold perpendicular bins, then take the strongest 3-bin window.
  const fold = new Float32Array(18);
  let total = 0;
  for (let i = 0; i < 18; i++) total += fold[i] = hist[i] + hist[i + 18];
  let peak = 0;
  const win = (p) => fold[(p + 17) % 18] + fold[p] + fold[(p + 1) % 18];
  for (let i = 1; i < 18; i++) if (win(i) > win(peak)) peak = i;
  const uniform = 3 / 18; // a 3-bin window's share when votes are spread evenly
  cam.conf = total > 0 ? (win(peak) / total - uniform) / (1 - uniform) : 0;
  if (angs.length < 150 || cam.conf < CAM_MIN_CONFIDENCE) {
    cam.status = 'Finding edges… point the camera at straight lines.';
    return;
  }

  // Refine: circular mean of 4θ (period 90°) over votes near the peak.
  const centre = peak * 5 + 2.5;
  let C = 0, S = 0;
  for (let i = 0; i < angs.length; i++) {
    if (Math.abs(wrap90(angs[i] - centre)) > 7.5) continue;
    const r = (angs[i] * 4 * Math.PI) / 180;
    C += mags[i] * Math.cos(r);
    S += mags[i] * Math.sin(r);
  }
  cam.raw = ((((Math.atan2(S, C) * 180) / Math.PI / 4) % 90) + 90) % 90;
  if (cam.ref == null) cam.ref = cam.raw;

  // The webcam faces you, so tipping the laptop's right side down turns the scene clockwise in the
  // image (y down = positive angle): same sign as our tilt.
  const rel = wrap90(cam.raw - cam.ref);
  const smooth = 0.7 * cam.angle + 0.3 * rel;
  cam.angle = Math.max(-CAM_MAX_ANGLE, Math.min(CAM_MAX_ANGLE, smooth));
  cam.status = `${Math.round(cam.angle)}° · confidence ${Math.round(cam.conf * 100)}%`;
}

addEventListener('pagehide', camStop);

// The popup's 📷 controls. It polls { act: 'status' } while open; frame is the last analysed frame.
chrome.runtime.onMessage.addListener((m, _sender, reply) => {
  if (m.type !== 'cam') return;
  if (m.act === 'toggle') cam.on ? camStop() : camStart();
  if (m.act === 'calibrate') camCalibrate();
  reply({ on: cam.on, status: cam.status, frame: cam.on ? camCanvas.toDataURL('image/jpeg', 0.6) : null });
});
