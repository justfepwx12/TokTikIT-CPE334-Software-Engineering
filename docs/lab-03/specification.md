# Lab 3 Sprint Engineering Specification

| | |
| :--- | :--- |
| **Project** | TokTickIT — IT Service Desk |
| **Sprint** | Lab 3: Authenticated Ticketing, IT Staff Workflow, Communication & Admin Console |
| **Version** | v1.0 — initial engineering contract for Sprint 3 |
| **Date** | 2026-09-14 |
| **Sources** | CPE 334 Lab 3 labsheet (course-provided handout, kept outside the repository); Lab 2 spec (docs/lab-02/specification.md) |
| **Related docs** | `api-spec.md`, `ui-spec.md`, `tests.md` |
| **Related Issue** | #77 *Issue 1: Lab 3 Engineering Contract (Spec-DD)* → sub-issues #87 (*specification.md*), #88 (*ui-spec.md* / *api-spec.md*), #89 (*tests.md*) |
| **Status** | Documentation only. No implementation code, schema migrations, or library installs are part of this issue. |

---

## 1. Sprint Goal

Evolve **TokTickIT** from a simulated, Requester-only Lab 2 MVP into an authenticated, role-based service desk that a real IT department and its end users share. The Lab 2 Development Requester selector and `x-requester-id` header are retired and replaced with real email + password authentication backed by an HTTP-only server-side session cookie (AD-01). Three roles — **Requester**, **IT Staff**, and **Administrator** — share one codebase, with identity (including who created each ticket and who owns it) derived strictly server-side from the authenticated session. IT Staff get an operational queue with ownership claim/reassign and a status workflow engine spanning eight statuses; requesters and staff collaborate through append-only public comments and role-restricted internal notes; and Administrators manage users through a minimal, guarded console without ever deleting accounts. Every protected behavior is enforced server-side regardless of what the frontend shows, and existing Lab 2 tickets, attachments, and reference data survive the schema evolution intact.

---

## 2. Stakeholder Request Interpretation

The IT department has reviewed the Lab 2 MVP. Requesters can already describe a problem, attach evidence, and find their tickets. What is missing is a **real identity layer and a working IT department** behind the screen. The department wants:

1. **Actual authentication** — end users log in with an email and password; there is no longer a "pick any requester" simulation. Passwords must never be stored in plaintext, inactive accounts must be blocked, and users forced to change an initial password on first login must not get into the application until they do.
2. **Three distinct roles** — Requesters file and track tickets; IT Staff open the queue, take ownership, work the problem, and move it through a defined lifecycle; Administrators manage the user base (create users, assign exactly one role, activate/deactivate, reset initial passwords) using a deliberately minimal console.
3. **A governed ticket lifecycle** — every status change follows a strict transition matrix, ownership is a real, single, assignable primary Owner (an active IT Staff member or Administrator), and priority is split into a Requester-submitted *Requested Priority* (read-only to IT) and an *IT Priority* that staff may change.
4. **Safe, audit-friendly collaboration** — Public Comments shared with the Requester and staff, plus Internal Notes visible only to IT Staff and Administrators; both are append-only and visually distinct so notes are never posted publicly by accident.
5. **Server-side trust** — the frontend may hide buttons for convenience, but the server enforces every role, ownership, and workflow rule. A user can never see, change, or delete anything they are not permitted to through direct API calls.

The business rules in `docs/lab-02/specification.md` that still describe Requester-facing behavior (ticket number generation, ownership of tickets/attachments, upload constraints, safe errors) carry forward unchanged where Lab 3 does not supersede them; identity transport is the one mechanism that is completely replaced (AD-07).

---

## 3. Scope

### Included
* Email + password authentication against the PostgreSQL-backed user table; passwords hashed with a strong one-way algorithm and never stored or returned in plaintext (BR-01).
* HTTP-only, server-side session cookie; login, logout, session restore (`/me`), and mandatory first-login password change (BR-03).
* Server-side Role-Based Access Control (RBAC) and ownership enforcement on every endpoint (BR-04, BR-05); removal of the simulated Development Requester selector and the `x-requester-id` header.
* IT Staff ticket queue with search, filters, and pagination.
* Ticket detail operations: ownership claim/reassign (single primary Owner), IT Priority change, and the status workflow engine with the eight-status transition matrix.
* Requester "Problem Appears Resolved" action (`POST /api/tickets/:id/resolve-intent`) with state-dependent behavior (BR-16, AD-02).
* Append-only Public Comments (Requester owner + IT Staff + Administrator) and role-restricted Internal Notes (IT Staff + Administrator only), with the append-only restriction enforced at both API and UI level.
* Minimal Administrator user management: list, search, create, edit basic info, single-role assignment, activate/deactivate, and reset initial passwords — protected by safety guards (BR-09–BR-12).
* Prisma schema evolution and migration that preserves all Lab 2 tickets, attachments, categories, and related systems, plus an idempotent seed script producing role-based users and sample tickets with comments and notes.
* Automated tests at unit, API, UI component, UI style, responsive, and E2E levels, all documented in `tests.md`.

