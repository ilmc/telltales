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
