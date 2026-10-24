<!-- experiments/iphone-heel/README.md -->

# iPhone heel: physical sensor experiment (Issue #17)

This is a temporary local experiment in publishing **phone-relative inclination** to the existing Telltales Signal K route. It is not a calibrated vessel-heel instrument, navigation equipment, a phone integration product, or evidence of a supported boat installation. A passing automated run or a visible phone preview does not complete physical acceptance.

The phone and its temporary producer carry no boat identity, location, route, or cloud service. The source is one paired foreground iPhone over local HTTPS/WSS; the existing Telltales HUD is a separate Signal K consumer. This preserves the repository's source/transport/presentation boundaries rather than adding a second display path.

## What this needs

Use a fresh checkout on a Mac with Node.js/npm, OpenSSL, `make`, macOS Keychain, and a current Safari-capable iPhone. The Mac and iPhone must be on the same trusted LAN; do not attempt this over a public, hotel, or guest network. The Mac needs a local Signal K server with the `telltales-observations` plugin enabled. Follow [SIGNALK.md](../../SIGNALK.md) to keep the server bound to loopback: the phone producer reaches only the Mac's HTTPS port, while the producer talks to Signal K on its local loopback endpoint.

## Repeatable local workflow

Run `make iphone-heel-setup` once. The small wizard reuses a previously saved LAN host, or detects the only suitable Mac LAN address; if several addresses are available, choose explicitly with `make iphone-heel-setup TELLTALES_SERVER_HOST=…`. It records only that host and loopback Signal K endpoints in ignored, mode-600 `.local/iphone-heel.json`; it rechecks the existing certificate, Signal K reachability, and port 4173 without stopping or altering any service.

Run `make iphone-heel-credentials` only for first provisioning or after a Signal K credential is revoked or expires. It asks without echoing and stores the separate readwrite, plugin-ingress, and readonly credentials in macOS Keychain. They are never stored in `.local`, environment setup files, URLs, or shell history. The one-command normal path from any new Terminal is then `make iphone-heel`, followed by `make iphone-heel-hud` on the HUD screen. The HUD URL is printed without a token: its loopback server reads the readonly token from Keychain and proxies only the Signal K stream to the same-origin browser.

`make iphone-heel-pairing-code` privately prints the active six-digit code from Keychain while the producer is running. `make iphone-heel-status` reports saved setup, port reachability, and recorded experiment-owned processes; `make iphone-heel-stop` sends SIGTERM only to processes started by these launchers. A process occupying port 4173 but not recorded as experiment-owned is left untouched and produces a clear diagnostic rather than an `EADDRINUSE` crash. These commands do not create, reset, stop, or weaken Signal K.

Before starting, arrange three separate credentials:

- a Signal K **readwrite** token, used only by the producer to post observations;
- the plugin's distinct ingress bearer token, used only by the producer;
- a Signal K **readonly** token only if the separate HUD's stream requires one.

Do not put tokens in a repository file, shell history, screenshot, chat, or public URL. Supply the first two only in the producer terminal using a protected shell mechanism. For example, `read -rs SIGNALK_TOKEN` followed by `export SIGNALK_TOKEN` avoids displaying it; repeat for `SIGNALK_INGRESS_TOKEN`. Do not use shell `set -x`.

## First-time preparation

1. Install dependencies and Chromium when browser/E2E checks are needed:

   ```sh
   npm ci
   npx playwright install chromium
   ```

2. Prepare the existing local Signal K server before launching the phone producer. Run `make iphone-heel-setup TELLTALES_SERVER_HOST=YOUR_MAC_LAN_HOST`; it prepares/reuses only the Telltales TLS identity and reports whether Signal K is already responding at its normal loopback endpoint. It never starts, stops, resets, changes ports, or changes credentials on Signal K. When no Signal K server is present, first confirm no other development instance is in use, then start the repository's pinned Compose service with `docker compose -f docker-compose.signalk.yml up -d`.

   On a cold repository Compose start, complete Signal K's normal administrator setup at `http://127.0.0.1:3000/admin/`, then go to **Server → Plugins**. Verify **Telltales observations** is listed and enabled before configuring it. Generate a long random, distinct plugin ingress token, save it in the plugin configuration, and create the distinct Signal K roles above. The plugin remains fail-closed until that token is configured. Do not change the documented Docker loopback binding to a LAN binding, and do not launch another Signal K container on a different port. If the plugin is not listed, stop: use the plugin-list/startup diagnosis in [SIGNALK.md](../../SIGNALK.md), not an unauthenticated or second-server workaround.

