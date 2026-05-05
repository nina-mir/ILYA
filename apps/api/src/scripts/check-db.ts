import { count } from 'drizzle-orm';
import { db, queryClient } from '../db/client';
import {
  users,
  cachedBooks,
  userBooks,
  emailLoginCodes,
  sessions,
  importJobs,
} from '../db/schema';

async function main() {
  const [
    userCount,
    cachedBookCount,
    userBookCount,
    codeCount,
    sessionCount,
    jobCount,
  ] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(cachedBooks),
    db.select({ count: count() }).from(userBooks),
    db.select({ count: count() }).from(emailLoginCodes),
    db.select({ count: count() }).from(sessions),
    db.select({ count: count() }).from(importJobs),
  ]);

  console.log('Ilya database check passed.');
  console.table({
    users: Number(userCount[0]?.count ?? 0),
    cached_books: Number(cachedBookCount[0]?.count ?? 0),
    user_books: Number(userBookCount[0]?.count ?? 0),
    email_login_codes: Number(codeCount[0]?.count ?? 0),
    sessions: Number(sessionCount[0]?.count ?? 0),
    import_jobs: Number(jobCount[0]?.count ?? 0),
  });
}

main()
  .catch((err) => {
    console.error('Ilya database check failed.');
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await queryClient.end();
  });
