# Main branch protection: setup and verification

This is the **operator checklist** for [Issue #4](https://github.com/ilmc/telltales/issues/4). It documents intended settings and a safe way to test them; **it is not evidence that any setting is currently enabled**. The GitHub integration used to prepare this document cannot change repository rulesets. A repository administrator must perform and independently verify the settings.

## Intended rules for `main`

In **Settings → Rules → Rulesets**, create an active branch ruleset targeting the repository's default branch (`main`). Choose the narrowest bypass list possible, and record any unavoidable administrator bypasses.

- Require a pull request before merging; disallow direct pushes to `main`.
- Block force pushes and deletions of `main`.
- Require successful status checks for the existing GitHub Actions jobs **`core`** and **`browser`** from `.github/workflows/test.yml`. Choose the actual check contexts reported by GitHub on a recent PR; do not guess names from this document if GitHub displays them differently. Where supported, bind checks to GitHub Actions as their expected source and require a branch up to date before merging if this is compatible with the project's merge strategy.
- Require a non-author approving review **only if a genuinely separate reviewer account is available**. An AI reviewer operating through the same GitHub identity as the author does not constitute independent approval. A review comment or self-approval is not a substitute for a distinct eligible approval.
- Enable dismissal of stale approvals when new commits are pushed if compatible with the review process. Prevent author/administrator bypass where GitHub account capabilities permit; disclose any residual bypass.

**Important distinction:** A human review remains a governance expectation even if GitHub cannot yet enforce it. A commercial review bot is optional and cannot grant merge authority merely by commenting.

## Administrator execution

1. Confirm that the repository's current settings and plan support branch rulesets, and inspect all existing applicable rules before changing them. Avoid overlapping or conflicting rulesets.
2. Create/configure the `main` ruleset as above, save and activate it.
3. Use a separate, authorised GitHub reviewer identity if required reviews are enabled. Do not create a fictional separation between two AI sessions using one account.
4. Capture the ruleset name/ID, target, enforcement status, bypass actors and restrictions, check contexts with sources, review count, and any GitHub plan limitations. Record the observation date.
5. Recheck the repository settings directly after saving; a successful UI submission alone is insufficient evidence.

## Safe enforcement probe (no runtime changes)

Use an issue-linked branch with a documentation-only edit, and open a PR. The probe should exercise:

1. **PR gate:** attempt (without force or credentials beyond approved scope) a harmless normal direct push to `main` from an appropriately unprivileged identity; it should be rejected. If it is accepted, the probe has failed: stop the exercise and restore the resulting change through a reviewed PR before any further testing. If only an administrator identity is available and it can bypass rules, label the result _not tested_ rather than calling it enforced.
2. **CI gate:** leave a check pending or intentionally failing on the probe branch (never sabotage production code or merge the failing change). Verify that GitHub marks merge blocked because the relevant required check has not succeeded.
3. **Review gate:** verify the PR cannot merge without the configured number of genuine non-author approvals. If the same author account is the only identity available, report this as _not enforceable/testable_ rather than self-approving.
4. **Post-push:** add a harmless commit after approval and confirm stale-review behavior if enabled.
5. **Negative operations:** inspect ruleset restrictions for force-push and deletion; avoid destructive live tests against `main`.
6. Once checks and review are satisfied, let an authorised maintainer decide whether to merge the harmless probe PR; otherwise close it without merging. Capture GitHub UI evidence or API snapshots.

Document the actor identity and bypass status for every test. Distinguish actual blocked attempts from settings that merely appear configured.

## Optional automated reviewer

An administrator may evaluate CodeRabbit or another reviewer, but installation and repository access require **explicit account-owner approval**. Before granting access, inspect permissions, data handling, pricing and which repositories are in scope. Test on a harmless PR. Report whether review is advisory, a GitHub approval from a distinct account, or a required gate; do not infer any of those from a bot comment.

## Acceptance record

Complete this table only with observed evidence; leave unverified values as **not verified**.

| Control                        | Evidence to capture                                        | Current finding        |
| ------------------------------ | ---------------------------------------------------------- | ---------------------- |
| PR-only `main`                 | Active ruleset and rejected non-bypass direct push         | Not verified           |
| Required `core` and `browser`  | Check names/sources and blocked failing/pending PR         | Not verified           |
| Force-push/delete restrictions | Active targeted ruleset                                    | Not verified           |
| Independent approval           | Separate reviewer identity, rule and blocked unapproved PR | Not verified           |
| Bypasses                       | Explicit actor list and observed privilege limits          | Not verified           |
| Optional bot                   | Owner approval and harmless PR trial                       | Not installed/verified |

After administrator testing, update this record with dated, attributable findings and align [GOVERNANCE.md](../GOVERNANCE.md) and [CONTRIBUTING.md](../CONTRIBUTING.md) to the **actual** enforcement, not the proposed configuration. Close Issue #4 only when its acceptance criteria are genuinely met, or explicitly document remaining limitations and obtain an authorised disposition.
