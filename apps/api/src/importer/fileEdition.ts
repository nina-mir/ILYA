import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { cachedBooks, importJobs, userBooks } from '../db/schema';

export async function fileEdition(input: {
  userId: string;
  gutenbergId: string;
}) {
  const { userId, gutenbergId } = input;

  return db.transaction(async (tx) => {
    // Check whether Gutenberg text has already been cached.
    const [cached] = await tx
      .select()
      .from(cachedBooks)
      .where(eq(cachedBooks.gutenbergId, gutenbergId))
      .limit(1);

    // Create a personal edition only if the user doesn't have one.
    const [created] = await tx
      .insert(userBooks)
      .values({
        userId,
        gutenbergId,
        title: cached?.title ?? 'Fetching the edition…',
        author: cached?.author ?? '',
        markdownContent: cached?.cleanedMarkdown ?? '',
        status: cached ? 'ready' : 'pending',
        statusMessage: cached ? null : 'Waiting to be imported.',
      })
      .onConflictDoNothing({
        target: [userBooks.userId, userBooks.gutenbergId],
      })
      .returning();

    // Never overwrite an existing personal edition.
    if (!created) {
      const [existing] = await tx
        .select()
        .from(userBooks)
        .where(
          and(
            eq(userBooks.userId, userId),
            eq(userBooks.gutenbergId, gutenbergId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new Error('Could not find the existing edition.');
      }

      return {
        id: existing.id,
        gutenbergId,
        status: existing.status,
      };
    }

    // Only queue a job if there is no cached text.
    if (!cached) {
      await tx.insert(importJobs).values({
        userBookId: created.id,
        gutenbergId,
        status: 'pending',
      });
    }

    return {
      id: created.id,
      gutenbergId,
      status: created.status,
    };
  });
}
