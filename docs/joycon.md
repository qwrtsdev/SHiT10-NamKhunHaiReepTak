# Joy-Con draining: how it works

The Joy-Con is one of two ways to get water off the screen (the other is the tilt cam). You point the controller down to fill a bucket, flip it up to scoop, and the shared water level drops in every tab. HD rumble makes it feel like hauling water.

This document covers the whole path: pairing, the connection, the HID protocol, the gesture, the haptics, and how a scoop becomes less water on screen.

## Files involved

| File | Role |
|------|------|
| `src/joycon/joycon.js` | The driver. `class JoyCon`: WebHID I/O, subcommands, IMU parsing, gyro bias, scoop state machine, HD-rumble encoder and haptic mixer. Also the constants `SCOOP_MIN`, `SCOOP_MAX`, `DIP_DEG`, `LIFT_DEG`, `LIFT_TIMEOUT`, `ACC`, `GYR`, `NAMES`. No DOM. |
| `src/offscreen/joycon.js` | The host. Owns `joyconSettings`, the `pads` map, `waterLevel()` and `scoopWater()`. Opens devices, listens for connect/disconnect, answers the popup's `joycon` messages. |
| `src/offscreen/sim.html` | Offscreen document. Loads `config.js`, `sim.js`, `offscreen/sim.js`, then `joycon/joycon.js`, then `offscreen/joycon.js`. All are classic scripts, so they share one global scope (the host reads `target` from `offscreen/sim.js` directly). |
| `src/offscreen/sim.js` | The shared water simulation. Receives the scoop through storage and takes the water out of the height field around a random spot. |
| `src/background.js` | Service worker. Creates the offscreen document, relays `chrome.storage` to it (offscreen documents only get `chrome.runtime`), and writes the scoop to storage for it. |
| `src/popup/popup.html`, `popup.js` | Toolbar popup. Drain picker (**ตักน้ำออก**), the pair button, live controller status, rumble strength and direction settings. |
| `src/core.js` | Content script. Forwards `{ bucket }` from the sim port to `waterHooks.scoop`. |
| `src/effects/scoop.js` | Content script. Draws the 🪣 dipping into the water and lifting away. |

## Requirements

- **WebHID**: Chrome, Edge or Brave on desktop. If `navigator.hid` is missing, the popup disables the pair button and says the browser can't use Joy-Cons.
- **Supported devices** (Nintendo vendor ID `0x057e`):

  | Product ID | Name |
  |-----------|------|
  | `0x2006` | Joy-Con (L) |
  | `0x2007` | Joy-Con (R) |
  | `0x2009` | Pro Controller |

  Any other HID device the host sees is ignored (`addDevice` checks `NAMES`).
- **Bluetooth first**: the controller must already be paired and connected in the OS Bluetooth settings. The browser chooser only lists devices that are connected right now. A Joy-Con that went to sleep drops off Bluetooth, and the PC can't wake it: press any button until the lights stop blinking.
- **Linux**: your user needs read/write access to `/dev/hidraw*` (for example install `steam-devices`). Without it, opening fails, and the error text says so.

## Lifecycle

### 1. The offscreen document

`background.js` calls `ensureSim()` at startup and whenever a tab or the popup sends `{ type: 'ensureSim' }`. It creates `src/offscreen/sim.html` (reason `WORKERS`) if no offscreen document exists. That document lives as long as the browser runs, so the controller keeps working after the popup closes.

When `offscreen/joycon.js` loads, it:

1. Registers `navigator.hid` `connect` / `disconnect` listeners.
2. Calls `refreshDevices()`: `navigator.hid.getDevices()` returns every device the extension was granted before, and each one goes through `addDevice()`. A controller you paired once reconnects by itself after a browser restart.
3. Asks `background.js` for `simInit` and sets `joyconSettings.enabled = drainMode === 'joycon'`.

### 2. Choosing the Joy-Con as the drain

The popup has two mode buttons. Only one drain is active at a time:

- Clicking **ตักน้ำออก** stores `drainMode: 'joycon'` in `chrome.storage.local` and stops the tilt cam in every tab.
- Clicking it again stores `drainMode: null`.
- Choosing **เทน้ำออก** (tilt cam) stores `drainMode: 'cam'`.

