// Shared ticket id param parsing (api-spec §3: non-numeric id → 400).
// Single source so claim/assign/it-priority/status/detail stay consistent.
export function parseTicketIdParam(raw: unknown): number | null {
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return null;
  const id = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return id;
}
