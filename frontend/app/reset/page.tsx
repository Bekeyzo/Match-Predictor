'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { resetPassword } from '@/lib/api';

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
    <div className="wrap" style={{ maxWidth: 420, marginTop: 60 }}>
      <div className="side-card">
        <div className="side-title">Choose a new password</div>
        {done ? (
          <>
            <p className="side-note">Your password has been updated.</p>
            <button className="btn-primary" onClick={() => router.push('/')}>Go to sign in</button>
          </>
        ) : (
          <>
            <div className="pw-wrap">
              <input className="field pw-field" type={showPw ? 'text' : 'password'}
                     placeholder="New password" value={password}
                     onChange={e => setPassword(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && submit()} />
              <button type="button" className="pw-eye" onClick={() => setShowPw(!showPw)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}>
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
            {msg && <p className="side-note" style={{ color: 'var(--away)' }}>{msg}</p>}
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
    <Suspense fallback={<div className="wrap" style={{ marginTop: 60 }}>Loading…</div>}>
      <ResetForm />
    </Suspense>
  );
}
