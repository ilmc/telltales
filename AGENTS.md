# Telltales agent instructions

These instructions apply to the whole repository. Telltales is intentionally AI-led with human direction and oversight; agents are expected to carry routine engineering work through the public repository workflow without requiring the maintainer to restate each mechanical step.

## Before changing the repository

Read the current governing issue or agreed change, plus the relevant parts of [README.md](README.md), [CONTRIBUTING.md](CONTRIBUTING.md), [GOVERNANCE.md](GOVERNANCE.md), and any feature-specific documentation touched by the work. Inspect the current implementation and tests before choosing a solution.

Assess the request before coding. Challenge a proposed implementation when repository evidence shows a smaller or safer route, but do not silently weaken accepted requirements.

## Default workflow

For an ordinary substantive change:

1. Find the governing GitHub issue. If a conversational request has no suitable issue, search first and create one only when needed; do not create duplicates.
2. Branch from the current default branch using an issue-linked name.
3. Implement a coherent batch without unrelated changes.
4. Run validation appropriate to the claim. Preserve and report failures; do not convert an unrun or failed check into a success claim.
5. Open a pull request that links the issue (normally `Closes #N`) and records rationale, scope, validation/evidence, risks and reviewer notes.
6. Obtain review that is meaningfully independent of the author. The implementing agent must not represent its own review as independent approval.
7. Merge only with authorised merge authority and only after required review/checks are satisfied. Close the issue through the accepted PR when appropriate.

Use the repository pull-request template. Keep the workflow tool-agnostic: use available GitHub, local Git, CI or other capable tooling without making one commercial bot a dependency.

## Source readability and orientation

For hand-maintained commentable text files, put a concise repository-relative path identifier first (for example `// telltales/src/app.mjs`). Use the file's native comment syntax and update the identifier when moving the file. Do not violate required shebangs, parsers, mandated file headers, or strict data formats; generated, vendored and binary files are exempt.

Prefer readable, consistently formatted code, cohesive modules, explicit names and concise comments explaining *why*:
Treat meaningful source subdirectories as independently navigable subprojects: add a local `README.md` describing responsibility, entry points, dependencies, interfaces and relevant tests, and link back to root-level contracts. Avoid duplicate governance or boilerplate for tiny, generated, or asset-only folders.

Prefer readable, consistently formatted code, cohesive modules, explicit names and concise comments explaining *why*: contracts, units/reference frames, provenance, failure modes, trust boundaries, subtle lifecycle behaviour and trade-offs. Avoid obvious line-by-line narration and unnecessary boilerplate. The [engineering review](ENGINEERING-REVIEW.md) tracks the proposed formatter/linter rollout under [Issue #23](https://github.com/ilmc/telltales/issues/23); do not describe those tools as already enforced.

## Evidence and decisions

Match validation to the change. Behavioural changes need relevant automated coverage and, where the claim crosses a browser, transport, hardware or real-world boundary, evidence at that boundary. Documentation-only work should still verify commands, links and claims against the current repository.

State what is enforced by repository settings separately from what is merely documented. Do not claim branch protection, required reviews, required checks, or other gates unless the current repository actually enforces them.

Escalate for human authority when work would materially change architecture, governance, release policy, safety/navigation claims, external commitments, or other consequential project direction. Routine implementation and maintenance may proceed within delegated scope.

Do not publish private management records, private customer evidence, credentials or internal tooling into this public repository.
