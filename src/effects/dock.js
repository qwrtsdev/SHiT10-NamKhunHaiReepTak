// Bottom-left controls for tilting the screen: the 🫗 grip (drag ↔ to tilt) and, once the water is
// CAM_SHOW_AT high, 📷 CAMERA (webcam tilt, drains/camera.js) with its preview, bucket and buttons.
// Lives in a closed shadow root so page CSS can't touch it; appended after the canvas so it stays
// clickable during the 100% lockout.

let dock, dockUi, dockText = 0;

function buildDock() {
  dock = document.createElement('div');
  dock.style.cssText = 'all:initial;position:fixed;left:12px;bottom:12px;z-index:2147483647';
  const root = dock.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      :host { all: initial; position: fixed; left: 12px; bottom: 12px; z-index: 2147483647; }
      * { box-sizing: border-box; font: 600 12px/1.3 system-ui, sans-serif; }
      .row { display: flex; gap: 6px; align-items: center; }
      button, .grip { border: 0; border-radius: 999px; padding: 6px 10px; cursor: pointer;
        background: rgba(15,60,130,.85); color: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.3); user-select: none; }
      .grip { cursor: ew-resize; touch-action: none; }
      button:hover, .grip:hover { background: rgba(25,90,180,.95); }
      .panel { width: 220px; margin-bottom: 8px; padding: 8px; border-radius: 12px;
        background: rgba(10,30,70,.9); color: #fff; box-shadow: 0 2px 10px rgba(0,0,0,.4); }
      .panel[hidden], [hidden] { display: none; }
      video { width: 100%; border-radius: 8px; transform: scaleX(-1); background: #000; display: block; }
      .status { margin: 6px 0; min-height: 2.6em; font-weight: 400; }
      .meter { position: relative; height: 54px; overflow: hidden; }
      .bucket { position: absolute; left: 50%; top: 4px; font-size: 38px; transition: transform .1s linear; }
      .panel .row button { flex: 1; border-radius: 8px; padding: 5px; }
    </style>
    <div class="panel" hidden>
      <div class="vid"></div>
      <div class="meter"><div class="bucket">🪣</div></div>
      <div class="status"></div>
      <div class="row"><button data-act="calibrate">Calibrate level</button><button data-act="stop">Stop camera</button></div>
    </div>
    <div class="row">
      <div class="grip" title="Drag left/right to tilt the screen and pour the water out">🫗 <span class="deg">0°</span></div>
      <button data-act="camera" hidden title="Use the webcam to detect when you tilt the laptop">📷 CAMERA</button>
    </div>`;
  const $ = (s) => root.querySelector(s);
  dockUi = { panel: $('.panel'), vid: $('.vid'), status: $('.status'), bucket: $('.bucket'), deg: $('.deg'), camBtn: $('[data-act=camera]') };
  dragTilter($('.grip'));
  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'camera') camStart();
    if (act === 'calibrate') camCalibrate();
    if (act === 'stop') camStop();
  });
  document.body.append(dock);
}

effects.push((f) => {
  const show = water.level > 0.005 || cam.on;
  if (!dock) {
    if (!show) return;
    buildDock();
  }
  const display = show ? '' : 'none';
  if (dock.style.display !== display) dock.style.display = display;
  if (!show || f.t - dockText < 0.1) return; // text updates at 10 Hz
  dockText = f.t;
  const u = dockUi;
  u.deg.textContent = `${Math.round((sim.tilt * 180) / Math.PI)}°`;
  u.camBtn.hidden = cam.on || water.level < CAM_SHOW_AT;
  u.panel.hidden = !cam.on && !cam.status;
  u.status.textContent = cam.status;
  if (cam.video && cam.video.parentNode !== u.vid) u.vid.replaceChildren(cam.video);
  if (!cam.video) u.vid.replaceChildren();
  // The bucket follows the estimated angle: shifts sideways and rotates, clamped to the panel.
  const k = cam.angle / CAM_MAX_ANGLE;
  u.bucket.style.transform = `translateX(calc(-50% + ${k * 70}px)) rotate(${cam.angle * 2}deg)`;
});