### Excluded (DO NOT IMPLEMENT)
* Email delivery services — no email invitations, password-reset emails, or email notifications of any kind.
* MFA, Social Login, SSO, or self-registration.
* "Actions Taken" by IT Staff (deferred to Lab 4).
* Formal SLA calculations, escalation rules, or notification triggers.
* Advanced dashboards, analytics, or KPI metrics.
* Multi-tenant organizations, departments, or profile-picture uploads.
* Multiple roles per user, bulk user operations, import/export, or account audit history.
* Admin user-list pagination, multi-column sorting, or multiple simultaneous filters (a single search box is permitted — see AD-10).

---

## 4. Functional Requirements

**Authentication & Session**
* **FR-01**: Users authenticate with an email and a password; only active users (`isActive === true`) with correct credentials may authenticate (BR-01, BR-02). Success establishes an HTTP-only server-side session cookie.
* **FR-02**: A user with `mustChangePassword === true` may only reach the change-password flow (plus logout and session status); every other screen and endpoint is blocked with HTTP 403 until the password is changed (BR-03).
* **FR-03**: The authenticated user's name, email, and role come from the server session and are displayed in the app shell; a Logout action ends the session.
* **FR-04**: A page refresh restores the session via `GET /api/auth/me`; an expired or missing session redirects to Login.
* **FR-05**: Identity is always derived from the server-side session (`req.user.id`); the server ignores and strips any `requesterId` or equivalent field sent in the request body or query (BR-04).

**Role-based authorization**
* **FR-06**: Every protected endpoint enforces RBAC and ownership server-side; frontend hiding/disabling is visual feedback only (BR-05). Unauthorized access returns the correct safe status code without leaking resource existence (BR-06).

**Requester ticketing (carried forward)**
* **FR-07**: A Requester can create a ticket (title, description, category, related system, requested priority) — identity taken from the session; the official Ticket Number generation (Lab 2 BR-01) is unchanged.
* **FR-08**: A Requester can list/search/filter/sort/paginate their own tickets, open their own Ticket Detail, and manage their own attachments with the same rules as Lab 2.
* **FR-09**: A Requester can post Public Comments on, and view the Public Comments of, their own tickets only (BR-17).

**IT Staff workflow**
* **FR-10**: IT Staff and Administrators can view the full ticket queue (`GET /api/staff/tickets`) with search, filters, and pagination (BR-13).
* **FR-11**: An IT Staff member or Administrator can claim an unassigned ticket or reassign a ticket to another active IT Staff member or Administrator, making that person the single primary Owner (BR-13).
* **FR-12**: IT Staff and Administrators can change the **IT Priority** of any ticket; the **Requested Priority** is read-only for them (BR-14).
* **FR-13**: Tickets move between the eight statuses only along the documented transition matrix; invalid transitions are rejected with HTTP 400 (BR-15).
* **FR-14**: IT Staff and Administrators can create and read both Public Comments and Internal Notes on any ticket (BR-17, BR-18).

**Requester intent**
* **FR-15**: The owning Requester can trigger `POST /api/tickets/:id/resolve-intent`; according to the current state the ticket transitions to `RESOLVED` (from `NEW`/`OPEN`/`IN_PROGRESS`/`WAITING_FOR_REQUESTER`) or `REOPENED` (from `RESOLVED`/`CLOSED`). The Requester can never directly set status to `RESOLVED` or `CLOSED` (BR-16, AD-02).

**Communication engine**
* **FR-16**: Public Comments are visible to the ticket Owner/Requester, IT Staff, and Administrators; Internal Notes are visible only to IT Staff and Administrators. Requesters attempting to read or create notes receive HTTP 403 without any note content (BR-17, BR-18).
* **FR-17**: Comments and Notes are append-only; no edit or delete endpoint or UI control exists (BR-19).
* **FR-18**: Empty or whitespace-only comment/note submissions are rejected; length limits and safe rendering rules apply (BR-20).
* **FR-19**: The UI visually distinguishes Internal Notes (yellow tint + lock indicator) from Public Comments to prevent accidental public posting (BR-21).

**Administrator user management**
* **FR-20**: Administrators can list (single search box), create, edit basic user info, assign exactly one role, activate/deactivate accounts, and reset initial passwords (BR-07, BR-08).
* **FR-21**: The three safety guards are enforced: duplicate email → HTTP 409; Administrator cannot deactivate their own active account; the last active Administrator can never be deactivated (BR-09–BR-11).
* **FR-22**: No user is ever deleted from the database; deactivation (`isActive = false`) is the only lifecycle end state (BR-12).

**Data & seed**
* **FR-23**: The schema migration evolves the Lab 2 models without losing existing tickets, attachments, or reference data; the existing single `priority` and two remaining `Status` values map to the Lab 3 model (AD-04).
* **FR-24**: `prisma/seed.ts` is idempotent and produces ≥ 4 active Requesters + ≥ 1 inactive Requester, ≥ 3 active IT Staff + ≥ 1 inactive IT Staff, ≥ 1 active Administrator, and sample tickets across statuses and priorities with comments and notes.

---

## 5. Business Rules

### 5.1 Authentication & Security

