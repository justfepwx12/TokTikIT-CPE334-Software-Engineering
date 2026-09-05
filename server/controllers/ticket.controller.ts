import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma, Ticket } from '@prisma/client';
import { getPrisma } from '../src/prisma.js';
import { generateTicketNo } from '../services/ticketNumber.service.js';

const createTicketSchema = z.object({
  title: z.string().trim().min(5).max(100),
  description: z.string().trim().min(10).max(1000),
  categoryId: z.number().int().positive(),
  systemId: z.number().int().positive(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
});

const MAX_TICKET_NO_RETRIES = 5;

export const createTicket = async (req: Request, res: Response) => {
  try {
    const requesterIdHeader = req.headers['x-requester-id'];
    if (!requesterIdHeader) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Missing x-requester-id header' },
      });
    }

    const requesterId = parseInt(requesterIdHeader as string, 10);
    if (Number.isNaN(requesterId)) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'x-requester-id must be a valid integer' },
      });
    }

    const prisma = getPrisma();

    const requester = await prisma.requester.findUnique({ where: { id: requesterId } });
    if (!requester || !requester.isActive) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Requester is inactive or does not exist' },
      });
    }

    const validatedData = createTicketSchema.parse(req.body);

    // api-spec.md: categoryId/systemId "must reference an existing" row.
    // A bad ID must surface as 400, not fall through to a Prisma FK error (500).
    const [category, system] = await Promise.all([
      prisma.category.findUnique({ where: { id: validatedData.categoryId } }),
      prisma.relatedSystem.findUnique({ where: { id: validatedData.systemId } }),
    ]);
    if (!category) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'categoryId does not reference an existing Category' },
      });
    }
    if (!system) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'systemId does not reference an existing Related System' },
      });
    }

    // BR-01: ticketNo generation and the ticket insert run in ONE transaction,
    // with retry-on-collision if two concurrent requests race for the same
    // next sequence number (unique constraint violation -> P2002 -> retry).
    let ticket: Ticket | null = null;
    for (let attempt = 0; attempt < MAX_TICKET_NO_RETRIES; attempt++) {
      try {
        ticket = await prisma.$transaction(async (tx) => {
          const ticketNo = await generateTicketNo(tx);
          return tx.ticket.create({
            data: {
              ticketNo,
              title: validatedData.title,
              description: validatedData.description,
              categoryId: validatedData.categoryId,
              systemId: validatedData.systemId,
              priority: validatedData.priority,
              requesterId,
              status: 'PENDING',
            },
          });
        });
        break;
      } catch (err) {
        const isCollision =
          err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
        if (isCollision && attempt < MAX_TICKET_NO_RETRIES - 1) {
          continue;
        }
        throw err;
      }
    }

    return res.status(201).json(ticket);
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