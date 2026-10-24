# Telltales and Signal K: architecture and ownership

> **Status:** Proposed direction, not an implemented product contract. The iPhone experiment remains in [Draft PR #30](https://github.com/ilmc/telltales/pull/30). See the [draft quickstart](IPHONE-HEEL-QUICKSTART.md); those Make commands are not yet available on `main`.

## Reuse Signal K

Signal K already defines marine observations, source metadata, vessel context and integration mechanisms. Telltales should reuse its standards and existing hardware drivers rather than create a competing sensor server.

A physical instrument may report several quantities, while several devices may report the same quantity. Keep device identity, source, observation, selected source, boat group and widget as separate concepts.

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
