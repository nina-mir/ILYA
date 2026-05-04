import { useState, useEffect, useRef, useCallback } from 'react';
import useSWR from 'swr';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from '@tiptap/markdown';
import api, { type Edition } from '../api';
import { computeSlug } from '../util/slug';
import { WithdrawBroadside } from '../components/WithdrawBroadside';
import { useNavigate } from '../hooks/useNavigate';
import { useStore } from '../store';
import { formatClock, relativeTime } from '../util/time';
import './EditorPage.css';

const AUTOSAVE_DEBOUNCE_MS = 2000;
const POLL_INTERVAL_MS = 1500;

type SaveState =
  | { kind: 'idle' }
  | { kind: 'pending' }    // edits made, save scheduled
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

interface EditorPageProps {
  id: string;
}

// One heading row in the Chapter Navigation drawer. Walked live from
// the editor's rendered DOM whenever the document changes.
//
// `domIndex` is the heading's zero-based position among ALL h1/h2/h3/h4
// elements inside the editor's content root, in document order. We use
// this rather than a CSS `id` attribute because ProseMirror manages the
// editor's DOM and id attributes set from outside its schema are
// fragile — sometimes reverted, sometimes simply not findable via
// `document.getElementById` even when present in the rendered HTML. A
// fresh `querySelectorAll` at click time, indexed by `domIndex`,
// always finds the right element.
interface HeadingEntry {
  id: string;        // slug for auto-resume; not used by the drawer
  domIndex: number;  // position among h1/h2/h3/h4 in editor content
  depth: number;     // 2 for chapter (h2), 3 for subsection (h3), etc.
  text: string;      // visible label
}

