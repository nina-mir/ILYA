import { eq } from 'drizzle-orm';
import { db, queryClient } from '../db/client';
import { users, cachedBooks, userBooks } from '../db/schema';

async function main() {
  const email = 'reader@example.com';

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  const [user] = existing
    ? [existing]
    : await db
        .insert(users)
        .values({
          email,
          displayName: 'the reader at example.com',
          joinedAt: new Date(),
        })
        .returning();

  const gutenbergId = '1342';

  const existingCached = await db.query.cachedBooks.findFirst({
    where: eq(cachedBooks.gutenbergId, gutenbergId),
  });

  const [cached] = existingCached
    ? [existingCached]
    : await db
        .insert(cachedBooks)
        .values({
          gutenbergId,
          title: 'Pride and Prejudice',
          author: 'Jane Austen',
          language: 'en',
          rawText: 'PRIDE AND PREJUDICE\n\nCHAPTER I.\n\nIt is a truth universally acknowledged...',
          cleanedMarkdown: '## CHAPTER I.\n\nIt is a truth universally acknowledged...',
          fetchedAt: new Date(),
          sourceUrl: 'local-seed',
        })
        .returning();

  const existingUserBook = await db.query.userBooks.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.userId, user.id), eq(table.gutenbergId, gutenbergId)),
  });

  if (!existingUserBook) {
    await db.insert(userBooks).values({
      userId: user.id,
      gutenbergId: cached.gutenbergId,
      title: cached.title,
      author: cached.author,
      markdownContent: cached.cleanedMarkdown,
      status: 'ready',
      statusMessage: null,
    });
  }

  console.log('Seeded local development data.');
  console.log({ userId: user.id, email, gutenbergId });
}

main()
  .catch((err) => {
    console.error('Seed failed.');
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await queryClient.end();
  });
