# Telltales

An open-source experiment in source-independent observation instruments. It displays simulated heel and simulated Speed Over Ground (SOG); it is not a navigation-certified instrument.

## Run and use

Use Python 3 (or another static HTTP server); no packages, hardware, or internet connection are required.

```sh
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000). The two panels update independently:

- **Heel** has a simulated slider and a fixture source. It is measured in degrees; negative is port and positive is starboard.
- **Speed over ground (SOG)** has a simulated 0–20 knot slider. It is explicitly not speed through water and it is not a GNSS measurement—no GNSS hardware is connected.

Each instrument has its own source selector. Use **Emit invalid reading** or **Emit missing reading** to see that an unavailable SOG does not affect a healthy heel value, and vice versa.

Choose **Start recording**, change either or both controls, then stop and download. The recording contains actual accepted emissions only. Load that JSON under Replay, choose **Recording replay** for one or both instruments, and use Play, Pause, Restart, seek, and 1×/2×/4× speed. Replay retains the original producer timestamp/source and shows a distinct replay delivery source.

Do not open `index.html` via `file://`: browsers usually block loading `config.json` that way.

## Configuration and recording

`config.json` is the intentionally small composition point. It declares two concrete instrument instances, each observation’s identity/unit/range, its renderer, source bindings, defaults, and display order. Sources create observations; renderers only receive their own validated observations.

New exports use the mixed-observation v2 envelope:

```json
{
  "format": "telltales.observation-recording",
  "version": 2,
  "observations": [
    {"id": "vessel.heel", "unit": "deg"},
    {"id": "vessel.speedOverGround", "unit": "kn"}
  ],
  "events": [
    {"id": "vessel.heel", "unit": "deg", "value": 12, "sourceId": "virtual-heel", "observedAt": "2026-10-21T12:00:00.000Z", "valid": true, "simulated": true},
    {"id": "vessel.speedOverGround", "unit": "kn", "value": 6.5, "sourceId": "virtual-sog", "observedAt": "2026-10-21T12:00:01.000Z", "valid": true, "simulated": true}
  ]
}
```

Every event preserves identity, unit, original timestamp, producer source, validity, and simulated provenance. Bad/out-of-range events become unavailable, never displayable values. The parser also accepts the former v1 single-heel envelope (including [the existing synthetic example](examples/synthetic-heel-recording.json)) and normalizes it internally. It rejects unknown identities, units, producers, malformed data, unsupported versions, and non-chronological events.

Replay time is an offset from the recording’s first event. Paused replays are deterministic and their valid observations do not become stale from wall-clock time.

## Test

```sh
node --test test/*.test.mjs
```

Requires Node.js 20 or newer. Tests cover configuration wiring, identity/units/ranges, source isolation and independent freshness, mixed recording round trips, deterministic two-instrument replay, and v1 compatibility.

This experiment adds no physical GNSS, OpenCPN, Signal K, telemetry, storage service, or navigation-safety claim.
