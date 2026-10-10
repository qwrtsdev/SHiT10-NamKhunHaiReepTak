// Bottom-left dock with the ways to get the water out:
//   📷 TILT CAM: webcam tilt (drains/camera.js)    🎮 JOY-CON: opens the scooper window
//   🌬️ BLOW: microphone (drains/blow.js)           👄 DRINK: open your mouth to the webcam (drains/drink.js)
// Each active one gets a panel above the buttons (preview, meter, status, stop).
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
      .row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; max-width: calc(100vw - 24px); }
      .panels { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; margin-bottom: 8px; max-width: calc(100vw - 24px); }
      .panels:not(:has(.panel:not([hidden]))) { display: none; }
      button { border: 0; border-radius: 999px; padding: 6px 10px; cursor: pointer;
        background: rgba(15,60,130,.85); color: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.3); user-select: none; }
      button:hover { background: rgba(25,90,180,.95); }
      button.on { background: rgba(20,140,90,.92); }
      button.on:hover { background: rgba(30,165,110,.98); }
      .panel { width: 220px; padding: 8px; border-radius: 12px;
        background: rgba(10,30,70,.9); color: #fff; box-shadow: 0 2px 10px rgba(0,0,0,.4); }
      [hidden] { display: none !important; }
      .title { font-weight: 700; margin-bottom: 6px; }
      video, canvas { width: 100%; border-radius: 8px; background: #000; display: block; }
      video { transform: scaleX(-1); }
      .status { margin: 6px 0; min-height: 2.6em; font-weight: 400; }
      .meter { position: relative; height: 54px; overflow: hidden; }
      .bucket { position: absolute; left: 50%; top: 4px; font-size: 38px; transition: transform .1s linear; }
      .bar { height: 12px; border-radius: 6px; background: rgba(255,255,255,.15); overflow: hidden; }
      .bar > div { height: 100%; width: 0; background: linear-gradient(90deg, #7fd1ff, #ff6b6b); transition: width .1s linear; }
      .panel .row button { flex: 1; border-radius: 8px; padding: 5px; }
    </style>
    <div class="panels">
      <div class="panel cam" hidden>
        <div class="title">📷 Tilt the laptop</div>
        <div class="vid"></div>
        <div class="meter"><div class="bucket">🪣</div></div>
        <div class="status"></div>
        <div class="row"><button data-act="calibrate">Calibrate level</button><button data-act="camStop">Stop</button></div>
      </div>
      <div class="panel blow" hidden>
        <div class="title">🌬️ Blow into the mic</div>
        <div class="bar"><div></div></div>
        <div class="status"></div>
        <div class="row"><button data-act="blowStop">Stop</button></div>
      </div>
      <div class="panel drink" hidden>
        <div class="title">👄 Drink it</div>
        <div class="view"></div>
        <div class="bar"><div></div></div>
        <div class="status"></div>
        <div class="row"><button data-act="drinkCal">Recalibrate</button><button data-act="drinkStop">Stop</button></div>
      </div>
    </div>
    <div class="row">
      <button data-act="camera" title="Use the webcam to detect when you tilt the laptop">📷 TILT CAM</button>
      <button data-act="joycon" title="Open the Joy-Con scooper window">🎮 JOY-CON</button>
      <button data-act="blow" title="Blow into the microphone: the louder, the faster it drains">🌬️ BLOW</button>
      <button data-act="drink" title="Hold your mouth open to the webcam to drink the water">👄 DRINK</button>
    </div>`;
  const $ = (s) => root.querySelector(s);
  dockUi = {
    cam: { panel: $('.cam'), vid: $('.vid'), status: $('.cam .status'), bucket: $('.bucket'), btn: $('[data-act=camera]') },
    blow: { panel: $('.blow'), bar: $('.blow .bar > div'), status: $('.blow .status'), btn: $('[data-act=blow]') },
    drink: { panel: $('.drink'), view: $('.view'), bar: $('.drink .bar > div'), status: $('.drink .status'), btn: $('[data-act=drink]') },
  };
  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'camera') cam.on ? camStop() : camStart();
    if (act === 'calibrate') camCalibrate();
    if (act === 'camStop') camStop();
    if (act === 'joycon') chrome.runtime.sendMessage({ type: 'openJoycon' }).catch(() => {});
    if (act === 'blow') blow.on ? blowStop() : blowStart();
    if (act === 'blowStop') blowStop();
    if (act === 'drink') drink.on ? drinkStop() : drinkStart();
    if (act === 'drinkCal') drinkRecalibrate();
    if (act === 'drinkStop') drinkStop();
  });
  document.body.append(dock);
}

effects.push((f) => {
  const show = water.level > 0.005 || cam.on || blow.on || drink.on;
  if (!dock) {
    if (!show) return;
    buildDock();
  }
  const display = show ? '' : 'none';
  if (dock.style.display !== display) dock.style.display = display;
  if (!show || f.t - dockText < 0.1) return; // text updates at 10 Hz
  dockText = f.t;
  const { cam: c, blow: b, drink: k } = dockUi;

  // A panel stays up after a failed start so its error shows; Stop / starting again clears it.
  c.btn.classList.toggle('on', cam.on);
  c.panel.hidden = !cam.on && !cam.status;
  c.status.textContent = cam.status;
  if (cam.video && cam.video.parentNode !== c.vid) c.vid.replaceChildren(cam.video);
  if (!cam.video) c.vid.replaceChildren();
  // The bucket follows the estimated angle: shifts sideways and rotates, clamped to the panel.
  const tilt = cam.angle / CAM_MAX_ANGLE;
  c.bucket.style.transform = `translateX(calc(-50% + ${tilt * 70}px)) rotate(${cam.angle * 2}deg)`;

  b.btn.classList.toggle('on', blow.on);
  b.panel.hidden = !blow.on && !blow.status;
  b.status.textContent = blow.status;
  b.bar.style.width = `${blow.strength * 100}%`;

  k.btn.classList.toggle('on', drink.on);
  k.panel.hidden = !drink.on && !drink.status;
  k.status.textContent = drink.status;
  k.bar.style.width = `${drink.open * 100}%`;
  if (drink.on && drink.view && drink.view.parentNode !== k.view) k.view.replaceChildren(drink.view);
  if (!drink.on) k.view.replaceChildren();
});
