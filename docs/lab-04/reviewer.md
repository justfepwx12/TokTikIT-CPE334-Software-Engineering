# Lab 4 — Peer Review Record

**Author:** Onsinee Chotchuangsakulchai — 67070501078 — GitHub: @justfepwx12  
**Peer reviewer 1:** Pawarisa Thongchua — 67070501032 — GitHub: @itspxsh

All Lab 4 PRs below are authored by @justfepwx12 and reviewed by @itspxsh (reviews verified via GitHub API).

---

## Pull Requests I Authored (Reviewed by My Partners)

| Issue / PR | Branch | Reviewer | Reviewer Verdict |
| :--- | :--- | :--- | :--- |
| [#124](https://github.com/justfepwx12/TokTikIT-CPE334-Software-Engineering/issues/124) · [PR #147](https://github.com/justfepwx12/TokTikIT-CPE334-Software-Engineering/pull/147) | `feature/lab4-01-spec-dd` | Pawarisa Thongchua (@itspxsh) | Approved (2026-10-07) & Merged |
| [#125](https://github.com/justfepwx12/TokTikIT-CPE334-Software-Engineering/issues/125) · [PR #148](https://github.com/justfepwx12/TokTikIT-CPE334-Software-Engineering/pull/148) | `feature/lab4-02-db-migration` | Pawarisa Thongchua (@itspxsh) | Approved (2026-10-08) & Merged |
| [#126](https://github.com/justfepwx12/TokTikIT-CPE334-Software-Engineering/issues/126) · [PR #149](https://github.com/justfepwx12/TokTikIT-CPE334-Software-Engineering/pull/149) | `feature/lab4-03-api-actions` | Pawarisa Thongchua (@itspxsh) | Approved (2026-10-10) & Merged |
| [#127](https://github.com/justfepwx12/TokTikIT-CPE334-Software-Engineering/issues/127) · [PR #150](https://github.com/justfepwx12/TokTikIT-CPE334-Software-Engineering/pull/150) | `feature/lab4-04-ui` | Pawarisa Thongchua (@itspxsh) | Approved (2026-10-15) & Merged |
| [#128](https://github.com/justfepwx12/TokTikIT-CPE334-Software-Engineering/issues/128) · [PR #151](https://github.com/justfepwx12/TokTikIT-CPE334-Software-Engineering/pull/151) | `feature/lab4-05-test` | Pawarisa Thongchua (@itspxsh) | Approved (2026-10-18) & Merged |

---

### #124 (Issue 1 — Spec-DD · PR #147)

**Reviewed by:** Pawarisa Thongchua (@itspxsh)

**Review-type:** Documentation — `specification.md`, `ui-spec.md`, `api-spec.md`, `tests.md` (docs-only, no code/schema).

**PR Overview & Details:**
> Lab 4 engineering contract: FR-25–FR-36, BR-22–BR-31, AC-34–AC-59 with the 7-field Actions Taken contract, aggregated-only dashboard summaries, optimistic-concurrency/idempotency rules, the 8-state transition reference copy, and the 35-test traceability matrix (`tests.md`).

**Reviewer comments given (CHANGES_REQUESTED ×2):**
> Round 1 (5 points): every dashboard drill-down must return its metric's exact ticket set (follow-up descriptors missing, `myAssignedCount`/`resolvedTodayCount` mismatch); actions response example invalid JSON (`]` vs `}`); `followUpRequired` required-vs-default contradiction; AC-45 `items: []` vs aggregated-only schema; `resolvedToday` measured via `updatedAt` without a transition timestamp. Round 2 (2 points): follow-up must use the latest action (greatest `id`), not any-true — applied to both dashboards and list filters plus a clear-test; requester follow-up drill-down must include the non-terminal status filter.

**How I responded:**
> Fixed JSON example, made `followUpRequired` optional-default-false, clarified empty-state as zero-metrics-only (BR-29), documented `resolvedToday` as UTC-day `updatedAt` approximation (AD-19), unified follow-up on latest-action (AD-18) across spec/API/tests with a clear-test, and added the non-terminal filter to the requester drill-down.

**Reviewer approved comment (APPROVED 2026-10-07):**
> "Follow-up status consistently uses the latest recorded action across AD-18, both dashboard formulas, both list filters, and the SQL reference… LGTM — approving this PR."

---

### #125 (Issue 2 — Database · PR #148)

**Reviewed by:** Pawarisa Thongchua (@itspxsh)

**Review-type:** Schema + migration + seed — `ActionTaken`/`IdempotencyKey`, safe migration, idempotent seed.

**PR Overview & Details:**
> `ActionTaken` per spec §9.1 (FK → Ticket/User `Restrict`, `followUpRequired` default false, `version` default 1, nullable `seedKey` + `@@unique([ticketId, seedKey])`, §9.4 indexes); migration `20261007000000_lab4_action_taken` creates one table only (BR-31); seed adds zero-ticket Requester `busaba.jitdee` + 7 deterministic `seed:<ticketNo>:action:<index>` actions (0/1/N, true/false, performer ≠ owner); `prisma validate`/`tsc` passed at review time.

**Reviewer comments given (CHANGES_REQUESTED):**
> [P1] PR checklist still marks live DB verification incomplete — run the migration + seed against a populated staging copy (legacy counts before/after migration/rollback + two consecutive seed runs with identical counts). No production data. No other blocking schema/seed issues.

**How I responded:**
> Ran `migrate dev` + seed twice on a staging copy; recorded legacy 7-table counts before/after (plus one extra User for the zero-ticket fixture), 0/1/N + 8-state coverage, rollback/re-apply preserving legacy rows; pasted the verification log in the PR.

**Reviewer approved comment (APPROVED 2026-10-08):**
> "Thanks for adding the staging verification evidence… LGTM — approving this PR."

---

### #126 (Issue 3 — REST API · PR #149)

**Reviewed by:** Pawarisa Thongchua (@itspxsh)

**Review-type:** Backend — actions CRUD + AuthZ, dashboard summaries, concurrency/idempotency + API tests.

**PR Overview & Details:**
> `GET/POST /tickets/:id/actions` (performer forced from session, newest-first, 1–50 paging), `PATCH /api/actions/:id` (atomic version swap, `If-Match` 400/409), dashboard summaries (any-role own-scoped requester summary; Staff/Admin-only staff summary; in-DB `groupBy`/`count`; AD-18 shared follow-up predicate; drillDown with real viewer ids), §3 list-filter extensions (multi-status, `followUp`, `resolvedToday`); suites `actions-api`/`actions-authz`/`dashboard-api`/`actions-concurrency` (22/22, full 206/206 at review time).

**Reviewer comments given (CHANGES_REQUESTED ×2):**
> Round 1 (4 points): [P1] in-memory idempotency store evicts at 1000 entries and vanishes on restart — violates BR-28 24h, persist it; [P1] in-flight gate never settles when first insert throws — resolve/reject on both paths + regression test; [P1] follow-up counted in app memory via unbounded ID fetch — compute in-DB (AC-47) + harden the test; [P2] `resolvedToday=true` overwrites caller `status` — intersect or reject + test. Round 2 (1 point): concurrent expired-key cleanup races (`delete` → 500) — use conditional `deleteMany` + concurrent-expired regression test.

**How I responded:**
> Persisted idempotency keys (DB-backed, 24h TTL, `@@unique([ticketId, key])` twin collapse); gate settles on success and failure; follow-up counts moved in-DB with a Prisma-middleware proof; `resolvedToday` intersects caller status; expired cleanup switched to ID-scoped `deleteMany` with concurrent-expired + replay-snapshot tests.

**Reviewer approved comment (APPROVED 2026-10-10):**
> "The expired-key race is addressed… LGTM — approving this PR."

---

### #127 (Issue 4 — UI · PR #150)

**Reviewed by:** Pawarisa Thongchua (@itspxsh)

**Review-type:** Client — staff/requester dashboards, Actions Taken in detail, responsive/a11y hardening + RTL suites (client 140/140 → 143/143, build/lint/diff-check clean at review time). No server changes.

**PR Overview & Details:**
> `/dashboard/staff` (6 cards from summary API only, shortcuts, skeleton/empty/error, drill-down to `/queue` via allowlist) + `/dashboard/requester` (6 own-ticket cards + follow-up strip, empty CTA, counts-only for Staff/Admin; `roleHome` AD-17) + `ActionsTaken` in both details (newest-first table/mobile cards, Staff/Admin-only inline Create/Edit with mirrored validation, per-draft key, localStorage draft, 409 refresh-and-retry, focus management) + hardening (brand tokens, `:focus-visible`, `overflow-x: clip`, 40px targets, `lab4Style` tests) + AC-53 screenshots 12/12 (`docs/lab-04/images/`, 4 views × 375/768/1280, no page h-scroll).

**Reviewer comments given (CHANGES_REQUESTED ×3):**
> Round 1: draft `Idempotency-Key` lives only in a ref — persist it with the draft and reuse across remount/retry + regression test (lost-response → remount → single row). Round 2: ticket-switch isolation fixed (`1ecd11b`) but AC-53 screenshots + latest validation summary still pending (PR Draft). Round 3: stale-request race — `loadFirst` for Ticket A resolves after switch to B and overwrites B's list (`cancelled` only checked before start) — guard with abort/generation + delayed-A-after-B regression test, same for other ticket-scoped handlers.

**How I responded:**
> Fix commits `7d80869` (key persisted with draft) → `1ecd11b` (reload draft+key on `ticketId`) → `7ff165a` (12 screenshots + lint-clean key state) → `a40b83e` (generation guard on list/pagination/create/edit/refresh + race tests; stale creates clean only their own draft).

**Reviewer approved comment (APPROVED 2026-10-15):**
> "The stale-response race is addressed in `a40b83e`… LGTM — approving this PR. Thanks for addressing the review feedback."

---

### #128 (Issue 5 — Testing · PR #151, merged 2026-10-18)

**Reviewed by:** Pawarisa Thongchua (@itspxsh)

**Review-type:** Test suites — pure units + migration/workflow + `lab-04` e2e (19 files, +1795/−133; behavior-identical refactor: `actionValidation.ts`/`dashboardFormulas.ts` extraction; docs route-drift fix).

**PR Overview & Details:**
> Closes #142/#143 (Epic #128 stays open until DB verification flips `tests.md` to Passed). Backend rows 1–4/33/35 (`migration-actions`, `action-validation`, `dashboard-formulas`, `workflow-spot`, dashboard clear-test); frontend rows 27–32/34 (7 Playwright specs, 33 runs = 11 tests × desktop/tablet/mobile); docs fix (`/tickets/new` → `/create-ticket`, CTA `/staff/tickets` → `/queue`). Evidence: `tsc`/`eslint`/`diff-check`/`prisma validate` clean, pure units 16/16, RTL 143/143, e2e `--list` 33/33 parsed; DB suites need Docker (`localhost:15432` P1001 locally).

**Reviewer comments given (CHANGES_REQUESTED ×4):**
> Round 1 (2026-10-16, 1 point): in `server/tests/lab-04/migration-actions.test.ts` the post-seed `actions` count used `where: { id: { in: afterIds } }`, but `afterIds` holds Ticket IDs — it counts ActionTaken rows whose PKs happen to match Ticket IDs, and since the query never throws the `.catch()` fallback never runs, so the idempotency assertion compares unrelated counts. Change to `where: { ticketId: { in: afterIds } }` (matching `before.actions`) and run the DB-backed test. Round 2 (2026-10-17): seed-count fix confirmed, but the PR had not run the remaining DB-backed Lab 4 server suites or the new Playwright e2e suite live — `--list` proves discovery only, not that the 33 runs pass. Run them and report failures/skips. Round 3 (2026-10-18): `hygiene.spec.ts` excused any `Fetch API cannot load` pageerror mentioning `/api/auth/{me,login}` without proving the request actually failed from navigation abort — a genuine CORS/network failure on those endpoints would be suppressed; narrow to confirmed navigation-aborted requests. Round 4 (2026-10-18): `cancelledAuthPaths` is keyed by pathname only, so one confirmed abort excuses every stashed error for that path, including an unrelated CORS failure on the same endpoint — correlate each page error with its specific aborted request, or remove the exception if `gotoSettled()` makes it unnecessary.

**How I responded:**
> Round 1 — `774196e`: `after.actions` switched to `ticketId: { in: afterIds }` (identical predicate to `before.actions`) and the dead `.catch()` removed; DB verification also exposed a second bug in the same file (BR-31 leak-check listed `description`, a legitimate Lab 2 field), narrowed to ActionTaken-only columns; `migration-actions` 5/5 + pure units 21/21 on a real DB. Round 2 — ran everything live on the local stack: server 239/239 (lab-04 subset 53/53), client RTL 143/143, e2e 33/33 with raw results pasted into the PR. Round 3 — `1c3b080`: the exception now requires a same-path `requestfailed` carrying `net::ERR_ABORTED`, and `gotoSettled()` waits for `networkidle` after each navigation. Round 4 — `f7624bf`: rather than fragile per-request correlation I removed the exception machinery entirely (net −50/+6; `pageerror` strictly fatal again, safe because `gotoSettled()` prevents the abort), plus `e6b04fe` fixed the `ui-spec.md` Open Queue route to `/queue`; hygiene 3/3 + full e2e 33/33 re-verified six consecutive rounds, server 239/239, client 143/143, all lab docs counts audited.

**Reviewer approved comment (APPROVED 2026-10-18):**
> "The hygiene test no longer suppresses auth-related page errors; it waits for navigation requests to settle and treats page errors as fatal. The staff dashboard's "Open Queue" route in `ui-spec.md` now matches the implemented `/queue` route… The reported verification is green: server tests **239/239**, Lab 4 E2E **33/33** with no skips, and the hygiene test **3/3** across desktop, tablet, and mobile. No blocking issues remain. **Approved — thank you for addressing the review feedback.**"

**Merged:** 2026-10-18 (merge commit `002b9b3`, PR #151 → `lab4-staging`).

---

## Pull Requests I Reviewed for My Partner

Partner repo `itspxsh/toktickit`. My review routine is the same every time: read the scope from the PR description → check it against `specification.md`/`api-spec.md`/`tests.md` → run the tests and build locally → give a verdict (all states/dates below confirmed via the GitHub API). Short summary first, then the image where the original review carried one.

### L4-01 · #60 — Engineering contract Spec-DD/Test-DD (Changes requested → Approved 2026-10-08)
Scope was the Sprint 4 contract (workflow ordering, ticket matrix, resolution gate, versioning). I praised the correct sequencing first, then requested 2 blockers (`TicketSummary` missing `owner` required by staff UI; `resolvedAt` lifecycle never exposed) plus 7 minor clarifications (resolve-confirm, Active labels, pagination max, `before`-only/unknown-keys, assignment audit intent, FR-08 mapping, `performedBy` open decision). The partner fixed everything in `3ff284b` and asked for re-review; I re-checked all 8 points and approved. No L4-02+ until merge, per reviewer.md.
> Short summary before image: Approved. Verified fix commit 3ff284b addresses all 8 review points: TicketSummary owner omission now consistent API-UI, resolvedAt exposed in summary/detail, confirm required for all effective transitions to RESOLVED/CANCELLED plus RESOLVED-CLOSED, Active labels, Actions/revisions pagination 1..100 with T-ACT-09, before-only and unknown-keys semantics clarified, assignment/priority no-history intent stated, FR-08 mapping fixed. Confirming open decision in spec section 11: performedBy means the authenticated actor who completes the Action (current proposal). No L4-02+ implementation until this PR is merged.
<img width="229" height="220" alt="alien_cat" src="https://github.com/user-attachments/assets/80cfc8f3-216e-41ae-b62b-67f513749ec5" />

### L4-02 · #72 — Inherited contract + authenticated regression baseline (Approved 2026-10-08)
Scope was reconciling the approved L4-01 contract and restoring the authenticated baseline (itPriority copy, Admin as owner/assignee target, credentialed reference fetches, safe claim change). I verified locally on `feature/lab4-02-inherited-regression` (server 82/82, client 60/60, both builds, prisma validate, diff-check clean) with no spec conflict, so I approved directly with 2 non-blocking follow-ups (dev-header fallback test, negative Requester-claim 403 test).
> Short summary before image: Approved. Verified locally on feature/lab4-02-inherited-regression: server 82/82, client 60/60, server/client builds pass, prisma validate pass, git diff --check clean. Changes match approved L4-01 contract. Two non-blocking follow-ups for a later issue.
<img width="229" height="220" alt="alien_cat" src="https://github.com/user-attachments/assets/80cfc8f3-216e-41ae-b62b-67f513749ec5" />

### L4-03 · #73 — Actions/workflow data foundation, migration, seed (Changes requested → Approved 2026-10-09)
Content was correct (spec-§7 migration, deterministic create-only seed, guards, ordering; local server 82/82, client 60/60, validate/builds/diff-check/T-MIG-05 green). I requested 2 non-logic items: paste the redacted 11/11 serial integration log (DB name only) required by the validation plan, and 2 code-clarity nits (`$executeRaw` justification + legacy-shape seed comment). The partner pasted the log (comment `6084720930`, 5+5+1) + linked it from reviewer.md, reverted to Prisma update, and added the comment; I re-verified on `9109385` and approved.
> Short summary before image: Approved. Both follow-ups verified: redacted 11/11 integration log pasted and linked from reviewer.md; unnecessary $executeRaw reverted; seed legacy-shape comment added. Re-verified locally on 9109385: server 82/82, client 60/60, builds pass, prisma validate, diff-check clean. (No image carried in the original approval.)

### L4-04 · #74 — Actions Taken API, assignment, audit safety (line comments → Changes requested → Approved 2026-10-10)
Scope was the actions API with assignment/audit safety. I left inline comments first, then requested 3 blockers: missing direct tests (STALE_WRITE, TICKET_NOT_EDITABLE, ASSIGN revision), P2002 race must re-read per api-spec §3, and contract-owner ack for removing `authorization.api.test.ts` + editing `tests.md`. The partner added the coverage (stale/terminal/ASSIGN + race + confirm/follow-up + boundary tests), made P2002 re-lock/re-read with actor/fingerprint comparison, and recorded the ack with accurate TDD chronology; I verified on `d3f111c` (server 141/141, 21 files, tsc/schema/diff clean, exactly-once lookup assertion) and approved with 2 non-blocking reminders.
> Short summary before image: Re-review verified — all 3 blocking items are resolved with stronger coverage than suggested (P2002 re-lock/re-read, full stale/terminal/ASSIGN matrix). Independently verified locally on head d3f111c: full server suite 141/141 across 21 files. Approved — ready to merge. (No image carried in the original approval.)

### L4-05 · #75 — Shared Actions Taken list + editing UI (Changes requested → Approved 2026-10-14)
Scope was the shared actions UI (support create/list/edit/assign/start/complete/cancel, paginated revisions, requester read-only, confirmations, draft preservation, a11y) with no server change. I requested corrections via inline comments (fix 138/138 → verified 141/141 counts, justify/revert `TicketView` widening, follow-up-clearing/replay-status/shared-form findings). The partner fixed all 5 threads (correct count, reverted widening, explicit follow-up message, 200-vs-201 replay handling, single-form + preserved assignee); I re-verified on `a1f8a8f` in an isolated worktree (client 72/72 incl. Actions 12/12, server 141/141, both builds, diff-check clean) and approved.
> Short summary before image: Re-verified on a1f8a8f in an isolated worktree: client 72/72 (Actions 12/12), server 141/141, both builds pass, diff check clean. All 5 prior threads are fixed. No new security or scope issues. Approved — ready to merge.
<img width="229" height="220" alt="alien_cat" src="https://github.com/user-attachments/assets/2a1fe8b1-6882-44b7-9972-7206cce1730f" />

### L4-06 · #76 — Ticket workflow, resolution gate, concurrency (Changes requested → Approved 2026-10-15)
Strict review per Issue #65 on `23809fc` (verified matrix/BR-15, confirm/BR-16, `resolvedAt`/BR-32, gate/BR-17, lock order/BR-19/20, safe projections, client transitions; server 150/150, client 77/77, builds/validate/diff clean reproduced; integration 17/17 required a real serial log). I blocked on H1 (positive regressions deleted instead of versioned: T-DETAIL-03/T-STAFF-03/T-STAFF-04 reduced to 400-only, losing ADMIN reopen/priority/fieldErrors 200s) + H2 (assignment/priority/status must validate `expectedTicketVersion` first with 400 `VALIDATION_ERROR`) plus M items (Bangkok `Intl` dates, owner fallback, 3 UI tests, test-only/commit split, P2002/P2034 mapping). The partner restored versioned tests, added first-version validation, and closed all M items; I re-verified on `b413ed2` (server 151/151, client 82/82, serial 17/17 on isolated DB) and approved.
> Short summary before image: All H1+H2 blockers and M items from the CHANGES_REQUESTED review on 23809fc are now closed. Verified locally on head b413ed2: server 151/151, client 82/82, serial integration 17/17 on isolated DB. Approved. (No image carried in the original approval.)

### L4-07 · #77 — Scoped dashboards + exact drill-down queries (Approved 2026-10-16)
Per Issue #66 (FR-09..12, BR-22..32/35/39, AC-10..12/18/20). I verified on `feature/lab4-07-dashboards@242ba00` (server 172/172, client 82/82, builds/validate/diff-check pass; TOCTOU recheck after parent lock → 404 zero-write; RepeatableRead/UTC/allowlist/projections/gates + edge probes) with only non-blocking nits (dead assignment `action-service.ts:319`, `isActive` symmetry, mixed `updatedSince`+resolved semantics), so I approved directly for merge to `lab4-staging` (close #66).
> Short summary before image: Approved as Lab 4 peer reviewer. Verified on 242ba00: server 172/172, client 82/82, TOCTOU/scope/UTC/allowlist/gates verified including extra edge probes. Minor nits non-blocking. Good to merge and close #66. (No image carried in the original approval.)

### L4-08 · #78 — Role dashboards, current-user work, URL navigation (Changes requested → Approved 2026-10-16)
Per Issue #67 on `feature/lab4-08-dashboard-integration@ac31f95` vs `lab4-staging@450c4c3` (client+docs only, +1324/−74, no server/schema). I reproduced locally (client 112/112 incl. 30/30 focused, server 172/172, builds/`tsc`/diff-check pass; 15 red commits, allowlists, UTC checks, guarded Back) but blocked on 3 items: staff queue numbered pagination `1..min(totalPages,5)` breaks past page 5 (no `aria-current` on page 6+, unlike shared `Pagination`); `StaffTicketDetail` passes raw `navigate` bypassing the dirty-form guard (`handleNavigate`); active-filter chips show dates stripped by `validateDateFilters`. The partner fixed all 6 findings across `0fe7fb3` → `2c6946d` (windowed `visiblePageNumbers()` with a Page-6 `aria-current` test, guarded `handleNavigate` + `staffTicketDirty` tracking with confirmation dialogs for authenticated users, chips derived from `activeDates`, `actionPage` clamped to `MAX 10_000`, strict UTC/safe-integer payload validation, manual 320/768/1440 evidence recorded in this file); I re-verified on `2c6946d` (client 124/124, server 172/172, builds/validate/diff-check green) and approved. **Merged 2026-10-16 (19:04 UTC), closing #67.**
> Short summary before image: Re-checked on 2c6946d: client 124/124, server 172/172, builds/prisma-validate/diff-check pass. All six prior findings addressed (windowed pagination with aria-current, guarded navigation with dirty tracking, activeDates chips, actionPage clamp, strict UTC validation, manual responsive/a11y evidence). Two non-blocking nits remain (total>0/totalPages==0 validation, one out-of-range fetch before self-correcting) — both acceptable. Good to merge to lab4-staging and close #67. (No image carried in the original approval.)

### L4-09 · #79 — Whole-product regression, security, a11y, polish (Changes requested ×2, open)
On `2217d6e` (based on `lab4-staging@6dcdad0`). Round 1 (2026-10-18, CHANGES_REQUESTED): direction right (CSRF on requester writes, `FOR UPDATE` capacity guard, fail-closed e2e preflight) but 7 findings — L4-09-01 file I/O inside the interactive transaction while holding the `FOR UPDATE` lock; L4-09-02 lost Lab 2 blocked-file/URL/dirty-cancel/cross-requester regressions; L4-09-03 Staff journey hard-fails on an uneditable first row; L4-09-04 noisy unlink failure logging; L4-09-05 asymmetric `assert-preflight.cjs` + cwd-dependent artifact paths; L4-09-06 `PriorityBadge` duplicating `StatusBadge` instead of delegating; L4-09-07 lock query not pinned to single invocation. Round 2 (2026-10-18, CHANGES_REQUESTED): all 7 code findings verified fixed across `7c3bc8e`..`a070e81` (loopback-only insecure-cookie hardening praised), but **merge stays gated on 3 evidence gaps**: rerun seeded live browser matrix post-fix (Lab 2 e2e 3/3 + Lab 3 e2e 9/9 × three viewports, one worker, zero retries, guarded `_test` DB); regenerate committed screenshots (incl. new `cross-requester-not-found`) + update `artifacts/lab-04/regression/README.md` provenance; rerun PostgreSQL integration 20/20 (T-RACE-04 + migration suites) and the full server suite on the final commit (sandbox EPERM had blocked it after `7fcb050`). One non-blocking nit (select the editable queue row *after* the optional Next-page click). Awaiting partner evidence rerun; Issue #68 stays in PR Review.

---

*Records through PR #151 (Issue 5) and partner reviews through L4-09 are complete as of this Issue 6.1 workflow PR. This PR's own review decision — plus the Issue 6.2 release PR's — will be recorded in the 6.2 release-docs PR (a PR cannot record its own review outcome before it exists). PR checklist going forward: `.github/PULL_REQUEST_TEMPLATE.md`. Screenshots: `docs/lab-04/images/` (12: staff/requester dashboards + staff/requester details × 375/768/1280).*
