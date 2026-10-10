// Toolbar popup: current level, the drain picker (one at a time: tilt cam or Joy-Con), the tilt cam
// (runs in a tab), Joy-Con pairing and status (the controllers run in the offscreen document,
// offscreen/joycon.js), and the "ขอลองโกงหน่อย" view: set the water to any % or drain it all.

const $ = (id) => document.getElementById(id);
const fill = document.querySelector('.fill'), pct = document.querySelector('.pct');

function show(target = 0) {
  fill.style.width = `${target * 100}%`;
  pct.textContent = `${Math.round(target * 100)}%`;
}
chrome.storage.local.get({ target: 0 }, (s) => show(s.target));
chrome.storage.onChanged.addListener((c) => c.target && show(c.target.newValue));

// The camera lives in the page's content script (drains/camera.js): the popup closes as soon as it
// loses focus, and the camera permission belongs to the site.
async function cam(act) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const s = await chrome.tabs.sendMessage(tab.id, { type: 'cam', act });
    $('camStart').hidden = s.on || s.starting;
    $('calibrate').hidden = !s.on;
    $('camStatus').textContent = s.status || (s.on ? '' : 'ยังไม่ได้เปิดกล้องบนแท็บนี้');
    $('camFrame').hidden = !s.frame;
    if (s.frame) $('camFrame').src = s.frame;
  } catch {
    $('camStart').hidden = $('calibrate').hidden = $('camFrame').hidden = true;
    $('camStatus').textContent = 'ใช้กับหน้านี้ไม่ได้ ลองรีเฟรชหน้าเว็บ หรือเปิดเว็บอื่น';
  }
}
$('camStart').onclick = () => cam('start');
$('calibrate').onclick = () => cam('calibrate');

const stopAllCams = async () => {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((t) => chrome.tabs.sendMessage(t.id, { type: 'cam', act: 'stop' }).catch(() => {})));
};

// One drain at a time. Choosing the Joy-Con stops every tilt cam; choosing the tilt cam disables the
// Joy-Con (offscreen/joycon.js reads drainMode). Clicking the chosen one again turns it off.
let mode = null;
function showMode() {
  for (const b of document.querySelectorAll('.modes button')) b.classList.toggle('on', b.dataset.mode === mode);
  $('noMode').hidden = !!mode;
  $('camPanel').hidden = mode !== 'cam';
  $('joyconPanel').hidden = mode !== 'joycon';
}
async function choose(next) {
  mode = mode === next ? null : next;
  showMode();
  await chrome.storage.local.set({ drainMode: mode });
  if (mode === 'cam') await cam('start');
  else await stopAllCams();
}
for (const b of document.querySelectorAll('.modes button')) b.onclick = () => choose(b.dataset.mode);
chrome.storage.local.get({ drainMode: null }, (s) => {
  mode = s.drainMode;
  showMode();
});

const JOYCON_FILTERS = [0x2006, 0x2007, 0x2009].map((productId) => ({ vendorId: 0x057e, productId }));
// The chooser only lists controllers that are connected right now; a paired Joy-Con drops off
// Bluetooth when it sleeps and the PC can't wake it.
const NOT_LISTED = 'ไม่เจอจอยคอน? ต้องเชื่อมบลูทูธไว้ก่อน กดปุ่มอะไรก็ได้บนจอยจนไฟหยุดกะพริบ แล้วลองใหม่';

function padCard(p) {
  const line = (cls, text) => Object.assign(document.createElement('div'), { className: cls, textContent: text });
  const card = line('pad', '');
  card.title = p.error ?? ''; // the technical reason, on hover
  const [cls, text] = p.streaming ? ['ok', 'เชื่อมต่อแล้ว'] : p.error ? ['fail', 'เชื่อมต่อไม่สำเร็จ ลองใหม่'] : ['wait', 'กำลังเชื่อมต่อ…'];
  card.append(line('', p.name), line(`state ${cls}`, text));
  return card;
}

let settingsLoaded = false;
async function joycon(act, extra = {}) {
  const s = await chrome.runtime.sendMessage({ type: 'joycon', act, ...extra }).catch(() => null);
  if (!s) return; // offscreen document not up yet
  if (!s.hid) {
    $('pair').disabled = true;
    $('jcStatus').textContent = 'เบราว์เซอร์นี้ใช้จอยคอนไม่ได้ ใช้ Chrome, Edge หรือ Brave บนคอมพิวเตอร์';
  }
  if (!settingsLoaded) {
    $('gain').value = s.settings.gain;
    $('invert').checked = s.settings.invert;
    settingsLoaded = true;
  }
  $('jcControls').hidden = !s.pads.length;
  $('pads').replaceChildren(...s.pads.map(padCard));
  if (s.pads.some((p) => p.streaming)) $('jcStatus').textContent = '';
}

$('pair').onclick = async () => {
  try {
    const devices = await navigator.hid.requestDevice({ filters: JOYCON_FILTERS });
    $('jcStatus').textContent = devices.length ? 'กำลังเชื่อมต่อ…' : NOT_LISTED;
    if (devices.length) await joycon('refresh');
  } catch (e) {
    $('jcStatus').textContent = e.name === 'NotFoundError' ? NOT_LISTED : e.message;
  }
};
const sendSettings = () => joycon('settings', { settings: { gain: +$('gain').value, invert: $('invert').checked } });
$('gain').oninput = sendSettings;
$('invert').onchange = sendSettings;

chrome.runtime.sendMessage({ type: 'ensureSim' }).catch(() => {}).then(() => joycon('status'));
setInterval(() => {
  if (mode === 'cam') cam('status');
  if (mode === 'joycon') joycon('status');
}, 250);

function showCheat(on) {
  $('mainView').hidden = on;
  $('cheatView').hidden = !on;
}
const pickCheat = (pct) => {
  $('cheatLevel').value = pct;
  $('cheatPick').textContent = `${pct}%`;
};
const setLevel = (pct) => chrome.storage.local.set({ target: pct / 100 });

$('cheat').onclick = () => {
  chrome.storage.local.get({ target: 0 }, (s) => pickCheat(Math.round(s.target * 100)));
  showCheat(true);
};
$('cheatBack').onclick = () => showCheat(false);
$('cheatLevel').oninput = () => pickCheat($('cheatLevel').value);
$('cheatSet').onclick = () => setLevel(+$('cheatLevel').value);
for (const b of document.querySelectorAll('[data-pct]')) {
  b.onclick = () => {
    pickCheat(b.dataset.pct);
    setLevel(+b.dataset.pct);
  };
}
$('drainAll').onclick = () => {
  pickCheat(0);
  setLevel(0);
};
