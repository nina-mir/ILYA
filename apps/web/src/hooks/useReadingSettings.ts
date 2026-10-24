import { useEffect, useState, type CSSProperties } from 'react';

export const READING_WIDTHS = ['Narrow', 'Medium', 'Wide', 'Full'] as const;
export interface ReadingPreferences {
  fontSize: number | null;
  width: number;
  background: number;
}

const defaults: ReadingPreferences = { fontSize: null, width: 1, background: 100 };
const storageKey = (readerId: string) => `ilya:reading-settings:v1:${readerId}`;
const validFontSize = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 14 && value <= 24 && value % 2 === 0;

function readPreferences(readerId: string | undefined): ReadingPreferences {
  if (!readerId) return defaults;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(readerId)) ?? 'null');
    return {
      fontSize: validFontSize(saved?.fontSize) ? saved.fontSize : null,
      width: Number.isInteger(saved?.width) && saved.width >= 0 && saved.width <= 3 ? saved.width : 1,
      background: Number.isInteger(saved?.background) && saved.background >= 60 && saved.background <= 100 && saved.background % 10 === 0 ? saved.background : 100,
    };
  } catch {
    return defaults;
  }
}

export function useReadingSettings(readerId: string | undefined) {
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  const [saved, setSaved] = useState(() => ({ readerId, preferences: readPreferences(readerId) }));
  const preferences = saved.readerId === readerId ? saved.preferences : readPreferences(readerId);

  useEffect(() => {
    setSaved({ readerId, preferences: readPreferences(readerId) });
  }, [readerId]);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 900px)');
    const onChange = () => setDesktop(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const fontSize = preferences.fontSize ?? (desktop ? 16 : 18);
  function update(change: Partial<ReadingPreferences>) {
    const next = { ...preferences, ...change };
    setSaved({ readerId, preferences: next });
    if (readerId) {
      try {
        localStorage.setItem(storageKey(readerId), JSON.stringify(next));
      } catch {
        // Reading controls still work when browser storage is unavailable.
      }
    }
  }

  const style = {
    '--reading-font-size': `${fontSize}px`,
    '--reading-width': ['560px', '720px', '1000px', '90vw'][preferences.width],
    '--reading-paper': `color-mix(in srgb, var(--linen) ${preferences.background}%, white)`,
  } as CSSProperties;

  return { preferences, fontSize, update, style };
}
