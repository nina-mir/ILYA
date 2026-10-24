import { parse } from 'csv-parse/sync';
import { formatAuthors } from '@ilya/shared';

export function parseCatalog(csv: string) {
  const required = ['Text#', 'Type', 'Title', 'Language', 'Authors'];
  const records: Record<string, string>[] = parse(csv, {
    bom: true,
    skip_empty_lines: true,
    columns: (headers: string[]) => {
      if (required.some((header) => !headers.includes(header))) {
        throw new Error('Catalog CSV is missing required columns.');
      }
      return headers;
    },
  });
  let skipped = 0;
  const seen = new Set<string>();
  const rows = [];
  for (const record of records) {
    const gutenbergId = record['Text#'].trim();
    const title = record.Title.trim();
    if (record.Type !== 'Text' || !/^[1-9]\d{0,6}$/.test(gutenbergId) || !title) {
      skipped++;
      continue;
    }
    if (seen.has(gutenbergId)) throw new Error(`Duplicate catalog ID ${gutenbergId}.`);
    seen.add(gutenbergId);
    const authors = record.Authors.split(';').map((name) => ({
      // CSV names include lifespan dates; keep those out of display names.
      name: name.trim().replace(/,\s*\d{1,4}\??\s*-\s*\d{0,4}\??$/, ''),
    }));
    rows.push({
      gutenbergId,
      title,
      author: formatAuthors(authors),
      language: record.Language.split(';')[0].trim() || 'en',
      sourceUrl: `https://www.gutenberg.org/ebooks/${gutenbergId}.txt.utf-8`,
    });
  }
  if (!rows.length) throw new Error('Catalog CSV contains no valid text books.');
  return { rows, skipped };
}