export default function EditorPage({ id }: EditorPageProps) {
  const navigate = useNavigate();
  const refreshLibrary = useStore((s) => s.refreshLibrary);

  // Use SWR for the initial fetch and as the cache key for the polling
  // refresh. While the edition isn't `ready`, we revalidate every 1.5s; once
  // it's ready, polling stops.
  const { data: edition, mutate, error } = useSWR<Edition>(
    id ? ['edition', id] : null,
    () => api.getMyEdition({ id }),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  // Polling effect — only while non-terminal status.
  useEffect(() => {
    if (!edition) return;
    if (edition.status === 'ready' || edition.status === 'failed') return;
    const t = setInterval(() => {
      mutate();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [edition, mutate]);

  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const [showWithdraw, setShowWithdraw] = useState(false);
  // Chapter Navigation drawer state. `headings` is rebuilt live from
  // the rendered DOM whenever the document changes; `showContents`
  // toggles the drawer overlay.
  const [headings, setHeadings] = useState<HeadingEntry[]>([]);
  const [showContents, setShowContents] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  // Tracks whether the user has actually edited (vs. the initial setContent).
  const dirtyRef = useRef(false);
  // The auto-save debounce timer.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Used by the save fn to avoid stale closure on `id`.
  const idRef = useRef(id);
  idRef.current = id;
  // Set to true when the edition is being withdrawn — suppresses the
  // auto-resume unmount-flush so we don't write back a position for the
  // edition we just deleted.
  const withdrawnRef = useRef(false);
  // Auto-resume coordination:
  //   hasResumedRef — set true after the restore phase completes (with
  //     or without a saved position). Save handlers gate on this so an
  //     in-progress restore can't be overwritten by an interim scroll.
  //   The effect below is a one-shot: deps include `id`, but we use
  //     the ref to short-circuit on subsequent re-runs caused by
  //     polling-driven `edition` updates.
  const hasResumedRef = useRef(false);

  // ---------- Auto-save flow ----------
  const performSave = useCallback(
    async (markdown: string) => {
      setSaveState({ kind: 'saving' });
      try {
        const { lastEditedAt } = await api.setMyEdition({
          id: idRef.current,
          markdownContent: markdown,
        });
        setSaveState({ kind: 'saved', at: lastEditedAt });
        // Quietly nudge the SWR cache and the global library so the row in
        // the listing re-sorts to the top with the fresh time.
        mutate();
        refreshLibrary();
      } catch (err) {
        console.error('setMyEdition failed', err);
        const message =
          err instanceof Error
            ? err.message
            : 'The save did not complete. Try again in a moment.';
        setSaveState({ kind: 'error', message });
      }
    },
    [mutate, refreshLibrary],
  );

  // ---------- Tiptap editor ----------
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          // Horizontal rules are re-enabled in this build because the
          // text-import pipeline emits `---` between chapters (rendered
          // by editor.css as a centred three-dot ornament).
          //
          // StarterKit v3 includes the Link extension by default. We
          // configure it here rather than registering a second standalone
          // Link — registering twice triggers Tiptap's "Duplicate
          // extension" warning AND causes StarterKit's default
          // `openOnClick: true` to override our config, which means
          // ProseMirror calls `window.open()` on every link click,
          // opening a new tab. With `openOnClick: false` configured
          // here, the click stays in the page and our document-level
          // capture-phase handler does the smooth-scroll.
          link: {
            openOnClick: false,
            autolink: true,
            HTMLAttributes: { class: 'editor-link' },
          },
        }),
        Placeholder.configure({
          placeholder: 'Begin marking up the text…',
        }),
        Markdown,
      ],
      editorProps: {
        attributes: {
          class: 'editor-content',
          spellcheck: 'false',
        },
      },
      onUpdate({ editor }) {
        if (!dirtyRef.current) {
          // Initial setContent fires onUpdate too — ignore until we've seen
          // a real user-edit transaction.
          return;
        }
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        setSaveState({ kind: 'pending' });
        const md = editor.storage.markdown.manager.serialize(editor.getJSON());
        saveTimerRef.current = setTimeout(() => {
          performSave(md);
        }, AUTOSAVE_DEBOUNCE_MS);
      },
      onTransaction({ transaction }) {
        // Mark dirty when any document-changing transaction comes from the
        // user (after the initial setContent which uses transaction.docChanged
        // before our gate flips on).
        if (transaction.docChanged && transaction.getMeta('addToHistory') !== false) {
          // The setContent we issue programmatically also produces a
          // doc-changed transaction. We instead set dirtyRef explicitly
          // after the initial load completes (see effect below).
        }
      },
    },
    // Recreate the editor only when the edition id changes — not on every
    // poll-driven mutate.
    [id],
  );

  // Push the markdown into the editor once it's ready, then arm the dirty
  // flag for subsequent edits.
  useEffect(() => {
    if (!editor) return;
    if (!edition || edition.status !== 'ready') return;
    // Only set when the loaded markdown is newer than what's in the editor,
    // i.e. on first load. Subsequent polls won't clobber in-progress edits.
    const current = editor.storage.markdown.manager.serialize(editor.getJSON());
    if (current.trim() === (edition.markdownContent ?? '').trim()) {
      dirtyRef.current = true;
      return;
    }
    if (dirtyRef.current) {
      // We've already started editing locally — don't overwrite.
      return;
    }
    editor.commands.setContent(edition.markdownContent || '', {
      contentType: 'markdown',
      emitUpdate: false,
    });
    // Arm the dirty flag on next tick so the setContent's transaction
    // doesn't trigger an immediate save.
    setTimeout(() => {
      dirtyRef.current = true;
    }, 0);
  }, [editor, edition]);

  // After the doc renders, walk the headings, assign deterministic IDs,
  // and publish the heading list to React state so the Chapter
  // Navigation drawer can render it and scroll on click.
  //
  // Each heading entry carries: id, depth (h2 → 2, h3 → 3), and the
  // visible text. The drawer renders an indented outline based on
  // depth and calls `scrollIntoView` on the matching DOM node when an
  // entry is tapped.
  useEffect(() => {
    if (!editor || !edition || edition.status !== 'ready') return;
    const root = editor.view.dom as HTMLElement;

    const refresh = () => {
      const seen = new Map<string, number>();
      const next: HeadingEntry[] = [];
      const nodes = root.querySelectorAll('h1, h2, h3, h4');
      nodes.forEach((node, domIndex) => {
        const el = node as HTMLElement;
        const text = (el.textContent ?? '').trim();
        if (!text) return;
        const base = computeSlug(text);
        if (!base) return;
        const count = seen.get(base) ?? 0;
        const id = count === 0 ? base : `${base}-${count + 1}`;
        seen.set(base, count + 1);
        // Best-effort id assignment for auto-resume's heading hint;
        // the drawer's click handler does NOT depend on this surviving.
        if (el.id !== id) el.id = id;
        const depth = parseInt(el.tagName.slice(1), 10);
        next.push({ id, domIndex, depth, text });
      });
      setHeadings(next);
    };

    // First pass after a frame so ProseMirror's setContent has committed.
    const frame = requestAnimationFrame(refresh);

    // setContent uses emitUpdate:false on initial load, so the editor's
    // `update` event won't fire after content lands. A MutationObserver
    // catches the DOM-level commit AND any later edits that add/remove
    // headings, debounced so a burst of changes doesn't thrash state.
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(refresh, 50);
    });
    observer.observe(root, { childList: true, subtree: true });

    const handleUpdate = () => refresh();
    editor.on('update', handleUpdate);

    return () => {
      cancelAnimationFrame(frame);
      if (debounceTimer) clearTimeout(debounceTimer);
      observer.disconnect();
      editor.off('update', handleUpdate);
    };
  }, [editor, edition]);

  // ---------- Auto-resume reading position ----------
  //
  // The editor remembers where the reader was in every edition they've
  // opened, and brings them back there when they return.
  //
  // Implementation notes worth knowing about:
  //
  //   • Restore is a one-shot per id. The effect's deps include
  //     `edition`, which can churn during polling. `hasResumedRef`
  //     ensures we only restore once and don't re-snap the reader to
  //     a stale saved position after they've started reading.
  //
  //   • Restore waits for two animation frames + a small timeout
  //     before reading layout. ProseMirror finishes laying out the
  //     incoming markdown across at least two frames, and
  //     `getBoundingClientRect()` returns 0 for nodes that haven't
  //     been measured yet. Restoring inside a microtask
  //     (`Promise.resolve().then(...)`) was firing before layout had
  //     happened in practice — which silently put us at scrollY=0.
  //
  //   • Save fires on scroll-pause (debounced 800ms), on visibility
  //     change to hidden, and on `pagehide` — the latter two cover
  //     mobile tab-switching where `beforeunload` is unreliable.
  //
  //   • Console output is intentionally chatty during the
  //     stabilization window. Once we trust the feature, we can quiet
  //     these logs down.
  useEffect(() => {
    if (!editor || !edition || edition.status !== 'ready') return;
    if (hasResumedRef.current) return;

    const root = editor.view.dom as HTMLElement;
    const storageKey = `ilya:read-position:v1:${id}`;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let frame1 = 0;
    let frame2 = 0;
    let layoutTimer: ReturnType<typeof setTimeout> | null = null;

    // The latest position observed during this mount. Updated
    // synchronously on every scroll event, then debounced into
    // localStorage. The unmount cleanup writes THIS cached value
    // rather than reading `window.scrollY` at unmount time — by
    // then the route has already changed and the document is
    // shorter, so the live scrollY is clamped to a small number
    // unrelated to where the reader actually was.
    let lastObserved: { headingId: string | null; scrollY: number } | null = null;

    const findTopHeadingId = (): string | null => {
      const headings = root.querySelectorAll<HTMLElement>('h1, h2, h3');
      let candidate: string | null = null;
      for (const h of Array.from(headings)) {
        const top = h.getBoundingClientRect().top;
        if (top > 100) break;
        if (h.id) candidate = h.id;
      }
      return candidate;
    };

    // Capture the current scroll position to the in-mount cache.
    // Cheap; called on every scroll event.
    const observe = () => {
      lastObserved = {
        headingId: findTopHeadingId(),
        scrollY: window.scrollY,
      };
    };

    const save = () => {
      try {
        const data = lastObserved
          ? { ...lastObserved, savedAt: Date.now() }
          : {
              headingId: findTopHeadingId(),
              scrollY: window.scrollY,
              savedAt: Date.now(),
            };
        localStorage.setItem(storageKey, JSON.stringify(data));
        console.log('[ilya/auto-resume] saved', data);
      } catch (err) {
        console.warn('[ilya/auto-resume] save failed', err);
      }
    };

    const restore = () => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
          console.log('[ilya/auto-resume] no saved position for', id);
          return;
        }
        const saved = JSON.parse(raw) as {
          headingId?: string;
          scrollY?: number;
        };
        if (saved.headingId) {
          const el =
            (root.querySelector(`#${CSS.escape(saved.headingId)}`) as HTMLElement | null) ||
            document.getElementById(saved.headingId);
          if (el) {
            const top = el.getBoundingClientRect().top + window.scrollY - 80;
            console.log('[ilya/auto-resume] restoring to heading', saved.headingId, '→', top);
            window.scrollTo(0, Math.max(0, top));
            return;
          }
          console.log(
            '[ilya/auto-resume] heading id not found, falling through to scrollY',
            saved.headingId,
          );
        }
        if (typeof saved.scrollY === 'number') {
          console.log('[ilya/auto-resume] restoring to scrollY', saved.scrollY);
          window.scrollTo(0, Math.max(0, saved.scrollY));
        }
      } catch (err) {
        console.warn('[ilya/auto-resume] restore failed', err);
      }
    };

    // Wait for two animation frames + a small timeout to make sure
    // the editor's content has finished laying out before we measure.
    frame1 = requestAnimationFrame(() => {
      if (cancelled) return;
      frame2 = requestAnimationFrame(() => {
        if (cancelled) return;
        layoutTimer = setTimeout(() => {
          if (cancelled) return;
          restore();
          hasResumedRef.current = true;
        }, 80);
      });
    });

    // Save handlers. They check `hasResumedRef` so a scroll fired
    // during restore can't overwrite the saved position before the
    // restore lands.
    const onScroll = () => {
      if (!hasResumedRef.current) return;
      // Update the in-mount cache immediately (cheap, synchronous);
      // commit-to-localStorage is debounced.
      observe();
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 800);
    };
    const onPageHide = () => {
      if (hasResumedRef.current) save();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && hasResumedRef.current) save();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      if (frame1) cancelAnimationFrame(frame1);
      if (frame2) cancelAnimationFrame(frame2);
      if (layoutTimer) clearTimeout(layoutTimer);
      if (saveTimer) clearTimeout(saveTimer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      // Final flush on unmount, so navigating back to the library
      // captures the latest position. Skip if the edition was
      // withdrawn or if we never finished restoring. The flush uses
      // the in-mount cache, NOT the live `window.scrollY` — by the
      // time this cleanup fires, the route has already changed and
      // `window.scrollY` no longer reflects where the reader was in
      // the editor.
      if (hasResumedRef.current && !withdrawnRef.current && lastObserved) {
        try {
          const data = { ...lastObserved, savedAt: Date.now() };
          localStorage.setItem(storageKey, JSON.stringify(data));
          console.log('[ilya/auto-resume] flushed on unmount', data);
        } catch (err) {
          console.warn('[ilya/auto-resume] flush-on-unmount failed', err);
        }
      }
    };
  }, [editor, edition, id]);

  // When the user navigates between editions, reset the resume
  // one-shot flag so the new edition gets its own restore pass.
  useEffect(() => {
    hasResumedRef.current = false;
  }, [id]);

  // Beforeunload guard: warn if there's unsaved work in flight.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveState.kind === 'pending' || saveState.kind === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saveState.kind]);

  // Cleanup the save timer on unmount.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // ---------- Withdraw flow ----------
  const performWithdraw = async () => {
    setWithdrawing(true);
    try {
      await api.withdrawMyEdition({ id });
      // Mark withdrawn before navigating so the auto-resume cleanup
      // skips its unmount-flush, then clear any stored position.
      withdrawnRef.current = true;
      try {
        localStorage.removeItem(`ilya:read-position:v1:${id}`);
      } catch {
        // ignore
      }
      await refreshLibrary();
      navigate('/', true);
    } catch (err) {
      console.error('withdrawMyEdition failed', err);
      setWithdrawing(false);
    }
  };

  // ---------- Render branches ----------
  if (error) {
    return (
      <div className="page editor-page">
        <div className="editor-error t-byline">
          <em>That edition was not found in your library.</em>
          <button
            type="button"
            className="linklabel"
            onClick={() => navigate('/')}
            style={{ marginTop: 16 }}
          >
            ← THE LIBRARY
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page editor-page">
      <EditorChrome
        edition={edition}
        saveState={saveState}
        hasContents={headings.length > 0}
        onBack={() => navigate('/')}
        onOpenContents={() => setShowContents(true)}
        onWithdraw={() => setShowWithdraw(true)}
      />

      <div className="editor-shell">
        {/* Header — title and author, set in display type */}
        {edition && (
          <header className="editor-frontmatter">
            <h1 className="editor-title">
              {edition.title || 'An untitled edition'}
            </h1>
            {edition.author && (
              <div className="editor-byline t-byline">
                <em>by</em> {edition.author}
              </div>
            )}
            <div className="editor-frontmatter-rule" />
          </header>
        )}

        {edition && edition.status !== 'ready' && (
          <ProcessingPanel edition={edition} />
        )}

        {edition && edition.status === 'ready' && (
          <div className="editor-page-area">
            <EditorContent editor={editor} />
            {editor && (
              <BubbleMenu editor={editor} className="editor-bubble">
                <ToolbarButton
                  active={editor.isActive('bold')}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  label="Bold"
                  glyph={<span style={{ fontWeight: 700 }}>B</span>}
                />
                <ToolbarButton
                  active={editor.isActive('italic')}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  label="Italic"
                  glyph={<span style={{ fontStyle: 'italic' }}>I</span>}
                />
                <div className="editor-bubble-divider" />
                <ToolbarButton
                  active={editor.isActive('heading', { level: 2 })}
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 2 }).run()
                  }
                  label="Chapter heading"
                  glyph={<span className="bubble-glyph-h">H</span>}
                />
                <ToolbarButton
                  active={editor.isActive('blockquote')}
                  onClick={() => editor.chain().focus().toggleBlockquote().run()}
                  label="Blockquote"
                  glyph={<span className="bubble-glyph-q">"</span>}
                />
                <div className="editor-bubble-divider" />
                <ToolbarButton
                  active={editor.isActive('link')}
                  onClick={() => {
                    const prev = editor.getAttributes('link').href as string | undefined;
                    const url = window.prompt('Address of the link', prev ?? '');
                    if (url === null) return;
                    if (url === '') {
                      editor.chain().focus().extendMarkRange('link').unsetLink().run();
                      return;
                    }
                    editor
                      .chain()
                      .focus()
                      .extendMarkRange('link')
                      .setLink({ href: url })
                      .run();
                  }}
                  label="Link"
                  glyph={<span style={{ textDecoration: 'underline' }}>a</span>}
                />
              </BubbleMenu>
            )}
          </div>
        )}

        {edition && (
          <footer className="editor-foot">
            <div className="editor-foot-rule" />
            <div className="t-folio editor-foot-meta">
              <em>Project Gutenberg ebook № {edition.gutenbergId}</em>
              {edition.lastEditedAt && (
                <>
                  <span className="editor-foot-dot">·</span>
                  <em>last marked up {relativeTime(edition.lastEditedAt)}</em>
                </>
              )}
            </div>
          </footer>
        )}
      </div>

      {showWithdraw && edition && (
        <WithdrawBroadside
          title={edition.title}
          author={edition.author}
          working={withdrawing}
          onCancel={() => setShowWithdraw(false)}
          onConfirm={performWithdraw}
        />
      )}

      {showContents && (
        <ChapterDrawer
          headings={headings}
          canWithdraw={!!edition && edition.status === 'ready'}
          onClose={() => setShowContents(false)}
          onRequestWithdraw={() => {
            // Close the drawer first so the broadside opens against
            // a clean background, not on top of the drawer's overlay.
            setShowContents(false);
            setShowWithdraw(true);
          }}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Top chrome — back link, save indicator, withdraw button
// -----------------------------------------------------------------------------

function EditorChrome({
  edition,
  saveState,
  hasContents,
  onBack,
  onOpenContents,
  onWithdraw,
}: {
  edition: Edition | undefined;
  saveState: SaveState;
  hasContents: boolean;
  onBack: () => void;
  onOpenContents: () => void;
  onWithdraw: () => void;
}) {
  const canWithdraw = !!edition && edition.status === 'ready';
  return (
    <div className="editor-chrome">
      <div className="editor-chrome-row">
        {/* Left cluster: back + contents. The "THE LIBRARY" words are
            wrapped in a span hidden by CSS on narrow screens so the
            chrome stays compact on mobile while the desktop label
            keeps the full editorial phrasing. */}
        <div className="editor-chrome-left">
          <button
            type="button"
            className="linklabel editor-back-btn"
            onClick={onBack}
            aria-label="Back to the library"
          >
            <span aria-hidden="true">←</span>
            <span className="editor-back-text"> THE LIBRARY</span>
          </button>
          {hasContents && edition?.status === 'ready' && (
            <button
              type="button"
              className="linklabel editor-contents-btn"
              onClick={onOpenContents}
              aria-label="Open Chapter Navigation"
            >
              CONTENTS
            </button>
          )}
        </div>

        <SaveIndicator state={saveState} />

        {/* Withdraw lives in the desktop chrome AND in the Chapter
            Navigation drawer footer. The chrome copy is hidden below
            600px (where the drawer footer is the canonical place);
            on desktop, both are reachable. The reader gets the same
            broadside no matter which entry point they use. */}
        <button
          type="button"
          className="linklabel editor-withdraw-link"
          onClick={onWithdraw}
          disabled={!canWithdraw}
          aria-label="Withdraw this edition"
        >
          WITHDRAW
        </button>
      </div>
      <div className="rule-faint" />
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  let label: React.ReactNode;
  let cls = '';
  switch (state.kind) {
    case 'idle':
      label = '';
      break;
    case 'pending':
      label = <em>marking up…</em>;
      cls = 'is-pending';
      break;
    case 'saving':
      label = <em>filing…</em>;
      cls = 'is-saving';
      break;
    case 'saved':
      label = (
        <>
          <span>FILED</span>
          <span className="editor-save-dash">—</span>
          <em>at {formatClock(state.at)}</em>
        </>
      );
      cls = 'is-saved';
      break;
    case 'error':
      label = <em>{state.message}</em>;
      cls = 'is-error';
      break;
  }
  return (
    <div className={`editor-save ${cls}`} aria-live="polite">
      {label}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Toolbar button (used inside BubbleMenu)
// -----------------------------------------------------------------------------

function ToolbarButton({
  active,
  onClick,
  label,
  glyph,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  glyph: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`editor-bubble-btn ${active ? 'is-active' : ''}`}
      aria-label={label}
      title={label}
    >
      {glyph}
    </button>
  );
}

// -----------------------------------------------------------------------------
// Processing panel — shown while the import pipeline is still running
// -----------------------------------------------------------------------------

function ProcessingPanel({ edition }: { edition: Edition }) {
  const isFailed = edition.status === 'failed';
  return (
    <div className={`editor-processing ${isFailed ? 'is-failed' : ''}`}>
      <div className="editor-processing-ornament" aria-hidden="true">
        ※
      </div>
      <div className="t-kicker editor-processing-kicker">
        {isFailed ? 'THE PRESS HAS STOPPED' : 'IN SETTING'}
      </div>
      <div className="t-display editor-processing-headline">
        <em>
          {isFailed
            ? 'This edition could not be filed.'
            : 'This edition is being prepared.'}
        </em>
      </div>
      <div className="t-byline editor-processing-line">
        <em>
          {edition.statusMessage ??
            (isFailed
              ? 'The fetch did not complete.'
              : statusToHumanCopy(edition.status))}
        </em>
      </div>
    </div>
  );
}

function statusToHumanCopy(status: string): string {
  switch (status) {
    case 'pending':
      return 'filing has begun…';
    case 'fetching_metadata':
      return 'consulting the catalogue…';
    case 'fetching_text':
      return 'fetching the edition…';
    case 'processing':
      return 'setting type…';
    default:
      return 'in setting…';
  }
}

// -----------------------------------------------------------------------------
// The withdraw broadside (modal styled as a printed notice)
// -----------------------------------------------------------------------------

// `WithdrawBroadside` lives in components/ now — both the editor and
// the library page render it.

// -----------------------------------------------------------------------------
// Chapter Navigation drawer
// -----------------------------------------------------------------------------
//
// Slides in from the right edge over the editor. Lists every heading
// found in the rendered document, indented by depth. Tapping an entry
// closes the drawer and smooth-scrolls the page to that heading.
//
// Lives outside the editor's contenteditable surface, so click handling
// is straightforward — no ProseMirror or contenteditable interference.

function ChapterDrawer({
  headings,
  canWithdraw,
  onClose,
  onRequestWithdraw,
}: {
  headings: HeadingEntry[];
  canWithdraw: boolean;
  onClose: () => void;
  onRequestWithdraw: () => void;
}) {
  // Esc dismisses.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Lock body scroll while open so the page underneath doesn't drift.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const goTo = (entry: HeadingEntry) => {
    // Resolve the live element by walking the editor's DOM fresh and
    // indexing into the result. This sidesteps `document.getElementById`,
    // which has been flaky for ids set on ProseMirror-managed nodes.
    //
    // Lookup order:
    //   1. domIndex into the live `.editor-content` heading list.
    //      Stable as long as the document hasn't been edited since
    //      the drawer opened.
    //   2. Text-match fallback. Robust to a few headings being
    //      added/removed between open and click — finds the first
    //      heading whose visible text matches.
    const editorRoot = document.querySelector('.editor-content');
    let target: HTMLElement | null = null;
    if (editorRoot) {
      const liveHeadings = editorRoot.querySelectorAll<HTMLElement>(
        'h1, h2, h3, h4',
      );
      target = liveHeadings[entry.domIndex] ?? null;
      if (!target || (target.textContent ?? '').trim() !== entry.text) {
        // domIndex was stale (or never matched). Fall back to text.
        target = Array.from(liveHeadings).find(
          (h) => (h.textContent ?? '').trim() === entry.text,
        ) ?? null;
      }
    }

    onClose();
    if (!target) {
      console.warn('[ilya/drawer] no live element matched', entry);
      return;
    }
    // Two frames so the body-scroll lock has actually released.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        target!.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };

  return (
    <div className="chapter-drawer-overlay" onClick={onClose}>
      <aside
        className="chapter-drawer"
        role="dialog"
        aria-label="Chapter Navigation"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="chapter-drawer-head">
          <span className="t-label">CONTENTS</span>
          <button
            type="button"
            className="linklabel chapter-drawer-close"
            onClick={onClose}
            aria-label="Close"
          >
            × CLOSE
          </button>
        </header>
        <div className="rule-single" />

        <nav className="chapter-drawer-list">
          {headings.length === 0 && (
            <div className="chapter-drawer-empty t-byline">
              <em>No chapters detected.</em>
            </div>
          )}
          {headings.map((h) => (
            <button
              key={`${h.domIndex}:${h.id}`}
              type="button"
              onClick={() => goTo(h)}
              className={`chapter-drawer-item depth-${Math.min(h.depth, 4)}`}
            >
              {h.text}
            </button>
          ))}
        </nav>

        {/* Footer. Houses the "withdraw this edition" affordance —
            relocated from the editor's top chrome where it was
            crowding the save indicator, especially on mobile.
            Italic Caption type, set apart by a hairline rule above,
            so it reads as a quiet tertiary action rather than
            competing with the chapter list. */}
        {canWithdraw && (
          <footer className="chapter-drawer-foot">
            <div className="rule-faint" />
            <button
              type="button"
              className="chapter-drawer-withdraw"
              onClick={onRequestWithdraw}
            >
              <em>Withdraw this edition…</em>
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}
