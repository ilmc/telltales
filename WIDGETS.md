# Widget catalogue

## `speed`

Reusable Speed Over Ground presentation. `inputs.speed` is required and must bind a raw observation with unit `kn`. Invalid, missing, and stale readings show `—`/UNAVAILABLE. A replay preserves its original provenance; imported RMC is labelled NMEA FILE and virtual inputs are labelled simulated.

`props.mode` is `number`, `history`, or `combined`. `historySeconds` is 1–86400 (required), `scale` requires finite `min < max` and is presentation-only, and `historyOpacity` is 0–1. `title` is an optional non-empty string, `showUnits` is optional boolean, and `numericPosition` is `center`, `top-left`, `top-right`, `bottom-left`, or `bottom-right`.

```json
{"id":"primary-speed","widget":"speed","inputs":{"speed":"vessel.speedOverGround"},"props":{"mode":"combined","title":"Speed over ground","historySeconds":120,"showUnits":true,"scale":{"min":0,"max":12},"historyOpacity":0.65,"numericPosition":"center"}}
```

`number` displays the current valid SOG. `history` plots only samples in its declared timestamp window, breaking at unavailable samples. `combined` puts that same transparent history behind the value; the number has a text shadow, never an opaque backing rectangle. Widget scale does not alter sensor validation.

## `sailing-hud` template

`sailing-hud` is the operational 1540 × 720 reference template in `config.json`. It binds `primary-speed` to `vessel.speedOverGround` in the main slot and places independent heel numeric/gauge presentations in the heel slot. Layout belongs to the template, not to the simulator or source adapters. The widget remains viewport-responsive and keeps the graph visible through the transparent number overlay.

## `wind`

Reusable apparent-wind presentation. It requires `inputs.speed` bound to `environment.wind.apparentSpeed` (knots) and `inputs.angle` bound to `environment.wind.apparentAngle` (degrees). The angle is vessel-relative: `0°` is directly ahead, negative values are port, and positive values are starboard, in the inclusive range `-180°` through `180°`. It is explicitly not an absolute meteorological direction or true-wind direction.

`props.mode` is `number`, `dial`, or `combined`. Optional display props are `title`, `showUnits`, `showAngle`, `showPortStarboard`, `speedScale`, and `pointerStyle` (`arrow` or `needle`). `maxSkewMs` is 0–30000 and defaults to 5000 ms; speed and angle must both be valid, current, and no farther apart than that to form a valid combined wind state. If only one signal is available, the widget shows that individual value where applicable but labels the instrument UNAVAILABLE rather than fabricating or treating a combined state as valid.

`sailing-hud-wind` is the wind-enabled operational template; `sailing-hud` remains unchanged. The simulator provides independent apparent-speed and bow-relative-angle sliders, invalid/missing controls, and uses the same observation transport, snapshot, recorder, and replay contracts as every other raw observation. `examples/synthetic-wind-recording.json` includes port/starboard transitions and an invalid interval.

## `depth`

Reusable depth presentation bound only to `environment.depth` in metres. `mode` is `number`, `gauge`, or `combined`; `scale.min` and `scale.max` are required display-only bounds. Optional `showUnits`, `showReference`, `showScale`, and `referenceLabel` control the presentation. The configured reference is explicitly unknown/uncalibrated. No offsets, clearance, or alarm semantics are supplied.

## STW

STW uses the existing reusable `speed` widget, with `inputs.speed` bound to `vessel.speedThroughWater`. It supports `number`, `history`, and transparent-number-over-history `combined` exactly as SOG does, while retaining the visible `STW` identity.

## `sensor-reading`

`sensor-reading` is a provenance-preserving, single-value widget used by the synthetic sensor-group template. Its `binding` names a group binding and `title` is supplied by the template configuration. It displays the selected provider/channel, units, reference frame and explicit fallback state. It is intentionally not an own-vessel apparent-wind widget: an `other-vessel` or `fixed-site` value remains a labelled reading and cannot be silently wired into the apparent-wind dial.

## `surface`

`surface` composes a producer-owned visual frame inside a bounded template slot. It is deliberately not a chart, map, video, routing, or navigation component. The widget has no observation inputs and cannot create, alter, or supply telemetry values.

Its required props are `channel` (a same-origin `BroadcastChannel` name), `nativeSize` (`width`/`height`, positive integer pixels), `fit` (`contain`, `cover`, or `stretch`), and `maxFrameAgeMs` (250–60000). `title` is optional. The template owns clipping, dial/rim artwork, annotation layers, and pointer hit-testing; the frame image is beneath those overlays.

The independent producer sends versioned `frame`, `reset`, or `shutdown` messages on the configured channel. A `frame` carries a publisher ID, send/observation timestamps, opaque frame ID, and browser-safe image URL. Only one publisher is accepted at a time. Reset (including seek/restart) clears the image immediately; shutdown, image-load failure, malformed messages, and age timeout show an explicit unavailable state. A later valid frame can recover it. Frame freshness is separate from observation provenance.

`zo-hud-surface` is a public-safe 1540×720 example: a native 720×720 synthetic surface beneath an overlay dial, flared reusable SOG/wind/depth instrumentation, and no chart/navigation claim. Open `?view=surface-fixture`, then `?view=hud&template=zo-hud-surface`, plus the ordinary simulator in another window.

## Installation templates (synthetic contract)

`examples/synthetic-sensor-groups.json` is the focused reusable contract for an installation, semantic template and session. An installation channel records its observation, unit, frame and known calibration/datum (or explicit `unknown`); templates declare only required/optional semantic inputs; a session deterministically binds them. Extra installed sensors never make a heel-only template incompatible. Missing compatible sources and installed-but-stale feeds remain different states. Heel presentation may be degrees, radians or user-threshold qualitative labels without changing the binding; wind supports knots/m/s and depth m/ft conversions. Metres-to-feet preserves the declared datum—unknown is never silently reinterpreted as keel, waterline or transducer depth.
