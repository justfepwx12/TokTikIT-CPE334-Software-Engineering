# Lab 2 Sprint Engineering Specification

| | |
| :--- | :--- |
| **Project** | TokTickIT — IT Service Desk |
| **Sprint** | Lab 2: Requester Ticketing MVP with UI Foundation |
| **Version** | v1.1 — clarifies Category/RelatedSystem "active" language (AD-13); no schema change |
| **Date** | 2026-08-30 |
| **Sources** | CPE 334 Lab 2 labsheet (course-provided handout, kept outside the repository) |
| **Related docs** | `api-spec.md`, `ui-spec.md`, `tests.md` |
| **Related Issue** | #29 *Lab 2 Engineering Contract (Spec-DD)* → sub-issue #37 *Draft specification.md* |
| **Status** | Documentation only. No implementation code, schema migrations, or library installs are part of this issue. |

---

## 1. Sprint Goal

Deliver a professional, responsive Requester-facing ticketing experience for **TokTickIT**. A Requester selects a temporary Development Requester identity (a testing mechanism, not authentication), creates an IT support ticket with category, related system, priority, description, and attachments, receives a unique backend-generated Ticket Number, and can then find their own tickets in My Tickets using search, filters, sorting, and pagination, open a read-only Ticket Detail, and manage attachments (add, download, soft-remove with a mandatory reason). All screens follow a reusable Zen Green design system, and one Requester can never see another Requester's data.

---

## 2. Stakeholder Request Interpretation

The IT department wants real end users to start submitting support requests now, before login exists. This sprint simulates identity: the user first picks who they are from seeded Development Requesters, and everything they do afterward belongs to that person, transmitted via the `x-requester-id` header. The core loop is: describe a problem → classify it (Category, Related System, Priority) → attach evidence → submit → find it again later → inspect and manage its attachments. The system must generate the official Ticket Number itself, keep data safe, and strictly separate Requesters from each other. The UI must establish a consistent Zen Green visual system that later sprints reuse instead of reinventing.

---

## 3. Scope

### Included
* Development Requester Selection screen (simulated "login") and header requester context with a Change Requester action.
* Create Ticket screen: all required fields, duplicated frontend + backend validation, attachment staging, busy/disabled Submit, success state showing the generated Ticket Number.
* My Tickets screen: owned-ticket list with search, filters, sorting, pagination, and distinct loading / empty / no-results / error states.
* Requester Ticket Detail screen: read-only ticket information plus attachment management.
* Attachment lifecycle: upload (type/size/count validated), download of active files, soft removal with mandatory reason.
* Ownership protection enforced server-side on every ticket/attachment endpoint.
* Reference data APIs: active Categories, active Related Systems, active Development Requesters.
* Idempotent seed data and Prisma schema/migrations for all new models.
* Zen Green theme tokens and reusable form/list/badge/state components.
* Automated tests: unit, API, UI component, UI style, responsive, and E2E.

### Excluded
* Authentication and security: login/logout, passwords, hashing, sessions, tokens, role-based authorization. The selector is explicitly **not** secure authentication.
* IT Staff workflow: staff dashboard/queue, claiming, reassigning tickets, changing IT Priority.
* Collaboration: Public Comments, Internal Notes, Actions Taken.
* Lifecycle beyond creation: any status change after the initial `PENDING` status (resolve, close, reopen, cancel).
* Administration: managing users, Requesters, roles, Categories, or Related Systems.

---

## 4. Functional Requirements

