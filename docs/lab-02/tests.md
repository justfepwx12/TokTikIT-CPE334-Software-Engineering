# Lab 2 – Test Plan

| | |
| :--- | :--- |
| **Related doc** | `specification.md` §9 (Acceptance Criteria), §10 (Definition of Done) |
| **Related Issue** | #29 *Lab 2 Engineering Contract (Spec-DD)* → sub-issue #40 *Draft tests.md* |
| **Status** | Planned only. This issue is documentation-only (no implementation code), so no automated tests have been run yet. The "Result" column moves from `Planned` to `Pass` as each implementation Issue (41–65) is completed and evidence is pasted below §3, matching the `docs/lab-01/tests.md` convention. |

All test files will live under:
*   **Backend unit/integration tests**: `server/tests/lab-02/`
*   **Frontend UI unit/integration tests**: `client/tests/lab-02/`
*   **E2E tests**: `client/tests/lab-02/flow.spec.ts` (Playwright)

File names below are split by concern rather than the single per-screen names shown in the labsheet's example minimum structure (§12); see `specification.md` AD-12 for the rationale and the mapping to that example structure.

---

## 1. Planned-Test Table

Per labsheet §9.2, planned coverage spans all six required levels: **Unit, API, UI (component), UI Style, Responsive, and E2E**. The `Level` column below makes each explicit.