* **BR-01 (Email & Password Authentication)** — Every user must authenticate with an email address and a password. Passwords are hashed with a strong one-way algorithm (bcrypt cost ≥ 10) and are **never** stored or returned in plaintext.
* **BR-02 (Active Account Enforcement)** — Only active users (`isActive === true`) with valid credentials may authenticate. Inactive-account login attempts are rejected with the same safe, generic error used for wrong passwords so the login endpoint does not leak whether an account exists or its state (BR-06).
* **BR-03 (Mandatory First-Login Password Change)** — A user with `mustChangePassword === true` cannot enter normal application screens until a valid new password is set through the change-password flow. Until then, every other protected route returns HTTP 403.
* **BR-04 (Server-Side Identity Ownership)** — Requester/owner identity is derived **strictly** from the server-side session (`req.user.id`). The server ignores and strips any `requesterId` (or similar) passed in client payloads; the client must not send one and any that is sent has no effect.
* **BR-05 (Backend Authorization Enforcement)** — Frontend hiding/disabling is visual feedback only, not security. Every API endpoint enforces Role-Based Access Control and ownership checks server-side.
* **BR-06 (Safe Error Handling)** — APIs return appropriate HTTP status codes (401, 403, 404, 409). Unauthorized access to a foreign ticket, attachment, comment, or note must not leak whether the resource exists (foreign resource → 403; genuinely missing resource → 404; user-scoped lists are simply scoped). Unexpected errors return a generic 500 message with no stack traces.

### 5.2 Administrator & User Management

* **BR-07 (Minimalist Admin Scope)** — Admin responsibilities are limited to user listing (single search box), creating users, editing basic user info, assigning one role, activating/deactivating accounts, and resetting initial passwords. Admin does not manage tickets **unless** the authorization matrix in §7 explicitly permits it (it does — full IT Staff ticket powers per §7). The excluded admin features listed in §3 are never implemented.
* **BR-08 (Single Role Assignment)** — A user is assigned **exactly one** role: `Requester`, `IT Staff`, or `Administrator`. There is no multi-role possibility.
* **BR-09 (Safety Guard 1 — Duplicate Email)** — Registering or updating a user to an email that already exists returns HTTP `409 Conflict`; the existing user is untouched.
* **BR-10 (Safety Guard 2 — Self-Deactivation Prevention)** — An Administrator may not deactivate their own active account; the attempt is rejected with HTTP 400 and the account stays active.
* **BR-11 (Safety Guard 3 — Last Admin Protection)** — The system prevents deactivating the last active Administrator. A deactivation (or role downgrade / deactivation attempt) that would leave zero active Administrators is rejected with HTTP 400.
* **BR-12 (No User Deletion)** — Users are never deleted from the database; account deactivation (`isActive = false`) is the only way to retire an account.

### 5.3 Ticket Operational Workflow, Ownership & Priority

* **BR-13 (Ticket Ownership)** — Each ticket has at most one primary Ticket Owner, which must be an active IT Staff or Administrator. A ticket may initially be unassigned (no owner). Claiming assigns the current user; reassigning moves ownership to a chosen active IT Staff/Administrator. Requesters are never owners.
* **BR-14 (Priority Model)** — Two priority fields coexist:
  * **Requested Priority**: submitted by the Requester at creation; read-only for IT Staff and Administrators (they see it, they never change it).
  * **IT Priority**: initialized as a copy of the Requested Priority; changeable only by IT Staff or Administrators.
* **BR-15 (Status Workflow Engine)** — Eight statuses are supported: `New`, `Open`, `In Progress`, `Waiting for Requester`, `Resolved`, `Closed`, `Reopened`, `Cancelled`. State changes must strictly follow the transition matrix in §6; invalid transitions are rejected with HTTP 400 and the status remains unchanged.
* **BR-16 (Requester Intent Action)** — Requesters cannot directly set ticket status to `Resolved` or `Closed`. Their only status-changing action is the state-dependent `POST /api/tickets/:id/resolve-intent` (FR-15, AD-02).

### 5.4 Communication Engine

* **BR-17 (Public Comments)** — Public Comments are shared communication visible to the Requester (owner), IT Staff, and Administrator. Their visibility is scoped to the ticket: a Requester sees comments only on tickets they own.
* **BR-18 (Internal Notes)** — Internal Notes are operational notes visible **only** to IT Staff and Administrator. Requesters attempting to access or create notes receive HTTP `403 Forbidden` with no note content revealed.
* **BR-19 (Append-Only Restriction)** — Comments and Notes are append-only. There are no edit and no delete endpoints or UI controls; an attempt to invoke a nonexistent edit/delete route returns 404/405.
* **BR-20 (Validation & Safety)** — Empty or whitespace-only submissions are rejected. Character limits are enforced at both API and UI layers (default: 1–2000 characters after trim, AD-08), and content is rendered safely (escaped text, no HTML injection).
* **BR-21 (UI Distinction)** — Internal Notes are visually distinct (yellow tint, lock indicator) from Public Comments so a note is never mistaken for, or accidentally posted as, a public comment.

### 5.5 Carried Forward from Lab 2 (unchanged unless superseded)

