# shitx-flood

A joke Chrome extension (Manifest V3). Every prompt you send to an AI chat (claude.ai, ChatGPT, Gemini, and a few others) makes water rise on **every website you have open**. Better models flood faster. Past 60% the page audio gets muffled. When water above 60% starts pouring, a mouse runs across the screen. At 100% you can't click anything until you get the water out. There are five ways to do that, all as buttons in the **bottom-left dock** of every flooded page: **🫗 drag** to tilt the screen so it pours off the edge, **📷 tilt the laptop** (the webcam notices), **🎮 scoop it out with a Nintendo Joy-Con**, which rumbles like a bucket of water, **🌬️ blow it away** through the microphone (louder = faster), or **👄 drink it** by holding your mouth open to the webcam.

## Install (dev)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this folder.
3. After editing any file, click the reload ↻ icon on the extension card, then refresh open tabs.

## How it works

| Feature | What happens |
|---|---|
| Prompt detection | On a supported chat site, pressing Enter in the composer (when it has text) or clicking the send button adds water: **prompt length × 0.06% per character × N** (200 characters at ×1 = 12%). Enter + a send click within 600 ms count once. Empty prompts add nothing. |
| Multiplier | A `💧 ×N` badge sits right after the model selector. N = model × effort, read from the selector's label. It multiplies both how much water a prompt adds and the rise speed (`0.03` viewport heights/sec × N). |
| Shared level | The level is in `chrome.storage.local` (`target`, `speed`). Every tab listens to `chrome.storage.onChanged`, so all sites flood together. A newly loaded page starts at the current level. The toolbar icon shows the level as a badge. |
| Water physics | The screen is a 2D tank simulated with the shallow-water equations (`src/sim.js`). One simulation runs for every tab, in the extension's offscreen document (`src/offscreen/`), in a fixed 1600×900 tank. Each visible tab gets its height field ~60 times a second and stretches it to its own window, so all tabs show the same waves. Water rises, sloshes, and slopes when the screen tilts. The page behind it is blurred, more where it's deeper. |
| Pouring mice | When water is at least 60% full and starts pouring, a stream of 24 🐭 runs from left to right across the screen. |
| Muffled audio | From **60% to 70%**, page `<audio>`/`<video>` goes through a Web Audio lowpass filter whose cutoff falls from 20 kHz to 300 Hz. It stays at 300 Hz above 70%. |
| 100% lockout | The overlay swallows all clicks and shows **"กรุณาเทน้ำออกจากจอ"** ("please pour the water out of the screen"). Dragging anywhere tilts the screen. The bottom-left dock stays clickable. |
| Drain dock | Bottom-left of every page once there's water: 🫗 (drag grip, shows the tilt), 📷 TILT CAM, 🎮 JOY-CON, 🌬️ BLOW, 👄 DRINK. Active ones turn green and get a panel above the buttons (preview / meter, status, Stop). |

### Supported chat sites

| Site | Composer | Send button | Model selector (badge) |
|---|---|---|---|
| claude.ai | `[data-testid="chat-input"]` | `[data-testid="chat-input-send"]` | `[data-testid="model-selector-dropdown"]` |
| chatgpt.com | `form[data-chatgpt-composer] [contenteditable]`, `#prompt-textarea` | `[data-testid="send-button"]` (not the stop button) | `[data-testid="model-switcher-dropdown-button"]`, else the title bar's menu button |
| gemini.google.com | `rich-textarea .ql-editor` | `button.send-button:not(.stop)` | `[data-test-id="bard-mode-menu-button"]` |
| grok.com, chat.deepseek.com, perplexity.ai, chat.mistral.ai, copilot.microsoft.com, chat.qwen.ai, meta.ai | any `textarea` / contenteditable | `button[type=submit]` or a button labelled "send" | none (×1) |

### Multiplier tables (`RATES` in `src/config.js`)

| Site | Model × | Effort × |
|---|---|---|
| Claude | Haiku 1, Sonnet 1.5, Opus 2, Fable 2.5 | low 1, medium 1.25, high / extended 1.5, xhigh 1.75, max 2 |
| ChatGPT | mini / Instant 1, Auto / GPT-4 1.25, GPT-5 1.5, Thinking / o3 1.75, Pro 2.5 | light 1, standard 1.25, extended 1.5, heavy 2 |
| Gemini | Flash / Fast / Flash-Lite 1, Thinking 1.5, Pro 2, Ultra / Deep Think 2.5 | – |

