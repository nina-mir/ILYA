const GUTENDEX_BASE = 'https://gutendex.com';

export interface GutendexAuthor {
  name: string;
  birth_year?: number | null;
  death_year?: number | null;
}

export interface GutendexBook {
  id: number;
  title: string;
  authors: GutendexAuthor[];
  languages: string[];
  formats: Record<string, string>;
  download_count?: number;
}

export interface GutendexSearchResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: GutendexBook[];
}

export function formatAuthors(authors: GutendexAuthor[] | null | undefined): string {
  if (!authors || authors.length === 0) return 'Unknown';

  return (
    authors
      .map((author) => {
        const name = author.name?.trim();
        if (!name) return null;

        const parts = name.split(',').map((part) => part.trim()).filter(Boolean);
        if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
        return name;
      })
      .filter((name): name is string => Boolean(name))
      .join(' & ') || 'Unknown'
  );
}

export function pickPlainTextUrl(formats: Record<string, string> | undefined): string | null {
  if (!formats) return null;

  const candidates: Array<[string, string]> = [];

  for (const [mime, url] of Object.entries(formats)) {
    if (!url || url.endsWith('.zip')) continue;
    if (mime.startsWith('text/plain')) {
      candidates.push([mime, url]);
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort(([a], [b]) => {
    const score = (mime: string) => {
      if (mime.includes('utf-8')) return 0;
      if (mime.includes('us-ascii')) return 1;
      return 2;
    };

    return score(a) - score(b);
  });

  return candidates[0][1];
}

export async function fetchGutendexBook(gutenbergId: string): Promise<GutendexBook> {
  const url = `${GUTENDEX_BASE}/books/${encodeURIComponent(gutenbergId)}`;

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Project Gutenberg book ${gutenbergId} was not found in the catalogue.`);
    }

    throw new Error(`Catalogue lookup failed with HTTP ${response.status}.`);
  }

  return (await response.json()) as GutendexBook;
}

export async function searchGutendex(query: string, limit = 24): Promise<GutendexBook[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = `${GUTENDEX_BASE}/books?search=${encodeURIComponent(trimmed)}`;

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Catalogue search failed with HTTP ${response.status}.`);
  }

  const data = (await response.json()) as GutendexSearchResponse;
  return data.results.slice(0, limit);
}
