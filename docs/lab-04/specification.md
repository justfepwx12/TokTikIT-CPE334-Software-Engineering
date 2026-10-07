# Lab 4 Sprint Engineering Specification

| | |
| :--- | :--- |
| **Project** | TokTickIT — IT Service Desk |
| **Sprint** | Lab 4: Actions Taken, Dashboards, and Final Regression |
| **Version** | v1.0 |
| **Date** | 2026-10-05 |
| **Sources** | CPE 334 Lab 4 labsheet (course-provided handout, kept outside the repository); Lab 3 spec (`docs/lab-03/specification.md`) |
| **Related docs** | `api-spec.md`, `ui-spec.md`, `tests.md` |
| **Related Issue** | #124 *Issue 1: [Epic] Spec DD & Engineering Contract - Lab4* → sub-issues #131 (*specification.md*), #130 (*ui-spec.md* / *api-spec.md*), #132 (*tests.md*) |
| **Status** | Documentation only. No implementation code, schema migrations, or library installs are part of this issue. |

---

## 1. Sprint Goal

Evolve **TokTickIT** from the Lab 3 authenticated service desk into an **accountable, measurable** operation: every unit of IT work is recorded as an **Action Taken** on the ticket it served, each role lands on a **Dashboard** that answers "what needs me?" at a glance, and the whole product (Lab 2 + Lab 3 + Lab 4) is pinned by a **final regression** so nothing that once worked silently breaks. Lab 3's authentication, eight-status workflow engine, ownership model, comments/notes, and admin console carry forward unchanged — Lab 4 adds the work log (Actions Taken), the role-scoped summaries (Dashboards), and the safety net (regression), under the same server-side-trust principle: the UI may hide buttons, but the server enforces every rule.

---

## 2. Stakeholder Request Interpretation

The IT manager has reviewed Lab 3. Tickets move, owners are assigned, notes are kept — but two questions cannot be answered:

1. **"What exactly did IT do on this ticket?"** — Today the evidence of work is scattered across free-text comments. The department wants a structured, auditable **Actions Taken** log per ticket: when the action happened, what was done, what resulted, who did it (recorded automatically — never self-declared), and whether follow-up is still owed. One ticket accumulates many actions; the ticket's Requester and the person who performed an action are routinely different people.
2. **"What needs attention right now?"** — Staff open the queue and scroll. The department wants two **Dashboards**: IT Staff see unassigned work plus their own load with shortcuts into the queue; Requesters see only their own tickets' position. A number on a dashboard must be clickable into the tickets behind it (drill-down), and an empty department must read as a calm empty state — never a blank or broken page.

The state lifecycle itself is trusted and stays exactly as Lab 3 defined it: eight statuses, Backend-controlled transitions, no client-invented states. Recording an action never changes a ticket's status by itself — status still moves only through the Lab 3 transition matrix.

---

## 3. Scope

### Included
* Structured **Actions Taken** log: create / update / list per ticket with the seven-field contract (BR-22), auto-filled performer identity (BR-23), Backend authorization (BR-05 carried forward).
* **Requester Dashboard** summary (own tickets only) and **IT Staff Dashboard** summary (unassigned + own), returned as pre-aggregated numbers — never full ticket tables (BR-25, BR-26).
* Empty states and drill-down navigation for both dashboards (BR-29).
* Optimistic concurrency on action updates (`version` + `409`, BR-27) and idempotent creation (`Idempotency-Key`, BR-28).
* Actions Taken UI embedded in the existing Ticket Detail screens with role-based buttons (BR-30).
* Prisma `ActionTaken` model + safe migration preserving all Lab 2/3 data + idempotent seed covering all eight states and both dashboard cases (BR-31).
* Automated tests at Unit, API, UI, Responsive, Authorization, Workflow, Migration, and E2E levels, documented in `tests.md`.
* Final regression proving Lab 2 + Lab 3 behavior intact.

### Excluded (DO NOT IMPLEMENT)
* Automatic SLA calculation, overtime alerts, on-call scheduling.
* Email, SMS, LINE, or push notifications of any kind.
* Inventory, spare-parts, purchasing, or service-cost accounting.
* Time-sheet or payroll computation.
* Multi-step approvals or electronic signatures.
* Advanced BI, custom report builders, or data export.
* Production-grade multi-tenancy.
* Any change to the Lab 3 eight-status transition matrix (§6) — it is referenced, not revised.

