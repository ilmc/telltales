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

## Initial upstream implementation slice

`src/iphone-heel-orientation.mjs` migrates the isolated, dependency-free
calibration/measurement kernel and tests. It supports only the documented
face-up portrait mounting orientation. It does not transmit phone readings,
request browser permissions, serve HTTPS, or constitute a finished demo.
The original Boat Optimist launcher remains the **only runnable two-screen
prototype** until a reviewed Telltales integration replaces it.

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
