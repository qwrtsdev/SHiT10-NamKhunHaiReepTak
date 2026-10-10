// Service worker: shows the water level on the toolbar icon.

function showLevel(target = 0) {
  const pct = Math.round(target * 100);
  chrome.action.setBadgeText({ text: pct ? `${pct}%` : '' });
  chrome.action.setBadgeBackgroundColor({ color: pct >= 100 ? '#c62828' : '#1565c0' });
}

chrome.storage.local.get({ target: 0 }, (s) => showLevel(s.target));
chrome.storage.onChanged.addListener((c) => c.target && showLevel(c.target.newValue));
