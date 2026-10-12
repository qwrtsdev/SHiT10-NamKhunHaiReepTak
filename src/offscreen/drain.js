const waterLevel = () => target;

// Returns the amount taken. sim.js takes it off the screen when the storage change comes back.
function scoopWater(amount) {
  amount = Math.min(amount, target);
  if (amount <= 0) return 0;
  target -= amount;
  sfx.splash(Math.min(1, amount / SCOOP_MAX), BUCKET_DIP); // when the 🪣 in the tabs hits the water
  chrome.runtime.sendMessage({ type: 'setStorage', values: { target, scoop: { amount, t: Date.now() } } }).catch(() => {});
  return amount;
}

// enabled = this is the drain chosen in the popup. onPick runs at startup and on every change.
function drainSettings(mode, onPick = () => {}) {
  const settings = { gain: 0.8, invert: false, enabled: false };
  const pick = (drainMode) => {
    settings.enabled = drainMode === mode;
    onPick(settings);
  };
  stored.then((s) => pick(s?.drainMode));
  onStorage((m) => m.drainMode !== undefined && pick(m.drainMode));
  return settings;
}
