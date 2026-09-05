# Lab 2 – Test Plan and Evidence

All test files live under `server/tests/` and `client/tests/lab-02/` (E2E: `client/tests/lab-02/flow.spec.ts`).

Per labsheet §9.2, planned coverage spans all six required levels: **Unit, API, UI (component), UI Style, Responsive, and E2E**. Every AC in `specification.md` §9 (AC-01–AC-26) maps to at least one test below; see §2 for the AC → Test traceability matrix.

**Current status (light = fully done):** server **6 files / 21 tests pass**, client **6 files / 33 tests pass** — API suite covers Health, Categories, Systems, Requesters, Create Ticket (POST), and My Tickets (GET); UI suite covers header/forms/requester selection, Create Ticket, and My Tickets screens. Unit, Perf, and E2E rows below remain `Planned`.

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
| 11 | API | Issue 56 | AC-13 | Supertest/Vitest | `tickets-list.test.ts` — default sort `createdAt desc` | Planned |
| 12 | API | Issue 56 | AC-14 | Supertest/Vitest | `tickets-list.test.ts` — invalid sort/page/limit → 400 | Pass |
| 13 | API | Issue 60 | AC-20 | Supertest/Vitest | `attachments.test.ts` — file >5MB → 413 | Planned |
| 14 | API | Issue 60 | AC-20 | Supertest/Vitest | `attachments.test.ts` — bad MIME type → 415 | Planned |
| 15 | API | Issue 60 | AC-19 | Supertest/Vitest | `attachments.test.ts` — 6th active attachment → 400 | Planned |
| 16 | API | Issue 60 | BR-20 | Supertest/Vitest | `attachments.test.ts` — duplicate filenames, no collision | Planned |
| 17 | API | Issue 60 | — | Supertest/Vitest | `attachmentMetadata.test.ts` — metadata GET (200/404/403) | Planned |
| 18 | API | Issue 60 | AC-21 | Supertest/Vitest | `attachments.test.ts` — blank removalReason → 400 | Planned |
| 19 | API | Issue 60 | AC-22 | Supertest/Vitest | `attachments.test.ts` — soft-remove sets isRemoved+reason | Planned |
| 20 | API | Issue 60 | AC-23 | Supertest/Vitest | `attachments.test.ts` — download removed file → 410 | Planned |
| 21 | API | Issue 60 | AC-24 | Supertest/Vitest | `attachments.test.ts` — non-owner action → 403 | Planned |
| 22 | API | Issue 55 | AC-10 | Supertest/Vitest | `tickets-list.test.ts` — cross-requester GET → own-list only / 403 | Pass |
| 23 | UI | Issue 49, 51 | AC-06 | Vitest/RTL | `Header.test.tsx` — Simulation-Mode banner shows | Planned |
| 24 | UI | Issue 49, 50 | AC-08 | Vitest/RTL | `RequesterSelection.test.tsx` — renders + selects requester | Pass |
| 25 | UI | Issue 50 | AC-09 | Vitest/RTL | `RequesterSelection.test.tsx` — persists via localStorage | Pass |
| 26 | UI | Issue 48, 49 | — | Vitest/RTL | `RequesterSelection.test.tsx` — loading/empty/error states | Planned |
| 27 | UI | Issue 53, 54 | AC-02 | Vitest/RTL | `CreateTicket.test.tsx` — inline error below field | Pass |
| 28 | UI | Issue 55 | AC-03 | Vitest/RTL | `CreateTicket.test.tsx` — busy state, no double-submit | Pass |
| 29 | UI | Issue 53, 55 | AC-04 | Vitest/RTL | `CreateTicket.test.tsx` — API failure preserves fields | Planned |
| 30 | UI | Issue 62 | AC-05 | Vitest/RTL | `CreateTicket.test.tsx` — invalid file rejected pre-submit | Planned |
| 31 | UI | Issue 55 | AC-01 | Vitest/RTL | `CreateTicket.test.tsx` — success shows ticket number | Planned |
| 32 | UI | Issue 58 | AC-11, AC-12 | Vitest/RTL | `MyTickets.test.tsx` — search/filter query params | Pass |
| 33 | UI | Issue 57 | AC-15 | Vitest/RTL | `MyTickets.test.tsx` — empty vs. no-results states | Pass |
| 34 | UI | Issue 58 | AC-26 | Vitest/RTL | `MyTickets.test.tsx` — keyboard-operable controls | Planned |
| 35 | UI | Issue 61 | AC-16 | Vitest/RTL | `RequesterTicketDetail.test.tsx` — read-only + badges | Planned |
| 36 | UI Style | Issue 47, 53, 61 | — | Vitest/RTL (CSS) | `uiStyle.test.tsx` — read-only tokens, asterisks, badge text | Planned |
| 37 | UI Style | Issue 65 | — | Playwright | `flow.spec.ts` (style pass) — Zen Green tokens render | Planned |
| 38 | Responsive | Issue 57 | AC-25 | Vitest/RTL | `MyTickets.test.tsx` — table (desktop) vs. cards (mobile) | Pass |
| 39 | Responsive | Issue 65 | AC-25 | Playwright | `flow.spec.ts` — desktop/tablet/mobile screenshots | Planned |
| 40 | E2E | Issue 64 | AC-18 | Playwright | `flow.spec.ts` — full select→create→list flow | Planned |
| 41 | API | Issue 52 | — | Supertest/Vitest | `tickets.test.ts` — non-numeric header → 401 | Pass |
| 42 | API | Issue 52 | — | Supertest/Vitest | `tickets.test.ts` — bad categoryId/systemId → 400 | Pass |
| 43 | API | Issue 52 | — | Supertest/Vitest | `tickets.test.ts` — inactive requester create → 403 | Pass |
| 44 | API | Issue 55 | AC-10 | Supertest/Vitest | `tickets-list.test.ts` — GET is scoped to active requester (401/403) | Pass |
| 45 | API | Issue 55 | — | Supertest/Vitest | `tickets-list.test.ts` — stable shape incl. category + system | Pass |
| 46 | API | Issue 55 | AC-14 | Supertest/Vitest | `tickets-list.test.ts` — pagination `limit`+`page`+`totalPages` | Pass |
| 47 | API | Issue 55 | AC-11 | Supertest/Vitest | `tickets-list.test.ts` — case-insensitive search title/description | Pass |
| 48 | API | Issue 55 | AC-12 | Supertest/Vitest | `tickets-list.test.ts` — filter status + priority | Pass |
| 49 | API | Issue 56 | AC-13 | Supertest/Vitest | `tickets-list.test.ts` — sort priority asc/desc | Pass |
| 50 | UI | Issue 55 | AC-10 | Vitest/RTL | `MyTickets.test.tsx` — passes active requester id as ownership scope | Pass |
| 51 | UI | Issue 56 | AC-13 | Vitest/RTL | `MyTickets.test.tsx` — sort control activates priority sort | Pass |
| 52 | UI | Issue 58 | AC-14 | Vitest/RTL | `MyTickets.test.tsx` — pagination: page 2 refetch | Pass |
| 53 | UI | Issue 55 | — | Vitest/RTL | `MyTickets.test.tsx` — error state + Retry refetch | Pass |
| 54 | UI | Issue 53 | — | Vitest/RTL | `CreateTicket.test.tsx` — dropdowns load categories + systems | Pass |
| 55 | API | Issue 43 | — | Supertest/Vitest | `systems.test.ts` — GET /api/systems seeded names in id order | Pass |

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
| AC-10 | 22, 44, 50 |
| AC-11 | 32, 47 |
| AC-12 | 32, 48 |
| AC-13 | 11, 49, 51 |
| AC-14 | 12, 46, 52 |
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

