# Lab 2 – Test Plan and Evidence

All test files live under `server/tests/lab-02/` and `client/tests/lab-02/` (E2E: `client/tests/lab-02/flow.spec.ts`).

Per labsheet §9.2, planned coverage spans all six required levels: **Unit, API, UI (component), UI Style, Responsive, and E2E**. Every AC in `specification.md` §9 (AC-01–AC-26) maps to at least one test below; see §2 for the AC → Test traceability matrix.

---

## 1. Planned-Test Table

| # | Level | Related Issue | AC | Tool | Test | Result |
|---|-------|---|---|------|------|--------|
| 1 | Unit | Issue 52 | — | Vitest | `ticketNumber.unit.test.ts` — `generateTicketNo()` format | Planned |
| 2 | Unit | Issue 60 | BR-20 | Vitest | `safeFilename.unit.test.ts` — safe storage-name generation | Planned |
| 3 | Database/Seed | Issue 41–44 | — | Prisma/Vitest | `database.test.ts` — seed counts & names correct, idempotent | Planned |
| 4 | Database/Seed | Issue 41–44 | — | Prisma/Vitest | `database.test.ts` — FK relationships resolve | Planned |
| 5 | API | Issue 48 | AC-07 | Supertest | `requesters.test.ts` — GET returns 200 | Pass |
| 6 | API | Issue 48 | AC-07 | Supertest | `requesters.test.ts` — excludes inactive | Pass |
| 7 | API | Issue 43 | — | Supertest | `categories.test.ts` — exact 4 seeded names | Pass |
| 8 | API | Issue 52 | AC-01 | Supertest/Vitest | `tickets.test.ts` — POST creates ticket, returns ticketNo | Pass |
| 9 | API | Issue 52 | AC-17 | Supertest/Vitest | `tickets.test.ts` — 3 same-day tickets, sequential nos | Planned |
| 10 | API | Issue 52 | AC-02 | Supertest/Vitest | `tickets.test.ts` — title/description length → 400 | Pass |
| 11 | API | Issue 56 | AC-13 | Supertest/Vitest | `tickets.test.ts` — default sort `createdAt desc` | Planned |
| 12 | API | Issue 56 | AC-14 | Supertest/Vitest | `tickets.test.ts` — invalid sort/page/limit → 400 | Planned |
| 13 | API | Issue 60 | AC-20 | Supertest/Vitest | `attachments.test.ts` — file >5MB → 413 | Planned |
| 14 | API | Issue 60 | AC-20 | Supertest/Vitest | `attachments.test.ts` — bad MIME type → 415 | Planned |
| 15 | API | Issue 60 | AC-19 | Supertest/Vitest | `attachments.test.ts` — 6th active attachment → 400 | Planned |
| 16 | API | Issue 60 | BR-20 | Supertest/Vitest | `attachments.test.ts` — duplicate filenames, no collision | Planned |
| 17 | API | Issue 60 | — | Supertest/Vitest | `attachmentMetadata.test.ts` — metadata GET (200/404/403) | Planned |
| 18 | API | Issue 60 | AC-21 | Supertest/Vitest | `attachments.test.ts` — blank removalReason → 400 | Planned |
| 19 | API | Issue 60 | AC-22 | Supertest/Vitest | `attachments.test.ts` — soft-remove sets isRemoved+reason | Planned |
| 20 | API | Issue 60 | AC-23 | Supertest/Vitest | `attachments.test.ts` — download removed file → 410 | Planned |
| 21 | API | Issue 60 | AC-24 | Supertest/Vitest | `attachments.test.ts` — non-owner action → 403 | Planned |
| 22 | API | Issue 59 | AC-10 | Supertest/Vitest | `tickets.test.ts` — cross-requester GET → 403/404 | Planned |
| 23 | UI | Issue 49, 51 | AC-06 | Vitest/RTL | `Header.test.tsx` — Simulation-Mode banner shows | Planned |
| 24 | UI | Issue 49, 50 | AC-08 | Vitest/RTL | `RequesterSelection.test.tsx` — renders + selects requester | Planned |
| 25 | UI | Issue 50 | AC-09 | Vitest/RTL | `RequesterSelection.test.tsx` — persists via localStorage | Planned |
| 26 | UI | Issue 48, 49 | — | Vitest/RTL | `RequesterSelection.test.tsx` — loading/empty/error states | Planned |
| 27 | UI | Issue 53, 54 | AC-02 | Vitest/RTL | `CreateTicket.test.tsx` — inline error below field | Planned |
| 28 | UI | Issue 55 | AC-03 | Vitest/RTL | `CreateTicket.test.tsx` — busy state, no double-submit | Planned |
| 29 | UI | Issue 53, 55 | AC-04 | Vitest/RTL | `CreateTicket.test.tsx` — API failure preserves fields | Planned |
| 30 | UI | Issue 62 | AC-05 | Vitest/RTL | `CreateTicket.test.tsx` — invalid file rejected pre-submit | Planned |
| 31 | UI | Issue 55 | AC-01 | Vitest/RTL | `CreateTicket.test.tsx` — success shows ticket number | Planned |
| 32 | UI | Issue 58 | AC-11, AC-12 | Vitest/RTL | `MyTickets.test.tsx` — search/filter query params | Planned |
| 33 | UI | Issue 57 | AC-15 | Vitest/RTL | `MyTickets.test.tsx` — empty vs. no-results states | Planned |
| 34 | UI | Issue 58 | AC-26 | Vitest/RTL | `MyTickets.test.tsx` — keyboard-operable controls | Planned |
| 35 | UI | Issue 61 | AC-16 | Vitest/RTL | `RequesterTicketDetail.test.tsx` — read-only + badges | Planned |
| 36 | UI Style | Issue 47, 53, 61 | — | Vitest/RTL (CSS) | `uiStyle.test.tsx` — read-only tokens, asterisks, badge text | Planned |
| 37 | UI Style | Issue 65 | — | Playwright | `flow.spec.ts` (style pass) — Zen Green tokens render | Planned |
| 38 | Responsive | Issue 57 | AC-25 | Vitest/RTL | `MyTickets.test.tsx` — table (desktop) vs. cards (mobile) | Planned |
| 39 | Responsive | Issue 65 | AC-25 | Playwright | `flow.spec.ts` — desktop/tablet/mobile screenshots | Planned |
| 40 | E2E | Issue 64 | AC-18 | Playwright | `flow.spec.ts` — full select→create→list flow | Planned |
| 41 | API | Issue 52 | — | Supertest/Vitest | `tickets.test.ts` — non-numeric header → 401 | Pass |
| 42 | API | Issue 52 | — | Supertest/Vitest | `tickets.test.ts` — bad categoryId/systemId → 400 | Pass |
| 43 | API | Issue 52 | — | Supertest/Vitest | `tickets.test.ts` — inactive requester create → 403 | Pass |

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

