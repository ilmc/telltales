<!-- experiments/iphone-heel/README.md -->

# iPhone heel: physical sensor experiment (Issue #17)

This is a **generic Telltales** experiment. A phone is a temporary instrument source,
not a calibrated vessel sensor. No boat, private network, club or location data belongs here.

## Earlier evidence and current baseline

The first working producer, transport and Signal K consumer were developed in
[Boat Optimist draft PR #17](https://github.com/ilmc/boat-optimist/pull/17).
During the owner's hotel-Wi-Fi physical trial, real iPhone and Mac screens
exchanged observations. The original gamma-offset heuristic under-read and
flipped sign at larger angles; the vector revision initially failed to zero
because Safari did not supply accelerationIncludingGravity. A beta/gamma
fallback was added **after** that trial and has not yet passed physical validation.

Current Telltales main already supports an explicit, authorised Signal K ingress,
`navigation.attitude.roll` in radians, fail-closed invalidation, and a reusable
heel presentation. Do not duplicate its widget/measurement/Signal K contracts.

## Run the two-screen experiment

Start a local Signal K server and enable this repository's
`telltales-observations` plugin as described in [`SIGNALK.md`](../../SIGNALK.md).
Create a `readwrite` Signal K token and configure the plugin's distinct ingress
token. Find the Mac's LAN IP, then run:

```sh
sh experiments/iphone-heel/certificate.sh MAC_LAN_IP .local/iphone-heel-cert
IPHONE_HEEL_PAIRING_CODE='new-8-or-more-character-code' SIGNALK_TOKEN='readwrite-token' SIGNALK_INGRESS_TOKEN='plugin-ingress-token' npm run iphone-heel
```

On iPhone, visit `https://MAC_LAN_IP:8443/certificate.cer`, install it and enable
full certificate trust in iOS Settings. Then open `https://MAC_LAN_IP:8443/`, pair,
choose **Enable Motion**, hold the mount level, and choose **Zero here**. On the
Mac, separately run `npm start` and open:

```text
http://localhost:4173/?view=hud&template=sailing-hud&mode=signalk&signalkToken=READONLY_OR_READWRITE_TOKEN
```

The phone uses paired HTTPS/WSS; its secrets never enter a URL. The existing HUD
subscribes to `navigation.attitude.roll`, so this is a real Signal K route rather
than a mirrored preview. One paired phone is accepted; values outside ±85°, socket
loss and a three-second silent/backgrounded source publish unavailable.

## Implementation slice

`src/iphone-heel-orientation.mjs` is the isolated calibration/measurement kernel.
The local producer above adapts it to the current authenticated Signal K ingress;
it does not add an instrument framework or another Signal K path.

Run `npm test` to include the kernel regression checks. This is software-only
evidence and cannot establish physical acceptance.

## Physical acceptance still required

On the owner's iPhone in foreground Safari, obtain motion permission after a
gesture on a trusted HTTPS origin. Report which source is actually available:
motion gravity or orientation fallback. With the supported mounting position,
press Zero, then physically tilt left and right at approximately 10°, 30°, 60°.
Confirm direction and scaling on a **separate** Telltales HUD screen using
the current authenticated Signal K observation/consumer path; independently
inspect `navigation.attitude.roll` (radians).

Record denied permission, unavailable sensors, invalid mounting, background,
Wi-Fi interruption/reconnect, and loss/stale state. Neither mirroring, local
preview, synthetic injection nor automated browser tests complete physical
acceptance. Keep credentials and identifying traces out of public evidence.

Next implementation batch: adapt the proven Boat Optimist HTTPS/WSS producer
and launcher behind a Telltales-specific temporary experiment entry point,
taking care to reuse current Signal K security and sensor provenance rather
than transplanting legacy display code.
