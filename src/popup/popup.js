// Toolbar popup: current level, the drain picker (one at a time: tilt cam, Joy-Con or phone), the tilt
// cam (runs in a tab), Joy-Con pairing and status, the phone's QR and status (the controllers and the
// phone link run in the offscreen document, offscreen/joycon.js and offscreen/phone.js), and the
// "ขอลองโกงหน่อย" view: set the water to any % or drain it all.

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

// One drain at a time. Choosing the Joy-Con or phone stops every tilt cam; the Joy-Con and phone only
// scoop while chosen (offscreen/ reads drainMode). Clicking the chosen one again turns it off.
let mode = null;
function showMode() {
  for (const b of document.querySelectorAll('.modes button')) b.classList.toggle('on', b.dataset.mode === mode);
  $('noMode').hidden = !!mode;
  $('camPanel').hidden = mode !== 'cam';
  $('joyconPanel').hidden = mode !== 'joycon';
  $('phonePanel').hidden = mode !== 'phone';
  if (mode === 'phone') phone('start');
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

// ---- phone (offscreen/phone.js hosts the link; the phone opens phone/index.html#pair=<id>) ----
// The phone page has to be on https (motion sensors need a secure context), so it can't come from
// the extension itself: by default it's this repo's GitHub Pages site.
const PHONE_URL = 'https://qwrtsdev.github.io/shitx-flood/phone/';
const PHONE_STATE = { ready: 'ชี้ลงเพื่อตัก', fill: 'กำลังตักน้ำ…', lift: 'สะบัดขึ้น!', cool: 'เทออกแล้ว', off: 'ปิดอยู่' };
let phoneUrl = PHONE_URL, phoneQrFor = '', phoneSettingsLoaded = false, qrWanted = false;

function phoneCardFor(s) {
  const line = (cls, text) => Object.assign(document.createElement('div'), { className: cls, textContent: text });
  const card = line('pad', '');
  const name = `📱 ${s.info?.name || 'มือถือ'}`;
  const [cls, text] = s.live ? ['ok', 'เชื่อมต่อแล้ว'] : ['wait', 'สัญญาณหาย…'];
  card.append(line('', name), line(`state ${cls}`, text));
  if (!s.st) return [card];
  const bucket = line('bucket', ''), level = document.createElement('div');
  level.style.width = `${Math.round(s.st.fill * 100)}%`;
  bucket.append(level);
  const info = line('muted', `🪣 ${PHONE_STATE[s.st.state] ?? s.st.state} · ตักไปแล้ว ${s.scoops} ครั้ง`);
  return [card, bucket, info];
}

async function phone(act, extra = {}) {
  const s = await chrome.runtime.sendMessage({ type: 'phone', act, ...extra }).catch(() => null);
  if (!s?.id) return; // offscreen document not up yet
  const url = `${phoneUrl}#pair=${s.id}`;
  if (url !== phoneQrFor) {
    const q = qrcode(0, 'M');
    q.addData(url);
    q.make();
    $('qr').src = q.createDataURL(6, 2);
    $('phoneLink').href = $('phoneLink').textContent = url;
    phoneQrFor = url;
  }
  if (!phoneSettingsLoaded) {
    $('phoneGain').value = s.settings.gain;
    $('phoneInvert').checked = s.settings.invert;
    phoneSettingsLoaded = true;
  }
  $('qrBox').hidden = s.live && !qrWanted;
  $('showQr').hidden = !$('qrBox').hidden;
  $('phoneControls').hidden = !s.connected;
  $('phoneCard').replaceChildren(...(s.connected ? phoneCardFor(s) : []));
  $('phoneStatus').textContent = s.connected ? ''
    : !s.ready ? (s.error ? `กำลังต่อเซิร์ฟเวอร์ใหม่… (${s.error})` : 'กำลังเตรียมการเชื่อมต่อ…')
    : 'รอมือถือสแกน QR แล้วกด "เริ่มตักน้ำ" บนมือถือ';
}

$('showQr').onclick = () => {
  qrWanted = true;
  phone('status');
};
const sendPhoneSettings = () => phone('settings', { settings: { gain: +$('phoneGain').value, invert: $('phoneInvert').checked } });
$('phoneGain').oninput = sendPhoneSettings;
$('phoneInvert').onchange = sendPhoneSettings;

chrome.storage.local.get({ phoneUrl: PHONE_URL }, (s) => ($('phoneUrl').value = phoneUrl = s.phoneUrl));
$('phoneUrl').onchange = () => {
  let v = $('phoneUrl').value.trim().replace(/#.*$/, '') || PHONE_URL;
  if (!/^https:\/\/|^http:\/\/localhost[:/]/.test(v)) v = `https://${v.replace(/^\w+:\/\//, '')}`;
  $('phoneUrl').value = phoneUrl = v;
  chrome.storage.local.set({ phoneUrl: v });
  phone('status');
};

chrome.runtime.sendMessage({ type: 'ensureSim' }).catch(() => {}).then(() => {
  joycon('status');
  if (mode === 'phone') phone('start');
});
setInterval(() => {
  if (mode === 'cam') cam('status');
  if (mode === 'joycon') joycon('status');
  if (mode === 'phone') phone('status');
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
