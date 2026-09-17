import type { AuthUser } from "../api.js";

// Role home (ui-spec §3): Requester → My Tickets; IT Staff/Admin → Ticket Queue.
export function roleHome(user: AuthUser): string {
  return user.role === "REQUESTER" ? "/my-tickets" : "/queue";
}

// Post-login redirects must stay inside the app's known routes — never follow
// an attacker-supplied path (open-redirect hardening).
export const ALLOWED_REDIRECTS = [
  /^\/my-tickets$/,
  /^\/queue$/,
  /^\/create-ticket$/,
  /^\/tickets\/\d+$/,
  /^\/change-password$/,
  /^\/$/,
];

export function safeRedirect(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    if (ALLOWED_REDIRECTS.some((re) => re.test(decoded))) return decoded;
    return null;
  } catch {
    return null;
  }
}
