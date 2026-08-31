# Lab 2 – API Specification

| | |
| :--- | :--- |
| **Related doc** | `specification.md` §8 (API Contract summary) |
| **Related Issue** | #29 *Lab 2 Engineering Contract (Spec-DD)* → sub-issue #38 *Draft api-spec.md* |
| **Traceability** | Implements FR-01, FR-05–FR-07, FR-10–FR-18, BR-01–BR-20; verified by AC-01, AC-06–AC-07, AC-10–AC-24 |

All backend endpoints are prefixed with `/api`. Simulated Requester context is passed via the custom header `x-requester-id` (the `id` of the active Requester) on every Requester-scoped request — see `specification.md` AD-01.

---

## 0. Conventions

* **Content type**: JSON request/response bodies unless noted (`multipart/form-data` for uploads).
* **Error envelope** (all 4xx/5xx responses):
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "Title must be between 5 and 100 characters." } }
  ```
* **Common status codes across Requester-scoped endpoints**:
  * `401 Unauthorized` — `x-requester-id` header missing.
  * `403 Forbidden` — Requester is inactive, or does not own the resource (BR-04, BR-05).
  * `500 Internal Server Error` — unexpected failure; body never includes stack traces (BR-18).

---

## 1. Requesters API

### GET /api/requesters
Retrieves active Development Requesters available for simulation (BR-04).

* **Method**: `GET`
* **Headers**: None required.
* **Query Parameters**: None.
* **Status Codes**: `200 OK` · `500`
* **Response Shape**:
  ```json
  [
    { "id": 1, "name": "Jane Doe", "email": "jane@example.com", "isActive": true },
    { "id": 2, "name": "John Smith", "email": "john@example.com", "isActive": true }
  ]
  ```

---

## 2. Categories API

### GET /api/categories
Retrieves all seeded IT Categories.

* **Method**: `GET`
* **Headers**: None required.
* **Status Codes**: `200 OK` · `500`
* **Response Shape**:
  ```json
  [
    { "id": 1, "name": "Account and Access" },
    { "id": 2, "name": "Hardware" },
    { "id": 3, "name": "Software" },
    { "id": 4, "name": "Network" }
  ]
  ```

---

## 3. Related Systems API

### GET /api/systems
Retrieves all seeded Related Systems.

* **Method**: `GET`
* **Headers**: None required.
* **Status Codes**: `200 OK` · `500`
* **Response Shape**:
  ```json
  [
    { "id": 1, "name": "Email Client" },
    { "id": 2, "name": "ERP Portal" },
    { "id": 3, "name": "VPN Service" },
    { "id": 4, "name": "HR Management System" },
    { "id": 5, "name": "Database Cluster" },
    { "id": 6, "name": "Shared Storage" }
  ]
  ```

---

## 4. Tickets API

### GET /api/tickets
Retrieves a paginated, sorted, filtered list of tickets, scoped to the active Requester (BR-05, BR-06).

* **Method**: `GET`
* **Headers**: `x-requester-id` (Required, Int)
* **Query Parameters**:
  | Param | Type | Required | Notes |
  | :--- | :--- | :--- | :--- |
  | `search` | String | No | Case-insensitive partial match on `title` or `description`. |
  | `categoryId` | Int | No | Filters by Category ID. |
  | `systemId` | Int | No | Filters by Related System ID. |
  | `status` | String | No | One of `PENDING`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`. |
  | `priority` | String | No | One of `LOW`, `MEDIUM`, `HIGH`, `URGENT`. |
  | `sort` | String | No | `createdAt` \| `priority`. Default `createdAt`. Any other value → 400. |
  | `order` | String | No | `asc` \| `desc`. Default `desc`. |
  | `page` | Int | No | 1-indexed. Default `1`. Non-numeric → 400. |
  | `limit` | Int | No | Default `10`. Allowed range 1–50; out of range → 400. |
* **Status Codes**: `200 OK` · `400 Bad Request` (invalid `sort`/`page`/`limit`) · `401` · `403` · `500`
* **Response Shape**:
  ```json
  {
    "tickets": [
      {
        "id": 12,
        "ticketNo": "TK-20260830-0001",
        "title": "VPN connection drops every 5 minutes",
        "description": "I cannot stay connected to the corporate VPN for longer than five minutes.",
        "priority": "HIGH",
        "status": "PENDING",
        "createdAt": "2026-08-30T04:18:20.000Z",
        "category": { "id": 3, "name": "Network" },
        "system": { "id": 3, "name": "VPN Service" }
      }
    ],
    "pagination": { "total": 1, "page": 1, "limit": 10, "totalPages": 1 }
  }
  ```

### GET /api/tickets/:id
Retrieves the full details of one owned ticket, including active attachments (BR-14).

* **Method**: `GET`
* **Headers**: `x-requester-id` (Required, Int)
* **Status Codes**: `200 OK` · `401` · `403` (not owner or inactive) · `404 Not Found` (ticket does not exist) · `500`
* **Response Shape**:
  ```json
  {
    "id": 12,
    "ticketNo": "TK-20260830-0001",
    "title": "VPN connection drops every 5 minutes",
    "description": "I cannot stay connected to the corporate VPN for longer than five minutes.",
    "priority": "HIGH",
    "status": "PENDING",
    "createdAt": "2026-08-30T04:18:20.000Z",
    "updatedAt": "2026-08-30T04:18:20.000Z",
    "category": { "id": 3, "name": "Network" },
    "system": { "id": 3, "name": "VPN Service" },
    "requester": { "id": 1, "name": "Jane Doe" },
    "attachments": [
      { "id": 4, "filename": "screenshot_vpn_error.png", "mimeType": "image/png", "size": 154200, "isRemoved": false }
    ]
  }
  ```

