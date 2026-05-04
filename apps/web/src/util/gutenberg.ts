// Mirror of the backend's resolveGutenbergId classifier, used client-side
// by the smart input on /file to decide between URL/ID action mode and
// search query mode (and to render the canonical "filing Project
// Gutenberg ebook NN" caption before the request goes out).

export type SmartInputMode = 'empty' | 'id' | 'url' | 'query';

export interface SmartInputClassification {
  mode: SmartInputMode;
  // The resolved Gutenberg book ID, when mode is 'id' or 'url'.
  bookId?: string;
  // The trimmed query string, when mode is 'query'.
  query?: string;
}

export function classifyInput(raw: string): SmartInputClassification {
  const value = raw.trim();
  if (!value) return { mode: 'empty' };

  // Pure digits, 1–7 of them.
  if (/^\d{1,7}$/.test(value)) {
    return { mode: 'id', bookId: value };
  }

  // gutenberg.org or pglaf.org URL with an extractable numeric segment.
  if (/gutenberg\.org|pglaf\.org/i.test(value)) {
    // Strip protocol and host, then pull the first 1–7 digit run from the path.
    const stripped = value.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    const m = stripped.match(/(\d{1,7})/);
    if (m) return { mode: 'url', bookId: m[1] };
  }

  return { mode: 'query', query: value };
}
