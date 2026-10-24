import {
  fetchGutendexBook,
  formatAuthors,
  pickPlainTextUrl,
} from '@ilya/shared';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { gutenbergCatalog } from '../db/schema';

export async function getBookSource(gutenbergId: string) {
  const [catalogBook] = await db.select({
    gutenbergId: gutenbergCatalog.gutenbergId,
    title: gutenbergCatalog.title,
    author: gutenbergCatalog.author,
    language: gutenbergCatalog.language,
    sourceUrl: gutenbergCatalog.sourceUrl,
  }).from(gutenbergCatalog)
    .where(eq(gutenbergCatalog.gutenbergId, gutenbergId)).limit(1);

  if (catalogBook) return catalogBook;

  const book = await fetchGutendexBook(gutenbergId);

  const sourceUrl = pickPlainTextUrl(book.formats);

  if (!sourceUrl) {
    throw new Error(
      `No plain-text edition available for Gutenberg ID ${gutenbergId}.`
    );
  }

  return {
    gutenbergId,
    title: book.title,
    author: formatAuthors(book.authors),
    language: book.languages[0] ?? 'en',
    sourceUrl,
  };
}
