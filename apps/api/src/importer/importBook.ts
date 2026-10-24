import { processGutenbergText } from '@ilya/shared';
import { getBookSource } from './getBookSource';
import { fetchGutenbergText } from './fetchText';

export async function importBook(gutenbergId: string) {
  console.log(`[import] Fetching metadata for ${gutenbergId}`);

  const book = await getBookSource(gutenbergId);

  console.log(`[import] Downloading ${book.title}`);

  const rawText = await fetchGutenbergText(book.sourceUrl);

  console.log(`[import] Processing ${rawText.length} characters`);

  const cleanedMarkdown = processGutenbergText(rawText);

  if (!cleanedMarkdown.trim()) {
    throw new Error('Gutenberg processing produced empty content.');
  }

  console.log(`[import] Finished processing ${gutenbergId}`);

  return {
    ...book,
    rawText,
    cleanedMarkdown,
  };
}
