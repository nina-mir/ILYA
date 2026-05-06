import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { emailLoginCodes, sessions, users } from '../db/schema';
import { env } from '../env';
import {
  constantTimeEqual,
  generateSessionToken,
  generateSixDigitCode,
  hashSecret,
} from './crypto';
import { sendLoginCodeEmail } from '../email/sendLoginCode';

export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  roles: string[];
  joinedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toPublicUser(row: typeof users.$inferSelect): PublicUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    roles: row.roles,
    joinedAt: row.joinedAt ? row.joinedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isReasonableEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function sendLoginCode(emailInput: string): Promise<{ ok: true }> {
  const email = normalizeEmail(emailInput);
  if (!isReasonableEmail(email)) {
    throw new Error('Enter a valid email address.');
  }

  const cooldownMs = env.AUTH_RESEND_COOLDOWN_SECONDS * 1000;
  const cooldownCutoff = new Date(Date.now() - cooldownMs);

  const [recent] = await db
    .select()
    .from(emailLoginCodes)
    .where(
      and(
        eq(emailLoginCodes.email, email),
        gt(emailLoginCodes.createdAt, cooldownCutoff),
        isNull(emailLoginCodes.consumedAt),
      ),
    )
    .orderBy(desc(emailLoginCodes.createdAt))
    .limit(1);

  if (recent) {
    throw new Error('A code was sent recently. Wait a moment before requesting another.');
  }

  const code = generateSixDigitCode();
  const codeHash = hashSecret(`${email}:${code}`);
  const expiresAt = new Date(Date.now() + env.AUTH_CODE_TTL_MINUTES * 60 * 1000);

  await db.insert(emailLoginCodes).values({
    email,
    codeHash,
    expiresAt,
  });

  await sendLoginCodeEmail({ email, code });

  return { ok: true };
}

export async function verifyLoginCode(input: {
  email: string;
  code: string;
}): Promise<{
  user: PublicUser;
  sessionToken: string;
  sessionExpiresAt: Date;
}> {
  const email = normalizeEmail(input.email);
  const code = input.code.trim();

  if (!isReasonableEmail(email)) {
    throw new Error('Enter a valid email address.');
  }

  if (!/^\d{6}$/.test(code)) {
    throw new Error('Enter the six-digit code.');
  }

  const [loginCode] = await db
    .select()
    .from(emailLoginCodes)
    .where(
      and(
        eq(emailLoginCodes.email, email),
        isNull(emailLoginCodes.consumedAt),
      ),
    )
    .orderBy(desc(emailLoginCodes.createdAt))
    .limit(1);

  if (!loginCode) {
    throw new Error('That code did not match. Request a fresh one.');
  }

  if (loginCode.expiresAt.getTime() < Date.now()) {
    throw new Error('That code has expired. Request a fresh one.');
  }

  if (loginCode.attempts >= env.AUTH_CODE_MAX_ATTEMPTS) {
    throw new Error('Too many wrong tries. Request a fresh code.');
  }

  const expectedHash = hashSecret(`${email}:${code}`);
  const ok = constantTimeEqual(loginCode.codeHash, expectedHash);

  if (!ok) {
    await db
      .update(emailLoginCodes)
      .set({ attempts: loginCode.attempts + 1 })
      .where(eq(emailLoginCodes.id, loginCode.id));

    throw new Error('That code did not match. Try again.');
  }

  await db
    .update(emailLoginCodes)
    .set({ consumedAt: new Date() })
    .where(eq(emailLoginCodes.id, loginCode.id));

  const now = new Date();
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let userRow: typeof users.$inferSelect;

  if (existingUser) {
    userRow = existingUser;
  } else {
    const [created] = await db
      .insert(users)
      .values({
        email,
        roles: ['reader'],
        displayName: deriveDefaultName(email),
        joinedAt: now,
      })
      .returning();

    userRow = created;
  }

  const sessionToken = generateSessionToken();
  const tokenHash = hashSecret(sessionToken);
  const sessionExpiresAt = new Date(
    Date.now() + env.AUTH_SESSION_DAYS * 24 * 60 * 60 * 1000,
  );

  await db.insert(sessions).values({
    userId: userRow.id,
    tokenHash,
    expiresAt: sessionExpiresAt,
  });

  return {
    user: toPublicUser(userRow),
    sessionToken,
    sessionExpiresAt,
  };
}

export async function getUserBySessionToken(token: string | undefined): Promise<PublicUser | null> {
  if (!token) return null;

  const tokenHash = hashSecret(token);

  const [row] = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row) return null;
  return toPublicUser(row.user);
}

export async function logoutSession(token: string | undefined): Promise<void> {
  if (!token) return;

  const tokenHash = hashSecret(token);

  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

function deriveDefaultName(email: string): string {
  const domain = email.split('@')[1] ?? 'post.org';
  return `the reader at ${domain}`;
}
