// Toolbar popup: current level, open the Joy-Con scooper window, and a cheat drain for testing.

const fill = document.querySelector('.fill'), pct = document.querySelector('.pct');
function show(target = 0) {
  fill.style.width = `${target * 100}%`;
  pct.textContent = `${Math.round(target * 100)}%`;
}
chrome.storage.local.get({ target: 0 }, (s) => show(s.target));
chrome.storage.onChanged.addListener((c) => c.target && show(c.target.newValue));

// background.js opens (or focuses) the one scooper window.
document.getElementById('joycon').onclick = async () => {
  await chrome.runtime.sendMessage({ type: 'openJoycon' });
  window.close();
};

document.getElementById('cheat').onclick = () => chrome.storage.local.set({ target: 0 });