Rows 1–4, 17, 26, 36–37, 39, 41–42, 45, 53–55 are traced to labsheet requirements or specific BRs rather than a single numbered AC, since they verify preconditions, cross-cutting rules, or a required test *level* rather than one user-observable outcome.

---

## 3. Evidence

Paste your passing terminal output / screenshot below, one section per Issue as it's completed. Current full run (both suites green):

### Server suite — full run
```text
$ vitest run   # cd server

 ✓ tests/health.test.ts (1 test)
 ✓ tests/categories.test.ts (1 test)
 ✓ tests/systems.test.ts (1 test)
 ✓ tests/requesters.test.ts (2 tests)
 ✓ tests/tickets.test.ts (7 tests)
 ✓ tests/tickets-list.test.ts (9 tests)

 Test Files  6 passed (6)
      Tests 21 passed (21)
```

### Client suite — full run
```text
$ vitest run   # cd client

 ✓ tests/lab-02/Badge.test.tsx (3 tests)
 ✓ tests/lab-02/FormComponents.test.tsx (14 tests)
 ✓ tests/lab-02/RequesterSelection.test.tsx (2 tests)
 ✓ tests/lab-02/CreateTicket.test.tsx (3 tests)
 ✓ tests/lab-02/MyTickets.test.tsx (8 tests)
 ✓ tests/lab-01/App.test.tsx (3 tests)

 Test Files  6 passed (6)
      Tests 33 passed (33)
```

