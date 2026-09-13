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

## 2. Acceptance-Criterion Traceability

| AC | Covered By Test # |
|----|--------------------|
| AC-01 | 5, 40 |
| AC-02 | 6, 41 |
| AC-03 | 7, 41 |
| AC-04 | 8 |
| AC-05 | 9 |
| AC-06 | 10, 42 |
| AC-07 | 11, 42 |
| AC-08 | 12 |
| AC-09 | 14 |
| AC-10 | 15 |
| AC-11 | 13 |
| AC-12 | 16 |
| AC-13 | 17 |
| AC-14 | 18, 19, 44, 45 |
| AC-15 | 21, 47 |
| AC-16 | 22, 47 |
| AC-17 | 23, 46 |
| AC-18 | 24, 48, 63 |
| AC-19 | 25, 48 |
| AC-20 | 26, 52, 66 |
| AC-21 | 27, 52 |
| AC-22 | 29, 49, 54, 64 |
| AC-23 | 30, 50, 64 |
| AC-24 | 31 |
| AC-25 | 32, 51 |
| AC-26 | 33, 55, 65 |
| AC-27 | 34, 56, 65 |
| AC-28 | 35, 56, 65 |
| AC-29 | 36, 56, 65 |
| AC-30 | 37 |
| AC-31 | 38, 57 |
| AC-32 | 2 |
| AC-33 | 1, 3, 4 |

Rows 4, 20, 28, 39, 43, 53, 58–61 are traced to specific BRs / required test levels rather than a single numbered AC (they verify preconditions, cross-cutting rules, or a mandatory level — matching the Lab 2 traceability convention).

---

## 3. Evidence

To be completed under Issue #105 (server suite), #106 (client/UI suite), and #107 (Playwright E2E). Paste full passing terminal output per suite here, plus responsive screenshot rows under Issue #109.

---

*End of test plan. Traceability conforms to `specification.md` §11 (AC-01–AC-33) and §8/§10.*