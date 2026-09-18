# Lab 3 — Peer Review Record

**Author:** Onsinee Chotchuangsakulchai — 67070501078 — GitHub: @justfepwx12  
**Peer reviewer 1:** Pawarisa Thongchua — 67070501032 — GitHub: @itspxsh  
**Peer reviewer 2:** Lappawat Laohasoot — 67070501039 — GitHub: @MacOverlorD

All Lab 3 PRs below are authored by @justfepwx12 and reviewed by @itspxsh (reviews verified via GitHub API).

---

## Pull Requests I Authored (Reviewed by My Partners)

| Issue / PR | Branch | Reviewer | Reviewer Verdict |
| :--- | :--- | :--- | :--- |
| #77 (PR #112, #113) | feature/1-lab3-spec-dd | Pawarisa Thongchua (@itspxsh) | Approved & Merged |
| #78 (PR #114) | feature/2-db-schema-seed | Pawarisa Thongchua (@itspxsh) | Approved & Merged |
| #79 (PR #115) | feature/3-auth-first-login | Pawarisa Thongchua (@itspxsh) | Approved & Merged |
| #80 (PR #116) | feature/4-security-requester-regression | Pawarisa Thongchua (@itspxsh) | Approved & Merged |
| #86 (PR #117) | feature/5-staff-ticket-queue | Pawarisa Thongchua (@itspxsh) | Approved & Merged |
| #81 (PR #118) | feature/6-ticket-operations | Pawarisa Thongchua (@itspxsh) | Approved & Merged |
| #82 (PR #119) | feature/7-comments-internal-notes | Pawarisa Thongchua (@itspxsh) | Approved & Merged |
| #83 (PR #120) | feature/8-admin-user-management | Pawarisa Thongchua (@itspxsh) | Approved & Merged |
| #84 (PR #121) | feature/9-lab3-automated-tests | Pawarisa Thongchua (@itspxsh) | Pending |
| #85 (PR TBD) | feature/10-release-docs-pdf | Pawarisa Thongchua (@itspxsh) | Pending |

> Note: PR #111 (same spec branch) was closed superseded by PR #112/#113.

---

### #77 (Issue 1 — Spec-DD · PR #112 → PR #113)

**Reviewed by:** Pawarisa Thongchua (@itspxsh)

**Review-type:** Documentation — `specification.md`, `ui-spec.md`, `api-spec.md`, `tests.md` (+ scaffolded `reviewer.md`, `ai_use.md`).

**PR Overview & Details:**
> Lab 3 engineering contract: FR/BR/AC/AD, authorization matrix, status-transition matrix, REST contract, and the 66-test traceability matrix.