* Ticket Number generation `TK-YYYYMMDD-XXXX` (Lab 2 BR-01) and ticket creation defaults (Lab 2 BR-02) remain; `requesterId` now comes from the session (BR-04) instead of the header.
* Ticket and attachment ownership rules (Lab 2 BR-05, BR-14), attachment upload constraints (Lab 2 BR-07), attachment soft-removal (Lab 2 BR-08), field length limits (Lab 2 BR-12), safe error responses (Lab 2 BR-18), and safe filename/storage behavior (Lab 2 BR-20) remain in force for Requester-facing flows.

---

## 6. Status Transition Matrix

Transition rule: the ticket moves **from** exactly one status **to** exactly one status, and only along the edges below. `IT/Admin` = an authenticated active IT Staff or Administrator. `Requester (resolve-intent)` = the owning Requester calling `POST /api/tickets/:id/resolve-intent` (FR-15, AD-02). Any other requested transition is rejected with HTTP 400 (BR-15).

| From | To | Actors | Notes |
| :--- | :--- | :--- | :--- |
| `New` | `Open` | IT/Admin | Work formally started / accepted into the queue. |
| `New` | `In Progress` | IT/Admin | Direct start of work from a fresh ticket. |
| `New` | `Cancelled` | IT/Admin | Terminal; requester-created ticket withdrawn by staff. |
| `New` | `Resolved` | IT/Admin · Requester (resolve-intent) | Requester may also mark "Problem Appears Resolved". |
| `Open` | `In Progress` | IT/Admin | |
| `Open` | `Waiting for Requester` | IT/Admin | Staff need clarification/evidence from the Requester. |
| `Open` | `Resolved` | IT/Admin · Requester (resolve-intent) | |
| `Open` | `Cancelled` | IT/Admin | Terminal. |
| `In Progress` | `Open` | IT/Admin | Work paused and returned to the open set. |
| `In Progress` | `Waiting for Requester` | IT/Admin | |
| `In Progress` | `Resolved` | IT/Admin · Requester (resolve-intent) | |
| `In Progress` | `Cancelled` | IT/Admin | Terminal. |
| `Waiting for Requester` | `Open` | IT/Admin | |
| `Waiting for Requester` | `In Progress` | IT/Admin | Requester replied, work resumes. |
| `Waiting for Requester` | `Resolved` | IT/Admin · Requester (resolve-intent) | |
| `Waiting for Requester` | `Cancelled` | IT/Admin | Terminal. |
| `Resolved` | `Closed` | IT/Admin | Closure confirmed by staff; requester cannot force this. |
| `Resolved` | `Reopened` | Requester (resolve-intent) · IT/Admin | Requester reports the problem still occurs, or staff reopen. |
| `Closed` | `Reopened` | Requester (resolve-intent) · IT/Admin | Same reopen intent applies to closed tickets. |
| `Reopened` | `Open` | IT/Admin | |
| `Reopened` | `In Progress` | IT/Admin | |
| `Reopened` | `Waiting for Requester` | IT/Admin | |
| `Reopened` | `Resolved` | IT/Admin · Requester (resolve-intent) | |
| `Reopened` | `Cancelled` | IT/Admin | Terminal. |
| `Cancelled` | — | none | Terminal: no transitions out. |

Notes:
* `Resolved` is **also** reachable by the Requester, but only through the intent action — never by setting the status directly (BR-16).
* `Closed` is reachable only by IT/Admin from `Resolved`. The Requester's intent action on a `Closed` ticket reopens it rather than closing it further.
* Requester resolve-intent disposition: `NEW / OPEN / IN_PROGRESS / WAITING_FOR_REQUESTER → RESOLVED`; `RESOLVED / CLOSED → REOPENED` (AD-02).

---

## 7. Server-Side Authorization Matrix

Identity is the authenticated user's `role` from `req.user`. `Y` = permitted; `—` = denied (HTTP 403 for a valid, authenticated user lacking the role). Where an action is scoped to a specific ticket, additional ownership checks apply (e.g., a Requester only ever sees their own tickets).

| Capability | Requester | IT Staff | Administrator |
| :--- | :---: | :---: | :---: |
| Authenticate (login) | Y | Y | Y |
| Change own password | Y | Y | Y |
| Session status (`/me`), logout | Y | Y | Y |
| Create a ticket | Y | — | — |
| List / view own tickets & attachments | Y (own only) | Y (all) | Y (all) |
| IT Staff queue (`GET /api/staff/tickets`) | — | Y | Y |
| Open any ticket detail | — (own only) | Y | Y |
| Claim ownership of an unassigned ticket | — | Y | Y |
| Reassign ticket Owner | — | Y | Y |
| Change IT Priority | — | Y | Y |
| Change Status per transition matrix | — (only resolve-intent) | Y | Y |
| Trigger resolve-intent | Y (own tickets) | — | — |
| Create / read Public Comments | Y (own tickets) | Y | Y |
| Create / read Internal Notes | — (403, no leak) | Y | Y |
| Admin user management (list/search/create/edit/role) | — | — | Y |
| Activate / deactivate accounts | — | — | Y |
| Reset initial passwords | — | — | Y |
| Access History / SLA / dashboards | — | — | — (excluded scope) |

