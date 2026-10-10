import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { getPrisma } from '../src/prisma.js';
import type { AuthRequest } from '../src/auth.middleware.js';
import { parseTicketIdParam } from '../src/ticketId.js';

// Actions Taken engine (Lab 4 api-spec §1, BR-22–BR-24, BR-27–BR-28).
// List is visible to the owning Requester + IT Staff/Admin; create/update is
// Staff/Admin-only (enforced by requireRole in App.ts — Requester → 403).
// The performer is always the session user (BR-23); recording or editing an
// action never drives ticket status (BR-24).

const TEXT_MIN = 1;
const TEXT_MAX = 2000;
// BR-22: actionAt must not be in the future beyond a 5-minute clock-skew
// allowance.
const FUTURE_SKEW_MS = 5 * 60 * 1000;
// AD-15: opaque client token, ≤ 64 chars, honored for 24h per ticket.
const IDEMPOTENCY_KEY_MAX = 64;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/** Action ids travel in the path the same way ticket ids do (400 if bad). */
function parseActionIdParam(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
  const id = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return id;
}

function isValidActionAt(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length === 0) return false;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return false;
  return ms <= Date.now() + FUTURE_SKEW_MS;
}

const textField = z.string().trim().min(TEXT_MIN).max(TEXT_MAX);

// POST body: every field optional-checked here; cross-field rules
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

type ValidatedActionInput = {
  actionAt: Date;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
};

/**
 * Validates a create-or-update payload. `forUpdate` allows every mutable
 * field to be absent (PATCH); present mutable fields are validated exactly
 * as POST. Immutable-after-creation fields (actionAt/ticketId/performedById)
 * are ignored entirely on update. Returns the normalized input or a 400
 * message.
 */
function validateActionInput(
  body: unknown,
  forUpdate: boolean,
  existing: { followUpRequired: boolean; followUpNote: string | null } | null = null,
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
    if (!check.success) return { ok: false, message: `description must be ${TEXT_MIN}–${TEXT_MAX} characters after trim.` };
    input.description = check.data;
  }
  if (result !== undefined || !forUpdate) {
    const check = textField.safeParse(result);
    if (!check.success) return { ok: false, message: `result must be ${TEXT_MIN}–${TEXT_MAX} characters after trim.` };
    input.result = check.data;
  }
  // BR-22: followUpRequired is optional and defaults to false on create; on
  // update an absent flag keeps the stored value.
  const wantFollowUp = followUpRequired ?? (forUpdate ? existing?.followUpRequired : false);
  if (wantFollowUp !== undefined) input.followUpRequired = wantFollowUp;
  const effectiveFollowUp = wantFollowUp ?? false;

  if (effectiveFollowUp) {
    // A true flag needs a note: supplied in this request, or already stored
    // on the row for PATCH edits that leave the flag on.
    if (followUpNote !== undefined) {
      const check = textField.safeParse(followUpNote);
      if (!check.success) {
        return { ok: false, message: `followUpNote is required (${TEXT_MIN}–${TEXT_MAX} characters after trim) when followUpRequired is true.` };
      }
      input.followUpNote = check.data;
    } else if (!(forUpdate && existing?.followUpNote)) {
      return { ok: false, message: `followUpNote is required (${TEXT_MIN}–${TEXT_MAX} characters after trim) when followUpRequired is true.` };
    }
    // else: keep the stored note; nothing to normalize.
  } else {
    // Server clears the note when the flag is off (BR-22).
    input.followUpNote = null;
  }

  if (attachmentNotes !== undefined) {
    if (typeof attachmentNotes !== 'string' || attachmentNotes.length > TEXT_MAX) {
      return { ok: false, message: `attachmentNotes must be plain text of at most ${TEXT_MAX} characters.` };
    }
    input.attachmentNotes = attachmentNotes.length === 0 ? null : attachmentNotes;
  } else if (!forUpdate) {
    input.attachmentNotes = null;
  }
  return { ok: true, input };
}

/** Shared: session check + numeric id parse + ticket existence. */
async function loadTicket(req: Request, res: Response) {
  const sessionUser = (req as AuthRequest).user;
  if (!sessionUser) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid session' },
    });
    return null;
  }

  const ticketId = parseTicketIdParam(req.params.id);
  if (ticketId === null) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Ticket id must be a positive integer' },
    });
    return null;
  }

  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Ticket not found' },
    });
    return null;
  }
  return { sessionUser, ticket, prisma };
}

/**
 * Action visibility (§7): IT Staff/Admin see all tickets; a Requester sees
 * only tickets they requested. Foreign ticket → 403 without existence leak.
 */
