import { processGutenbergText } from '@ilya/shared';
import { getBookSource } from './getBookSource';
import { fetchGutenbergText } from './fetchText';
import { env } from '../env';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { userBooks } from '../db/schema';

export async function importBook(gutenbergId: string, userBookId: string) {
  async function updateProgress(
    status: 'fetching_text' | 'processing',
    metadata?: { title: string; author: string },
  ) {
    await db.update(userBooks).set({
      ...metadata,
      status,
      statusMessage: null,
      updatedAt: new Date(),
    }).where(and(
      eq(userBooks.id, userBookId),
      eq(userBooks.gutenbergId, gutenbergId),
      isNull(userBooks.lastEditedAt),
      inArray(userBooks.status, ['pending', 'fetching_metadata', 'fetching_text', 'processing']),
    ));
  }

  console.log(`[import] Fetching metadata for ${gutenbergId}`);

  const book = await getBookSource(gutenbergId);

  await updateProgress('fetching_text', { title: book.title, author: book.author });

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

  await updateProgress('processing');

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
