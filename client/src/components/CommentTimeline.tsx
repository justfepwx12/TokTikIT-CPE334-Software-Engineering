import Badge, { type BadgeColor } from "./Badge";
import type { CommentAuthor } from "../api.js";

// Shared append-only timeline row (ui-spec §6/§7, BR-21): author name, role
// badge and timestamp on every entry. Rendering is text-only (no HTML
// injection — bodies are never dangerously set).
const ROLE_BADGE_COLOR: Record<string, BadgeColor> = {
  REQUESTER: "green",
  IT_STAFF: "blue",
  ADMIN: "yellow",
};

function roleLabel(role: string): string {
  if (role === "IT_STAFF") return "IT Staff";
  return role.charAt(0) + role.slice(1).toLowerCase();
}

function formatTimestamp(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export interface TimelineEntry {
  id: number;
  body: string;
  author: CommentAuthor;
  createdAt: string;
}

export default function CommentTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-secondary small mb-0">No entries yet.</p>;
  }
  return (
    <ul className="list-unstyled mb-0 d-flex flex-column gap-2">
      {entries.map((entry) => (
        <li
          key={entry.id}
          data-testid="timeline-entry"
          className="border rounded-3 p-2 px-3 bg-white"
        >
          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
            <span className="fw-semibold small text-dark">{entry.author.name}</span>
            <Badge color={ROLE_BADGE_COLOR[entry.author.role] ?? "gray"}>
              {roleLabel(entry.author.role)}
            </Badge>
            <span className="text-secondary small">{formatTimestamp(entry.createdAt)}</span>
          </div>
          <div className="small text-dark text-break">{entry.body}</div>
        </li>
      ))}
    </ul>
  );
}