* **FR-01**: The app loads active Development Requesters from the database into the Selection screen dropdown.
* **FR-02**: After selection, the app shell displays the selected Requester's name and offers a Change Requester action; changing the selection reloads all Requester-specific data.
* **FR-03**: Ticket screens (Create Ticket, My Tickets, Ticket Detail) are inaccessible until a Requester is selected; the app shows the Simulation-Mode warning and routes back to the Selection screen.
* **FR-04**: The Selection screen shows loading, empty (no active Requesters), and API-failure states safely, without crashing the app shell.
* **FR-05**: The Create Ticket form captures Title, Description, Category, Related System, Priority, and staged Attachments; Ticket Number, Ticket Date, and Requester are displayed read-only where shown.
* **FR-06**: Both client and server validate every submitted field independently; server-side validation is authoritative and cannot be bypassed by disabling client JS.
* **FR-07**: On successful creation the backend generates the official Ticket Number (BR-01), sets status `PENDING`, persists the ticket, and returns it; the success state displays the number and a next action (e.g., "View Ticket" / "Create Another").
* **FR-08**: While a submission is in flight, the Submit button is disabled and shows a busy indicator; duplicate submissions from repeated clicks are impossible (BR-09).
* **FR-09**: If creation fails (validation or network/server error), all user-entered values remain in the form, with field-level messages where applicable (BR-10).
* **FR-10**: My Tickets lists only the selected Requester's tickets, with fields sufficient to identify each ticket (Ticket No, Title, Category, Priority, Status, Date Created).
* **FR-11**: My Tickets supports case-insensitive partial search over Title and Description.
* **FR-12**: My Tickets supports filtering by Category, Related System, Status, and Priority, combinable with search and with each other, plus a Clear Filters action.
* **FR-13**: My Tickets supports sorting by a whitelisted set of fields only — `createdAt` and `priority` — each ascending or descending; any other `sort` value is rejected per BR-06.
* **FR-14**: My Tickets pagination returns page metadata (`total`, `page`, `limit`, `totalPages`) and supports a bounded `limit` (records-per-page).
* **FR-15**: Ticket Detail shows one owned ticket fully read-only, grouped clearly, with status/priority badges and back navigation to My Tickets.
* **FR-16**: The owning Requester can add a permitted attachment to an existing owned ticket and download any of its active attachments.
* **FR-17**: The owning Requester can soft-remove an active attachment after providing a mandatory, non-empty removal reason (BR-08); removed attachments stay listed as metadata but cannot be downloaded or previewed.
* **FR-18**: The system prevents an inactive Requester from being selected, and rejects any request presenting an inactive Requester's ID (BR-04).

---

## 5. Business Rules

