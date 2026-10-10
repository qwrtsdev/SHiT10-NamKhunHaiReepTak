// Toolbar popup: current level, open the Joy-Con scooper window, and a cheat drain for testing.

const fill = document.querySelector('.fill'), pct = document.querySelector('.pct');
function show(target = 0) {
  fill.style.width = `${target * 100}%`;
  pct.textContent = `${Math.round(target * 100)}%`;
}
chrome.storage.local.get({ target: 0 }, (s) => show(s.target));
chrome.storage.onChanged.addListener((c) => c.target && show(c.target.newValue));

// One scooper window: focus it if it's already open. It has to stay open to keep the Joy-Con connected.
document.getElementById('joycon').onclick = async () => {
  const url = chrome.runtime.getURL('src/joycon/joycon.html');
  const [open] = await chrome.runtime.getContexts({ contextTypes: ['TAB'], documentUrls: [url] });
  if (open) await chrome.windows.update(open.windowId, { focused: true });
  else await chrome.windows.create({ url, type: 'popup', width: 480, height: 760 });
  window.close();
};

document.getElementById('cheat').onclick = () => chrome.storage.local.set({ target: 0 });
