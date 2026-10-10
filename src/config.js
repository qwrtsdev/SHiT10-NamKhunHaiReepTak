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

// Water physics (CSS px and seconds). See sim.js.
const COL = 10; // column width of the height field
const GRAVITY = 3000; // px/s²: higher = faster sloshing
const WAVE_DAMP = 0.35; // fraction of wave motion lost per second
const VISCOSITY = 0.08; // per-substep smoothing of the flow between neighbouring columns (0–0.25)
const MAX_TILT = 45 * Math.PI / 180; // tilt is clamped to ±45°
const TILT_LIP = 16 * Math.PI / 180; // tilt past ~16° and water pours off the low edge of the screen
const SPILL_RATE = 0.12; // how fast it pours (weir coefficient)
const MAX_POUR = 0.12 / 0.9; // pour cap: 12% of the screen per 0.9 s
const MOUSE_SHOW_AT = 0.4; // show a running mouse when pouring starts above this water level

// Webcam tilt (drains/camera.js): the angle of strong straight edges in the webcam image vs. a level reference.
const CAM_MAX_ANGLE = 28; // degrees; the camera estimate is clamped to ±28°
const CAM_MIN_CONFIDENCE = 0.12;
const CAM_SHOW_AT = 0.1; // the 📷 CAMERA button appears once the water is this high
