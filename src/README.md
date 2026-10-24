# Source architecture — why it is separated

Telltales must allow an instrument to display a measurement without knowing which device, recording or network transport supplied it. This is why observation meaning, transport and rendering are separate concerns instead of one tightly coupled sailing application.

## Design rationale

- **Observation semantics before presentation.** Values need identity, units, timestamps, validity and provenance because a plausible number without that context can mislead an operator.
- **Replaceable transports.** Same-browser `BroadcastChannel` is useful for an offline, two-window simulator; Signal K is a separate optional marine interoperability path. Neither should dictate widget behaviour.
- **Deterministic interfaces.** Local configuration and replay should produce testable behaviour without a runtime LLM, internet service or hidden agent state.
- **Privacy and identity boundaries.** A reading from another vessel, a synthetic fixture or a local private profile cannot silently become trusted live own-vessel data.
- **Presentation only at the HUD.** Engineering controls are kept outside the sailing display to minimise accidental changes and preserve clarity.

## Trade-offs and things not yet established

Several deliberately separate experiments coexist (legacy simulator/replay, sensor-group catalogue, private setup and external surfaces). Consolidating them before evidence from a real new source could increase complexity; duplicating domain semantics indefinitely could also harm correctness. Prefer contract-focused changes and cross-path tests before architectural consolidation. This is experimental software, not a trusted navigation instrument.

## Where to investigate

`core.mjs` contains shared observation/bus/replay behaviour; `app.mjs` wires the browser routes; `signalk.mjs` maps and subscribes to Signal K; `sensor-groups-demo.mjs`, `private-profile-setup.mjs` and `surface-runtime.mjs` implement separate experimental surfaces. For the public contracts and their rationale, consult [CONFIGURATION.md](../CONFIGURATION.md), [SIGNALK.md](../SIGNALK.md), [SENSOR-GROUPS.md](../SENSOR-GROUPS.md) and [WIDGETS.md](../WIDGETS.md). The executable checks live in [test/](../test/).

Changes that alter units, frames, provenance, source isolation, freshness or unavailable states need corresponding test and contract updates. Code, not this README, remains authoritative for the exact current behaviour.
