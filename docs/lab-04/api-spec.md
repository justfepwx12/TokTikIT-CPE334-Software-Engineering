# Lab 4 – API Specification

| | |
| :--- | :--- |
| **Related doc** | `specification.md` §10 (API Contract summary) |
| **Related Issue** | #124 *Lab 4 Engineering Contract (Spec-DD)* → sub-issue #130 *Draft ui-spec.md / api-spec.md* |
| **Traceability** | Implements FR-25–FR-32, FR-34; BR-22, BR-23, BR-25–BR-29, BR-31; verified by AC-34–AC-47 |

All endpoints are prefixed with `/api`. Authentication, session handling, the `mustChangePassword` gate, and the safe-error rules are unchanged from `docs/lab-03/api-spec.md` §0 (BR-01–BR-06 carry forward). Lab 3 endpoints keep their contracts exactly; this document specifies only the new Lab 4 surface.

New status codes used below (in addition to the Lab 3 cheat-sheet):

| Code | Meaning |
| :---: | :--- |
| `409` + `STALE_VERSION` | `If-Match` version is older than the stored row (BR-27). Row untouched; response includes the current `version`. |
| `422` + `IDEMPOTENCY_KEY_REUSE` | `Idempotency-Key` was seen before with a different payload (BR-28). |

---

## 1. Actions Taken

### GET /api/tickets/:id/actions
Lists the actions of one ticket, newest-first (FR-27).

* **Method**: `GET`
* **Roles**: Requester (own tickets only), IT_STAFF, ADMIN. Foreign ticket for a Requester → `403`; unknown id → `404`; non-numeric id → `400`.
* **Query Parameters**:
  | Param | Type | Required | Notes |
  | :--- | :--- | :--- | :--- |
  | `page` | Int | No | 1-indexed. Default 1. Non-numeric → 400. |
  | `limit` | Int | No | Default 20. Allowed 1–50; out of range → 400. |
* **Status Codes**: `200 OK` · `400` · `401` · `403` · `404` · `500`
* **Response Shape**:
  ```json
  {
    "actions": [
      {
        "id": 7,
        "ticketId": 12,
        "actionAt": "2026-10-05T02:14:00.000Z",
        "description": "Restarted the VPN gateway service.",
        "result": "Connections stable for 30 minutes.",
        "performedBy": { "id": 8, "name": "Weerapong Chaiyaporn", "role": "IT_STAFF" },
        "followUpRequired": true,
        "followUpNote": "Re-check at end of shift.",
        "attachmentNotes": "gateway-log-2026-10-05.txt in /srv/logs",
        "version": 2,
        "createdAt": "2026-10-05T02:15:00.000Z",
        "updatedAt": "2026-10-05T03:01:00.000Z"
      }
    ],
    "pagination": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
  }
  ```

### POST /api/tickets/:id/actions
Records one action; the performer is always the caller (FR-25, BR-23).

* **Method**: `POST`
* **Roles**: IT_STAFF, ADMIN. Requester → `403` (even on own tickets); unknown ticket → `404`.
* **Headers**:
  | Header | Required | Notes |
  | :--- | :--- | :--- |
  | `Idempotency-Key` | No | Opaque token ≤ 64 chars (AD-15). Replay of same key + same ticket within 24h returns the stored `201` payload. Same key + different payload → `422`. |
* **Request Body**:
  ```json
  {
    "actionAt": "2026-10-05T02:14:00.000Z",
    "description": "Restarted the VPN gateway service.",
    "result": "Connections stable for 30 minutes.",
    "followUpRequired": true,
    "followUpNote": "Re-check at end of shift.",
    "attachmentNotes": "gateway-log-2026-10-05.txt in /srv/logs"
  }
  ```
  | Field | Type | Required | Validation |
  | :--- | :--- | :--- | :--- |
  | `actionAt` | ISO DateTime | Yes | `<= now + 5min` skew allowance (BR-22). |
  | `description` | String | Yes | 1–2000 chars after trim. |
  | `result` | String | Yes | 1–2000 chars after trim. |
  | `followUpRequired` | Boolean | No | Optional — defaults `false` when omitted. |
  | `followUpNote` | String | Conditional | Required 1–2000 chars after trim when `followUpRequired = true`; cleared by the server when `false`. |
  | `attachmentNotes` | String | No | 0–2000 chars, plain text. |
