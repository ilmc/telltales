# Telltales

An open-source sailing-observation experiment, not a navigation instrument.

## Two-window quick start

```sh
npm ci
python3 -m http.server 4173
```

Open the simulator at `http://localhost:4173/?view=simulator`, then open the operational display in a separate browser window at `http://localhost:4173/?view=hud&template=sailing-hud`. Either order works. Select F11, or use the simulator's user-initiated **Fullscreen** button, to enter browser fullscreen; browsers may require that interaction.

The HUD is designed around a 1540 × 720 reference viewport and fills its window without controls, headers, scrolling, or engineering panels. It combines transparent SOG numerals over the history line with a large heel value and gauge. The simulator owns virtual sources, recording, imports and replay; the HUD only subscribes.

For the wind-enabled composition, open `?view=hud&template=sailing-hud-wind`. Its simulator cards provide independent apparent-wind speed and bow-relative-angle sliders plus invalid and missing controls. This is simulated apparent wind only: 0° is ahead, negative is port, positive is starboard, and it is neither a meteorological direction nor true wind. Use `?windMode=number`, `dial`, or `combined` to inspect the configured wind widget variants.

`?view=hud&template=sailing-hud-full` is the declarative 1540×720 full composition: SOG, STW, heel, apparent wind, and depth. STW is an independent simulated knot observation, never a substitute for SOG. Depth is metres with an explicit `REFERENCE UNKNOWN / UNCALIBRATED` label; it does not infer keel offsets, clearance, alarms, tide, or current. The virtual source catalogue also records Amzer'zo's ST60+/SeaTalk1 path as unsupported pending physical-interface verification—no hardware or SeaTalk1 decoder is included.

## Transport and failure semantics

`BroadcastChannel` (`telltales.observations.v1`) is the explicit current transport seam. Its versioned messages are `observation`, `snapshot-request`, `snapshot`, `heartbeat`, and `shutdown`. Messages are validated against the observation contract before display state changes. Original observation timestamps, source IDs, validity, replay metadata, and provenance are retained.

An optional local Signal K round trip is also available: simulator → authenticated Signal K plugin → Signal K stream → HUD. It is selected with `?mode=signalk`; direct mode remains the default. See [SIGNALK.md](SIGNALK.md) for the pinned local startup, token setup, standard paths, units, provenance, and failure behaviour.

The simulator publishes a snapshot on request and heartbeats while active. A HUD opened later requests a coherent snapshot automatically. Live out-of-order readings cannot replace newer readings; replay events are deliberately allowed to reconstruct an earlier state during seek. A simulator shutdown, or 3.5 seconds without a heartbeat, marks the HUD unavailable. Validity and connectivity remain distinct: an invalid sensor can be connected, and a disconnected producer cannot leave a live-looking value indefinitely. A HUD accepts one publisher identity at a time, rejecting a competing publisher.

`BroadcastChannel` is sufficient for this same-computer, same-origin, same-browser-profile experiment. It is not cross-device telemetry. The small versioned envelope and `createTransportState` boundary are where a WebSocket/network adapter can later be substituted.

## Imports and compatibility

JSON recording v1/v2 and NMEA RMC import remain supported. RMC accepts checksummed `$GPRMC`/`$GNRMC` file data and maps field 7 to SOG in knots. Replay preserves original time and provenance. JSON replay can drive both instruments; NMEA replay drives SOG only. The committed examples are synthetic.

## Templates and widgets

`sailing-hud` is declarative configuration in `config.json`: it declares its widget instance, bindings, reference viewport, and small `main`/`heel` slot contract. `sailing-hud-wind` extends it with the reusable `wind` widget. Existing public profiles and the `speed` widget remain available. See [WIDGETS.md](WIDGETS.md) for typed props and availability semantics.

## Verification

```sh
npm run validate:config
npm test
npx playwright install chromium
npm run test:browser
```

The browser test opens HUD first, runs simulator controls in a second page, checks snapshot delivery, invalid/missing state, replay/backward seek, publisher timeout, and captures Chromium evidence in `evidence/batch-9/` and `evidence/batch-10/`.