---

## 4. Functional Requirements

Lab 3 FR-01–FR-24 carry forward unchanged. New requirements:

* **FR-25**: An IT Staff member or Administrator can record an Action Taken on any ticket (`POST /api/tickets/:id/actions`) — action date/time, description, result, follow-up flag (+ note when flagged), attachment notes; the performer is the authenticated user.
* **FR-26**: An IT Staff member or Administrator can update an Action Taken (`PATCH /api/actions/:id`) under optimistic concurrency — the request carries the known `version`; a stale version is rejected with HTTP 409 and nothing is overwritten.
* **FR-27**: Actions Taken list per ticket (`GET /api/tickets/:id/actions`), newest-first, with lightweight pagination.
* **FR-28**: A Requester can read the Actions Taken of their **own** tickets only; any create/update attempt returns HTTP 403, and foreign tickets behave per the safe-error rule (BR-06 carried forward).
* **FR-29**: A Requester can fetch their dashboard summary (`GET /api/dashboard/requester/summary`) — counts scoped strictly to `requesterId = me`, plus empty-state-friendly zeros.
* **FR-30**: IT Staff and Administrators can fetch the staff dashboard summary (`GET /api/dashboard/staff/summary`) — unassigned work, own load, follow-ups due, resolved-today.
* **FR-31**: Every dashboard metric drills down into tickets using the **existing** list endpoints with filters (`GET /api/tickets?status=…` for Requesters, `GET /api/staff/tickets?…` for Staff) — no new drill-down endpoint (AD-16).
* **FR-32**: Replayed `POST` with the same `Idempotency-Key` returns the original record without creating a duplicate.
* **FR-33**: The Ticket Detail screens embed the Actions Taken section: full List + Create/Edit for IT Staff/Admin views; read-only List for the Requester view.
* **FR-34**: The eight-status workflow engine is byte-for-byte the Lab 3 matrix (`docs/lab-03/specification.md` §6); recording or editing an action never transitions status.
* **FR-35**: `prisma/seed.ts` stays idempotent and additionally covers all eight ticket states, tickets with 0/1/N actions, and both dashboard cases (a Requester with tickets and one with zero).
* **FR-36**: All Lab 2 + Lab 3 journeys (login, create ticket, queue, claim/reassign, priorities, status transitions, resolve-intent, comments/notes, admin console, attachments) keep passing unchanged.

---

## 5. Business Rules

Lab 3 BR-01–BR-21 carry forward unchanged. New rules:

### 5.1 Actions Taken

* **BR-22 (ActionTaken field contract)** — Every action carries exactly these fields with these validations:

  | Field | Type | Required | Validation |
  | :--- | :--- | :---: | :--- |
  | `actionAt` | DateTime | Yes | Must not be in the future beyond a 5-minute clock-skew allowance (`actionAt <= now + 5min`). |
  | `description` | String | Yes | 1–2000 chars after trim; whitespace-only rejected. |
  | `result` | String | Yes | 1–2000 chars after trim; whitespace-only rejected. |
  | `performedBy` | User ref | Auto | Taken from the JWT/session (`req.user.id`); never accepted from the request body (BR-23). |
  | `followUpRequired` | Boolean | Yes | Defaults `false`. |
  | `followUpNote` | String? | Conditional | Mandatory (1–2000 chars after trim) when `followUpRequired = true`; must be absent-or-empty when `false` (server clears it). |
  | `attachmentNotes` | String? | No | 0–2000 chars; plain-text reference notes only (filenames, locations) — **not** a file store; the Lab 2/3 Attachment system is untouched. |

* **BR-23 (Cardinality & performer identity)** — One Ticket holds **N** Actions Taken (`ticketId` FK, delete-restricted). The Ticket Owner (requester-side `requesterId`) and the action's `performedBy` are independent: the person who did the work is routinely not the ticket's Requester. `performedBy` is server-derived; any client-supplied performer id is ignored/stripped (same principle as Lab 3 BR-04).
* **BR-24 (Actions never drive status)** — Creating or editing an Action Taken performs **no** status transition. If work on a ticket also needs a status move, the caller invokes the Lab 3 status endpoint separately, which validates the matrix edge on its own. An action and a status change in one user gesture are two API calls; either may succeed or fail independently.