* **Ignored/stripped**: `performedBy`, `performedById`, `version`, `id`, `ticketId` in the body have no effect (BR-23, AD-14).
* **Status Codes**: `201 Created` (echoes the full action shape with `version: 1`) · `400` · `401` · `403` · `404` · `422` · `500`

### PATCH /api/actions/:id
Partially updates one action under optimistic concurrency (FR-26, BR-27).

* **Method**: `PATCH`
* **Roles**: IT_STAFF, ADMIN. Requester → `403`.
* **Headers**:
  | Header | Required | Notes |
  | :--- | :--- | :--- |
  | `If-Match` | Yes | The `version` the client last read (AD-14). Missing → `400`. Stale → `409 STALE_VERSION` with `{ "currentVersion": N }`; row untouched. |
* **Request Body** (all optional; validated exactly as POST when present):
  ```json
  { "result": "Stable for 2 hours.", "followUpRequired": false }
  ```
  Setting `followUpRequired` from `true` → `false` clears `followUpNote` (AD-18). `actionAt`/`ticketId`/`performedById` are immutable after creation — supplied values are ignored.
* **Status Codes**: `200 OK` (echoes full shape, `version + 1`) · `400` · `401` · `403` · `404` · `409` · `500`

---

## 2. Dashboards (aggregated only)

Both endpoints compute counts in-DB (`groupBy`/`count`) and return no ticket rows (BR-26). Every metric carries a `drillDown` descriptor the UI follows into an existing filtered list (FR-31, AD-16).

### GET /api/dashboard/requester/summary
Own-ticket counts for the caller (FR-29, BR-25).

* **Method**: `GET`
* **Roles**: Any authenticated role — REQUESTER, IT_STAFF, ADMIN — scoped strictly to the caller's own `requesterId` (BR-25). A Staff/Admin caller sees only tickets they requested themselves. No session → `401`.
* **Status Codes**: `200 OK` · `401` · `500` (no `403` here: every authenticated user may read their own requester-scoped counts)
* **Response Shape**:
  ```json
  {
    "scope": { "requesterId": 6 },
    "metrics": {
      "myOpen": 2,
      "myWaiting": 1,
      "myResolved": 1,
      "myClosed": 4,
      "myReopened": 0,
      "myCancelled": 0,
      "myFollowUpOpen": 1
    },
    "drillDown": {
      "myOpen": { "endpoint": "/api/tickets", "query": "status=NEW,OPEN,IN_PROGRESS" },
      "myWaiting": { "endpoint": "/api/tickets", "query": "status=WAITING_FOR_REQUESTER" },
      "myResolved": { "endpoint": "/api/tickets", "query": "status=RESOLVED" },
      "myClosed": { "endpoint": "/api/tickets", "query": "status=CLOSED" },
      "myReopened": { "endpoint": "/api/tickets", "query": "status=REOPENED" },
      "myCancelled": { "endpoint": "/api/tickets", "query": "status=CANCELLED" },
      "myFollowUpOpen": { "endpoint": "/api/tickets", "query": "status=NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED&followUp=true" }
    }
  }
  ```
* **Formula notes**: `myOpen` = own tickets in `NEW/OPEN/IN_PROGRESS`; `myWaiting` = own in `WAITING_FOR_REQUESTER`; the rest map 1:1 to their status; `myFollowUpOpen` = own non-terminal tickets whose latest recorded action (greatest `id`) has `followUpRequired = true` (AD-18). "Own" always means `requesterId = caller`, regardless of role. `myFollowUpOpen` drills into the `status` + `followUp` filters (§3); requester scope is enforced server-side. Empty scope → every metric `0` (BR-29).

### GET /api/dashboard/staff/summary
Operational counts for staff (FR-30, BR-25).

