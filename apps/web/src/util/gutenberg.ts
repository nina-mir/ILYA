import { resolveGutenbergId } from '@ilya/shared';

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

  const bookId = resolveGutenbergId(value);
  if (bookId) {
    return { mode: /^\d+$/.test(value) ? 'id' : 'url', bookId };
  }

  return { mode: 'query', query: value };
}