### POST /api/tickets
Creates a new IT ticket; automatically generates the unique Ticket Number (BR-01).

* **Method**: `POST`
* **Headers**: `x-requester-id` (Required, Int)
* **Request Body**:
  | Field | Type | Required | Validation |
  | :--- | :--- | :--- | :--- |
  | `title` | String | Yes | 5–100 chars after trim (BR-12). |
  | `description` | String | Yes | 10–1000 chars after trim (BR-12). |
  | `categoryId` | Int | Yes | Must reference an existing Category. |
  | `systemId` | Int | Yes | Must reference an existing Related System. |
  | `priority` | String | Yes | One of `LOW`, `MEDIUM`, `HIGH`, `URGENT`. |
* **Status Codes**: `201 Created` · `400 Bad Request` (validation) · `401` · `403` (inactive Requester) · `500`
* **Response Shape**:
  ```json
  {
    "id": 13,
    "ticketNo": "TK-20260830-0002",
    "title": "Cannot access HR system portal",
    "description": "Whenever I navigate to the portal, it displays a blank screen.",
    "priority": "MEDIUM",
    "status": "PENDING",
    "createdAt": "2026-08-30T04:30:00.000Z"
  }
  ```

---

## 5. Attachments API

### Safe filename & storage behavior (applies to all endpoints below)
The client-supplied `filename` is stored **only as display metadata** (`filename` field) and is never used to build a filesystem path. On upload, the server generates a random UUID-based storage name (e.g. `a1b2c3d4-....png`, extension derived from the validated MIME type) and writes the file under a fixed, non-user-controlled uploads directory — this prevents filename collisions and blocks path-traversal input (`../`, absolute paths, embedded separators) since the client-supplied name never reaches the filesystem layer. Downloads stream the file back with the original `filename` in the `Content-Disposition` header (BR-20).

### POST /api/attachments/upload
Uploads a file and links it to an existing owned ticket (BR-07).

* **Method**: `POST`
* **Headers**: `x-requester-id` (Required, Int) · `Content-Type: multipart/form-data`
* **Multipart Form Fields**:
  | Field | Type | Required | Notes |
  | :--- | :--- | :--- | :--- |
  | `ticketId` | Int | Yes | ID of the target owned ticket. |
  | `file` | Binary | Yes | ≤ 5 MB; `image/jpeg`, `image/png`, `image/webp`, or `application/pdf`. |
* **Status Codes**:
  * `201 Created` — uploaded and linked.
  * `400 Bad Request` — ticket already has 5 active attachments.
  * `401` / `403` — missing header / inactive Requester or not the ticket owner.
  * `413 Payload Too Large` — file exceeds 5 MB.
  * `415 Unsupported Media Type` — disallowed MIME type.
  * `500`
* **Response Shape**:
  ```json
  { "id": 5, "filename": "screenshot_error.png", "mimeType": "image/png", "size": 245000, "ticketId": 13 }
  ```

### GET /api/attachments/:id
Retrieves one attachment's metadata only (no binary content), independent of ticket detail retrieval — required as its own capability per the labsheet's API contract list.

* **Method**: `GET`
* **Headers**: `x-requester-id` (Required, Int)
* **Status Codes**: `200 OK` · `401` / `403` (missing header / inactive Requester or not the ticket owner) · `404 Not Found` (attachment does not exist) · `500`
* **Response Shape**:
  ```json
  {
    "id": 5,
    "filename": "screenshot_error.png",
    "mimeType": "image/png",
    "size": 245000,
    "ticketId": 13,
    "isRemoved": false,
    "removalReason": null,
    "createdAt": "2026-08-30T04:35:00.000Z",
    "updatedAt": "2026-08-30T04:35:00.000Z"
  }
  ```
  A soft-removed attachment still returns `200` here (metadata always stays visible per BR-08) — `410 Gone` applies only to the `/download` endpoint below, never to this metadata endpoint.

### GET /api/attachments/:id/download
Downloads an attachment. Enforces strict ownership validation (BR-05, BR-08).

* **Method**: `GET`
* **Headers**: `x-requester-id` (Required, Int)
* **Status Codes**:
  * `200 OK` — binary file stream (active attachment only).
  * `401` / `403` — missing header / inactive Requester or not the ticket owner.
  * `404 Not Found` — attachment ID does not exist.
  * `410 Gone` — attachment exists but has been soft-removed (BR-08).
  * `500`

### PATCH /api/attachments/:id/remove
Soft-removes an attachment with a mandatory reason (BR-08).

* **Method**: `PATCH`
* **Headers**: `x-requester-id` (Required, Int)
* **Request Body**:
  ```json
  { "removalReason": "This file contains sensitive database keys and must be removed from the ticket view." }
  ```
* **Validation**: `removalReason` required, non-empty after trim, 3–200 characters.
* **Status Codes**: `200 OK` · `400 Bad Request` (missing/empty/too-short reason) · `401` · `403` · `404 Not Found` · `500`
* **Response Shape**:
  ```json
  {
    "id": 5,
    "filename": "screenshot_error.png",
    "isRemoved": true,
    "removalReason": "This file contains sensitive database keys and must be removed from the ticket view.",
    "updatedAt": "2026-08-30T04:35:00.000Z"
  }
  ```
