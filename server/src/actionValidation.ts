import { z } from 'zod';

// Lab 4 BR-22 / AD-14 / AD-15 — pure ActionTaken payload validation.
// Extracted from controllers/actions.controller.ts so Unit tests (tests.md
// row 3, AC-35) can cover the contract without a database, while the
// controller stays the single enforcement point (BR-05).
//
// Rules (specification.md §5.1, api-spec §1):
// - actionAt: required on create, valid ISO, <= now + 5min skew.
// - description/result: 1–2000 chars after trim.
// - followUpRequired: optional, defaults false on create; absent keeps stored
//   value on update.
// - followUpNote: required 1–2000 after trim when effective flag is true
//   (supplied now, or already stored on PATCH); server clears to null when
//   flag is false.
// - attachmentNotes: optional plain text 0–2000; empty string normalizes to
//   null on create.
// - Immutable-after-creation fields (actionAt/ticketId/performedById/version
//   in body) are ignored — enforced here by never reading them into `input`
//   except actionAt-on-create.

export const ACTION_TEXT_MIN = 1;
export const ACTION_TEXT_MAX = 2000;
// BR-22: 5-minute clock-skew allowance for actionAt.
export const ACTION_FUTURE_SKEW_MS = 5 * 60 * 1000;
// AD-15: opaque Idempotency-Key, ≤ 64 chars, 24h TTL per ticket.
export const IDEMPOTENCY_KEY_MAX = 64;
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export function isValidActionAt(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length === 0) return false;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return false;
  return ms <= Date.now() + ACTION_FUTURE_SKEW_MS;
}

const textField = z.string().trim().min(ACTION_TEXT_MIN).max(ACTION_TEXT_MAX);

// Every mutable field is unknown-optional here; cross-field rules
// (followUpNote conditional) are enforced in validateActionInput so POST and
// PATCH share one contract ("validated exactly as POST when present").
const actionInputSchema = z.object({
  actionAt: z.unknown().optional(),
  description: z.unknown().optional(),
  result: z.unknown().optional(),
  followUpRequired: z.boolean().optional(),
  followUpNote: z.unknown().optional(),
  attachmentNotes: z.unknown().optional(),
});

export type ValidatedActionInput = {
  actionAt: Date;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
};

export type ExistingFollowUp = {
  followUpRequired: boolean;
  followUpNote: string | null;
} | null;

/**
 * Validates a create-or-update payload. `forUpdate=false` requires
 * actionAt/description/result; `forUpdate=true` allows every mutable field
 * to be absent (absent flag keeps the stored value). Returns normalized
 * input or a 400 message. Pure — no I/O, deterministic except the
 * now-relative skew window (injectable via Date.now mock in tests).
 */
export function validateActionInput(
  body: unknown,
  forUpdate: boolean,
  existing: ExistingFollowUp = null,
): { ok: true; input: Partial<ValidatedActionInput> } | { ok: false; message: string } {
  const parsed = actionInputSchema.safeParse(body);
  if (!parsed.success || typeof body !== 'object' || body === null) {
    return { ok: false, message: 'Request body must be a JSON object.' };
  }
  const { actionAt, description, result, followUpRequired, followUpNote, attachmentNotes } = parsed.data;
  const input: Partial<ValidatedActionInput> = {};

  if (!forUpdate) {
    if (!isValidActionAt(actionAt)) {
      return { ok: false, message: 'actionAt must be a valid ISO datetime no more than 5 minutes in the future.' };
    }
    input.actionAt = new Date(actionAt as string);
  }
  if (description !== undefined || !forUpdate) {
    const check = textField.safeParse(description);
    if (!check.success) return { ok: false, message: `description must be ${ACTION_TEXT_MIN}–${ACTION_TEXT_MAX} characters after trim.` };
    input.description = check.data;
  }
  if (result !== undefined || !forUpdate) {
    const check = textField.safeParse(result);
    if (!check.success) return { ok: false, message: `result must be ${ACTION_TEXT_MIN}–${ACTION_TEXT_MAX} characters after trim.` };
    input.result = check.data;
  }
  // BR-22: followUpRequired optional, defaults false on create; on update
  // an absent flag keeps the stored value.
  const wantFollowUp = followUpRequired ?? (forUpdate ? existing?.followUpRequired : false);
  if (wantFollowUp !== undefined) input.followUpRequired = wantFollowUp;
  const effectiveFollowUp = wantFollowUp ?? false;

  if (effectiveFollowUp) {
    // A true flag needs a note: supplied now, or already stored on the row
    // for PATCH edits that leave the flag on.
    if (followUpNote !== undefined) {
      const check = textField.safeParse(followUpNote);
      if (!check.success) {
        return { ok: false, message: `followUpNote is required (${ACTION_TEXT_MIN}–${ACTION_TEXT_MAX} characters after trim) when followUpRequired is true.` };
      }
      input.followUpNote = check.data;
    } else if (!(forUpdate && existing?.followUpNote)) {
      return { ok: false, message: `followUpNote is required (${ACTION_TEXT_MIN}–${ACTION_TEXT_MAX} characters after trim) when followUpRequired is true.` };
    }
    // else: keep the stored note; nothing to normalize.
  } else {
    // Server clears the note when the flag is off (BR-22).
    input.followUpNote = null;
  }

  if (attachmentNotes !== undefined) {
    if (typeof attachmentNotes !== 'string' || attachmentNotes.length > ACTION_TEXT_MAX) {
      return { ok: false, message: `attachmentNotes must be plain text of at most ${ACTION_TEXT_MAX} characters.` };
    }
    input.attachmentNotes = attachmentNotes.length === 0 ? null : attachmentNotes;
  } else if (!forUpdate) {
    input.attachmentNotes = null;
  }
  return { ok: true, input };
}

/** Canonical fingerprint for Idempotency-Key payload comparison (BR-28). */
export function fingerprintAction(input: ValidatedActionInput): string {
  return JSON.stringify([
    input.actionAt.toISOString(),
    input.description,
    input.result,
    input.followUpRequired,
    input.followUpNote,
    input.attachmentNotes,
  ]);
}

export function isFreshEntry(entry: { expiresAt: Date }): boolean {
  return entry.expiresAt.getTime() > Date.now();
}
