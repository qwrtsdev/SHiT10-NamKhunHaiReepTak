# shitx-flood

A joke Chrome extension (Manifest V3). Every prompt you send to an AI chat (claude.ai, ChatGPT, Gemini, and a few others) makes water rise on **every website you have open**. Better models flood faster. From 45% the page audio gets muffled and quieter until it sounds fully underwater. At 80% the whole chat input block on supported chat sites (box, attach, model picker, mic, send) stops taking clicks and typing. At 100% you can't click anything until you get the water out. There are three ways to do that, all in the extension's toolbar popup: **📷 tilt the laptop** so it pours off the edge (the webcam notices), **🎮 scoop it out with a Nintendo Joy-Con**, which rumbles like a bucket of water, or **📱 scoop it out with your phone** (scan a QR code; it vibrates on Android, and the water sounds play on the computer).

## Install (dev)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this folder.
3. After editing any file, click the reload ↻ icon on the extension card, then refresh open tabs.

## How it works

| Feature | What happens |
|---|---|
| Prompt detection | On a supported chat site, pressing Enter in the composer (when it has text) or clicking the send button adds water: **prompt length × 0.1% per character × N** (100 characters at ×1 = 10%). Enter + a send click within 600 ms count once. Empty prompts add nothing. |
| Multiplier | A `💧 ×N` badge sits right after the model selector. N = model × effort, read from the selector's label. It multiplies both how much water a prompt adds and the rise speed (`0.1` viewport heights/sec × N). |
| Shared level | The level is in `chrome.storage.local` (`target`, `speed`). Every tab listens to `chrome.storage.onChanged`, so all sites flood together. A newly loaded page starts at the current level. The toolbar icon shows the level as a badge. |
| Water physics | The screen is a 2D tank simulated with the shallow-water equations (`src/shared/sim.js`). One simulation runs for every tab, in the extension's offscreen document (`src/offscreen/`), in a fixed 1600×900 tank. Each visible tab gets its height field ~60 times a second and stretches it to its own window, so all tabs show the same waves. Water rises, sloshes, and slopes when the screen tilts. The page behind it is blurred, more where it's deeper. |
| Muffled audio | From **45% to 70%** (then held), page `<audio>`/`<video>` goes through a Web Audio lowpass filter (cutoff 20 kHz → 300 Hz) and a volume fade down to `MUFFLE_MIN_VOLUME` (60%), so it sounds underwater but never goes silent. |
| Water alerts | A message box at the top of the page when the water rises past **45%** ("ระดับน้ำเริ่มเพิ่มขึ้นสูงเรื่อยๆ เริ่มไม่ได้ยินเสียงแล้ว") and **80%** ("คุณใช้เยอะเกินไป โลกร้อนจนน้ำท่วมจนแป้นพิมพ์จมไปในน้ำแล้ว!"). It starts with 🔇 (45%) or 🌊 (80%), slides in, and slides away by itself after ~6 s. Each shows once, in the tab you're looking at, and again only after the level drops back below it (`alertsShown` in storage, `src/content/effects/alerts.js`). |
| Chat box lock | From **80%**, the whole input block on supported chat sites (the chat box plus its buttons: attach, model picker, mic, send…) is greyed out and refuses clicks, focus, typing, paste and drop. Clicking anywhere on it shows a red, shaking popup: "⌨️ น้ำเข้าแป้นพิมพ์หมดแล้ว เข้าไม่ได้แล้ว!" (~3 s). It unlocks when the water drops below 80%. |
| 100% lockout | The overlay swallows all clicks and flashes a big red **"🚨 พอแล้ว เลิกแล้ว ไม่เอาแล้ว 🚨"** / **"น้ำท่วมจอไปหมดแล้ว"** (1.5 flashes a second). Dragging on the page does nothing. The toolbar popup still works, since it's browser UI. |
| Drained | When the last water leaves the screen, a rainbow **"น้ำหมดแล้วทำงานต่อได้"** shows for 5 s (`src/content/effects/drained.js`). |
| Sounds | Played by the extension's offscreen document (`src/offscreen/sound.js`), once for the whole browser and never muffled: `assets/alarm.mp3` loops while the screen is full, `assets/yay.mp3` plays once when it's empty again, plus the scoop sounds (splash for every scoop; glugs, bubbles, drips and the spill for the phone). Volume: `SOUND_VOLUME`. |
| Drain controls (popup, in Thai) | In the toolbar popup, **one at a time**: pick **📷 เทน้ำออก** (tilt cam), **🎮 ตักน้ำออก** (Joy-Con) or **📱 ตักด้วยมือถือ** (phone) (click the chosen one again to turn it off). The choice is stored as `drainMode` (`cam` / `joycon` / `phone`). Picking the tilt cam starts it on the current tab (live preview, status, **Calibrate level**). Picking the Joy-Con or phone stops the tilt cam in every tab. A connected Joy-Con or phone stays connected while another drain is chosen, but ignores motion and stays silent. The Joy-Con panel shows pairing, live status and rumble settings; the phone panel shows a QR code, the phone's live status and bucket, and vibration settings. |

