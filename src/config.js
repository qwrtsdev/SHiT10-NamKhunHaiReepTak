// Tuning knobs. Loaded first; every other content script reads these globals.

const STEP = 0.12; // fraction of viewport height added per prompt
const RISE_SPEED = 0.03; // viewport heights per second, at ×1

// Better model / higher effort = faster rise. Matched against the model selector's label text;
// order matters ("xhigh" before "high").
const MODELS = { haiku: 1, sonnet: 1.5, opus: 2, fable: 2.5 };
const EFFORTS = { xhigh: 1.75, max: 2, high: 1.5, extended: 1.5, medium: 1.25, low: 1 };

// Audio gets muffled (lowpass cutoff falls from 20 kHz to 300 Hz) as water goes 60% → 70%.
const MUFFLE_FROM = 0.6, MUFFLE_TO = 0.7;

const LOCK_MESSAGE = 'กรุณาเทน้ำออกจากจอ';
