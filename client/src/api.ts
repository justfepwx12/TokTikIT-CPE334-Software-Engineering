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
  return body?.error?.message ?? body?.error ?? `Request failed with status ${res.status}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    throw new Error(await loadErrorMessage(res));
  }
  return res.json() as Promise<T>;
}

export async function checkSystem(): Promise<SystemStatus> {
  const res = await fetch(`${API_URL}/api/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with status: ${res.status}`);
  }
  const healthData = await res.json();
  const catRes = await fetch(`${API_URL}/api/categories`);
  const categories = catRes.ok ? await catRes.json() : [];
  return {
    online: healthData.status === "ok",
    categories,
  };
}

export function getCategories(): Promise<Category[]> {
  return request<Category[]>("/api/categories");
}

export function getSystems(): Promise<RelatedSystem[]> {
  return request<RelatedSystem[]>("/api/systems");
}

export function createTicket(
  payload: CreateTicketPayload,
  requesterId: number
): Promise<Ticket> {
  return request<Ticket>("/api/tickets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-requester-id": String(requesterId),
    },
    body: JSON.stringify(payload),
  });
}

function buildQueryString(query: TicketQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function getTickets(
  query: TicketQuery,
  requesterId: number
): Promise<TicketsResponse> {
  return request<TicketsResponse>(`/api/tickets${buildQueryString(query)}`, {
    headers: {
      "x-requester-id": String(requesterId),
    },
  });
}

export function getTicket(ticketId: number, requesterId: number): Promise<TicketDetail> {
  return request<TicketDetail>(`/api/tickets/${ticketId}`, {
    headers: {
      "x-requester-id": String(requesterId),
    },
  });
}

// POST /api/attachments/upload — multipart upload linked to an owned ticket.
// Note: no Content-Type header is set; the browser supplies the boundary.
export async function uploadAttachment(
  ticketId: number,
  file: File,
  requesterId: number
): Promise<AttachmentUploadResponse> {
  const formData = new FormData();
  formData.append("ticketId", String(ticketId));
  formData.append("file", file);

  const res = await fetch(`${API_URL}/api/attachments/upload`, {
    method: "POST",
    headers: {
      "x-requester-id": String(requesterId),
    },
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
  attachmentId: number,
  requesterId: number
): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`${API_URL}/api/attachments/${attachmentId}/download`, {
    headers: {
      "x-requester-id": String(requesterId),
    },
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
  removalReason: string,
  requesterId: number
): Promise<AttachmentRemovalResponse> {
  return request<AttachmentRemovalResponse>(`/api/attachments/${attachmentId}/remove`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-requester-id": String(requesterId),
    },
    body: JSON.stringify({ removalReason }),
  });
}