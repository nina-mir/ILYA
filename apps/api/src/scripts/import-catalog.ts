import { readFile } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import { db, queryClient } from '../db/client';
import { gutenbergCatalog } from '../db/schema';
import { parseCatalog } from '../catalog/parseCatalog';

const catalogUrl = 'https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv';

async function main() {
  const filename = process.argv[2];
  let csv: string;
  if (filename) {
    csv = await readFile(filename, 'utf8');
  } else {
    const response = await fetch(catalogUrl, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Catalog download returned HTTP ${response.status}.`);
    csv = await response.text();
  }
  // Parse and validate the entire file before changing any catalog records.
  const { rows, skipped } = parseCatalog(csv);
  const importedAt = new Date();
  await db.transaction(async (tx) => {
    for (let offset = 0; offset < rows.length; offset += 1000) {
      await tx.insert(gutenbergCatalog)
        .values(rows.slice(offset, offset + 1000).map((row) => ({ ...row, importedAt })))
        .onConflictDoUpdate({
          target: gutenbergCatalog.gutenbergId,
          set: {
            title: sql`excluded.title`,
            author: sql`excluded.author`,
            language: sql`excluded.language`,
            sourceUrl: sql`excluded.source_url`,
            importedAt,
          },
        });
    }
  });
  console.log(`Catalog imported: ${rows.length} text books upserted, ${skipped} rows skipped.`);
}

main().catch((error) => {
  console.error('Catalog import failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
}).finally(() => queryClient.end({ timeout: 5 }));
