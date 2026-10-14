// offscreen documents only get chrome.runtime, so storage goes through here.

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
    .createDocument({
      url: 'src/offscreen/index.html', reasons: ['WORKERS', 'WEB_RTC'],
      justification: 'Runs one water simulation shared by every tab, and the WebRTC link to a phone used as a scoop.'
    })
    .catch(() => { }) // another call created it first
    .finally(() => (creating = null));
  await creating;
}

// started eagerly so the sim already exists (at the current level) before the next prompt floods.
ensureSim();
chrome.storage.local.get({ target: 0 }, (s) => showLevel(s.target));

chrome.storage.onChanged.addListener((c) => {
  if (c.target) showLevel(c.target.newValue);
  if (c.target || c.scoop || c.drainMode) {
    const msg = {
      type: 'storage', target: c.target?.newValue, scoop: c.scoop?.newValue,
      drainMode: c.drainMode && (c.drainMode.newValue ?? null)
    };
    chrome.runtime.sendMessage(msg).catch(() => { }); // no offscreen doc yet: nothing to tell
  }
});

chrome.runtime.onMessage.addListener((m, _sender, reply) => {
  if (m.type === 'setTarget') chrome.storage.local.set({ target: m.target });
  if (m.type === 'setStorage') chrome.storage.local.set(m.values);
  if (m.type === 'ensureSim') ensureSim().then(() => reply());
  else if (m.type === 'getStored') chrome.storage.local.get(['target', 'drainMode', 'phoneId'], reply);
  else return;
  return true; // reply comes later
});
