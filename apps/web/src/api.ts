export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  roles: string[];
  joinedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

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

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message =
      data && typeof data.error === 'string'
        ? data.error
        : `Request failed with HTTP ${res.status}`;
    throw new ApiError(message, res.status);
  }

  return data as T;
}

const api = {
  // Auth
  sendEmailCode(input: { email: string }): Promise<{ ok: true }> {
    return request('/api/auth/send-code', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  verifyEmailCode(input: { email: string; code: string }): Promise<{ user: PublicUser }> {
    return request('/api/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  logout(): Promise<{ ok: true }> {
    return request('/api/auth/logout', { method: 'POST' });
  },

  me(): Promise<{ user: PublicUser | null }> {
    return request('/api/me');
  },

  // Reader setup
  signUpReader(input: { displayName?: string }): Promise<{
    id: string;
    email: string;
    displayName: string;
    joinedAt?: string;
    joined_at?: number;
    isNewReader: boolean;
  }> {
    return request('/api/sign-up-reader', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // Library / editions
  async listMyLibrary(): Promise<{ entries: LibraryEntry[] }> {
    const data = await request<{
      entries: Array<Omit<LibraryEntry, 'lastEditedAt' | 'createdAt'> & {
        lastEditedAt: string | number | null;
        createdAt: string | number;
      }>
    }>('/api/library');

    return {
      entries: data.entries.map((entry) => ({
        ...entry,
        lastEditedAt: toMs(entry.lastEditedAt),
        createdAt: toMs(entry.createdAt) ?? Date.now(),
      })),
    };
  },

  async getMyEdition(input: { id: string }): Promise<Edition> {
    const data = await request<Omit<Edition, 'lastEditedAt' | 'createdAt' | 'updatedAt'> & {
      lastEditedAt: string | number | null;
      createdAt: string | number;
      updatedAt: string | number;
    }>(`/api/editions/${encodeURIComponent(input.id)}`);

    return {
      ...data,
      lastEditedAt: toMs(data.lastEditedAt),
      createdAt: toMs(data.createdAt) ?? Date.now(),
      updatedAt: toMs(data.updatedAt) ?? Date.now(),
    };
  },

  async setMyEdition(input: { id: string; markdownContent: string }): Promise<{
    id: string;
    lastEditedAt: number;
  }> {
    const data = await request<{ id: string; lastEditedAt: string | number }>(
      `/api/editions/${encodeURIComponent(input.id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ markdownContent: input.markdownContent }),
      },
    );

    return {
      id: data.id,
      lastEditedAt: toMs(data.lastEditedAt) ?? Date.now(),
    };
  },

  withdrawMyEdition(input: { id: string }): Promise<{ deleted: boolean }> {
    return request(`/api/editions/${encodeURIComponent(input.id)}`, {
      method: 'DELETE',
    });
  },

  // Phase 6 placeholder. This route may return 501/404 until Phase 6.
  searchBooks(input: { query: string }): Promise<{ results: BookSearchResult[] }> {
    return request('/api/search-books', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // Development helper from Phase 4.
  devSeedEdition(input: {
    gutenbergId?: string;
    title?: string;
    author?: string;
    markdownContent?: string;
  } = {}): Promise<{ id: string; gutenbergId: string; status: string }> {
    return request('/api/dev/seed-edition', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};

function toMs(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

export default api;