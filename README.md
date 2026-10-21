# Telltales

An open-source, two-instrument observation experiment. It displays heel and Speed Over Ground (SOG); it is not a navigation instrument.

## Run and use

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. Each dial has its own source. The sliders are explicitly simulated; invalid or missing events make only that dial unavailable.

To import a local NMEA file, choose **Load NMEA 0183 RMC file**, then use the shared Play/Pause/Restart/seek controls. This switches only SOG to **NMEA FILE REPLAY**, so heel remains independently usable. The dial distinguishes simulated, JSON replay, NMEA-file, and unavailable readings. File import is playback of a local file, never live GNSS.

`examples/synthetic-rmc.nmea` is public synthetic data: invented zero coordinates and an invented 2026-10-21 timestamp. It is deliberately marked synthetic by tests/documentation; do not treat it as a passage log.

## NMEA scope

The deliberately narrow adapter accepts newline-separated, checksummed `$GPRMC` and `$GNRMC` sentences only. It maps field 7 (RMC SOG) in knots to `vessel.speedOverGround`, never to speed through water. UTC time/date fields 1 and 9 become `observedAt`; playback time is a separate offset from the first imported event.

Only status `A`, a valid checksum, a valid UTC timestamp, a present numeric SOG, and the configured 0–20 kn range produce a valid reading. A checksum failure, `V`/other fix status, missing/malformed/out-of-range SOG produces a typed unavailable event when its timestamp is trustworthy. Lines with unsupported talkers, malformed timestamps, or no supported events are rejected safely. Imported readings have `simulated: false` and provenance `{kind:"nmea-0183-rmc-file", synthetic:false}`. The committed sample is parsed with `synthetic:true` for tests; actual imports are not labelled simulated.

## Recording compatibility

JSON recordings remain v2; no format bump was needed. v2 now permits an explicit `provenance` object and a boolean `simulated` value, preserving NMEA-file origins when recorded alongside heel. Existing v1 heel-only and existing simulated v2 recordings remain readable. Replay preserves original event time/source and adds delivery replay provenance without changing the original source.

## Test

```sh
npm ci
npm test
npx playwright install chromium
npm run test:browser
```

Core tests cover configuration, source isolation, recording/replay, v1 compatibility, checksum/status/timestamp/range NMEA handling, and provenance. Playwright runs the actual static application via an HTTP server, captures page/console errors, and covers controls, unavailable states, download/load replay, seeking, v1 replay, and NMEA SOG playback. GitHub Actions runs core and Chromium browser jobs on pushes and pull requests.

This experiment adds no server, database, serial device, Signal K integration, live GNSS, or navigation-safety claim.

## Compose displays

Choose **Engineering** from the Display menu to open the composition editor. Start from one of the supplied profiles or **Empty composition**, choose **What to show** and **How to show it**, then select **Add display**. Numeric, gauge and speed trend line displays accept raw numeric observations; condition accepts the derived condition. The same observation can appear in any number of independent displays. Rename a display, use **Move up** / **Move down**, or remove it. **Preview composition** hides the editing controls without changing sources or playback; choose **Edit composition** to return.

The SOG trend line is available immediately in supplied Compact and Wide profiles, as well as from the editor. History is reconstructed from every replay event after seek/restart and deliberately breaks at invalid or missing events.

The derived **Moving under heel** condition is explicitly marked derived and consumes heel plus SOG. Its controls adjust absolute heel threshold (15° by default), SOG threshold (3 kn), maximum input age (30,000 ms), and maximum timestamp skew (5,000 ms). Valid edits recompute from current observations immediately; invalid values are rejected without applying a partial change.

Use **Save composition** to download a portable, versioned `telltales.composition` JSON file; use **Load composition** to validate and apply one later. A composition contains observation identities, supported presentation types, titles, order and the supported derived thresholds only—it never contains sources, DOM identifiers or executable code. [examples/synthetic-composition.json](examples/synthetic-composition.json) showcases heel numeric, SOG trend, SOG gauge and the derived condition. **Reset** restores the supplied Engineering composition and thresholds; supplied profiles in `config.json` are never overwritten.

Changing a composition does not reset active sources, raw history, recording state, loaded replay, replay position, or playback speed. Recordings retain raw observations only, so v1 and v2 JSON recordings and NMEA replay remain compatible and always recompute derived state deterministically.

## AI-ready speed widgets

The supported public widget catalogue is [WIDGETS.md](WIDGETS.md). A `speed` widget binds `inputs.speed` to a raw `kn` observation and has typed, offline-validated props: `mode` (`number`, `history`, or `combined`), `historySeconds` (1–86400), display-only `scale.min`/`max`, `historyOpacity` (0–1), optional `title`, `showUnits`, and `numericPosition`.

`number` presents current SOG; `history` presents only timestamped samples in its declared window and leaves gaps after invalid readings; `combined` layers the number over the live SVG line without a filled number backing. Its text shadow supports legibility while retaining the graph. Each widget owns its scale/window, so two bindings to the same SOG can show different views safely.

Select **Speed-focus** for the combined SOG widget plus heel number. Select **Instruments-trends** for separate SOG number/trend widgets, heel gauge, and Moving under heel. These are declarative profiles in `config.json`; the small files in `examples/` identify the corresponding template. Both work with virtual controls, the public RMC fixture, and JSON recordings.

Validate configuration offline before opening the app:

```sh
npm run validate:config
npm run validate:config -- path/to/config.json
```

An agent workflow is: read the catalogue and templates; map the request to observation bindings and props; edit configuration; validate it; run `npm test` and `npm run test:browser`; preview in Chromium; then return the exact configuration change and unsupported requests. For example, “show SOG over two minutes behind a large value” maps to `mode:"combined", historySeconds:120`; “show a six-minute trend beside the current SOG” maps to two independent `speed` instances with `history` and `number` modes. Configuration intentionally cannot inject CSS or executable code.
