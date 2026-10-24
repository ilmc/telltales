# Signal K development route

Telltales has two selectable transports. Direct is the default and retains the browser-only `BroadcastChannel` route; it needs no Signal K installation. Signal K mode is selected with `?mode=signalk` on both simulator and HUD. The simulator posts observations to the local plugin endpoint, the plugin calls the supported Signal K server `app.handleMessage()` API, and the HUD subscribes to the server stream. Widgets remain unaware of transport.

## Start locally

Use the official Signal K server image pinned by digest in `docker-compose.signalk.yml` (`docker compose -f docker-compose.signalk.yml up -d`) or install `signalk-plugin-telltales-observations` from this repository in a local Signal K server's plugin directory. The repository Compose service bind-mounts the development plugin at the server's scanned application `node_modules` path. This matters because Signal K discovers packages with the `signalk-node-server-plugin` keyword only while building its startup plugin registry: a package merely present in a persistent config-volume `node_modules` directory is not proof that a currently running server discovered it.

For a cold start, first confirm that no other local Signal K instance owns port 3000, then run the Compose command above. Wait for `http://127.0.0.1:3000/signalk/v1/api/vessels/self` to answer, create the administrator through Signal K's normal first-run flow, and sign in at `http://127.0.0.1:3000/admin/`. In **Server → Plugins**, verify **Telltales observations** is present and enabled; this plugin is enabled by package default but rejects ingress until its own secret is set. Generate a long random ingress `token` there, then create separate Signal K `readwrite` and `readonly` identities as needed. Keep the server loopback-bound. Do not create a second container on another port to work around a missing plugin: inspect the running server's plugin list and its startup lifecycle instead.

`make iphone-heel-setup TELLTALES_SERVER_HOST=…` deliberately does not start, stop, reconfigure, or reset Signal K. It reports whether the normal local endpoint is already responding and prints the next safe step. It is safe to use before every physical run; it never reads or writes Signal K credentials.

Open the simulator with `?view=simulator&mode=signalk&signalkToken=SIGNALK_READWRITE_TOKEN&signalkIngressToken=PLUGIN_INGRESS_TOKEN`, then the full HUD with `?view=hud&template=sailing-hud-full&mode=signalk`. The two tokens are distinct: the first is the Signal K identity and the second is the plugin's configured local ingress secret. An alternate endpoint can be explicitly supplied as `signalkEndpoint`; the stream defaults to `/signalk/v1/stream?subscribe=none` on that host. Tokens are deliberately not persisted. The simulator engineering page identifies the selected route; the fullscreen HUD contains no setup controls.

The plugin accepts only `POST /plugins/telltales-observations/observations` from an authenticated Signal K `readwrite` identity, plus its configured bearer token in `X-Telltales-Ingress-Token`. It is not a Signal K PUT endpoint and does not accept arbitrary WebSocket JSON. Signal K's server-level CORS middleware answers browser preflight; its CORS policy is deployment configuration, not an authorization control. The POST remains protected by Signal K authorization and the ingress-token check.

## Mapping

| Telltales observation | Signal K path                                 | Signal K unit |
| --------------------- | --------------------------------------------- | ------------- |
| SOG                   | `navigation.speedOverGround`                  | m/s           |
| STW                   | `navigation.speedThroughWater`                | m/s           |
| apparent wind speed   | `environment.wind.speedApparent`              | m/s           |
| apparent wind angle   | `environment.wind.angleApparent`              | radians       |
| heel                  | `navigation.attitude.roll`                    | radians       |
| depth                 | `environment.depth.telltalesUnknownReference` | metres        |

Angles are bow-relative: zero ahead, negative port, positive starboard. Signal K's relative angular convention is radians with positive starboard/clockwise, so no sign inversion is applied. There is no standard Signal K depth path for an unknown datum; the explicit Telltales extension prevents falsely asserting surface, transducer, or keel reference.

Each delta carries the original observation timestamp, a `telltales:<sourceId>` source label, and an adjacent `telltales.observationMeta.*` extension containing validity, simulated/replay state and provenance. Thus simulation remains labelled simulation after the round trip. External values without this metadata are labelled external Signal K observations. The HUD subscribes as `vessels.self`; it accepts only that alias or the concrete self-vessel context announced by the server, and rejects every foreign-vessel context. Malformed, stale, and out-of-order values are rejected; either a native `null` or invalid metadata clears the HUD rather than retaining a prior reading. Signal K server disconnects mark every HUD reading unavailable.

## Real-server integration check

With Docker and Chromium installed, run:

```sh
npm run test:signalk:e2e
```

The test is self-contained: it picks a free loopback port, starts the pinned image, verifies through the authenticated `/skServer/plugins` administration API that the running server discovered and enabled Telltales observations, provisions temporary admin, `readwrite`, and `readonly` users through Signal K’s supported security endpoints, logs in through `/signalk/v1/auth/login`, configures a distinct plugin token, and tears down users, containers, volumes, and generated credentials. It proves real `readwrite` publication, authorization/token rejections, signed heel conversion and display, explicit invalidation, stale-data expiry, and self-vessel isolation. It does not contact an external Signal K server or use vessel data.

Replay publishes its original observation timestamps and provenance. Seeking backwards emits invalidation/current state through the same route; a server-side historical cache may still need clearing when experimenting with old recordings. Physical sources may later publish their own standard Signal K paths and replace this simulator plugin; no hardware, SeaTalk, actuator, or cloud path is included.
