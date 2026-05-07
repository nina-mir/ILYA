import { Hono, type Context } from 'hono';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { cachedBooks, userBooks } from '../db/schema';
import { badRequest, notFound } from '../lib/http';
import { iso, isoRequired } from '../lib/serialize';
import type { PublicUser } from '../types';

type AppEnv = {
  Variables: {
    user: PublicUser | null;
  };
};

export const editionsRoute = new Hono<AppEnv>();

function getCurrentUser(c: Context<AppEnv>) {
  return c.get('user');
}

editionsRoute.get('/library', async (c) => {
  const user = getCurrentUser(c);

  if (!user) {
    return c.json({ error: 'You must be signed in.' }, 401);
  }

  const rows = await db
    .select()
    .from(userBooks)
    .where(eq(userBooks.userId, user.id))
    .orderBy(
      desc(sql`coalesce(${userBooks.lastEditedAt}, ${userBooks.createdAt})`),
      desc(userBooks.createdAt),
    );

  return c.json({
    entries: rows.map((row) => ({
      id: row.id,
      gutenbergId: row.gutenbergId,
      title: row.title,
      author: row.author,
      status: row.status,
      statusMessage: row.statusMessage,
      lastEditedAt: iso(row.lastEditedAt),
      createdAt: isoRequired(row.createdAt),
    })),
  });
});

editionsRoute.get('/editions/:id', async (c) => {
  const user = getCurrentUser(c);

  if (!user) {
    return c.json({ error: 'You must be signed in.' }, 401);
  }

  const id = c.req.param('id');
  const row = await getOwnedEdition(id, user.id);

  return c.json({
    id: row.id,
    gutenbergId: row.gutenbergId,
    title: row.title,
    author: row.author,
    markdownContent: row.markdownContent,
    status: row.status,
    statusMessage: row.statusMessage,
    lastEditedAt: iso(row.lastEditedAt),
    createdAt: isoRequired(row.createdAt),
    updatedAt: isoRequired(row.updatedAt),
  });
});

editionsRoute.patch('/editions/:id', async (c) => {
  const user = getCurrentUser(c);

  if (!user) {
    return c.json({ error: 'You must be signed in.' }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);

  if (!body || typeof body.markdownContent !== 'string') {
    badRequest('The edition could not be set: missing content.');
  }

  const existing = await getOwnedEdition(id, user.id);

  if (existing.status !== 'ready') {
    badRequest('This edition is still being prepared. Wait a moment, then try again.');
  }

  const now = new Date();

  const [updated] = await db
    .update(userBooks)
    .set({
      markdownContent: body.markdownContent,
      lastEditedAt: now,
      updatedAt: now,
    })
    .where(and(eq(userBooks.id, id), eq(userBooks.userId, user.id)))
    .returning();

  return c.json({
    id: updated.id,
    lastEditedAt: isoRequired(updated.lastEditedAt ?? now),
  });
});

editionsRoute.delete('/editions/:id', async (c) => {
  const user = getCurrentUser(c);

  if (!user) {
    return c.json({ error: 'You must be signed in.' }, 401);
  }

  const id = c.req.param('id');

  await getOwnedEdition(id, user.id);

  await db
    .delete(userBooks)
    .where(and(eq(userBooks.id, id), eq(userBooks.userId, user.id)));

  return c.json({ deleted: true });
});

// Development-only helper. This lets Phase 4 test library/editor APIs before
// Phase 5/6 bring over the frontend and Gutenberg import worker.
editionsRoute.post('/dev/seed-edition', async (c) => {
  if (process.env.NODE_ENV === 'production') {
    notFound('Not found.');
  }

  const user = getCurrentUser(c);

  if (!user) {
    return c.json({ error: 'You must be signed in.' }, 401);
  }

  const body = await c.req.json().catch(() => ({}));

  const gutenbergId =
    typeof body.gutenbergId === 'string' && body.gutenbergId.trim()
      ? body.gutenbergId.trim()
      : '1342';

  const title =
    typeof body.title === 'string' && body.title.trim()
      ? body.title.trim()
      : 'Pride and Prejudice';

  const author =
    typeof body.author === 'string' && body.author.trim()
      ? body.author.trim()
      : 'Jane Austen';

  const markdown =
    typeof body.markdownContent === 'string' && body.markdownContent.trim()
      ? body.markdownContent
      : `## Chapter I

It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.

---

## Chapter II

Mr. Bennet was among the earliest of those who waited on Mr. Bingley.`;

  const now = new Date();

  await db
    .insert(cachedBooks)
    .values({
      gutenbergId,
      title,
      author,
      language: 'en',
      rawText: markdown,
      cleanedMarkdown: markdown,
      fetchedAt: now,
      sourceUrl: 'local-dev-seed',
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: cachedBooks.gutenbergId });

  const [createdOrUpdated] = await db
    .insert(userBooks)
    .values({
      userId: user.id,
      gutenbergId,
      title,
      author,
      markdownContent: markdown,
      status: 'ready',
      statusMessage: null,
      lastEditedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [userBooks.userId, userBooks.gutenbergId],
      set: {
        title,
        author,
        markdownContent: markdown,
        status: 'ready',
        statusMessage: null,
        updatedAt: now,
      },
    })
    .returning();

  return c.json({
    id: createdOrUpdated.id,
    gutenbergId: createdOrUpdated.gutenbergId,
    status: createdOrUpdated.status,
  });
});

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function getOwnedEdition(id: string, userId: string) {
  if (!isUuid(id)) {
    notFound('That edition was not found in your library.');
  }

  const [row] = await db
    .select()
    .from(userBooks)
    .where(and(eq(userBooks.id, id), eq(userBooks.userId, userId)))
    .limit(1);

  if (!row) {
    notFound('That edition was not found in your library.');
  }

  return row;
}