import { useEffect, useState } from 'react';

// A small COLOPHON link + the broadside modal it opens. Used in two
// places:
//
//   - The library page footer, alongside SIGN OUT (default `inline`
//     variant — flows with surrounding footer content).
//   - The entry page, pinned to the bottom of the viewport so the
//     maker's info is reachable even before sign-in (the `pinned`
//     variant — `position: fixed` at the bottom centre).
//
// The broadside content is identical between variants. Only the
// trigger placement differs.
export function ColophonLink({
  variant = 'inline',
}: {
  variant?: 'inline' | 'pinned';
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`linklabel ${variant === 'pinned' ? 'colophon-pinned' : 'library-colophon-link'}`}
        onClick={() => setOpen(true)}
      >
        COLOPHON
      </button>
      {open && <ColophonNotice onClose={() => setOpen(false)} />}
    </>
  );
}

function ColophonNotice({ onClose }: { onClose: () => void }) {
  // Esc dismisses, matching every other modal in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="broadside-overlay" onClick={onClose}>
      <div
        className="broadside colophon-broadside"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rule-heavy" />
        <div className="broadside-kicker t-kicker">A NOTE ON THE TYPE</div>
        <div className="rule-single" />

        <h2 className="t-display colophon-headline">
          <em>Ilya</em>
        </h2>

        <p className="t-body t-body-italic colophon-body">
          A personal classics workshop. Designed and built by Nina Mir.
        </p>

        <div className="rule-faint colophon-rule" />

        <ul className="colophon-links">
          <li>
            <a
              href="/pitch.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              the prospectus
            </a>
            <span className="colophon-link-label">— what Ilya is for</span>
          </li>
          <li>
            <a
              href="https://nina-mir.github.io/words/"
              target="_blank"
              rel="noopener noreferrer"
            >
              nina-mir.github.io/words
            </a>
            <span className="colophon-link-label">— published pieces</span>
          </li>
          <li>
            <a
              href="https://github.com/nina-mir"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/nina-mir
            </a>
            <span className="colophon-link-label">— source code</span>
          </li>
          <li>
            <a href="mailto:ninamirf@gmail.com">ninamirf@gmail.com</a>
            <span className="colophon-link-label">— correspondence</span>
          </li>
        </ul>

        <div className="rule-heavy" />
      </div>
    </div>
  );
}
