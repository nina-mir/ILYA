import { createClient } from '@mindstudio-ai/interface';

export interface LibraryEntry {
  id: string;
  gutenbergId: string;
  title: string;
  author: string;
  status: string;
  statusMessage: string | null;
  lastEditedAt: number | null;
  createdAt: number;
}

export interface BookSearchResult {
  gutenbergId: string;
  title: string;
  author: string;
  language: string;
}

export interface Edition {
  id: string;
  gutenbergId: string;
  title: string;
  author: string;
  markdownContent: string;
  status: string;
  statusMessage: string | null;
  lastEditedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

// Typed RPC to backend methods. The export names below must match the
// camelCase `export` field in mindstudio.json (NOT the kebab-case ids).
const api = createClient<{
  signUpReader(input: { displayName?: string }): Promise<{
    id: string;
    email: string;
    displayName: string;
    joined_at: number;
    isNewReader: boolean;
  }>;
  searchBooks(input: { query: string }): Promise<{ results: BookSearchResult[] }>;
  fileEdition(input: { source: string }): Promise<{
    id: string;
    gutenbergId: string;
    status: string;
  }>;
  listMyLibrary(): Promise<{ entries: LibraryEntry[] }>;
  getMyEdition(input: { id: string }): Promise<Edition>;
  setMyEdition(input: { id: string; markdownContent: string }): Promise<{
    id: string;
    lastEditedAt: number;
  }>;
  withdrawMyEdition(input: { id: string }): Promise<{ deleted: boolean }>;
}>();

export default api;
