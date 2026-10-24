const GUTENBERG_HOSTS = ['gutenberg.org', 'pglaf.org', 'pglaf.com'];

export function resolveGutenbergId(input: string): string | null {
  const value = input.trim();

  if (/^[1-9]\d{0,6}$/.test(value)) return value;
  if (!value) return null;

  try {
    const address = /^https?:\/\//i.test(value)
      ? value
      : `https://${value}`;

    const url = new URL(address);

    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.username || url.password) return null;

    const host = url.hostname.toLowerCase();

    const validHost = GUTENBERG_HOSTS.some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    );

    if (!validHost) return null;

    const match = url.pathname.match(
      /^\/(?:ebooks|files|cache\/epub)\/([1-9]\d{0,6})(?=\/|\.|$)/i
    );

    return match?.[1] ?? null;
  } catch {
    return null;
  }
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
