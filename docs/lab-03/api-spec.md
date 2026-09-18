# Lab 3 – API Specification

| | |
| :--- | :--- |
| **Related doc** | `specification.md` §10 (API Contract summary) |
| **Related Issue** | #77 *Lab 3 Engineering Contract (Spec-DD)* → sub-issue #88 *Draft ui-spec.md / api-spec.md* |
| **Traceability** | Implements FR-01–FR-24, BR-01–BR-21; verified by AC-01–AC-33 |

All endpoints are prefixed with `/api`. Authentication uses an **HTTP-only server-side session cookie** established by `POST /api/auth/login` (AD-01). Once logged in, the user's identity and role come from `req.user`; clients do **not** send an identity header or field (BR-04, AD-07). The Lab 2 `x-requester-id` header is removed.

The Requester-facing ticket list/detail/create/attachment endpoints from Lab 2 remain (with identity now coming from the session); this document specifies the new Lab 3 surface in full and notes the Lab 2 endpoints where their contract is unchanged.

---

## 0. Conventions

* **Content type**: JSON request/response bodies unless noted.
* **Error envelope** (all 4xx/5xx):
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "Body must not be empty." } }
  ```
* **Status code families**:
  * `400` — invalid payload / invalid transition / guard violation.
  * `401` — not authenticated (no/invalid session).
  * `403` — authenticated but the role/ownership check fails (BR-05, BR-06). A Requester hitting staff routes, notes, or foreign resources gets 403; the response never reveals whether a foreign resource exists.
  * `404` — resource genuinely does not exist.
  * `409` — duplicate unique value (email, BR-09).
  * `500` — unexpected failure; never includes stack traces (BR-06).
* **Safe auth errors (BR-02)**: wrong password, unknown email, and inactive account all return the **same** response: `401` with `{ "code": "INVALID_CREDENTIALS", "message": "Invalid email or password." }`.
* **`mustChangePassword` gate (BR-03)**: while `req.user.mustChangePassword === true`, only `POST /api/auth/logout`, `POST /api/auth/change-password`, and `GET /api/auth/me` succeed; every other endpoint returns `403` with `{ "code": "PASSWORD_CHANGE_REQUIRED", "message": "You must change your password before continuing." }`.

---

## 1. Authentication API

### POST /api/auth/login
Authenticates an email + password and establishes the session cookie (BR-01, BR-02).

* **Method**: `POST`
* **Request Body**:
  ```json
  { "email": "jane@toktikit.com", "password": "s3cret-password" }
  ```
  | Field | Type | Required | Validation |
  | :--- | :--- | :--- | :--- |
  | `email` | String | Yes | Non-empty after trim; must be a valid email shape. |
  | `password` | String | Yes | Non-empty. |
* **Status Codes**: `200 OK` · `400 Bad Request` (missing/invalid fields) · `401 Unauthorized` (safe generic credentials error, BR-02) · `500`
* **Response Shape** (200):
  ```json
  {
    "user": {
      "id": 6,
      "name": "Jane Doe",
      "email": "jane@toktikit.com",
      "role": "IT_STAFF",
      "isActive": true,
      "mustChangePassword": false
    }
  }
  ```
  On success the server **always** sets the session cookie via the `Set-Cookie` header — HTTP-only, `SameSite=Lax`, `Secure` in production, persisted server-side (AD-01, AD-06). The cookie is mandatory: a `200 OK` without an established session cookie is a server error. Clients must accept it (credentials mode `include`) and send it back to ride the session; session default TTL/rolling-renewal are Issue 3 implementation details. `passwordHash` is never returned (BR-01).

### POST /api/auth/logout
Invalidates the session; requires an active session.

* **Method**: `POST`
* **Status Codes**: `200 OK` (session cleared) · `401` (no session)
* **Response Shape**: `{ "message": "Logged out." }`

### GET /api/auth/me
Returns the current session user (session restore on refresh).

* **Method**: `GET`
* **Status Codes**: `200 OK` · `401` (no/invalid session)
* **Response Shape**: same `{ "user": { ... } }` shape as login 200.

### POST /api/auth/change-password
Changes the current user's password. Always available, including while `mustChangePassword === true` (BR-03).

* **Method**: `POST`
* **Request Body**:
  ```json
  { "currentPassword": "s3cret-password", "newPassword": "N3w-s3cret-password" }
  ```
  | Field | Type | Required | Validation |
  | :--- | :--- | :--- | :--- |
  | `currentPassword` | String | Yes | Must match the current hash. |
  | `newPassword` | String | Yes | 8–128 chars after trim; not equal to currentPassword; confirmed client-side (no `confirm` field sent). |
* **Status Codes**: `200 OK` (`{ "message": "Password changed." }`) · `400` (new password fails validation) · `401` (wrong current password) · `500`
* **Behavior**: on success `mustChangePassword` is set to `false` (AC-07); the session remains valid.

---

## 2. IT Staff Ticket Queue

### GET /api/staff/tickets
Operational queue for IT Staff and Administrators (BR-13, BR-17 visibility). Returns all tickets regardless of requester.

* **Method**: `GET`
* **Roles**: IT_STAFF, ADMIN. Requester → `403`.
* **Query Parameters**:
  | Param | Type | Required | Notes |
  | :--- | :--- | :--- | :--- |
  | `search` | String | No | Case-insensitive partial match on `title` or `description`. |
  | `status` | String | No | One of the 8 statuses. |
  | `priority` | String | No | Matches **IT Priority** (`itPriority`). |
  | `categoryId` | Int | No | Category filter. |
  | `systemId` | Int | No | Related System filter. |
  | `ownerId` | Int | No | Filter by owner (incl. `unassigned` sentinel value `0`). |
  | `sort` | String | No | `updatedAt` \| `status` \| `priority`. Default `updatedAt`. Unknown → 400. |
  | `order` | String | No | `asc` \| `desc`. Default `desc`. |
  | `page` | Int | No | 1-indexed. Default 1. Non-numeric → 400. |
  | `limit` | Int | No | Default 10. Allowed 1–50; out of range → 400. |
* **Status Codes**: `200 OK` · `400` · `401` · `403` · `500`
* **Response Shape**:
  ```json
  {
    "tickets": [
      {
        "id": 12,
        "ticketNo": "TK-20260914-0001",
        "title": "VPN connection drops every 5 minutes",
        "requestedPriority": "HIGH",
        "itPriority": "HIGH",
        "status": "IN_PROGRESS",
        "createdAt": "2026-09-14T04:18:20.000Z",
        "updatedAt": "2026-09-14T05:02:00.000Z",
        "category": { "id": 3, "name": "Network" },
        "system": { "id": 3, "name": "VPN Service" },
        "requester": { "id": 6, "name": "Jane Doe" },
        "owner": { "id": 8, "name": "Weerapong Chaiyaporn" }
      }
    ],
    "pagination": { "total": 1, "page": 1, "limit": 10, "totalPages": 1 }
  }
  ```

---

## 3. Ticket Operational Endpoints (IT Staff / Admin)

All endpoints below require role IT_STAFF or ADMIN unless stated; ticket visibility applies to **all** tickets for these roles (§7). A genuinely missing ticket id → `404`; non-numeric id → `400`.

### POST /api/tickets/:id/claim
Claims ownership of an unassigned ticket (`ownerId` null). The current user becomes the Owner (BR-13).

* **Method**: `POST`
* **Roles**: IT_STAFF, ADMIN.
* **Status Codes**: `200 OK` · `400` (ticket already owned) · `401` · `403` · `404` · `500`
* **Response Shape**:
  ```json
  { "id": 12, "ownerId": 8, "owner": { "id": 8, "name": "Weerapong Chaiyaporn" } }
  ```

### POST /api/tickets/:id/assign
Reassigns the primary Owner to another active IT Staff or Administrator (BR-13).

* **Method**: `POST`
* **Roles**: IT_STAFF, ADMIN.
* **Request Body**:
  ```json
  { "ownerId": 9 }
  ```
  | Field | Type | Required | Validation |
  | :--- | :--- | :--- | :--- |
  | `ownerId` | Int | Yes | Must reference an **active** IT_STAFF or ADMIN user. Inactive/non-staff target → `400`. |
* **Status Codes**: `200 OK` (new owner echoed) · `400` (invalid/self-invalid target) · `401` · `403` · `404` · `500`

### PATCH /api/tickets/:id/it-priority
Changes the IT Priority. The Requested Priority is never modified (BR-14).

* **Method**: `PATCH`
* **Roles**: IT_STAFF, ADMIN.
* **Request Body**:
  ```json
  { "itPriority": "URGENT" }
  ```
  | Field | Type | Required | Validation |
  | :--- | :--- | :--- | :--- |
  | `itPriority` | String | Yes | One of `LOW`, `MEDIUM`, `HIGH`, `URGENT`. |
* **Status Codes**: `200 OK` · `400` (bad value) · `401` · `403` · `404` · `500`
* **Response Shape**: `{ "id": 12, "requestedPriority": "HIGH", "itPriority": "URGENT" }`

### PATCH /api/tickets/:id/status
Performs a status transition per the §6 matrix (BR-15).

* **Method**: `PATCH`
* **Roles**: IT_STAFF, ADMIN.
* **Request Body**:
  ```json
  { "status": "IN_PROGRESS" }
  ```
  | Field | Type | Required | Validation |
  | :--- | :--- | :--- | :--- |
  | `status` | String | Yes | One of the 8 statuses; must be a legal transition from the current status for this actor. |
* **Status Codes**:
  * `200 OK` — `{ "id": 12, "status": "IN_PROGRESS" }`
  * `400 Bad Request` — illegal transition (matrix violation), unknown status value.
  * `401` · `403` · `404` · `500`
* **Matrix errors**: `400` with `{ "code": "INVALID_STATUS_TRANSITION", "message": "Cannot move a ticket from IN_PROGRESS to CLOSED." }` — current status unchanged (AC-19).

### POST /api/tickets/:id/resolve-intent
Requester "Problem Appears Resolved" action (BR-16, AD-02). The Requester's **only** status-changing endpoint; it never sets `RESOLVED`/`CLOSED` directly.

* **Method**: `POST`
* **Roles**: REQUESTER only, and only the **owning Requester** of the ticket (BR-05).
* **Request Body**: none.
* **Transition**: current `NEW/OPEN/IN_PROGRESS/WAITING_FOR_REQUESTER` → `RESOLVED`; current `RESOLVED/CLOSED` → `REOPENED`.
* **Status Codes**: `200 OK` (`{ "id": 12, "status": "RESOLVED" }`) · `400` (current status `CANCELLED` or otherwise un-eligible) · `401` · `403` (not owner / wrong role) · `404` · `500`

---

## 4. Public Comments & Internal Notes

Comments and notes are **append-only** (BR-19): no edit/delete endpoints exist; `PUT`/`DELETE`/`PATCH` on these routes return `404`/`405`.

### GET /api/tickets/:id/comments
Lists the public comments of a ticket, newest-first (BR-17).

* **Method**: `GET`
* **Roles**: Requester (own tickets only), IT_STAFF, ADMIN.
* **Status Codes**: `200 OK` · `401` · `403` (foreign ticket for Requester; non-owner) · `404` · `500`
* **Response Shape**:
  ```json
  {
    "comments": [
      {
        "id": 3,
        "body": "The issue started after this morning's update.",
        "author": { "id": 6, "name": "Jane Doe", "role": "REQUESTER" },
        "createdAt": "2026-09-14T05:05:00.000Z"
      }
    ]
  }
  ```

### POST /api/tickets/:id/comments
Appends a public comment (BR-17, BR-20).

* **Method**: `POST`
* **Roles**: Requester (own tickets only), IT_STAFF, ADMIN.
* **Request Body**:
  ```json
  { "body": "Can you confirm which update was applied?" }
  ```
  | Field | Type | Required | Validation |
  | :--- | :--- | :--- | :--- |
  | `body` | String | Yes | 1–2000 chars after trim; whitespace-only rejected (BR-20 AD-08). |
* **Status Codes**: `201 Created` (echoes `{ "id", "body", "author", "createdAt" }`) · `400` · `401` · `403` · `404` · `500`

### GET /api/tickets/:id/notes
Lists internal notes, newest-first. **Requester → `403` with no note content** (BR-18).

* **Method**: `GET`
* **Roles**: IT_STAFF, ADMIN only. A Requester requesting this on their own ticket still gets `403` (never `200`/`404` that reveals anything).
* **Response Shape**: `{ "notes": [ { "id", "body", "author", "createdAt" } ] }`

### POST /api/tickets/:id/notes
Appends an internal note (BR-18, BR-19, BR-20). Same validation as comments.

* **Method**: `POST`
* **Roles**: IT_STAFF, ADMIN only. Requester → `403`.
* **Status Codes**: `201 Created` · `400` · `401` · `403` · `404` · `500`

---

## 5. Administrator User Management API

All endpoints require role ADMIN (BR-07). Non-Admin authenticated users → `403` (AC-30). No user is ever deleted (BR-12): there is no `DELETE /api/admin/users/:id`.

### GET /api/admin/users
Lists users with optional search + single Role filter (AD-10, spec v1.1). No pagination/sort/further filters (excluded scope §3).

* **Method**: `GET`
* **Roles**: ADMIN.
* **Query Parameters**:
  | Param | Type | Required | Notes |
  | :--- | :--- | :--- | :--- |
  | `search` | String | No | Case-insensitive partial match on name or email. |
  | `role` | String | No | One of `REQUESTER`, `IT_STAFF`, `ADMIN`. Unknown value → `400`. |
* **Status Codes**: `200 OK` · `401` · `403` · `500`
* **Response Shape**:
  ```json
  {
    "users": [
      {
        "id": 6,
        "name": "Jane Doe",
        "email": "jane@toktikit.com",
        "role": "IT_STAFF",
        "isActive": true,
        "mustChangePassword": false,
        "createdAt": "2026-09-14T04:00:00.000Z"
      }
    ]
  }
  ```

### POST /api/admin/users
Creates a user with exactly one role and an initial password (BR-08, BR-09).

* **Method**: `POST`
* **Roles**: ADMIN.
* **Request Body**:
  ```json
  {
    "name": "Somchai Jaidee",
    "email": "somchai.jaidee@toktikit.com",
    "role": "REQUESTER",
    "password": "Temporary-123",
    "isActive": true
  }
  ```
  | Field | Type | Required | Validation |
  | :--- | :--- | :--- | :--- |
  | `name` | String | Yes | 2–100 chars after trim. |
  | `email` | String | Yes | Valid email shape; **unique** — existing email → `409 Conflict` (BR-09). |
  | `role` | String | Yes | One of `REQUESTER`, `IT_STAFF`, `ADMIN`. |
  | `password` | String | Yes | 8–128 chars; hashed with bcrypt (BR-01, AD-05); never returned. |
  | `isActive` | Boolean | No | Default `true`. |
* **Contract note**: `mustChangePassword` is **not** a client-controlled field and is **never accepted** in the request body. The server **always** creates new users with `mustChangePassword = true` so they must change the password at first login (BR-03, AD-09); a body that includes the field is rejected with `400`.
* **Status Codes**: `201 Created` (`{ "user": { ... } }` without `passwordHash`) · `400` · `401` · `403` · `409 Conflict` (duplicate email) · `500`

### PATCH /api/admin/users/:id
Edits basic info, reassigns the single role, or activates/deactivates (BR-08, BR-10, BR-11).

* **Method**: `PATCH`
* **Roles**: ADMIN.
* **Request Body** (all optional; validate as POST):
  ```json
  { "name": "Somchai Jaidee Jr.", "role": "IT_STAFF", "isActive": true }
  ```
  | Field | Type | Notes |
  | :--- | :--- | :--- |
  | `name` | String | Optional. |
  | `email` | String | Optional; duplicate (another user) → `409`. |
  | `role` | String | Optional; single role enforced (BR-08). |
  | `isActive` | Boolean | Optional. |
* **Safety Guards**:
  * `400` — an Administrator attempts to deactivate their **own active** account (BR-10, AC-28).
  * `400` — the action would leave **zero active Administrators** (deactivating a sole active Admin, or downgrading their role / deactivating them) (BR-11, AC-29).
* **Status Codes**: `200 OK` (`{ "user": { ... } }`) · `400` (guard violation / bad value) · `401` · `403` · `404` (unknown id) · `409` (duplicate email) · `500`

### POST /api/admin/users/:id/reset-password
Sets an admin-chosen temporary password; marks the user for mandatory change at next login (BR-03, AD-09).

* **Method**: `POST`
* **Roles**: ADMIN.
* **Request Body**:
  ```json
  { "newPassword": "Reset-Temp-456" }
  ```
  | Field | Type | Required | Validation |
  | :--- | :--- | :--- | :--- |
  | `newPassword` | String | Yes | 8–128 chars; set as the user's new hash; `mustChangePassword = true`. |
* **Status Codes**: `200 OK` (`{ "message": "Password reset. User must change it on next login." }`) · `400` · `401` · `403` · `404` · `500`

---

## 6. Carried-Forward Lab 2 Endpoints (identity now from session)

These endpoints keep their Lab 2 contract (`docs/lab-02/api-spec.md`) **except** the identity mechanism: the `x-requester-id` header is replaced by the session cookie and `req.user.id` (BR-04, AD-07); a client-supplied `requesterId` is ignored/stripped (AC-09).

| Method | Path | Purpose | Roles |
| :--- | :--- | :--- | :--- |
| GET | `/api/categories` | Reference categories | all authed |
| GET | `/api/systems` | Reference related systems | all authed |
| GET | `/api/tickets` | Owned, paginated, filtered list | Requester (own), IT_STAFF/ADMIN see all via queue instead |
| GET | `/api/tickets/:id` | Ticket detail + attachments + comments | per visibility (BR-17) |
| POST | `/api/tickets` | Create ticket | Requester |
| POST | `/api/attachments/upload` | Upload attachment (≤5 MB) | Requester (owner) |
| GET | `/api/attachments/:id` | Attachment metadata | Requester (owner) |
| GET | `/api/attachments/:id/download` | Stream binary; 410 if removed | Requester (owner) |
| PATCH | `/api/attachments/:id/remove` | Soft-remove with reason | Requester (owner) |

HTTP status guidance carried from Lab 2 BR-05/BR-06: foreign resource → `403`; missing → `404`; removed download → `410`.

---

## 7. Endpoint Errors Cheat-sheet

| Scenario | Code | Meaning |
| :--- | :---: | :--- |
| Missing/invalid session (protected route) | 401 | Not authenticated. |
| Wrong password / unknown email / inactive account (login) | 401 | Safe generic credentials error (BR-02). |
| Authed but wrong role/ownership | 403 | RBAC/ownership denied; existence never revealed (BR-06). |
| `mustChangePassword` and using a normal route | 403 | Password change required (BR-03). |
| Resource does not exist | 404 | Genuinely unknown resource. |
| Duplicate email on user create/update | 409 | Duplicate unique value (BR-09). |
| Invalid payload / invalid transition / guard violation | 400 | Validation/matrix/safety-guard failure. |
| Removed attachment download | 410 | Soft-removed file (Lab 2 BR-08). |

*End of API specification. Conforms to `specification.md` §5, §7, §10.*