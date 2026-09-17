import type { Request, Response, NextFunction } from "express";
import { getPrisma } from "./prisma.js";
import type { Role } from "@prisma/client";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

export interface AuthUserShape {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthUserShape;
}

const BR01_MESSAGE = "You are not signed in or your session expired.";

function toShape(user: {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
}): AuthUserShape {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
  };
}

export async function hydrateUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const userId = req.session?.userId;
  if (userId === undefined) {
    req.user = undefined;
    next();
    return;
  }

  try {
    const user = await getPrisma().user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      req.session.destroy(() => {});
      req.user = undefined;
    } else {
      req.user = toShape(user);
    }
  } catch {
    req.session.destroy(() => {});
    req.user = undefined;
  }
  next();
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: BR01_MESSAGE } });
    return;
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: BR01_MESSAGE } });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: { code: "FORBIDDEN", message: "You do not have permission to perform this action." },
      });
      return;
    }
    next();
  };
}

export function gateMustChangePassword(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.mustChangePassword) {
    res.status(403).json({
      error: {
        code: "PASSWORD_CHANGE_REQUIRED",
        message: "You must change your password before continuing.",
      },
    });
    return;
  }
  next();
}