| # | Level | Related Issue | AC | Tool | Test | Result |
|---|-------|---|---|------|------|--------|
| 1 | Unit | Issue 52 | — | Vitest | `server/tests/lab-02/ticketNumber.unit.test.ts` — pure `generateTicketNo(date, seq)` helper returns `TK-YYYYMMDD-XXXX` format with zero-padded 4-digit counter, no DB access | Planned |
| 2 | Unit | Issue 60 | BR-20 | Vitest | `server/tests/lab-02/safeFilename.unit.test.ts` — storage-name generator returns a UUID-based name, rejects/strips path-traversal input (`../`, absolute paths, embedded separators) in the original filename before it is ever used for display metadata | Planned |
| 3 | Database/Seed | Issue 41–44 | — | Prisma Client / Vitest | `server/tests/lab-02/database.test.ts` — seeds exactly 5 Requesters (4 active, 1 inactive), the 4 Categories with the exact labsheet names ("Account and Access", "Hardware", "Software", "Network"), ≥6 Related Systems; seed is idempotent | Planned |
| 4 | Database/Seed | Issue 41–44 | — | Prisma Client / Vitest | `server/tests/lab-02/database.test.ts` — foreign key relationships (Ticket→Requester/Category/System, Attachment→Ticket) resolve correctly | Planned |
| 5 | API | Issue 48 | AC-07 | Supertest | `server/tests/lab-02/requesters.test.ts` — GET `/api/requesters` returns HTTP 200 | Planned |
| 6 | API | Issue 48 | AC-07 | Supertest | `server/tests/lab-02/requesters.test.ts` — inactive Requester is excluded from the response | Planned |
| 7 | API | Issue 43 | — | Supertest | `server/tests/lab-02/categories.test.ts` — GET `/api/categories` returns exactly the four labsheet-mandated names, in any order | Planned |
| 8 | API | Issue 52 | AC-01 | Supertest / Vitest | `server/tests/lab-02/tickets.test.ts` — POST `/api/tickets` creates a ticket and returns a `TK-YYYYMMDD-XXXX` number | Planned |
| 9 | API | Issue 52 | AC-17 | Supertest / Vitest | `server/tests/lab-02/tickets.test.ts` — three same-day tickets get sequential numbers `0001`→`0003` with no duplicates | Planned |
| 10 | API | Issue 52 | AC-02 | Supertest / Vitest | `server/tests/lab-02/tickets.test.ts` — Title/Description outside length bounds returns HTTP 400 | Planned |
| 11 | API | Issue 56 | AC-13 | Supertest / Vitest | `server/tests/lab-02/tickets.test.ts` — list defaults to `createdAt` descending when no `sort`/`order` supplied | Planned |
| 12 | API | Issue 56 | AC-14 | Supertest / Vitest | `server/tests/lab-02/tickets.test.ts` — invalid `sort`, non-numeric `page`, or out-of-range `limit` returns HTTP 400 | Planned |
| 13 | API | Issue 60 | AC-20 | Supertest / Vitest | `server/tests/lab-02/attachments.test.ts` — uploading a file > 5 MB returns HTTP 413 | Planned |
| 14 | API | Issue 60 | AC-20 | Supertest / Vitest | `server/tests/lab-02/attachments.test.ts` — uploading a disallowed MIME type returns HTTP 415 | Planned |
| 15 | API | Issue 60 | AC-19 | Supertest / Vitest | `server/tests/lab-02/attachments.test.ts` — uploading a 6th active attachment returns HTTP 400 | Planned |
| 16 | API | Issue 60 | BR-20 | Supertest / Vitest | `server/tests/lab-02/attachments.test.ts` — two uploads sharing the same original filename are stored without collision (distinct UUID-based storage names) | Planned |
| 17 | API | Issue 60 | — | Supertest / Vitest | `server/tests/lab-02/attachmentMetadata.test.ts` — GET `/api/attachments/:id` returns metadata only (200), including for a soft-removed attachment; unknown ID returns 404; non-owner returns 403 | Planned |
| 18 | API | Issue 60 | AC-21 | Supertest / Vitest | `server/tests/lab-02/attachments.test.ts` — PATCH `/api/attachments/:id/remove` with blank `removalReason` returns HTTP 400 | Planned |
| 19 | API | Issue 60 | AC-22 | Supertest / Vitest | `server/tests/lab-02/attachments.test.ts` — valid soft-removal sets `isRemoved: true`, stores the reason, keeps metadata visible | Planned |
| 20 | API | Issue 60 | AC-23 | Supertest / Vitest | `server/tests/lab-02/attachments.test.ts` — downloading a removed attachment returns HTTP 410 | Planned |
| 21 | API | Issue 60 | AC-24 | Supertest / Vitest | `server/tests/lab-02/attachments.test.ts` — non-owner soft-remove/download attempt returns HTTP 403 | Planned |
| 22 | API | Issue 59 | AC-10 | Supertest / Vitest | `server/tests/lab-02/tickets.test.ts` — Requester B cannot GET a ticket owned by Requester A (HTTP 403); unknown ID returns 404 | Planned |
| 23 | UI | Issue 49, 51 | AC-06 | Vitest / Testing Library | `client/tests/lab-02/Header.test.tsx` — Simulation-Mode warning banner shows when no Requester is selected | Planned |
| 24 | UI | Issue 49, 50 | AC-08 | Vitest / Testing Library | `client/tests/lab-02/RequesterSelection.test.tsx` — dedicated Selection screen renders title, explanation, dropdown of active Requesters, and Continue button; selecting one and continuing updates simulated context | Planned |
| 25 | UI | Issue 50 | AC-09 | Vitest / Testing Library | `client/tests/lab-02/RequesterSelection.test.tsx` — selected Requester persists across a simulated refresh (localStorage) | Planned |
| 26 | UI | Issue 48, 49 | — | Vitest / Testing Library | `client/tests/lab-02/RequesterSelection.test.tsx` — renders loading state, empty state (no active Requesters), and safe API-failure state, each with distinct messaging | Planned |
| 27 | UI | Issue 53, 54 | AC-02 | Vitest / Testing Library | `client/tests/lab-02/CreateTicket.test.tsx` — inline validation error appears below the invalid field | Planned |
| 28 | UI | Issue 55 | AC-03 | Vitest / Testing Library | `client/tests/lab-02/CreateTicket.test.tsx` — Submit button disables and shows a loading indicator during POST; a second click does not double-submit | Planned |
| 29 | UI | Issue 53, 55 | AC-04 | Vitest / Testing Library | `client/tests/lab-02/CreateTicket.test.tsx` — simulated API failure preserves all entered field values | Planned |
| 30 | UI | Issue 62 | AC-05 | Vitest / Testing Library | `client/tests/lab-02/CreateTicket.test.tsx` — staged oversized/invalid-type file is rejected client-side before submit | Planned |
| 31 | UI | Issue 55 | AC-01 | Vitest / Testing Library | `client/tests/lab-02/CreateTicket.test.tsx` — success screen shows the generated Ticket Number from the response | Planned |
| 32 | UI | Issue 58 | AC-11, AC-12 | Vitest / Testing Library | `client/tests/lab-02/MyTickets.test.tsx` — search input and filters dispatch correct combined query parameters; Clear Filters resets them | Planned |
| 33 | UI | Issue 57 | AC-15 | Vitest / Testing Library | `client/tests/lab-02/MyTickets.test.tsx` — empty state vs. no-results state render distinct messages | Planned |
| 34 | UI | Issue 58 | AC-26 | Vitest / Testing Library | `client/tests/lab-02/MyTickets.test.tsx` — filter/pagination controls are keyboard-operable with visible focus | Planned |
| 35 | UI | Issue 61 | AC-16 | Vitest / Testing Library | `client/tests/lab-02/RequesterTicketDetail.test.tsx` — renders all fields read-only with correct priority/status badges | Planned |
| 36 | UI Style | Issue 47, 53, 61 | — | Vitest / Testing Library (CSS-class assertions) | `client/tests/lab-02/uiStyle.test.tsx` — required CSS classes/tokens are applied: read-only fields use the ivory/gray-green read-only token (distinct from editable), required-field asterisks are present alongside (never instead of) the validation message, and status/priority badges always render a text label, not color alone | Planned |
| 37 | UI Style | Issue 65 | — | Playwright screenshot diff | `client/tests/lab-02/flow.spec.ts` (style pass) — Zen Green color tokens (`#006B3C`, `#0B7A46`, `#EAF6EF`, etc.) render on header, primary buttons, and badges as specified in `ui-spec.md` | Planned |
| 38 | Responsive | Issue 57 | AC-25 | Vitest / Testing Library | `client/tests/lab-02/MyTickets.test.tsx` — renders a table at desktop width (`≥ 992px`) and stacked cards at mobile width (`< 768px`) | Planned |
| 39 | Responsive | Issue 65 | AC-25 | Playwright (viewport screenshots) | `client/tests/lab-02/flow.spec.ts` — captures Desktop (992px+), Tablet (768–991px), and Mobile (<768px) screenshots of Create Ticket, My Tickets, and Ticket Detail into `artifacts/lab-02/screenshots/`; visual checklist confirms no clipping/overlap/horizontal scroll | Planned |
| 40 | E2E | Issue 64 | AC-18 | Playwright | `client/tests/lab-02/flow.spec.ts` — select active Requester on the dedicated Selection screen → create ticket with attachment → verify creation → see ticket in My Tickets | Planned |

