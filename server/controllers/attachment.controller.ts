import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { z } from 'zod';
import { getPrisma } from '../src/prisma.js';
import type { AuthRequest } from '../src/auth.middleware.js';

// BR-20: files are always stored under a fixed, non-user-controlled uploads
// directory using server-generated UUID storage names. The client-supplied
// filename is stored only as display metadata and never used to build a path.
export const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

// BR-07: 5 MB per file, validated both by multer (413) and at the API layer.
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ACTIVE_ATTACHMENTS = 5;

// BR-08: soft-removal requires a mandatory reason (3-200 chars after trim).
const REMOVAL_REASON_MIN = 3;
const REMOVAL_REASON_MAX = 200;

if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

async function resolveActiveRequester(req: Request, res: Response): Promise<number | null> {
  const raw = req.headers['x-requester-id'];
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid x-requester-id header' },
    });
    return null;
  }

  const requesterId = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(requesterId) || requesterId <= 0) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid x-requester-id header' },
    });
    return null;
  }

  // Transitional BR-04 guard: header identity must match the session user.
  const sessionUser = (req as AuthRequest).user;
  if (sessionUser && sessionUser.id !== requesterId) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Requester does not match the signed-in user' },
    });
    return null;
  }

  const prisma = getPrisma();
  const requester = await prisma.user.findUnique({ where: { id: requesterId } });
  if (!requester || requester.role !== 'REQUESTER' || !requester.isActive) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Requester is inactive or does not exist' },
    });
    return null;
  }

  return requesterId;
}

function parseIdParam(raw: string | undefined, res: Response): number | null {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Attachment id must be a positive integer' },
    });
    return null;
  }

  const id = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Attachment id must be a positive integer' },
    });
    return null;
  }

  return id;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = EXTENSION_BY_MIME[file.mimetype] ?? '';
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      // multer passes this Error to the error handler; we map it to 415 below.
      const err = new Error('Unsupported media type') as Error & { code: string };
      err.code = 'LIMIT_UNEXPECTED_TYPE';
      return cb(err);
    }
    cb(null, true);
  },
});

function cleanupUploadedFile(req: Request): void {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (file?.path && existsSync(file.path)) {
    try {
      unlinkSync(file.path);
    } catch {
      // Best-effort cleanup — never let a failed delete mask the real error.
    }
  }
}

// POST /api/attachments/upload — multer wrapper that maps transport errors to
// the contract status codes (413 oversized, 415 unsupported type) before the
// controller runs.
export const attachmentUpload = (req: Request, res: Response) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (!err) return uploadTicketAttachment(req, res);

    const code = (err as Error & { code?: string }).code;
    if (code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'File exceeds the 5 MB limit' },
      });
    }
    if (code === 'LIMIT_UNEXPECTED_TYPE') {
      return res.status(415).json({
        error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Unsupported file type' },
      });
    }
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid file upload' },
    });
  });
};

const uploadTicketAttachment = async (req: Request, res: Response) => {
  try {
    const requesterId = await resolveActiveRequester(req, res);
    if (requesterId === null) return;

    const prisma = getPrisma();

    const rawTicketId = req.body?.ticketId;
    const ticketId = typeof rawTicketId === 'string' ? Number(rawTicketId) : rawTicketId;
    if (!Number.isSafeInteger(ticketId) || ticketId <= 0) {
      cleanupUploadedFile(req);
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'ticketId must be a positive integer' },
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'A file is required' },
      });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, requesterId: true },
    });
    if (!ticket) {
      cleanupUploadedFile(req);
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Ticket not found' },
      });
    }
    if (ticket.requesterId !== requesterId) {
      cleanupUploadedFile(req);
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Requester does not own this ticket' },
      });
    }

    // BR-07: at most 5 active (non-removed) attachments per ticket.
    const activeCount = await prisma.attachment.count({
      where: { ticketId, isRemoved: false },
    });
    if (activeCount >= MAX_ACTIVE_ATTACHMENTS) {
      cleanupUploadedFile(req);
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Ticket already has 5 active attachments' },
      });
    }

    const attachment = await prisma.attachment.create({
      data: {
        ticketId,
        filename: req.file.originalname,
        filePath: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });

    return res.status(201).json({
      id: attachment.id,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size,
      ticketId: attachment.ticketId,
    });
  } catch {
    cleanupUploadedFile(req);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};

// GET /api/attachments/:id — metadata only, independent of ticket detail.
export const getAttachmentMeta = async (req: Request, res: Response) => {
  try {
    const requesterId = await resolveActiveRequester(req, res);
    if (requesterId === null) return;

    const attachmentId = parseIdParam(req.params.id, res);
    if (attachmentId === null) return;

    const prisma = getPrisma();
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { ticket: { select: { requesterId: true } } },
    });
    if (!attachment) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Attachment not found' },
      });
    }
    if (attachment.ticket.requesterId !== requesterId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Requester does not own this attachment' },
      });
    }

    return res.status(200).json({
      id: attachment.id,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size,
      ticketId: attachment.ticketId,
      isRemoved: attachment.isRemoved,
      removalReason: attachment.removalReason,
      createdAt: attachment.createdAt,
      updatedAt: attachment.updatedAt,
    });
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};

// GET /api/attachments/:id/download — streams the binary file (BR-05, BR-08).
export const downloadAttachment = async (req: Request, res: Response) => {
  try {
    const requesterId = await resolveActiveRequester(req, res);
    if (requesterId === null) return;

    const attachmentId = parseIdParam(req.params.id, res);
    if (attachmentId === null) return;

    const prisma = getPrisma();
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { ticket: { select: { requesterId: true } } },
    });
    if (!attachment) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Attachment not found' },
      });
    }
    if (attachment.ticket.requesterId !== requesterId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Requester does not own this attachment' },
      });
    }

    // BR-08: removed attachments keep their metadata but are never downloadable.
    if (attachment.isRemoved) {
      return res.status(410).json({
        error: {
          code: 'GONE',
          message: 'Attachment has been removed and cannot be downloaded',
        },
      });
    }

    const fullPath = path.join(UPLOADS_DIR, attachment.filePath);
    if (!existsSync(fullPath)) {
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Attachment file is unavailable' },
      });
    }

    res.type(attachment.mimeType);
    return res.download(fullPath, attachment.filename);
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};

// PATCH /api/attachments/:id/remove — soft-removal with a mandatory reason.
const removalReasonSchema = z
  .string()
  .trim()
  .min(REMOVAL_REASON_MIN)
  .max(REMOVAL_REASON_MAX);

export const removeAttachment = async (req: Request, res: Response) => {
  try {
    const requesterId = await resolveActiveRequester(req, res);
    if (requesterId === null) return;

    const attachmentId = parseIdParam(req.params.id, res);
    if (attachmentId === null) return;

    const parsed = removalReasonSchema.safeParse(req.body?.removalReason);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `removalReason is required and must be ${REMOVAL_REASON_MIN}-${REMOVAL_REASON_MAX} characters`,
        },
      });
    }

    const prisma = getPrisma();
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { ticket: { select: { requesterId: true } } },
    });
    if (!attachment) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Attachment not found' },
      });
    }
    if (attachment.ticket.requesterId !== requesterId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Requester does not own this attachment' },
      });
    }

    const updated = await prisma.attachment.update({
      where: { id: attachmentId },
      data: { isRemoved: true, removedAt: new Date(), removalReason: parsed.data },
      select: { id: true, filename: true, isRemoved: true, removalReason: true, updatedAt: true },
    });

    return res.status(200).json(updated);
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};