import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";

const PgSessionStore = connectPgSimple(session);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const LIFETIME_MINUTES = 30;
const LIFETIME_MS = LIFETIME_MINUTES * 60 * 1000;

export const sessionMiddleware = session({
  store: new PgSessionStore({
    pool,
    tableName: "session",
    createTableIfMissing: true,
  }),
  name: "toktikit.sid",
  secret: process.env.SESSION_SECRET ?? "insecure-dev-secret",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: LIFETIME_MS,
  },
});

export function closeSessionPool(): Promise<void> {
  return pool.end();
}
