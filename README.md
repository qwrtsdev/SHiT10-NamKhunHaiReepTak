# shitx-flood

A joke Chrome extension (Manifest V3). Every prompt you send to an AI chat (claude.ai, ChatGPT, Gemini, and a few others) makes water rise on **every website you have open**. Better models flood faster. From 45% the page audio gets muffled and quieter until it's silent at 100%. At 80% the chat box on supported chat sites stops taking clicks and typing. When water above 60% starts pouring, a mouse runs across the screen. At 100% you can't click anything until you get the water out. There are two ways to do that, both in the extension's toolbar popup: **📷 tilt the laptop** so it pours off the edge (the webcam notices), or **🎮 scoop it out with a Nintendo Joy-Con**, which rumbles like a bucket of water.

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
| Muffled audio | From **45% to 100%**, page `<audio>`/`<video>` goes through a Web Audio lowpass filter (cutoff 20 kHz → 300 Hz) and a volume fade (1 − k², silent at 100%). |
| Chat box lock | From **80%**, the composer on supported chat sites is greyed out and refuses clicks, focus, typing, paste and drop. It unlocks when the water drops below 80%. |
| 100% lockout | The overlay swallows all clicks and shows **"กรุณาเทน้ำออกจากจอ"** ("please pour the water out of the screen"). Dragging on the page does nothing. The toolbar popup still works, since it's browser UI. |
| Drain controls | In the toolbar popup: **📷 Tilt cam** (start/stop on the current tab, with a live preview, status and **Calibrate level**) and **🎮 Scoop with a Joy-Con**. |

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

Two ways, both in the toolbar popup: tilt with the webcam (1) or a Joy-Con (2).

### 1. Tilt the screen

Water stays level with the ground, so tilting the screen makes the surface slope. Past **~16°** it pours off the low edge (capped at 12% of the screen per 0.9 s), and floating junk goes with it. Tilt comes from any of these (they add up, clamped to ±45°):

- **📷 Tilt cam (webcam)**: toolbar popup → **📷 Tilt cam** (click again to stop). It runs in the current tab's page (the popup closes when it loses focus, and the camera permission is per site); the popup sends it start/stop/calibrate messages and shows its status while open. Grant camera access, keep the laptop level for a moment (that's the reference), then tilt it sideways. Each frame (~10/s) is shrunk to 160×120 grayscale. Strong Sobel edges vote into a 36-bin × 5° orientation histogram. Bins 90° apart are folded together, because rooms are full of horizontal *and* vertical lines. The strongest orientation is refined with a weighted circular mean and compared with the reference. The result is smoothed (70% old / 30% new) and clamped to ±28°. Frames below 12% confidence are skipped. **Calibrate level** resets the reference. While open, the popup shows the last analysed frame and the estimated angle.
  - It's a visual estimate, not a measurement. Point the webcam at something with straight lines (door frame, window, shelf), not a blank wall.
  - Frames are analysed locally in the page and never stored or sent. The camera permission is per site, because the content script runs in the page.
- **Motion sensor**: on devices that have one (tablets, 2-in-1s, Chromebooks), `devicemotion` gravity is used directly.

Only the focused tab sends its tilt to the shared simulation, and it drops back to 0 when the tab loses focus. A pour happens once, in the shared simulation, which writes the new level.

### 2. Scoop with a Joy-Con

Click the toolbar icon → **🎮 Scoop with a Joy-Con**. That opens the scooper window (`src/joycon/joycon.html`). Keep it open: it holds the WebHID connection.

1. Pair the Joy-Con in your OS Bluetooth settings, then press **Connect** (Chrome/Edge desktop only; L, R and Pro Controller work, and two at once is fine).
2. **Dip**: point the top (shoulder-button end) down past 35°. The bucket fills, faster in deep water. You feel it glug: low rumble with random glugs and bubble ticks.
3. **Scoop**: flip it up past 30°. A full bucket takes 6% of the screen from every tab, and you feel a splash followed by droplets. The shared simulation picks a random spot, every visible page shows a 🪣 dipping in there, and the water comes out around it, leaving a dent that refills as waves.
4. Too slow (over 1.5 s between leaving the water and flipping up) and the water spills back, with a spill rumble.

When idle, moving the controller makes a sloshing rumble that scales with the water level. With no water left, dipping just gives a dry scrape. Settings: rumble strength, **Flip tip direction** (if dip/flip feel reversed), **Test rumble**.

## Files

