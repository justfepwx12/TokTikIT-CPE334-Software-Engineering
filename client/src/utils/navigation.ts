import type { AuthUser } from "../api.js";

// Role home (Lab 4 ui-spec §1, AD-17 — supersedes the Lab 3 §3 homes):
// Requester → requester dashboard; IT Staff/Admin → staff dashboard.
export function roleHome(user: AuthUser): string {
  return user.role === "REQUESTER" ? "/dashboard/requester" : "/dashboard/staff";
}

// Post-login redirects must stay inside the app's known routes — never follow
// an attacker-supplied path (open-redirect hardening). Query strings are
// allowed only as suffixes of whitelisted paths (drill-down targets).
export const ALLOWED_REDIRECTS = [
  /^\/dashboard\/requester(\?.*)?$/,
  /^\/dashboard\/staff(\?.*)?$/,
  /^\/my-tickets(\?.*)?$/,
  /^\/queue(\?.*)?$/,
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