### Supported chat sites

| Site | Composer | Send button | Model selector (badge) |
|---|---|---|---|
| claude.ai | `[data-testid="chat-input"]` | `[data-testid="chat-input-send"]` | `[data-testid="model-selector-dropdown"]` |
| chatgpt.com | `form[data-chatgpt-composer] [contenteditable]`, `#prompt-textarea` | `[data-testid="send-button"]` (not the stop button) | `[data-testid="model-switcher-dropdown-button"]`, else the title bar's menu button |
| gemini.google.com | `rich-textarea .ql-editor` | `button.send-button:not(.stop)` | `[data-test-id="bard-mode-menu-button"]` |
| grok.com, chat.deepseek.com, perplexity.ai, chat.mistral.ai, copilot.microsoft.com, chat.qwen.ai, meta.ai | any `textarea` / contenteditable | `button[type=submit]` or a button labelled "send" | none (×1) |

### Multiplier tables (`RATES` in `src/shared/config.js`)

| Site | Model × | Effort × |
|---|---|---|
| Claude | Haiku 1, Sonnet 2, Opus 3, Fable 4 | low 1.5, medium 2, high / extended 2.5, xhigh 3, max 3.5 |
| ChatGPT | mini / Instant 1, Auto / GPT-4 1.25, GPT-5 1.5, Thinking / o3 1.75, Pro 2.5 | light 1, standard 1.25, extended 1.5, heavy 2 |
| Gemini | Flash-Lite 1, Flash 1.5, Pro 2 | thinking level ระดับต่ำสุด 1 (default), ปานกลาง 1.5, ระดับสูงสุด 2. It only shows in the open mode menu, so the last one clicked there is remembered (`localStorage` `waterGeminiEffort` on gemini.google.com) |

Matching is a plain substring check on the lowercased label, and the first hit wins, so key order matters (`xhigh` before `high`, `flash-lite` before `flash`).

## Draining

Three ways, all in the toolbar popup: tilt with the webcam (1), a Joy-Con (2) or your phone (3).

### 1. Tilt the screen

Water stays level with the ground, so tilting the screen makes the surface slope. Past **~16°** it pours off the low edge (capped at 12% of the screen per 0.9 s), and floating junk goes with it. Tilt comes from any of these (they add up, clamped to ±45°):

- **📷 Tilt cam (webcam)**: toolbar popup → **เทน้ำออก** (click again to turn it off). It runs in the current tab's page (the popup closes when it loses focus, and the camera permission is per site); the popup sends it start/stop/calibrate messages and shows its status while open. Grant camera access, keep the laptop level for a moment (that's the reference), then tilt it sideways. Each frame (~10/s) is shrunk to 160×120 grayscale. Strong Sobel edges vote into a 36-bin × 5° orientation histogram. Bins 90° apart are folded together, because rooms are full of horizontal *and* vertical lines. The strongest orientation is refined with a weighted circular mean and compared with the reference. The result is smoothed (70% old / 30% new) and clamped to ±28°. Frames below 12% confidence are skipped. **Calibrate level** resets the reference. While open, the popup shows the last analysed frame and the estimated angle.
  - It's a visual estimate, not a measurement. Point the webcam at something with straight lines (door frame, window, shelf), not a blank wall.
  - Frames are analysed locally in the page and never stored or sent. The camera permission is per site, because the content script runs in the page.
- **Motion sensor**: on devices that have one (tablets, 2-in-1s, Chromebooks), `devicemotion` gravity is used directly.

Only the focused tab sends its tilt to the shared simulation, and it drops back to 0 when the tab loses focus. A pour happens once, in the shared simulation, which writes the new level.

### 2. Scoop with a Joy-Con

Click the toolbar icon → **ตักน้ำออก** → **🎮 เชื่อมต่อจอยคอน** (connect Joy-Con) and pick it in the browser's device list (once; it's remembered). No extra window: the controller runs in the extension's offscreen document (`src/offscreen/joycon.js` hosting `src/offscreen/joycon-hid.js`), so scooping keeps working with the popup closed. While open, the popup shows each controller and whether it's connected, plus the rumble settings.