`background.js` sees the storage change and sends `{ type: 'storage', drainMode }` to the offscreen document, which updates `joyconSettings.enabled`.

When `enabled` is false, the controller **stays connected** but ignores motion: every input report resets the state to `ready`, clears the fill and pending haptics, sends one neutral rumble, then stays silent.

### 3. Pairing (the popup)

`navigator.hid.requestDevice()` needs a user click, so pairing has to happen in the popup, not in the offscreen document:

1. Click **🎮 เชื่อมต่อจอยคอน**.
2. `requestDevice({ filters })` opens the chooser. The filter lists vendor `0x057e` with the three product IDs.
3. The popup shows a message based on the result:
   - No device picked, or `NotFoundError`: "ไม่เจอจอยคอน? ต้องเชื่อมบลูทูธไว้ก่อน…" (connect Bluetooth first, press a button until the lights stop blinking).
   - Device picked: "กำลังเชื่อมต่อ…" (connecting), then the popup sends `{ type: 'joycon', act: 'refresh' }`.
4. The grant belongs to the extension origin, so the offscreen document's `getDevices()` now returns the device, and `addDevice()` opens it.

You only pair once. Later sessions reconnect through `getDevices()` and the `connect` event.

### 4. Opening a controller (`addDevice` → `JoyCon.init`)

`addDevice(device)` skips devices already in `pads` and unknown product IDs, creates a `JoyCon`, stores it, and calls `init(index)` with `index = pads.size - 1`.

`init(index)`:

1. `device.open()` if it isn't open yet, then listens for `inputreport`.
2. Sends four subcommands, each waiting for its reply:

   | Subcommand | Args | Meaning |
   |-----------|------|---------|
   | `0x40` | `0x01` | Enable IMU (accelerometer + gyro) |
   | `0x48` | `0x01` | Enable vibration |
   | `0x03` | `0x30` | Input report mode: standard full report with IMU, about 60 Hz |
   | `0x30` | `1 << (index % 4)` | Player light: first controller light 1, second light 2, and so on |

3. If **none** of the four got a reply, it sets `error`: "Opened, but the Joy-Con never answered. Re-pair it (hold the sync button), then pair again."
4. Plays a hello buzz (low band, 160 Hz, 0.6, 120 ms).

If `open()` throws, the host sets `error = "Could not open: <message>"`, plus the hidraw hint on Linux.

### 5. Disconnects

The `navigator.hid` `disconnect` event calls `removeDevice()`: it removes the report listener, closes the device and deletes it from `pads`. When the controller comes back, the `connect` event opens it again through `addDevice()`.

### 6. Several controllers

Each device gets its own `JoyCon` with its own state machine and player light, so two controllers can scoop at the same time. They all lower the same shared level.

## HID protocol

Offsets below are WebHID `DataView` indices, which **exclude** the report ID byte. The layouts follow the Joy-Con tester guide.

### Output reports

| Report | Layout | Use |
|--------|--------|-----|
| `0x01` | `[counter, rumble ×8, subcommand, args…]` | Subcommand plus rumble |
| `0x10` | `[counter, rumble ×8]` | Rumble only |

- `counter` is a 4-bit packet counter (`this.counter++ & 0x0f`), shared by both report types.
- The 8 rumble bytes are left motor (4 bytes) then right motor (4 bytes). Subcommands send neutral rumble (`00 01 40 40`) on both. Rumble reports send the same 4 bytes to both motors.
- Reports go out unpadded, like the tester that works on this hardware.
- The first write error is kept in `jc.error` (`Write failed: …`) for the popup.

### Subcommand exchange (`subcmd`)

- Exchanges are serialized through a promise queue: never two at once.
- Each attempt registers a waiter `{ id, resolve }`, sends report `0x01`, and waits up to **300 ms** for a reply.
- Up to **3 attempts**. Returns `true` on a reply, `false` if all three time out.
- A reply is input report `0x21` whose byte 13 equals the subcommand ID.

### Input reports

`onReport` handles:

- `0x21`: subcommand replies (above).
- `0x30` / `0x31`: full reports. Anything shorter than 48 bytes is ignored.

From a full report it reads:

- **Battery**: `(byte 1 >> 5) & 7` mapped to `empty`, `critical`, `low`, `medium`, `full`. Stored in `jc.battery`, but not shown in the popup yet.
- **IMU**: three frames of 12 bytes starting at byte 12 (frames at 12, 24, 36). Each frame is six `int16` little-endian values: accel x, y, z, then gyro x, y, z.
  - Scaling uses the default calibration, not the factory values from SPI flash: `ACC = 4 / 16384` (raw to G), `GYR = 936 / 13371` (raw to °/s).
  - **Right Joy-Con** (`0x2007`): y and z are negated for both sensors, so it uses the same frame as the left one. The Pro Controller is treated like the left Joy-Con.

## Motion processing

Per IMU frame (three per report, so about 180 per second):

1. **Gravity** `grav`: low-pass filter on the accelerometer, `grav += (a - grav) * 0.15`. It starts at `[0, 0, 1]`.
2. **Gyro bias** (`calibrate`): collects 160 gyro samples (about 0.9 s). If every sample is within ±10 °/s of the average on every axis, the controller was still, so the average becomes `bias` and calibration stops. Otherwise it throws the samples away and starts over. Until then the bias is `[0, 0, 0]`.
3. **Motion** `motion`: magnitude of the bias-corrected gyro, in °/s. Used only for the sloshing rumble.

Per report:

4. **Pitch** of the long (x) axis, toward the shoulder buttons: `asin(grav.x / |grav|)` in degrees. Positive means the top end points up. **สลับทิศการตัก** (`invert`) flips the sign.
5. `dt` = time since the last report in seconds, capped at 0.1 (0.015 for the first report).
6. If `enabled`, run the gesture. Then always run the rumble.

## The scoop gesture

A state machine: `ready → fill → lift → cool → ready`.

| State | What happens | Leaves when |
|-------|-------------|-------------|
| `ready` | Idle. | Pitch < **-35°** (`DIP_DEG`): go to `fill` with `fill = 0`. |
| `fill` | The bucket is in the water. If the level is above 0, `fill += dt × 1.4 × clamp(level / 0.15, 0.25, 1)`, capped at 1. It takes about 0.7 s to fill when the water is at 15% or more, and about 2.9 s when the level is very low. | Pitch > -10°: if `fill > 0.1` go to `lift` (start the timer), else back to `ready`. |
| `lift` | Carrying the bucket. | Pitch > **30°** (`LIFT_DEG`): **scoop** (below), go to `cool`. Pitch < -35° again: back to `fill`, keeping the water. More than **1500 ms** (`LIFT_TIMEOUT`) in `lift`: the water spills back (spill rumble), `fill = 0`, back to `ready`. |
| `cool` | Short debounce. | After 400 ms: `ready`. |

`level` here is `waterLevel()`, which returns `target` from `offscreen/sim.js`: the shared stored level, not the volume currently drawn on screen.

**A scoop**: `scoopWater(random between SCOOP_MIN and SCOOP_MAX)`, a random 5–10% of the screen. How full the bucket was doesn't change the amount; `fill` only has to pass 0.1 for the scoop to count, and it sets the rumble. If water came out, `scoops` goes up (not displayed anywhere). Then a splash rumble sized by `fill`, or a small one (0.15) if nothing came out.

## From scoop to less water on screen

1. **`scoopWater(amount)`** (`offscreen/joycon.js`): clamps `amount` to `target`, lowers `target` right away, and sends `{ type: 'setStorage', values: { target, scoop: { amount, t: Date.now() } } }` to `background.js`. It returns the amount taken. `t` makes each `scoop` value unique, so two equal scoops in a row still fire a storage change.
2. **`background.js`** writes both keys to `chrome.storage.local`.
3. **Storage change fan-out**:
   - Every tab's `core.js` gets the new `target`. The badge on the toolbar icon updates.
   - `background.js` relays `{ type: 'storage', target, scoop }` to the offscreen document.
