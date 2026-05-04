import { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './global.css';
import './editor.css';
import './store'; // ensures the auth subscription is wired before render
import { navigate as imperativeNavigate } from './navigate';

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      // The press has stopped. Surface the failure visibly in editorial
      // voice. The em-dash + lower-case message echoes the spec's error
      // copy convention.
      return (
        <div
          style={{
            padding: 32,
            color: 'var(--brick)',
            fontFamily: 'var(--fell)',
            fontStyle: 'italic',
            fontSize: 16,
            lineHeight: 1.5,
            background: 'var(--linen)',
            minHeight: '100dvh',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--fell-sc)',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              fontStyle: 'normal',
              fontSize: 12,
              marginBottom: 16,
              color: 'var(--brick)',
            }}
          >
            THE PRESS HAS STOPPED
          </div>
          <div style={{ fontStyle: 'normal' }}>{this.state.error.message}</div>
          <pre style={{ marginTop: 24, fontSize: 12, color: 'var(--umber-faint)' }}>
            {this.state.error.stack}
          </pre>
          <button
            type="button"
            className="btn-primary"
            onClick={() => imperativeNavigate('/')}
            style={{ marginTop: 32 }}
          >
            ← THE LIBRARY
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
