# Synthetic boat installations (Issue #8 contract slice)

`examples/synthetic-sensor-groups.json` is a local, synthetic contract fixture—not a network adapter or claim of live boat hardware. It separates three things:

- A provider channel is a boat/context-local installation: typed observation, unit, reference frame and installation metadata. Depth must state `transducer`, `keel`, `waterline`, or explicit `unknown`; offsets/calibration are never invented.
- A reusable template declares required and optional semantic inputs. It does not name a provider, model, complete boat inventory or transport.
- A session picks one installation group and one template. It makes deterministic bindings in declared candidate order and retains producer, frame, timestamp, validity and installation metadata.

`evaluateTemplate` returns `available` only when every declared input is compatible, `partial` when at least one required input is compatible but another required **or optional** input is missing, and `incompatible` when no required input is compatible. Extra channels are ignored. This makes an optional missing dial visible without blocking a usable template. A non-existent compatible channel is `No compatible sensor source`; an installed channel with no fresh valid reading is `Installed sensor unavailable or stale`. Those states must not be conflated.

The fixture’s heel-only sessions use exactly the same semantic heel binding while their template preferences render degrees, radians, or configurable `flat` / `little` / `lots to port/starboard` labels. Thresholds must be ordered `0 ≤ flat < little < lots ≤ 90`; beyond `lots`, the formatter falls back to an explicit signed-degree direction rather than silently applying a category outside its configured range. Wind supports knot/metres-per-second display conversion and depth supports metres/feet conversion, but a conversion never changes a depth datum: an unknown datum remains unknown, not keel or waterline depth. An other-vessel or fixed-site wind channel cannot bind an own-vessel apparent-wind input.

`/?view=hud&sensorSession=heel-demo` mounts a presentation-only synthetic HUD with no setup controls. `sensor-groups-demo.html?session=heel-demo&harness=true` is the separate engineering harness for dispatching fixture readings and simulating feed loss. Community examples may share reusable templates and non-identifying synthetic definitions; boat identity, locations, calibrations and secrets must remain local by default.

## Current limitations

No live networking, discovery, authentication, physical adapter, remote upload, geospatial transform, true-wind calculation, chart integration, or navigation capability is implemented. The legacy simulator, replay, BroadcastChannel, Signal K and two-window HUD route stay separate and unchanged. Keep the PR draft until independently reviewed and authorised for merge.