### 5.2 Dashboards

* **BR-25 (Dashboard scoping)** — Formulas are computed server-side with mandatory scoping:
  * *Requester summary* pins every count to `requesterId = <me>`.
  * *Staff summary* counts (a) tickets with `ownerId IS NULL` and non-terminal status (Unassigned), (b) tickets with `ownerId = <me>` (My load), (c) follow-ups on actions belonging to visible tickets (Follow-Up Due), (d) tickets transitioned to `RESOLVED` today UTC (Resolved Today).
  * Terminal statuses (`CLOSED`, `CANCELLED`) never appear in "needs attention" buckets.
* **BR-26 (Aggregated-only responses)** — Dashboard endpoints return counts computed with `groupBy`/`count` in the database. Fetching ticket rows and counting client-side is forbidden; list payloads are never embedded in summaries.
* **BR-29 (Empty states & drill-down)** — A zero metric returns `0` (plus `items: []` where a shape carries one) — never `null`, never 500. Each metric carries a `drillDown` descriptor (`{ endpoint, query }`) pointing at the existing filtered list from FR-31. Empty states show calm helper copy plus a next action (Requester: "Create your first ticket"; Staff: "Queue is clear").

### 5.3 Concurrency & Safety

* **BR-27 (Optimistic concurrency)** — Every action row carries `version` (starts at 1, +1 per successful update). Updates send `If-Match: <version>`; a mismatch returns HTTP `409` with code `STALE_VERSION`, the stored row is untouched, and the client must re-fetch and retry. Comparison and write are atomic (single conditional update).
* **BR-28 (Idempotent creation)** — `POST` accepts an optional `Idempotency-Key` header (opaque client token, ≤ 64 chars). Replaying the same key + same ticket within 24h returns the original `201` payload without inserting a duplicate. Different payload with a reused key returns `422` (`IDEMPOTENCY_KEY_REUSE`).
* **BR-31 (Migration & seed safety)** — The Lab 4 migration adds **only** the `ActionTaken` table (plus its indexes); zero alterations to existing tables' columns. Legacy row counts for `User`, `Ticket`, `Attachment`, `Comment`, `InternalNote`, `Category`, `RelatedSystem` are identical before and after. Seed upserts on stable keys (`seedKey` pattern reused from Lab 3 `Comment`/`InternalNote`); two consecutive runs produce identical counts.

### 5.4 Presentation

* **BR-30 (Dashboard & Actions UI hardening)** — Desktop `≥ 992px` / Tablet `768–991px` / Mobile `< 768px` (Lab 3 breakpoints, unchanged). No horizontal **page** scrolling at any viewport (wide tables scroll inside their card); no clipped content; keyboard focus always visible and every primary task completable keyboard-only; modal dialogs avoided — any unavoidable dialog traps focus and closes on ESC.

---

## 6. Status Transition Matrix

Unchanged. The authoritative contract is `docs/lab-03/specification.md` §6 (eight statuses; `Cancelled` terminal with no outgoing edges; Requester affects status only via resolve-intent; `Closed` reachable only by IT/Admin from `Resolved`). Lab 4 adds no edge, removes no edge, and re-tests the matrix as regression (AC-59).

---

## 7. Server-Side Authorization Matrix

Lab 3 §7 carries forward in full. Additions for Lab 4 (`Y` = permitted; `—` = denied with HTTP 403 for an authenticated-but-unauthorized caller; ownership scoping as noted):

| Capability | Requester | IT Staff | Administrator |
| :--- | :---: | :---: | :---: |
| List Actions Taken of a ticket | Y (own tickets only) | Y | Y |
| Create an Action Taken | — (403) | Y | Y |
| Update an Action Taken | — (403) | Y | Y |
| Replay create with `Idempotency-Key` | — (403, same as create) | Y | Y |
| Requester dashboard summary | Y (own counts only) | — | — |
| Staff dashboard summary | — (403) | Y | Y |
| Drill-down via `GET /api/tickets?status=` | Y (own only) | Y (all, via staff queue instead) | Y (all, via staff queue instead) |
| All Lab 3 capabilities | per Lab 3 §7 | per Lab 3 §7 | per Lab 3 §7 |