* **Method**: `GET`
* **Roles**: IT_STAFF, ADMIN. Requester → `403`. No session → `401`.
* **Status Codes**: `200 OK` · `401` · `403` · `500`
* **Response Shape**:
  ```json
  {
    "scope": { "viewerId": 8 },
    "metrics": {
      "unassignedCount": 5,
      "myAssignedCount": 3,
      "myInProgressCount": 2,
      "waitingForRequesterCount": 4,
      "followUpDueCount": 2,
      "resolvedTodayCount": 1
    },
    "drillDown": {
      "unassignedCount": { "endpoint": "/api/staff/tickets", "query": "ownerId=0&status=NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED" },
      "myAssignedCount": { "endpoint": "/api/staff/tickets", "query": "ownerId=8&status=NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED" },
      "myInProgressCount": { "endpoint": "/api/staff/tickets", "query": "ownerId=8&status=IN_PROGRESS" },
      "waitingForRequesterCount": { "endpoint": "/api/staff/tickets", "query": "status=WAITING_FOR_REQUESTER" },
      "followUpDueCount": { "endpoint": "/api/staff/tickets", "query": "status=NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED&followUp=true" },
      "resolvedTodayCount": { "endpoint": "/api/staff/tickets", "query": "status=RESOLVED&resolvedToday=true" }
    }
  }
  ```
* **Formula notes**: `unassignedCount` = `ownerId IS NULL` AND status non-terminal (`NEW/OPEN/IN_PROGRESS/WAITING_FOR_REQUESTER/REOPENED`); `myAssignedCount` = `ownerId = me` AND non-terminal; `waitingForRequesterCount` = all tickets in `WAITING_FOR_REQUESTER`; `followUpDueCount` = non-terminal tickets visible to the viewer whose latest recorded action (greatest `id`) has `followUpRequired = true` (AD-18) — the same predicate as the `followUp` list filter, so the drill-down returns exactly the counted set; `resolvedTodayCount` = tickets with status `RESOLVED` whose `updatedAt` falls in the current UTC day (AD-19 — documented approximation). Terminal (`CLOSED`, `CANCELLED`) tickets never enter attention buckets (BR-25).

---

## 3. Unchanged Lab 3 Surface

All Lab 3 endpoints (`/auth/*`, `/staff/tickets*`, ticket operations, resolve-intent, comments, notes, `/admin/users*`, and the carried-forward Lab 2 requester endpoints) keep their behavior, including the `mustChangePassword` gate and safe-error behavior. Lab 4 adds only optional query params to the two existing list endpoints (requests without them behave byte-for-byte as Lab 3) so dashboard drill-down can return each metric's exact ticket set (FR-31, AC-46):
* `GET /api/tickets` — `status` accepts comma-separated multi-values (unknown value → `400`); new `followUp` filter (`true` = tickets whose latest recorded action, greatest `id`, has `followUpRequired = true`; `false` = the rest; anything else → `400`). Requester scope (`requesterId = me`) is still enforced server-side.
* `GET /api/staff/tickets` — `status` accepts the same comma-separated multi-values (unknown value → `400`); new `followUp=true|false` (same latest-action predicate, anything else → `400`); new `resolvedToday=true` (status `RESOLVED` with `updatedAt` in the current UTC day per AD-19). Existing filters including the `ownerId=0` unassigned sentinel are unchanged.

---

## 4. Endpoint Errors Cheat-sheet (Lab 4 additions)

| Scenario | Code | Meaning |
| :--- | :---: | :--- |
| Requester POST/PATCH on actions | 403 | Create/update is Staff/Admin-only (§7). |
| Requester on staff summary | 403 | Dashboard scope is role-pinned. |
| Staff/Admin on requester summary | 200 | Allowed — scoped to own `requesterId` only (BR-25); sees just tickets they requested. |
| Missing `If-Match` on PATCH | 400 | Concurrency token required (AD-14). |
| Stale `If-Match` on PATCH | 409 | `STALE_VERSION`; re-fetch and retry (BR-27). |
| Reused `Idempotency-Key`, different payload | 422 | `IDEMPOTENCY_KEY_REUSE` (BR-28). |
| `followUpRequired=true` without note | 400 | Field validation (BR-22). |
| `actionAt` beyond skew window | 400 | Field validation (BR-22). |
| Unknown `status` / `followUp` / `resolvedToday` filter value | 400 | Unknown enum value on a list endpoint (§3). |

*End of API specification. Conforms to `specification.md` §5, §7, §10.*