**Reviewer comments given (PR #112, CHANGES_REQUESTED):**
> 1. Role permission mismatch — `ui-spec.md`/`specification.md` showed "Create Ticket" for IT Staff/Admin, but the authorization matrix and `api-spec.md` allow creation for Requesters only. 2. Session cookie must be mandatory (plus further contract points in the full review).

**How I responded:**
> Aligned UI navigation, authorization matrix, API contract, and test plan; hardened the session-cookie contract — fix commit `904b252`. Opened PR #113 with the corrected docs.

**Reviewer approved comment (PR #113, APPROVED):**
> "The specification, UI contract, API contract, authorization matrix, and test traceability are consistent. `git diff --check` passed… LGTM — approving this PR."

---

### #78 (Issue 2 — Database · PR #114)

**Reviewed by:** Pawarisa Thongchua (@itspxsh)

**Review-type:** Migration + seed — roles, 8 statuses, dual priorities, ownership, comments/notes sample data.

**PR Overview & Details:**
> Schema evolution for users/roles/IT-staff operations plus an idempotent seed (client tests 47/47, server typecheck passed at review time).

**Reviewer comments given (CHANGES_REQUESTED):**
> [P1] `seedSampleTickets()` deletes all comments/internal notes of seed authors on sample tickets — user-created rows would be wiped on re-seed. Key seed rows instead of deleting by author.

**How I responded:**
> Seed upserts canonical rows by `seedKey` and never deletes user-authored comments/notes; re-seed idempotency covered by `migration-seed.test.ts`.

**Reviewer approved comment (APPROVED):**
> "LGTM / Approved."

---

### #79 (Issue 3 — Auth & first login · PR #115)

**Reviewed by:** Pawarisa Thongchua (@itspxsh)

**Review-type:** Backend — session login/logout/me/change-password + `mustChangePassword` gate.

**PR Overview & Details:**
> Session-cookie auth (BR-04), safe 401s (BR-02), mandatory first-login change (BR-03), production session security.

**Reviewer comments given (CHANGES_REQUESTED, 5 blocking issues):**
> 1. Inactive users got a different response than unknown/wrong-password — must return the same generic `401 INVALID_CREDENTIALS` (BR-02). 2. Change-password contract mismatch — field must be `currentPassword` (not `oldPassword`), `200 { message }` with session kept (not 204 + destroy). 3. `gateMustChangePassword` defined but never applied — apply `requireAuth` + gate to all protected routes (only `/auth/me`, `/auth/logout`, `/auth/change-password` exempt). 4. `session.ts` hard-codes `secure: false` with an insecure fallback — secure in production, fail fast without `SESSION_SECRET`. 5. Add dedicated auth API tests (login, safe errors, restore, logout, gate, first-login change).

**How I responded:**
> Reworked `auth.controller.ts`, session config, and route guards to the contract; added `auth-api.test.ts` (19 tests) covering every point.

**Reviewer approved comment (APPROVED):**
> "LGTM / Approved."

---

### #80 (Issue 4 — Security & requester regression · PR #116)

**Reviewed by:** Pawarisa Thongchua (@itspxsh)

**Review-type:** Server authorization + client role-aware shell (client 45/45, build passed at review time).

**Reviewer comments given (CHANGES_REQUESTED):**
> 1. Fix the 2 lint errors in `client/src/pages/Login.tsx`. 2. Role-aware header nav — "Create Ticket" requester-only; staff/admin get staff navigation. 3. Protect the `/` route (redirect to `/login` when signed out).

**How I responded:**
> Fix commit `f0de4e6` — role-aware nav, protected `/` route, login lint fixes.

**Reviewer approved comment (APPROVED):**
> "LGTM / Approved."

---

### #86 (Issue 5 — Staff ticket queue · PR #117)

**Reviewed by:** Pawarisa Thongchua (@itspxsh)

**Review-type:** Staff queue API + UI with filters/pagination (client 50/50, build and server typecheck passed at review time).

**Reviewer comments given (CHANGES_REQUESTED):**
> 1. `TicketQueue.tsx` calls `setPage(1)` synchronously inside an effect — move the page reset into the event path. 2. Fast Refresh lint errors in `TicketBadges.tsx` and `Login.tsx`. 3. Protect the `/` route (redirect to `/login` when signed out).

**How I responded:**
> Fix commit `00bae92` — fast-refresh splits, queue page-reset in handler, protected `/` route.

**Reviewer approved comment (APPROVED):**
> "LGTM / Approved."

---

### #81 (Issue 6 — Ticket operations · PR #118)

**Reviewed by:** Pawarisa Thongchua (@itspxsh)

**Review-type:** Claim/assign/IT-priority/status matrix endpoints + staff detail UI (client 56/56, build passed at review time). Note: stacked onto `feature/5-staff-ticket-queue`, then synced into `lab3-staging`.

**Reviewer comments given:**
> None blocking — approved on review (self-review pass `d54cd3a` for atomic claim/status guards landed beforehand).

**How I responded:**
> No follow-up needed.

**Reviewer approved comment (APPROVED):**
> "LGTM / Approved."

---

### #82 (Issue 7 — Comments & internal notes · PR #119)

**Reviewed by:** Pawarisa Thongchua (@itspxsh)

**Review-type:** Append-only comments + restricted internal notes API and UI (client 64/64, build passed at review time).

**Reviewer comments given:**
> None blocking — approved on review (self-review pass `ca129fc` for shared id helper, notes role guard, order tiebreak landed beforehand).

**How I responded:**
> No follow-up needed.

**Reviewer approved comment (APPROVED):**
> "LGTM / Approved."

---

### #83 (Issue 8 — Admin user management · PR #120)

**Reviewed by:** Pawarisa Thongchua (@itspxsh)

**Review-type:** Admin API + UI with safety guards (client 71/71, build and lint passed at review time).

**Reviewer comments given (CHANGES_REQUESTED):**
> BR-11 is still a check-then-act race: the last-admin count runs separately before the update, so two concurrent requests could both pass and leave zero active Administrators. Make the guard atomic.

**How I responded:**
> Fix commit `4aaf339` — atomic BR-11 guard via advisory-lock transaction + concurrency regression test.

**Reviewer approved comment (APPROVED):**
> "LGTM / Approved."

---

### #84 (Issue 9 — Testing · PR #121)

**Reviewed by:** Pawarisa Thongchua (@itspxsh) — pending.

**Review-type:** Test suites — `server/tests/lab-03/` (8 files), `client/tests/lab-03/` (9 files), `client/tests/e2e/lab-03/` (4 specs) + minimal UI (resolve-intent button, login chrome, forgot-password page, fixed table layout).

**PR Overview & Details:**
> Closes #84 (parent of #105/#106/#107). Evidence: server 81/81, client 116/116 (17 files), client build passed, Playwright 18/18 (desktop/tablet/mobile), `git diff --check` clean.

**Reviewer comments given:**
> TBD — add review comments received during partner review.

**How I responded:**
> TBD — add response/action taken.

**Reviewer approved comment:**
> TBD — add approval screenshot at `docs/lab-03/images/9-testing-approved.png` after review.

---

### #85 (Issue 10 — Release · PR TBD)

**Reviewed by:** TBD

**Review-type:** Release — `reviewer.md`, `ai-use.md`, `artifacts/lab-03/screenshots/`, visual checklist, `Lab3_Submission.pdf`.

**Reviewer comments given:**
> TBD — add review comments received during partner review.

**How I responded:**
> TBD — add response/action taken.

**Reviewer approved comment:**
> TBD.

---

## Pull Requests I Reviewed for My Partner

> TBD — add review records per PR as Lab 3 progresses (mirror of Lab 2 structure).

---

*Full record completed at Issue #108 (Reviewer Sign-off & AI Use Reflection).*