---

## 2. Acceptance-Criterion Traceability

| AC | Covered By Test # |
|----|--------------------|
| AC-01 | 8, 31 |
| AC-02 | 10, 27 |
| AC-03 | 28 |
| AC-04 | 29 |
| AC-05 | 30 |
| AC-06 | 23 |
| AC-07 | 5, 6 |
| AC-08 | 24 |
| AC-09 | 25 |
| AC-10 | 22 |
| AC-11 | 32 |
| AC-12 | 32 |
| AC-13 | 11 |
| AC-14 | 12 |
| AC-15 | 33 |
| AC-16 | 35 |
| AC-17 | 9 |
| AC-18 | 40 |
| AC-19 | 15 |
| AC-20 | 13, 14 |
| AC-21 | 18 |
| AC-22 | 19 |
| AC-23 | 20 |
| AC-24 | 21 |
| AC-25 | 38, 39 |
| AC-26 | 34 |

Every AC in `specification.md` §9 (AC-01–AC-26) maps to at least one planned test above; every planned test names its real (future) test-file path. Database/seed tests (rows 3–4), the two unit tests (rows 1–2), the safe-filename/collision tests (rows 2, 16), the Categories exact-names test (row 7), the attachment-metadata test (row 17), the empty/failure-state Selection test (row 26), the UI Style tests (rows 36–37), and the dedicated responsive screenshot pass (row 39) are traced to labsheet requirements (§4.5 safe storage, §5.3 seed names, §6 metadata capability, §8.1 Selection Screen, §9.2 minimum test levels) rather than to a single numbered AC, since they verify preconditions, cross-cutting rules, or a required test *level* rather than one user-observable outcome.

---

## 3. Evidence

*(No evidence yet — Issue #29 is documentation-only. Once Issues 41–65 are implemented and merged, paste passing terminal output here per test, following the same format as `docs/lab-01/tests.md`, e.g.:)*

```text
$ pnpm test
$ vitest run

 ✓ tests/lab-02/tickets.test.ts (2)
   ✓ POST /api/tickets (2)
     ✓ creates a ticket and generates TK-YYYYMMDD-XXXX
     ✓ increments sequentially within the same day

Test Files  1 passed (1)
     Tests  2 passed (2)
```
