import { useEffect } from 'react';

// "A notice from the librarian." Confirmation modal shown before
// removing a book from the reader's library. Used by:
//   - The editor (Chapter Navigation drawer footer link)
//   - The library row's hover/static withdraw link
//
// Rendered above the rest of the app on a translucent linen overlay,
// styled to look like a printed broadside (heavy rules top and bottom,
// brick "Yes, withdraw" CTA, italic explanatory body).
export function WithdrawBroadside({
  title,
  author,
  working,
  onCancel,
  onConfirm,
}: {
  title: string;
  author: string;
  working: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Esc to cancel — only when we're not in the middle of the
  // destructive op (don't let the reader cancel a half-completed
  // delete).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !working) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, working]);

  return (
    <div
      className="broadside-overlay"
      onClick={!working ? onCancel : undefined}
    >
      <div className="broadside" onClick={(e) => e.stopPropagation()}>
        <div className="rule-heavy" />
        <div className="broadside-kicker t-kicker">A NOTICE FROM THE LIBRARIAN</div>
        <div className="rule-single" />

        <h2 className="t-display broadside-headline">
          <em>Withdraw</em> this edition?
        </h2>

        <div className="broadside-citation t-byline">
          <em>{title}</em>
          {author && <span> · {author}</span>}
        </div>

        <p className="t-body t-body-italic broadside-body">
          The reading copy and your annotations will be removed. The original
          text remains on the public shelves of Project Gutenberg.
        </p>

        <div className="rule-faint broadside-rule" />

        <div className="broadside-actions">
          <button
            type="button"
            className="btn-primary btn-primary--brick"
            onClick={onConfirm}
            disabled={working}
          >
            {working ? 'WITHDRAWING…' : 'YES, WITHDRAW'}
          </button>
          <button
            type="button"
            className="linklabel"
            onClick={onCancel}
            disabled={working}
          >
            KEEP IT ON THE SHELF
          </button>
        </div>

        <div className="rule-heavy" />
      </div>
    </div>
  );
}
