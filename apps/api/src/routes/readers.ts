import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users } from '../db/schema';
import type { PublicUser } from '../types';

type AppEnv = {
  Variables: {
    user: PublicUser | null;
  };
};

export const readersRoute = new Hono<AppEnv>();

readersRoute.post('/sign-up-reader', async (c) => {
  const currentUser = c.get('user');

  if (!currentUser) {
    return c.json({ error: 'You must be signed in.' }, 401);
  }

  const body = await safeJson(c.req.raw);

  const displayNameFromInput =
    typeof body.displayName === 'string' && body.displayName.trim()
      ? body.displayName.trim()
      : null;

  const existing = await db.query.users.findFirst({
    where: eq(users.id, currentUser.id),
  });

  if (!existing) {
    return c.json(
      { error: 'Reader record was not found. Please sign in again.' },
      404,
    );
  }

  if (existing.joinedAt) {
    return c.json({
      id: existing.id,
      email: existing.email,
      displayName: existing.displayName ?? deriveDefaultName(existing.email),
      joinedAt: existing.joinedAt.toISOString(),
      joined_at: existing.joinedAt.getTime(),
      isNewReader: false,
    });
  }

  const displayName =
    displayNameFromInput ??
    existing.displayName ??
    deriveDefaultName(existing.email);

  const now = new Date();

  const [updated] = await db
    .update(users)
    .set({
      displayName,
      joinedAt: now,
      roles: existing.roles.length ? existing.roles : ['reader'],
      updatedAt: now,
    })
    .where(eq(users.id, existing.id))
    .returning();

  return c.json({
    id: updated.id,
    email: updated.email,
    displayName: updated.displayName ?? deriveDefaultName(updated.email),
    joinedAt: updated.joinedAt?.toISOString() ?? now.toISOString(),
    joined_at: updated.joinedAt?.getTime() ?? now.getTime(),
    isNewReader: true,
  });
});

function deriveDefaultName(email: string): string {
  const domain = email.split('@')[1] ?? 'post.org';
  return `the reader at ${domain}`;
}

async function safeJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}