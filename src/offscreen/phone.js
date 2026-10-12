// The phone runs the gesture itself (no network lag) and sends { t: 'scoop', fill } to take water out.
// Laptop → phone: cfg { dip, lift, timeout, gain, invert, enabled } · lv { v, en } (level, ~4/s) · got { amount, v }
// Phone → laptop: hi { name, ios, vib } · st { s, f, p } (state, fill 0–1, pitch °, ~10/s) · scoop { fill }

// Picking the phone registers with the PeerJS server.
const phoneSettings = drainSettings('phone', ({ enabled }) => {
  if (enabled) phoneStart();
  phoneCfg();
});
const phone = { id: null, peer: null, conn: null, ready: false, error: null, info: null, st: null, seen: 0, scoops: 0, sentLv: '' };

const phoneSend = (m) => phone.conn?.open && phone.conn.send(m);
const phoneCfg = () => phoneSend({ t: 'cfg', ...SCOOP_LIMITS, ...phoneSettings });

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
  if (m.t === 'hi') {
    phone.info = { name: String(m.name ?? '').slice(0, 40), ios: !!m.ios, vib: !!m.vib };
    sfx.hello();
  }
  if (m.t === 'st') {
    const was = phone.st;
    phone.st = { state: String(m.s), fill: clamp(+m.f || 0, 0, 1), pitch: +m.p || 0 };
    if (phoneSettings.enabled) phoneSound(was, phone.st);
  }
  if (m.t === 'scoop' && phoneSettings.enabled) {
    const got = scoopWater(clamp(+m.fill || 0, 0, 1) * SCOOP_MAX);
    if (got > 0) phone.scoops++;
    phoneSend({ t: 'got', amount: got, v: waterLevel() });
  }
}

// Phone scoop sounds from its ~10/s st updates; the splash comes with scoopWater().
function phoneSound(was, st) {
  const wet = waterLevel() > 0;
  if (st.state === 'fill' && wet) {
    if (r() < 0.6) sfx.glug(r() * 0.1);
    for (let i = 0; i < 2; i++) if (r() < 0.7) sfx.bubble(r() * 0.1);
  } else if (st.state === 'fill') {
    if (r() < 0.8) sfx.scrape();
  } else if (st.state === 'lift') {
    sfx.drip(r() * 0.1);
  } else if (st.state === 'ready' && was?.state === 'lift') {
    sfx.spill(was.fill); // too slow: lift → ready without the scoop's cool state
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

stored.then((s) => {
  phone.id = s?.phoneId;
  if (!phone.id) {
    phone.id = `namkhun-${crypto.randomUUID().slice(0, 13)}`;
    chrome.runtime.sendMessage({ type: 'setStorage', values: { phoneId: phone.id } }).catch(() => {});
  }
  if (phoneSettings.enabled) phoneStart(); // drainSettings() picked it before the id was known
});

chrome.runtime.onMessage.addListener((m, _sender, reply) => {
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
