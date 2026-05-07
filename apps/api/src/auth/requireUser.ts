import type { Context } from 'hono';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db/client';
import { sessions, users } from '../db/schema';
import { unauthorized } from '../lib/http';
import { hashToken } from './tokens';

const SESSION_COOKIE_NAME = 'ilya_session';

export async function requireUser(c: Context) {
  const rawCookie = c.req.header('cookie') ?? '';
  const token = readCookie(rawCookie, SESSION_COOKIE_NAME);

  if (!token) {
    unauthorized('You must be signed in.');
  }

  const tokenHash = await hashToken(token);

  const [row] = await db
    .select({
      user: users,
      session: sessions,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row) {
    unauthorized('You must be signed in.');
  }

  return row.user;
}

function readCookie(cookieHeader: string, name: string): string | null {
  const parts = cookieHeader.split(';').map((part) => part.trim());
  for (const part of parts) {
    const eqIndex = part.indexOf('=');
    if (eqIndex === -1) continue;
    const key = part.slice(0, eqIndex);
    const value = part.slice(eqIndex + 1);
    if (key === name) return decodeURIComponent(value);
  }
  return null;
}
