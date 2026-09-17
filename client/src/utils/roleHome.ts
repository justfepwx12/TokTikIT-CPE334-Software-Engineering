import type { AuthUser } from "../api.js";

// Role home (ui-spec §3): Requester → My Tickets.
// Staff queue lands in Issue 5, so IT Staff/Admin temporarily land on
// My Tickets to avoid a dead /queue link in this PR's scope.
export function roleHome(user: AuthUser): string {
  if (user.role === "IT_STAFF" || user.role === "ADMIN") {
    return "/my-tickets";
  }
  return "/my-tickets";
}
