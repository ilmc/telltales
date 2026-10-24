# Engineering quality and AI succession baseline

**Assessed:** 2026-10-24. **Tracking issue:** [#20](https://github.com/ilmc/telltales/issues/20). **Status:** review observations and recommendations; not a completed comprehensive audit or accepted remediation.

## Why retain this

Telltales intends to be maintainable by a capable new AI engineering agent without prior chat history, particular model access, private undertaking records, or dependence on its original author. A successor must be able to **test and challenge** established behaviour, not merely paraphrase the code and docs. This file records the baseline so subsequent reviews measure changes rather than repeat the discovery process.

## Scope and confidence

Examined public README, AGENTS, CONTRIBUTING, GOVERNANCE, package and Makefile scripts, configuration, Signal K and sensor-group documentation, `src/app.mjs` excerpt and `test/signalk-e2e.mjs`. The review did **not** perform full source audit, run tests, penetration testing, physical vessel validation or a new-model succession exercise. Assertions below are either directly inspected facts or explicitly labelled risks/hypotheses.

## What already works well

- Browser-native ES modules, minimal dependencies, Node development server and test runner; no heavyweight runtime framework.
- Source-independent observation/renderer intent, explicit source/provenance, invalid/stale handling, replay and optional Signal K transport.
- Node contracts, Playwright browser suite and disposable real Signal K end-to-end path, separated from routine PR checks.
- Public entry points and issue → branch → PR → independent review → authorised merge process.
- Safety caveat: experimental display, not trusted navigation equipment.

Retain this stack unless evidence from a concrete feature warrants a change; avoid speculative frameworks or wholesale TypeScript migration.

## Integration status (24 October 2026)

The original findings below are dated baseline observations, not a live claim that every fault persists. The integrated acceptance candidate (PR #29) adds dynamic ports, cleanup failure aggregation, bounded application shutdown, and formatter/lint enforcement. Codex reported the Node/browser/real Signal K suites passing, while GitHub Actions independently confirmed core/browser success on commit `9dc497ead088e27a4a4cd05ebabb54e6746ceb00`. This is **candidate evidence** pending independent acceptance and final-head validation, not a finding closed on `main`. Credential exposure remains open as Issue #27. See Issue #20 for exact evidence and later status transitions.

## Prioritised findings (original baseline; revisit with evidence)

| Priority | Finding and evidence                                                                                                                                                                          | Proposed correction                                                                                                                                                 | Completion evidence                                                                                                                              |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| High     | URL query credentials documented in `SIGNALK.md`; `test/signalk-e2e.mjs` puts Signal K and ingress tokens in a query string. This can expose credentials to URL history, logs or screenshots. | Replace token-bearing URLs with a local, scoped credential mechanism; define lifetime and threat assumptions.                                                       | Tests show operation without tokens in URL/history/export and verify authorization still fails closed.                                           |
| High     | `test/signalk-e2e.mjs` assigns a free port to Signal K but hardcodes web app port 4173; asynchronous cleanup failure is printed rather than failing verification.                             | Dynamic port and teardown checks for both services; reduce avoidable races and repeated waits.                                                                      | Parallel/repeated runs behave predictably and identify leaks/cleanup failures; no requirement for e2e on every push/PR.                          |
| Medium   | README and feature-specific docs differ in recency and scope; `SENSOR-GROUPS.md` includes fixture-specific limits and provisional PR text.                                                    | Clearly scope feature documentation and establish an authoritative capability inventory.                                                                            | Links and supported/unsupported claims verified against current code.                                                                            |
| Medium   | Several paths coexist: legacy simulator/replay, Signal K, sensor groups, private setup and surfaces. Their canonical interfaces can become ambiguous over time.                               | Short `ARCHITECTURE.md` plus contracts and tests for observation identity, units, reference frames, timestamps, invalidity, provenance, privacy and boat isolation. | A new contributor maps each claim to source and an executable test; no speculative rewrite.                                                      |
| Medium   | Very long and densely packed JS lines observed in `src/app.mjs`; hard to review in GitHub or local editors.                                                                                   | Evaluate Prettier (consistent line wrapping) and targeted ESLint rules, introduce format check, perform mechanical formatting in separate PR(s).                    | Stable formatting/check scripts, no behaviour changes, minimal avoidable blame/diff churn.                                                       |
| Medium   | Model succession is documented as an aspiration, not yet experimentally demonstrated.                                                                                                         | Run a cold-start handover using only public repo + governing issue.                                                                                                 | New model independently explains architecture, runs checks, finds seeded fault, changes code, gets independent PR critique and records evidence. |

## Format-policy hypothesis

GitHub supports long lines but its line-oriented diffs and inline comments become less precise. Language models can parse dense code, but token/context usage, exact line references and edit targeting suffer; do not claim line-length directly determines model correctness. Prefer consistent readable formatting over an arbitrary rigid character cap. Consider Prettier print width near 100 and ESLint for genuine defects; verify actual formatter behaviour before imposing CI requirements. Separate purely mechanical formatting from functional changes to preserve review quality. Use `.git-blame-ignore-revs` only if a dedicated reformat commit genuinely warrants it.

## Source readability, structure and commentary (proposed; tracked in #23)

- Prefer cohesive modules with explicit responsibility and names that communicate behaviour; splitting a module must follow a semantic boundary, not a raw line-count quota.
- Treat each meaningful maintained source subdirectory as a self-orienting subproject: a local `README.md` primarily explains **why** that subsystem exists, its boundaries, design choices, constraints, invariants and trade-offs; give concise entry-point, interface and test pointers only to help readers find the **what** in the code, not to duplicate its contents. Link upward to the repository root rather than duplicating policy. Trivial asset-only, generated/vendor, and incidental directories may link from a parent README instead; do not proliferate stale boilerplate.
- For hand-maintained text files whose grammar supports comments, start with a short, exact repository-relative project path/name identifier (for example `// src/app.mjs` or `# Makefile`). Keep it current after moves. Required shebangs, parsers, strict JSON, generated/vendor/binary files and formats whose leading content has mandated semantics take precedence; never invalidate a file solely to add the label.
- Use consistent automatic formatting for human and AI review, avoiding compressed multi-statement lines. Formatter print width is a wrapping preference, not an absolute guarantee that every string or token fits.
- Module-header comments should be brief and selective: state purpose, unusual dependencies, external contract or security/safety assumptions when those would not be clear from the filename and exports. Avoid repetitive boilerplate.
- Comments should explain **why** a decision exists, trust/failure boundaries, invariants, units, frames, temporal semantics and subtle asynchronous lifecycle cases. Do not narrate obvious syntax or keep stale explanations.
- Cross-module invariants and their tests belong in maintained public contract/architecture documentation; implementation-adjacent comments should identify the tricky local details.
- Linting detects errors and hazardous patterns; formatting standardizes layout. Distinct mechanical reformat commits protect reviewability and blame history.
- These guidelines are a review proposal until separately accepted and enforced; preserve the distinction between policy, implementation and verified adoption.

## Succession test protocol

1. Select an unfamiliar LLM and provide only public repository access plus one self-contained issue.
2. Ask it to explain architecture, invariants, source of truth and unknowns; compare against executable contracts.
3. Have it install dependencies and run documented Node, browser and (where available) optional real Signal K tests; never turn unavailable tests into passes.
4. Provide a safe intentionally seeded defect in a controlled branch or fixture; assess diagnosis, repair and regression coverage.
5. Require an issue-linked PR and meaningful independent review anchored to the actual diff/commit.
6. Record model/version, repository SHA, tool access, observed success/failure, remediation and whether failure stems from model capability, docs, contracts or missing tests. Do not mistake agreement between two similar models for independent evidence.

## First Codex handover observation (2026-10-24)

This was a public-record handover, not the controlled cold-start experiment above. A successor Codex session used the repository guidance, Issue #20 and the live PR records to reconstruct the quality batch. It found the current PR heads rather than relying on previously reported SHAs; checked their CI, reviews and diffs; and made a temporary integration of #21, #24, #25, #26 and #28.

Observed successes are limited but useful: it identified that #24's dynamic-app-port and cleanup changes must survive the #28 formatter merge; retained those changes while applying the formatter; verified that the #28 mechanical JavaScript changes preserve parsed structure apart from a removed inert empty statement and equivalent property-key spelling; and ran the #28-head format, lint, configuration, Node (41) and Chromium (20) checks locally. The combined tree exposed a real missing acceptance condition: the new Markdown in #21, #25 and #26 was not formatted, so #28's `format:check` failed after integration. Those heads require formatter corrections and fresh review/check evidence.

The handover also exposed limitations. The real Signal K E2E process and its disposable container completed twice, but the available terminal wrapper did not retain the final exit status; that is lifecycle evidence, not a recorded successful E2E result. The available GitHub CLI credential was invalid and no API token was available, so the successor could read Issue #20 but could not post the final checkpoint there. These are tool/access and evidence-capture problems, not proof of model failure; future portability trials should require a working issue-comment credential and an exit-status-preserving test harness before acceptance.

The model/version identity of the prior Codex session was not recorded in the public repository, so this record does not infer it. The exercise demonstrates that public orientation material can support useful continuation and integration diagnosis, but it does not demonstrate independent architecture reconstruction, seeded-defect repair, independent review, safety suitability or autonomous merge authority. Complete the controlled protocol before making any stronger portability claim.

## Revisit triggers

Review this baseline when credentials/network exposure change, external sensors or multi-vessel sharing are added, navigation/safety claims increase, test failures reveal contract gaps, a new model is trialled, or substantial new architecture is proposed. On review, annotate findings as **open**, **verified fixed** (with commit and test), **accepted risk** (with owner/rationale), or **superseded**. Do not re-run the entire broad assessment without a reason.

## Governance boundaries

This is a public engineering record. Do not copy private management files, customer vessel evidence, real calibrations, identities or access credentials here. Independent AI reviews and CI are evidence, not release or safety certification; consequential actions remain under authorised maintainer control.
