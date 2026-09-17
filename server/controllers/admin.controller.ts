import { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { getPrisma } from '../src/prisma.js';
import type { AuthRequest } from '../src/auth.middleware.js';

// Administrator User Management (api-spec §5, BR-07–BR-12).
// All routes sit behind requireRole('ADMIN') in App.ts. No user is ever
// deleted (BR-12): deactivation (isActive = false) is the only end state.

const BCRYPT_ROUNDS = 12;
const NAME_MIN = 2;
const NAME_MAX = 100;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

const ROLES = ['REQUESTER', 'IT_STAFF', 'ADMIN'] as const;

const emailField = z.string().trim().email();
const nameField = z.string().trim().min(NAME_MIN).max(NAME_MAX);
const passwordField = z.string().trim().min(PASSWORD_MIN).max(PASSWORD_MAX);
const roleField = z.enum(ROLES);

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
} as const;

// GET /api/admin/users?search=&role= — single search box + one Role filter
// (AD-10, spec v1.1). No pagination/sort (excluded scope §3).
export const listUsers = async (req: Request, res: Response) => {
  try {
    const parsed = z
      .object({
        search: z.string().trim().max(100).optional(),
        role: roleField.optional(),
      })
      .safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid search or role filter.' },
      });
    }
    const { search, role } = parsed.data;
    const prisma = getPrisma();
    const users = await prisma.user.findMany({
      where: {
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(role ? { role } : {}),
      },
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ users });
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};

// POST /api/admin/users — create with exactly one role + initial password.
// The server always sets mustChangePassword = true (BR-03, AD-09); the field
// is never accepted from the client. Duplicate email → 409 (BR-09).
export const createUser = async (req: Request, res: Response) => {
  try {
    if (req.body !== null && typeof req.body === 'object' && 'mustChangePassword' in req.body) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'mustChangePassword is managed by the server.' },
      });
    }
    const parsed = z
      .object({
        name: nameField,
        email: emailField,
        role: roleField,
        password: passwordField,
        isActive: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid name, email, role, password or status.' },
      });
    }
    const prisma = getPrisma();
    const email = parsed.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({
        error: { code: 'DUPLICATE_EMAIL', message: 'A user with this email already exists.' },
      });
    }
    const created = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        role: parsed.data.role,
        passwordHash: await bcrypt.hash(parsed.data.password, BCRYPT_ROUNDS),
        isActive: parsed.data.isActive ?? true,
        mustChangePassword: true,
      },
      select: userSelect,
    });
    return res.status(201).json({ user: created });
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};

function parseUserId(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
  const id = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return id;
}

// PATCH /api/admin/users/:id — edit basic info / single role / activate.
// Guards: no self-deactivation (BR-10), never zero active Admins (BR-11),
// duplicate email → 409 (BR-09).
export const updateUser = async (req: Request, res: Response) => {
  try {
    const sessionUser = (req as AuthRequest).user;
    if (!sessionUser) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid session' },
      });
    }
    const userId = parseUserId(req.params.id);
    if (userId === null) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'User id must be a positive integer' },
      });
    }
    const parsed = z
      .object({
        name: nameField.optional(),
        email: emailField.optional(),
        role: roleField.optional(),
        isActive: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid name, email, role or status.' },
      });
    }
    const prisma = getPrisma();
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    const nextEmail = parsed.data.email !== undefined ? parsed.data.email.toLowerCase() : target.email;
    const nextRole = parsed.data.role ?? target.role;
    const nextActive = parsed.data.isActive ?? target.isActive;

    if (nextEmail !== target.email) {
      const clash = await prisma.user.findUnique({ where: { email: nextEmail } });
      if (clash) {
        return res.status(409).json({
          error: { code: 'DUPLICATE_EMAIL', message: 'A user with this email already exists.' },
        });
      }
    }

    // BR-10: an Administrator may not deactivate their own active account.
    if (userId === sessionUser.id && target.isActive && nextActive === false) {
      return res.status(400).json({
        error: { code: 'SELF_DEACTIVATION', message: 'You cannot deactivate your own account.' },
      });
    }

    // BR-11: never leave zero active Administrators (via deactivation or
    // role downgrade of the last one).
    const wasActiveAdmin = target.role === 'ADMIN' && target.isActive;
    const staysActiveAdmin = nextRole === 'ADMIN' && nextActive;
    if (wasActiveAdmin && !staysActiveAdmin) {
      const otherActiveAdmins = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true, id: { not: target.id } },
      });
      if (otherActiveAdmins === 0) {
        return res.status(400).json({
          error: { code: 'LAST_ADMIN', message: 'The last active Administrator cannot be removed.' },
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.email !== undefined ? { email: nextEmail } : {}),
        ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
      select: userSelect,
    });
    return res.status(200).json({ user: updated });
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};

// POST /api/admin/users/:id/reset-password { newPassword } — admin-chosen
// temporary password; marks mustChangePassword = true (BR-03, AD-09).
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const sessionUser = (req as AuthRequest).user;
    if (!sessionUser) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid session' },
      });
    }
    const userId = parseUserId(req.params.id);
    if (userId === null) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'User id must be a positive integer' },
      });
    }
    const parsed = z.object({ newPassword: passwordField }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'New password must be 8–128 characters.' },
      });
    }
    const prisma = getPrisma();
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS),
        mustChangePassword: true,
      },
    });
    return res.status(200).json({ message: 'Password reset. User must change it on next login.' });
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};
