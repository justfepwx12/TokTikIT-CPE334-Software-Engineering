import { Request, Response } from 'express';
import { getPrisma } from '../src/prisma.js';

function requesterIdFromHeader(req: Request): number | null {
  const raw = req.headers['x-requester-id'];
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
  const id = Number.parseInt(raw, 10);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export const getTicketById = async (req: Request, res: Response) => {
  try {
    const requesterId = requesterIdFromHeader(req);
    if (requesterId === null) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid x-requester-id header' },
      });
    }

    const ticketId = Number.parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(ticketId) || ticketId <= 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Ticket id must be a positive integer' },
      });
    }

    const prisma = getPrisma();

    const requester = await prisma.requester.findUnique({ where: { id: requesterId } });
    if (!requester || !requester.isActive) {
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
        priority: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { id: true, name: true } },
        system: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true } },
        attachments: {
          where: { isRemoved: false },
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