Cross-role notes: a Requester fetching another requester's actions or dashboard receives the safe-error treatment (foreign → 403, genuinely missing → 404, BR-06). Frontend buttons follow this matrix visually, but the server is the enforcement point (BR-05).

---

## 8. UI Specification Summary

Full detail lives in `docs/lab-04/ui-spec.md`. Summary:

* **Role home / dashboards**: `/dashboard/requester` (own-ticket summary cards + empty CTA) and `/dashboard/staff` (Unassigned / My load / Follow-Up Due / Resolved Today cards + shortcuts into the queue); post-login home routes to the role dashboard while keeping My Tickets / Ticket Queue reachable.
* **Actions Taken section** (embedded in `TicketDetail` and `StaffTicketDetail`): newest-first List/Table (Action Date-Time, Description, Result, Performed By, Follow-Up + Note, Attachment Notes); Create/Edit forms for Staff/Admin with `Performed By` shown as the logged-in user (read-only); read-only List for Requesters; submit buttons disable while in flight; drafts persist across failures; `409` surfaces a refresh-and-retry prompt.
* **States everywhere**: Loading / Empty / No-results / Error are specified per screen; Zen Green tokens and breakpoints carried forward unchanged.

---

## 9. Data Changes

### 9.1 New Prisma model

| Model | Change | Key fields |
| :--- | :--- | :--- |
| **ActionTaken** | New — the structured work log (BR-22) | `id`, `ticketId` → Ticket (Restrict), `actionAt`, `description` (≤ 2000), `result` (≤ 2000), `performedById` → User (Restrict), `followUpRequired` (default false), `followUpNote` Nullable, `attachmentNotes` Nullable, `version` (default 1), `seedKey` Nullable, `createdAt`, `updatedAt` |

Existing models (`User`, `Ticket`, `Comment`, `InternalNote`, `Attachment`, `Category`, `RelatedSystem`) are **untouched** — no column added, removed, or re-typed.

### 9.2 Migration & data mapping

* One forward migration creating `ActionTaken` + indexes only. Downgrade drops that table only.
* No data backfill: pre-Lab-4 tickets simply have zero actions (a valid, specified state).
* Legacy preservation check: row counts of all seven existing tables are asserted equal before/after (AC-56).

### 9.3 Seed script (idempotent extension)

* Keep every Lab 3 fixture; add: tickets in the two states Lab 3 seeded thinly (`REOPENED`, `CANCELLED`) so all eight are covered; actions with deterministic `seedKey` (`ticketNo:action:index`) giving 0/1/N coverage; `followUpRequired` true and false cases; Requester B with zero tickets (dashboard-zero case).
* Upsert pattern identical to Lab 3 (`@@unique([ticketId, seedKey])`, re-runs change nothing).

### 9.4 Indexes

* `ActionTaken.ticketId` (list-by-ticket), `ActionTaken.performedById` (performer audit), `ActionTaken.actionAt` (newest-first ordering). All existing indexes retained.

---

## 10. API Contract

Full request/response shapes in `docs/lab-04/api-spec.md`. Endpoint summary (all paths `/api`):

| Method | Path | Purpose | Roles | Success | Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| GET | `/tickets/:id/actions` | List actions, newest-first + pagination | per visibility (§7) | 200 | 400, 401, 403, 404 |
| POST | `/tickets/:id/actions` | Record an action (performer = self) | IT Staff, Admin | 201 | 400, 401, 403, 404, 422 |
| PATCH | `/actions/:id` | Update an action (`If-Match: version`) | IT Staff, Admin | 200 | 400, 401, 403, 404, 409 |
| GET | `/dashboard/requester/summary` | Own-ticket counts | Requester | 200 | 401, 403 |
| GET | `/dashboard/staff/summary` | Unassigned + own-load counts | IT Staff, Admin | 200 | 401, 403 |

