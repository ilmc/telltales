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
