// Joy-Con scooper: connects Joy-Cons over WebHID, turns a dip-and-flip motion into a scoop that
// lowers the shared water level, and plays HD-rumble haptics so it feels like hauling water.
// Protocol notes (report layouts, subcommands, rumble encoding) follow the Joy-Con tester guide:
// offsets are WebHID data indices (report ID excluded).

const SCOOP_MAX = 0.06; // a full bucket takes 6% of the screen
const DIP_DEG = -35; // tip pointing this far down = bucket in the water
const LIFT_DEG = 30; // tip this far up = scooped
const LIFT_TIMEOUT = 1500; // ms; slower than this and the water spills back
const ACC = 4 / 16384, GYR = 936 / 13371; // raw → G, raw → °/s (default calibration)
const NAMES = { 0x2006: 'Joy-Con (L)', 0x2007: 'Joy-Con (R)', 0x2009: 'Pro Controller' };

let level = 0, scooped = 0;
const $ = (id) => document.getElementById(id);
const ui = { gain: $('gain'), invert: $('invert') };

// ---- shared water level -----------------------------------------------------------------
function showLevel() {
  $('level').textContent = `${Math.round(level * 100)}%`;
  $('levelBar').style.width = `${level * 100}%`;
  $('total').textContent = `Scooped so far: ${Math.round(scooped * 100)}%`;
}
chrome.storage.local.get({ target: 0 }, (s) => { level = s.target; showLevel(); });
chrome.storage.onChanged.addListener((c) => {
  if (c.target) { level = c.target.newValue ?? 0; showLevel(); }
});

// Take water out of every tab. Pages show a 🪣 for it (effects/scoop.js).
function scoop(amount) {
  amount = Math.min(amount, level);
  if (amount <= 0) return 0;
  level -= amount;
  scooped += amount;
  chrome.storage.local.set({ target: level, scoop: { amount, t: Date.now() } });
  showLevel();
  return amount;
}

// ---- HD rumble ----------------------------------------------------------------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function encAmp(a) {
  a = clamp(a, 0, 1);
  if (a > 0.23) return Math.round(Math.log2(a * 8.7) * 32);
  if (a > 0.12) return Math.round(Math.log2(a * 17) * 16);
  return Math.round(a * 137); // linear below 0.12 (meets the curve above)
}
// Two-band encoder: high band 82–1252 Hz, low band 41–626 Hz. Returns 4 bytes for one motor.
function encodeDual(hf, ha, lf, la) {
  const ef = (f) => Math.round(Math.log2(f / 10) * 32);
  const h = (ef(clamp(hf, 82, 1252)) - 0x60) * 4;
  const l = ef(clamp(lf, 41, 626)) - 0x40;
  return [h & 0xff, encAmp(ha) * 2 + ((h >> 8) & 1), l & 0x7f, (encAmp(la) >> 1) + 64];
}
const NEUTRAL = [0x00, 0x01, 0x40, 0x40];

// ---- one controller -----------------------------------------------------------------------
class JoyCon {
  constructor(device) {
    this.device = device;
    this.isR = device.productId === 0x2007;
    this.counter = 0;
    this.queue = Promise.resolve();
    this.waiters = [];
    this.sending = false;
    this.grav = [0, 0, 1]; // low-passed accelerometer (G)
    this.motion = 0; // |gyro|, °/s
    this.bias = [0, 0, 0];
    this.biasSamples = [];
    this.pitch = 0;
    this.battery = '';
    // scoop state machine: ready → fill → lift → cool → ready
    this.state = 'ready';
    this.fill = 0;
    this.since = 0;
    this.scoops = 0;
    this.impacts = []; // one-shot haptic hits: { band, f, a, t0, dur }
    this.last = 0;
    this.onReport = this.onReport.bind(this);
  }

  // Output reports are 48 bytes: [counter, rumble ×8, subcommand, args…].
  send(id, bytes) {
    const buf = new Uint8Array(48);
    buf.set(bytes.slice(0, 48));
    return this.device.sendReport(id, buf);
  }