4. **`offscreen/sim.js` → `scoop(amount)`**:
   - Picks a random `x` between 20% and 80% of the 1600-wide tank.
   - Adds the amount to `held`, so the step loop keeps that water on screen for now (its goal is `target + held`).
   - Posts `{ bucket: { x: x / SIM_W, amount } }` to every connected tab.
   - After `BUCKET_DIP` (0.3 s), removes `held` and calls `simRemove()`, weighted by a cosine bump of radius 90 px around `x` (falls to zero at 180 px), then `splash(x, -60000)` so water rushes back into the dent as waves.
5. **Tabs**: `core.js` passes `bucket` to `waterHooks.scoop`. `effects/scoop.js` draws a 64 px 🪣 that drops in over 0.3 s (tilted, easing in), sprays when it hits the water, then lifts away with drips. The whole animation lasts 1.1 s (`BUCKET_TIME`). The bucket lands at the moment the sim takes the water out.
6. **Lockout**: once the level drops under 99.5%, `effects/lockout.js` stops blocking clicks and the flashing red warning disappears.

## Haptics (HD rumble)

`rumble()` runs on every input report (about 60 Hz). It builds a two-band signal from a continuous texture for the current state, mixes in decaying one-shot hits, then encodes and sends it.

### Continuous textures

| State | Texture |
|-------|---------|
| `ready`, water on screen | Sloshing: low band, amplitude `clamp(motion / 700, 0, 1) × 0.35 × (0.3 + 0.7 × level)`, frequency swinging 110 ± 40 Hz. High band at 30% of that. |
| `fill`, water on screen | Low rumble `(0.15 + 0.45 × fill)`, wobbling at about 30 Hz, frequency 70 to 95 Hz. Random **glugs** (about 6/s, low band 90 to 130 Hz) and **bubbles** (about 14/s, high band 380 to 880 Hz). Both get stronger as the bucket fills. |
| `fill`, no water | Dry scrape: high band 200 Hz at 0.08. |
| `lift` | Weight of the bucket: low band `0.25 + 0.5 × fill` at 50 ± 10 Hz, plus drips (about 10/s, high band 600 to 1100 Hz). |
| `cool`, or `ready` with no water | Silence. |

### One-shot hits

`hit(band, f, a, ms, at)` queues `{ band, f, a, t0, dur }`. Its amplitude decays as `a × exp(-3 × elapsed / dur)` and it is dropped after `1.5 × dur`. Hits can start later (`at`) to build sequences.

| Event | Hits |
|-------|------|
| Hello (after `init`) | Low 160 Hz, 0.6, 120 ms |
| Splash (scoop) | Low 65 Hz `0.5 + 0.5 × size` for 260 ms, high 280 Hz `0.3 + 0.4 × size` for 160 ms, then `6 + 10 × size` droplet ticks (high 400 to 1000 Hz, 30 ms) spread over the next 0.08 to 0.6 s |
| Spill (lift timeout) | Low 80 Hz `0.6 × fill` for 400 ms, plus 8 high ticks (500 to 1000 Hz, 0.2, 25 ms), 50 ms apart |

### Mixing

Per band, hit amplitudes add to the texture (capped at 1). A hit that is louder than the band's current amplitude takes over the band's frequency. Both bands are multiplied by `gain` (**ความแรงการสั่น**, 0 to 1, default 0.8).

### Encoding (`encodeDual`)

Four bytes per motor:

- High band frequency is clamped to 82 to 1252 Hz, low band to 41 to 626 Hz.
- Frequency code: `round(log2(f / 10) × 32)`. High band: `(code - 0x60) × 4`. Low band: `code - 0x40`.
- Amplitude (`encAmp`): `round(log2(a × 8.7) × 32)` above 0.23, `round(log2(a × 17) × 16)` from 0.12 to 0.23, linear `round(a × 137)` below 0.12.
- Bytes: `[hf & 0xff, encAmp(ha) × 2 + ((hf >> 8) & 1), lf & 0x7f, (encAmp(la) >> 1) + 64]`.
- Neutral (silence) is `00 01 40 40`.

### Sending

- Report `0x10` with the same 4 bytes for both motors.
- Skipped while the previous write is still pending, so reports never pile up.
- Skipped when both this frame and the last one sent are neutral, which keeps Bluetooth quiet when idle.
- When the Joy-Con isn't the chosen drain, the bytes are always neutral.

## Popup status and settings