**Contract decisions:**
* Session cookie auth unchanged (Lab 3 AD-01); unauthenticated → 401; `mustChangePassword` gate unchanged (BR-03).
* A client-supplied `performedBy`/`performedById` is ignored/stripped (BR-23); `version` in the body is ignored — only `If-Match` counts (BR-27).
* Stale update → `409` + `STALE_VERSION`; stored row untouched (BR-27).
* Idempotency-Key reuse with different payload → `422` + `IDEMPOTENCY_KEY_REUSE` (BR-28).
* Dashboard responses contain counts + `drillDown` descriptors only — no ticket rows (BR-26).

---

## 11. Acceptance Criteria

**Actions Taken API**
* **AC-34**: Given IT Staff/Admin, when a valid action is posted, then `201` returns the action with `performedBy = me` and `version = 1`, even if the body contained a performer field.
* **AC-35**: Given `followUpRequired = true` without a note, or `actionAt` beyond the skew window, or blank description/result, then `400` with a field message and nothing is stored.
* **AC-36**: Given a valid `PATCH` with the current `If-Match` version, then `200` returns the updated action with `version + 1`.
* **AC-37**: Given a `PATCH` with a stale `If-Match` version, then `409 STALE_VERSION`, the row is unchanged, and the response carries the current version.
* **AC-38**: Given a replayed `POST` with the same `Idempotency-Key` + ticket inside 24h, then the original `201` payload returns with exactly one row in the table.
* **AC-39**: Given a Requester, when `POST`/`PATCH` on actions is attempted, then `403` — including on their own tickets.
* **AC-40**: Given a Requester fetching actions, then own tickets return `200` while foreign tickets return `403/404` with no existence leak.
* **AC-41**: Given a ticket with N actions, when listed, then order is newest-first with working pagination.

**Dashboards**
* **AC-42**: Given two Requesters (A with tickets, B with zero), when each fetches the requester summary, then A sees own counts only and B sees all zeros — no cross-user bleed.
* **AC-43**: Given seeded unassigned + self-assigned tickets, when Staff fetch the staff summary, then `unassignedCount`, `myAssignedCount`, `followUpDueCount`, and `resolvedTodayCount` match direct database counts.
* **AC-44**: Given a Requester calling the staff summary (or Staff calling with no session), then `403` (resp. `401`).
* **AC-45**: Given an empty scope, when any summary is fetched, then every metric is `0` with `items: []` — never null, never 500.
* **AC-46**: Given any dashboard metric, when its drill-down descriptor is followed, then the existing filtered list shows exactly the counted tickets.
* **AC-47**: Given query profiling, when summaries are fetched, then aggregation happens in-DB (`groupBy`/`count`) with no full-table fetch and no N+1.

**Actions Taken & Dashboard UI**
* **AC-48**: Given IT Staff, when the staff dashboard loads, then all cards + shortcuts render with Loading/Empty/Error states and drill-down navigates correctly.
* **AC-49**: Given a Requester, when the requester dashboard loads, then only own tickets are summarized, the empty state offers ticket creation, and no staff-only metric is visible.
* **AC-50**: Given Ticket Detail, when viewed as Staff/Admin vs Requester, then Staff/Admin see List + Create/Edit while the Requester sees the read-only List — verified for 0/1/N action counts.
* **AC-51**: Given the action form, when submitted with `followUpRequired = true` and no note (or blank required fields), then inline field errors appear and nothing is sent; valid submits persist and refresh the list.
* **AC-52**: Given a double-click on submit or a failed load, then exactly one record is created and the draft survives the error for retry.
* **AC-53**: Given viewports 375 / 768 / 1280, when each Lab 4 screen renders, then there is no page-level horizontal scroll and no clipped content.
* **AC-54**: Given keyboard-only operation, when the core tasks (dashboard → drill-down → view actions → create action) run, then every step completes with visible focus and no mouse.
* **AC-55**: Given full navigation of Lab 4 screens, when the console and links are inspected, then zero console errors and zero broken links exist.

**Data & seed**
* **AC-56**: Given the Lab 4 migration against a populated Lab 3 database, then all seven legacy tables keep exact row counts and pre-existing tickets read back with zero actions.
* **AC-57**: Given `prisma db seed` run twice, then counts are identical, all eight states are present, 0/1/N action coverage exists, and both dashboard cases (zero + non-zero) verify.

