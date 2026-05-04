import { create } from 'zustand';
import { auth, type AppUser } from '@mindstudio-ai/interface';
import api, { type LibraryEntry } from './api';

interface AppStore {
  user: AppUser | null;
  authReady: boolean;
  library: LibraryEntry[] | null;
  libraryLoading: boolean;
  setUser: (u: AppUser | null) => void;
  refreshLibrary: () => Promise<void>;
  clearLibrary: () => void;
}

export const useStore = create<AppStore>((set, get) => ({
  user: null,
  authReady: false,
  library: null,
  libraryLoading: false,

  setUser: (u) => set({ user: u, authReady: true }),

  refreshLibrary: async () => {
    if (!get().user) return;
    // Only show the loading state on first fetch — refreshes happen in the
    // background and shouldn't blank out an already-rendered library.
    const isFirst = get().library === null;
    if (isFirst) set({ libraryLoading: true });
    try {
      const { entries } = await api.listMyLibrary();
      set({ library: entries, libraryLoading: false });
    } catch (err) {
      console.error('refreshLibrary failed', err);
      set({ libraryLoading: false });
    }
  },

  clearLibrary: () => set({ library: null }),
}));

// Subscribe to auth state changes once at module load. The unsubscribe is
// intentionally not stored — this lives for the lifetime of the SPA.
auth.onAuthStateChanged((user) => {
  const prev = useStore.getState().user;
  useStore.getState().setUser(user);
  if (user) {
    if (prev?.id !== user.id) {
      // Different user (or first time) — clear stale library and refetch.
      useStore.getState().clearLibrary();
    }
    useStore.getState().refreshLibrary();
  } else {
    useStore.getState().clearLibrary();
  }
});
