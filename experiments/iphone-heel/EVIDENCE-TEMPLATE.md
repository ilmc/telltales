<!-- experiments/iphone-heel/EVIDENCE-TEMPLATE.md -->

# iPhone heel physical experiment evidence

Copy this file outside the repository for each physical run. Remove vessel, location, LAN-address, credential, certificate-key, and other identifying details before sharing any sanitized result. This records an experiment; it does not certify navigation use or calibrated vessel heel.

## Run identity and setup

| Field                                                  | Record                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| Date/time and operator                                 |                                                            |
| Telltales commit                                       |                                                            |
| iPhone model, iOS, Safari                              |                                                            |
| Mac/browser and separate HUD screen                    |                                                            |
| Signal K/server-plugin version                         |                                                            |
| Trusted LAN class (no address)                         |                                                            |
| Certificate installed and full trust enabled           | Pass / Fail                                                |
| Phone mount description                                |                                                            |
| Sensor method actually reported                        | `devicemotion gravity` / beta-gamma fallback / unavailable |
| Calibration/reference state                            | `manual-zero` / not calibrated / other                     |
| Source observation versus server receipt time observed |                                                            |

## Preconditions

| Check               | Expected                                                 | Observed | Pass / Fail | Notes |
| ------------------- | -------------------------------------------------------- | -------- | ----------- | ----- |
| Paired HTTPS/WSS    | One trusted paired phone                                 |          |             |       |
| Signal K provenance | Phone source, method, calibration and both times present |          |             |       |
| Separate HUD        | Signal K mode on a different screen                      |          |             |       |
| Signal K value      | `navigation.attitude.roll` is radians                    |          |             |       |
| Fresh zero          | Zero accepted from a fresh supported event               |          |             |       |

## Signed tilt observations

Angles are approximate references, not calibration standards. Record the phone-relative expected direction and independent HUD/Signal K reports.

| Target | Expected sign | HUD degrees observed | Signal K radians observed | Fresh/LIVE | Pass / Fail | Notes |
| --- | --- | --- | --- | --- | --- |
| 10° port | negative | | | | | |
| 30° port | negative | | | | | |
| 60° port | negative | | | | | |
| 10° starboard | positive | | | | | |
| 30° starboard | positive | | | | | |
| 60° starboard | positive | | | | | |

## Failure and recovery behaviour

| Scenario                                                 | Expected                                                        | Observed | Pass / Fail | Notes |
| -------------------------------------------------------- | --------------------------------------------------------------- | -------- | ----------- | ----- |
| Stationary supported angle past freshness threshold      | Remains LIVE while fresh events continue                        |          |             |       |
| Permission denied/absent API                             | Clearly unavailable; no invented reading                        |          |             |       |
| Invalid mount / edge-on / over-range                     | Invalid or unavailable; old value not retained                  |          |             |       |
| Safari background/silence                                | Becomes unavailable after stale threshold                       |          |             |       |
| Wi-Fi interruption                                       | Becomes unavailable; no retained live value                     |          |             |       |
| Wi-Fi reconnect                                          | New valid source reading recovers                               |          |             |       |
| Producer disconnect/restart                              | Becomes unavailable; pairing lifecycle explicit                 |          |             |       |
| Failed invalidation then recovery (automated regression) | Recovered valid value is not clobbered by old unavailable state |          |             |       |

## Outcome and limitations

- Overall physical result: Pass / Fail / Inconclusive
- Automation run(s) and result (not physical acceptance):
- Known limitations, failures, and deviations:
- Sensor/mount/provenance uncertainty:
- Sanitized evidence retained (no credentials or identifying traces):
- Follow-up required before any reuse or safety claim:
