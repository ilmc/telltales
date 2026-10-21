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
