import {
  fetchGutendexBook,
  formatAuthors,
  pickPlainTextUrl,
} from '@ilya/shared';

export async function getBookSource(gutenbergId: string) {
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
