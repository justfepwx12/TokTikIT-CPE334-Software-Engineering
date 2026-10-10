const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export interface Requester {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketStatus =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_REQUESTER"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "CANCELLED";
export type SortField = "createdAt" | "requestedPriority";
export type SortOrder = "asc" | "desc";

export interface Ticket {
  id: number;
  ticketNo: string;
  title: string;
  description: string;
  requestedPriority: TicketPriority;
  itPriority: TicketPriority;
  status: TicketStatus;
  categoryId: number;
  systemId: number;
  requesterId: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketPayload {
  title: string;
  description: string;
  categoryId: number;
  systemId: number;
  // BR-14: the Requester always submits a Requested Priority; the server
  // initializes IT Priority as a copy of it.
  priority: TicketPriority;
}

export interface TicketSummary {
  id: number;
  ticketNo: string;
  title: string;
  description: string;
  requestedPriority: TicketPriority;
  itPriority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  category: Category;
  system: RelatedSystem;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TicketDetailAttachment {
  id: number;
  filename: string;
  mimeType: string;
  size: number;
  isRemoved: boolean;
}

export interface AttachmentUploadResponse {
  id: number;
  filename: string;
  mimeType: string;
  size: number;
  ticketId: number;
}

export interface AttachmentRemovalResponse {
  id: number;
  filename: string;
  isRemoved: boolean;
  removalReason: string;
  updatedAt: string;
}

export interface TicketDetail {
  id: number;
  ticketNo: string;
  title: string;
  description: string;
  requestedPriority: TicketPriority;
  itPriority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  category: Category;
  system: RelatedSystem;
  requester: { id: number; name: string };
  attachments: TicketDetailAttachment[];
}

export interface TicketsResponse {
  tickets: TicketSummary[];
  pagination: Pagination;
}

// ---------------------------------------------------------------------------
// IT Staff queue (api-spec §2, Issue #96). Sortable by Updated / Status /
// (IT) Priority; ownerId 0 = unassigned.
// ---------------------------------------------------------------------------

export type QueueSortField = "updatedAt" | "status" | "priority";

export interface StaffTicketQuery {
  search?: string;
  // Comma-separated multi-values per Lab 4 api-spec §3 (single values keep
  // working as Lab 3). Unknown values must never be sent — the server 400s.
  status?: string;
  priority?: TicketPriority;
  categoryId?: number;
  systemId?: number;
  ownerId?: number;
  // Lab 4 drill-down filters (api-spec §3): latest-action follow-up (AD-18)
  // and server-computed resolved-today (AD-19).
  followUp?: "true" | "false";
  resolvedToday?: "true";
  sort?: QueueSortField;
  order?: SortOrder;
  page?: number;
  limit?: number;
}

export interface StaffTicket {
  id: number;
  ticketNo: string;
  title: string;
  requestedPriority: TicketPriority;
  itPriority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  category: Category;
  system: RelatedSystem;
  requester: { id: number; name: string };
  owner: { id: number; name: string } | null;
}

export interface StaffTicketsResponse {
  tickets: StaffTicket[];
  pagination: Pagination;
}

export function getStaffTickets(query: StaffTicketQuery): Promise<StaffTicketsResponse> {
  return request<StaffTicketsResponse>(`/api/staff/tickets${buildQueryString(query)}`);
}

// ---------------------------------------------------------------------------
// Staff ticket operations (api-spec §3, Issues #98–#100).
// ---------------------------------------------------------------------------

export interface StaffTicketDetail extends StaffTicket {
  description: string;
  attachments: TicketDetailAttachment[];
}

export function getStaffTicket(ticketId: number): Promise<StaffTicketDetail> {
  return request<StaffTicketDetail>(`/api/staff/tickets/${ticketId}`);
}

export function claimTicket(ticketId: number): Promise<{
  id: number;
  ownerId: number;
  owner: { id: number; name: string };
}> {
  return request(`/api/tickets/${ticketId}/claim`, { method: "POST" });
}

export function assignTicket(
  ticketId: number,
  ownerId: number
): Promise<{ id: number; ownerId: number; owner: { id: number; name: string } }> {
  return request(`/api/tickets/${ticketId}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownerId }),
  });
}

export function setItPriority(
  ticketId: number,
  itPriority: TicketPriority
): Promise<{ id: number; requestedPriority: TicketPriority; itPriority: TicketPriority }> {
  return request(`/api/tickets/${ticketId}/it-priority`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itPriority }),
  });
}

export function setTicketStatus(
  ticketId: number,
  status: TicketStatus
): Promise<{ id: number; status: TicketStatus }> {
  return request(`/api/tickets/${ticketId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export interface TicketQuery {
  search?: string;
  categoryId?: number;
  systemId?: number;
  // Comma-separated multi-values per Lab 4 api-spec §3 (single values keep
  // working as Lab 3).
  status?: string;
  priority?: TicketPriority;
  // Lab 4 drill-down filter (api-spec §3, AD-18). Requester scope stays
  // server-enforced.
  followUp?: "true" | "false";
  sort?: SortField;
  order?: SortOrder;
  page?: number;
  limit?: number;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  currentVersion?: number;

  constructor(status: number, message: string, code?: string, currentVersion?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.currentVersion = currentVersion;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

async function loadErrorBody(res: Response): Promise<{ message: string; code?: string; currentVersion?: number }> {
  const body = await res.json().catch(() => null);
  const err = body?.error;
  if (err && typeof err === "object") {
    return {
      message: typeof err.message === "string" ? err.message : `Request failed with status ${res.status}`,
      code: typeof err.code === "string" ? err.code : undefined,
      currentVersion: typeof err.currentVersion === "number" ? err.currentVersion : undefined,
    };
  }
  if (typeof err === "string") return { message: err };
  return { message: `Request failed with status ${res.status}` };
}

async function loadErrorMessage(res: Response): Promise<string> {
  return (await loadErrorBody(res)).message;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Session cookie auth (BR-04): the server identifies the user from the
  // HTTP-only session cookie, so every request must include credentials.
  // No identity header is sent — the legacy x-requester-id is gone (Issue #95).
  const res = await fetch(`${API_URL}${path}`, { credentials: "include", ...init });
  if (!res.ok) {
    const body = await loadErrorBody(res);
    throw new ApiError(res.status, body.message, body.code, body.currentVersion);
  }
  return res.json() as Promise<T>;
}

export async function checkSystem(): Promise<SystemStatus> {
  const res = await fetch(`${API_URL}/api/health`, { credentials: "include" });
  if (!res.ok) {
    throw new Error(`Health check failed with status: ${res.status}`);
  }
  const healthData = await res.json();
  const catRes = await fetch(`${API_URL}/api/categories`, { credentials: "include" });
  const categories = catRes.ok ? await catRes.json() : [];
  return {
    online: healthData.status === "ok",
    categories,
  };
}

// ---------------------------------------------------------------------------
// Authentication API (Lab 3 Issue 3, api-spec §1). Session-cookie based
// (BR-04): identity comes from the server session, never from a header.
// ---------------------------------------------------------------------------

export type UserRole = "REQUESTER" | "IT_STAFF" | "ADMIN";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
}

export function getSessionUser(): Promise<{ user: AuthUser }> {
  return request<{ user: AuthUser }>("/api/auth/me");
}

export function loginUser(email: string, password: string): Promise<{ user: AuthUser }> {
  return request<{ user: AuthUser }>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function logoutUser(): Promise<{ message: string }> {
  return request<{ message: string }>("/api/auth/logout", { method: "POST" });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  return request<{ message: string }>("/api/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function getCategories(): Promise<Category[]> {
  return request<Category[]>("/api/categories");
}

export function getSystems(): Promise<RelatedSystem[]> {
  return request<RelatedSystem[]>("/api/systems");
}

export function createTicket(payload: CreateTicketPayload): Promise<Ticket> {
  return request<Ticket>("/api/tickets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

function buildQueryString(query: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function getTickets(query: TicketQuery): Promise<TicketsResponse> {
  return request<TicketsResponse>(`/api/tickets${buildQueryString(query)}`);
}

export function getTicket(ticketId: number): Promise<TicketDetail> {
  return request<TicketDetail>(`/api/tickets/${ticketId}`);
}

// POST /api/attachments/upload — multipart upload linked to an owned ticket.
// Note: no Content-Type header is set; the browser supplies the boundary.
export async function uploadAttachment(
  ticketId: number,
  file: File
): Promise<AttachmentUploadResponse> {
  const formData = new FormData();
  formData.append("ticketId", String(ticketId));
  formData.append("file", file);

  const res = await fetch(`${API_URL}/api/attachments/upload`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!res.ok) {
    throw new Error(await loadErrorMessage(res));
  }
  return res.json() as Promise<AttachmentUploadResponse>;
}

// GET /api/attachments/:id/download — returns the binary content. Callers
// trigger a browser download via triggerDownload(blob, filename).
export async function downloadAttachment(
  attachmentId: number
): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`${API_URL}/api/attachments/${attachmentId}/download`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(await loadErrorMessage(res));
  }
  return { blob: await res.blob(), filename: attachmentFilenameFromResponse(res) };
}

function attachmentFilenameFromResponse(res: Response): string {
  const disposition = res.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="([^"]+)"/);
  if (match?.[1]) return match[1];
  return "download";
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// PATCH /api/attachments/:id/remove — soft-removal with mandatory reason.
export function removeAttachment(
  attachmentId: number,
  removalReason: string
): Promise<AttachmentRemovalResponse> {
  return request<AttachmentRemovalResponse>(`/api/attachments/${attachmentId}/remove`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ removalReason }),
  });
}
// ---------------------------------------------------------------------------
// Administrator User Management (Lab 3 Issue 8, api-spec §5). Admin only.
// No user is ever deleted (BR-12): deactivation is the only lifecycle end.
// ---------------------------------------------------------------------------

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface AdminUserQuery {
  search?: string;
  role?: UserRole;
}

export interface CreateAdminUserPayload {
  name: string;
  email: string;
  role: UserRole;
  password: string;
  isActive?: boolean;
}

export interface UpdateAdminUserPayload {
  name?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
}

export function getAdminUsers(query: AdminUserQuery = {}): Promise<{ users: AdminUser[] }> {
  return request<{ users: AdminUser[] }>(`/api/admin/users${buildQueryString(query)}`);
}

export function createAdminUser(payload: CreateAdminUserPayload): Promise<{ user: AdminUser }> {
  return request<{ user: AdminUser }>("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateAdminUser(
  userId: number,
  payload: UpdateAdminUserPayload
): Promise<{ user: AdminUser }> {
  return request<{ user: AdminUser }>(`/api/admin/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function resetAdminPassword(userId: number, newPassword: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/api/admin/users/${userId}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newPassword }),
  });
}

// ---------------------------------------------------------------------------
// Communication engine (Lab 3 Issue 7, api-spec §4). Append-only timelines:
// Public Comments (owning Requester + IT Staff/Admin) and Internal Notes
// (IT Staff/Admin only — the requester UI never fetches them, BR-18).
// ---------------------------------------------------------------------------

export interface CommentAuthor {
  id: number;
  name: string;
  role: UserRole;
}
export interface TicketComment {
  id: number;
  body: string;
  author: CommentAuthor;
  createdAt: string;
}

export interface InternalNote {
  id: number;
  body: string;
  author: CommentAuthor;
  createdAt: string;
}

// Client mirrors the server contract (api-spec §4, BR-20): 1–2000 chars
// after trim. The server is authoritative; this only gives instant feedback.
export const COMMENT_BODY_MIN = 1;
export const COMMENT_BODY_MAX = 2000;

export function getComments(ticketId: number): Promise<{ comments: TicketComment[] }> {
  return request<{ comments: TicketComment[] }>(`/api/tickets/${ticketId}/comments`);
}

export function postComment(ticketId: number, body: string): Promise<TicketComment> {
  return request<TicketComment>(`/api/tickets/${ticketId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}

export function getNotes(ticketId: number): Promise<{ notes: InternalNote[] }> {
  return request<{ notes: InternalNote[] }>(`/api/tickets/${ticketId}/notes`);
}

export function postNote(ticketId: number, body: string): Promise<InternalNote> {
  return request<InternalNote>(`/api/tickets/${ticketId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}
// POST /api/tickets/:id/resolve-intent — the requester's only
// status-affecting action (ui-spec §7, BR-16, AD-02). State-dependent:
// NEW/OPEN/IN_PROGRESS/WAITING_FOR_REQUESTER → RESOLVED,
// RESOLVED/CLOSED → REOPENED.
export function triggerResolveIntent(ticketId: number): Promise<{ id: number; status: TicketStatus }> {
  return request<{ id: number; status: TicketStatus }>(`/api/tickets/${ticketId}/resolve-intent`, {
    method: "POST",
  });
}

// ---------------------------------------------------------------------------
// Lab 4 Dashboards (api-spec §2, Issues #138–#139). Aggregated-only: the
// server computes every metric in-DB and returns counts + drillDown
// descriptors — the client never counts ticket rows (BR-26). Zero metrics
// render as 0, never blank (BR-29).
// ---------------------------------------------------------------------------

export interface DrillDown {
  endpoint: string;
  query: string;
}

export interface RequesterSummary {
  scope: { requesterId: number };
  metrics: {
    myOpen: number;
    myWaiting: number;
    myResolved: number;
    myClosed: number;
    myReopened: number;
    myCancelled: number;
    myFollowUpOpen: number;
  };
  drillDown: Record<string, DrillDown>;
}

export interface StaffSummary {
  scope: { viewerId: number };
  metrics: {
    unassignedCount: number;
    myAssignedCount: number;
    myInProgressCount: number;
    waitingForRequesterCount: number;
    followUpDueCount: number;
    resolvedTodayCount: number;
  };
  drillDown: Record<string, DrillDown>;
}

export function getRequesterSummary(): Promise<RequesterSummary> {
  return request<RequesterSummary>("/api/dashboard/requester/summary");
}

export function getStaffSummary(): Promise<StaffSummary> {
  return request<StaffSummary>("/api/dashboard/staff/summary");
}

// ---------------------------------------------------------------------------
// Lab 4 Actions Taken (api-spec §1, Issues #135/#137/#140). Performer identity
// is server-derived (BR-23) — the client never sends performedBy/performedById.
// Concurrency travels in If-Match (AD-14); idempotent creates carry an
// Idempotency-Key header (AD-15). A `version` in the body is ignored.
// ---------------------------------------------------------------------------

export interface ActionPerformer {
  id: number;
  name: string;
  role: UserRole;
}

export interface ActionTaken {
  id: number;
  ticketId: number;
  actionAt: string;
  description: string;
  result: string;
  performedBy: ActionPerformer;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActionsResponse {
  actions: ActionTaken[];
  pagination: Pagination;
}

// Client mirrors the server contract (api-spec §1, BR-22). The server is
// authoritative; these only give instant feedback before sending.
export const ACTION_TEXT_MIN = 1;
export const ACTION_TEXT_MAX = 2000;
export const ACTION_FUTURE_SKEW_MS = 5 * 60 * 1000;

export interface CreateActionPayload {
  actionAt: string;
  description: string;
  result: string;
  followUpRequired?: boolean;
  followUpNote?: string;
  attachmentNotes?: string;
}

export interface UpdateActionPayload {
  description?: string;
  result?: string;
  followUpRequired?: boolean;
  followUpNote?: string | null;
  attachmentNotes?: string | null;
}

export function getTicketActions(ticketId: number, page = 1, limit = 20): Promise<ActionsResponse> {
  return request<ActionsResponse>(`/api/tickets/${ticketId}/actions?page=${page}&limit=${limit}`);
}

export function createTicketAction(
  ticketId: number,
  payload: CreateActionPayload,
  idempotencyKey?: string
): Promise<ActionTaken> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  return request<ActionTaken>(`/api/tickets/${ticketId}/actions`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

export function updateTicketAction(
  actionId: number,
  payload: UpdateActionPayload,
  ifMatch: number
): Promise<ActionTaken> {
  return request<ActionTaken>(`/api/actions/${actionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "If-Match": String(ifMatch) },
    body: JSON.stringify(payload),
  });
}