Note on the minimalist admin scope (BR-07): the matrix **explicitly permits** Administrators to exercise the full IT Staff ticket capabilities (queue, ownership, IT priority, status transitions, comments, notes), in line with issue #99 which names "IT Staff or Administrator" as the workflow actors. Admin remains the only role able to manage users.

---

## 8. UI Specification Summary

Full detail lives in `docs/lab-03/ui-spec.md`. Summary:

* **Login screen**: full-screen route; email + password; safe combined error for bad credentials (BR-02/BR-06); loading state on submit; "Authentication coming in" notice removed (it is here now).
* **Mandatory password-change screen**: shown only when `mustChangePassword === true`; cannot be skipped; current + new password fields with identical client/server validation; after success the user lands on their home screen (Requester → My Tickets, IT Staff/Admin → Ticket Queue).
* **App shell**: Primary Green header with "TokTickIT" brand, role-aware navigation consistent with the §7 authorization matrix (Requester: My Tickets / Create Ticket; IT Staff: Ticket Queue / My Tickets; Administrator: Ticket Queue / My Tickets / Users — ticket creation is Requester-only), the authenticated user's name + role with a Logout action. The Simulation-Mode banner and Development Requester selector are removed.
* **IT Staff Ticket Queue**: Zen Green data table (cards on mobile) with search, filters, and pagination; shows Ticket No, Title, Requester, Category, System, Requested Priority, IT Priority, Status, Owner, Updated; distinct loading / empty / no-results / error states.
* **Ticket Detail (IT/Admin)**: read-only requester-submitted fields (including Requested Priority), ownership controls (Claim / Reassign), IT Priority control, status workflow controls valid for the current state, and the Public Comments + Internal Notes sections (visually distinct, append-only editors).
* **Ticket Detail (Requester)**: as Lab 2, plus the "Problem Appears Resolved" action when the state permits, the Public Comments section (read + post), and no visibility of Internal Notes.
* **Admin User Management**: user table with single search box, status/role pills, Create User form, Edit User form (basic info + single role + activate/deactivate with safety-guard feedback), and Reset Password control; no pagination/sort/multi-filter.
* **Zen Green tokens** and responsive breakpoints are carried forward unchanged from `docs/lab-02/ui-spec.md` (Primary Green `#006B3C`, Secondary Green `#0B7A46`, Pale Green `#EAF6EF`, Page Background `#F5F7F6`, read-only token, Error `#B3261E`, Warning amber, Success; mobile `< 768px` / tablet `768–991px` / desktop `≥ 992px`).

---

## 9. Data Changes

### 9.1 New/changed Prisma models

| Model / Enum | Change | Key fields |
| :--- | :--- | :--- |
| **Requester** → **User** | Replaced. Lab 2 `Requester` rows migrate into `User` with role `REQUESTER`; `isActive` and `email` retained. | `id`, `name`, `email` (unique), `passwordHash`, `role` (enum), `isActive` (default true), `mustChangePassword` (default false), `createdAt`, `updatedAt` |
| **User.Role** | New enum | `REQUESTER` \| `IT_STAFF` \| `ADMIN` |
| **Ticket** | Evolved | Adds `requestedPriority`, `itPriority`, `ownerId` (nullable → User), `status` re-valued; `requesterId` now references `User`; existing fields (`ticketNo`, `title`, `description`, `categoryId`, `systemId`, timestamps) unchanged |
| **Ticket.Status** | Re-valued from Lab 2 | `NEW` \| `OPEN` \| `IN_PROGRESS` \| `WAITING_FOR_REQUESTER` \| `RESOLVED` \| `CLOSED` \| `REOPENED` \| `CANCELLED` |
| **Ticket.Priority** | Re-used for both priority fields | `LOW` \| `MEDIUM` \| `HIGH` \| `URGENT` |
| **Comment** | New — public communication | `id`, `body` (≤ 2000), `authorId` → User, `ticketId` → Ticket, `createdAt`; append-only |
| **InternalNote** | New — restricted communication | `id`, `body` (≤ 2000), `authorId` → User, `ticketId` → Ticket, `createdAt`; append-only |
| **Category / RelatedSystem / Attachment** | Unchanged | Retained as-is (Lab 2 data preserved) |

### 9.2 Migration & data mapping (AD-04)

* Lab 2 `PENDING` → Lab 3 `NEW` (the only status Lab 2 ever produced).
* Lab 2 single `priority` → both `requestedPriority` **and** `itPriority` (identical value), preserving the requester-submitted priority as the initial IT Priority (BR-14).
* `Requester` rows → `User` rows with `role = REQUESTER`, `passwordHash` set to the hash of a **single documented known initial password** (defined once, e.g. in the seed/migration config — AD-09) and `mustChangePassword = true`, so every migrated user must set their own password at first login (BR-03); tickets' `requesterId` re-links to the migrated user. No placeholder-random-per-row passwords; the initial credential is deterministic and shared/documented for the migration.
* `ownerId` is null for all migrated Lab 2 tickets (no ownership existed).
* All `ticketNo` values, categories, related systems, attachments (including soft-removed metadata), and timestamps are preserved byte-for-byte.

