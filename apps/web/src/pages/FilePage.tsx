import { useState, useEffect, useMemo, useRef } from 'react';
import api, { type BookSearchResult } from '../api';
import { useNavigate } from '../hooks/useNavigate';
import { useStore } from '../store';
import { classifyInput } from '../util/gutenberg';
import './FilePage.css';

const SEARCH_DEBOUNCE_MS = 350;

export default function FilePage() {
  const navigate = useNavigate();
  const refresh = useStore((s) => s.refreshLibrary);

  const [value, setValue] = useState('');
  const [results, setResults] = useState<BookSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [filing, setFiling] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const lastSearchRef = useRef(0);

  const classification = useMemo(() => classifyInput(value), [value]);

  // Focus the input on mount.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  // Debounced search. Triggered only when the input classifies as 'query'.
  useEffect(() => {
    if (classification.mode !== 'query') {
      setResults(null);
      setSearching(false);
      setSearchError(null);
      return;
    }
    const query = classification.query!;
    if (query.length < 2) {
      setResults(null);
      return;
    }

    setSearching(true);
    setSearchError(null);
    const tag = ++lastSearchRef.current;
    const t = setTimeout(async () => {
      try {
        const { results } = await api.searchBooks({ query });
        // Race-guard: only apply results from the most recent query.
        if (tag !== lastSearchRef.current) return;
        setResults(results);
        setSearching(false);
      } catch (err) {
        console.error('searchBooks failed', err);
        if (tag !== lastSearchRef.current) return;
        setSearchError('The catalogue could not be reached. Try once more.');
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [classification.mode, classification.query]);

  // File a known book (by ID or URL classification, or via clicking a search result).
  const fileNow = async (source: string) => {
    if (filing) return;
    setFiling(true);
    setFileError(null);
    setPendingId(null);
    try {
      const { id } = await api.fileEdition({ source });
      setPendingId(id);
      await refresh();
      // Cache hits return immediately as `ready`. Otherwise the library
      // shows the IN SETTING row and the editor opens with the
      // pipeline-still-running state.
      navigate(`/book/${id}`);
    } catch (err) {
      console.error('fileEdition failed', err);
      const msg = err instanceof Error
        ? err.message
        : 'The press could not file that edition.';
      setFileError(msg);
    } finally {
      setFiling(false);
    }
  };

  return (
    <div className="page file-page">
      <div className="file-wrap">
        <FilePageHeader />

        <h2 className="t-display file-headline">File a new edition.</h2>
        <p className="t-body t-body-italic file-sub">
          Paste a Project Gutenberg link, type a book number, or search for a
          title or author.
        </p>

        <div className="file-input-block">
          <label htmlFor="source" className="t-label input-label">
            ADDRESS · NUMBER · TITLE
          </label>
          <input
            id="source"
            ref={inputRef}
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            className={`input file-input ${fileError ? 'error' : ''}`}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setFileError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (classification.mode === 'id' || classification.mode === 'url')) {
                e.preventDefault();
                fileNow(value);
              }
            }}
            placeholder="gutenberg.org/ebooks/1342  ·  1342  ·  Pride and Prejudice"
            disabled={filing}
          />
          <ClassificationHelper
            classification={classification}
            filing={filing}
            error={fileError}
          />

          {(classification.mode === 'id' || classification.mode === 'url') && (
            <div className="file-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => fileNow(value)}
                disabled={filing}
              >
                {filing ? 'FILING…' : 'FILE THIS EDITION'}
              </button>
            </div>
          )}
        </div>

        <SearchPanel
          mode={classification.mode}
          query={classification.query ?? ''}
          searching={searching}
          searchError={searchError}
          results={results}
          pendingId={pendingId}
          filing={filing}
          onChoose={(r) => fileNow(r.gutenbergId)}
        />

        <div className="file-foot">
          <button
            type="button"
            className="linklabel"
            onClick={() => navigate('/')}
          >
            ← THE LIBRARY
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Page header strip
// -----------------------------------------------------------------------------

function FilePageHeader() {
  return (
    <div className="file-header">
      <span className="t-kicker t-kicker--umber">FROM PROJECT GUTENBERG</span>
      <span className="file-header-dot">·</span>
      <span className="t-folio">A new addition to the library</span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// The italic helper line under the input
// -----------------------------------------------------------------------------

function ClassificationHelper({
  classification,
  filing,
  error,
}: {
  classification: ReturnType<typeof classifyInput>;
  filing: boolean;
  error: string | null;
}) {
  let text: React.ReactNode;
  let isError = false;

  if (error) {
    text = error;
    isError = true;
  } else if (filing) {
    text = <em>filing the edition…</em>;
  } else {
    switch (classification.mode) {
      case 'empty':
        text = <em>The smart compositor will recognise links, numbers, or titles.</em>;
        break;
      case 'id':
        text = (
          <>
            <em>Recognised as Project Gutenberg ebook </em>
            <span className="file-helper-em">№ {classification.bookId}</span>
            <em>. Press Enter to file.</em>
          </>
        );
        break;
      case 'url':
        text = (
          <>
            <em>A Project Gutenberg link to ebook </em>
            <span className="file-helper-em">№ {classification.bookId}</span>
            <em>. Press Enter to file.</em>
          </>
        );
        break;
      case 'query':
        text = <em>Searching the catalogue for "{classification.query}"</em>;
        break;
    }
  }

  return (
    <div className={`input-helper ${isError ? 'input-helper--error' : ''}`}>
      {text}
    </div>
  );
}

// -----------------------------------------------------------------------------
// The search results panel
// -----------------------------------------------------------------------------

function SearchPanel({
  mode,
  query,
  searching,
  searchError,
  results,
  pendingId,
  filing,
  onChoose,
}: {
  mode: ReturnType<typeof classifyInput>['mode'];
  query: string;
  searching: boolean;
  searchError: string | null;
  results: BookSearchResult[] | null;
  pendingId: string | null;
  filing: boolean;
  onChoose: (r: BookSearchResult) => void;
}) {
  if (mode !== 'query' || query.length < 2) return null;

  return (
    <div className="file-search">
      <div className="file-search-head">
        <span className="t-label">FROM THE CATALOGUE</span>
      </div>
      <div className="rule-single" />

      {searching && (
        <div className="file-search-loading t-byline">
          <em>consulting the catalogue…</em>
        </div>
      )}

      {searchError && (
        <div className="file-search-error t-byline">
          <em>{searchError}</em>
        </div>
      )}

      {!searching && !searchError && results && results.length === 0 && (
        <div className="file-search-empty t-byline">
          <em>No editions match "{query}".</em>
        </div>
      )}

      {!searching && results && results.length > 0 && (
        <div className="file-search-results">
          {results.map((r, i) => (
            <button
              key={r.gutenbergId}
              type="button"
              className="file-result"
              onClick={() => onChoose(r)}
              disabled={filing}
              style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
            >
              <div className="file-result-row">
                <span className="t-folio file-result-id">№ {r.gutenbergId}</span>
                <span className="t-folio file-result-lang">
                  {(r.language ?? 'en').toUpperCase()}
                </span>
              </div>
              <div className="t-subhead file-result-title">{r.title}</div>
              <div className="t-byline file-result-author">
                <em>{r.author || 'Anonymous'}</em>
              </div>
              {filing && pendingId === null && (
                <div className="file-result-pending t-folio">
                  <em>filing…</em>
                </div>
              )}
              <div className="rule-faint file-result-rule" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