Rows 1–4, 17, 26, 36–37, 39, 41–43 are traced to labsheet requirements or specific BRs rather than a single numbered AC, since they verify preconditions, cross-cutting rules, or a required test *level* rather than one user-observable outcome.

---

## 3. Evidence

Paste your passing terminal output / screenshot below, one section per Issue as it's completed:

### Issue 43: Create and seed IT request categories
**Test File:** `server/tests/lab-02/categories.test.ts`

```text
$ pnpm test
$ vitest run

 ✓ tests/categories.test.ts (1)
   ✓ GET /api/categories (1)
     ✓ returns HTTP 200 and all seeded categories in predictable id order

Test Files  1 passed (1)
     Tests  1 passed (1)
```


### Issue 48: Implement a GET API endpoint to fetch only active Development Requesters
**Test File:** `server/tests/lab-02/requesters.test.ts`

```text
$ pnpm test
$ vitest run

 ✓ tests/requesters.test.ts (4)
   ✓ GET /api/requesters (4)
     ✓ returns HTTP 200 with only active requesters, shaped { id, name }
     ✓ returns requesters in ascending alphabetical order by name
     ✓ returns exactly the 4 active seeded requesters by name, in alphabetical order
     ✓ excludes the seeded inactive requester

Test Files  1 passed (1)
     Tests  4 passed (4)
```

### Issue 52: Implement a POST API endpoint to save tickets and automatically generate an official Ticket Number
**Test File:** `server/tests/tickets.test.ts`

```text
$pnpm test$ vitest run

 ✓ tests/categories.test.ts (1)
 ✓ tests/health.test.ts (1)
 ✓ tests/tickets.test.ts (7)

Test Files  3 passed (3)
     Tests  9 passed (9)
```