### 9.3 Seed script (`prisma/seed.ts`) — idempotent (FR-24)

* ≥ 4 Active Requesters and ≥ 1 Inactive Requester (existing Lab 2 names retained).
* ≥ 3 Active IT Staff and ≥ 1 Inactive IT Staff.
* ≥ 1 Active Administrator.
* Known password hash for the seeded users (documented for the demo/test accounts, not for production).
* Sample tickets spanning multiple statuses (`NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`) and priorities, some owned (assigned) and some unassigned, each with seeded public comments and internal notes where applicable.
* Uses upserts keyed on unique fields (email, ticketNo, etc.) so re-running never violates uniqueness constraints.

### 9.4 Indexes

* `User.email` unique (BR-01 lookup + BR-09 duplicate guard). `Comment.ticketId`, `InternalNote.ticketId` indexed (note/comment listing). `Ticket.ownerId` indexed (queue ownership queries). Existing Lab 2 indexes retained.

---

## 10. API Contract

Full request/response shapes in `docs/lab-03/api-spec.md`. Endpoint summary (all paths `/api`):

| Method | Path | Purpose | Roles | Success | Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| POST | `/auth/login` | Authenticate, establish session | all | 200 | 400, 401 |
| POST | `/auth/logout` | End session | all (authed) | 200 | 401 |
| GET | `/auth/me` | Session restore | all (authed) | 200 | 401 |
| POST | `/auth/change-password` | Change own password / first-login | all (authed) | 200 | 400, 401 |
| GET | `/staff/tickets` | IT Staff queue | IT Staff, Admin | 200 | 400, 401, 403 |
| POST | `/tickets/:id/claim` | Claim ownership | IT Staff, Admin | 200 | 400, 401, 403, 404 |
| POST | `/tickets/:id/assign` | Reassign owner | IT Staff, Admin | 200 | 400, 401, 403, 404 |
| PATCH | `/tickets/:id/it-priority` | Change IT Priority | IT Staff, Admin | 200 | 400, 401, 403, 404 |
| PATCH | `/tickets/:id/status` | Workflow transition (matrix) | IT Staff, Admin | 200 | 400, 401, 403, 404 |
| POST | `/tickets/:id/resolve-intent` | Requester "Problem Appears Resolved" | Requester (owner) | 200 | 400, 401, 403, 404 |
| GET | `/tickets/:id/comments` | List public comments | per visibility | 200 | 401, 403, 404 |
| POST | `/tickets/:id/comments` | Append public comment | per visibility | 201 | 400, 401, 403, 404 |
| GET | `/tickets/:id/notes` | List internal notes | IT Staff, Admin | 200 | 401, 403, 404 |
| POST | `/tickets/:id/notes` | Append internal note | IT Staff, Admin | 201 | 400, 401, 403, 404 |
| GET | `/admin/users` | List/search users | Admin | 200 | 401, 403 |
| POST | `/admin/users` | Create user | Admin | 201 | 400, 401, 403, 409 |
| PATCH | `/admin/users/:id` | Edit user / role / activate / deactivate | Admin | 200 | 400, 401, 403, 404, 409 |
| POST | `/admin/users/:id/reset-password` | Reset to initial password | Admin | 200 | 400, 401, 403, 404 |

**Contract decisions:**
* All endpoints except `POST /auth/login` require a valid session; unauthenticated requests return 401 (BR-06).
* Successful login **must** set the HTTP-only server-side session cookie (`SameSite=Lax`, `Secure` in production); it is never optional (AD-01, AD-06).
* A client-supplied `requesterId` in any payload is ignored/stripped — identity always comes from `req.user.id` (BR-04).
* Foreign resource → 403; truly missing resource → 404; foreign *list* endpoints simply scope (no existence leak).
* Auth failures: wrong password and inactive account produce the **same** safe 401 message (BR-02, BR-06).
* `mustChangePassword === true` → all non-password-change endpoints return 403 (BR-03).

---

## 11. Acceptance Criteria

**Authentication & sessions**
* **AC-01**: Given an active user with a correct email/password, when they log in, then the API returns 200 with the user payload and **always** establishes an HTTP-only server-side session cookie via `Set-Cookie` (mandatory, AD-01/AD-06).
* **AC-02**: Given a wrong password (any user), when login is attempted, then the API returns 401 with a safe, generic message that does not reveal account existence/state.
* **AC-03**: Given an inactive account, when login is attempted, then the API returns 401 with the same safe generic message.
* **AC-04**: Given a valid session, when the user calls `GET /api/auth/me`, then 200 returns the current user incl. role; when the session is missing/expired, 401 is returned.
* **AC-05**: Given a log out, when the session is then checked, then it is invalidated and `GET /api/auth/me` returns 401.

**First-login password change**
* **AC-06**: Given a user with `mustChangePassword === true`, when they call any normal endpoint, then the API returns 403 and only the change-password/logout/me routes succeed.
* **AC-07**: Given a valid new password through change-password on first login, then `mustChangePassword` is cleared, the session continues, and normal application access is granted.
* **AC-08**: Given a wrong current password or an invalid/too-short new password, then change-password returns 401/400 with a field message and nothing changes.

