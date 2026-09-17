import type { TicketStatus, TicketPriority } from "../api";

// Single source of truth for ticket pill colors (ui-spec §9).
// WAITING_FOR_REQUESTER is amber/yellow — the ball is in the requester's court.
// Kept in a non-component module so TicketBadges.tsx only exports components
// (react-refresh/only-export-components).
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
