import { useLocation } from 'wouter';

// All navigation in the app routes through this hook so every transition
// uses the View Transitions API for the cross-fade through linen. wouter's
// own setLocation is wrapped in a startViewTransition() callback when
// supported; falls back cleanly otherwise.
export function useNavigate() {
  const [, setLocation] = useLocation();
  return (path: string, replace?: boolean) => {
    const opts = replace ? { replace: true } : undefined;
    const doc = document as unknown as {
      startViewTransition?: (cb: () => void) => unknown;
    };
    if (typeof doc.startViewTransition === 'function') {
      doc.startViewTransition(() => setLocation(path, opts));
    } else {
      setLocation(path, opts);
    }
  };
}