**Identity & RBAC regression**
* **AC-09**: Given a requesterId sent inside a ticket create payload, when the request is processed, then it is ignored and identity is taken from the session (BR-04).
* **AC-10**: Given an authenticated Requester, when they call staff queue, assign, claim, it-priority, status-set, or notes endpoints, then the API returns 403.
* **AC-11**: Given no session, when any protected endpoint is called, then the API returns 401.
* **AC-12**: Given Requester A's ticket, when Requester B requests its detail or comments, then the API returns 403/404 without revealing existence (BR-06).
* **AC-13**: Given an inactive or deactivated session user, when they act, then the API rejects them (401/403) with a safe error.

**Queue & detail operations**
* **AC-14**: Given IT Staff/Admin, when `GET /api/staff/tickets` is called, then a paginated/searchable/filterable queue is returned; Requester gets 403.
* **AC-15**: Given an unassigned ticket, when an IT Staff member claims it, then they become the single primary Owner (200).
* **AC-16**: Given a ticket, when an IT Staff/Admin reassigns it to another active IT Staff/Admin, then the Owner changes accordingly; invalid target → 400.
* **AC-17**: Given an IT Staff/Admin changing IT Priority, then it persists (200); a Requester attempting it → 403; requested priority is immutable to IT/Admin.

**Workflow engine**
* **AC-18**: Given a valid edge in the transition matrix, when the status endpoint is called with the correct role, then 200 returns the new status.
* **AC-19**: Given an invalid edge (e.g., `New → Closed`), when attempted, then 400 is returned, the matrix message is safe, and the status is unchanged.
* **AC-20**: Given the owning Requester, when resolve-intent is called from `NEW/OPEN/IN_PROGRESS/WAITING_FOR_REQUESTER`, then status becomes `RESOLVED`; from `RESOLVED/CLOSED`, status becomes `REOPENED`.
* **AC-21**: Given a Requester attempting to set status directly to `RESOLVED` or `CLOSED`, then the API rejects it (403/400).

**Communication engine**
* **AC-22**: Given authorized visibility, when public comments are fetched/posted, then they succeed with the visible-to-all shape.
* **AC-23**: Given a Requester accessing `GET/POST /api/tickets/:id/notes`, then 403 without any note content leak; IT Staff/Admin succeed.
* **AC-24**: Given an empty or whitespace-only comment/note, then 400 is returned and nothing is appended.
* **AC-25**: Given the append-only rule, then there are no working edit/delete endpoints for comments or notes; direct edit/delete attempts fail (404/405).

**Administrator console**
* **AC-26**: Given an Administrator, then list/search, create, edit (basic info + single role), activate/deactivate, and reset-password all succeed for valid inputs.
* **AC-27**: Given a create/update to an existing email, then 409 Conflict is returned and the existing user is unchanged (BR-09).
* **AC-28**: Given an Administrator attempting to deactivate their own active account, then 400 is returned and the account stays active (BR-10).
* **AC-29**: Given an action that would leave zero active Administrators, then 400 is returned (BR-11).
* **AC-30**: Given a non-Admin calling any `/admin/users` endpoint, then 403 is returned.
* **AC-31**: Given a user who is never allowed deletion, then the system exposes no delete path; deactivation is the only lifecycle end (BR-12).

**Data & seed**
* **AC-32**: Given the migration against a populated Lab 2 database, then all tickets/attachments/categories/systems survive; `PENDING` → `NEW`; single priority folds into both priority fields.
* **AC-33**: Given `prisma db seed` run repeatedly, then it is idempotent and produces the required role-based counts plus sample tickets with comments and notes.

---

## 12. Definition of Done (Product)

* [ ] All Included scope (Section 3) implemented; no Excluded feature present.
* [ ] Every Acceptance Criterion (AC-01–AC-33) is linked to at least one passing, non-skipped automated test traced in `docs/lab-03/tests.md`.
* [ ] All unit, API, UI, style, responsive, and E2E tests pass from documented commands on the final branch.
* [ ] No required test is skipped, disabled, or commented out.
* [ ] Backend enforces RBAC + ownership on every endpoint (verified by cross-role tests AC-10–AC-13, AC-23, AC-30).
* [ ] `requesterId` from client payloads is proven inert (AC-09).
* [ ] Screens conform to `ui-spec.md` (tokens, states, badges, responsive breakpoints), confirmed by screenshots at desktop/tablet/mobile.
* [ ] Implemented endpoints conform to `api-spec.md`; the Prisma schema matches Section 9, with committed migrations that preserve Lab 2 data (AC-32).
* [ ] Seed runs idempotently (AC-33) and migrations apply cleanly on an empty database.
* [ ] Peer-review evidence recorded in `docs/lab-03/reviewer.md`: reviewer identity, PR links, comments given/received, approvals.
* [ ] README documents setup, env vars, Prisma generate/migrate/seed, and test commands accurately for Lab 3.
* [ ] `docs/lab-03/ai_use.md` records the LLM used, key prompts, and a reflection.
* [ ] All work merged through reviewed PRs: `feature/* → lab3-staging → main`; GitHub Project Kanban shows every Issue in Done.
* [ ] The student can explain every implementation choice and demonstrate failure cases live.

