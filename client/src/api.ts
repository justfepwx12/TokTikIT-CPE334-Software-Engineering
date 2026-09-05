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

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type Status = "PENDING" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

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

export interface SystemStatus {
  online: boolean;
  categories: Category[];
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
  const healthData = await request<{ status: string }>("/api/health");
  const categories = await getCategories().catch(() => []);
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