import { Hono } from 'hono';
import type { PublicUser } from '../types';

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
