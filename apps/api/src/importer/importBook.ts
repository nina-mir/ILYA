import { processGutenbergText } from '@ilya/shared';
import { getBookSource } from './getBookSource';
import { fetchGutenbergText } from './fetchText';
import { env } from '../env';

export async function importBook(gutenbergId: string) {
  console.log(`[import] Fetching metadata for ${gutenbergId}`);

  const book = await getBookSource(gutenbergId);

  if (env.IMPORT_DEBUG_TEXT_DELAY_MS > 0) {
    console.log(
      `[import] ${new Date().toISOString()} Debug text delay: ${env.IMPORT_DEBUG_TEXT_DELAY_MS}ms for ${gutenbergId}`,
    );
    await new Promise<void>((resolve) => {
      setTimeout(resolve, env.IMPORT_DEBUG_TEXT_DELAY_MS);
    });
  }

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