* **BR-01 (Ticket Number Generation)**: Format `TK-YYYYMMDD-[4-digit counter]`, date = creation date in local workspace time (UTC+7), counter resets to `0001` each calendar day and increments sequentially; generation is concurrency-safe with no duplicates (retry-on-collision inside the create transaction).
* **BR-02 (Ticket Defaults)**: A new ticket always starts at status `PENDING`; no other status transition exists or is exposed in Lab 2. `requesterId` is always taken from the `x-requester-id` header, never from the request body.
* **BR-03 (Development Requester Selection)**: The selector is a testing mechanism only, replacing login; it provides no security and must be labelled as such in the UI. The chosen Requester is held in frontend state (persisted to `localStorage`) and sent as `x-requester-id` on every API call; changing the selection reloads all Requester-scoped data.
* **BR-04 (Inactive Requesters)**: Inactive Requesters never appear in the selector dropdown and cannot be set as the active identity; any request carrying an inactive Requester's ID is rejected with HTTP 403.
* **BR-05 (Ticket Ownership)**: A ticket belongs exclusively to the Requester who created it. Only that Requester may view, list, or act on it or its attachments. Foreign resources return 403; resources that do not exist return 404.
* **BR-06 (Search/Filter/Sort/Pagination)**: The ticket-list endpoint always scopes to the active Requester first, then applies search/filter/sort/pagination on that subset. Search matches partial, case-insensitive substrings in Title or Description only. Sortable fields are whitelisted to `createdAt` and `priority`; an unknown `sort` value, a non-numeric `page`, or a `limit` outside the allowed range (1–50) returns HTTP 400 with a safe message rather than silently defaulting.
* **BR-07 (Attachment Upload Constraints)**: Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`. Maximum size: 5 MB per file (oversized uploads return **413 Payload Too Large**). Disallowed types return **415 Unsupported Media Type**. Maximum 5 active (non-removed) attachments per ticket (a 6th attempt returns **400 Bad Request**).
* **BR-08 (Attachment Soft-Removal & Ownership)**: Attachments are never hard-deleted. Soft-removal sets `isRemoved: true`, records a `removedAt` timestamp, and requires a mandatory, non-empty `removalReason` (3–200 characters after trim; whitespace-only or trivial single-character input is rejected). Only the owning Requester may soft-remove, view, or download an attachment; others receive HTTP 403. A removed attachment remains visible as metadata but returns **410 Gone** on download/preview.
* **BR-09 (Form Validation & Duplicate-Submission Prevention)**: All Create Ticket validation is enforced identically on client and server; the Submit control is disabled and shows a busy state while a request is in flight, guaranteeing at most one ticket is created per user submission.
* **BR-10 (Failure Behavior & Data Retention)**: If ticket creation fails validation or the server errors, all entered field values are preserved in the form. If a ticket is created but a subsequent attachment upload fails, the ticket remains created and the user is shown which file(s) failed with a retry option (the ticket is never rolled back).
* **BR-11 (Required Fields & Trimming)**: Required fields are Title, Description, Category, Related System, and Priority. All string values are trimmed before validation and save; whitespace-only input counts as empty.
* **BR-12 (Field Length Limits)**: Title 5–100 characters, Description 10–1000 characters (after trim), enforced identically on client and server.
* **BR-13 (Empty & No-Results States)**: My Tickets distinguishes "Requester has zero tickets" (empty state) from "current filters/search match zero tickets" (no-results state), with visually and textually distinct messaging.
* **BR-14 (Ticket Detail Access)**: A request for a ticket ID not owned by the active Requester returns HTTP 403 regardless of whether the ticket exists, to avoid leaking existence information; a genuinely non-existent ID returns 404.
* **BR-15 (Attachment Staging at Create Time)**: Files staged during Create Ticket are validated client-side (type/size/count) before submission; actual upload occurs only after the ticket is successfully created (BR-10 governs failure behavior).
* **BR-16 (Ticket Date)**: `createdAt` is the authoritative Ticket Date, set once at creation and never editable thereafter.
* **BR-17 (Default Sort)**: If no `sort`/`order` is supplied, the list defaults to `createdAt` descending (newest first).
* **BR-18 (Safe Error Responses)**: All unexpected (5xx) errors return a generic, safe message with no stack traces or internal implementation details.
* **BR-19 (Transition to Lab 3)**: The Development Requester selector and the `x-requester-id` header mechanism are temporary. No passwords, sessions, or tokens are implemented in Lab 2; this mechanism must be replaced by real authentication in Lab 3 with minimal schema disruption (Requester maps to an authenticated identity).
* **BR-20 (Safe Filename & Storage Behavior)**: The original client-supplied `filename` is stored only as display metadata and is never used to build a filesystem path. On upload, the server generates a random UUID-based storage name (with the original extension preserved after validating it against the allowed MIME types) and saves the file under a fixed, non-user-controlled uploads directory. This prevents filename collisions between different uploads and blocks path-traversal (e.g. `../`, absolute paths, embedded separators) since the client-supplied name never participates in path construction. Downloads stream the file back to the client with the original `filename` in the `Content-Disposition` header.

---

## 6. UI Specification Summary

Full detail lives in `docs/lab-02/ui-spec.md`. Summary:

* **Application shell**: Primary green (`#006B3C`) header with "TokTickIT" brand, "My Tickets" / "Create Ticket" navigation, active-Requester display with a "Change Requester" action, clear active-page indication, and responsive mobile navigation. A persistent Simulation-Mode warning banner shows when no Requester is selected.
* **Development Requester Selection Screen**: A dedicated, full-page route (`/select-requester`) shown before any ticket screen is reachable — not just a header dropdown. Centered card with the TokTickIT title, explanatory text that this is Lab 2 testing only (not login), a "Development Requester" dropdown of active Requesters loaded from PostgreSQL, a note that only active Requesters are shown, a "Continue" button, an "Authentication coming in Lab 3" notice, loading/empty (no active Requesters)/API-failure states, and fully keyboard-accessible controls. After Continue, the header shows the selected name with a "Change Requester" action that returns to this screen.
* **Create Ticket**: Card layout (max width 768px); Title/Category/Related System/Priority fields grouped together; full-width Description; attachment staging area below with individual remove controls; primary Submit + secondary Cancel at the bottom. Inline validation messages appear directly below each invalid field; required fields show a red asterisk that never replaces the message; success screen shows the generated Ticket Number.
* **My Tickets**: Filter bar (search + Category/Related System/Status/Priority filters + sort controls + Clear Filters) with an always-visible Create Ticket action; desktop table / mobile stacked cards; centered pagination bar with page-size control; four distinct states — loading, empty, no-results, error.
* **Ticket Detail**: Read-only field grid (ivory/gray-green read-only shading) with priority/status badges; dedicated Attachment section listing active attachments (filename, mime icon, size, download, soft-remove — visible only to the owner) and removed attachments shown as muted metadata; no comments/notes/actions sections.
* **Zen Green tokens**: Primary green `#006B3C` (header, primary actions), Secondary green `#0B7A46` (active tabs, focus accents, links, hover), Pale green `#EAF6EF` (selected/success/subtle emphasis), Page background `#F5F7F6`, Surface/cards white with subtle border, Text dark charcoal-green. Editable field: white background, neutral border. **Read-only field: soft gray-green / warm ivory shading, clearly distinct from editable fields but still readable** — this is the dedicated read-only token, never reused for editable or disabled controls. Error: dark red text/border on a light red background; message directly below the field. Warning: amber callout/badge, reserved for actual warnings. Success: green confirmation, never relying on color alone.
* **Responsive breakpoints**: Mobile `< 768px` (single column, cards, hamburger nav), Tablet `768–991px` (two-column layout where practical; Summary/Description get enough width), Desktop `≥ 992px` (multi-column grid, full table, content centered with a sensible max width).