3. Choose the stable Mac host identity that Safari will use. A trusted-LAN IP from `ipconfig getifaddr en0` is suitable for typical Wi-Fi; an opt-in stable local DNS/mDNS name avoids re-trusting after an IP change only when Safari can resolve it and its certificate SAN exactly matches. Check it is not VPN, guest-network, or public. Prepare or reuse the local Telltales server identity:

   ```sh
   # Replace with the actual trusted-LAN IP or resolvable local DNS name.
   make iphone-heel-setup TELLTALES_SERVER_HOST=YOUR_MAC_LAN_HOST
   ```

   `192.0.2.10`, used in examples elsewhere, is documentation-only TEST-NET space and is not a usable Mac address.

   `make local-server-cert` is also available for another explicitly authorised Telltales local HTTPS service. It stores the ignored server private key and certificate as `.local/certs/telltales-server.{key,crt,cer}` with restrictive permissions. It reuses the certificate only when it is valid for at least seven days and its SAN matches the selected host; it otherwise refuses replacement unless the operator deliberately runs `TELLTALES_SERVER_CERT_ROTATE=1 make local-server-cert TELLTALES_SERVER_HOST=…`. Rotation, expiry, or a changed host/IP requires client trust action again. The certificate is valid for 90 days, not permanently trusted or portable. The private key stays on this server and is never a phone credential.

   `make iphone-heel` generates a new cryptographically random **six-digit numeric pairing code** for that launch and stores it only in macOS Keychain. Run `make iphone-heel-pairing-code` privately when entering it on the phone; never copy it into logs, screenshots, shell history, chat, URLs, or evidence. The code is deliberately short for in-person entry, so it expires after five minutes and has a strict five-failure limit both per source address and across the whole launch pairing session. One launch accepts one phone pairing; restart rather than repeatedly guessing or attempting a second phone. The resulting browser device credential remains a separate 256-bit random value, is `HttpOnly`/`Secure`/`SameSite=Strict`, expires after 12 hours, and is revoked on producer restart. TLS trust never authorizes pairing, motion permission, or a sensor experiment. Legacy `.local/iphone-heel-cert` material is not reused: inspect and remove it deliberately after confirming it is not needed, then use the generic server identity.

4. Bootstrap trust **before** opening the HTTPS producer; do not download the first certificate through an untrusted HTTPS warning. On the Mac, display the public certificate's SHA-256 fingerprint:

   ```sh
   openssl x509 -in .local/certs/telltales-server.crt -noout -fingerprint -sha256
   ```

   Transfer only `.local/certs/telltales-server.cer` to the iPhone through a local, authenticated out-of-band route such as AirDrop. Never transfer `.key`, the `.local/certs` directory, tokens, or pairing material. Independently compare the public certificate's subject, SAN, and SHA-256 fingerprint with the value displayed on the Mac—for example, with both devices physically present or via a separately authenticated channel, not the certificate-transfer channel. Install the received certificate/profile in iOS Settings, inspect its details, and enable full trust in **Settings → General → About → Certificate Trust Settings**. Menu labels vary by iOS release; if the installed-profile view cannot show enough certificate detail to make the comparison, stop and use an approved certificate viewer or managed installation route rather than bypassing browser security. iOS may warn because this is a local self-signed certificate.

## Launch the experiment

Use three terminals/screens so the phone, producer, and HUD remain independent.

1. In terminal A, safely set the producer-only tokens, then launch:

   ```sh
   read -rs SIGNALK_TOKEN; export SIGNALK_TOKEN; printf '\n'
   read -rs SIGNALK_INGRESS_TOKEN; export SIGNALK_INGRESS_TOKEN; printf '\n'
   make iphone-heel
   ```

   The producer reads its credentials and current pairing code from Keychain; it never prints Signal K tokens. The producer runs the temporary phone service on port 8443. Privately run `make iphone-heel-pairing-code` and enter that value into the iPhone page—do not pass it as a command argument, environment variable, URL, or copied terminal transcript. Restarting revokes browser credentials and creates a new code. Pairing expires after five minutes; five failed guesses from any combination of addresses close that launch's pairing ceremony, and only one phone can pair. The long random browser credential expires after 12 hours.

