import Badge from "./Badge";
import type { TicketStatus, TicketPriority } from "../api";
import { STATUS_COLOR, PRIORITY_COLOR } from "../utils/badgeColors.js";

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return <Badge color={PRIORITY_COLOR[priority]}>{priority}</Badge>;
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <Badge color={STATUS_COLOR[status]}>{status}</Badge>;
}