---

## 13. Assumptions and Decisions

**Confirmed decisions (student-approved):**
* **AD-01 (Session Mechanism)**: Authentication uses an **HTTP-only, server-side session cookie** (see Decision Log). The user id (`req.user.id`) is resolved server-side from the session store; there is no client-visible token or bearer header. Session default TTL and SameSite are implementation details for Issue 3 (proposed: SameSite=Lax, rolling TTL).
* **AD-02 (Resolve-Intent Semantics)**: `POST /api/tickets/:id/resolve-intent` is state-dependent (FR-15, AC-20): `NEW / OPEN / IN_PROGRESS / WAITING_FOR_REQUESTER → RESOLVED`; `RESOLVED / CLOSED → REOPENED`. This is the Requester's **only** status-affecting action; direct status changes to `RESOLVED`/`CLOSED` are forbidden (BR-16).
* **AD-03 (Transition Matrix)**: The §6 matrix (including `Cancelled` as terminal and no Requester `Cancelled` action) is the authoritative workflow contract for Issue 5 / #99.

**Additional assumptions (agent-proposed, to be confirmed before implementation):**
* **AD-04 (Migration Mapping)**: `PENDING → NEW`; single `priority` copies into both `requestedPriority` and `itPriority`; `Requester` rows move to `User` with role `REQUESTER` and **`mustChangePassword = true`**, with `passwordHash` set from the single documented known initial password (see AD-09 — no placeholder-random option); migrated tickets get `ownerId = NULL`.
* **AD-05 (Password Hashing)**: bcrypt (cost ≥ 10) for all password hashes; no plaintext anywhere; hashes never returned by any endpoint.
* **AD-06 (Session & Cookie Defaults)**: HTTP-only, `SameSite=Lax`, secure in production, rolling expiration (idle timeout) as chosen by the student in Issue 3; session store persists in PostgreSQL so restarts do not log everyone out.
* **AD-07 (Identity Transport Removal)**: The `x-requester-id` header and Development Requester selector are removed in Lab 3; the client sends no identity header/field (BR-04, BR-21 UI).
* **AD-08 (Comment/Note Limits)**: Public Comments and Internal Notes are 1–2000 characters after trim; whitespace-only rejected (BR-20). The value is configurable in one place per layer.
* **AD-09 (Admin Reset Initial Password)**: Because email is excluded, an Administrator **sets** the temporary/reset password in the form (admin-typed, then shown once if generated). The reset sets `mustChangePassword = true`; the user must change it at next login (BR-03). Seeded demo accounts may reuse a documented known password with `mustChangePassword = false` for IT Staff/Admin demo logins, with all real new users created with `mustChangePassword = true`.
* **AD-10 (Admin Search Scope)**: A single search box (email/name partial match) is allowed on the Admin user list; pagination, multi-column sorting, and multiple simultaneous filters remain excluded per §3.
* **AD-11 (Admin Ticket Powers)**: Per §7, Administrators hold full IT Staff ticket capabilities (queue, ownership, IT priority, status transitions, comments/notes). This is the explicit "permission of the authorization matrix" that BR-07 refers to.
* **AD-12 (Test Directory Layout)**: Per Issue #89, Lab 3 API tests live at `server/tests/lab-03/`, UI component tests at `client/src/__tests__/lab-03/`, and Playwright specs at `e2e/lab-03/` — an intentional move away from Lab 2's `client/tests/lab-02/` grouping.

---

## 14. Decision Log (Auth Mechanism & Workflow)

Decision captured separately for the grading trail:

* **D-01 (Session Mechanism)**: HTTP-only server-side session cookie (express-session + PostgreSQL store) — chosen over stateless JWT because the business rule explicitly says the requester identity is derived "from the server-side session/token (`req.user.id`)" and a server-side session maximises server control (immediate logout, user deactivation blocks new requests, no revocation problem). AD-01.
* **D-02 (Resolve-Intent Behavior)**: State-dependent (AD-02) — chosen over a fixed "always → RESOLVED" because it also gives Requesters a non-adversarial way to re-report an unresolved problem (`REOPENED`) while keeping `CLOSED` staff-only (BR-16).
* **D-03 (Status Count & Semantics)**: Eight statuses (`New`, `Open`, `In Progress`, `Waiting for Requester`, `Resolved`, `Closed`, `Reopened`, `Cancelled`) per the business rule; `PENDING` maps to `NEW` (AD-04).
* **D-04 (Test Paths)**: Issue #89's mandated paths (`server/tests/lab-03/`, `client/src/__tests__/lab-03/`, `e2e/lab-03/`) supersede Lab 2's conventions (AD-12).

---

*End of specification. This document is the engineering contract for the AI coding agent; changes require student approval and a version bump.*

**Approval:** Reviewed and approved by the student on 2026-09-14. AD-01–AD-04 confirmed; AD-05–AD-12 pending confirmation (proposed defaults are safe and consistent with Lab 2 conventions).