// Hosts the phone scooper in the offscreen document, next to the Joy-Cons. The phone opens
// phone/index.html#pair=<id> (QR in the popup) and connects over WebRTC (PeerJS, src/vendor/).
// The phone runs the dip-and-flip gesture itself (its sensors, its vibration/sound, no network lag)
// with the thresholds we send, and asks us to take the water out: { t: 'scoop', fill }.
// The popup polls { type: 'phone', act: 'status' } to show the QR, the phone and its bucket.
//
// Laptop → phone: cfg { dip, lift, timeout, gain, invert, enabled } · lv { v, en } (level, ~4/s) · got { amount, v }
// Phone → laptop: hi { name, ios, vib } · st { s, f, p } (state, fill 0–1, pitch °, ~10/s) · scoop { fill }

// enabled: the phone is the drain chosen in the popup (storage drainMode, relayed by background.js).
const phoneSettings = { gain: 0.8, invert: false, enabled: false };
const phone = { id: null, peer: null, conn: null, ready: false, error: null, info: null, st: null, seen: 0, scoops: 0, sentLv: '' };

const phoneSend = (m) => phone.conn?.open && phone.conn.send(m);
const phoneCfg = () => phoneSend({ t: 'cfg', dip: DIP_DEG, lift: LIFT_DEG, timeout: LIFT_TIMEOUT, ...phoneSettings });

// Registers our id with the PeerJS server so the phone can find us. Started the first time the
// phone drain is chosen, then kept, so a connected phone survives switching drains back and forth.
function phoneStart() {
  if (phone.peer || !phone.id) return;
  const peer = (phone.peer = new Peer(phone.id, { debug: 0 }));
  peer.on('open', () => Object.assign(phone, { ready: true, error: null }));
  peer.on('connection', (c) => {
    c.on('open', () => {
      if (phone.conn !== c) phone.conn?.close(); // newest phone wins
      Object.assign(phone, { conn: c, seen: Date.now(), info: null, st: null, sentLv: '' });
      phoneCfg();
    });
    c.on('data', (m) => c === phone.conn && phoneData(m));
    c.on('close', () => c === phone.conn && Object.assign(phone, { conn: null, info: null, st: null }));
  });
  // Lost the signalling server (sleep, network change): an open data connection keeps working.
  peer.on('disconnected', () => {
    phone.ready = false;
    setTimeout(() => peer.destroyed || peer.reconnect(), 2000);
  });
  peer.on('error', (e) => {
    phone.error = e.type;
    // After a browser restart the server can still hold our id for a while: try again.
    if (e.type === 'unavailable-id' || e.type === 'server-error') {
      peer.destroy();
      Object.assign(phone, { peer: null, ready: false });
      setTimeout(phoneStart, 3000);
    }
  });
}

function phoneData(m) {
  phone.seen = Date.now();
  if (m.t === 'hi') phone.info = { name: String(m.name ?? '').slice(0, 40), ios: !!m.ios, vib: !!m.vib };
  if (m.t === 'st') phone.st = { state: String(m.s), fill: clamp(+m.f || 0, 0, 1), pitch: +m.p || 0 };
  if (m.t === 'scoop' && phoneSettings.enabled) {
    const got = scoopWater(clamp(+m.fill || 0, 0, 1) * SCOOP_MAX); // offscreen/joycon.js
    if (got > 0) phone.scoops++;
    phoneSend({ t: 'got', amount: got, v: waterLevel() });
  }
}

// The phone fills its bucket faster in deep water, so it needs the level. Also a heartbeat both ways:
// the phone sends st ~10/s, and a WebRTC channel can take ~30 s to notice the other side is gone.
let phoneBeat = 0;
setInterval(() => {
  if (phone.conn?.open && Date.now() - phone.seen > 10000) phone.conn.close();
  const lv = `${Math.round(waterLevel() * 1000)},${phoneSettings.enabled}`;
  if (lv === phone.sentLv && ++phoneBeat < 8) return;
  phoneBeat = 0;
  phone.sentLv = lv;
  phoneSend({ t: 'lv', v: waterLevel(), en: phoneSettings.enabled });
}, 250);

chrome.runtime.sendMessage({ type: 'simInit' }).then((s) => {
  phone.id = s?.phoneId;
  if (!phone.id) {
    phone.id = `namkhun-${crypto.randomUUID().slice(0, 13)}`;
    chrome.runtime.sendMessage({ type: 'setStorage', values: { phoneId: phone.id } }).catch(() => {});
  }
  phoneSettings.enabled = s?.drainMode === 'phone';
  if (phoneSettings.enabled) phoneStart();
});

chrome.runtime.onMessage.addListener((m, _sender, reply) => {
  if (m.type === 'storage' && m.drainMode !== undefined) {
    phoneSettings.enabled = m.drainMode === 'phone';
    if (phoneSettings.enabled) phoneStart();
    phoneCfg();
  }
  if (m.type !== 'phone') return;
  if (m.act === 'settings') {
    Object.assign(phoneSettings, m.settings);
    phoneCfg();
  }
  if (m.act === 'start') phoneStart();
  const live = !!phone.conn?.open && Date.now() - phone.seen < 4000;
  reply({
    id: phone.id,
    ready: phone.ready,
    error: phone.error,
    connected: !!phone.conn?.open,
    live,
    info: phone.info,
    st: live ? phone.st : null,
    scoops: phone.scoops,
    settings: phoneSettings,
  });
});
