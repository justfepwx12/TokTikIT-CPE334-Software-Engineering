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
  status?: TicketStatus;
  priority?: TicketPriority;
  categoryId?: number;
  systemId?: number;
  ownerId?: number;
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

export interface TicketQuery {
  search?: string;
  categoryId?: number;
  systemId?: number;
  status?: TicketStatus;
  priority?: TicketPriority;
  sort?: SortField;
  order?: SortOrder;
  page?: number;
  limit?: number;
}

async function loadErrorMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  const err = body?.error;
  if (typeof err === "string") return err;
  if (err && typeof err.message === "string") return err.message;
  return `Request failed with status ${res.status}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Session cookie auth (BR-04): the server identifies the user from the
  // HTTP-only session cookie, so every request must include credentials.
  // No identity header is sent — the legacy x-requester-id is gone (Issue #95).
  const res = await fetch(`${API_URL}${path}`, { credentials: "include", ...init });
  if (!res.ok) {
    throw new Error(await loadErrorMessage(res));
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