  // Send a subcommand and wait for its 0x21 reply. Serialized: never two exchanges at once.
  subcmd(id, args = []) {
    const run = async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const reply = new Promise((resolve) => {
          const w = { id, resolve };
          this.waiters.push(w);
          setTimeout(() => { this.waiters = this.waiters.filter((x) => x !== w); resolve(null); }, 300);
        });
        await this.send(0x01, [this.counter++ & 0x0f, ...NEUTRAL, ...NEUTRAL, id, ...args]).catch(() => {});
        if (await reply) return true;
      }
      return false;
    };
    return (this.queue = this.queue.then(run, run));
  }

  async init(index) {
    if (!this.device.opened) await this.device.open();
    this.device.addEventListener('inputreport', this.onReport);
    await this.subcmd(0x40, [0x01]); // IMU on
    await this.subcmd(0x48, [0x01]); // vibration on
    await this.subcmd(0x03, [0x30]); // full report mode with IMU, ~60 Hz
    await this.subcmd(0x30, [1 << (index % 4)]); // player light
    this.hit('l', 160, 0.6, 120); // hello buzz
  }

  close() {
    this.device.removeEventListener('inputreport', this.onReport);
    this.device.close().catch(() => {});
  }

  onReport(e) {
    const d = e.data;
    if (e.reportId === 0x21) {
      const id = d.getUint8(13);
      const w = this.waiters.find((x) => x.id === id);
      if (w) { this.waiters = this.waiters.filter((x) => x !== w); w.resolve(true); }
    }
    if ((e.reportId !== 0x30 && e.reportId !== 0x31) || d.byteLength < 48) return;
    this.battery = ['empty', 'critical', 'low', 'medium', 'full'][(d.getUint8(1) >> 5) & 7] ?? '';

    // Three IMU frames of 12 bytes: accel x,y,z then gyro x,y,z (int16 LE). Right Joy-Con: flip y, z.
    for (let k = 0; k < 3; k++) {
      const o = 12 + k * 12, s = this.isR ? -1 : 1;
      const a = [d.getInt16(o, true) * ACC, s * d.getInt16(o + 2, true) * ACC, s * d.getInt16(o + 4, true) * ACC];
      const g = [d.getInt16(o + 6, true) * GYR, s * d.getInt16(o + 8, true) * GYR, s * d.getInt16(o + 10, true) * GYR];
      this.calibrate(g);
      for (let i = 0; i < 3; i++) this.grav[i] += (a[i] - this.grav[i]) * 0.15;
      this.motion = Math.hypot(g[0] - this.bias[0], g[1] - this.bias[1], g[2] - this.bias[2]);
    }
    // Pitch of the long (x) axis: + = top end pointing up (the accelerometer reads +1 G along "up").
    const n = Math.hypot(...this.grav) || 1;
    this.pitch = (Math.asin(clamp(this.grav[0] / n, -1, 1)) * 180) / Math.PI * (ui.invert.checked ? -1 : 1);

    const now = performance.now();
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0.015;
    this.last = now;
    this.gesture(now, dt);
    this.rumble(now, dt);
  }

  // Gyro bias: average the first stretch of samples taken while the controller is still.
  calibrate(g) {
    if (this.biasSamples === null) return;
    this.biasSamples.push(g);
    if (this.biasSamples.length < 160) return;
    const avg = [0, 1, 2].map((i) => this.biasSamples.reduce((s, v) => s + v[i], 0) / 160);
    const still = this.biasSamples.every((v) => v.every((x, i) => Math.abs(x - avg[i]) < 10));
    if (still) { this.bias = avg; this.biasSamples = null; } else this.biasSamples = [];
  }

  gesture(now, dt) {
    const p = this.pitch;
    switch (this.state) {
      case 'ready':
        if (p < DIP_DEG) { this.state = 'fill'; this.fill = 0; }
        break;
      case 'fill': // bucket under water: fills faster when the water is deep
        if (level > 0) this.fill = Math.min(1, this.fill + dt * 1.4 * clamp(level / 0.15, 0.25, 1));
        if (p > -10) {
          if (this.fill > 0.1) { this.state = 'lift'; this.since = now; } else this.state = 'ready';
        }
        break;
      case 'lift':
        if (p > LIFT_DEG) {
          const got = scoop(this.fill * SCOOP_MAX);
          if (got > 0) this.scoops++;
          this.splash(got > 0 ? this.fill : 0.15);
          this.state = 'cool';
          this.since = now;
          this.fill = 0;
        } else if (p < DIP_DEG) {
          this.state = 'fill'; // dipped back in: keep what's in the bucket
        } else if (now - this.since > LIFT_TIMEOUT) {
          this.hit('l', 80, 0.6 * this.fill, 400); // spilled it all back
          for (let i = 0; i < 8; i++) this.hit('h', 500 + Math.random() * 500, 0.2, 25, now + i * 50);
          this.state = 'ready';
          this.fill = 0;
        }
        break;
      case 'cool':
        if (now - this.since > 400) this.state = 'ready';
        break;
    }
  }

  // One-shot haptic hit, decaying over `ms` (optionally starting later, at time `at`).
  hit(band, f, a, ms, at = performance.now()) {
    this.impacts.push({ band, f, a, t0: at, dur: ms });
  }

  splash(size) {
    const now = performance.now();
    this.hit('l', 65, 0.5 + 0.5 * size, 260);
    this.hit('h', 280, 0.3 + 0.4 * size, 160);
    // droplets landing for half a second afterwards
    for (let i = 0; i < 6 + 10 * size; i++) this.hit('h', 400 + Math.random() * 600, 0.15 + Math.random() * 0.25, 30, now + 80 + Math.random() * 520);
  }

  // Continuous texture for the current state, plus decaying hits, mixed per band and sent as HD rumble.
  rumble(now, dt) {
    const r = Math.random;
    let hf = 220, ha = 0, lf = 120, la = 0;
    const wet = level > 0;
    if (this.state === 'ready' && wet) {
      // water sloshing in the jug as you move it
      la = clamp(this.motion / 700, 0, 1) * 0.35 * (0.3 + 0.7 * level);
      lf = 110 + 40 * Math.sin(now / 140);
      ha = la * 0.3;
    } else if (this.state === 'fill') {
      if (wet) {
        la = (0.15 + 0.45 * this.fill) * (0.7 + 0.3 * Math.sin(now / 33));
        lf = 70 + 25 * r();
        if (r() < dt * 6) this.hit('l', 90 + r() * 40, 0.4 + 0.4 * this.fill, 70); // glug
        if (r() < dt * 14) this.hit('h', 380 + r() * 500, 0.18 + 0.15 * this.fill, 25); // bubbles
      } else {
        hf = 200; ha = 0.08; // dry scrape: nothing left to scoop
      }
    } else if (this.state === 'lift') {
      // the weight of a full bucket, dripping
      la = 0.25 + 0.5 * this.fill;
      lf = 50 + 10 * Math.sin(now / 50);
      if (r() < dt * 10) this.hit('h', 600 + r() * 500, 0.15, 20);
    }

    const bands = { h: [hf, ha], l: [lf, la] };
    this.impacts = this.impacts.filter((m) => now - m.t0 < m.dur * 1.5);
    for (const m of this.impacts) {
      if (now < m.t0) continue;
      const a = m.a * Math.exp((-3 * (now - m.t0)) / m.dur);
      const b = bands[m.band];
      if (a > b[1]) b[0] = m.f; // strongest contributor sets the frequency
      b[1] = Math.min(1, b[1] + a);
    }
    const gain = +ui.gain.value;
    const bytes = encodeDual(bands.h[0], bands.h[1] * gain, bands.l[0], bands.l[1] * gain);
    if (this.sending) return; // don't pile up reports
    this.sending = true;
    this.send(0x10, [this.counter++ & 0x0f, ...bytes, ...bytes]).catch(() => {}).finally(() => (this.sending = false));
  }
}