function canSeeActions(role: string, requesterId: number, ticketRequesterId: number): boolean {
  if (role === 'IT_STAFF' || role === 'ADMIN') return true;
  return requesterId === ticketRequesterId;
}

const performerSelect = { id: true, name: true, role: true } as const;

const actionSelect = {
  id: true,
  ticketId: true,
  actionAt: true,
  description: true,
  result: true,
  performedBy: { select: performerSelect },
  followUpRequired: true,
  followUpNote: true,
  attachmentNotes: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const;

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// GET /api/tickets/:id/actions — newest-first + lightweight pagination (FR-27).
export const listActions = async (req: Request, res: Response) => {
  try {
    const loaded = await loadTicket(req, res);
    if (!loaded) return;
    const { sessionUser, ticket, prisma } = loaded;

    if (!canSeeActions(sessionUser.role, sessionUser.id, ticket.requesterId)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You do not have permission to view these actions.' },
      });
    }

    let page = 1;
    let limit = 20;
    try {
      const query = listQuerySchema.parse(req.query);
      page = query.page;
      limit = query.limit;
    } catch {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'page must be >= 1 and limit must be 1–50.' },
      });
    }

    const where = { ticketId: ticket.id };
    const [actions, total] = await prisma.$transaction([
      prisma.actionTaken.findMany({
        where,
        select: actionSelect,
        orderBy: [{ actionAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.actionTaken.count({ where }),
    ]);
    return res.status(200).json({
      actions,
      pagination: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};

// --- Idempotency-Key handling (BR-28, AD-15) --------------------------------
// Keys persist in the IdempotencyKey table (24h TTL), so the replay guarantee
// survives restarts and holds for the full window — an in-memory store can
// promise neither. The action insert and the key insert run in ONE
// transaction: simultaneous twins both insert the action, then exactly one
// wins the @@unique(ticketId, key) race. The loser blocks on the unique index
// until the winner commits, gets P2002, and replays the committed entry — so
// twins collapse onto a single row with no hang path and no lost update.

type StoredIdempotencyBody = Record<string, unknown>;

function fingerprintAction(input: ValidatedActionInput): string {
  return JSON.stringify([
    input.actionAt.toISOString(),
    input.description,
    input.result,
    input.followUpRequired,
    input.followUpNote,
    input.attachmentNotes,
  ]);
}

function isFresh(entry: { expiresAt: Date }): boolean {
  return entry.expiresAt.getTime() > Date.now();
}

function idempotencyReuse() {
  return {
    status: 422 as const,
    body: {
      error: { code: 'IDEMPOTENCY_KEY_REUSE', message: 'This Idempotency-Key was already used with a different payload.' },
    },
  };
}

// POST /api/tickets/:id/actions — record one action; performer is the caller
// (FR-25, BR-23). Staff/Admin only (requireRole in App.ts).
export const postAction = async (req: Request, res: Response) => {
  try {
    const loaded = await loadTicket(req, res);
    if (!loaded) return;
    const { sessionUser, ticket, prisma } = loaded;

    const validated = validateActionInput(req.body, false);
    if (!validated.ok) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: validated.message },
      });
    }
    const input = validated.input as ValidatedActionInput;

    // AD-15: optional opaque header (≤ 64 chars). Validation failures above
    // never consume a key — only a validated payload reaches this point.
    const rawKey = req.headers['idempotency-key'];
    let key: string | null = null;
    if (rawKey !== undefined) {
      const header = Array.isArray(rawKey) ? rawKey[0] : rawKey;
      if (typeof header !== 'string' || header.length === 0 || header.length > IDEMPOTENCY_KEY_MAX) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: `Idempotency-Key must be 1–${IDEMPOTENCY_KEY_MAX} characters.` },
        });
      }
      key = header;
    }

    const fingerprint = fingerprintAction(input);
    if (key) {
      const existing = await prisma.idempotencyKey.findUnique({
        where: { ticketId_key: { ticketId: ticket.id, key } },
      });
      if (existing) {
        if (!isFresh(existing)) {
          // Race-safe expiry cleanup: two twins can both read the same
          // expired row before either deletes it. deleteMany on the PK is
          // idempotent (0 rows if the twin already removed it) and can only
          // ever match this stale row — never a fresh row the twin just
          // created — so both requests proceed instead of one hitting P2025.
          await prisma.idempotencyKey.deleteMany({ where: { id: existing.id } });
        } else if (existing.fingerprint !== fingerprint) {
          const reuse = idempotencyReuse();
          return res.status(reuse.status).json(reuse.body);
        } else {
          return res.status(201).json(existing.response as StoredIdempotencyBody);
        }
      }
    }

    // BR-23/AD-14: performedBy comes from the session; any client-supplied
    // performer/version/id/ticketId fields in the body are ignored above.
    const actionData = {
      ticketId: ticket.id,
      actionAt: input.actionAt,
      description: input.description,
      result: input.result,
      performedById: sessionUser.id,
      followUpRequired: input.followUpRequired,
      followUpNote: input.followUpNote,
      attachmentNotes: input.attachmentNotes,
    };

    if (!key) {
      const created = await prisma.actionTaken.create({ data: actionData, select: actionSelect });
      return res.status(201).json(created);
    }

    try {
      // One interactive transaction: the action row and its key snapshot
      // commit atomically, so a twin can never observe a half-written entry.
      // The twin blocks on @@unique until this commits, then takes the P2002
      // path below and replays the complete entry.
      const created = await prisma.$transaction(async (tx) => {
        const row = await tx.actionTaken.create({ data: actionData, select: actionSelect });
        await tx.idempotencyKey.create({
          data: {
            ticketId: ticket.id,
            key,
            fingerprint,
            // Snapshot of the 201 payload: replays return the original body
            // verbatim even if the row is edited later (BR-28).
            response: JSON.parse(JSON.stringify(row)) as Prisma.InputJsonValue,
            expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
          },
        });
        return row;
      });
      return res.status(201).json(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Lost the key race: the winner committed first. Re-read its entry
        // and replay (or 422 on payload mismatch) — exactly one action row
        // exists across both requests.
        const winner = await prisma.idempotencyKey.findUnique({
          where: { ticketId_key: { ticketId: ticket.id, key } },
        });
        if (winner && isFresh(winner)) {
          if (winner.fingerprint !== fingerprint) {
            const reuse = idempotencyReuse();
            return res.status(reuse.status).json(reuse.body);
          }
          return res.status(201).json(winner.response as StoredIdempotencyBody);
        }
      }
      throw error;
    }
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};