**Regression & workflow**
* **AC-58**: Given the Lab 2 + Lab 3 E2E journeys re-run unchanged, then all pass with no skips.
* **AC-59**: Given spot checks across the Lab 3 transition matrix, then legal edges return `200` and illegal edges return `400` with status unchanged.

---

## 12. Definition of Done (Product)

* [ ] All Included scope (Section 3) implemented; no Excluded feature present.
* [ ] Every Acceptance Criterion (AC-34–AC-59) links to at least one passing, non-skipped automated test traced in `docs/lab-04/tests.md`.
* [ ] All Unit, API, UI, Responsive, Authorization, Workflow, Migration, and E2E tests pass from documented commands on the final branch.
* [ ] Backend enforces the §7 matrix on every new endpoint (verified AC-39, AC-40, AC-44).
* [ ] `performedBy` from client payloads is proven inert (AC-34); `version` in body is proven inert (AC-37 setup).
* [ ] Dashboards are proven aggregated (AC-47) and scoped (AC-42, AC-43).
* [ ] Screens conform to `ui-spec.md` at desktop/tablet/mobile with screenshots (AC-53).
* [ ] Prisma schema matches Section 9 with a legacy-safe migration (AC-56) and idempotent seed (AC-57).
* [ ] Peer-review evidence in `docs/lab-04/reviewer.md`; `ai-use.md` records model, 6–10 prompts, and reflection.
* [ ] All work merged via reviewed PRs: `feature/* → lab4-staging → main`; Kanban shows every Issue Done.

---

## 13. Assumptions and Decisions

* **AD-13 (Version column)**: Optimistic locking uses an integer `version` (default 1) rather than comparing `updatedAt` timestamps, so retries and tests are deterministic (BR-27, D-07).
* **AD-14 (If-Match header)**: Update concurrency travels in the HTTP `If-Match` header (canonical REST), not the body; a missing header is `400`, a stale one is `409`.
* **AD-15 (Idempotency-Key)**: Optional opaque header (≤ 64 chars), scoped per ticket, honored for 24h; replay returns the stored `201` payload verbatim (BR-28).
* **AD-16 (Drill-down reuse)**: Drill-down navigates to existing filtered lists (`GET /api/tickets?status=` for Requesters; `GET /api/staff/tickets?…` for Staff) — no new endpoint, no new auth surface (D-06).
* **AD-17 (Dashboard routes)**: New client routes `/dashboard/requester` and `/dashboard/staff`; post-login home redirects by role (Requester → requester dashboard; IT/Admin → staff dashboard).
* **AD-18 (Follow-Up Due definition)**: Counts actions with `followUpRequired = true` on currently non-terminal tickets within the viewer's scope; resolving the follow-up is recording a newer action with `followUpRequired = false`, not deleting history.
* **AD-19 (Resolved Today definition)**: Tickets whose status became `RESOLVED` during the current UTC calendar day (server-computed; no client clock involved).
* **AD-20 (Test layout)**: Lab 4 tests live at `server/tests/lab-04/`, `client/tests/lab-04/`, `client/tests/e2e/lab-04/` — same grouping convention as Lab 3 AD-12.

---

## 14. Decision Log

* **D-05 (PATCH + If-Match over PUT)**: Partial update with a concurrency header keeps payloads small and makes stale-write rejection explicit, versus full-replacement PUT where a missing version is ambiguous.
* **D-06 (Reuse lists for drill-down)**: Reusing the two battle-tested list endpoints avoids duplicating pagination, filtering, and authorization logic for a third surface.
* **D-07 (Version over updatedAt)**: Monotonic integers are immune to clock skew and millisecond ties; `updatedAt` stays a pure audit field.
* **D-08 (seedKey reuse)**: The Lab 3 `Comment`/`InternalNote` nullable-`seedKey` + `@@unique([ticketId, seedKey])` pattern is copied for `ActionTaken` so fixtures stay idempotent without touching user-authored rows.

---

*End of specification. This document is the engineering contract for implementation Issues #133–#143; changes require student approval and a version bump.*
