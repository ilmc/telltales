# Synthetic sensor groups (Issue #8, contract slice)

This example is a **local, synthetic contract fixture**, not a functioning network adapter, live phone GNSS input or deployed multi-vessel HUD. It is intentionally separate from legacy `config.json`, which continues to control the existing simulator/HUD and Signal K mapping. The new module `src/sensor-groups.mjs` does not yet drive the browser runtime or render provider badges.

`examples/synthetic-sensor-groups.json` declares three independent origins:

- `phone/sog` — synthetic phone-like SOG, own-vessel reference frame.
- `guest-mast/apparent` — synthetic apparent wind *relative to another vessel*. It is not apparent wind at the viewing vessel.
- `shore/wind` — synthetic fixed-site wind. It is neither the observing vessel's apparent wind nor automatically true wind at the observing vessel.

A provider has a context and typed channels. A group binds named presentation inputs to an **ordered explicit** choice of providers/channels, requiring matching observation ID, units, and frame. The first fresh valid candidate wins. A lower-priority candidate may be used only with `fallback: true` in the result; the choice is never based on latest packet arrival. Missing, stale, invalid, wrong-unit and wrong-frame observations do not become valid display values. Returning an unavailable status is mandatory when all candidates fail.

A session independently associates a sensor-group ID with a template ID. Selecting a new group clears cached observations, rather than inheriting possibly misleading data from the previous context; the template is unchanged. Separate session objects never share observation history.

Example from a Node ES module:

```js
import {readFileSync} from 'node:fs';
import {createSensorSession} from './src/sensor-groups.mjs';
const catalog = JSON.parse(readFileSync('./examples/synthetic-sensor-groups.json'));
const session = createSensorSession(catalog, 'guest', console.log);
console.log(session.snapshot()); // unavailable until synthetic observations are dispatched
```

## Current limitations and non-goals

This is the **first contract/test slice** of #8, not completion of its acceptance criteria. No live cross-boat networking, transport authentication, device discovery, remote upload, geospatial transformation, chart integration, physical NASA instrument, production source integration, browser preview or UI provenance labeling has been implemented here. In particular, do not route the synthetic other-vessel wind through the existing own-vessel apparent-wind dial.

Before acceptance, add browser wiring and a distinct multi-origin presentation, verify compatibility and the full CI/browser suite, and collect actual screenshots. Keep the PR open until independently reviewed.
