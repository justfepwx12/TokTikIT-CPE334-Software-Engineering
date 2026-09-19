import { Request, Response } from 'express';
import { getPrisma } from '../src/prisma.js';
import type { AuthRequest } from '../src/auth.middleware.js';

export const getTicketById = async (req: Request, res: Response) => {
  try {
    // BR-03/BR-04: identity comes solely from the session. Any
    // client-supplied requesterId (header or query) is ignored.
    const sessionUser = (req as AuthRequest).user;
    if (!sessionUser) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid session' },
      });
    }
    const requesterId = sessionUser.id;

    const raw = req.params.id;
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Ticket id must be a positive integer' },
      });
    }
    const ticketId = Number.parseInt(raw, 10);
    if (!Number.isSafeInteger(ticketId) || ticketId <= 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Ticket id must be a positive integer' },
      });
    }

    const prisma = getPrisma();

    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { id: true, role: true, isActive: true },
    });
    if (!requester || requester.role !== 'REQUESTER' || !requester.isActive) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Requester is inactive or does not exist' },
      });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        ticketNo: true,
        title: true,
        description: true,
        requestedPriority: true,
        itPriority: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { id: true, name: true } },
        system: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true } },
        // BR-08: soft-removed attachments keep their metadata visible in the
        // detail response so the UI can render them (and disable download).
        attachments: {
          select: {
            id: true,
            filename: true,
            mimeType: true,
            size: true,
            isRemoved: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Ticket not found' },
      });
    }
    if (ticket.requester.id !== requesterId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Requester does not own this ticket' },
      });
    }

    return res.status(200).json(ticket);
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};