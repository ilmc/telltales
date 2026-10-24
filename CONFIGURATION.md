# HUD configuration

`config.json` is the declarative contract. Observations are `vessel.heel` (degrees: port negative), `vessel.speedOverGround` (knots), and apparent wind speed (knots) / angle (degrees: port negative, starboard positive). Widgets are `speed` (`number`, `history`, `combined`), `wind` (`number`, `dial`, `combined`), and `surface` (a bounded producer-frame slot); their typed props and bindings are validated by `npm run validate:config`.

Templates select widget IDs and named slots at the 1540×720 reference size. `sailing-hud-wind` is the Sailing HUD: combined SOG/history, heel, and apparent-wind dial. `wind-focused-hud` uses the same declarative bindings with wind as its primary widget, compact SOG, and heel. Open either with `/?view=hud&template=sailing-hud-wind` or `/?view=hud&template=wind-focused-hud`; run the simulator at `/?view=simulator`.

`zo-hud-surface` adds an opt-in, native 720×720 `surface` slot without altering the legacy HUD, simulator, replay, Signal K, or sensor-group flows. `/?view=surface-fixture` is its synthetic/public-safe producer. It publishes versioned frames and lifecycle events on a separate browser channel; it does not supply observations or navigation data.

Surface HUD templates declare their own widget IDs in `layout.slots`: the renderer positions the configured reusable speed, heel, wind, depth and surface widgets rather than reserving a boat-specific instrument slot. `surface-hud-instruments` is the public-safe 1540×720 example: a central 720px surface plus SOG, signed heel, apparent wind and depth. Its simulated fixture is not a chart or navigation display. The HUD remains presentation-only; source controls belong in the separate simulator.

Sources declare a capability ID. The catalogue distinguishes implemented browser simulation (`virtual-*`), local-file replay (`recorded-nmea-rmc`, `recorded-nmea-mwv`), and the explicitly unimplemented `nasa-marine-wind-candidate`. No physical adapter or discovery is present.

RMC replay provides recorded SOG. MWV replay accepts only `R` apparent-wind sentences in a timestamp envelope: `2026-...Z | $IIMWV,...*CS`. MWV lacks time itself, so unwrapped data is rejected; envelope time is original recorded observation time, while replay scheduling is synthetic playback time. Load `examples/synthetic-mwv.nmea` in the simulator. Change widget props, bindings, source capability IDs, and template slots/sizes in JSON, then validate and preview—no runtime LLM is involved.

## Boat-local installation examples

`examples/synthetic-sensor-groups.json` is intentionally separate from `config.json` so it does not change the legacy simulator, replay, Signal K or two-window HUD path. Its groups are boat/context-local installations, not display layouts. Channels carry typed observation/unit/frame semantics plus installation metadata (for example a depth datum and offset known/unknown). Templates use required and optional semantic inputs, sessions choose one template plus one installation, and compatibility is `available`, `partial`, or `incompatible`. Share generic templates and synthetic definitions; do not publish boat identity, calibration, locations, credentials or secrets by default.

Use `/?view=setup&sensorSession=heel-only-demo` to inspect the deterministic offline catalogue before launching a selected HUD. The setup route is the only selection surface; the HUD is presentation-only. Template preferences (such as heel degrees/radians/bands and wind/depth units) affect formatting only. They do not rewrite a provider’s declared unit, datum, calibration, observation provenance or reference frame.

For a real local installation definition without an editor, begin with `examples/local-boat-profile.example.json` and validate a copied local file with `node scripts/validate-boat-profile.mjs /path/to/boat-profile.json`. `npm run validate:config` also validates the committed privacy-safe example. This artifact shares the provider/channel/group contract used by the synthetic catalogue; it has no runtime importer or hardware connection.
