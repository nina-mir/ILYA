import { env } from '../env';

function validateUrl(value: string): URL {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();

  if (
    url.protocol !== 'https:' ||
    (host !== 'gutenberg.org' &&
      !host.endsWith('.gutenberg.org')) ||
    url.username ||
    url.password
  ) {
    throw new Error('Invalid Gutenberg download URL.');
  }

  return url;
}

export async function fetchGutenbergText(
  sourceUrl: string,
): Promise<string> {
  let url = validateUrl(sourceUrl);

  // Follow up to five redirects, validating each destination.
  for (let attempt = 0; attempt <= 5; attempt++) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': env.GUTENBERG_USER_AGENT,
        Accept: 'text/plain',
      },
      signal: AbortSignal.timeout(
        env.GUTENBERG_FETCH_TIMEOUT_MS,
      ),
      redirect: 'manual',
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');

      await response.body?.cancel();

      if (!location) {
        throw new Error('Gutenberg redirect has no destination.');
      }
      const redirectUrl = new URL(location, url);

      // Gutenberg sometimes redirects HTTPS downloads to HTTP.
      // Upgrade to HTTPS before validating the destination.
      if (redirectUrl.protocol === 'http:') {
            redirectUrl.protocol = 'https:';
      }

      url = validateUrl(redirectUrl.href);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Gutenberg returned HTTP ${response.status}.`);
    }

    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.toLowerCase().includes('text/html')) {
      throw new Error('Gutenberg returned HTML instead of plain text.');
    }

    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error('Gutenberg returned an empty response body.');
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;

      if (totalBytes > env.GUTENBERG_MAX_TEXT_BYTES) {
        await reader.cancel();
        throw new Error('Gutenberg text exceeds the download limit.');
      }

      chunks.push(value);
    }

    const text = Buffer.concat(chunks).toString('utf8');

    if (!text.trim()) {
      throw new Error('Gutenberg returned empty text.');
    }

    return text;
  }

  throw new Error('Too many Gutenberg redirects.');
}
