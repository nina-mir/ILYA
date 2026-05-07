import { useState, useRef, useEffect, type KeyboardEvent, type ClipboardEvent, type ChangeEvent } from 'react';
import api from '../api';
import { useStore } from '../store';
import { useNavigate } from '../hooks/useNavigate';
import { ColophonLink } from '../components/ColophonLink';
import './EnterPage.css';

type Stage = 'email' | 'code' | 'verifying' | 'success';

export default function EnterPage() {
  const navigate = useNavigate();
  const refresh = useStore((s) => s.refreshLibrary);

  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const codeBoxRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Resend cooldown (30s after each code request).
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // Focus the first digit when the code stage opens.
  useEffect(() => {
    if (stage === 'code') {
      const t = setTimeout(() => codeBoxRefs.current[0]?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [stage]);

  const sendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!isReasonableEmail(trimmed)) {
      setEmailError('That address is not in the editor’s ledger of valid emails.');
      return;
    }
    setEmailError(null);
    setBusy(true);
    try {
      await api.sendEmailCode({ email: trimmed });
      setVerificationId('local-console-code');
      setEmail(trimmed);
      setStage('code');
      setResendTimer(30);
      setCode(['', '', '', '', '', '']);
    } catch (err) {
      console.error('sendEmailCode failed', err);
      const msg = err instanceof Error ? err.message : 'We couldn’t reach the courier. Try once more.';
      setEmailError(msg);
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (digits: string[]) => {
    const value = digits.join('');
    if (value.length !== 6) return;
    setStage('verifying');
    setCodeError(null);
    try {
      const verified = await api.verifyEmailCode({ email, code: value });
      useStore.getState().setUser(verified.user);

      const me = await api.signUpReader({});

      // Re-load the canonical current user after sign-up fills joinedAt/displayName.
      await useStore.getState().loadMe();
      await refresh();

      const library = useStore.getState().library ?? [];

      // Keep the old frontend behavior for now: welcome books are attempted
      // by the browser after first sign-in. In Phase 6, once real imports work,
      // we can decide whether to move this server-side.
      const welcomeKey = `ilya:welcome-attempted:v1:${me.id}`;
      const alreadyAttempted = (() => {
        try { return localStorage.getItem(welcomeKey) === '1'; }
        catch { return false; }
      })();

      if (library.length === 0 && !alreadyAttempted && me.isNewReader) {
        // Phase 6 will implement real fileEdition. For Phase 5, do not auto-file.
        // We set the flag only after Phase 6 is ready. Leaving this block empty
        // preserves the structure without causing failed imports today.
      }

      setStage('success');
      setTimeout(() => navigate('/', true), 450);
    } catch (err) {
      console.error('verifyEmailCode failed', err);
      const msg = err instanceof Error ? err.message : 'That code did not match. Try again.';
      setCodeError(msg);
      setCode(['', '', '', '', '', '']);
      setStage('code');
      setTimeout(() => codeBoxRefs.current[0]?.focus(), 0);
    }
  };

  const handleDigitChange = (idx: number) => (e: ChangeEvent<HTMLInputElement>) => {
    // Take just the last digit typed, in case the input got two characters
    // (autofill, paste, etc.).
    const raw = e.target.value;
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[idx] = digit;
    setCode(next);
    setCodeError(null);
    if (digit && idx < 5) codeBoxRefs.current[idx + 1]?.focus();
    // Auto-submit when the last digit is filled.
    if (digit && idx === 5 && next.every((d) => d.length === 1)) {
      submitCode(next);
    }
  };

  const handleDigitKeyDown = (idx: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) {
      const next = [...code];
      next[idx - 1] = '';
      setCode(next);
      codeBoxRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      codeBoxRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < 5) {
      codeBoxRefs.current[idx + 1]?.focus();
    } else if (e.key === 'Enter' && code.every((d) => d.length === 1)) {
      submitCode(code);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = pasted.split('').concat(['', '', '', '', '', '']).slice(0, 6);
    setCode(next);
    const focusIdx = Math.min(pasted.length, 5);
    codeBoxRefs.current[focusIdx]?.focus();
    if (pasted.length === 6) submitCode(next);
  };

  const resend = async () => {
    if (resendTimer > 0 || busy) return;
    setBusy(true);
    setCodeError(null);
    try {
      await api.sendEmailCode({ email });
      setVerificationId('local-console-code');
      setResendTimer(30);
      setCode(['', '', '', '', '', '']);
      setTimeout(() => codeBoxRefs.current[0]?.focus(), 0);
    } catch (err) {
      console.error('resend failed', err);
      const msg = err instanceof Error ? err.message : 'The courier did not reach the address. Try once more.';
      setCodeError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page enter-page">
      <div className="enter-wrap">
        <div className="enter-masthead">
          <div className="enter-masthead-rules">
            <i />
          </div>
          <h1 className="enter-wordmark">Ilya</h1>
          <div className="enter-masthead-rules">
            <i />
          </div>
        </div>

        <div className="enter-tagline t-byline">
          <em>A personal classics workshop</em>
        </div>

        <div className="enter-form">
          {stage === 'email' && (
            <EmailStep
              email={email}
              setEmail={setEmail}
              error={emailError}
              busy={busy}
              onSubmit={sendCode}
            />
          )}

          {(stage === 'code' || stage === 'verifying' || stage === 'success') && (
            <CodeStep
              email={email}
              code={code}
              error={codeError}
              stage={stage}
              resendTimer={resendTimer}
              busy={busy}
              codeBoxRefs={codeBoxRefs}
              onDigitChange={handleDigitChange}
              onDigitKeyDown={handleDigitKeyDown}
              onPaste={handlePaste}
              onResend={resend}
              onChangeEmail={() => {
                setStage('email');
                setVerificationId('');
                setCode(['', '', '', '', '', '']);
                setCodeError(null);
              }}
            />
          )}
        </div>

        <div className="enter-colophon">
          <div className="enter-colophon-rule" />
          <div className="t-caption t-caption--italic">
            By entering, you join a private library only you will see.
          </div>
        </div>
      </div>

      {/* Pinned to the bottom of the viewport so the maker's info is
          reachable even before the reader signs in. */}
      <ColophonLink variant="pinned" />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Stage subcomponents
// -----------------------------------------------------------------------------

function EmailStep({
  email,
  setEmail,
  error,
  busy,
  onSubmit,
}: {
  email: string;
  setEmail: (s: string) => void;
  error: string | null;
  busy: boolean;
  onSubmit: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="enter-stage"
    >
      <label htmlFor="email" className="t-label input-label">
        YOUR EMAIL ADDRESS
      </label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        autoFocus
        inputMode="email"
        className={`input ${error ? 'error' : ''}`}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="reader@somewhere.org"
        disabled={busy}
      />
      <div className={`input-helper ${error ? 'input-helper--error' : ''}`}>
        {error ?? 'A six-digit code will arrive shortly. No password.'}
      </div>

      <div className="enter-actions">
        <button
          type="submit"
          className="btn-primary"
          disabled={busy || !email.trim()}
        >
          {busy ? 'SENDING…' : 'REQUEST A CODE'}
        </button>
      </div>
    </form>
  );
}

function CodeStep({
  email,
  code,
  error,
  stage,
  resendTimer,
  busy,
  codeBoxRefs,
  onDigitChange,
  onDigitKeyDown,
  onPaste,
  onResend,
  onChangeEmail,
}: {
  email: string;
  code: string[];
  error: string | null;
  stage: 'code' | 'verifying' | 'success';
  resendTimer: number;
  busy: boolean;
  codeBoxRefs: { current: Array<HTMLInputElement | null> };
  onDigitChange: (idx: number) => (e: ChangeEvent<HTMLInputElement>) => void;
  onDigitKeyDown: (idx: number) => (e: KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: ClipboardEvent<HTMLInputElement>) => void;
  onResend: () => void;
  onChangeEmail: () => void;
}) {
  const isVerifying = stage === 'verifying';
  const isSuccess = stage === 'success';

  return (
    <div className="enter-stage">
      <div className="t-byline enter-courier">
        A courier was dispatched to <span className="enter-courier-em">{email}</span>.
      </div>

      <div
        className={`code-grid ${isVerifying ? 'is-verifying' : ''} ${isSuccess ? 'is-success' : ''} ${error ? 'has-error' : ''}`}
        onPaste={onPaste}
      >
        {code.map((digit, idx) => (
          <input
            key={idx}
            ref={(el) => {
              codeBoxRefs.current[idx] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={idx === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            value={digit}
            onChange={onDigitChange(idx)}
            onKeyDown={onDigitKeyDown(idx)}
            disabled={isVerifying || isSuccess}
            className="code-box"
            aria-label={`Digit ${idx + 1} of 6`}
          />
        ))}
      </div>

      <div className={`input-helper ${error ? 'input-helper--error' : ''}`}>
        {isSuccess ? (
          <span>Thank you. The library is opening.</span>
        ) : isVerifying ? (
          <span><em>checking the code…</em></span>
        ) : error ? (
          error
        ) : (
          <em>Enter the six digits in the order they arrived.</em>
        )}
      </div>

      <div className="enter-actions enter-actions--code">
        <button
          type="button"
          className="linklabel"
          onClick={onResend}
          disabled={resendTimer > 0 || busy || isVerifying || isSuccess}
        >
          {resendTimer > 0 ? `RESEND IN ${resendTimer}S` : 'RESEND THE CODE'}
        </button>
        <button
          type="button"
          className="linklabel"
          onClick={onChangeEmail}
          disabled={isVerifying || isSuccess}
        >
          ← CHANGE ADDRESS
        </button>
      </div>
    </div>
  );
}

function isReasonableEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
