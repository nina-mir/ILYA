import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCatalog } from './parseCatalog';

const header = 'Text#,Type,Title,Language,Authors\n';

test('quoted multiline titles, multiple authors, BOM and non-text rows', () => {
  const result = parseCatalog('\uFEFF' + header +
    '2701,Text,"Moby Dick,\nOr The Whale",en,"Melville, Herman, 1819-1891; London, Jack, 1876-1916"\n' +
    '2,Sound,An audio book,en,Someone\n');
  assert.equal(result.skipped, 1);
  assert.deepEqual(result.rows, [{
    gutenbergId: '2701', title: 'Moby Dick,\nOr The Whale',
    author: 'Herman Melville & Jack London', language: 'en',
    sourceUrl: 'https://www.gutenberg.org/ebooks/2701.txt.utf-8',
  }]);
});

test('rejects missing headers, duplicate IDs, malformed CSV and empty imports', () => {
  assert.throws(() => parseCatalog('wrong,headers\n1,2'), /required columns/);
  assert.throws(() => parseCatalog(header + '1,Text,One,en,A\n1,Text,Two,en,B'), /Duplicate/);
  assert.throws(() => parseCatalog(header + '1,Text,"unclosed,en,A'));
  assert.throws(() => parseCatalog(header + '1,Sound,Audio,en,A'), /no valid text books/);
});
