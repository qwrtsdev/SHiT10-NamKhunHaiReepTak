// Hosts the Joy-Cons (src/joycon/joycon.js) in the offscreen document, which stays alive while the
// browser runs. The popup pairs a controller (requestDevice needs a click there), then tells us to
// pick it up; it polls { type: 'joycon', act: 'status' } to show live state.

// enabled: the Joy-Con is the drain chosen in the popup (storage drainMode, relayed by background.js).
const joyconSettings = { gain: 0.8, invert: false, enabled: false };
const pads = new Map(); // HIDDevice → JoyCon

const waterLevel = () => target; // offscreen/sim.js

// Offscreen documents can't use chrome.storage; background.js writes it. The storage change comes
// back to sim.js, which shows the 🪣 and takes the water out.
function scoopWater(amount) {
  amount = Math.min(amount, target);
  if (amount <= 0) return 0;
  target -= amount;
  chrome.runtime.sendMessage({ type: 'setStorage', values: { target, scoop: { amount, t: Date.now() } } }).catch(() => {});
  return amount;
}

const OPEN_FAILED = ' On Linux, your user needs read/write access to /dev/hidraw* (install steam-devices, or see the README).';

async function addDevice(device) {
  if (pads.has(device) || !NAMES[device.productId]) return;
  const jc = new JoyCon(device);
  pads.set(device, jc);
  try {
    await jc.init(pads.size - 1);
  } catch (e) {
    jc.error = `Could not open: ${e.message}${navigator.userAgent.includes('Linux') ? OPEN_FAILED : ''}`;
  }
}

function removeDevice(device) {
  pads.get(device)?.close();
  pads.delete(device);
}

const refreshDevices = () => navigator.hid?.getDevices().then((ds) => Promise.all(ds.map(addDevice)));

navigator.hid?.addEventListener('connect', (e) => addDevice(e.device));
navigator.hid?.addEventListener('disconnect', (e) => removeDevice(e.device));
refreshDevices();

chrome.runtime.sendMessage({ type: 'simInit' }).then((s) => (joyconSettings.enabled = s?.drainMode === 'joycon'));

chrome.runtime.onMessage.addListener((m, _sender, reply) => {
  if (m.type === 'storage' && m.drainMode !== undefined) joyconSettings.enabled = m.drainMode === 'joycon';
  if (m.type !== 'joycon') return;
  if (m.act === 'settings') Object.assign(joyconSettings, m.settings);
  const status = () => reply({
    hid: !!navigator.hid,
    settings: joyconSettings,
    pads: [...pads.values()].map((jc) => ({
      name: NAMES[jc.device.productId],
      streaming: !!jc.last,
      error: jc.error,
    })),
  });
  if (m.act === 'refresh') refreshDevices().then(status, status);
  else status();
  return true;
});
