// Local test-data preparation only. Run before the whole Kane suite.
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env', quiet: true });
config({ path: 'apps/api/.env', override: true, quiet: true });

async function main() {
  const address = new URL(process.env.DATABASE_URL ?? '');
  if (
    process.env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(address.hostname) ||
    !address.pathname.endsWith('_dev')
  ) {
    throw new Error('Suite preparation requires a local database ending in _dev.');
  }
  if (process.env.EMAIL_MODE !== 'console') {
    throw new Error('The local API must use EMAIL_MODE=console for @test.local login codes.');
  }
  const delay = Number(process.env.IMPORT_DEBUG_TEXT_DELAY_MS ?? 0);
  if (!Number.isInteger(delay) || delay < 30_000) {
    throw new Error('Set IMPORT_DEBUG_TEXT_DELAY_MS=30000 in apps/api/.env and restart the worker.');
  }

  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    await sql.begin(async (tx) => {
      // Avoid clearing the cache while another Dracula import can repopulate it.
      await tx`lock table cached_books, import_jobs in share row exclusive mode`;
      const active = await tx`
        select id from import_jobs
        where gutenberg_id = '345' and status in ('pending', 'running')
      `;
      if (active.length) {
        throw new Error('A Dracula import is active. Let it finish before preparing the suite.');
      }
      const cached = await tx`
        select gutenberg_id from cached_books where gutenberg_id in ('84', '1342')
      `;
      if (cached.length !== 2) {
        throw new Error('The suite needs cached Frankenstein (84) and Pride and Prejudice (1342).');
      }
      const deleted = await tx`
        delete from cached_books where gutenberg_id = '345' returning gutenberg_id
      `;
      console.log(`Dracula is uncached (${deleted.length} cache row removed).`);
    });
    console.log('Existing readers and editions preserved; tests generate fresh @test.local readers.');
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  // Do not echo database URLs or connection errors that might include credentials.
  const known = error instanceof Error && /^(Suite preparation|The local API|Set IMPORT_|A Dracula|The suite)/.test(error.message);
  console.error(known ? error.message : 'Suite preparation failed; check the local database configuration.');
  process.exitCode = 1;
});
