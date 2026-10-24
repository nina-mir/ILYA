import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import {
  importJobs,
  userBooks,
  type ImportJob,
} from '../db/schema';
import { env } from '../env';

export async function failImportJob(
  job: ImportJob,
  error: unknown,
) {
  const message = (
    error instanceof Error ? error.message : String(error)
  ).slice(0, 1000);

  const result = await db.transaction(async (tx) => {
    // Verify the worker still owns this job.
    const [activeJob] = await tx
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

    if (!activeJob || activeJob.attempts !== job.attempts) {
      throw new Error('Import job is no longer owned by this worker.');
    }

    const shouldRetry =
      activeJob.attempts < env.IMPORT_MAX_ATTEMPTS;

    const now = new Date();

    // Release the job so it can retry, or mark it failed.
    await tx
      .update(importJobs)
      .set({
        status: shouldRetry ? 'pending' : 'failed',
        lastError: message,
        lockedAt: null,
        lockedBy: null,
        updatedAt: now,
      })
      .where(eq(importJobs.id, job.id));

    // Update only the unfinished, unedited personal edition.
    await tx
      .update(userBooks)
      .set({
        status: shouldRetry ? 'pending' : 'failed',
        statusMessage: shouldRetry
          ? 'Import unsuccessful. Waiting to retry.'
          : `Import failed: ${message}`,
        updatedAt: now,
      })
      .where(
        and(
          eq(userBooks.id, job.userBookId),
          isNull(userBooks.lastEditedAt),
          inArray(userBooks.status, [
            'pending',
            'fetching_metadata',
            'fetching_text',
            'processing',
          ]),
        ),
      );

    return shouldRetry;
  });

  console.warn(
    `[worker] Import ${job.gutenbergId} failed. ` +
    `Retry: ${result}. Reason: ${message}`,
  );

  return { willRetry: result };
}
