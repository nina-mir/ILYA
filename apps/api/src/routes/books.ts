import { Hono } from 'hono';
import type { PublicUser } from '../types';
import { resolveGutenbergId } from '@ilya/shared';
import { fileEdition } from '../importer/fileEdition';

type AppEnv = {
  Variables: {
    user: PublicUser | null;
  };
};

type GutendexBook = {
  id: number;
  title: string;
  authors: { name: string }[];
  languages: string[];
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

  const url = new URL('https://gutendex.com/books/');
  url.searchParams.set('search', query);

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      return c.json({ error: 'Gutenberg search is unavailable.' }, 502);
    }

    const data = await response.json() as { results: GutendexBook[] };

    return c.json({
      results: data.results.map((book) => ({
        gutenbergId: String(book.id),
        title: book.title,
        author: book.authors.map((author) => author.name).join(', '),
        language: book.languages[0]?.toUpperCase() ?? '',
      })),
    });
  } catch (error) {
    console.error('[books] Search failed:', error);
    return c.json({ error: 'Gutenberg search failed.' }, 502);
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
