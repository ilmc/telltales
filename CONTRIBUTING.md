# Contributing

Telltales welcomes outside observation, testing, criticism and ideas. The project is deliberately **AI-led with human direction and oversight**, so contributing may look different from a conventional project centred on externally authored patches.

The most useful contribution is evidence that helps the project build a better, more trustworthy sailing display.

## Good ways to contribute

Open or join a [GitHub issue](https://github.com/ilmc/telltales/issues) to:

- report a reproducible bug;
- describe a sailing or instrumentation problem worth solving;
- propose a feature or integration and explain the use case behind it;
- share browser, screen-size or hardware testing results;
- provide safe-to-share protocol/data samples or replay evidence;
- review a change and identify a technical, usability or domain problem;
- challenge an existing decision with concrete reasoning or counterevidence;
- point out inaccurate, ambiguous or overstated documentation.

For bugs, include the steps to reproduce, expected and observed behaviour, browser/OS where relevant, the template or mode you used, and screenshots or console errors when they materially help.

For source or protocol proposals, distinguish what you have actually observed from what you expect the device or protocol to do. Please remove credentials, private vessel data and other information you do not have authority to publish.

## About code contributions

Conventional human-authored implementation is not Telltales' intended primary development path. The project uses AI agents for most repository implementation and maintenance so that the development model itself remains explicit and testable.

You do not need to write code for an issue to be actionable. A strong problem statement, failing example, recording, protocol sample or review can be more useful than a patch.

If you already have a patch or prototype, you may share it. Treat it as a concrete proposal rather than an expectation that the exact diff will be merged. Maintainers may reproduce the behaviour, adapt the design, or reimplement the change through the AI-led workflow. This is about keeping one coherent engineering and review process, not about discounting human expertise.

Before investing substantial effort in a large implementation, opening an issue first is usually the most effective route.

## What happens to input

Maintainers and AI agents inspect contributions against the current repository, project purpose, existing contracts, tests and available real-world evidence. Useful input may result in a documentation correction, new test, implementation batch, design change, deferred experiment, or a reasoned decision not to proceed.

Evaluation is based on relevance, evidence, safety and maintainability rather than contributor status. There is no automatic roadmap commitment, merge promise or maintainer role attached to an accepted idea.

Questions and disagreements are welcome. If you think a decision is wrong, explain the failure mode or trade-off you see and provide evidence where possible. [GOVERNANCE.md](GOVERNANCE.md) describes final decision authority.

## Default change workflow

For ordinary repository changes, the default path is:

**tracked issue → issue-linked branch → implementation and validation → pull request → independent review → authorised merge → issue closure.**

A request that arrives in a maintainer conversation should not require the maintainer to repeat those mechanics. The implementing agent should first check whether a suitable issue already exists. If it does, use it. If the requested change is substantive and no suitable issue exists, create a concise public issue that captures the agreed problem, scope and acceptance evidence before implementation. Do not create a duplicate merely to satisfy process.

Branches should make the issue relationship obvious, for example `issue-42-short-description` or `fix/42-short-description`. Pull requests should link the governing issue with a closing keyword such as `Closes #42` when the PR is intended to complete it.

The PR should explain the rationale and scope, list the validation actually performed, call out risks or known gaps, and give a reviewer enough context to challenge the change. Use the repository pull-request template rather than treating a passing test suite as the review itself.

Review should be meaningfully independent of authorship. An agent that implemented a change must not present its own second pass as independent approval. Review may be performed by a human or by a genuinely separate reviewer when one is available; the project does not require a particular commercial review bot. If independent review is unavailable, leave that gap explicit rather than inventing it.

Merging is a consequential repository action. An authorised maintainer retains merge authority. An AI agent may execute a routine merge only when that authority has been explicitly delegated for the class of change and the required review and validation are complete. Architecture, governance, release, safety-significant, or otherwise material decisions require human authority.

## Engineering expectations

When evaluating or proposing a behavioural change, please keep the existing project contracts in mind:

- do not present simulated, replayed, stale, invalid or unsupported values as trusted live measurements;
- keep observation meaning and provenance explicit;
- preserve transport-independent widget behaviour where possible;
- prefer focused changes over speculative framework expansion;
- update documentation when supported behaviour changes;
- add or update automated coverage for behavioural changes.

The current validation commands are:

```sh
npm run validate:config
npm test
npx playwright install chromium
npm run test:browser
```

See [README.md](README.md) for the quick start, [WIDGETS.md](WIDGETS.md) for widget contracts, [CONFIGURATION.md](CONFIGURATION.md) for declarative configuration, and [SIGNALK.md](SIGNALK.md) for the optional Signal K route.

## Scope and safety

Telltales is experimental software and is not a navigation instrument. Do not describe unverified integrations, calibration or safety properties as established facts.

By participating publicly, only share material you have the right and authority to publish. The repository is MIT licensed; see [LICENSE](LICENSE).
