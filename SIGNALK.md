# Signal K development route

Telltales has two selectable transports. Direct is the default and retains the browser-only `BroadcastChannel` route; it needs no Signal K installation. Signal K mode is selected with `?mode=signalk` on both simulator and HUD. The simulator posts observations to the local plugin endpoint, the plugin calls the supported Signal K server `app.handleMessage()` API, and the HUD subscribes to the server stream. Widgets remain unaware of transport.

## Start locally

Use the official Signal K server image pinned by digest in `docker-compose.signalk.yml` (`docker compose -f docker-compose.signalk.yml up`) or install `signalk-plugin-telltales-observations` from this repository in a local Signal K server's plugin directory. Enable the plugin in the Signal K admin UI and set a long random `token`. The compose file explicitly binds `127.0.0.1:3000` only; do not change that binding or expose this endpoint on an untrusted network.

Open the simulator with `?view=simulator&mode=signalk&signalkToken=YOUR_TOKEN`, then the full HUD with `?view=hud&template=sailing-hud-full&mode=signalk`. An alternate endpoint can be explicitly supplied as `signalkEndpoint`; the stream defaults to `/signalk/v1/stream?subscribe=none` on that host. Tokens are deliberately not persisted. The simulator engineering page identifies the selected route; the fullscreen HUD contains no setup controls.

The plugin accepts only `POST /plugins/telltales-observations/observations` from an authenticated Signal K `readwrite` identity, with the plugin's configured Bearer token and CORS restricted to the local development origin. It is not a Signal K PUT endpoint and does not accept arbitrary WebSocket JSON.

## Mapping

| Telltales observation | Signal K path | Signal K unit |
| --- | --- | --- |
| SOG | `navigation.speedOverGround` | m/s |
| STW | `navigation.speedThroughWater` | m/s |
| apparent wind speed | `environment.wind.speedApparent` | m/s |
| apparent wind angle | `environment.wind.angleApparent` | radians |
| heel | `navigation.attitude.roll` | radians |
| depth | `environment.depth.telltalesUnknownReference` | metres |

Angles are bow-relative: zero ahead, negative port, positive starboard. Signal K's relative angular convention is radians with positive starboard/clockwise, so no sign inversion is applied. There is no standard Signal K depth path for an unknown datum; the explicit Telltales extension prevents falsely asserting surface, transducer, or keel reference.

Each delta carries the original observation timestamp, a `telltales:<sourceId>` source label, and an adjacent `telltales.observationMeta.*` extension containing validity, simulated/replay state and provenance. Thus simulation remains labelled simulation after the round trip. External values without this metadata are labelled external Signal K observations. Malformed, stale, and out-of-order values are rejected; invalid values clear the HUD rather than retaining a prior reading. Signal K server disconnects mark every HUD reading unavailable.

Replay publishes its original observation timestamps and provenance. Seeking backwards emits invalidation/current state through the same route; a server-side historical cache may still need clearing when experimenting with old recordings. Physical sources may later publish their own standard Signal K paths and replace this simulator plugin; no hardware, SeaTalk, actuator, or cloud path is included.