---

## 7. Data Changes

Prisma models required (PostgreSQL or SQLite):

| Model | Fields (key ones) | Notes |
| :--- | :--- | :--- |
| **Requester** | `id`, `name`, `email` (unique), `isActive` (default `true`), `createdAt`, `updatedAt` | Simulated identity for Lab 2; designed so Lab 3 auth can link a real authenticated user without breaking existing tickets. |
| **Category** | `id`, `name` (unique) | Read-only reference data in Lab 2; seeded only. |
| **RelatedSystem** | `id`, `name` (unique) | Read-only reference data in Lab 2; seeded only. |
| **Ticket** | `id`, `ticketNo` (unique), `title`, `description`, `priority` enum, `status` enum (default `PENDING`), `requesterId` FK, `categoryId` FK, `systemId` FK, `createdAt`, `updatedAt` | Core entity; see indexes below. |
| **Attachment** | `id`, `filename` (original, user-facing name), `filePath` (server-generated, UUID-based storage name — see BR-20), `mimeType`, `size` (Int, bytes), `ticketId` FK, `isRemoved` (default `false`), `removalReason` (nullable, required when `isRemoved`), `createdAt`, `updatedAt` | Soft removal via flag + reason; file never physically deleted. |

**Enums:**
* `Priority`: `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
* `Status`: `PENDING`, `IN_PROGRESS`, `RESOLVED`, `CLOSED` — Lab 2 only ever creates and displays `PENDING`; the other values exist in the schema for forward-compatibility with later labs but no transition logic is implemented or exposed this sprint.

**Relationships:** Requester 1–N Ticket; Ticket 1–N Attachment; Category 1–N Ticket; RelatedSystem 1–N Ticket.

**Indexes and constraints (with justification):**
* `Ticket.ticketNo` — unique (BR-01 uniqueness guarantee; also the primary lookup key for search).
* `Ticket.requesterId` — indexed (foreign key; every list/detail query filters by the active Requester first, per BR-05/BR-06).
* `Ticket.categoryId`, `Ticket.systemId` — indexed (foreign keys used by the Category/Related System filters).
* `Attachment.ticketId` — indexed (foreign key; used to enumerate and count active attachments for the 5-file cap, BR-07).
* `Requester.email`, `Category.name`, `RelatedSystem.name` — unique (data integrity for seeded reference data).
* Soft removal represented by `Attachment.isRemoved` + `Attachment.removalReason` (audit trail preserved; rows never physically deleted).
* **Lab 3 evolution**: adding real authentication means mapping `Requester` to an authenticated `User`; keeping `requesterId` as an explicit FK on `Ticket`/`Attachment` today means endpoints switch from header-supplied ID to token-derived ID with minimal schema change.

**Migration decision**: incremental `prisma migrate dev` migrations committed to the repository; seed via idempotent upserts in `prisma/seed.ts` (safe to re-run without creating duplicates).

**Seed data (idempotent):**
* Categories (4, exact labsheet names): Account and Access, Hardware, Software, Network.
* Related Systems (≥6): Email Client, ERP Portal, VPN Service, HR Management System, Database Cluster, Shared Storage.
* Active Requesters (4) + one inactive Requester (5 total) — realistic names/emails; the inactive Requester must never appear in the selector.

---

## 8. API Contract

Full request/response shapes in `docs/lab-02/api-spec.md`. Endpoint summary:

| Method | Path | Purpose | Success | Errors |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/requesters` | Active Requesters for the selector | 200 | 500 |
| GET | `/api/categories` | Active Categories | 200 | 500 |
| GET | `/api/systems` | Active Related Systems | 200 | 500 |
| POST | `/api/tickets` | Create ticket for the active Requester | 201 | 400, 401, 403, 500 |
| GET | `/api/tickets` | Owned, paginated, filtered, sorted list | 200 | 400, 401, 403, 500 |
| GET | `/api/tickets/:id` | Owned ticket detail + attachment metadata | 200 | 401, 403, 404, 500 |
| POST | `/api/attachments/upload` | Upload an attachment to an owned ticket | 201 | 400, 401, 403, 413, 415, 500 |
| GET | `/api/attachments/:id` | Retrieve one attachment's metadata (owned; independent of ticket detail) | 200 | 401, 403, 404, 500 |
| GET | `/api/attachments/:id/download` | Binary download of an active attachment | 200 | 401, 403, 404, 410, 500 |
| PATCH | `/api/attachments/:id/remove` | Soft-remove with mandatory reason | 200 | 400, 401, 403, 404, 500 |

