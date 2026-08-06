'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { resetPassword } from '@/lib/api';

const EyeOpen = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
);
const EyeOff = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
);

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) setMsg('This reset link is missing its token.');
  }, [token]);

  const submit = async () => {
    if (password.length < 8) { setMsg('Password must be at least 8 characters.'); return; }
    setBusy(true); setMsg('');
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err: unknown) {
      const apiMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setMsg(apiMsg || 'Could not reset password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="reset-page">
      <div className="aurora">
        <div className="aurora-blob aurora-1" />
        <div className="aurora-blob aurora-2" />
      </div>
      <div className="side-card reset-card">
        <div className="reset-brand">TEHUTI.AI</div>
        {done ? (
          <>
            <h1 className="reset-title">Password updated</h1>
            <p className="reset-sub">You can sign in with your new password now.</p>
            <button className="btn-primary" onClick={() => router.push('/')}>Go to sign in</button>
          </>
        ) : (
          <>
            <h1 className="reset-title">Choose a new password</h1>
            <p className="reset-sub">Enter a new password for your account. Make it at least 8 characters.</p>
            <div className="pw-wrap">
              <input className="field pw-field" type={showPw ? 'text' : 'password'}
                     placeholder="New password" value={password} autoFocus
                     onChange={e => setPassword(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && submit()} />
              <button type="button" className="pw-eye" onClick={() => setShowPw(!showPw)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}>
                {showPw ? <EyeOff /> : <EyeOpen />}
              </button>
            </div>
            {msg && <p className="reset-error">{msg}</p>}
            <button className="btn-primary" onClick={submit} disabled={busy || !token}>
              {busy ? 'Updating…' : 'Update password'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={<div className="reset-page"><div className="side-card reset-card">Loading…</div></div>}>
      <ResetForm />
    </Suspense>
  );
}
