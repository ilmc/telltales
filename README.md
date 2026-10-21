# Telltales

An open-source experiment in source-independent observation instruments. It is a runnable inclinometer slice, not a navigation-certified instrument.

## Run and use

Requires a modern browser and Python 3 (or another static HTTP server). No package installation, hardware, or internet access is required.

```sh
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000), then select **Virtual slider** or **Fixture**. The slider and fixture are simulated sources; their values are never live sensor data.

To record, select a source, choose **Start recording**, create values (including **Emit invalid reading** or **Emit missing reading**), then choose **Stop recording** and **Download recording**. Only actual source emissions while recording are written—no timer-generated observations are invented.

To replay, select **Recording replay**, load a downloaded JSON file, then use Play, Pause, Restart, the seek control, and 1×/2×/4× speed. A replay explicitly shows `REPLAY`, its replay delivery source, effective playback position, and the original producer/source timestamp. It never claims to be live sensor data. Try [the synthetic example](examples/synthetic-heel-recording.json): it is deliberately synthetic test data, not boat data, and contains positive, zero, negative, invalid, and missing readings.

Do not open `index.html` through `file://`: browsers usually block loading `config.json` that way.

## Recording format

The downloaded document is untrusted-input-safe JSON with this stable envelope:

```json
{
  "format": "telltales.observation-recording",
  "version": 1,
  "createdAt": "2026-10-21T12:00:05.000Z",
  "observation": { "id": "vessel.heel", "unit": "deg" },
  "events": [{ "id": "vessel.heel", "unit": "deg", "value": 12,
    "observedAt": "2026-10-21T12:00:00.000Z", "sourceId": "virtual-heel",
    "valid": true, "simulated": true }]
}
```

Every event preserves its `observedAt`, producer `sourceId`, unit, validity, and simulation provenance. Invalid or missing events have `value: null`, `valid: false`, and a `reason`. The loader rejects malformed envelopes, unsupported versions, unknown producer identities, and type mismatches. Out-of-range values are retained only as invalid/unavailable events; they cannot display as numbers.

`observedAt` is the original producer time. `replay.effectiveTimeMs` is an in-memory offset from the first recording event used for replay position. Browser wall-clock time is used to advance a playing replay, but does not make a paused valid replay event stale. Replay delivery metadata is separate from `sourceId`, retaining the producer identity for rendering and recording.

## Test

```sh
node --test test/*.test.mjs
```

Requires Node.js 20 or later. The tests cover configuration wiring, live adapters, recording round trips, invalid/missing events, malformed/version/out-of-range recordings, replay controls and clock semantics, source isolation, and deterministic replay state.

## Architecture

```text
slider / fixture --> typed observation --> source gate --> recorder --> heel renderer
                                                ^
recording file --> validated replay adapter ---+
```

`config.json` declares source identities, observation identity, and renderer binding. It has one slider, one fixture, and an optional replay delivery source. Configuration fails closed for duplicate identities, invalid source declarations, or invalid renderer/observation bindings.

`src/core.mjs` contains the dependency-free contract, adapters, recorder/parser, replay clock, source gate, and age validation. `src/app.mjs` only attaches DOM controls and renders the accepted observation; it does not branch on a source implementation. The heel convention is negative port / positive starboard, in degrees, with zero upright.

This does not add hardware integrations, storage services, telemetry, or networking. It also does not establish real-world sensor calibration or a seaworthy user-interface assessment.