**Contract decisions:**
* **Identity transport**: `x-requester-id` custom header on every Requester-scoped request (not a query param or body field), keeping identity separate from payload shape.
* **Ownership mismatch → 403**; resource does not exist → 404 (BR-05, BR-14). This ordering intentionally avoids leaking whether a foreign ticket ID exists.
* **Download endpoint**: active file → 200 with binary content; soft-removed file → **410 Gone** (BR-08); foreign attachment → 403; unknown ID → 404.
* **Upload endpoint**: oversized file → **413 Payload Too Large**; disallowed type → **415 Unsupported Media Type**; 6th active attachment → **400 Bad Request** (BR-07).
* **List response envelope**: `{ "tickets": [...], "pagination": { "total", "page", "limit", "totalPages" } }`.
* **All unexpected errors** return 500 with a safe, generic message; no stack traces or internal details are exposed (BR-18).

---

## 9. Acceptance Criteria

**Creation**
* **AC-01**: Given valid ticket data and an active selected Requester, when the Requester submits Create Ticket, then one ticket is saved with status `PENDING` and the generated Ticket Number is returned and displayed.
* **AC-02**: Given Title < 5 or > 100 characters (or Description outside 10–1000), when submitted, then a field-level message appears and no API call is made.
* **AC-03**: Given a submission is already in flight, when the user clicks Submit again, then nothing additional happens (button disabled/busy) and exactly one ticket is created.
* **AC-04**: Given the backend is unreachable, when the user submits, then a safe error message appears and all typed values remain in the form.
* **AC-05**: Given a staged file of a disallowed type or > 5 MB, when added client-side, then it is rejected immediately with a clear message and never sent to the server.

**Development Requester context**
* **AC-06**: Given no Development Requester is selected, when the user attempts to open My Tickets or Create Ticket, then the Simulation-Mode warning/selection screen is shown instead.
* **AC-07**: Given the seeded data, when `GET /api/requesters` is called, then only active Requesters are returned (the inactive Requester is absent).
* **AC-08**: Given Requester A is selected and the user switches to B, then all Requester-specific data reloads for B and the header shows B's name.
* **AC-09**: Given a selected Requester, when the browser refreshes, then the selection is restored (persisted context).

