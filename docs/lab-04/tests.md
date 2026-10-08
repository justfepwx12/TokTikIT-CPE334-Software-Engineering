# Lab 4 – Test Plan and Evidence

| | |
| :--- | :--- |
| **Related doc** | `specification.md` §11 (AC-34–AC-59) |
| **Related Issue** | #124 *Lab 4 Engineering Contract* → sub-issue #132 *tests.md checklist + formulas* |
| **Implements** | Epic #128 (*Test DD & Final Regression*) → sub-issues #142 (backend), #143 (frontend) |

Planned test files live under `server/tests/lab-04/`, `client/tests/lab-04/`, and `client/tests/e2e/lab-04/` (AD-20 — same grouping as Lab 3 AD-12). Coverage spans all eight required levels — **Unit, API, UI, Responsive, Authorization, Workflow, Migration, E2E** — and every AC in `specification.md` §11 (AC-34–AC-59) maps to at least one row below (§2). All rows start as `Planned`; Epic #128 flips them to `Passed` with evidence.

**Current status:** `Planned` — contract frozen under #124; implementation lands in #133–#141; evidence lands in #142–#143.

---

## 1. Planned-Test Table

| # | Level | Related Issue | AC | Tool | Test | Result |
|---|-------|---------------|----|------|------|--------|
| 1 | Migration | #133 | AC-56 | Vitest/Prisma | `migration-actions.test.ts` — legacy 7-table row counts identical before/after; pre-Lab-4 tickets read zero actions | Planned |
| 2 | Migration/Seed | #134 | AC-57 | Vitest/Prisma | `migration-actions.test.ts` — seed runs twice, identical counts; all 8 states present; 0/1/N action coverage; zero + non-zero dashboard fixtures | Planned |
| 3 | Unit | #135 | AC-35 | Vitest | `action-validation.test.ts` — followUp conditional, skew window, trim/blank rejection | Planned |
| 4 | Unit | #136 | AC-43 | Vitest | `dashboard-formulas.test.ts` — §3 formulas vs hand-computed fixtures (incl. terminal exclusion, UTC-day boundary) | Planned |
| 5 | API | #135 | AC-34 | Supertest | `actions-api.test.ts` — staff create 201, performedBy=me, version=1, body performer ignored | Planned |
| 6 | API | #135 | AC-35 | Supertest | `actions-api.test.ts` — missing note / future actionAt / blank fields → 400, nothing stored | Planned |
| 7 | API | #135 | AC-36 | Supertest | `actions-api.test.ts` — PATCH with current If-Match → 200, version+1 | Planned |
| 8 | API | #137 | AC-37 | Supertest | `actions-concurrency.test.ts` — stale If-Match → 409 STALE_VERSION + currentVersion, row unchanged | Planned |
| 9 | API | #137 | AC-37 | Supertest | `actions-concurrency.test.ts` — two concurrent PATCHes: exactly one 200, one 409, no lost update | Planned |
| 10 | API | #137 | AC-38 | Supertest | `actions-concurrency.test.ts` — replayed Idempotency-Key → original 201, exactly 1 row; reused key + new payload → 422 | Planned |
| 11 | Authorization | #135 | AC-39 | Supertest | `actions-authz.test.ts` — Requester POST/PATCH → 403 on own and foreign tickets | Planned |
| 12 | Authorization | #135 | AC-40 | Supertest | `actions-authz.test.ts` — Requester GET own → 200; foreign → 403/404, no existence leak | Planned |
| 13 | API | #135 | AC-41 | Supertest | `actions-api.test.ts` — newest-first order + pagination across N actions | Planned |
| 14 | API | #136 | AC-42 | Supertest | `dashboard-api.test.ts` — Requester A sees own counts; Requester B sees all zeros; Staff sees only own requested tickets; no bleed | Planned |
| 15 | API | #136 | AC-43 | Supertest | `dashboard-api.test.ts` — staff summary equals direct DB counts (unassigned/mine/followUp/resolvedToday) | Planned |
| 16 | Authorization | #136 | AC-44 | Supertest | `dashboard-api.test.ts` — Requester on staff summary → 403; no session → 401 | Planned |
| 17 | API | #136 | AC-45 | Supertest | `dashboard-api.test.ts` — empty scope returns all-zero metrics; never null/500 | Planned |
| 18 | API | #136 | AC-46 | Supertest | `dashboard-api.test.ts` — every drillDown descriptor (followed with the target list's role; incl. `followUp` + `resolvedToday` filters) resolves to the counted ticket set | Planned |
| 19 | API | #136 | AC-47 | Supertest + query log | `dashboard-api.test.ts` — aggregation in-DB (groupBy/count), no full-table fetch, no N+1 | Planned |
| 20 | UI | #139 | AC-48 | Vitest/RTL | `StaffDashboard.test.tsx` — cards + shortcuts + Loading/Empty/Error + drill-down links | Planned |
| 21 | UI | #138 | AC-49 | Vitest/RTL | `RequesterDashboard.test.tsx` — own-only metrics, empty CTA, no staff metrics rendered | Planned |
| 22 | UI | #140 | AC-50 | Vitest/RTL | `ActionsTaken.test.tsx` — Staff/Admin see List+Create/Edit; Requester read-only; 0/1/N renders | Planned |
| 23 | UI | #140 | AC-51 | Vitest/RTL | `ActionsTaken.test.tsx` — conditional follow-up-note error, blank-field errors, save refreshes list | Planned |
| 24 | UI | #140 | AC-52 | Vitest/RTL | `ActionsTaken.test.tsx` — double-click creates once; draft survives failed save | Planned |
| 25 | UI | #140 | AC-37 | Vitest/RTL | `ActionsTaken.test.tsx` — 409 renders refresh-and-retry banner; refresh reloads latest | Planned |
| 26 | UI Style | #141 | AC-48/49 | Vitest/RTL (CSS) | `lab4Style.test.tsx` — Zen Green tokens on dashboard cards, follow-up amber badge, read-only performer chip | Planned |
| 27 | Responsive | #141 | AC-53 | Playwright | `responsive.spec.ts` — dashboards + detail at 375/768/1280: no page h-scroll, no clipping | Planned |
| 28 | Responsive | #141 | AC-54 | Playwright (keyboard) | `keyboard.spec.ts` — dashboard → drill-down → view → create completes mouse-free with visible focus | Planned |
| 29 | E2E | #143 | AC-34–41 | Playwright | `actions-flow.spec.ts` — staff login → record → edit → stale-retry → requester reads own list | Planned |
| 30 | E2E | #143 | AC-42/46 | Playwright | `requester-dashboard.spec.ts` — requester journey: summary → drill-down → detail → empty-state CTA | Planned |
| 31 | E2E | #143 | AC-43/46 | Playwright | `staff-dashboard.spec.ts` — staff journey: summary → drill-down → queue → record action | Planned |
| 32 | E2E | #143 | AC-55 | Playwright | `lab4-hygiene.spec.ts` — console-error + broken-link sweep across all Lab 4 screens | Planned |
| 33 | Workflow | #128 | AC-59 | Supertest | `workflow-spot.test.ts` — legal matrix edges 200, illegal edges 400 unchanged (Lab 3 matrix) | Planned |
| 34 | Regression | #143 | AC-58 | Playwright | Lab 2+3 journeys re-run (login, create, queue, claim, priorities, transitions, resolve-intent, comments/notes, admin, attachments) — all green, no skips | Planned |
| 35 | API | #136 | AC-42/43 | Supertest | `dashboard-api.test.ts` — recording a newer `followUpRequired=false` action clears the ticket from follow-up metrics and the `followUp=true` filter (AD-18) | Planned |