```
manifest.json            MV3 manifest; lists the content scripts in load order
src/
  config.js              tuning knobs (all constants and per-site rate tables)
  core.js                shared water state, storage sync, canvas, frame loop, flood(), drain(), hooks
  sim.js                 shallow-water height field: waves, tilt, pouring; surfaceAt(), splash(), simRemove()…
                         (stepped only in offscreen/; tabs read it through surfaceAt() etc.)
  drains/
    camera.js            webcam tilt estimate (edge orientation histogram); controlled from the popup
    tilt.js              combines camera + motion sensor; the focused tab sends it to the shared sim
  effects/
    waves.js             draws the water + page blur
    drops.js             spray droplets, bubbles, the pour off a tilted edge
    scoop.js             draws the 🪣 for each Joy-Con scoop (the shared sim takes the water)
    mouse.js             a stream of 🐭 runs across the screen when high water starts pouring
    percent.js           "💧 NN%" label
    lockout.js           100% click block + LOCK_MESSAGE
    muffle.js            lowpass audio muffling
  chat.js                chatSite(): shared prompt detection + speed badge
  systems/
    claude.js, chatgpt.js, gemini.js, others.js   one chatSite() call per site
  background.js          service worker: level badge, opens the Joy-Con window; creates the offscreen sim and relays chrome.storage to it
  offscreen/             the one shared simulation (offscreen document): steps sim.js, streams it to tabs
  popup/                 toolbar popup: level, 📷 tilt cam controls, open the Joy-Con scooper, cheat drain
  joycon/                Joy-Con scooper window: WebHID, scoop gesture, HD-rumble haptics
```

### How the modules fit together

- All content scripts are plain (non-module) scripts listed in `manifest.json` → `content_scripts.js`. They run **in that order** and **share one global scope**. Keep top-level names unique across files; a duplicate `const` breaks the second file.
- Load order: `config.js` → `core.js` → `sim.js` → drains → effects → `chat.js` → systems.
- **An effect** registers a per-frame function: `effects.push((f) => { ... })`, where `f = { ctx, t, dt, d, w, h }` (`d` = devicePixelRatio, `w`/`h` canvas size in device px). Effects run in manifest order; later effects draw on top. Read the water through `water.level` (0–1), `surfaceAt(x)`, `depthAt(x)`, `slopeAt(x)` (CSS px), `sim.tilt`, `sim.pour`. These mirror the shared simulation and are read-only in a tab: `simRemove()` / `splash()` there would be overwritten by the next update.
- **A system** decides when the water rises. It calls `flood(chars, multiplier)`, and core writes the new level to `chrome.storage`, which updates every tab. For a chat site, add `src/systems/<site>.js` with one `chatSite({ rates, composer, send, model })` call.
- **A drain** lowers it: set `target` (and `scoop`) in `chrome.storage.local`. Pouring is done inside `src/offscreen/sim.js`.
- **Shared simulation** (`src/offscreen/sim.js`): tabs connect a `chrome.runtime` port named `sim` while visible. A tab sends `{ tilt }` (radians); the sim sends `{ h, tilt, pour, level }` every 16 ms and `{ bucket: { x, amount } }` when a scoop starts. Offscreen documents can only use `chrome.runtime`, so `background.js` forwards storage changes to the sim (`{ type: 'storage' }`) and writes its pours back (`{ type: 'setTarget' }`).
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
- `MOUSE_SHOW_AT`: minimum water level for the running mouse to appear while pouring (default `0.6`).
- `MUFFLE_FROM` / `MUFFLE_TO`: audio muffle range (default `0.45` / `1`: lowpass 20 kHz → 300 Hz and volume fading to silent).
- `INPUT_LOCK_AT`: level where chat composers are locked (default `0.8`).
- `LOCK_MESSAGE`: text shown at 100%.
- Joy-Con: `SCOOP_MAX`, `DIP_DEG`, `LIFT_DEG`, `LIFT_TIMEOUT` at the top of `src/joycon/joycon.js`.

## Known limits / TODO

- **Chat site selectors may break.** All three apps ship UI changes often. ChatGPT's model switcher selector isn't confirmed (the badge falls back to ×1 if it's not found). The "other sites" list uses generic guesses and hasn't been checked against the live sites.
- **Effort detection is a guess.** It only works if the effort appears in the model selector's label text.
- **Attachment-only prompts** sent with Enter (no text) aren't counted.
- **Webcam tilt is an estimate.** It drifts with blank walls, moving backgrounds or strongly diagonal scenes; recalibrate, or use another drain. Some sites block the camera with a Permissions-Policy, and then only the motion sensor tilts there.
- **Joy-Con**: WebHID only (Chrome/Edge desktop). The scooper window must stay open. The dip/flip axis follows the Joy-Con tester's frame (x = toward the shoulder buttons). If it feels reversed on your controller, tick **Flip tip direction**. Uses default IMU scaling, not the factory calibration from SPI.
- **Audio muffling misses some sound:** cross-origin media without CORS (skipped on purpose; it would go silent), anything before the first user interaction (autoplay policy), the page's own Web Audio, shadow-DOM media, and iframes (the script runs in the top frame only).
- **Lockout only blocks the mouse.** Keyboard and mouse-wheel scrolling still work at 100%.
- **Shared sim tank is 1600×900.** Tabs stretch it to their own size, so in a window with a very different shape the waves look squashed. The surface can stutter slightly, because tabs draw the latest update without interpolating.
- **Testing:** verified in Chromium with Playwright against mock pages that use each site's selectors, a synthetic webcam video (a scene rotated 20° → estimated +18.5°), a fake WebHID Joy-Con. Not yet tested on the live chat sites or with a real Joy-Con.
