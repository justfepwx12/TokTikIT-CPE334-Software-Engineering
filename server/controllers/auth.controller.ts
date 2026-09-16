import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { getPrisma } from "../src/prisma.js";
import type { AuthRequest } from "../src/auth.middleware.js";
import { SESSION_COOKIE_NAME } from "../src/session.js";

const INVALID_CREDENTIALS = "Invalid email or password.";
const INVALID_CREDENTIALS_CODE = "INVALID_CREDENTIALS";
const BCRYPT_ROUNDS = 12;

// Dummy bcrypt hash (cost 10, hash of "password") used only to equalize timing:
// when the email is unknown we still run bcrypt.compare so unknown-email vs
// wrong-password take the same time (prevents enumeration via timing).
const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

const NEW_PASSWORD_MIN = 8;
const NEW_PASSWORD_MAX = 128;

export const loginController = async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "email and password are required." },
    });
    return;
  }

  const normalized = email.trim().toLowerCase();
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  // BR-02: wrong password, unknown email, and inactive account all return the
  // same safe generic response to prevent account enumeration. Always run
  // bcrypt.compare (dummy hash when user is missing) to avoid timing leaks.
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.isActive || !passwordOk) {
    res.status(401).json({
      error: { code: INVALID_CREDENTIALS_CODE, message: INVALID_CREDENTIALS },
    });
    return;
  }

  // express-session replaces req.session on regenerate — always write userId
  // to req.session inside the callback, never to a stale captured reference.
  req.session.regenerate((err) => {
    if (err) {
      res.status(500).json({
        error: { code: "INTERNAL_AUTH", message: "Could not start a session." },
      });
      return;
    }
    req.session.userId = user.id;
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
      },
    });
  });
};

export const logoutController = (req: Request, res: Response) => {
  const session = req.session;
  session.destroy((err) => {
    if (err) {
      res.status(500).json({
        error: { code: "INTERNAL_AUTH", message: "Could not end the session." },
      });
      return;
    }
    res.clearCookie(SESSION_COOKIE_NAME);
    res.status(200).json({ message: "Logged out." });
  });
};

export const meController = (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  if (!user) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Not signed in." },
    });
    return;
  }
  res.json({ user });
};

export const changePasswordController = async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const { currentPassword, newPassword } = req.body ?? {};

  if (!user) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Not signed in." },
    });
    return;
  }

  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "currentPassword and newPassword are required.",
      },
    });
    return;
  }

  const trimmedNew = newPassword.trim();
  if (trimmedNew.length < NEW_PASSWORD_MIN || trimmedNew.length > NEW_PASSWORD_MAX) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: `New password must be between ${NEW_PASSWORD_MIN} and ${NEW_PASSWORD_MAX} characters.`,
      },
    });
    return;
  }

  if (newPassword === currentPassword) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "New password must be different from the current password.",
      },
    });
    return;
  }

  const prisma = getPrisma();
  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record) {
    res.status(500).json({
      error: { code: "INTERNAL_AUTH", message: "User record is missing." },
    });
    return;
  }

  const ok = await bcrypt.compare(currentPassword, record.passwordHash);
  if (!ok) {
    res.status(401).json({
      error: { code: "WRONG_PASSWORD", message: "Current password is incorrect." },
    });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash, mustChangePassword: false },
  });

  res.status(200).json({ message: "Password changed." });
};
