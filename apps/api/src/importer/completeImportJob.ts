import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import {
  cachedBooks,
  importJobs,
  userBooks,
  type ImportJob,
} from '../db/schema';
import { env } from '../env';
import type { importBook } from './importBook';

type ImportedBook = Awaited<ReturnType<typeof importBook>>;

export async function completeImportJob(
  job: ImportJob,
  book: ImportedBook,
) {
  const now = new Date();

  if (book.gutenbergId !== job.gutenbergId) {
    throw new Error('Imported book ID does not match the job.');
  }

  return db.transaction(async (tx) => {
    // Make sure this worker still owns the running job.
    const [runningJob] = await tx
      .select()
      .from(importJobs)
      .where(
        and(
          eq(importJobs.id, job.id),
          eq(importJobs.status, 'running'),
          eq(importJobs.lockedBy, env.IMPORT_WORKER_ID),
        ),
      )
      .for('update');

    if (!runningJob) {
      throw new Error('Import job is no longer owned by this worker.');
    }

    // Save the shared copy without replacing an existing cache.
    await tx
      .insert(cachedBooks)
      .values({
        gutenbergId: job.gutenbergId,
        title: book.title,
        author: book.author,
        language: book.language,
        rawText: book.rawText,
        cleanedMarkdown: book.cleanedMarkdown,
        sourceUrl: book.sourceUrl,
        fetchedAt: now,
      })
      .onConflictDoNothing({
        target: cachedBooks.gutenbergId,
      });

    const [cached] = await tx
      .select()
      .from(cachedBooks)
      .where(eq(cachedBooks.gutenbergId, job.gutenbergId))
      .limit(1);

    if (!cached) {
      throw new Error('Cached book was not found.');
    }

    // Update only an unedited, unfinished personal edition.
    await tx
      .update(userBooks)
      .set({
        title: cached.title,
        author: cached.author,
        markdownContent: cached.cleanedMarkdown,
        status: 'ready',
        statusMessage: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(userBooks.id, job.userBookId),
          eq(userBooks.gutenbergId, job.gutenbergId),
          isNull(userBooks.lastEditedAt),
          inArray(userBooks.status, [
            'pending',
            'fetching_metadata',
            'fetching_text',
            'processing',
          ]),
        ),
      );

    // Mark the import job as completed.
    await tx
      .update(importJobs)
      .set({
        status: 'completed',
        lastError: null,
        lockedAt: null,
        lockedBy: null,
        updatedAt: now,
      })
      .where(eq(importJobs.id, job.id));

    console.log(`[worker] Completed import ${job.gutenbergId}`);
  });
}
