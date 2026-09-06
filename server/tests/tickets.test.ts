import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/App.js';
import { getPrisma } from '../src/prisma.js';

const prisma = getPrisma();

describe('Create Ticket API Tests (tickets.test.ts)', () => {
  let activeRequesterId: number;
  let categoryId: number;
  let systemId: number;

  beforeAll(async () => {
    const activeRequester = await prisma.requester.findFirst({
      where: { isActive: true },
    });
    const category = await prisma.category.findFirst();
    const system = await prisma.relatedSystem.findFirst();

    if (!activeRequester || !category || !system) {
      throw new Error('Seed data incomplete. Please run seed script first.');
    }

    activeRequesterId = activeRequester.id;
    categoryId = category.id;
    systemId = system.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/tickets', () => {
    it('should create a ticket and return 201 with generated ticketNo', async () => {
      const payload = {
        categoryId,
        systemId,
        priority: 'MEDIUM',
        title: 'VPN Connection Fails on macOS',
        description: 'Unable to establish VPN connection after latest OS update.',
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('x-requester-id', String(activeRequesterId))
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('ticketNo');
      expect(response.body.title).toBe(payload.title);
      expect(response.body.status).toBe('PENDING');
      expect(response.body.requesterId).toBe(activeRequesterId);
    });

    it('should return 401 Unauthorized when x-requester-id header is missing', async () => {
      const payload = {
        categoryId,
        systemId,
        priority: 'HIGH',
        title: 'Missing Header Test',
        description: 'Testing request without x-requester-id header.',
      };

      await request(app).post('/api/tickets').send(payload).expect(401);
    });

    it('should return 401 Unauthorized when x-requester-id is not a valid integer', async () => {
      const payload = {
        categoryId,
        systemId,
        priority: 'HIGH',
        title: 'Non-numeric Header Test',
        description: 'Testing request with a non-numeric x-requester-id header.',
      };

      await request(app)
        .post('/api/tickets')
        .set('x-requester-id', 'not-a-number')
        .send(payload)
        .expect(401);
    });

    it('should return 400 Bad Request when required fields are invalid/missing', async () => {
      const invalidPayload = {
        categoryId,
        systemId,
        priority: 'HIGH',
        title: 'Short',
        description: 'Short',
      };

      await request(app)
        .post('/api/tickets')
        .set('x-requester-id', String(activeRequesterId))
        .send(invalidPayload)
        .expect(400);
    });

    it('should return 400 Bad Request when categoryId does not reference an existing Category', async () => {
      const payload = {
        categoryId: 999999,
        systemId,
        priority: 'MEDIUM',
        title: 'Nonexistent Category Test',
        description: 'Testing request with a categoryId that does not exist.',
      };

      await request(app)
        .post('/api/tickets')
        .set('x-requester-id', String(activeRequesterId))
        .send(payload)
        .expect(400);
    });

    it('should return 400 Bad Request when systemId does not reference an existing Related System', async () => {
      const payload = {
        categoryId,
        systemId: 999999,
        priority: 'MEDIUM',
        title: 'Nonexistent System Test',
        description: 'Testing request with a systemId that does not exist.',
      };

      await request(app)
        .post('/api/tickets')
        .set('x-requester-id', String(activeRequesterId))
        .send(payload)
        .expect(400);
    });

    it('should return 403 Forbidden when the Requester is inactive', async () => {
      const inactiveRequester = await prisma.requester.findFirst({
        where: { isActive: false },
      });
      if (!inactiveRequester) {
        throw new Error('Seed data missing an inactive requester.');
      }

      const payload = {
        categoryId,
        systemId,
        priority: 'MEDIUM',
        title: 'Inactive Requester Test',
        description: 'Testing request from an inactive requester.',
      };

      await request(app)
        .post('/api/tickets')
        .set('x-requester-id', String(inactiveRequester.id))
        .send(payload)
        .expect(403);
    });
  });


});