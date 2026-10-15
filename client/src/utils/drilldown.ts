import type { DrillDown } from "../api.js";

// Maps a server drillDown descriptor (api-spec §2, AD-16) to a client route.
// Only the two known list endpoints are honored — anything else falls back
// so the UI can never render a broken link (AC-55).
export function drillDownToClientUrl(drill: DrillDown | undefined, fallback: string): string {
  if (!drill || typeof drill.endpoint !== "string" || typeof drill.query !== "string") {
    return fallback;
  }
  if (drill.endpoint === "/api/staff/tickets") {
    return drill.query ? `/queue?${drill.query}` : "/queue";
  }
  if (drill.endpoint === "/api/tickets") {
    return drill.query ? `/my-tickets?${drill.query}` : "/my-tickets";
  }
  return fallback;
}
