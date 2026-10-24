import { and, asc, eq, lt } from 'drizzle-orm';
import { db } from '../db/client';
import { importJobs } from '../db/schema';
import { env } from '../env';

export async function claimNextJob() {
  return db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(importJobs)
      .where(
        and(
          eq(importJobs.status, 'pending'),
          lt(importJobs.attempts, env.IMPORT_MAX_ATTEMPTS),
        ),
      )
      .orderBy(asc(importJobs.createdAt))
      .limit(1)
      .for('update', { skipLocked: true });

    if (!job) {
      return null;
    }

    const now = new Date();

    const [claimed] = await tx
      .update(importJobs)
      .set({
        status: 'running',
        attempts: job.attempts + 1,
        lockedAt: now,
        lockedBy: env.IMPORT_WORKER_ID,
        updatedAt: now,
      })
      .where(eq(importJobs.id, job.id))
      .returning();

    console.log(
      `[worker] Claimed job ${claimed.id} for book ${claimed.gutenbergId}`,
    );

    return claimed;
  });
}