While **ตักน้ำออก** is chosen, the popup polls `{ type: 'joycon', act: 'status' }` every 250 ms. The offscreen host replies:

```js
{
  hid: true,                                 // navigator.hid exists
  settings: { gain, invert, enabled },
  pads: [{ name, streaming, error }],        // streaming = at least one input report arrived
}
```

Each controller shows as a card:

| Condition | Text | Color |
|-----------|------|-------|
| `streaming` | เชื่อมต่อแล้ว (connected) | green |
| `error` set | เชื่อมต่อไม่สำเร็จ ลองใหม่ (failed, try again) | red; the technical reason is in the card's tooltip |
| otherwise | กำลังเชื่อมต่อ… (connecting) | amber |

The settings (shown once at least one controller exists):

- **ความแรงการสั่น**: rumble strength slider, 0 to 1 in steps of 0.05.
- **สลับทิศการตัก**: invert the pitch, for when dip and flip feel reversed.

Changes go out as `{ type: 'joycon', act: 'settings', settings: { gain, invert } }` and are merged into `joyconSettings`.

## Message reference

| From → to | Message | Purpose |
|-----------|---------|---------|
| popup → offscreen | `{ type: 'joycon', act: 'status' }` | Get live status |
| popup → offscreen | `{ type: 'joycon', act: 'refresh' }` | Re-run `getDevices()` after pairing, then reply with status |
| popup → offscreen | `{ type: 'joycon', act: 'settings', settings }` | Update gain / invert, reply with status |
| popup / tab → background | `{ type: 'ensureSim' }` | Create the offscreen document if missing |
| offscreen → background | `{ type: 'simInit' }` | Read `target`, `speed`, `drainMode` from storage |
| offscreen → background | `{ type: 'setStorage', values: { target, scoop } }` | Write a scoop to storage |
| background → offscreen | `{ type: 'storage', target, speed, scoop, drainMode }` | Relay storage changes |
| offscreen sim → tabs (port `sim`) | `{ bucket: { x, amount } }` | A scoop started: draw the 🪣 at `x` (0 to 1) |

Storage keys touched: `drainMode` (`'joycon'`, `'cam'` or `null`), `target` (shared level 0 to 1), `scoop` (`{ amount, t }`).

## Tuning knobs

| Constant | File | Default | Effect |
|----------|------|---------|--------|
| `SCOOP_MIN`, `SCOOP_MAX` | `src/joycon/joycon.js` | `0.05`, `0.1` | Range of water one scoop takes (fraction of the screen, picked at random) |
| `DIP_DEG` | `src/joycon/joycon.js` | `-35` | Pitch that counts as "bucket in the water" |
| `LIFT_DEG` | `src/joycon/joycon.js` | `30` | Pitch that counts as "scooped" |
| `LIFT_TIMEOUT` | `src/joycon/joycon.js` | `1500` ms | Longest carry before the water spills back |
| `ACC`, `GYR` | `src/joycon/joycon.js` | `4/16384`, `936/13371` | Raw IMU scaling |
| `joyconSettings.gain` | `src/offscreen/joycon.js` | `0.8` | Default rumble strength |
| `BUCKET_DIP` | `src/config.js` | `0.3` s | Delay between the scoop and the water leaving the sim (also the 🪣 drop time) |
| `BUCKET_TIME` | `src/effects/scoop.js` | `1.1` s | Length of the 🪣 animation |

## Known limits

- WebHID only, so desktop Chrome, Edge or Brave.
- Pairing must happen in the popup, because the device chooser needs a click.
- `gain` and `invert` live only in the offscreen document's memory. They reset to `0.8` / `false` when the browser restarts or the offscreen document is recreated.
- IMU scaling uses defaults, not the per-controller factory calibration in SPI flash.
- The pitch axis follows the Joy-Con tester's frame (x toward the shoulder buttons). The Pro Controller uses the left Joy-Con's frame, which may not feel right; use **สลับทิศการตัก** if dip and flip are reversed.
- Until the controller sits still for about a second, the gyro bias is zero. The sloshing rumble can then react to sensor drift.
- `battery` and `scoops` are tracked but not shown anywhere.
- Tested with a fake WebHID Joy-Con in Playwright, not yet with a real controller (per the README).
