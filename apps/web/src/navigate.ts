// Imperative navigation helper for non-React contexts (the error
// boundary, async callbacks, etc.). Uses the History API directly and
// dispatches the popstate event wouter listens for.
export function navigate(path: string, replace = false) {
  const doc = document as unknown as {
    startViewTransition?: (cb: () => void) => unknown;
  };
  const fire = () => {
    if (replace) {
      window.history.replaceState({}, '', path);
    } else {
      window.history.pushState({}, '', path);
    }
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  if (typeof doc.startViewTransition === 'function') {
    doc.startViewTransition(fire);
  } else {
    fire();
  }
}
