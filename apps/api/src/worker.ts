import { env } from './env';
import { queryClient } from './db/client';
import { claimNextJob } from './importer/claimNextJob';
import { importBook } from './importer/importBook';
import { completeImportJob } from './importer/completeImportJob';
import { failImportJob } from './importer/failImportJob';
import { recoverStaleJobs } from './importer/recoverStaleJobs';

let stopping = false;

process.on('SIGINT', () => {
  stopping = true;
});

process.on('SIGTERM', () => {
  stopping = true;
});

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
  console.log(`[worker] Starting ${env.IMPORT_WORKER_ID}`);

  await recoverStaleJobs();

  let lastRecovery = Date.now();

  while (!stopping) {
    // Periodically recover jobs abandoned by crashed workers.
    if (Date.now() - lastRecovery >= 60_000) {
      await recoverStaleJobs();
      lastRecovery = Date.now();
    }

    const job = await claimNextJob();

    if (!job) {
      await sleep(env.IMPORT_WORKER_POLL_MS);
      continue;
    }

    console.log(
      `[worker] Processing Gutenberg ID ${job.gutenbergId}`,
    );

    try {
      const book = await importBook(job.gutenbergId, job.userBookId);

      await completeImportJob(job, book);

      console.log(
        `[worker] Successfully imported ${book.title}`,
      );
    } catch (error) {
      console.error(
        `[worker] Import failed for ${job.gutenbergId}`,
        error,
      );

      try {
        await failImportJob(job, error);
      } catch (failureError) {
        console.error(
          `[worker] Could not update failed job ${job.id}. ` +
          `The job may have been deleted or withdrawn.`,
          failureError,
        );
      }
    }
  }

  console.log('[worker] Stopped gracefully.');
}

main()
  .catch((error) => {
    console.error('[worker] Fatal error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await queryClient.end({ timeout: 5 });
    console.log('[worker] Database connections closed.');
  });
