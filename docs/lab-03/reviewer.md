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
| #84 (PR #121) | feature/9-lab3-automated-tests | Pawarisa Thongchua (@itspxsh) | Approved & Merged |
| #85 (PR TBD) | feature/10-release-docs-pdf | Pawarisa Thongchua (@itspxsh) | Pending |

> Note: PR #111 (same spec branch) was closed superseded by PR #112/#113.

---

### #77 (Issue 1 — Spec-DD · PR #112 → PR #113)

**Reviewed by:** Pawarisa Thongchua (@itspxsh)

**Review-type:** Documentation — `specification.md`, `ui-spec.md`, `api-spec.md`, `tests.md` (+ scaffolded `reviewer.md`, `ai_use.md`).

**PR Overview & Details:**
> Lab 3 engineering contract: FR-01–FR-24, BR-01–BR-21, AC-01–AC-33 with the authorization matrix, the 8-state transition matrix, the REST contract (`api-spec.md`), role-aware UI contract (`ui-spec.md`), and the 66-test traceability matrix (`tests.md`).

**Reviewer comments given (PR #112, CHANGES_REQUESTED):**
> 1. Role permission mismatch — `ui-spec.md`/`specification.md` showed "Create Ticket" for IT Staff/Admin, but the authorization matrix and `api-spec.md` allow creation for Requesters only; align navigation, matrix, API contract, and test plan. 2. Session cookie must be mandatory (HTTP-only server-side session, no identity header) — plus further contract-consistency points in the full review.

**How I responded:**
> Aligned UI navigation, authorization matrix, API contract, and test plan; hardened the session-cookie contract — fix commit `904b252`. Opened PR #113 with the corrected docs (PR #111 closed superseded).

**Reviewer approved comment (PR #113, APPROVED):**
> "The specification, UI contract, API contract, authorization matrix, and test traceability are consistent. `git diff --check` passed… LGTM — approving this PR."

---

### #78 (Issue 2 — Database · PR #114)

**Reviewed by:** Pawarisa Thongchua (@itspxsh)

**Review-type:** Migration + seed — roles, 8 statuses, dual priorities, ownership, comments/notes sample data.

**PR Overview & Details:**
> Prisma schema evolution: `Requester` → `User` with `Role` (REQUESTER/IT_STAFF/ADMIN); new `TicketPriority` + 8-state `TicketStatus` replacing Lab 2 enums; `requestedPriority` + `itPriority` (BR-14); `ownerId` FK (`ON DELETE SET NULL`); `Comment` + `InternalNote` tables; migration `20260915000000_lab3_schema_evolution` preserving Lab 2 data byte-for-byte (`PENDING → NEW`); idempotent seed with role counts and sample tickets (client tests 47/47, server typecheck passed at review time).

**Reviewer comments given (CHANGES_REQUESTED):**
> [P1] `seedSampleTickets()` deletes all comments/internal notes of seed authors on sample tickets — user-created rows would be wiped on re-seed. Key seed rows (e.g. `seedKey` upsert) instead of deleting by author.

**How I responded:**
> Seed upserts canonical rows by `seedKey` and never deletes user-authored comments/notes; re-seed idempotency + data-preservation covered by `migration-seed.test.ts` (AC-32/AC-33).

**Reviewer approved comment (APPROVED):**
> "LGTM / Approved."

---

### #79 (Issue 3 — Auth & first login · PR #115)

**Reviewed by:** Pawarisa Thongchua (@itspxsh)

**Review-type:** Backend — session login/logout/me/change-password + `mustChangePassword` gate.

**PR Overview & Details:**
> Server-side session auth on Postgres (`express-session` + `connect-pg-simple`, 30-min lifetime, `toktikit.sid` HTTP-only cookie): `login`/`logout`/`me`/`change-password` via `auth.controller.ts`, `hydrateUser`/`requireAuth`/`requireRole`/`gateMustChangePassword` middleware. Auth API tests intentionally left for the review follow-up so the first revision stayed green.

**Reviewer comments given (CHANGES_REQUESTED, 5 blocking issues):**
> 1. Safe errors — inactive/unknown/wrong-password must all return the same generic `401 INVALID_CREDENTIALS` (BR-02). 2. Change-password contract — field must be `currentPassword` (not `oldPassword`), `200 { message }` with session kept (not 204 + session destroy), validation limits per spec. 3. `gateMustChangePassword` never applied — enforce `requireAuth` + gate on all protected ticket/attachment routes (only `/auth/me`, `/auth/logout`, `/auth/change-password` exempt). 4. `session.ts` hard-codes `secure: false` with an insecure fallback — secure cookie in production, fail fast without `SESSION_SECRET`. 5. Add dedicated auth API tests (login, safe errors, restore, logout invalidation, gate, first-login change).

**How I responded:**
> Reworked `auth.controller.ts`, session config, and route guards to the contract; added `auth-api.test.ts` (19 tests: AC-01–AC-08, AC-11, BR-01) covering every point.

**Reviewer approved comment (APPROVED):**
> "LGTM / Approved."

---

### #80 (Issue 4 — Security & requester regression · PR #116)

**Reviewed by:** Pawarisa Thongchua (@itspxsh)

**Review-type:** Server authorization + client role-aware shell (client 45/45, build passed at review time).

**PR Overview & Details:**
> Removed the simulated Requester selector — identity comes solely from the session (`req.user.id`, BR-04) — plus the requester resolve-intent action. Client: new `AuthContext`/`useAuth` (restore via `GET /me`, `credentials: include` everywhere), `Login` (safe 401 banner, show/hide, role home, mustChange → `/change-password`), `ChangePassword` (mandatory, no cancel), `ProtectedRoute`, and a `Header` with real name + role badge + logout.

**Reviewer comments given (CHANGES_REQUESTED):**
> 1. Fix the 2 lint errors in `client/src/pages/Login.tsx`. 2. Role-aware header nav — "Create Ticket" requester-only; IT Staff/Admin get staff navigation (BR-05 visual). 3. Protect the `/` route (signed-out → `/login`). (Reviewer sandbox could not run server tests — no `DATABASE_URL` — so server behavior was verified on our side.)

**How I responded:**
> Fix commit `f0de4e6` — role-aware nav, protected `/` route, login lint fixes; server suites run green locally (DB-backed).

**Reviewer approved comment (APPROVED):**
> "LGTM / Approved."

---

### #86 (Issue 5 — Staff ticket queue · PR #117)

**Reviewed by:** Pawarisa Thongchua (@itspxsh)

**Review-type:** Staff queue API + UI with filters/pagination (client 50/50, build and server typecheck passed at review time).

**PR Overview & Details:**
> Server (#96): `GET /api/staff/tickets` — search, status/IT-priority/category/system/owner (`0` = unassigned) filters, sort `updatedAt|status|priority`, pagination, `requireRole(IT_STAFF, ADMIN)` (Requester → 403); `staff-queue.test.ts` (8). Client (#97): `TicketQueue` (`/queue`) — debounced search, full filter bar, desktop table + mobile cards, loading/empty/no-results/error+retry, pagination, `RequireRole` 403 screen; `TicketQueue.test.tsx` (5).

**Reviewer comments given (CHANGES_REQUESTED):**
> 1. `TicketQueue.tsx` calls `setPage(1)` synchronously inside an effect — move the page reset into the event path (event handler, not effect). 2. Fast Refresh lint errors in `TicketBadges.tsx` and `Login.tsx` — split component files. 3. Protect the `/` route (signed-out → `/login`). (Reviewer sandbox could not run server tests — no `DATABASE_URL` — so server behavior was verified on our side.)

**How I responded:**
> Fix commit `00bae92` — fast-refresh splits, queue page-reset in handler, protected `/` route; server suite green locally.

**Reviewer approved comment (APPROVED):**
> "LGTM / Approved."

---

### #81 (Issue 6 — Ticket operations · PR #118)

**Reviewed by:** Pawarisa Thongchua (@itspxsh)

**Review-type:** Claim/assign/IT-priority/status matrix endpoints + staff detail UI (client 56/56, build passed at review time). Note: stacked onto `feature/5-staff-ticket-queue`, then synced into `lab3-staging`.

**PR Overview & Details:**
> Server: `POST /:id/claim` (400 if owned), `POST /:id/assign` (target must be active IT/Admin), `PATCH /:id/it-priority` (requestedPriority immutable), `PATCH /:id/status` enforcing the §6 matrix (illegal edge → 400 `INVALID_STATUS_TRANSITION`; requester direct set → 403), `GET /api/staff/tickets/:id` full detail. Client: `StaffTicketDetail` — read-only requester block, Claim/Reassign (validated picker), IT Priority save, status buttons for legal edges only.

**Reviewer comments given (APPROVED, no blocking round):**
> Approved on review with verification (client 56/56, production build). A hardening self-review pass (`d54cd3a` — atomic claim/status guards, shared ticket-id helper, staff detail nits) landed beforehand.

**How I responded:**
> No follow-up needed.

**Reviewer approved comment (APPROVED):**
> "LGTM / Approved."

---

### #82 (Issue 7 — Comments & internal notes · PR #119)

**Reviewed by:** Pawarisa Thongchua (@itspxsh)

**Review-type:** Append-only comments + restricted internal notes API and UI (client 64/64, build passed at review time).

**PR Overview & Details:**
> Server: `GET/POST /api/tickets/:id/comments` (owner + staff/admin; foreign requester → 403 with no leak; newest-first; author `{id,name,role}` with no secrets) and `GET/POST /api/tickets/:id/notes` (IT_STAFF/ADMIN only, defense-in-depth role guard); bodies 1–2000 chars trimmed; append-only (no edit/delete routes). Client: public comments panel + yellow lock-labeled internal-notes panel, composers, no edit/delete affordances.

**Reviewer comments given (APPROVED, no blocking round):**
> Approved on review with verification (client 64/64, production build). A hardening self-review pass (`ca129fc` — shared id helper, notes role guard, order tiebreak, coverage + a11y) landed beforehand.

**How I responded:**
> No follow-up needed.

**Reviewer approved comment (APPROVED):**
> "LGTM / Approved."

---

### #83 (Issue 8 — Admin user management · PR #120)

**Reviewed by:** Pawarisa Thongchua (@itspxsh)

**Review-type:** Admin API + UI with safety guards (client 71/71, build and lint passed at review time).

**PR Overview & Details:**
> Spec amendment v1.1 first (AD-10 widened to one Role dropdown). Server: `GET /api/admin/users?search=&role=`, `POST` (server-forced `mustChangePassword`, 409 on duplicate), `PATCH` (single-role edit, activate/deactivate), `POST /:id/reset-password`; no DELETE anywhere (BR-12). Client: `UserManagement` table + create/edit modals + reset flow with guard feedback.

**Reviewer comments given (CHANGES_REQUESTED):**
> BR-11 is still a check-then-act race: the last-admin count runs separately before the update, so two concurrent requests could both pass and leave zero active Administrators. Make the guard atomic (advisory-lock transaction).

**How I responded:**
> Fix commit `4aaf339` — atomic BR-11 guard via advisory-lock transaction + concurrency regression test proving one-wins/one-400.

**Reviewer approved comment (APPROVED):**
> "LGTM / Approved."

---

### #84 (Issue 9 — Testing · PR #121)

**Reviewed by:** Pawarisa Thongchua (@itspxsh)

**Review-type:** Test suites — `server/tests/lab-03/` (8 files, 81 tests), `client/tests/lab-03/` (9 files), `client/tests/e2e/lab-03/` (4 specs, 18 runs) + minimal UI (resolve-intent button, login without nav chrome, forgot-password page, fixed table layout).

**PR Overview & Details:**
> Closes #84 (parent of #105 server / #106 client / #107 e2e). Server suites use `l3-` fixture emails + 6-digit ticket nonces so parallel runs never collide; `priority-status-api.test.ts` absorbs resolve-intent (AC-20/21). Client adds Login/ChangePassword/AppShell/RequesterDetail/AdminUsers/uiStyle + ForgotPassword. E2E adds `admin-flow.spec.ts` (create, 409, self-deactivate guard, reset → next-login change) plus viewport-aware row/card helpers and a race-free logout helper. Evidence: server 81/81, client 116/116 (17 files), client build passed, Playwright 18/18 (desktop/tablet/mobile), `git diff --check` clean.

**Reviewer comments given (APPROVED, no blocking round):**
> Verified: client 116/116, production build, client lint, server TypeScript check; coverage expanded for auth, RBAC, admin/staff workflows, and resolve-intent. Noted: login/forgot-password separated from nav chrome, non-enumerating admin-mediated reset, resolve-intent wired to status transitions, responsive table/card layouts per viewport, E2E config covers all viewport sizes. E2E could not run in the reviewer sandbox (no IPC/ports) — all available checks passed with no further issues.

**How I responded:**
> No follow-up needed — approved as-is.

**Reviewer approved comment (APPROVED 2026-09-18):**
> "LGTM — approving this PR."

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
