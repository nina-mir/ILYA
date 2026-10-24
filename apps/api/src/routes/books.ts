import { Hono } from 'hono';
import { asc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { gutenbergCatalog } from '../db/schema';
import type { PublicUser } from '../types';
import { resolveGutenbergId } from '@ilya/shared';
import { fileEdition } from '../importer/fileEdition';

type AppEnv = {
  Variables: {
    user: PublicUser | null;
  };
};

export const booksRoute = new Hono<AppEnv>();

booksRoute.post('/search-books', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'You must be signed in.' }, 401);
  }

  const body = await c.req.json().catch(() => null);
  const query = typeof body?.query === 'string'
    ? body.query.trim()
    : '';

  if (!query || query.length > 200) {
    return c.json({ error: 'Enter a search query of 1–200 characters.' }, 400);
  }

  try {
    const [available] = await db.select({ id: gutenbergCatalog.gutenbergId })
      .from(gutenbergCatalog).limit(1);
    if (!available) {
      return c.json({ error: 'The local catalogue has not been imported yet.' }, 503);
    }
    const books = await db.select().from(gutenbergCatalog).where(sql`
      to_tsvector('simple', ${gutenbergCatalog.title} || ' ' || ${gutenbergCatalog.author})
      @@ plainto_tsquery('simple', ${query})
    `).orderBy(asc(gutenbergCatalog.title), asc(gutenbergCatalog.gutenbergId)).limit(24);
    return c.json({
      results: books.map((book) => ({
        gutenbergId: book.gutenbergId,
        title: book.title,
        author: book.author,
        language: book.language.toUpperCase(),
      })),
    });
  } catch (error) {
    console.error('[books] Search failed:', error);
    return c.json({ error: 'The local catalogue could not be searched.' }, 500);
  }
});

booksRoute.post('/file-edition', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'You must be signed in.' }, 401);
  }

  const body = await c.req.json().catch(() => null);

  const source =
    typeof body?.source === 'string' ? body.source : '';

  const gutenbergId = resolveGutenbergId(source);

  if (!gutenbergId) {
    return c.json(
      { error: 'Enter a valid Gutenberg ID or URL.' },
      400,
    );
  }

  try {
    const result = await fileEdition({
      userId: user.id,
      gutenbergId,
    });

    return c.json(result, 201);
  } catch (error) {
    console.error('[books] Filing failed:', error);

    return c.json(
      { error: 'Could not file the edition.' },
      500,
    );
  }
});