**Listing**
* **AC-10**: Given Requester B is the active identity, when a ticket owned by Requester A is requested via `GET /api/tickets/:id`, then the API returns HTTP 403.
* **AC-11**: Given a search term and a Category filter are set, when My Tickets re-fetches, then the request includes the corresponding `search` and `categoryId` query parameters and the returned list matches both.
* **AC-12**: Given multiple filters combined with a search term, when applied, then results satisfy all conditions simultaneously; Clear Filters resets everything to the unfiltered list.
* **AC-13**: Given a sort field and order, when applied, then results order accordingly; the default (no params) is `createdAt` descending.
* **AC-14**: Given `page`/`limit` parameters, when requested, then the correct subset and metadata `{ total, page, limit, totalPages }` are returned; an out-of-range `limit` or unknown `sort` returns HTTP 400.
* **AC-15**: Given a Requester with zero tickets vs. filters matching zero tickets, then the empty state and the no-results state render with distinct messaging.

**Detail and ownership**
* **AC-16**: Given an owned ticket, when opened, then all fields display read-only with correct badges and no edit controls other than the Attachment section.
* **AC-17**: Given three tickets are created on the same calendar day, when each `POST /api/tickets` succeeds, then their Ticket Numbers increment sequentially (`0001`→`0003`) with no duplicates.

**Attachments**
* **AC-18**: Given an owned ticket with < 5 active attachments, when the owner uploads a valid file, then it appears in the active list (201).
* **AC-19**: Given a 6th active-attachment attempt, then the API rejects with 400 and the UI explains the limit.
* **AC-20**: Given an oversized (> 5 MB) or unsupported-type upload reaching the server, then it returns 413 or 415 respectively.
* **AC-21**: Given an active attachment owned by the active Requester, when `PATCH /api/attachments/:id/remove` is called with an empty `removalReason`, then the server returns 400 and `isRemoved` stays `false`.
* **AC-22**: Given a valid non-empty `removalReason` (3–200 chars), when the owner soft-removes an attachment, then `isRemoved` becomes `true`, the reason is stored, and the file remains listed as metadata.
* **AC-23**: Given a removed attachment, when anyone attempts to download it, then the API returns 410 and the UI disables the download action.
* **AC-24**: Given an attachment belongs to another Requester's ticket, when the active Requester attempts to download or soft-remove it, then the server returns 403.

**Responsive and accessibility**
* **AC-25**: At mobile width (`< 768px`), all screens stack vertically with no horizontal page scrolling and touch-friendly controls; at `≥ 992px` My Tickets renders as a table.
* **AC-26**: All forms are keyboard-operable with visible focus indicators, labels associated with controls, and required-field asterisks present (the asterisk never replaces the validation message).

---

## 10. Definition of Done (Product)

* [ ] All Included scope (Section 3) implemented; no Excluded feature present.
* [ ] Every Acceptance Criterion (AC-01–AC-26) is linked to at least one passing, non-skipped automated test traced in `docs/lab-02/tests.md`.
* [ ] All unit, API, UI, style, responsive, and E2E tests pass from documented commands on the final `main` branch.
* [ ] No required test is skipped, disabled, or commented out.
* [ ] Backend enforces ownership on every ticket/attachment endpoint, verified by cross-Requester tests (AC-10, AC-24).
* [ ] Screens conform to `ui-spec.md` (tokens, states, badges, responsive breakpoints), confirmed by screenshots at desktop/tablet/mobile.
* [ ] Implemented endpoints conform to `api-spec.md` (paths, request/response shapes, validation, status codes); the Prisma schema matches Section 7, with committed migrations.
* [ ] Responsive screenshots captured at Desktop, Tablet, and Mobile into `artifacts/lab-02/screenshots/` (create-ticket, my-tickets, ticket-detail).
* [ ] Peer-review evidence recorded in `docs/lab-02/reviewer.md`: reviewer identity, PR links, comments given and received, responses, and approvals.
* [ ] Frontend and backend validation are identical; failure paths preserve entered data (BR-10).
* [ ] Seed runs idempotently; migrations apply cleanly on an empty database.
* [ ] README documents setup, environment variables, and Prisma generate/migrate/seed and test commands accurately.
* [ ] `docs/lab-02/ai-use.md` records the LLM used, 6–10 key prompts, and a short reflection.
* [ ] All work merged through reviewed PRs: `feature/* → lab2-staging → main`; GitHub Project Kanban shows every Issue in Done.
* [ ] The student can explain every implementation choice and demonstrate failure cases live.

---

## 11. Assumptions and Decisions