2. Complete certificate trust. In Safari open `https://TELLTALES_SERVER_HOST:8443/`, privately read and enter the pairing value, choose **Enable Motion** after the visible gesture, hold the supported mount level, and press **Zero here** only after fresh sensor input appears. Record the actual source method: `devicemotion gravity` when supplied, otherwise the beta/gamma orientation fallback. Neither is a calibration claim. Subsequent authorised Telltales experiments on the same unchanged host may reuse the trusted TLS identity; each still needs its own pairing/session/permission flow.

3. In terminal B run `make iphone-heel-hud`. On a different screen, open:

   ```text
   http://127.0.0.1:4173/?view=hud&template=sailing-hud&mode=signalk
   ```

   If the Signal K deployment requires a stream token, append a short-lived readonly `signalkToken` locally in the browser. Do not paste, save, screenshot, or share that URL: query strings are retained easily. The HUD is presentation-only.

4. Independently inspect Signal K `navigation.attitude.roll`. Telltales maps the phone source to degrees for its HUD and Signal K uses radians; metadata must identify `iphone-browser-motion`, method, calibration state, phone observation time, and server receipt time. A valid value is LIVE only while fresh phone observations continue.

Useful commands:

```sh
make help                 # repository and iPhone-heel commands
make iphone-heel-test     # orientation, auth, HTTPS/WSS lifecycle tests
make iphone-heel-e2e      # disposable Docker Signal K + Chromium test
```

`iphone-heel-e2e` proves the generic Signal K route using synthetic data; it neither starts a physical phone nor proves iPhone motion behaviour.

## Exact physical acceptance procedure

Perform this with a human observing the phone and a **different** HUD screen. Fill in [the evidence template](EVIDENCE-TEMPLATE.md), recording pass/fail rather than smoothing failures.

1. Record sanitized device/iOS/Safari versions, trusted-LAN class, mount orientation, Signal K version, source method, and two-screen URLs without secrets. Confirm foreground Safari and trusted HTTPS.
2. Grant motion permission through **Enable Motion**. Record denied or absent APIs as a failure/limitation; never substitute simulated data. Wait for a current event, level the supported face-up portrait mount, and press **Zero here** within one second. Record `manual-zero` status.
3. Tilt approximately **10°, 30°, and 60° port**, holding each to compare the separate HUD's signed degrees with `navigation.attitude.roll` radians. Repeat **10°, 30°, and 60° starboard**. Record expected and observed direction, approximate scale, freshness, and pass/fail. Do not claim precision beyond the reference used.
4. Hold a stationary supported angle beyond the HUD freshness threshold while Safari remains foregrounded. It must remain LIVE because phone events continue; record refresh and source timestamps.
5. Test: denied/absent permission, invalid/edge-on mount and over-range, Safari background/silence, Wi-Fi interruption, and Wi-Fi reconnection. Each invalid/disconnected/stale condition must become unavailable, and a new valid reading must recover without an old unavailable update overwriting it.
6. Stop the producer and confirm HUD unavailable, then stop HUD and Signal K. Record all failures and limitations. Automated results, local preview, synthetic injection, and same-screen mirroring are not substitutes for acceptance.

## Troubleshooting and cleanup

| Symptom                               | Check or safe response                                                                                                                                                            |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iPhone cannot open page               | Confirm trusted-LAN address/port, Mac firewall, and terminal A. Do not expose Signal K or disable security.                                                                       |
| Safari says connection is not private | Reinstall/trust the certificate and confirm it has a SAN for the exact selected LAN host/IP; deliberately rotate it after expiry or identity change.                              |
| Pairing fails                         | Check the five-minute window and privately type the six-digit code. Five failed guesses across the launch close pairing; restart to reset/revoke rather than guessing repeatedly. |
| Enable Motion fails                   | Permission needs the visible gesture and trusted HTTPS. Record denied/absent APIs; do not fake input.                                                                             |
| HUD has no heel                       | Check local Signal K/plugin status, token roles, ingress token, and Signal K path. Keep tokens out of diagnostics.                                                                |
| Heel becomes unavailable              | Check foreground state, Wi-Fi, fresh events, supported mount/range, and ingress. This fail-closed result must not be overridden.                                                  |

After stopping all processes, normal cleanup needs no certificate deletion: `make iphone-heel` removes its per-launch pairing file on exit, and independently managed Signal K tokens should be revoked if created solely for the run. Preserve `.local/certs` for later authorised experiments on the same unchanged host.

Only when retiring that host identity, after stopping every authorised local service that uses it, deliberately remove `.local/certs` and expect clients to need trust setup again. Keep sanitized evidence only. Never publish credentials, certificate keys, vessel identifiers, locations, network addresses, raw traces, screenshots containing tokens, or private physical records.
