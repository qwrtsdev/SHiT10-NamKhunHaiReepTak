// requestDevice needs a click, so the popup pairs a controller and then sends 'refresh'.

const joyconSettings = drainSettings('joycon');
const pads = new Map(); // HIDDevice → JoyCon

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

chrome.runtime.onMessage.addListener((m, _sender, reply) => {
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
