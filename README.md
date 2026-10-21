# Telltales

An open-source experiment in source-independent observation instruments. This is the **first runnable architectural slice**, not a navigation-certified instrument or a finished framework.

## Run

Requires a modern browser and Python 3 (or any static HTTP server). No dependencies, package installation, boat hardware, internet access or private repositories are required.

```sh
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000). Move the −90°…+90° slider; switch to **Fixture** and advance values; emit invalid/missing readings. Both sources drive the same renderer without knowing its implementation. The gauge, numeric value, provenance and unavailable indication update in the browser. Reload to restore configuration defaults. Do not open `index.html` with a `file://` URL: browsers generally block fetching `config.json` there.

## Test

```sh
node --test test/*.test.mjs
```

Requires Node.js 20 or later. Tests cover configuration wiring, units and provenance, bounds, missing/invalid/stale/future samples, source switching and second-adapter substitution.

## Architecture exercised

```text
config.json -- validates source IDs, observation identity and renderer binding
    |
slider adapter --------\
                        > typed observation --> source gate / validity --> heel renderer
fixture adapter -------/
```

- `config.json`: declarative binding. Source `id` values, source type and fixture data can be edited. `renderer.observation` must match `observation.id`; mismatches fail at startup. Deliberately just one supported measurement and renderer type.
- `src/core.mjs`: dependency-free observation creation, contract checks, source adapters, source-selection gate and age validity. `Observation` has JSDoc type definition and runtime guards. The sign convention is **negative port / positive starboard**, with zero upright, in degrees; physical heel reference frames still require validation.
- `src/app.mjs`: DOM presentation only. It does not inspect the device type, derive a measurement or decode protocols. It is driven by source-independent observation and acceptance state.
- `test/core.test.mjs`: executable contract and substitution tests.

The virtual slider and deterministic fixture are **simulated**, never actual physical measurements. Both preserve explicit source identity, timestamp, units and validity. Bad readings show an em dash and do not move the gauge. The renderer is refreshed every second so an unchanged reading becomes stale after 30 seconds. Selecting a different source clears the previous reading before the new source starts; emissions from inactive sources are ignored.

## Scope and findings to verify

This slice tests whether the minimal observation boundary survives a second adapter and failures without coupling the renderer to the source. It does **not** prove real sensor support, interoperability with Signal K, recorder/replay fidelity, multi-screen layouts, chart integration or human readability at sea. Do not copy private Boat Optimist data or ACK management records into this repository.

## Contributor starting point

Run the tests, launch the page, inspect `config.json`, then trace `createSource → createBus → render`. Any proposed extension should first identify a concrete failed test/use case. Keep public engineering documentation here; undertaking management and experiment decisions live outside this repository.