1. Connect the Joy-Con in your OS Bluetooth settings, then press **🎮 เชื่อมต่อจอยคอน** (Chrome/Edge desktop only; L, R and Pro Controller work, and two at once is fine).
2. **Dip**: point the top (shoulder-button end) down past 35°. The bucket fills, faster in deep water. You feel it glug: low rumble with random glugs and bubble ticks.
3. **Scoop**: flip it up past 30°. Each scoop takes a random 5–10% of the screen from every tab, and you feel a splash followed by droplets. The shared simulation picks a random spot, every visible page shows a 🪣 dipping in there with a splash sound, and the water comes out around it, leaving a dent that refills as waves.
4. Too slow (over 1.5 s between leaving the water and flipping up) and the water spills back, with a spill rumble.

When idle, moving the controller makes a sloshing rumble that scales with the water level. With no water left, dipping just gives a dry scrape. Settings: rumble strength, **Flip tip direction** (if dip/flip feel reversed).

### 3. Scoop with your phone

The same dip-and-flip as the Joy-Con, with a phone as the bucket. Click the toolbar icon → **📱 ตักด้วยมือถือ** → scan the QR code with the phone's camera → tap **เริ่มตักน้ำ** on the phone (this asks for motion access on iPhone and keeps the screen on).

1. Hold the bottom of the phone like a ladle.
2. **Dip**: point the top of the phone down past 35°. The bucket on the phone's screen fills, faster in deep water, with glug and bubble sounds from the computer (and vibration on Android).
3. **Scoop**: flip it up past 30° within 1.5 s. A scoop takes up to 10% of the screen (`fill × SCOOP_MAX`, so a full bucket is 10%) from every tab, and every visible page shows the 🪣 like a Joy-Con scoop, with a splash sound from the computer.
4. Too slow and it spills back (spill sound on the computer, long buzz and "ช้าไป น้ำหกหมด!" on the phone).

The phone screen shows the bucket, a tip-angle gauge (blue = dip zone, green = flip zone), a countdown bar while lifting, the water level on the computer and the scoop count. The popup shows the phone and whether it's connected, and the settings: vibration strength and **Flip tip direction**.

All scoop sounds come from the computer, not the phone: `src/offscreen/sound.js` runs in the offscreen document (no visible tab or page click needed). Every Joy-Con or phone scoop splashes, timed with the 🪣 hitting the water; for the phone it also plays glugs and bubbles while filling, drips while lifting and the spill, from the phone's `st` updates. Volume: `SOUND_VOLUME` at the top of that file.

How it's wired:

- **Phone page** (`phone/index.html`): has to be served over **https** (motion sensors need a secure context), so it can't come from the extension itself. By default the QR points to this repo's GitHub Pages site, `https://qwrtsdev.github.io/sht10-namkhunhaireeptak/phone/` (Settings → Pages → deploy from the branch, root folder). To host it somewhere else, change `PHONE_URL` in `src/popup/popup.js`. The page loads PeerJS from `../src/vendor/` and the scoop from `../src/shared/scoop.js`, so host the whole repo, not just `phone/`.
- **Link**: WebRTC through PeerJS (bundled in `src/vendor/peerjs.min.js`, v1.5.4; MV3 doesn't allow remote scripts), using the free PeerJS cloud server for the handshake. The computer side lives in the offscreen document (`src/offscreen/phone.js`), so it keeps working with the popup closed. Its id is fixed (`phoneId` in storage), so the QR code doesn't change and the phone reconnects by itself after a dropout. It registers with the server the first time the phone drain is chosen. Both devices need internet; very strict networks (some school/office Wi-Fi) can block WebRTC.
- **Gesture on the phone**: the phone runs the scoop state machine itself (`src/shared/scoop.js`, the same `Scoop` class as the Joy-Con), so feedback has no network lag. The thresholds (`SCOOP_LIMITS` in `src/shared/config.js`) come in the `cfg` message, so both scoop the same way. Pitch = asin(sin β) from `deviceorientation`, which works the same on iOS and Android.
- **Messages** (JSON): computer → phone: `cfg` (thresholds, gain, invert, enabled), `lv` (water level, ~4/s and at least every 2 s as a heartbeat), `got` (how much a scoop took). Phone → computer: `hi` (device name, iOS, can vibrate), `st` (state, fill, pitch, ~10/s), `scoop` (`fill` 0–1; the computer takes `fill × SCOOP_MAX` through the same `scoopWater()` as the Joy-Con). Each side drops the link after ~7–10 s of silence and the phone reconnects.
- **iPhone**: Safari has no Vibration API, so the iPhone gives no feedback of its own besides the screen; the sounds play on the computer. If motion access was denied: Settings › Apps › Safari › Motion & Orientation Access.

## Files

```
manifest.json            MV3 manifest; lists the content scripts in load order
src/
  shared/                loaded by more than one context
    config.js            tuning knobs (all constants, per-site rate tables, scoop limits) + clamp()
    sim.js               shallow-water height field: waves, tilt, pouring; surfaceAt(), splash(), simRemove()…
                         (stepped only in offscreen/; tabs read it through surfaceAt() etc.)
    scoop.js             Scoop: the dip-and-flip state machine, used by the Joy-Con and the phone page
  content/               content scripts, on every site (one shared global scope, manifest order)
    core.js              shared water state, storage sync, canvas, frame loop, flood(), hooks
    tilt/
      camera.js          webcam tilt estimate (edge orientation histogram); controlled from the popup
      tilt.js            combines camera + motion sensor; the focused tab sends it to the shared sim
    effects/
      waves.js           draws the water + page blur
      drops.js           spray droplets, bubbles, the pour off a tilted edge
      scoop.js           draws the 🪣 for each Joy-Con / phone scoop (the shared sim takes the water)
      percent.js         "💧 NN%" label
      lockout.js         100% click block + flashing red warning
      drained.js         rainbow "น้ำหมดแล้วทำงานต่อได้" for 5 s when the water runs out
      alerts.js          message boxes at 45% and 80%
      muffle.js          lowpass audio muffling
    chat.js              chatSite(): shared prompt detection, speed badge, chat box lock
    sites/
      claude.js, chatgpt.js, gemini.js, others.js   one chatSite() call per site
  background.js          service worker: level badge; creates the offscreen document and relays chrome.storage to and from it
  offscreen/             offscreen document (index.html), alive while the browser runs:
    sim.js               the one shared simulation (steps shared/sim.js, streams it to tabs); stored / onStorage()
    sound.js             scoop sounds, full-screen alarm, drained cheer
    drain.js             what the Joy-Con and phone share: waterLevel(), scoopWater(), drainSettings()
    joycon-hid.js        JoyCon: one controller over WebHID, IMU, HD-rumble haptics (no DOM)
    joycon.js            Joy-Con host: pairing, connect/disconnect, popup status
    phone.js             phone host: PeerJS link, phone sounds, popup status
  popup/                 toolbar popup: level, 📷 tilt cam controls, 🎮 Joy-Con pairing + live status + rumble settings,
                         📱 phone QR + live status + settings, "ขอลองโกงหน่อย" view (set the water to any % or drain it all)
  vendor/                peerjs.min.js (PeerJS 1.5.4, MIT), qrcode.js (qrcode-generator 1.4.4, MIT)
phone/
  index.html             the phone side of 📱 ตักด้วยมือถือ (hosted on https, not part of the extension at runtime)
```

### How the modules fit together

- All content scripts are plain (non-module) scripts listed in `manifest.json` → `content_scripts.js`. They run **in that order** and **share one global scope**. Keep top-level names unique across files; a duplicate `const` breaks the second file.
- Load order: `shared/config.js` → `content/core.js` → `shared/sim.js` → tilt → effects → `chat.js` → sites.
- **An effect** registers a per-frame function: `effects.push((f) => { ... })`, where `f = { ctx, t, dt, d, w, h }` (`d` = devicePixelRatio, `w`/`h` canvas size in device px). Effects run in manifest order; later effects draw on top. Read the water through `water.level` (0–1), `surfaceAt(x)`, `depthAt(x)`, `slopeAt(x)` (CSS px), `sim.tilt`, `sim.pour`. These mirror the shared simulation and are read-only in a tab: `simRemove()` / `splash()` there would be overwritten by the next update.
- **A site** decides when the water rises. It calls `flood(chars, multiplier)`, and core writes the new level to `chrome.storage`, which updates every tab. For a chat site, add `src/content/sites/<site>.js` with one `chatSite({ rates, composer, send, model })` call.
- **A drain** lowers it: set `target` (and `scoop`) in `chrome.storage.local`. Pouring is done inside `src/offscreen/sim.js`. A scooping drain hosted in the offscreen document gets its settings from `drainSettings(mode)` and takes water with `scoopWater(amount)` (`src/offscreen/drain.js`).
- **Shared simulation** (`src/offscreen/sim.js`): tabs connect a `chrome.runtime` port named `sim` while visible. A tab sends `{ tilt }` (radians); the sim sends `{ h, tilt, pour, level }` every 16 ms and `{ bucket: { x, amount } }` when a scoop starts. Offscreen documents can only use `chrome.runtime`, so `background.js` forwards storage changes to the sim (`{ type: 'storage' }`) and writes its pours back (`{ type: 'setTarget' }`).
- Hooks: `waterHooks.rise.push(fn(amount))` when the level goes up, `waterHooks.scoop.push(fn({ x, amount }))` when a Joy-Con or phone scoop starts (`x` = 0–1 across the screen).
- To add a feature, create the file and add it to the manifest list. To disable one, remove it from the list.
- Check for name clashes before committing. This bundles the scripts in manifest order and parse-checks them:
  `python3 -c "import json;print('\n'.join(open(f).read() for f in json.load(open('manifest.json'))['content_scripts'][0]['js']))" > /tmp/b.js && node --check /tmp/b.js`

### Tuning knobs (`src/shared/config.js`)

- `WATER_PER_CHAR`: water per prompt character at ×1 (default `0.001`, so 100 characters = 10%).
- `RISE_SPEED`: base rise speed at ×1 (default `0.1`/sec). `DRAIN_SPEED`: how fast other tabs follow a drop.
- `GRAVITY`, `WAVE_DAMP`, `VISCOSITY`, `COL`: how the water moves (faster sloshing, calmer, smoother, resolution).
- `TILT_LIP` (16°), `MAX_TILT` (45°), `SPILL_RATE`, `MAX_POUR`: pouring.
- `CAM_MAX_ANGLE`, `CAM_MIN_CONFIDENCE`: webcam tilt.
- `MUFFLE_FROM` / `MUFFLE_TO`: audio muffle range (default `0.45` / `0.7`: lowpass 20 kHz → 300 Hz, fully muffled from 70% up).
- `MUFFLE_MIN_VOLUME`: volume when fully muffled (default `0.6`; `0` = silent).
- `INPUT_LOCK_AT`: level where the chat input block is locked (default `0.8`).
- Scoop (Joy-Con and phone): `SCOOP_MIN` / `SCOOP_MAX`, `DIP_DEG`, `LIFT_DEG`, `LIFT_TIMEOUT`.

## Known limits / TODO

- **Chat site selectors may break.** All three apps ship UI changes often. ChatGPT's model switcher selector isn't confirmed (the badge falls back to ×1 if it's not found). The "other sites" list uses generic guesses and hasn't been checked against the live sites.
- **Effort detection is a guess.** It only works if the effort appears in the model selector's label text.
- **Attachment-only prompts** sent with Enter (no text) aren't counted.
- **Webcam tilt is an estimate.** It drifts with blank walls, moving backgrounds or strongly diagonal scenes; recalibrate, or use another drain. Some sites block the camera with a Permissions-Policy, and then only the motion sensor tilts there.
- **Joy-Con**: WebHID only (Chrome/Edge/Brave desktop). Pairing has to happen in the popup (the device chooser needs a click); the connection then lives in the offscreen document. The dip/flip axis follows the Joy-Con tester's frame (x = toward the shoulder buttons). If it feels reversed on your controller, tick **Flip tip direction**. Uses default IMU scaling, not the factory calibration from SPI.
- **Audio muffling misses some sound:** cross-origin media without CORS (skipped on purpose; it would go silent), anything before the first user interaction (autoplay policy), the page's own Web Audio, shadow-DOM media, and iframes (the script runs in the top frame only).
- **Lockout only blocks the mouse.** Keyboard and mouse-wheel scrolling still work at 100%.
- **Shared sim tank is 1600×900.** Tabs stretch it to their own size, so in a window with a very different shape the waves look squashed. The surface can stutter slightly, because tabs draw the latest update without interpolating.
- **Phone**: needs the phone page on https and internet on both devices (PeerJS cloud server + STUN/TURN). The phone has to stay on the page with the screen on (a wake lock is requested). iPhone can't vibrate from a web page, so it gives no haptic feedback.
- **Testing:** verified in Chromium with Playwright against mock pages that use each site's selectors, a synthetic webcam video (a scene rotated 20° → estimated +18.5°), a fake WebHID Joy-Con. Not yet tested on the live chat sites or with a real Joy-Con.
  The phone drain was tested with the unpacked extension (popup opened as a tab) plus a second browser emulating a Pixel 7 and an iPhone 14 at `http://localhost:8080/phone/#pair=<id>` (localhost counts as https), a local PeerJS server (`peer` npm package) patched in for the cloud one, and synthetic `deviceorientation` events: dip → flip took 6%, a slow lift spilled and took nothing, switching to the Joy-Con turned the phone off, Android vibration fired, and the popup showed the QR again after the phone left. Not yet tested on a real phone.
