<!-- test/README.md -->
# Tests — why the suites are separate

Telltales needs evidence at the boundary where a defect could harm interpretation, without making every small change pay for a full Docker-based integration environment. A passing pure-function test cannot prove browser wiring; a passing browser mock cannot prove real Signal K authentication or streaming.

## Strategy

- **Node contract tests** run quickly and challenge validation, conversions, state transitions and failure handling. Run with `make tests` (configuration validation plus `npm test`).
- **Playwright browser tests** challenge composition and visible behaviour in Chromium, including the separate simulator/HUD windows. Run with `npm run test:browser`; install the browser through `npx playwright install chromium` when necessary.
- **Real Signal K end-to-end tests** deliberately run on demand or scheduled CI rather than every ordinary PR. Their value is real authorization, HTTP, WebSocket, invalidation and stale-data behaviour. Run with `make end-to-end-tests` after installing Docker Compose and Playwright Chromium.

## Evidence discipline

A check that has not run must be reported as not run; a unit test is not evidence of on-boat suitability. Keep synthetic data identifiable, test missing/stale/out-of-order observations and unauthorized/foreign-vessel flows, and preserve cleanup failure details. If a new integration boundary is introduced, add evidence at that boundary rather than increasing the number of shallow assertions.

The test scripts and source files are the authority for exact coverage, fixtures and command behaviour. This README records why the layers exist, not an exhaustive list of individual cases. The engineering baseline is proposed in [PR #21](https://github.com/ilmc/telltales/pull/21), with follow-ups tracked in [Issue #20](https://github.com/ilmc/telltales/issues/20).
