# iPhone inclination experiment — quickstart (Draft PR #30)

> **Not available on `main` yet.** These commands require the implementation branch `issue-17-iphone-heel-physical-slice` from [Draft PR #30](https://github.com/ilmc/telltales/pull/30). This document is a concise operational reference, **not** an acceptance claim or invitation to install experimental code on a navigation-critical system. The complete current runbook, certificate-trust precautions and physical evidence procedure remain on [the experiment branch](https://github.com/ilmc/telltales/blob/issue-17-iphone-heel-physical-slice/experiments/iphone-heel/README.md).

The experiment uses **phone-relative inclination**, not calibrated vessel heel. A trusted local network, macOS or Linux host, Node.js, make, OpenSSL, an existing authorised local Signal K server, and the Telltales observations plugin are prerequisites. The phone needs HTTPS certificate trust and explicit Safari motion permission.

## Initial setup (only once)

On the **PR #30 branch**, run:

```sh
make iphone-heel-setup
make iphone-heel-credentials-all
```

The setup reuses the local host identity, existing TLS certificate and running Signal K server when present. It must not reset Signal K or run a second instance. Provision the existing separate Signal K **readwrite producer** and **readonly viewer** logins and distinct plugin ingress token when prompted, **without sharing secrets in chat**. Credentials are stored in the private local file `$XDG_CONFIG_HOME/telltales/iphone-heel.json` (or `~/.config/telltales/iphone-heel.json`), restricted to the current Unix user. It is **not encrypted at rest**; use development-only accounts and keep it out of Git/backups/public screenshots.

The host's reusable public certificate `.local/certs/telltales-server.cer` must be transferred to and explicitly trusted by the iPhone via the detailed runbook; never transfer the private key. Verify certificate identity out of band rather than bypassing Safari warnings.

## Start, use, stop, restart

```sh
make iphone-heel-start
make iphone-heel-pairing-code  # Privately enter the current six digits on the phone
make iphone-heel-status
make iphone-heel-stop
make iphone-heel-start         # Repeat from any new Terminal
```

Use the phone HTTPS URL printed by the launcher. In Safari pair within five minutes, enable motion, level the supported mount and tap **Zero here**. The launcher opens a separate local HUD. The intended **token-free** HUD URL is:

```text
http://127.0.0.1:4173/?view=hud&template=sailing-hud&mode=signalk
```

The Signal K browser should expose `navigation.attitude.roll` in signed **radians** while active. The HUD should show an understandable heel magnitude and direction. Do **not** append Signal K JWTs to the URL. If pairing expires, stop/restart the experiment producer and enter the newly issued code. For a missing or expired saved credential, use the relevant `make iphone-heel-credentials-{producer|viewer|ingress}` command; do not repeat unrelated setup.

## Known physical findings / not accepted yet

The initial hands-on trial proved that real iPhone inclination reached Signal K and appeared on a separate HUD using a legacy JWT-bearing URL. The automatically launched, token-free HUD remained stuck waiting for data; the apparent heel graphic indicated the opposite side of the phone tilt, and the numeric widget showed signed negative angles. These remain **reported findings**, not demonstrated fixes. Do not copy the legacy JWT URL or expose it in any evidence.

Acceptance still requires a working token-free HUD, documented mount orientation, approximate port/starboard ±10°/30°/60° checks, freshness/staleness/reconnection and an actual stop → new-Terminal restart on physical devices. Record anonymised observations in the [experiment evidence template](https://github.com/ilmc/telltales/blob/issue-17-iphone-heel-physical-slice/experiments/iphone-heel/EVIDENCE-TEMPLATE.md). Physical testing does not make this certified navigation equipment.
