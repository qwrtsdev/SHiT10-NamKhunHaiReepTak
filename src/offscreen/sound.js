// Scoop sounds, played by the computer. Runs in the offscreen document, so it doesn't need a visible
// tab or a click on the page. Splash for every Joy-Con / phone scoop (offscreen/joycon.js scoopWater);
// for the phone also glugs, bubbles, drips and the spill, driven by the state it streams
// (offscreen/phone.js). Ported from phone/index.html, which now only vibrates.

const SOUND_VOLUME = 0.6;
let ac = null, noiseBuf = null;

function audio() {
  if (!ac) {
    ac = new AudioContext();
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}

function env(g, t, v, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v * SOUND_VOLUME, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
function tone(f0, f1, dur, v, at = 0) {
  const ac = audio(), t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, v, dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
function noise(dur, v, type, freq, at = 0) {
  const ac = audio(), t = ac.currentTime + at, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf;
  f.type = type;
  f.frequency.value = freq;
  env(g, t, v, dur);
  s.connect(f).connect(g).connect(ac.destination);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

const r = Math.random;
const sfx = {
  hello: () => tone(500, 1000, 0.08, 0.2),
  bubble: (at = 0) => tone(400 + r() * 500, 900 + r() * 700, 0.05, 0.12, at), // rising blip
  drip: (at = 0) => tone(900 + r() * 700, 1800 + r() * 900, 0.04, 0.1, at),
  scrape: () => noise(0.05, 0.1, 'highpass', 2500), // dry bucket
  glug(at = 0) {
    tone(140 + r() * 60, 320 + r() * 80, 0.12, 0.35, at);
    noise(0.1, 0.08, 'lowpass', 400, at);
  },
  splash(size, at = 0) {
    noise(0.35, 0.4 + 0.4 * size, 'bandpass', 1100, at);
    noise(0.25, 0.3, 'lowpass', 500, at);
    for (let i = 0; i < 6 + 10 * size; i++) sfx.drip(at + 0.08 + r() * 0.52);
  },
  spill(fill) {
    noise(0.6, 0.2 + 0.3 * fill, 'lowpass', 700);
    for (let i = 0; i < 8; i++) sfx.drip(i * 0.05);
  },
};

// Level sounds: alarm.mp3 loops while the screen is full (same 99.5% as effects/lockout.js), yay.mp3
// plays once when the last water leaves. Played here rather than in the tabs, so they sound once for the
// whole browser and the page muffling (effects/muffle.js) never touches them.
const alarm = Object.assign(new Audio('../../assets/alarm.mp3'), { loop: true, volume: SOUND_VOLUME });
const yay = Object.assign(new Audio('../../assets/yay.mp3'), { volume: SOUND_VOLUME });
let wasFull = false, wasWet = false;
setInterval(() => {
  const level = simVolume(), full = level >= 0.995, wet = level > 0; // offscreen/sim.js zeroes it once drained
  if (full && !wasFull) alarm.play().catch(() => {});
  if (!full && wasFull) {
    alarm.pause();
    alarm.currentTime = 0;
  }
  if (wasWet && !wet) {
    yay.currentTime = 0;
    yay.play().catch(() => {});
  }
  wasFull = full;
  wasWet = wet;
}, 100);
