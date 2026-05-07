import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { useNavigate } from '../hooks/useNavigate';
import api, { type LibraryEntry } from '../api';
import {
  formatMastheadDate,
  formatKickerDate,
  relativeTime,
  toRoman,
} from '../util/time';
import { WithdrawBroadside } from '../components/WithdrawBroadside';
import { ColophonLink } from '../components/ColophonLink';
import './LibraryPage.css';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export default function LibraryPage() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const library = useStore((s) => s.library);
  const libraryLoading = useStore((s) => s.libraryLoading);
  const refresh = useStore((s) => s.refreshLibrary);

  // Live clock for the dateline. Updates every minute.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Per-row Withdraw flow. The broadside is rendered once at the
  // page level; each row's WITHDRAW link sets `withdrawing` to that
  // entry, opening the broadside. Confirmation calls the API, clears
  // the saved auto-resume position, then refreshes the library.
  const [withdrawing, setWithdrawing] = useState<LibraryEntry | null>(null);
  const [withdrawWorking, setWithdrawWorking] = useState(false);
  const performWithdraw = async () => {
    if (!withdrawing) return;
    setWithdrawWorking(true);
    try {
      await api.withdrawMyEdition({ id: withdrawing.id });
      try {
        // Clear any auto-resume position for this edition so the slot
        // doesn't linger in localStorage forever.
        localStorage.removeItem(`ilya:read-position:v1:${withdrawing.id}`);
      } catch {
        // Storage unavailable — non-fatal.
      }
      setWithdrawing(null);
      setWithdrawWorking(false);
      await refresh();
    } catch (err) {
      console.error('withdrawMyEdition failed', err);
      setWithdrawWorking(false);
    }
  };

  // Background polling: 3-second interval while any row is in a non-terminal
  // state (i.e. mid-import). Once everything is `ready` or `failed`, we
  // pause polling — saves work and respects the spec's "quiet" disposition.
  useEffect(() => {
    if (!library) return;
    const inFlight = library.some(
      (e) => e.status !== 'ready' && e.status !== 'failed',
    );
    if (!inFlight) return;
    const t = setInterval(() => {
      refresh();
    }, 3000);
    return () => clearInterval(t);
  }, [library, refresh]);

  // Refresh on focus — the user might have come back from filing.
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  // The "NO {sequence}" line. Treats the day the user joined as issue I and
  // counts up. Falls back to the count of editions if joined_at is unknown.
  const issueNumber = useMemo(() => {
    const joined = (user as unknown as { joined_at?: number | null })?.joined_at;
    if (!joined) return toRoman(Math.max(1, library?.length ?? 1));
    const days = Math.max(1, Math.floor((Date.now() - joined) / MS_PER_DAY) + 1);
    return toRoman(days);
  }, [user, library]);

  // Sort the listing: in-flight first (so the reader can watch them arrive),
  // then by last_edited_at desc, then by created_at desc.
  const listing = useMemo(() => sortEntries(library ?? []), [library]);

  // The library is null on first load, so render a quiet "loading" state in
  // place of the listing — italic line, no spinner.
  return (
    <div className="page library-page">
      <div className="library-wrap">
        <Masthead now={now} issueNumber={issueNumber} />

        <div className="library-listing">
          <div className="library-listing-head">
            <span className="t-label">THE LIBRARY</span>
            <button
              type="button"
              className="linklabel"
              onClick={() => navigate('/file')}
            >
              ＋ FILE A NEW EDITION
            </button>
          </div>

          <div className="rule-heavy" />

          {library === null && libraryLoading && (
            <div className="library-loading t-byline">
              <em>opening the library…</em>
            </div>
          )}

          {library && listing.length === 0 && <EmptyShelf />}

          {listing.length > 0 && (
            <div className="library-rows">
              {listing.map((entry, i) => (
                <LibraryRow
                  key={entry.id}
                  entry={entry}
                  index={i}
                  onOpen={() => navigate(`/book/${entry.id}`)}
                  onWithdraw={() => setWithdrawing(entry)}
                />
              ))}
            </div>
          )}
        </div>

        <Colophon onSignOut={async () => {
          await api.logout();
          useStore.getState().setUser(null);
          useStore.getState().clearLibrary();
          navigate('/enter', true);
        }} />
      </div>

      {withdrawing && (
        <WithdrawBroadside
          title={withdrawing.title}
          author={withdrawing.author}
          working={withdrawWorking}
          onCancel={() => {
            if (!withdrawWorking) setWithdrawing(null);
          }}
          onConfirm={performWithdraw}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Masthead
// -----------------------------------------------------------------------------

function Masthead({ now, issueNumber }: { now: Date; issueNumber: string }) {
  return (
    <header className="library-masthead">
      <div className="rule-heavy" />
      <div className="library-masthead-issue">
        <span>VOL. I</span>
        <span>NO. {issueNumber}</span>
      </div>
      <div className="rule-single" />
      <h1 className="library-wordmark">Ilya</h1>
      <div className="rule-single" />
      {/* Dateline. On desktop the date and the italic byline read as
          one line separated by a middot. On mobile the middot hides
          and the byline drops to its own line so neither half gets
          cramped against the viewport edge. */}
      <div className="library-dateline t-folio">
        <span className="library-dateline-date">{formatMastheadDate(now)}</span>
        <span className="library-dateline-sep" aria-hidden="true"> · </span>
        <em className="library-dateline-byline">
          The reader’s private library, set in linen and umber.
        </em>
      </div>
      <div className="rule-heavy" />
    </header>
  );
}

// -----------------------------------------------------------------------------
// One row in the listing
// -----------------------------------------------------------------------------

function LibraryRow({
  entry,
  index,
  onOpen,
  onWithdraw,
}: {
  entry: LibraryEntry;
  index: number;
  onOpen: () => void;
  onWithdraw: () => void;
}) {
  const isReady = entry.status === 'ready';
  const isFailed = entry.status === 'failed';
  const isInFlight = !isReady && !isFailed;

  // The kicker reads either as a date stamp (12 NOV) for ready editions, an
  // italic process line ("setting type…") for in-flight ones, or a brick
  // failure note for failed ones.
  let kickerNode: React.ReactNode;
  if (isReady) {
    kickerNode = (
      <span className="t-kicker">
        {formatKickerDate(entry.lastEditedAt ?? entry.createdAt)}
      </span>
    );
  } else if (isFailed) {
    kickerNode = <span className="t-kicker">THE PRESS HAS STOPPED</span>;
  } else {
    kickerNode = (
      <span className="t-kicker t-kicker--ochre library-kicker-process">
        IN SETTING
      </span>
    );
  }

  // The byline reads as relative-time for ready editions, an italic status
  // message for in-flight, and the failure message for failed.
  let bylineNode: React.ReactNode;
  if (isReady) {
    bylineNode = relativeTime(entry.lastEditedAt ?? entry.createdAt);
  } else if (isFailed) {
    bylineNode = (
      <em className="library-byline-failure">
        {entry.statusMessage ?? 'The fetch did not complete.'}
      </em>
    );
  } else {
    bylineNode = (
      <em>
        {entry.statusMessage ?? statusToCopy(entry.status)}
      </em>
    );
  }

  return (
    <article
      className={`library-row ${isInFlight ? 'is-pending' : ''} ${isFailed ? 'is-failed' : ''}`}
      onClick={isReady ? onOpen : undefined}
      role={isReady ? 'button' : undefined}
      tabIndex={isReady ? 0 : -1}
      onKeyDown={
        isReady
          ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpen();
            }
          }
          : undefined
      }
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="library-row-kicker">{kickerNode}</div>
      <h2 className="library-row-title t-headline">
        {entry.title || 'An untitled edition'}
      </h2>
      <div className="library-row-meta">
        <span className="library-row-author t-byline">
          <em>{entry.author || 'Anonymous'}</em>
        </span>
        <span className="library-row-dot">·</span>
        <span className="library-row-time t-byline">{bylineNode}</span>
      </div>
      {/* Per-row Withdraw affordance. Hidden by default on desktop and
          revealed on row hover (so a row at rest reads cleanly with
          just title + byline). On mobile, always visible but dimmed
          to umber-faint so it reads as tertiary metadata. The button's
          stopPropagation prevents the parent article's onClick (which
          opens the editor) from firing when the user just wanted to
          withdraw. */}
      <button
        type="button"
        className="library-row-withdraw"
        onClick={(e) => {
          e.stopPropagation();
          onWithdraw();
        }}
        onKeyDown={(e) => e.stopPropagation()}
        aria-label={`Withdraw ${entry.title || 'this edition'}`}
        tabIndex={0}
      >
        WITHDRAW
      </button>
      <div className="rule-faint library-row-rule" />
    </article>
  );
}

// -----------------------------------------------------------------------------
// Empty shelf
// -----------------------------------------------------------------------------

function EmptyShelf() {
  const navigate = useNavigate();
  return (
    <div className="library-empty">
      <div className="library-empty-ornament" aria-hidden="true">
        ※
      </div>
      <h2 className="t-display library-empty-headline">An empty shelf.</h2>
      <p className="t-body t-body-italic library-empty-body">
        File a public-domain edition to begin.
      </p>
      {/* Three-line invitation that quietly teaches the smart input's
          three modes without being a tutorial. Set in italic IM Fell
          beneath the headline, separated by a thin centred rule so
          the eye reads it as guidance rather than copy. */}
      <div className="library-empty-rule" />
      <ul className="library-empty-modes">
        <li>
          <em>Search for any title or author</em>
        </li>
        <li>
          <em>Paste a Project Gutenberg link</em>
        </li>
        <li>
          <em>Or type a Gutenberg ebook number</em>
        </li>
      </ul>
      <div className="library-empty-cta">
        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate('/file')}
        >
          FILE THE FIRST EDITION
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Colophon (footer)
// -----------------------------------------------------------------------------

function Colophon({ onSignOut }: { onSignOut: () => void }) {
  return (
    <footer className="library-colophon">
      <div className="library-colophon-rule" />
      <div className="library-colophon-line t-caption t-caption--italic">
        Set in Cormorant Garamond and IM Fell English.
        <br />
        Texts drawn from Project Gutenberg, kept private to you.
      </div>
      <div className="library-colophon-actions">
        <ColophonLink />
        <button
          type="button"
          className="linklabel library-signout"
          onClick={onSignOut}
        >
          SIGN OUT
        </button>
      </div>
    </footer>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function statusToCopy(status: string): string {
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

function sortEntries(entries: LibraryEntry[]): LibraryEntry[] {
  return [...entries].sort((a, b) => {
    const aFlight = a.status !== 'ready' && a.status !== 'failed';
    const bFlight = b.status !== 'ready' && b.status !== 'failed';
    if (aFlight && !bFlight) return -1;
    if (!aFlight && bFlight) return 1;
    const aTime = a.lastEditedAt ?? a.createdAt;
    const bTime = b.lastEditedAt ?? b.createdAt;
    return bTime - aTime;
  });
}