Matching is a plain substring check on the lowercased label, and the first hit wins, so key order matters (`xhigh` before `high`, `deep think` before `pro`).

## Draining

Five ways, all in the bottom-left dock: tilt by dragging or with the webcam (1), Joy-Con (2), blow (3), drink (4).

### 1. Tilt the screen

Water stays level with the ground, so tilting the screen makes the surface slope. Past **~16°** it pours off the low edge (capped at 12% of the screen per 0.9 s), and floating junk goes with it. Tilt comes from any of these (they add up, clamped to ±45°):

- **📷 TILT CAM (webcam)**: in the bottom-left dock (click again to stop). Grant camera access, keep the laptop level for a moment (that's the reference), then tilt it sideways. Each frame (~10/s) is shrunk to 160×120 grayscale. Strong Sobel edges vote into a 36-bin × 5° orientation histogram. Bins 90° apart are folded together, because rooms are full of horizontal *and* vertical lines. The strongest orientation is refined with a weighted circular mean and compared with the reference. The result is smoothed (70% old / 30% new) and clamped to ±28°. Frames below 12% confidence are skipped. **Calibrate level** resets the reference; **Stop camera** stops the stream. The panel shows the preview, the estimated angle and a 🪣 that leans with it.
  - It's a visual estimate, not a measurement. Point the webcam at something with straight lines (door frame, window, shelf), not a blank wall.
  - Frames are analysed locally in the page and never stored or sent. The camera permission is per site, because the content script runs in the page.
- **Motion sensor**: on devices that have one (tablets, 2-in-1s, Chromebooks), `devicemotion` gravity is used directly.
- **Drag**: drag the 🫗 grip in the dock left/right (half the screen width ≈ 45°). At 100% you can drag anywhere. Let go and the screen swings back upright.

Only the focused tab sends its tilt to the shared simulation, and it drops back to 0 when the tab loses focus. A pour happens once, in the shared simulation, which writes the new level.

### 2. Scoop with a Joy-Con

Click **🎮 JOY-CON** in the dock, or the toolbar icon → **🎮 Scoop with a Joy-Con**. That opens the scooper window (`src/joycon/joycon.html`). Keep it open: it holds the WebHID connection.

1. Pair the Joy-Con in your OS Bluetooth settings, then press **Connect** (Chrome/Edge desktop only; L, R and Pro Controller work, and two at once is fine).
2. **Dip**: point the top (shoulder-button end) down past 35°. The bucket fills, faster in deep water. You feel it glug: low rumble with random glugs and bubble ticks.
3. **Scoop**: flip it up past 30°. A full bucket takes 6% of the screen from every tab, and you feel a splash followed by droplets. The shared simulation picks a random spot, every visible page shows a 🪣 dipping in there, and the water comes out around it, leaving a dent that refills as waves.
4. Too slow (over 1.5 s between leaving the water and flipping up) and the water spills back, with a spill rumble.

When idle, moving the controller makes a sloshing rumble that scales with the water level. With no water left, dipping just gives a dry scrape. Settings: rumble strength, **Flip tip direction** (if dip/flip feel reversed), **Test rumble**.

### 3. Blow it away (microphone)

Click **🌬️ BLOW** in the dock and allow the microphone. Stay quiet for the first second while it measures the room's noise floor, then blow into the mic.

- ~10 times a second the RMS loudness (dBFS) is compared with the noise floor. **12 dB** above it counts as blowing, and strength climbs from 0 to 1 over the next **30 dB** (the start is never below −50 dBFS, so a dead-silent room doesn't make it twitchy).
- **The louder, the more it drains:** `BLOW_RATE × strength²`, up to 6% of the screen per second at full blast.
- The shared simulation pushes a dent into the water in the middle of the screen, so the water sloshes away from it, and every tab drains. The page shows 💨 gusts and spray; the panel shows a strength meter.
- Echo cancellation, noise suppression and auto gain are turned off, since they'd filter the blowing out. Shouting works too. It's a loudness meter, not a blow detector.
- The noise floor follows a quieter room quickly and a louder one very slowly, so a long blow can't raise it.

### 4. Drink it (webcam)

Click **👄 DRINK** in the dock and allow the camera. Keep your mouth closed for the first second (that's the reference), then hold it open.

- ~10 frames a second are shrunk to 160×120 grayscale. If the browser has the Shape Detection `FaceDetector` (macOS / ChromeOS / Android, sometimes behind a flag) it finds your face and mouth; otherwise put your face in the dashed guide box in the preview.
- An open mouth is a dark hole: it counts the share of pixels in the mouth box that are darker than 45% of the skin brightness on your cheeks. **8%** more than with the mouth closed starts drinking; openness reaches 1 over the next **25%**.
- Drinks `DRINK_RATE × openness`, up to 4% of the screen per second. The water is sucked out at a 👄 in the middle of the screen, with a gulp sound. The mouth box in the preview turns red while drinking. **Recalibrate** relearns the closed mouth.
- A rough visual guess: it needs your face lit from the front; a dark beard or shadow under the lips can count as "open" (recalibrate). Frames are analysed locally and never stored or sent.

The popup also has a small **cheat: drain everything** link for testing.

## Files

```
manifest.json            MV3 manifest; lists the content scripts in load order
src/
  config.js              tuning knobs (all constants and per-site rate tables)
  core.js                shared water state, storage sync, canvas, frame loop, flood(), drain(), hooks
  sim.js                 shallow-water height field: waves, tilt, pouring; surfaceAt(), splash(), simRemove()…
                         (stepped only in offscreen/; tabs read it through surfaceAt() etc.)
  drains/
    camera.js            webcam tilt estimate (edge orientation histogram)
    tilt.js              combines camera + motion sensor + drag; the focused tab sends it to the shared sim
    blow.js              microphone loudness → blowing strength → drainAt('blow')
    drink.js             webcam mouth-open detection (FaceDetector or guide box) → drainAt('drink')
  effects/
    waves.js             draws the water + page blur
    drops.js             spray droplets, bubbles, the pour off a tilted edge
    scoop.js             draws the 🪣 for each Joy-Con scoop (the shared sim takes the water)
    mouth.js             draws 💨 + spray while blowing and 👄 + bubbles while drinking
    mouse.js             a stream of 🐭 runs across the screen when high water starts pouring
    percent.js           "💧 NN%" label
    lockout.js           100% click block + LOCK_MESSAGE
    dock.js              bottom-left dock with all 5 drains: 🫗 grip, 📷, 🎮, 🌬️, 👄 + their panels (shadow DOM)
    muffle.js            lowpass audio muffling
  chat.js                chatSite(): shared prompt detection + speed badge
  systems/
    claude.js, chatgpt.js, gemini.js, others.js   one chatSite() call per site
  background.js          service worker: level badge, opens the Joy-Con window; creates the offscreen sim and relays chrome.storage to it
  offscreen/             the one shared simulation (offscreen document): steps sim.js, streams it to tabs
  popup/                 toolbar popup: level, open the Joy-Con scooper, cheat drain
  joycon/                Joy-Con scooper window: WebHID, scoop gesture, HD-rumble haptics
```

### How the modules fit together

- All content scripts are plain (non-module) scripts listed in `manifest.json` → `content_scripts.js`. They run **in that order** and **share one global scope**. Keep top-level names unique across files; a duplicate `const` breaks the second file.
- Load order: `config.js` → `core.js` → `sim.js` → drains → effects → `chat.js` → systems.
- **An effect** registers a per-frame function: `effects.push((f) => { ... })`, where `f = { ctx, t, dt, d, w, h }` (`d` = devicePixelRatio, `w`/`h` canvas size in device px). Effects run in manifest order; later effects draw on top. Read the water through `water.level` (0–1), `surfaceAt(x)`, `depthAt(x)`, `slopeAt(x)` (CSS px), `sim.tilt`, `sim.pour`. These mirror the shared simulation and are read-only in a tab: `simRemove()` / `splash()` there would be overwritten by the next update.
- **A system** decides when the water rises. It calls `flood(chars, multiplier)`, and core writes the new level to `chrome.storage`, which updates every tab. For a chat site, add `src/systems/<site>.js` with one `chatSite({ rates, composer, send, model })` call.
- **A drain** lowers it: set `target` (and `scoop`) in `chrome.storage.local`, or from a page call `drainAt(kind, x, amount, power)` (core.js) to take water out around `x` in the shared sim, which writes the new level. Pouring is done inside `src/offscreen/sim.js`.
- **Shared simulation** (`src/offscreen/sim.js`): tabs connect a `chrome.runtime` port named `sim` while visible. A tab sends `{ tilt }` (radians) and `{ take: { kind, x, amount, power } }` while blowing or drinking; the sim sends `{ h, tilt, pour, level }` every 16 ms and `{ bucket: { x, amount } }` when a scoop starts. Offscreen documents can only use `chrome.runtime`, so `background.js` forwards storage changes to the sim (`{ type: 'storage' }`) and writes its pours back (`{ type: 'setTarget' }`).
- Hooks: `waterHooks.rise.push(fn(amount))` when the level goes up, `waterHooks.scoop.push(fn({ x, amount }))` when a Joy-Con scoop starts (`x` = 0–1 across the screen).
- To add a feature, create the file and add it to the manifest list. To disable one, remove it from the list.
- Check for name clashes before committing. This bundles the scripts in manifest order and parse-checks them:
  `python3 -c "import json;print('\n'.join(open(f).read() for f in json.load(open('manifest.json'))['content_scripts'][0]['js']))" > /tmp/b.js && node --check /tmp/b.js`

### Tuning knobs (`src/config.js`)

- `WATER_PER_CHAR`: water per prompt character at ×1 (default `0.0006`, so 200 characters = 12%).
- `RISE_SPEED`: base rise speed at ×1 (default `0.03`/sec). `DRAIN_SPEED`: how fast other tabs follow a drop.
- `GRAVITY`, `WAVE_DAMP`, `VISCOSITY`, `COL`: how the water moves (faster sloshing, calmer, smoother, resolution).
- `TILT_LIP` (16°), `MAX_TILT` (45°), `SPILL_RATE`, `MAX_POUR`: pouring.
- `CAM_MAX_ANGLE`, `CAM_MIN_CONFIDENCE`: webcam tilt.
- `BLOW_RATE`, `BLOW_START_DB`, `BLOW_RANGE_DB`: blowing.
- `DRINK_RATE`, `DRINK_OPEN`, `DRINK_RANGE`: drinking.
- `MOUSE_SHOW_AT`: minimum water level for the running mouse to appear while pouring (default `0.6`).
- `MUFFLE_FROM` / `MUFFLE_TO`: audio muffle range (default `0.6` / `0.7`).
- `LOCK_MESSAGE`: text shown at 100%.
- Joy-Con: `SCOOP_MAX`, `DIP_DEG`, `LIFT_DEG`, `LIFT_TIMEOUT` at the top of `src/joycon/joycon.js`.

## Known limits / TODO

- **Chat site selectors may break.** All three apps ship UI changes often. ChatGPT's model switcher selector isn't confirmed (the badge falls back to ×1 if it's not found). The "other sites" list uses generic guesses and hasn't been checked against the live sites.
- **Effort detection is a guess.** It only works if the effort appears in the model selector's label text.
- **Attachment-only prompts** sent with Enter (no text) aren't counted.
- **Webcam tilt is an estimate.** It drifts with blank walls, moving backgrounds or strongly diagonal scenes; recalibrate or drag instead. Some sites block the camera with a Permissions-Policy, and then only drag/sensor tilt works there.
- **Joy-Con**: WebHID only (Chrome/Edge desktop). The scooper window must stay open. The dip/flip axis follows the Joy-Con tester's frame (x = toward the shoulder buttons). If it feels reversed on your controller, tick **Flip tip direction**. Uses default IMU scaling, not the factory calibration from SPI.
- **Audio muffling misses some sound:** cross-origin media without CORS (skipped on purpose; it would go silent), anything before the first user interaction (autoplay policy), the page's own Web Audio, shadow-DOM media, and iframes (the script runs in the top frame only).
- **Blowing is a loudness meter.** Talking loudly or music near the mic drains too. The mic permission is per site, like the camera.
- **Drinking is a darkness guess.** It needs your face lit from the front and, without `FaceDetector`, lined up with the guide box. Tilt cam and drink each open their own camera stream.
- **Lockout only blocks the mouse.** Keyboard and mouse-wheel scrolling still work at 100%.
- **Shared sim tank is 1600×900.** Tabs stretch it to their own size, so in a window with a very different shape the waves look squashed. The surface can stutter slightly, because tabs draw the latest update without interpolating.
- **Testing:** verified in Chromium with Playwright against mock pages that use each site's selectors, a synthetic webcam video (a scene rotated 20° → estimated +18.5°), a fake WebHID Joy-Con, a fake mic (quiet, then loud noise: strength ~0.9, drained ~4.5%/s) and a fake webcam face (mouth closed, then open: drained ~4%/s), clicking every dock button. Not yet tested on the live chat sites or with a real Joy-Con.