---

## 2. Traceability Matrix (AC → test rows)

| AC | Rows | AC | Rows | AC | Rows |
| :--- | :--- | :--- | :--- | :--- | :--- |
| AC-34 | 5 | AC-43 | 4, 15, 35 | AC-52 | 24 |
| AC-35 | 3, 6 | AC-44 | 16 | AC-53 | 27 |
| AC-36 | 7 | AC-45 | 17 | AC-54 | 28 |
| AC-37 | 8, 9, 25 | AC-46 | 18, 30, 31 | AC-55 | 32 |
| AC-38 | 10 | AC-47 | 4, 19 | AC-56 | 1 |
| AC-39 | 11 | AC-48 | 20, 26 | AC-57 | 2 |
| AC-40 | 12 | AC-49 | 21, 26 | AC-58 | 34 |
| AC-41 | 13, 29 | AC-50 | 22 | AC-59 | 33 |
| AC-42 | 14, 30, 35 | AC-51 | 23 | | |

Every AC-34–AC-59 has ≥ 1 row; no row is skipped or pending-implementation by design.

---

## 3. Dashboard Formulas (executable reference for rows 4, 15)

Pseudo-SQL against the Lab 3 schema + `ActionTaken` (§9). `NON_TERMINAL = ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED')`.

```sql
-- Requester scope: all predicates include requesterId = :me (BR-25)
myOpen    = COUNT(*) FROM Ticket WHERE requesterId=:me AND status IN ('NEW','OPEN','IN_PROGRESS');
myWaiting = COUNT(*) FROM Ticket WHERE requesterId=:me AND status='WAITING_FOR_REQUESTER';
my{Resolved,Closed,Reopened,Cancelled} = COUNT(*) ... per status;
myFollowUpOpen = COUNT(DISTINCT t.id) FROM Ticket t JOIN ActionTaken a ON a.ticketId=t.id
  WHERE t.requesterId=:me AND t.status IN NON_TERMINAL AND a.followUpRequired=true
  AND a.id = (SELECT MAX(a2.id) FROM ActionTaken a2 WHERE a2.ticketId=t.id); -- latest recorded action only (AD-18)

-- Staff scope (BR-25): terminal CLOSED/CANCELLED excluded from attention buckets
unassignedCount  = COUNT(*) FROM Ticket WHERE ownerId IS NULL AND status IN NON_TERMINAL;
myAssignedCount  = COUNT(*) FROM Ticket WHERE ownerId=:me AND status IN NON_TERMINAL;
myInProgressCount= COUNT(*) FROM Ticket WHERE ownerId=:me AND status='IN_PROGRESS';
waitingForRequesterCount = COUNT(*) FROM Ticket WHERE status='WAITING_FOR_REQUESTER';
followUpDueCount = COUNT(DISTINCT t.id) FROM Ticket t JOIN ActionTaken a ON a.ticketId=t.id
  WHERE t.status IN NON_TERMINAL AND a.followUpRequired=true
  AND a.id = (SELECT MAX(a2.id) FROM ActionTaken a2 WHERE a2.ticketId=t.id); -- viewer-visible scope; latest recorded action only (AD-18)
resolvedTodayCount = COUNT(*) FROM Ticket
  WHERE status='RESOLVED' AND DATE_TRUNC('day', updatedAt) = DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC'); -- AD-19, documented approximation
```

