// Toolbar popup: current level, the tilt cam (runs in the active tab), the Joy-Con scooper window,
// and a cheat drain for testing.

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
    $('cam').disabled = false;
    $('cam').textContent = s.on ? '📷 Stop tilt cam' : '📷 Tilt cam';
    $('cam').classList.toggle('on', s.on);
    $('calibrate').hidden = !s.on;
    $('camStatus').textContent = s.status;
    $('camFrame').hidden = !s.frame;
    if (s.frame) $('camFrame').src = s.frame;
  } catch {
    $('cam').disabled = true;
    $('calibrate').hidden = $('camFrame').hidden = true;
    $('camStatus').textContent = "The tilt cam can't run on this page (browser pages, or the page needs a reload after installing).";
  }
}
$('cam').onclick = () => cam('toggle');
$('calibrate').onclick = () => cam('calibrate');
cam('status');
setInterval(() => cam('status'), 250);

$('joycon').onclick = async () => {
  await chrome.runtime.sendMessage({ type: 'openJoycon' });
  window.close();
};

$('cheat').onclick = () => chrome.storage.local.set({ target: 0 });
