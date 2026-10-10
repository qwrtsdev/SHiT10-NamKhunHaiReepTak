// Service worker: the level badge on the toolbar icon, the Joy-Con window opener, and the bridge to the shared water simulation
// (src/offscreen/). Offscreen documents only get chrome.runtime, so storage goes through here.

function showLevel(target = 0) {
  const pct = Math.round(target * 100);
  chrome.action.setBadgeText({ text: pct ? `${pct}%` : '' });
  chrome.action.setBadgeBackgroundColor({ color: pct >= 100 ? '#c62828' : '#1565c0' });
}

let creating = null;
async function ensureSim() {
  const [doc] = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (doc) return;
  creating ??= chrome.offscreen
    .createDocument({ url: 'src/offscreen/sim.html', reasons: ['WORKERS'], justification: 'Runs one water simulation shared by every tab.' })
    .catch(() => {}) // another call created it first
    .finally(() => (creating = null));
  await creating;
}

// Started eagerly so the sim already exists (at the current level) before the next prompt floods.
ensureSim();
chrome.storage.local.get({ target: 0 }, (s) => showLevel(s.target));

chrome.storage.onChanged.addListener((c) => {
  if (c.target) showLevel(c.target.newValue);
  if (c.target || c.speed || c.scoop) {
    const msg = { type: 'storage', target: c.target?.newValue, speed: c.speed?.newValue, scoop: c.scoop?.newValue };
    chrome.runtime.sendMessage(msg).catch(() => {}); // no offscreen doc yet: nothing to tell
  }
});

// One Joy-Con scooper window: focus it if it's already open. It has to stay open to keep the Joy-Con
// connected. Opened from the popup or the 🎮 button in a page's dock (effects/dock.js).
async function openJoycon() {
  const url = chrome.runtime.getURL('src/joycon/joycon.html');
  const [open] = await chrome.runtime.getContexts({ contextTypes: ['TAB'], documentUrls: [url] });
  if (open) await chrome.windows.update(open.windowId, { focused: true });
  else await chrome.windows.create({ url, type: 'popup', width: 480, height: 760 });
}

chrome.runtime.onMessage.addListener((m, _sender, reply) => {
  if (m.type === 'setTarget') chrome.storage.local.set({ target: m.target });
  if (m.type === 'openJoycon') openJoycon().then(() => reply(), () => reply());
  else if (m.type === 'ensureSim') ensureSim().then(() => reply());
  else if (m.type === 'simInit') chrome.storage.local.get(['target', 'speed'], reply);
  else return;
  return true; // reply comes later
});
