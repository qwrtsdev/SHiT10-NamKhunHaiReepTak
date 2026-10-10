// Drink the water: hold your mouth open to the webcam. Opt-in from 👄 DRINK in the dock (effects/dock.js).
// ~10 frames a second are shrunk to 160×120 grayscale. The face is found with the browser's
// FaceDetector when it has one, otherwise you line your face up with the guide box in the preview.
// An open mouth is a dark hole: we count the share of pixels in the mouth area that are much darker
// than the skin on the cheeks, compare it with your closed mouth (learned in the first second, or
// "Recalibrate"), and drink in proportion to how wide it's open (DRINK_RATE × openness).
// It's a rough visual guess: it needs your face lit from the front. Frames never leave this page.

const DRINK_W = 160, DRINK_H = 120;
const drink = {
  on: false,
  open: 0, // 0–1, smoothed openness
  dark: 0, // current dark share of the mouth area
  base: null, // dark share with the mouth closed
  baseN: 0,
  face: null, // { x, y, w, h, mx?, my? } in analysis px (mx/my: detected mouth centre)
  mouthBox: null, // { x0, x1, y0, y1 } area checked for an open mouth
  found: false, // face box came from FaceDetector this frame
  status: '',
  video: null,
  stream: null,
  view: null, // preview canvas shown in the dock
  timer: 0,
  busy: false,
  gulpAt: 0,
  audio: null,
};
const drinkCanvas = document.createElement('canvas');
drinkCanvas.width = DRINK_W;
drinkCanvas.height = DRINK_H;
const drinkCtx = drinkCanvas.getContext('2d', { willReadFrequently: true });
let faceDetector = null;
try {
  if ('FaceDetector' in window) faceDetector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
} catch {} // not supported on this platform: use the guide box

// Without face detection: the face goes in this box (centre of the preview).
const DRINK_GUIDE = { x: 50, y: 14, w: 60, h: 90 };

async function drinkStart() {
  if (drink.on) return;
  drink.status = 'Asking for camera…';
  try {
    drink.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 12, max: 15 } },
    });
  } catch (e) {
    drink.status = `Camera unavailable (${e.name}).`;
    return;
  }
  drink.video = document.createElement('video');
  drink.video.muted = true;
  drink.video.playsInline = true;
  drink.video.srcObject = drink.stream;
  await drink.video.play().catch(() => {});
  drink.view ??= Object.assign(document.createElement('canvas'), { width: DRINK_W, height: DRINK_H });
  try { drink.audio ??= new AudioContext(); } catch {}
  drinkRecalibrate();
  drink.on = true;
  drink.timer = setInterval(drinkAnalyze, 100);
}

function drinkStop() {
  clearInterval(drink.timer);
  drink.stream?.getTracks().forEach((t) => t.stop());
  Object.assign(drink, { on: false, open: 0, stream: null, video: null, status: '' });
}

function drinkRecalibrate() {
  Object.assign(drink, { base: null, baseN: 0, open: 0, status: 'Close your mouth for a second…' });
}

// A short "gulp": a sine that drops in pitch.
function gulp() {
  const a = drink.audio;
  if (!a || a.state === 'closed') return;
  a.resume?.();
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
  o.frequency.setValueAtTime(320, t);
  o.frequency.exponentialRampToValueAtTime(110, t + 0.14);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + 0.18);
}

async function drinkFace() {
  if (!faceDetector) return null;
  try {
    const [f] = await faceDetector.detect(drink.video);
    if (!f) return null;
    const kx = DRINK_W / drink.video.videoWidth, ky = DRINK_H / drink.video.videoHeight;
    const b = f.boundingBox;
    const face = { x: b.x * kx, y: b.y * ky, w: b.width * kx, h: b.height * ky };
    const mouth = f.landmarks?.find((l) => l.type === 'mouth')?.locations;
    if (mouth?.length) {
      face.mx = (mouth.reduce((s, p) => s + p.x, 0) / mouth.length) * kx;
      face.my = (mouth.reduce((s, p) => s + p.y, 0) / mouth.length) * ky;
    }
    return face;
  } catch {
    faceDetector = null; // detect() isn't available after all: fall back to the guide box
    return null;
  }
}

async function drinkAnalyze() {
  const v = drink.video;
  if (!v || drink.busy || document.hidden || v.readyState < 2) return;
  drink.busy = true;
  try {
    const found = await drinkFace();
    if (!drink.on) return;
    drink.found = !!found;
    drink.face = found ?? DRINK_GUIDE;
    drinkMeasure(v);
  } finally {
    drink.busy = false;
  }
}

