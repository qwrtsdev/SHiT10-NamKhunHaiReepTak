// Tuning knobs. Loaded first; every other content script reads these globals.

// Water per prompt = characters × WATER_PER_CHAR × the model/effort multiplier (100 chars at ×1 = 10%).
const WATER_PER_CHAR = 0.001;
const RISE_SPEED = 0.1; // viewport heights per second, at ×1
const DRAIN_SPEED = 0.35; // how fast a tab follows a level drop made elsewhere (viewport heights/sec)

// Better model / higher effort = faster rise. Each site's model selector label is lowercased and
// matched by substring against these tables; the first hit wins, so order matters ("xhigh" before "high").
const RATES = {
  claude: {
    models: { haiku: 1, sonnet: 2, opus: 3, fable: 4 },
    efforts: { xhigh: 3, max: 3.5, high: 2.5, extended: 2.5, medium: 2, low: 1.5 },
  },
  chatgpt: {
    models: { mini: 1, instant: 1, auto: 1.25, 'gpt-4': 1.25, think: 1.75, pro: 2.5, o3: 1.75, 'gpt-5': 1.5 },
    efforts: { heavy: 2, extended: 1.5, standard: 1.25, light: 1 },
  },
  gemini: {
    models: { 'flash-lite': 1, flash: 1.5, pro: 2 },
    // Thinking level, from the mode menu (Thai UI): ระดับต่ำสุด / ปานกลาง / ระดับสูงสุด.
    efforts: { 'ต่ำสุด': 1, 'ปานกลาง': 1.5, 'สูงสุด': 2 },
  },
  other: { models: {}, efforts: {} },
};

// Audio gets muffled (lowpass 20 kHz → 300 Hz) and a bit quieter from MUFFLE_FROM, fully muffled at MUFFLE_TO.
const MUFFLE_FROM = 0.45, MUFFLE_TO = 0.7;
const MUFFLE_MIN_VOLUME = 0.6; // volume when fully muffled: still audible, just underwater
const INPUT_LOCK_AT = 0.8; // chat composers stop taking clicks and typing

// Water physics (px and seconds). See sim.js. One sim runs for all tabs (offscreen/sim.js) in a
// SIM_W × SIM_H tank; each tab stretches it to its own viewport.
const SIM_W = 1600, SIM_H = 900;
const COL = 10; // column width of the height field
const GRAVITY = 3000; // px/s²: higher = faster sloshing
const WAVE_DAMP = 0.55; // fraction of wave motion lost per second
const VISCOSITY = 0.12; // per-substep smoothing of the flow between neighbouring columns (0–0.25)
const MAX_TILT = 45 * Math.PI / 180; // tilt is clamped to ±45°
const TILT_LIP = 16 * Math.PI / 180; // tilt past ~16° and water pours off the low edge of the screen
const SPILL_RATE = 0.12; // how fast it pours (weir coefficient)
const MAX_POUR = 0.12 / 0.9; // pour cap: 12% of the screen per 0.9 s
const BUCKET_DIP = 0.3; // seconds from a Joy-Con scoop until the 🪣 reaches the water

// Webcam tilt (drains/camera.js): the angle of strong straight edges in the webcam image vs. a level reference.
const CAM_MAX_ANGLE = 28; // degrees; the camera estimate is clamped to ±28°
const CAM_MIN_CONFIDENCE = 0.12;
