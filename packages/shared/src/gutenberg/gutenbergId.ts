const GUTENBERG_HOSTS = ['gutenberg.org', 'pglaf.org', 'pglaf.com'];

export function resolveGutenbergId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^\d{1,7}$/.test(trimmed)) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();
  const isGutenbergHost = GUTENBERG_HOSTS.some((host) => lower.includes(host));
  if (!isGutenbergHost) return null;

  const matches = trimmed.match(/\d{2,7}/g);
  if (!matches || matches.length === 0) return null;

  const counts = new Map<string, number>();
  for (const match of matches) {
    counts.set(match, (counts.get(match) ?? 0) + 1);
  }

  let best = matches[0];
  let bestScore = -Infinity;

  for (const [id, count] of counts) {
    const score = count * 10 + id.length;
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }

  return best;
}

export function classifyImportInput(
  input: string,
):
  | { kind: 'id'; id: string }
  | { kind: 'url'; id: string }
  | { kind: 'query'; query: string } {
  const trimmed = input.trim();
  if (!trimmed) return { kind: 'query', query: '' };

  if (/^\d{1,7}$/.test(trimmed)) {
    return { kind: 'id', id: trimmed };
  }

  const lower = trimmed.toLowerCase();
  const isGutenbergHost = GUTENBERG_HOSTS.some((host) => lower.includes(host));

  if (isGutenbergHost) {
    const id = resolveGutenbergId(trimmed);
    if (id) return { kind: 'url', id };
  }

  return { kind: 'query', query: trimmed };
}
