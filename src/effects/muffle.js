// Page audio goes through a lowpass filter and a volume fade as the water goes MUFFLE_FROM → MUFFLE_TO.

let audioCtx, lowpass, volume, muffling = false;
const muffledEls = new WeakSet();

const muffleAmount = () => Math.min(1, Math.max(0, (water.level - MUFFLE_FROM) / (MUFFLE_TO - MUFFLE_FROM)));

// ponytail: only <audio>/<video> elements in the DOM; page-made Web Audio and shadow-DOM media aren't muffled.
async function muffle(el) {
  if (muffledEls.has(el) || water.level < MUFFLE_FROM || !el.currentSrc) return;
  // Routing cross-origin media without CORS through Web Audio outputs silence, so leave it alone.
  if (new URL(el.currentSrc, location.href).origin !== location.origin && !el.crossOrigin) return;
  if (!audioCtx) {
    audioCtx = new AudioContext();
    lowpass = audioCtx.createBiquadFilter();
    lowpass.type = 'lowpass';
    volume = audioCtx.createGain();
    lowpass.connect(volume).connect(audioCtx.destination);
  }
  await audioCtx.resume().catch(() => {});
  // A suspended context (no user gesture yet) would silence the element, so only route when running.
  if (audioCtx.state !== 'running' || muffledEls.has(el)) return;
  muffledEls.add(el);
  try { audioCtx.createMediaElementSource(el).connect(lowpass); } catch {}
}

document.addEventListener('play', (e) => muffle(e.target), true);

effects.push(() => {
  if (water.level >= MUFFLE_FROM && !muffling) document.querySelectorAll('audio,video').forEach(muffle);
  muffling = water.level >= MUFFLE_FROM;
  if (!lowpass) return;
  const k = muffleAmount();
  lowpass.frequency.setTargetAtTime(20000 * (300 / 20000) ** k, audioCtx.currentTime, 0.05);
  volume.gain.setTargetAtTime(1 - (1 - MUFFLE_MIN_VOLUME) * k * k, audioCtx.currentTime, 0.05);
});
