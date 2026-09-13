# Lab 3 – Test Plan and Evidence

All test files live under `server/tests/lab-03/`, `client/src/__tests__/lab-03/`, and `e2e/lab-03/` (AD-12, Issue #89 acceptance). Coverage spans all six required levels — **Unit, API, UI (component), UI Style, Responsive, and E2E** — and every AC in `specification.md` §11 (AC-01–AC-33) maps to at least one test below (see §2).

**Current status:** `Planned`. This issue is documentation; results are filled in per implementation issue as suites go green. Final full-run evidence (server + client + Playwright) is appended in §3 as Issues #105–#107 complete.

---

## 1. Planned-Test Table

| # | Level | Related Issue | AC | Tool | Test | Result |
|---|-------|-------|------|------|------|--------|
| 1 | Unit | #91 | AC-33 | Vitest | `migration-seed.test.ts` — seed is idempotent (re-run: no unique violations) | Planned |
| 2 | Database/Seed | #90 | AC-32 | Vitest/Prisma | `migration-seed.test.ts` — Lab 2 rows preserved; `PENDING`→`NEW`; priority split | Planned |
| 3 | Database/Seed | #91 | AC-33 | Vitest/Prisma | `migration-seed.test.ts` — role counts (≥4 active + ≥1 inactive REQUESTER, ≥3 active + ≥1 inactive IT_STAFF, ≥1 ADMIN) | Planned |
| 4 | Database/Seed | #91 | — | Vitest/Prisma | `migration-seed.test.ts` — sample tickets span statuses/priorities and carry comments + notes | Planned |
| 5 | API | #92 | AC-01 | Supertest | `auth-api.test.ts` — login 200 + user payload + session cookie set | Planned |
| 6 | API | #92 | AC-02 | Supertest | `auth-api.test.ts` — wrong password → safe 401 (no user enumeration) | Planned |
| 7 | API | #92 | AC-03 | Supertest | `auth-api.test.ts` — inactive account → same safe 401 | Planned |
| 8 | API | #92 | AC-04 | Supertest | `auth-api.test.ts` — /me 200 with role + 401 when no session | Planned |
| 9 | API | #92 | AC-05 | Supertest | `auth-api.test.ts` — logout invalidates; /me → 401 afterward | Planned |
| 10 | API | #92 | AC-06 | Supertest | `auth-api.test.ts` — mustChangePassword gate: normal routes 403, only change-password/logout/me work | Planned |
| 11 | API | #92 | AC-07 | Supertest | `auth-api.test.ts` — first-login change clears flag + grants access | Planned |
| 12 | API | #92 | AC-08 | Supertest | `auth-api.test.ts` — wrong current/weak new password → 401/400, unchanged | Planned |
| 13 | API | #92 | AC-11 | Supertest | `auth-api.test.ts` — protected endpoints without session → 401 | Planned |
| 14 | API | #95 | AC-09 | Supertest | `identity-rbac.test.ts` — requesterId in create body is ignored; identity from session | Planned |
| 15 | API | #95 | AC-10 | Supertest | `identity-rbac.test.ts` — Requester → 403 on queue/claim/assign/it-priority/status-set/notes | Planned |
| 16 | API | #95 | AC-12 | Supertest | `identity-rbac.test.ts` — foreign ticket detail/comments → 403/404, no existence leak | Planned |
| 17 | API | #95 | AC-13 | Supertest | `identity-rbac.test.ts` — deactivated session user rejected safely | Planned |
| 18 | API | #96 | AC-14 | Supertest | `staff-queue-api.test.ts` — staff GET queue 200 w/ pagination, search, filters, sort | Planned |
| 19 | API | #96 | AC-14 | Supertest | `staff-queue-api.test.ts` — Requester on staff queue → 403 | Planned |
| 20 | API | #96 | — | Supertest | `staff-queue-api.test.ts` — queue response shape incl. requestedPriority + itPriority + owner | Planned |
| 21 | API | #98 | AC-15 | Supertest | `ownership-api.test.ts` — claim unassigned ticket → current user is owner; already-owned → 400 | Planned |
| 22 | API | #98 | AC-16 | Supertest | `ownership-api.test.ts` — reassign to active IT/Admin → 200; inactive/requester target → 400 | Planned |
| 23 | API | #98 | AC-17 | Supertest | `priority-status-api.test.ts` — IT priority persists; requester → 403; requestedPriority immutable | Planned |
| 24 | API | #99 | AC-18 | Supertest | `priority-status-api.test.ts` — legal matrix edge → 200 + new status | Planned |
| 25 | API | #99 | AC-19 | Supertest | `priority-status-api.test.ts` — illegal edge → 400 safe message, status unchanged | Planned |
| 26 | API | #95 | AC-20 | Supertest | `priority-status-api.test.ts` — resolve-intent NEW/OPEN/IN_PROGRESS/WAITING → RESOLVED; RESOLVED/CLOSED → REOPENED | Planned |
| 27 | API | #95 | AC-21 | Supertest | `priority-status-api.test.ts` — Requester direct status set to RESOLVED/CLOSED → rejected | Planned |
| 28 | API | #95 | — | Supertest | `priority-status-api.test.ts` — resolve-intent on CANCELLED → 400; foreign user → 403 | Planned |
| 29 | API | #101 | AC-22 | Supertest | `communication-api.test.ts` — public comments fetch/post per visibility (owner requester + staff) | Planned |
| 30 | API | #101 | AC-23 | Supertest | `communication-api.test.ts` — Requester GET/POST notes → 403, zero note content leaked | Planned |
| 31 | API | #101 | AC-24 | Supertest | `communication-api.test.ts` — empty/whitespace comment/note → 400 | Planned |
| 32 | API | #101 | AC-25 | Supertest | `communication-api.test.ts` — no edit/delete routes; PUT/DELETE on comments/notes → 404/405 | Planned |
| 33 | API | #103 | AC-26 | Supertest | `admin-api.test.ts` — list/search, create, edit (basic + single role), activate/deactivate, reset-password | Planned |
| 34 | API | #103 | AC-27 | Supertest | `admin-api.test.ts` — duplicate email create/update → 409, existing user untouched | Planned |
| 35 | API | #103 | AC-28 | Supertest | `admin-api.test.ts` — admin self-deactivation → 400, stays active | Planned |
| 36 | API | #103 | AC-29 | Supertest | `admin-api.test.ts` — last-admin deactivation/downgrade → 400 | Planned |
| 37 | API | #103 | AC-30 | Supertest | `admin-api.test.ts` — non-admin on admin endpoints → 403 | Planned |
| 38 | API | #103 | AC-31 / BR-12 | Supertest | `admin-api.test.ts` — no DELETE route for users (404/405) | Planned |
| 39 | API | #92 | BR-01 | Supertest | `auth-api.test.ts` — passwordHash never present in any user response | Planned |
| 40 | UI | #93 | AC-01 | Vitest/RTL | `Login.test.tsx` — renders, client validation, loading/disabled, role home redirect | Planned |
| 41 | UI | #93 | AC-02/03 | Vitest/RTL | `Login.test.tsx` — safe 401 banner; no account-state hints | Planned |
| 42 | UI | #93 | AC-06/07 | Vitest/RTL | `ChangePassword.test.tsx` — mandatory screen, confirm validation, success clears gate | Planned |
| 43 | UI | #94 | — | Vitest/RTL | `AppShell.test.tsx` — role-aware nav (Requester vs IT vs Admin), user chip + logout, no dev selector | Planned |
| 44 | UI | #97 | AC-14 | Vitest/RTL | `TicketQueue.test.tsx` — table (desktop) vs cards (mobile), filters/search/pagination | Planned |
| 45 | UI | #97 | AC-14 | Vitest/RTL | `TicketQueue.test.tsx` — loading/empty/no-results/error states | Planned |
| 46 | UI | #100 | AC-17 | Vitest/RTL | `StaffTicketDetail.test.tsx` — requestedPriority read-only; IT priority editor saves | Planned |
| 47 | UI | #100 | AC-15/16 | Vitest/RTL | `StaffTicketDetail.test.tsx` — Claim and Reassign (picker validated to IT/Admin) | Planned |
| 48 | UI | #100 | AC-18/19 | Vitest/RTL | `StaffTicketDetail.test.tsx` — status action buttons reflect only legal matrix edges | Planned |
| 49 | UI | #102 | AC-22 | Vitest/RTL | `StaffTicketDetail.test.tsx` — public comments composer + list | Planned |
| 50 | UI | #102 | AC-23/BR-21 | Vitest/RTL | `StaffTicketDetail.test.tsx` — internal notes distinct (yellow + lock), append-only editors | Planned |
| 51 | UI | #102 | BR-19 | Vitest/RTL | `StaffTicketDetail.test.tsx` — no edit/delete affordances in comment/note panels | Planned |
| 52 | UI | #95 | AC-20/21 | Vitest/RTL | `RequesterTicketDetail.test.tsx` — resolve-intent button states per status; no direct resolved/closed control | Planned |
| 53 | UI | #102 | BR-18 | Vitest/RTL | `RequesterTicketDetail.test.tsx` — internal notes section never rendered for Requester | Planned |
| 54 | UI | #102/100 | AC-22 | Vitest/RTL | `RequesterTicketDetail.test.tsx` — public comments read + post on own ticket | Planned |
| 55 | UI | #104 | AC-26 | Vitest/RTL | `AdminUsers.test.tsx` — table + single search; create/edit forms with single-role select | Planned |
| 56 | UI | #104 | AC-27/28/29 | Vitest/RTL | `AdminUsers.test.tsx` — 409 duplicate + self-deactivate + last-admin guard feedback | Planned |
| 57 | UI | #104 | AC-31/BR-12 | Vitest/RTL | `AdminUsers.test.tsx` — no Delete control; reset-password flow present | Planned |
| 58 | UI Style | all | — | Vitest/RTL (CSS) | `uiStyle.test.tsx` — Zen Green tokens, read-only token, internal-note yellow/lock, all 8 status badges | Planned |
| 59 | UI Style | #94 | BR-05 | Vitest/RTL | `uiStyle.test.tsx` — 403 screen respected; buttons hidden are visual only (server tests cover truth) | Planned |
| 60 | Responsive | #97 | AC-14 | Playwright | `e2e/lab-03/auth-flow.spec.ts` — login + first-login change + home at all viewports | Planned |
| 61 | Responsive | #109 | — | Playwright | responsive screenshot matrix desktop/tablet/mobile (login, queue, detail, users) | Planned |
| 62 | E2E | #107 | AC-01–AC-07 | Playwright | `e2e/lab-03/auth-flow.spec.ts` — login → change password → reach home → logout | Planned |
| 63 | E2E | #107 | AC-14–AC-19 | Playwright | `e2e/lab-03/staff-workflow.spec.ts` — IT login → claim → IT priority → status transition → comment + note | Planned |
| 64 | E2E | #107 | AC-22/23 | Playwright | `e2e/lab-03/staff-workflow.spec.ts` — requester sees public comment, never the internal note | Planned |
| 65 | E2E | #107 | AC-26–AC-29 | Playwright | `e2e/lab-03/admin-flow.spec.ts` — create user, 409 duplicate, self-deactivate blocked, reset → next-login change | Planned |
| 66 | E2E | #107 | AC-20 | Playwright | `e2e/lab-03/requester-resolve.spec.ts` — resolve-intent RESOLVED then REOPENED flow | Planned |

---

## 2. Test Files by Directory

Full planned test paths, grouped per the Issue #89 acceptance criteria:

### `server/tests/lab-03/` (API / Unit / Database-Seed — Supertest + Vitest)
* `server/tests/lab-03/migration-seed.test.ts` — AC-32, AC-33; migration mapping + idempotent seed (rows 1–4)
* `server/tests/lab-03/auth-api.test.ts` — AC-01–AC-08, AC-11; login/logout/me/change-password (rows 5–13, 39)
* `server/tests/lab-03/identity-rbac.test.ts` — AC-09–AC-13; requesterId strip + role/ownership guards (rows 14–17)
* `server/tests/lab-03/staff-queue-api.test.ts` — AC-14; GET /api/staff/tickets (rows 18–20)
* `server/tests/lab-03/ownership-api.test.ts` — AC-15, AC-16; claim/assign (rows 21–22)
* `server/tests/lab-03/priority-status-api.test.ts` — AC-17–AC-21; it-priority + workflow matrix + resolve-intent (rows 23–28)
* `server/tests/lab-03/communication-api.test.ts` — AC-22–AC-25; comments/notes visibility + append-only (rows 29–32)
* `server/tests/lab-03/admin-api.test.ts` — AC-26–AC-31; user management + safety guards (rows 33–38)

### `client/src/__tests__/lab-03/` (UI component + UI style — Vitest + RTL)
* `client/src/__tests__/lab-03/Login.test.tsx` — AC-01–AC-03; safe banner, validation, redirect (rows 40–41)
* `client/src/__tests__/lab-03/ChangePassword.test.tsx` — AC-06, AC-07; mandatory flow (row 42)
* `client/src/__tests__/lab-03/AppShell.test.tsx` — role-aware nav + logout, no dev selector (row 43)
* `client/src/__tests__/lab-03/TicketQueue.test.tsx` — AC-14; table/cards + filters + states (rows 44–45)
* `client/src/__tests__/lab-03/StaffTicketDetail.test.tsx` — AC-15–AC-19, AC-22, AC-23, AC-25 (rows 46–51)
* `client/src/__tests__/lab-03/RequesterTicketDetail.test.tsx` — AC-20–AC-23; resolve-intent + comments (rows 52–54)
* `client/src/__tests__/lab-03/AdminUsers.test.tsx` — AC-26–AC-29, AC-31; admin console + guards (rows 55–57)
* `client/src/__tests__/lab-03/uiStyle.test.tsx` — tokens, read-only token, notes yellow/lock, 8 status badges (rows 58–59)

### `e2e/lab-03/` (Playwright — End-to-End across 3 viewports)
* `e2e/lab-03/auth-flow.spec.ts` — AC-01–AC-07; login → first-login change → home → logout (rows 60, 62)
* `e2e/lab-03/staff-workflow.spec.ts` — AC-14–AC-19, AC-22, AC-23; claim → priority → status → comment/note (rows 63–64)
* `e2e/lab-03/admin-flow.spec.ts` — AC-26–AC-29; create user, 409, self-deactivate blocked, reset (row 65)
* `e2e/lab-03/requester-resolve.spec.ts` — AC-20, AC-21; RESOLVED then REOPENED flow (row 66)

Responsive screenshot matrix (row 61) is captured directly into the final report under Issue #109, following the Lab 2 convention (visual checklist, not a test artifact).

---

## 3. Traceability Matrix (AC → API / UI / E2E test files)

Every AC links to at least one test file at each applicable level (`—` = no test required at that level). Full paths are in §2; names below are file stems.

| AC | API (`server/tests/lab-03/`) | UI (`client/src/__tests__/lab-03/`) | E2E (`e2e/lab-03/`) |
|----|------------------------------|-------------------------------------|----------------------|
| AC-01 | `auth-api.test.ts` | `Login.test.tsx` | `auth-flow.spec.ts` |
| AC-02 | `auth-api.test.ts` | `Login.test.tsx` | `auth-flow.spec.ts` |
| AC-03 | `auth-api.test.ts` | `Login.test.tsx` | `auth-flow.spec.ts` |
| AC-04 | `auth-api.test.ts` | — | `auth-flow.spec.ts` |
| AC-05 | `auth-api.test.ts` | — | `auth-flow.spec.ts` |
| AC-06 | `auth-api.test.ts` | `ChangePassword.test.tsx` | `auth-flow.spec.ts` |
| AC-07 | `auth-api.test.ts` | `ChangePassword.test.tsx` | `auth-flow.spec.ts` |
| AC-08 | `auth-api.test.ts` | — | — |
| AC-09 | `identity-rbac.test.ts` | — | — |
| AC-10 | `identity-rbac.test.ts` | `RequesterTicketDetail.test.tsx` | — |
| AC-11 | `auth-api.test.ts` | — | — |
| AC-12 | `identity-rbac.test.ts` | — | — |
| AC-13 | `identity-rbac.test.ts` | — | — |
| AC-14 | `staff-queue-api.test.ts` | `TicketQueue.test.tsx` | `staff-workflow.spec.ts` |
| AC-15 | `ownership-api.test.ts` | `StaffTicketDetail.test.tsx` | `staff-workflow.spec.ts` |
| AC-16 | `ownership-api.test.ts` | `StaffTicketDetail.test.tsx` | — |
| AC-17 | `priority-status-api.test.ts` | `StaffTicketDetail.test.tsx` | `staff-workflow.spec.ts` |
| AC-18 | `priority-status-api.test.ts` | `StaffTicketDetail.test.tsx` | `staff-workflow.spec.ts` |
| AC-19 | `priority-status-api.test.ts` | `StaffTicketDetail.test.tsx` | — |
| AC-20 | `priority-status-api.test.ts` | `RequesterTicketDetail.test.tsx` | `requester-resolve.spec.ts` |
| AC-21 | `priority-status-api.test.ts` | `RequesterTicketDetail.test.tsx` | `requester-resolve.spec.ts` |
| AC-22 | `communication-api.test.ts` | `StaffTicketDetail.test.tsx` + `RequesterTicketDetail.test.tsx` | `staff-workflow.spec.ts` |
| AC-23 | `communication-api.test.ts` | `StaffTicketDetail.test.tsx` + `RequesterTicketDetail.test.tsx` | `staff-workflow.spec.ts` |
| AC-24 | `communication-api.test.ts` | — | — |
| AC-25 | `communication-api.test.ts` | `StaffTicketDetail.test.tsx` | — |
| AC-26 | `admin-api.test.ts` | `AdminUsers.test.tsx` | `admin-flow.spec.ts` |
| AC-27 | `admin-api.test.ts` | `AdminUsers.test.tsx` | `admin-flow.spec.ts` |
| AC-28 | `admin-api.test.ts` | `AdminUsers.test.tsx` | `admin-flow.spec.ts` |
| AC-29 | `admin-api.test.ts` | `AdminUsers.test.tsx` | `admin-flow.spec.ts` |
| AC-30 | `admin-api.test.ts` | `uiStyle.test.tsx` | — |
| AC-31 | `admin-api.test.ts` | `AdminUsers.test.tsx` | — |
| AC-32 | `migration-seed.test.ts` | — | — |
| AC-33 | `migration-seed.test.ts` | — | — |

Rows 4, 20, 28, 39, 43, 53, 58–61 are traced to specific BRs / required test levels rather than a single numbered AC (they verify preconditions, cross-cutting rules, or a mandatory level — matching the Lab 2 traceability convention).

---

## 4. Evidence

To be completed under Issue #105 (server suite), #106 (client/UI suite), and #107 (Playwright E2E). Paste full passing terminal output per suite here, plus responsive screenshot rows under Issue #109.

---

*End of test plan. Traceability conforms to `specification.md` §11 (AC-01–AC-33) and §8/§10; §2 lists all test paths and §3 maps each AC to API/UI/E2E test files (Issue #89 acceptance criteria).*