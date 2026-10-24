# Telltales and Signal K: architecture and ownership

> **Status:** Proposed direction, not an implemented product contract. The iPhone experiment remains in [Draft PR #30](https://github.com/ilmc/telltales/pull/30). See the [draft quickstart](IPHONE-HEEL-QUICKSTART.md); those Make commands are not yet available on `main`.

## Reuse Signal K

Signal K already defines marine observations, source metadata, vessel context and integration mechanisms. Telltales should reuse its standards and existing hardware drivers rather than create a competing sensor server.

A physical instrument may report several quantities, while several devices may report the same quantity. Keep device identity, source, observation, selected source, boat group and widget as separate concepts.

## Target packaging (Issue #32)

The supported runtime observation contract will be **Signal K**. Normal live operation requires access to a Signal K server, but not a cloud service, internet connection, Telltales-owned server, or both Telltales components. An on-boat instance supports offline navigation displays. The existing browser-only BroadcastChannel demo and optional Signal K mode remain **legacy development paths during migration**; neither is evidence that the target design has been implemented.

These are **two independent installable components**, plus a shared specification/library, not necessarily two server plugins:

| Component | Default packaging candidate | Function |
| --- | --- | --- |
| Producer/integration assistant | Optional Signal K server plugin **or** standalone adapter where required | Discover supported instrument integration, normalise/calibrate and publish standard observations; reuse established plugins and drivers |
| Consumer/HUD | Signal K webapp | Read observation streams, source/freshness metadata and user-selected groups; compose sailing widgets and external surfaces |
| Shared sensor-group contract | Versioned schema, validator, examples and import/export tooling | Describe selections independently of the producer and HUD; translate to supported Signal K configuration where possible |

**Install only what is needed.** An existing Signal K GNSS or wind adapter needs neither Telltales producer nor its specific plugin. A different Signal K display can consume a Telltales-origin heel reading. A Telltales HUD can consume ordinary Signal K observations without a Telltales producer.

### Sensor groups: common contract, not a second source-priority engine

A sensor group is a **user-curated named selection** of observations and preferred sources for a vessel/session or task. It is not an independent vessel identity, device driver, transport, stream or duplicate Signal K arbitration layer. The contract distinguishes:

- Signal K path, expected units/reference, vessel context and source identity;
- user-facing label, optional preferred source, fallback policy where supported, provenance and age requirements;
- template/widget presentation bindings (consumer-specific, not sensor calibration);
- human-authored configuration versus discovered/live status.

The producer-side helper may use a group definition to suggest/connect the required observations; the HUD may use the **same definition** to choose widgets or preferences. **Neither component owns the group's canonical storage simply by being installed.** Begin with a portable, validated file owned by the downstream deployment; later assess a Signal K-native settings API or plugin only if justified. Avoid hard-coding customer boats or inventing server APIs.

Use **discover → describe → diff/review → apply** for IaC-style orchestration. Applying changes must be explicit, idempotent, and supported by stable Signal K interfaces; unsupported operations remain documented manual steps. Secret references belong in local protected storage, never in shared example files or public URLs.

### Incremental delivery and acceptance

1. Specify and validate a **fictional** sensor-group file with unit/source/freshness checks, then test it with two independent clients; exclude customer configuration and secrets.
2. Audit existing Telltales simulator, transport, config and plugin boundaries; preserve working tests while drawing a migration map to standard Signal K deltas and source identities.
3. Demonstrate a HUD-only installation consuming data from existing Signal K sources; no producer installation required.
4. Demonstrate a producer-only integration feeding a **non-Telltales** Signal K consumer; reuse existing adapters before authoring a new one.
5. Migrate or clearly confine BroadcastChannel simulation/replay to tests; verify deterministic browser tests and disposable real Signal K E2E, disconnected/stale states, stop/restart and security.
6. Package/version each component independently without prematurely splitting repositories. Real hardware/category examples must distinguish simulated tests from physical acceptance.

This is the **agreed architecture direction, not delivered behaviour**. Scope the physical iPhone test and bug fixes in Draft PR #30 separately; do not fold Issue #32's migration into it.

## Independent producers and consumers

**Producers** read physical instruments or browser motion, calibrate axes and reference frames, and publish standard Signal K observations. Where an existing adapter, SeaTalk bridge, NMEA connection or SensESP implementation works, prefer it. A new producer should work with other Signal K consumers without requiring the Telltales HUD.

**Consumers** subscribe to normalised observations and provide widgets, templates, history and display composition. Telltales can offer a friendlier experience, but a user may also configure and consume data using Signal K directly. Upstream adoption of useful tools by Signal K would be welcome.

A proposed configuration helper could discover sources, describe desired setup declaratively, show an explicit change preview and apply only supported Signal K settings with approval. Do not assume all administration features have a stable API.

## Data semantics and presentation

Signal K `navigation.attitude.roll` is a signed angle in radians. A physical inclinometer adapter must normalise its sign, mounting frame, reference and units before publishing. Preserve source, event time, calibration and freshness. Sensors with different accuracy can still agree on the standard meaning.

A sailor-facing numeric widget may display `12° Port` or `12° Starboard` rather than a negative magnitude. A trend chart may use a signed axis. Presentation must not silently redefine the underlying observation or conceal stale measurements.

## Ownership: toolkit versus deployment

**Telltales owns reusable open-source tooling and examples:** generic adapters when justified, integration helpers, configuration schemas and validators, synthetic sensor groups, widgets, layouts and tests. Its examples should be usable without copying any customer's identifying configuration.

**Boat Optimist owns the real Zo installation:** its sensor inventory, source credentials, configured groups, chosen widgets and customised HUD. Zo is not a Telltales-owned profile or a deployed Telltales example. Private downstream information must not be copied upstream without explicit authority and appropriate sanitisation.

Telltales may provide **generic working examples** for SeaTalk/ST60+ depth and speed through water, USB GPS, inclinometer/heel, NASA wind, and an OpenCPN external chart surface where technically possible. Each example must distinguish synthetic validation from real-hardware evidence; these integrations are not currently claimed to work end to end.

A fictional `Primary Sailing` group can illustrate how users select preferred sources for depth, water speed, wind, GPS and roll. Sensor ownership and source priority should use Signal K's existing mechanisms where appropriate. A borrowed boat or shared clubhouse observation is explicitly external, not falsely marked as onboard.

## iPhone experiment: learn before simplifying

The experimental route is iPhone Safari, a temporary local HTTPS producer, a Telltales-specific ingress plugin, Signal K and a separate HUD. Real motion reached Signal K and a HUD, but the automatically launched token-free HUD and physical port/starboard presentation had outstanding issues in the initial trial.

Investigate whether a standard Signal K-hosted app or another supported adapter can replace the temporary bridge. Do not remove the proven route until the replacement has been demonstrated. The browser still needs HTTPS, motion permission, trusted authentication, source identity and freshness handling.

## Deployment and next evidence

Prefer local boat data availability so a live HUD does not depend on cellular coverage. A secured remote or home Signal K service may be useful for monitoring and history, but no such connection is implemented or required here.

Prove token-free iPhone-to-HUD behaviour, signed orientation and restart in the physical experiment. Build generic, independently testable examples for downstream consumers without adding the real Zo configuration to Telltales. Broader scope belongs in separately reviewed work rather than silently expanding PR #30.
