# HUD configuration

`config.json` is the declarative contract. Observations are `vessel.heel` (degrees: port negative), `vessel.speedOverGround` (knots), and apparent wind speed (knots) / angle (degrees: port negative, starboard positive). Widgets are `speed` (`number`, `history`, `combined`) and `wind` (`number`, `dial`, `combined`); their typed props and bindings are validated by `npm run validate:config`.

Templates select widget IDs and named slots at the 1540×720 reference size. `sailing-hud-wind` is the Sailing HUD: combined SOG/history, heel, and apparent-wind dial. `wind-focused-hud` uses the same declarative bindings with wind as its primary widget, compact SOG, and heel. Open either with `/?view=hud&template=sailing-hud-wind` or `/?view=hud&template=wind-focused-hud`; run the simulator at `/?view=simulator`.

Sources declare a capability ID. The catalogue distinguishes implemented browser simulation (`virtual-*`), local-file replay (`recorded-nmea-rmc`, `recorded-nmea-mwv`), and the explicitly unimplemented `nasa-marine-wind-candidate`. No physical adapter or discovery is present.

RMC replay provides recorded SOG. MWV replay accepts only `R` apparent-wind sentences in a timestamp envelope: `2026-...Z | $IIMWV,...*CS`. MWV lacks time itself, so unwrapped data is rejected; envelope time is original recorded observation time, while replay scheduling is synthetic playback time. Load `examples/synthetic-mwv.nmea` in the simulator. Change widget props, bindings, source capability IDs, and template slots/sizes in JSON, then validate and preview—no runtime LLM is involved.
