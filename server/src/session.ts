import dotenv from "dotenv";
dotenv.config();

import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";

const PgSessionStore = connectPgSimple(session);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const LIFETIME_MINUTES = 30;
const LIFETIME_MS = LIFETIME_MINUTES * 60 * 1000;

// Single source of truth for the session cookie name — auth.controller's
// logout must clear this exact name, so it imports this constant instead of
// hard-coding the string twice.
export const SESSION_COOKIE_NAME = "toktikit.sid";

const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET;
if (isProduction && !sessionSecret) {
  throw new Error(
    "SESSION_SECRET must be set in production. Refusing to start without a secure secret.",
  );
}

export const sessionMiddleware = session({
  store: new PgSessionStore({
    pool,
    tableName: "session",
    createTableIfMissing: true,
  }),
  name: SESSION_COOKIE_NAME,
  secret: sessionSecret ?? "insecure-dev-secret",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: LIFETIME_MS,
  },
});

export function closeSessionPool(): Promise<void> {
  return pool.end();
}
