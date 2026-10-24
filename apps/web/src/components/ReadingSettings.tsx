import { useEffect, useId, useRef, useState } from 'react';
import { READING_WIDTHS, type useReadingSettings } from '../hooks/useReadingSettings';
import './ReadingSettings.css';

export function ReadingSettings({ settings }: { settings: ReturnType<typeof useReadingSettings> }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { preferences, fontSize, update } = settings;

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('.reading-settings-panel button:not(:disabled)')?.focus();
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="reading-settings" ref={root}>
      <button ref={trigger} type="button" className="reading-settings-trigger"
        aria-label="Reading settings" aria-expanded={open} aria-controls={panelId}
        aria-haspopup="dialog" title="SETTINGS" onClick={() => setOpen(!open)}>
        Aa
      </button>
      {open && (
        <div id={panelId} className="reading-settings-panel" role="dialog" aria-label="Reading settings">
          <div className="t-kicker reading-settings-heading">SETTINGS</div>
          <SettingRow label="Font size" value={`${fontSize} px`}
            atMin={fontSize === 14} atMax={fontSize === 24}
            decrease={() => update({ fontSize: Math.max(14, fontSize - 2) })}
            increase={() => update({ fontSize: Math.min(24, fontSize + 2) })} />
          <SettingRow label="Line width" value={READING_WIDTHS[preferences.width]}
            atMin={preferences.width === 0} atMax={preferences.width === 3}
            decrease={() => update({ width: Math.max(0, preferences.width - 1) })}
            increase={() => update({ width: Math.min(3, preferences.width + 1) })} />
          <SettingRow label="Background (lighter)" value={`${preferences.background}%`}
            atMin={preferences.background === 60} atMax={preferences.background === 100}
            decrease={() => update({ background: Math.max(60, preferences.background - 10) })}
            increase={() => update({ background: Math.min(100, preferences.background + 10) })} />
        </div>
      )}
    </div>
  );
}

function SettingRow({ label, value, atMin, atMax, decrease, increase }: {
  label: string; value: string; atMin: boolean; atMax: boolean;
  decrease: () => void; increase: () => void;
}) {
  return (
    <div className="reading-setting-row" role="group" aria-label={label}>
      <span className="reading-setting-label">{label}</span>
      <div className="reading-setting-controls">
        <button type="button" aria-label={`Decrease ${label.toLowerCase()}`} disabled={atMin} onClick={decrease}>−</button>
        <span className="reading-setting-value" aria-live="polite" aria-atomic="true">{value}</span>
        <button type="button" aria-label={`Increase ${label.toLowerCase()}`} disabled={atMax} onClick={increase}>+</button>
      </div>
    </div>
  );
}