/** If-Match carries the version the client last read (AD-14, BR-27). */
function parseIfMatch(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
  const version = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(version) || version <= 0) return null;
  return version;
}

// PATCH /api/actions/:id — partial update under optimistic concurrency
// (FR-26, BR-27). Staff/Admin only (requireRole in App.ts). actionAt,
// ticketId and performedById are immutable after creation (ignored).
export const patchAction = async (req: Request, res: Response) => {
  try {
    const sessionUser = (req as AuthRequest).user;
    if (!sessionUser) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid session' },
      });
    }

    const actionId = parseActionIdParam(req.params.id);
    if (actionId === null) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Action id must be a positive integer' },
      });
    }

    const ifMatch = parseIfMatch(req.headers['if-match']);
    if (ifMatch === null) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'If-Match header with the current version is required.' },
      });
    }

    const prisma = getPrisma();
    const existing = await prisma.actionTaken.findUnique({ where: { id: actionId } });
    if (!existing) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Action not found' },
      });
    }

    const validated = validateActionInput(req.body, true, {
      followUpRequired: existing.followUpRequired,
      followUpNote: existing.followUpNote,
    });
    if (!validated.ok) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: validated.message },
      });
    }
    const input = validated.input;

    // Atomic compare-and-swap: the version predicate and the increment run
    // in a single conditional update, so two concurrent writers cannot both
    // succeed (BR-27 — exactly one 200, the other 409, no lost update).
    const data: Record<string, unknown> = { version: { increment: 1 } };
    // actionAt is immutable after creation — supplied values were ignored
    // during validation above.
    if (input.description !== undefined) data.description = input.description;
    if (input.result !== undefined) data.result = input.result;
    if (input.followUpRequired !== undefined) data.followUpRequired = input.followUpRequired;
    if (input.followUpNote !== undefined || input.followUpRequired === false) {
      // followUpRequired true→false clears the note (AD-18); an explicit
      // note (or explicit null via flag-off) overwrites it.
      data.followUpNote = input.followUpNote ?? null;
    }
    if (input.attachmentNotes !== undefined) data.attachmentNotes = input.attachmentNotes;

    const touched = await prisma.actionTaken.updateMany({
      where: { id: actionId, version: ifMatch },
      data,
    });
    if (touched.count === 0) {
      const current = await prisma.actionTaken.findUnique({ where: { id: actionId } });
      if (!current) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Action not found' },
        });
      }
      // Stale write: the stored row is untouched; the client must re-fetch
      // and retry (the 409 refresh-and-retry flow of api-spec §1).
      return res.status(409).json({
        error: {
          code: 'STALE_VERSION',
          message: 'This action was updated by someone else. Refresh to load the latest version, then retry.',
          currentVersion: current.version,
        },
      });
    }

    const updated = await prisma.actionTaken.findUnique({
      where: { id: actionId },
      select: actionSelect,
    });
    return res.status(200).json(updated);
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};
