import { create } from 'zustand';
import api, { type LibraryEntry, type PublicUser } from './api';

interface AppStore {
  user: PublicUser | null;
  authReady: boolean;
  library: LibraryEntry[] | null;
  libraryLoading: boolean;
  setUser: (u: PublicUser | null) => void;
  loadMe: () => Promise<void>;
  refreshLibrary: () => Promise<void>;
  clearLibrary: () => void;
}

export const useStore = create<AppStore>((set, get) => ({
  user: null,
  authReady: false,
  library: null,
  libraryLoading: false,

  setUser: (u) => set({ user: u, authReady: true }),

  loadMe: async () => {
    try {
      const { user } = await api.me();
      set({ user, authReady: true });
      if (user) {
        await get().refreshLibrary();
      } else {
        get().clearLibrary();
      }
    } catch (err) {
      console.error('loadMe failed', err);
      set({ user: null, authReady: true });
      get().clearLibrary();
    }
  },

  refreshLibrary: async () => {
    if (!get().user) return;

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