// The chooser only lists controllers that are connected right now. A paired Joy-Con drops off
// Bluetooth when it sleeps, and the PC can't wake it.
const NOT_LISTED = 'Joy-Con not in the list? Paired is not enough: it must be connected. ' +
  'Press any button on it (its lights stop flashing when it reconnects), then press Connect again.';
const OPEN_FAILED = ' On Linux, your user needs read/write access to /dev/hidraw* (install steam-devices, or see the README).';

// ---- device list + UI -----------------------------------------------------------------------
const pads = new Map(); // HIDDevice → { jc, el }

async function addDevice(device) {
  if (pads.has(device) || !NAMES[device.productId]) return;
  const jc = new JoyCon(device);
  const el = document.createElement('div');
  el.className = 'card dev';
  el.innerHTML = `<div class="ladle">🥄</div><div>
    <div><b>${NAMES[device.productId]}</b> <span class="muted" data-k="battery"></span></div>
    <div class="state" data-k="state">connecting…</div>
    <div class="bar"><div data-k="fill"></div></div>
    <div class="muted" data-k="info"></div></div>`;
  $('devices').append(el);
  pads.set(device, { jc, el });
  try {
    await jc.init(pads.size - 1);
  } catch (e) {
    el.querySelector('[data-k=state]').textContent = `Could not open: ${e.message}${navigator.userAgent.includes('Linux') ? OPEN_FAILED : ''}`;
  }
}

function removeDevice(device) {
  const p = pads.get(device);
  if (!p) return;
  p.jc.close();
  p.el.remove();
  pads.delete(device);
}

const STATE_TEXT = {
  ready: 'Point the tip down to dip the bucket',
  fill: 'Filling… flip it up!',
  lift: 'Lifting… keep going!',
  cool: 'Splash! 💦',
};

function draw() {
  for (const { jc, el } of pads.values()) {
    const k = (n) => el.querySelector(`[data-k=${n}]`);
    el.querySelector('.ladle').style.transform = `rotate(${-jc.pitch}deg)`;
    k('state').textContent = jc.last ? (level > 0 || jc.state === 'cool' ? STATE_TEXT[jc.state] : 'No water left 🎉') : 'connecting…';
    k('fill').style.width = `${jc.fill * 100}%`;
    k('battery').textContent = jc.battery && `🔋 ${jc.battery}`;
    k('info').textContent = `tip ${Math.round(jc.pitch)}° · scoops ${jc.scoops}`;
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

if (!navigator.hid) {
  $('connect').disabled = true;
  $('status').textContent = 'WebHID is not available in this browser. Use Chrome or Edge on desktop.';
} else {
  $('connect').onclick = async () => {
    try {
      const devices = await navigator.hid.requestDevice({ filters: [{ vendorId: 0x057e }] });
      for (const d of devices) await addDevice(d);
      $('status').textContent = devices.length ? '' : NOT_LISTED;
    } catch (e) {
      $('status').textContent = e.name === 'NotFoundError' ? NOT_LISTED : e.message;
    }
  };
  navigator.hid.addEventListener('connect', (e) => addDevice(e.device));
  navigator.hid.addEventListener('disconnect', (e) => removeDevice(e.device));
  navigator.hid.getDevices().then((ds) => ds.forEach(addDevice)); // reconnect devices allowed before
}

$('test').onclick = () => {
  for (const { jc } of pads.values()) jc.splash(1);
};
