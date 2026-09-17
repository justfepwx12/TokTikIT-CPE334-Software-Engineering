import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { getPrisma } from '../src/prisma.js';

// GET /api/staff/tickets — operational queue for IT Staff/Admin (api-spec §2,
// BR-13/BR-17). All tickets regardless of requester. Role guard runs in App.ts
// via requireRole('IT_STAFF', 'ADMIN'); Requester → 403 there.
const queueQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z
    .enum(['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED'])
    .optional(),
  // Matches the IT Priority (not the Requested Priority).
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  systemId: z.coerce.number().int().positive().optional(),
  // Filter by owner; sentinel 0 = unassigned (ownerId null).
  ownerId: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['updatedAt', 'status', 'priority']).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const listStaffTickets = async (req: Request, res: Response) => {
  try {
    const query = queueQuerySchema.parse(req.query);

    const orderBy: Prisma.TicketOrderByWithRelationInput =
      query.sort === 'priority'
        ? { itPriority: query.order }
        : query.sort === 'status'
          ? { status: query.order }
          : { updatedAt: query.order };

    const where: Prisma.TicketWhereInput = {
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { itPriority: query.priority } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.systemId ? { systemId: query.systemId } : {}),
      ...(query.ownerId !== undefined
        ? query.ownerId === 0
          ? { ownerId: null }
          : { ownerId: query.ownerId }
        : {}),
    };

    const prisma = getPrisma();
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
          requestedPriority: true,
          itPriority: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          category: { select: { id: true, name: true } },
          system: { select: { id: true, name: true } },
          requester: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true } },
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
