<!--
TokTikIT PR checklist — Issue #144 (Lab 4 workflow).
Branch flow: feature/lab4-* -> lab4-staging (never main directly); release PR: lab4-staging -> main.
One sub-issue per PR. Copy this template into the PR description.
The `pr-checklist` required check on `lab4-staging` validates these sections
and fails when a mandatory item is missing or unchecked.
-->

## Linked issue

Closes #

## Summary

<!-- 2-5 bullets: what changed and the key decisions. -->

-

## UI screenshots

<!-- Required when this PR changes UI. Capture from the live stack (never mockups) and paste an
     image/attachment link here, e.g. ![staff dashboard](https://github.com/user-attachments/assets/...).
     Placeholder text ("pending", "screenshots coming soon") fails the required check.
     Docs-only PRs: "N/A — docs only". -->

## Test evidence

<!-- Raw results of the suites you actually ran, in the safe order
     (server tests before E2E — an E2E run rotates the seeded passwords).
     Include the command/suite and outcome counts, e.g.
     `pnpm --filter server exec vitest run` → 239/239 passed · client RTL 143/143 · e2e 33/33.
     Placeholder text ("pending", "to do") and results without counts fail the required check. -->

-

## Excluded-Scope checklist

- [ ] Scope is limited to the linked issue (deferred items listed below)
- [ ] No secrets, tokens, keys, or credentials committed
- [ ] Docs cross-references re-checked (`ui-spec.md` / `api-spec.md` / `tests.md` route + count claims)
- [ ] `docs/lab-04/reviewer.md` updated when a review decision changed

### Excluded scope

<!-- What a reader might expect in this PR but is deliberately NOT included, and who owns it. -->

-
