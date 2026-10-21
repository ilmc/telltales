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

## Display profiles

`config.json` declares the three supported profiles in `display.profiles`: `engineering`, `compact`, and `wide`. Select one with the **Display** menu or open `/?profile=compact` (or `wide`). An unknown URL profile safely falls back to `display.defaultProfile` and reports that choice; it never changes sources, replay position, or recording.

Each profile has an `instruments` array (the placement/order), one of the fixed `layout` values (`engineering`, `compact`, or `wide`), plus boolean `showControls` and `showMetadata` choices. All instruments must be listed exactly once. `engineering` is the default and retains source controls, imports, recording, replay, and full diagnostic metadata. `compact` is intentionally control-free for narrow screens. `wide` puts SOG first and is tuned for a 1540×720 experimental display, with room left by its two-panel composition for a future chart surface; it does not implement a chart.

The profiles only present the existing heel and SOG observations. Heel values explicitly state `PORT` for negative values, `STARBOARD` for positive values, and `UPRIGHT` at zero. Status labels distinguish valid simulated observations, NMEA-file readings, JSON replay, and unavailable readings.
