# Telltales, Signal K and reusable boat configurations

> **Status: architectural discussion / candidate direction, not an implemented product contract.** This document records product reasoning from the first real iPhone inclination experiment. It does not imply production hardware integrations, boat profiles, remote connections, or an OpenCPN chart embedding are already working. The actual iPhone experiment and its limitations are documented in [its quickstart](experiments/iphone-heel/README.md).

## Principle: interoperate rather than duplicate Signal K

Signal K already provides a standard marine observation vocabulary, vessel context, data-source provenance, server integrations and administration. Telltales should not pretend these capabilities are missing, require a custom driver for every device, or develop a competing general-purpose instrument server. Where existing Signal K, SeaTalk, NMEA or SensESP integrations can connect hardware, prefer them.

Two separable areas of value emerged:

1. **Producers and integration assistance.** Hardware- or browser-specific adapters translate native measurements (axes, units, mounting frame, calibration) into standard Signal K observations. An optional Telltales-origin adapter should be independently reusable by *any* Signal K consumer; do not make Telltales' HUD a prerequisite. A setup assistant can discover existing compatible adapters before proposing to implement another.
2. **Consumers and declarative configuration.** HUDs, widgets, templates and sensor-group selection consume standard observations. Signal K itself may already provide administration and display functionality. Telltales can provide a simpler **infrastructure-as-code-like** discover → describe → review → apply workflow around supported Signal K configuration, without claiming unique ownership. No assumption that every setting has a stable API: unsupported changes require a documented boundary and human approval, not brittle undocumented UI automation. If suitable, these tools could be contributed upstream to Signal K.

These pieces should be installable/useful independently and communicate through standard interfaces rather than an obligatory Telltales-specific server.

### Ownership boundary: toolkit versus downstream deployment

**Telltales is the reusable upstream toolkit.** Its public repository owns generic adapters where justified, Signal K integration helpers, declarative schemas/validators, sample *fictional* groups, widgets, layouts, documentation and tests. It does **not** own, configure, or store the final instrument inventory, source credentials, sensor bindings or customised HUD of a particular customer boat.

**Downstream consumers own their installations.** Each consumer uses the public tooling to discover and configure their real Signal K sources, build sensor groups, select displays and customise layouts in its own project/environment. Real boat configuration, sensor availability, identifying information, and test evidence stay downstream unless an explicitly authorised, sanitised and generally reusable contribution is upstreamed. A downstream consumer may be called Boat Optimist and may use a group called **Zo**; that does not make Zo a Telltales-owned example, fixture, installation or configuration. Avoid importing downstream materials into public Telltales without consent and scope review.


## Observation semantics and widget presentation

A device may output signed degrees, radians, orientation quaternions, or manufacturer-specific axes. Normalise at the *source/adapter boundary* to the chosen standard reference frame and Signal K unit, and retain timing/source/calibration information. In particular, Signal K `navigation.attitude.roll` uses signed radians. The source adapter must establish the physical port/starboard orientation for its actual mount: do not correct an upside-down display by silently changing standard conventions.

A numeric heel widget may display **12° Port** or **12° Starboard** (unsigned magnitude plus explicit direction), while a chart may retain a signed value. A widget is free to transform **presentation** without silently rewriting the underlying observation. Smoothing of visual output must not conceal stale, unavailable or uncalibrated data.

A single physical IMU may produce several measurements, while several sensors may independently produce the same observation. Thus **hardware device**, **data source**, **standard observation**, **source preference**, **boat/group** and **widget** are distinct concepts. Normalisation makes readings comparable in meaning, not equally accurate.

## Generic mixed-source example (fictional)

**This is a fictional, non-customer example**, not a boat profile, installation record or committed implementation. A reusable mixed-source fixture might contain:

| Hypothetical physical source | Connection candidate | Standard observation intent |
| --- | --- | --- |
| ST60+ depth and speed-through-water instruments | Suitable SeaTalk1 hardware bridge and supported Signal K integration | Depth with **explicit known reference**, speed through water |
| Dedicated 2-axis inclinometer | Existing compatible adapter, ESP32/SensESP or plugin | `navigation.attitude.roll` (and pitch where supported) |
| USB GPS attached to an N150 | Serial/NMEA input on an onboard Signal K instance or compatible gateway | `navigation.position`, COG, SOG |
| NASA wind instrument | Device-appropriate adapter (verify its specific interface first) | Apparent wind angle and speed |
| OpenCPN chart view | Separate charting application / future external surface | Desired center-dial chart content; integration **not verified** |

A named **Primary Sailing** sensor group would select *available* source identities for these observations. Source ownership (which boat/device produced it), available/selected data, and a reusable HUD template remain separate. Signal K's own source selection/priority should be reused where it satisfies the need; a Telltales group is a user-facing selection/composition convenience, not a replacement priority engine. A sensor from another boat or clubhouse would be **explicitly remote/shared**, not misrepresented as onboard.

A template might place OpenCPN chart content in a center dial and wind, depth, speed and heel widgets around it. This is a **candidate composition**, not current evidence of working OpenCPN embedding. Browser frame/security restrictions and a supported chart surface need validation.

## Why somebody might choose Telltales—or not

An ST60+ connected via SeaTalk hardware can feed Signal K directly; a USB GPS may feed Signal K using supported serial/NMEA integration; an inclinometer might publish through SensESP. All can work without Telltales. The advantage of Telltales would be to **help discover, configure, review and reuse** these connections, group observations for a chosen vessel/session, and compose a sailor-friendly HUD. Do not require a Telltales plugin for already standard Signal K feeds.

It is legitimate for a consumer to use Signal K's native configuration/UI instead. Telltales' declarative helper may eventually be useful as an upstream Signal K contribution; avoid entrenching unnecessary proprietary abstractions.

## Architectural consequence of the iPhone experiment

The current experimental path is **iPhone Safari → temporary local Telltales HTTPS/WSS producer → custom Signal K ingress plugin → Signal K stream → Telltales HUD**. It proved real phone motion can traverse Signal K. It also exposed onboarding friction, direction/presentation issues, and a token-free HUD proxy issue. These are documented physical findings, not a production architecture commitment.

Investigate whether a Signal K-hosted webapp or another supported authenticated ingress/adapter can let the phone publish **standard Signal K observations** without the Telltales-specific bridge. HTTPS is still needed for browser motion permissions, and authentication, pairing, timestamp freshness and source identity still need thought. **Keep the current proven experiment until an alternative genuinely works**; do not remove it on architectural preference alone.

## Local / remote topology

Default towards an onboard or otherwise local Signal K data hub so the HUD can keep working during cellular loss. An outbound secured link to a home/remote server can enable history and remote monitoring, but is a future option, **not** a required dependency and not implemented here. Treat vessel position/privacy and connectivity interruptions explicitly; do not expose unauthenticated marine data to the internet.

## Proposed decisions and next evidence

- Document Signal K-standard semantics as the contract for source adapters and widgets; define any Telltales-specific selection layer as optional and narrower than Signal K itself.
- Evaluate existing iPhone/IMU producers and supported Signal K ingestion before investing in a standalone Telltales sensor driver.
- Verify physical port/starboard direction and numeric UI independently of raw signed Signal K data.
- Prove the launcher-opened **token-free** HUD works with live phone readings, and perform real start → stop → fresh-terminal restart.
- Provide generic schema, tooling and synthetic examples for users to create their **own** boat sensor groups and customised HUDs; do not implement or publish any customer's specific profile or wiring in Telltales.
- Keep exploratory product choices separate from accepted Issue #17 / PR #30 physical test criteria. Major scope additions should be separately reviewed rather than silently added to the current PR.