function drinkMeasure(v) {
  drinkCtx.drawImage(v, 0, 0, DRINK_W, DRINK_H);
  const px = drinkCtx.getImageData(0, 0, DRINK_W, DRINK_H).data;
  const lum = (x, y) => {
    const i = (Math.round(y) * DRINK_W + Math.round(x)) * 4;
    return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  };
  const f = drink.face;
  const clampX = (x) => Math.max(0, Math.min(DRINK_W - 1, x)), clampY = (y) => Math.max(0, Math.min(DRINK_H - 1, y));
  // Skin reference: cheeks and nose. Mouth: lower middle of the face (or around the detected mouth;
  // an open mouth grows downward, so the box sits a little below the landmark).
  const skin = { x0: f.x + f.w * 0.25, x1: f.x + f.w * 0.75, y0: f.y + f.h * 0.4, y1: f.y + f.h * 0.6 };
  const mx = f.mx ?? f.x + f.w / 2, my = f.my != null ? f.my + f.h * 0.05 : f.y + f.h * 0.8;
  const mouth = { x0: mx - f.w * 0.2, x1: mx + f.w * 0.2, y0: my - f.h * 0.1, y1: my + f.h * 0.14 };
  drink.mouthBox = mouth;

  let skinSum = 0, skinN = 0;
  for (let y = clampY(skin.y0); y <= clampY(skin.y1); y++)
    for (let x = clampX(skin.x0); x <= clampX(skin.x1); x++) skinSum += lum(x, y), skinN++;
  const skinLum = skinN ? skinSum / skinN : 0;
  let dark = 0, n = 0;
  for (let y = clampY(mouth.y0); y <= clampY(mouth.y1); y++)
    for (let x = clampX(mouth.x0); x <= clampX(mouth.x1); x++, n++) if (lum(x, y) < skinLum * 0.45) dark++;
  drink.dark = n ? dark / n : 0;
  drinkPreview(v);

  if (skinLum < 25) {
    drink.status = 'Too dark: light your face from the front.';
    drink.open = 0;
    return;
  }
  if (drink.base == null || drink.baseN < 10) {
    // Learn the closed mouth from the first second.
    drink.base = drink.base == null ? drink.dark : drink.base + (drink.dark - drink.base) / (drink.baseN + 1);
    drink.baseN++;
    drink.status = 'Close your mouth for a second…';
    return;
  }
  const raw = Math.max(0, Math.min(1, (drink.dark - drink.base - DRINK_OPEN) / DRINK_RANGE));
  drink.open = raw > drink.open ? 0.4 * drink.open + 0.6 * raw : 0.5 * drink.open + 0.5 * raw;
  if (drink.open < 0.03) drink.open = 0;
  if (drink.open > 0 && water.level > 0) {
    drainAt('drink', 0.5, DRINK_RATE * drink.open * 0.1, drink.open);
    drink.status = `👄 Glug glug… ${Math.round(drink.open * 100)}%`;
    const now = performance.now();
    if (now - drink.gulpAt > 650 - 300 * drink.open) (drink.gulpAt = now), gulp();
  } else {
    drink.status = water.level > 0
      ? `Open your mouth wide to drink.${drink.found || !faceDetector ? '' : ' (no face found)'}`
      : 'Nothing left to drink.';
    if (!faceDetector) drink.status += ' Keep your face in the box.';
  }
}

// Mirrored preview with the face box and the mouth box (red while drinking).
function drinkPreview(v) {
  const c = drink.view?.getContext('2d');
  if (!c) return;
  c.save();
  c.translate(DRINK_W, 0);
  c.scale(-1, 1);
  c.drawImage(v, 0, 0, DRINK_W, DRINK_H);
  c.lineWidth = 1.5;
  const f = drink.face, m = drink.mouthBox;
  c.strokeStyle = drink.found ? 'rgba(120,220,255,.9)' : 'rgba(255,255,255,.8)';
  c.setLineDash(drink.found ? [] : [4, 3]);
  c.strokeRect(f.x, f.y, f.w, f.h);
  c.setLineDash([]);
  c.strokeStyle = drink.open > 0 ? 'rgba(255,80,80,.95)' : 'rgba(255,220,120,.9)';
  c.strokeRect(m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0);
  c.restore();
}

addEventListener('pagehide', drinkStop);
