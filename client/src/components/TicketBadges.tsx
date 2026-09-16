import Badge from "./Badge";
import type { TicketStatus, TicketPriority } from "../api";

// Single source of truth for ticket pill colors (ui-spec §9).
// WAITING_FOR_REQUESTER is amber/yellow — the ball is in the requester's court.
export const STATUS_COLOR: Record<TicketStatus, "gray" | "blue" | "green" | "yellow"> = {
  NEW: "gray",
  OPEN: "blue",
  IN_PROGRESS: "blue",
  WAITING_FOR_REQUESTER: "yellow",
  RESOLVED: "green",
  CLOSED: "gray",
  REOPENED: "blue",
  CANCELLED: "gray",
};

export const PRIORITY_COLOR: Record<TicketPriority, "gray" | "yellow" | "red" | "green"> = {
  LOW: "gray",
  MEDIUM: "yellow",
  HIGH: "red",
  URGENT: "red",
};

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return <Badge color={PRIORITY_COLOR[priority]}>{priority}</Badge>;
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <Badge color={STATUS_COLOR[status]}>{status}</Badge>;
}
