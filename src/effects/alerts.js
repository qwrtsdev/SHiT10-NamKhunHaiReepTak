// A message box when the water rises past a level: muffling starts, then the chat box locks.
// alertsShown lives in storage so only the tab you're looking at shows it once, not every tab you
// switch to afterwards. It re-arms when the shared level drops back below.

const ALERTS = [
  { at: MUFFLE_FROM, icon: '🔇', text: 'ระดับน้ำเริ่มเพิ่มขึ้นสูงเรื่อยๆ เริ่มไม่ได้ยินเสียงแล้ว' },
  { at: INPUT_LOCK_AT, icon: '🌊', text: 'คุณใช้เยอะเกินไป โลกร้อนจนน้ำท่วมจนแป้นพิมพ์จมไปในน้ำแล้ว!' },
];
let alertsShown = {}, alertHost = null;

chrome.storage.local.get({ alertsShown: {} }, (s) => (alertsShown = s.alertsShown));
chrome.storage.onChanged.addListener((c) => {
  if (c.alertsShown) alertsShown = c.alertsShown.newValue ?? {};
});

function setAlertShown(at, shown) {
  alertsShown = { ...alertsShown, [at]: shown };
  chrome.storage.local.set({ alertsShown });
}

// danger: red, shakes, and leaves sooner (used by chat.js when the locked chat box is clicked).
function showAlert({ icon, text, danger = false }) {
  alertHost?.remove();
  const host = (alertHost = document.createElement('div'));
  host.style.cssText = 'all:initial;position:fixed;left:50%;top:24px;transform:translateX(-50%);z-index:2147483647;pointer-events:none';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      .box { box-sizing: border-box; width: max-content; max-width: min(480px, calc(100vw - 32px));
        display: flex; gap: 10px; align-items: center; padding: 14px 18px; border-radius: 12px;
        background: rgba(10, 40, 90, .95); color: #fff; font: 600 16px/1.5 system-ui, sans-serif;
        box-shadow: 0 6px 24px rgba(0, 0, 0, .4); animation: in .3s ease-out, out .5s ease-in 5.5s forwards; }
      .box.danger { background: rgba(198, 40, 40, .95); animation: shake .45s ease-in-out, out .5s ease-in 2.5s forwards; }
      .icon { font-size: 26px; }
      @keyframes in { from { opacity: 0; transform: translateY(-16px); } }
      @keyframes shake { 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
      @keyframes out { to { opacity: 0; transform: translateY(-16px); } }
    </style>
    <div class="box" role="alert"><span class="icon"></span><span class="text"></span></div>`;
  root.querySelector('.box').classList.toggle('danger', danger);
  root.querySelector('.icon').textContent = icon;
  root.querySelector('.text').textContent = text;
  root.querySelector('.box').addEventListener('animationend', (e) => e.animationName === 'out' && host.remove());
  document.body.append(host); // after the canvas, so it shows above the water
}

effects.push(() => {
  for (const a of ALERTS) {
    if (!alertsShown[a.at] && water.level >= a.at && !document.hidden) {
      setAlertShown(a.at, true);
      showAlert(a);
    } else if (alertsShown[a.at] && water.target < a.at - 0.02) {
      setAlertShown(a.at, false);
    }
  }
});