### Issue 43: Create and seed IT request categories
**Test File:** `server/tests/categories.test.ts`

```text
 ✓ tests/categories.test.ts (1)
   ✓ returns HTTP 200 and all seeded categories in predictable id order
```

### Issue 43: Related System list
**Test File:** `server/tests/systems.test.ts`

```text
 ✓ tests/systems.test.ts (1)
   ✓ GET /api/systems returns HTTP 200 with seeded systems in id order
```

### Issue 48: Implement a GET API endpoint to fetch only active Development Requesters
**Test File:** `server/tests/requesters.test.ts`

```text
 ✓ tests/requesters.test.ts (2)
   ✓ returns HTTP 200 with only active requesters
   ✓ excludes the seeded inactive requester
```

### Issue 52: Implement a POST API endpoint to save tickets and automatically generate an official Ticket Number
**Test File:** `server/tests/tickets.test.ts`

```text
 ✓ tests/tickets.test.ts (7)
   ✓ should create a ticket and return 201 with generated ticketNo
   ✓ should return 401 Unauthorized when x-requester-id header is missing
   ✓ should return 401 Unauthorized when x-requester-id is not a valid integer
   ✓ should return 400 Bad Request when required fields are invalid/missing
   ✓ should return 400 Bad Request when categoryId does not reference an existing Category
   ✓ should return 400 Bad Request when systemId does not reference an existing Related System
   ✓ should return 403 Forbidden when the Requester is inactive
```

### Issue 55: My Tickets — GET /api/tickets (ownership, search, filter, sort, pagination)
**Test File:** `server/tests/tickets-list.test.ts`

```text
 ✓ tests/tickets-list.test.ts (9)
   ✓ returns HTTP 401 when the x-requester-id header is missing
   ✓ returns HTTP 403 for an inactive or unknown requester
   ✓ owns the list: requester A sees only their tickets
   ✓ returns a stable response shape including category and system
   ✓ paginates: limit + page + totalPages
   ✓ searches case-insensitively on title and description
   ✓ filters by status and priority
   ✓ sorts by priority descending (heaviest first) and ascending
   ✓ rejects invalid sort, page, and limit with HTTP 400
```

### Issue 55: My Tickets screen (UI)
**Test File:** `client/tests/lab-02/MyTickets.test.tsx`

```text
 ✓ tests/lab-02/MyTickets.test.tsx (8)
   ✓ renders desktop table rows and mobile cards with ticket data
   ✓ passes the selected requester id as the ownership scope
   ✓ shows the empty state when there are no tickets and no filters
   ✓ shows the no-results state with Clear Filters when a search matches nothing
   ✓ sends search and filter parameters to the API
   ✓ sorts by priority when the sort control is activated
   ✓ paginates: clicking page 2 refetches with page=2
   ✓ shows an error state with a Retry that refetches
```

### Issue 52: Create Ticket screen (UI)
**Test File:** `client/tests/lab-02/CreateTicket.test.tsx`

```text
 ✓ tests/lab-02/CreateTicket.test.tsx (3)
   ✓ dynamically loads Categories and Related Systems into dropdowns
   ✓ shows field validation errors with red asterisks when submitting empty form
   ✓ shows a busy state on the Submit button during API processing
```

