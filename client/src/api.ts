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

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type Status = "PENDING" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type SortField = "createdAt" | "priority";
export type SortOrder = "asc" | "desc";

export interface Ticket {
  id: number;
  ticketNo: string;
  title: string;
  description: string;
  priority: Priority;
  status: Status;
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
  priority: Priority;
}

export interface TicketSummary {
  id: number;
  ticketNo: string;
  title: string;
  description: string;
  priority: Priority;
  status: Status;
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

export interface TicketsResponse {
  tickets: TicketSummary[];
  pagination: Pagination;
}

export interface TicketQuery {
  search?: string;
  categoryId?: number;
  systemId?: number;
  status?: Status;
  priority?: Priority;
  sort?: SortField;
  order?: SortOrder;
  page?: number;
  limit?: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      body?.error?.message ?? body?.error ?? `Request failed with status ${res.status}`;
    throw new Error(message);
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