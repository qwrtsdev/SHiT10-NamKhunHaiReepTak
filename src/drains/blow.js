// Blow the water out through the microphone. Opt-in from 🌬️ BLOW in the dock (effects/dock.js).
// Blowing into a mic is about the loudest thing it hears, so this is a loudness meter: ~10 times a
// second the RMS level (dBFS) is compared with the room's noise floor (measured in the first second,
// and it slowly follows a quieter room). BLOW_START_DB above the floor counts as blowing; strength
// climbs to 1 over BLOW_RANGE_DB. The louder, the faster it drains (BLOW_RATE × strength²), and the
// shared sim pushes a dent into the water in the middle of the screen (offscreen/sim.js take()).
// Browser noise suppression / auto gain are switched off, since they'd filter the blowing out.
// Audio is analysed locally in this page and never stored or sent anywhere.

const blow = {
  on: false,
  strength: 0, // 0–1, smoothed
  db: -100, // current level, dBFS
  floor: null, // room noise floor, dBFS
  status: '',
  stream: null,
  ctx: null,
  analyser: null,
  buf: null,
  timer: 0,
  t0: 0,
};

async function blowStart() {
  if (blow.on) return;
  blow.status = 'Asking for the microphone…';
  try {
    blow.stream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (e) {
    blow.status = `Microphone unavailable (${e.name}).`;
    return;
  }
  blow.ctx = new AudioContext();
  blow.analyser = blow.ctx.createAnalyser();
  blow.analyser.fftSize = 2048;
  blow.buf = new Float32Array(blow.analyser.fftSize);
  blow.ctx.createMediaStreamSource(blow.stream).connect(blow.analyser);
  Object.assign(blow, { on: true, strength: 0, floor: null, t0: performance.now(), status: 'Listening to the room… stay quiet.' });
  blow.timer = setInterval(blowAnalyze, 100);
}

function blowStop() {
  clearInterval(blow.timer);
  blow.stream?.getTracks().forEach((t) => t.stop());
  blow.ctx?.close().catch(() => {});
  Object.assign(blow, { on: false, strength: 0, stream: null, ctx: null, analyser: null, status: '' });
}

function blowAnalyze() {
  if (!blow.analyser || document.hidden) return;
  blow.analyser.getFloatTimeDomainData(blow.buf);
  let sum = 0;
  for (const v of blow.buf) sum += v * v;
  const db = Math.max(-100, 10 * Math.log10(sum / blow.buf.length + 1e-12));
  blow.db = db;

  // First second: learn the noise floor. After that it only drifts down (quieter room) or very
  // slowly up, so a long blow can't raise it.
  if (performance.now() - blow.t0 < 1000) {
    blow.floor = blow.floor == null ? db : Math.min(blow.floor, db);
    return;
  }
  blow.floor = db < blow.floor ? 0.8 * blow.floor + 0.2 * db : blow.floor + 0.002 * (db - blow.floor);

  // Never treat a very quiet floor as the reference: a blow has to be properly loud.
  const start = Math.max(blow.floor + BLOW_START_DB, -50);
  const raw = Math.max(0, Math.min(1, (db - start) / BLOW_RANGE_DB));
  blow.strength = raw > blow.strength ? 0.5 * blow.strength + 0.5 * raw : 0.6 * blow.strength + 0.4 * raw;
  if (blow.strength < 0.02) blow.strength = 0;

  if (blow.strength > 0) {
    drainAt('blow', 0.5, BLOW_RATE * blow.strength ** 2 * 0.1, blow.strength);
    blow.status = water.level > 0 ? `💨 Blowing! ${Math.round(blow.strength * 100)}%` : 'Nothing left to blow away.';
  } else {
    blow.status = 'Blow into the mic. Louder = faster.';
  }
}

addEventListener('pagehide', blowStop);
