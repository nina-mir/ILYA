export * from './types';

export type UserBookStatus =
  | 'pending'
  | 'fetching_metadata'
  | 'fetching_text'
  | 'processing'
  | 'ready'
  | 'failed';

export interface LibraryEntry {
  id: string;
  gutenbergId: string;
  title: string;
  author: string;
  status: UserBookStatus;
  statusMessage: string | null;
  lastEditedAt: number | null;
  createdAt: number;
}

export interface Edition {
  id: string;
  gutenbergId: string;
  title: string;
  author: string;
  markdownContent: string;
  status: UserBookStatus;
  statusMessage: string | null;
  lastEditedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface BookSearchResult {
  gutenbergId: string;
  title: string;
  author: string;
  language: string;
}
