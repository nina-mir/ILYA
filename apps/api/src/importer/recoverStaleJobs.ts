import { and, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import { db } from '../db/client';
import { importJobs, userBooks } from '../db/schema';
import { env } from '../env';

const STALE_AFTER_MS = 15 * 60 * 1000;

export async function recoverStaleJobs() {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_AFTER_MS);

  return db.transaction(async (tx) => {
    const jobs = await tx
      .select()
      .from(importJobs)
      .where(
        and(
          eq(importJobs.status, 'running'),
          or(
            lt(importJobs.lockedAt, staleBefore),
            isNull(importJobs.lockedAt),
          ),
        ),
      )
      .for('update', { skipLocked: true });

    for (const job of jobs) {
      const exhausted = job.attempts >= env.IMPORT_MAX_ATTEMPTS;

      await tx
        .update(importJobs)
        .set({
          status: exhausted ? 'failed' : 'pending',
          lastError: 'Worker stopped before completing the import.',
          lockedAt: null,
          lockedBy: null,
          updatedAt: now,
        })
        .where(eq(importJobs.id, job.id));

      if (exhausted) {
        await tx
          .update(userBooks)
          .set({
            status: 'failed',
            statusMessage: 'Import failed after repeated interruptions.',
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
      }

      console.log(
        `[worker] Recovered job ${job.id}: ${
          exhausted ? 'failed' : 'pending'
        }`,
      );
    }

    return jobs.length;
  });
}
