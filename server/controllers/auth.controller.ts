import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { getPrisma } from "../src/prisma.js";
import type { AuthRequest } from "../src/auth.middleware.js";

const GENERIC_401 = "Incorrect email or password.";
const BR01_CODE = "AUTH_FAILED";
const BCRYPT_ROUNDS = 12;

export const loginController = async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    res.status(401).json({ error: { code: BR01_CODE, message: GENERIC_401 } });
    return;
  }

  const normalized = email.trim().toLowerCase();
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  const passwordOk = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !passwordOk) {
    res.status(401).json({ error: { code: BR01_CODE, message: GENERIC_401 } });
    return;
  }

  if (!user.isActive) {
    res.status(401).json({ error: { code: "ACCOUNT_INACTIVE", message: "Your account is inactive. Contact an administrator." } });
    return;
  }

  const session = (req as AuthRequest).session;
  session.regenerate((err) => {
    if (err) {
      res.status(500).json({ error: { code: "INTERNAL_AUTH", message: "Could not start a session." } });
      return;
    }
    (session as { userId?: number }).userId = user.id;
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
  });
};

export const logoutController = (req: Request, res: Response) => {
  const session = req.session;
  session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: { code: "INTERNAL_AUTH", message: "Could not end the session." } });
      return;
    }
    res.clearCookie("toktikit.sid");
    res.status(204).send();
  });
};

export const meController = (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  if (!user) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not signed in." } });
    return;
  }
  res.json({ user });
};

export const changePasswordController = async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const { oldPassword, newPassword } = req.body ?? {};
  if (!user) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not signed in." } });
    return;
  }

  if (typeof oldPassword !== "string" || typeof newPassword !== "string") {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "oldPassword and newPassword are required." },
    });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "New password must be at least 8 characters." },
    });
    return;
  }

  const prisma = getPrisma();
  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record) {
    res.status(500).json({ error: { code: "INTERNAL_AUTH", message: "User record is missing." } });
    return;
  }

  const ok = await bcrypt.compare(oldPassword, record.passwordHash);
  if (!ok) {
    res.status(400).json({ error: { code: "WRONG_PASSWORD", message: "Current password is incorrect." } });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash, mustChangePassword: false },
  });

  const session = req.session;
  session.destroy(() => {});
  res.clearCookie("toktikit.sid");
  res.status(204).send();
};
