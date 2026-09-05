import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { getPrisma } from '../src/prisma.js';

const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  systemId: z.coerce.number().int().positive().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  sort: z.enum(['createdAt', 'priority']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

function requesterIdFromHeader(req: Request): number | null {
  const raw = req.headers['x-requester-id'];
  if (!raw) return null;
  const id = parseInt(raw as string, 10);
  return Number.isNaN(id) ? null : id;
}

export const listTickets = async (req: Request, res: Response) => {
  try {
    const requesterId = requesterIdFromHeader(req);
    if (requesterId === null) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid x-requester-id header' },
      });
    }

    const prisma = getPrisma();

    const requester = await prisma.requester.findUnique({ where: { id: requesterId } });
    if (!requester || !requester.isActive) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Requester is inactive or does not exist' },
      });
    }

    const query = listQuerySchema.parse(req.query);

    const where: Prisma.TicketWhereInput = {
      requesterId,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.systemId ? { systemId: query.systemId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
    };
    const orderBy =
      query.sort === 'priority'
        ? { priority: query.order }
        : { createdAt: query.order };

    const skip = (query.page - 1) * query.limit;

    const [tickets, total] = await prisma.$transaction([
      prisma.ticket.findMany({
        where,
        orderBy,
        skip,
        take: query.limit,
        select: {
          id: true,
          ticketNo: true,
          title: true,
          description: true,
          priority: true,
          status: true,
          createdAt: true,
          category: { select: { id: true, name: true } },
          system: { select: { id: true, name: true } },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    return res.json({
      tickets,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues?.[0]?.message || 'Validation error';
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message },
      });
    }
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};