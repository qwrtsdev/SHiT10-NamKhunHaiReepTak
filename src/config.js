// Tuning knobs. Loaded first; every other content script reads these globals.

const STEP = 0.12; // fraction of viewport height added per prompt
const RISE_SPEED = 0.03; // viewport heights per second, at ×1
const DRAIN_SPEED = 0.35; // how fast a tab follows a level drop made elsewhere (viewport heights/sec)

// Better model / higher effort = faster rise. Each site's model selector label is lowercased and
// matched by substring against these tables; the first hit wins, so order matters ("xhigh" before "high").
const RATES = {
  claude: {
    models: { haiku: 1, sonnet: 1.5, opus: 2, fable: 2.5 },
    efforts: { xhigh: 1.75, max: 2, high: 1.5, extended: 1.5, medium: 1.25, low: 1 },
  },
  chatgpt: {
    models: { mini: 1, instant: 1, auto: 1.25, 'gpt-4': 1.25, thinking: 1.75, pro: 2.5, o3: 1.75, 'gpt-5': 1.5 },
    efforts: { heavy: 2, extended: 1.5, standard: 1.25, light: 1 },
  },
  gemini: {
    models: { 'deep think': 2.5, 'flash-lite': 1, flash: 1, fast: 1, thinking: 1.5, pro: 2, ultra: 2.5 },
    efforts: {},
  },
  other: { models: {}, efforts: {} },
};

// Audio gets muffled (lowpass cutoff falls from 20 kHz to 300 Hz) as water goes 60% → 70%.
const MUFFLE_FROM = 0.6, MUFFLE_TO = 0.7;

const LOCK_MESSAGE = 'กรุณาเทน้ำออกจากจอ';

// Water physics (px and seconds). See sim.js. One sim runs for all tabs (offscreen/sim.js) in a
// SIM_W × SIM_H tank; each tab stretches it to its own viewport.
const SIM_W = 1600, SIM_H = 900;
const COL = 10; // column width of the height field
const GRAVITY = 3000; // px/s²: higher = faster sloshing
const WAVE_DAMP = 0.35; // fraction of wave motion lost per second
const VISCOSITY = 0.08; // per-substep smoothing of the flow between neighbouring columns (0–0.25)
const MAX_TILT = 45 * Math.PI / 180; // tilt is clamped to ±45°
const TILT_LIP = 16 * Math.PI / 180; // tilt past ~16° and water pours off the low edge of the screen
const SPILL_RATE = 0.12; // how fast it pours (weir coefficient)
const MAX_POUR = 0.12 / 0.9; // pour cap: 12% of the screen per 0.9 s
const BUCKET_DIP = 0.3; // seconds from a Joy-Con scoop until the 🪣 reaches the water
const MOUSE_SHOW_AT = 0.4; // show a running mouse when pouring starts above this water level

// Webcam tilt (drains/camera.js): the angle of strong straight edges in the webcam image vs. a level reference.
const CAM_MAX_ANGLE = 28; // degrees; the camera estimate is clamped to ±28°
const CAM_MIN_CONFIDENCE = 0.12;

// Blowing into the microphone (drains/blow.js). Loudness above the room's noise floor → strength 0–1.
const BLOW_RATE = 0.06; // fraction of the screen per second at full blast; it scales with strength²
const BLOW_START_DB = 12; // dB above the noise floor before it counts as blowing
const BLOW_RANGE_DB = 30; // dB from "just blowing" to full blast

// Drinking: hold your mouth open to the webcam (drains/drink.js).
const DRINK_RATE = 0.04; // fraction of the screen per second with the mouth wide open
const DRINK_OPEN = 0.08; // how much darker the mouth area must get (fraction of its pixels) than when closed
const DRINK_RANGE = 0.25; // extra dark fraction from "just open" to wide open
