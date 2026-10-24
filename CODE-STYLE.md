<!-- CODE-STYLE.md -->

# Source readability policy

**Rationale.** Telltales is meant to be maintained by different LLMs and humans without relying on the original conversation. Code should expose its own structure, while durable commentary preserves the reasoning that a future maintainer cannot deduce from syntax alone.

## Source organisation

A meaningful subsystem directory should have its own README. It must primarily explain **why** the subsystem exists, its boundaries, invariants, constraints, rejected alternatives where relevant and trade-offs. Brief pointers to code and tests help navigation; avoid restating implementation. Prefer cohesive modules divided by responsibility, not file-length quotas. Project policy and cross-module contracts remain authoritative at the repository root.

## File orientation

For hand-maintained files that can legally begin with comments, the first line identifies the repository-relative name (for example `// src/app.mjs` or `<!-- CODE-STYLE.md -->`). Use the native syntax. Honour a mandated shebang, encoding signature or format header first; strict JSON, binary, generated and vendored files are exempt. Fix the identifier when moving a file.

## Comments

Name the intent, trust boundary, failure mode, physical meaning, coordinate frame, precision/freshness assumptions and subtle lifecycle or concurrency reasoning. Say **why**, not **what**. Prefer expressive code and regression tests over descriptions of individual statements. When changing a decision, revise the rationale and its test rather than silently deleting it.

## Formatting

Prefer consistent two-space indentation in JavaScript, LF endings and newline at EOF. `.editorconfig` establishes basic editor behaviour. Prettier's 100-character print width is a wrapping guideline, not a hard limit for long strings, URLs or unavoidable tokens. Linting is complementary and should target defects and dangerous patterns, not duplicate the formatter.

The tooling first proposed in PR #28 is integrated in this revision: it pins Prettier, provides `npm run format` and `npm run format:check`, adds defect-oriented ESLint through `npm run lint`, keeps mechanical reformatting separate, and runs the checks in core CI. The policy by itself does **not** create enforcement on a revision that lacks that tooling; assess enforcement from the configuration and workflow present in the revision being reviewed. Run formatting idempotence and relevant tests, avoid unrelated rewrites, and document tool version and enforcement scope. Pure format-only commits may be recorded in `.git-blame-ignore-revs` if actually needed.

## Review implications

GitHub diffs and inline review attach to lines, so compressed multi-statement lines reduce review precision and increase edit conflicts. LLMs can parse long lines, but dense layout complicates selection, modification and explanation. Readability is therefore an engineering and succession requirement, not cosmetic preference.

Tracked under [Issue #23](https://github.com/ilmc/telltales/issues/23) and the [engineering baseline introduced in PR #21](https://github.com/ilmc/telltales/pull/21). This document records agreed principles and proposed tooling separately.