**Confirmed decisions (student-approved):**
* **AD-01**: Identity transport is the `x-requester-id` custom header on every Requester-scoped request (not a query param or body field).
* **AD-02**: Ownership failures use mixed statuses: 403 when the resource exists but belongs to another Requester, 404 when it does not exist at all (avoids leaking existence information).
* **AD-03**: Create-time attachments are staged client-side, validated locally, and uploaded sequentially only after the ticket is successfully created; a failed upload never rolls back the ticket, and the UI shows a per-file retry warning instead (BR-10, BR-15).
* **AD-04**: The selected Requester persists in `localStorage` across page refreshes; Change Requester is always available; clearing storage returns the user to the Selection screen.

**Additional assumptions (agent-proposed, to be confirmed before implementation):**
* **AD-05**: Ticket status `PENDING` is the Lab 2 equivalent of a "New" ticket; `IN_PROGRESS`/`RESOLVED`/`CLOSED` exist in the schema for forward-compatibility but are never reachable this sprint.
* **AD-06**: Pagination defaults are `page=1`, `limit=10`, with an allowed `limit` range of 1–50; the sortable whitelist is `createdAt` and `priority` only (BR-06).
* **AD-07**: Attachment files are stored on local/server disk under a gitignored uploads directory, referenced by `filePath`; no external object storage is used in Lab 2.
* **AD-08**: `x-requester-id` is trusted at face value by the API in Lab 2 since there is no real authentication yet — an explicitly accepted, temporary weakness to be closed in Lab 3 (BR-19).
* **AD-09**: Category and Related System reference data are read-only in Lab 2 (no create/edit UI); they are seeded only.
* **AD-10**: A single Playwright configuration covers the responsive screenshot matrix (desktop ≥992px, tablet 768–991px, mobile <768px), matching the labsheet §8.7 breakpoints exactly.
* **AD-11**: Colors, breakpoints, and the "Account and Access" category name follow the labsheet's fixed values exactly (labsheet §5.3, §7, §8.7) rather than the team's earlier draft tokens — no deviation is justified here, since the labsheet fixes these values directly.
* **AD-12 (Test File Organization)**: Automated test files are split by concern (e.g., `tickets.test.ts`, `attachments.test.ts`, `attachmentMetadata.test.ts`, `safeFilename.unit.test.ts`, `requesters.test.ts`, `categories.test.ts`) rather than using the single per-screen file names shown as the labsheet's example minimum structure (§12: `create-ticket.api.test.ts`, `my-tickets.api.test.ts`, `ticket-detail.api.test.ts`, `attachments.api.test.ts`). This finer split keeps each file traceable to one Acceptance-Criterion group in `tests.md` and easier to run in isolation; it still satisfies the same coverage the labsheet requires. The single Playwright E2E spec is likewise kept at `client/tests/lab-02/flow.spec.ts` rather than `e2e/lab-02/requester-ticket-flow.spec.ts`, to co-locate it with the rest of the Lab 2 frontend test suite. This is a deliberate deviation from the labsheet's example paths, not an omission.
* **AD-13 (No `isActive` on Category/RelatedSystem)**: §8's endpoint names "Active Categories" / "Active Related Systems" describe the response, not a data-model flag — Category and RelatedSystem carry no `isActive` field (§7 confirms both are read-only, seeded-only reference data). Since §3 explicitly excludes admin management of Categories/Related Systems, there is no mechanism in Lab 2 to ever deactivate one; every seeded row is implicitly "active" by definition, so `GET /api/categories` and `GET /api/systems` simply return all seeded rows. If a future lab introduces admin-managed reference data, an `isActive` column can be added then without breaking this contract.

---

*End of specification. This document is the engineering contract for the AI coding agent; changes require student approval and a version bump.*

**Approval:** Reviewed and approved by the student on 2026-08-30. AD-01–AD-10 confirmed. This version is the implementation baseline (Spec-DD evidence for Issue #29 / #37).

**v1.1 amendment:** AD-13 added and approved by the student on [DATE — fill in]. Clarifies that "Active Categories" / "Active Related Systems" in §8 refer to all seeded rows (no `isActive` field exists on these models); resolves an ambiguity surfaced during schema review on Issue #41. No schema or API behavior changed by this amendment.