Zero-case rule: any `COUNT` returning no rows surfaces as `0` — never null (BR-29, row 17).

Known approximation (AD-19): `resolvedTodayCount` keys off `updatedAt`, so a same-day non-status edit on an already-`RESOLVED` ticket counts it. A precise transition timestamp would require a `Ticket`-table change (excluded by BR-31).

---

## 4. Empty-State & Drill-Down Contract (rows 17, 18, 20, 21)

* **Requester empty**: "You have no tickets yet." + `Create your first ticket` → `/tickets/new`. Zero metrics show `0`.
* **Staff empty**: "Queue is clear. Nice work." + `Browse all tickets` → `/staff/tickets`. Zero metrics show `0`.
* **Drill-down**: each metric's `drillDown: { endpoint, query }` (api-spec §2) must resolve through an existing filtered list to exactly the counted set (row 18 asserts set equality; rows 30–31 assert the click journey).

---

## 5. Test Files by Directory (to be created under #142–#143)

### `server/tests/lab-04/` (Supertest + Vitest)
* `migration-actions.test.ts` — rows 1–2
* `action-validation.test.ts` — row 3
* `dashboard-formulas.test.ts` — row 4
* `actions-api.test.ts` — rows 5–7, 13
* `actions-concurrency.test.ts` — rows 8–10
* `actions-authz.test.ts` — rows 11–12
* `dashboard-api.test.ts` — rows 14–19, 35
* `workflow-spot.test.ts` — row 33

### `client/tests/lab-04/` (Vitest + RTL)
* `StaffDashboard.test.tsx` — row 20
* `RequesterDashboard.test.tsx` — row 21
* `ActionsTaken.test.tsx` — rows 22–25
* `lab4Style.test.tsx` — row 26

### `client/tests/e2e/lab-04/` (Playwright)
* `responsive.spec.ts` — row 27
* `keyboard.spec.ts` — row 28
* `actions-flow.spec.ts` — row 29
* `requester-dashboard.spec.ts` — row 30
* `staff-dashboard.spec.ts` — row 31
* `lab4-hygiene.spec.ts` — row 32
* `lab23-regression.spec.ts` — row 34 (reuses Lab 2/3 journeys, asserts zero skips)

*End of test plan. Results flip Planned → Passed under Epic #128 with PR evidence.*
