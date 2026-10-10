# shitx-flood

A joke Chrome extension (Manifest V3). Every prompt you send on claude.ai makes 2D water rise on **every website you have open**. Better models flood faster. Past 60% the page audio gets muffled. At 100% you can't click anything until you drain the water.

## Install (dev)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this folder.
3. After editing any file, click the reload ↻ icon on the extension card, then refresh open tabs.

## How it works

| Feature | What happens |
|---|---|
| Prompt detection | On claude.ai, pressing Enter in the composer (`[data-testid="chat-input"]`) when it has text, or clicking `[data-testid="chat-input-send"]`, adds **12%** to the water level. |
| Speed multiplier | A `💧 ×N` badge is placed right after the model selector (`[data-testid="model-selector-dropdown"]`). N = model × effort, read from the selector's label text. Rise speed = `0.03` viewport heights/sec × N. |
| Shared level | The level is stored in `chrome.storage.local` (`target`, `speed`). Every tab listens to `chrome.storage.onChanged`, so all sites flood together. A newly loaded page starts at the current level without rising again. |
| Water overlay | A full-screen overlay draws two semi-transparent sine-wave layers, progressively blurs the page behind the water (stronger with water level and depth), and shows a `💧 NN%` label under the surface. |
| Muffled audio | From **60% to 70%**, page `<audio>`/`<video>` is routed through a Web Audio lowpass filter whose cutoff falls from 20 kHz to 300 Hz. It stays at 300 Hz above 70%. |
| 100% lockout | The canvas switches to `pointer-events:auto`, which blocks all clicks, and shows **"กรุณาเทน้ำออกจากจอ"** ("please pour the water out of the screen"). |
| Drain | Clicking the extension's toolbar icon sets the level to 0 on every tab. |

### Multiplier table

| Model | × | Effort | × |
|---|---|---|---|
| Haiku | 1 | low | 1 |
| Sonnet | 1.5 | medium | 1.25 |
| Opus | 2 | high / extended | 1.5 |
| Fable | 2.5 | xhigh | 1.75 |
| | | max | 2 |

The tables are `MODELS` and `EFFORTS` in `src/config.js`. Key order matters: `xhigh` must come before `high`, because matching is a plain substring check.

## Files

```
manifest.json            MV3 manifest; lists the content scripts in load order
src/
  config.js              tuning knobs (all constants)
  core.js                shared water state, storage sync, canvas, frame loop, flood(), outlinedText()
  background.js          service worker: toolbar icon click drains the water
  effects/
    waves.js             the two wave layers
    percent.js           "💧 NN%" label
    lockout.js           100% click block + LOCK_MESSAGE
    muffle.js            lowpass audio muffling
  systems/
    claude.js            claude.ai: speed badge + prompt-send detection → flood()
```

### How the modules fit together

- All content scripts are plain (non-module) scripts listed in `manifest.json` → `content_scripts.js`. They run **in that order** and **share one global scope**. Keep top-level names unique across files; a duplicate `const` breaks the second file.
- Load order: `config.js` → `core.js` → effects → systems.
- **An effect** registers a per-frame function: `effects.push((f) => { ... })`, where `f = { ctx, t, d, w, h, top }`. It reads `water.level` (0–1). Effects run in manifest order, so later ones draw on top.
- **A system** decides when the water rises. It calls `flood(multiplier)`, and core writes the new level to `chrome.storage`, which updates every tab.
- To add a feature, create the file under `src/effects/` or `src/systems/` and add it to the manifest list. To disable one, remove it from the list.
- Check for name clashes before committing. This bundles the scripts in manifest order and parse-checks them:
  `python3 -c "import json;print('\n'.join(open(f).read() for f in json.load(open('manifest.json'))['content_scripts'][0]['js']))" > /tmp/b.js && node --check /tmp/b.js`

### Tuning knobs (`src/config.js`)

- `STEP`: how much each prompt adds (default `0.12`).
- `RISE_SPEED`: base rise speed at ×1 (default `0.03`/sec).
- `MUFFLE_FROM` / `MUFFLE_TO`: audio muffle range (default `0.6` / `0.7`).
- `LOCK_MESSAGE`: text shown at 100%.

## Known limits / TODO

- **Effort detection is a guess.** It only works if claude.ai shows the effort in the model selector button's text. If it lives elsewhere, the effort part stays ×1. Inspect the real DOM and update `multiplier()`.
- **claude.ai selectors may break.** claude.ai ships UI changes often. All selectors are `data-testid` (the most stable option), but re-check them if detection stops working.
- **Attachment-only prompts** sent with Enter (no text) aren't counted.
- **Audio muffling misses some sound:**
  - Cross-origin media without CORS is skipped on purpose. Routing it through Web Audio would make it silent.
  - Muffling only starts after the user has interacted with the page, because the browser's autoplay policy blocks it before that.
  - Not covered: audio made with the page's own Web Audio (e.g. games), media inside shadow DOM, media in iframes (the script runs in the top frame only).
- **Lockout only blocks the mouse.** Keyboard and mouse-wheel scrolling still work at 100%.
- **Not tested end-to-end yet** on live claude.ai. Only syntax-checked.
