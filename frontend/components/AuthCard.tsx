'use client';
import { useEffect, useState } from 'react';
import { login, register, logout } from '@/lib/api';
import GoogleButton from '@/components/GoogleButton';

type Props = {
  heading?: string;
  note?: string;
  onSignedIn?: () => void;
  hideWhenSignedIn?: boolean;
};

export default function AuthCard({ heading, note, onSignedIn, hideWhenSignedIn }: Props) {
  const [user, setUser] = useState<string | null>(null);
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (localStorage.getItem('token')) {
      setUser(localStorage.getItem('username') || 'Signed in');
    }
  }, []);

  const submit = async () => {
    if (!username || !password) { setMsg('Both fields, please.'); return; }
    if (mode === 'up' && !email) { setMsg('Email is required to create an account.'); return; }
    setBusy(true); setMsg('');
    try {
      if (mode === 'up') await register(username, email, password);
      await login(username, password);
      localStorage.setItem('username', username);
      setUser(username);
      setPassword('');
      onSignedIn?.();
    } catch (err: unknown) {
      const apiMsg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setMsg(apiMsg || (mode === 'up' ? 'Could not create account.' : 'Wrong username or password.'));
    } finally {
      setBusy(false);
    }
  };

  const signOut = () => {
    logout();
    localStorage.removeItem('username');
    setUser(null);
  };

  if (user) {
    if (hideWhenSignedIn) return null;
    return (
      <div className="side-card">
        <div className="side-title">Account</div>
        <div className="auth-who">
          <span className="auth-avatar">{user.slice(0, 1).toUpperCase()}</span>
          <div>
            <div className="auth-name">{user}</div>
            <div className="auth-note">Predictions unlocked</div>
          </div>
        </div>
        <button className="btn-ghost" onClick={signOut}>Sign out</button>
      </div>
    );
  }

  return (
    <div className="side-card">
      <div className="side-title">{heading ?? (mode === 'in' ? 'Sign in' : 'Create account')}</div>
      <p className="side-note">{note ?? 'Predictions are free — you just need an account.'}</p>

      <input className="field" placeholder="Username" value={username}
             onChange={e => setUsername(e.target.value)}
             onKeyDown={e => e.key === 'Enter' && submit()} />
      {mode === 'up' && (
        <input className="field" type="email" placeholder="Email" value={email}
               onChange={e => setEmail(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && submit()} />
      )}
      <div className="pw-wrap">
      <input className="field pw-field" type={showPw ? 'text' : 'password'} placeholder="Password" value={password}
             onChange={e => setPassword(e.target.value)}
             onKeyDown={e => e.key === 'Enter' && submit()} />
        <button type="button" className="pw-eye" onClick={() => setShowPw(!showPw)}
                aria-label={showPw ? 'Hide password' : 'Show password'}>
          {showPw ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          )}
        </button>
      </div>

      {msg && <div className="auth-msg">{msg}</div>}

      <button className="btn" onClick={submit} disabled={busy}>
        {busy ? 'Working…' : mode === 'in' ? 'Sign in' : 'Create account'}
      </button>

      <button className="btn-link" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(''); }}>
        {mode === 'in' ? 'No account? Create one' : 'Already have one? Sign in'}
      </button>

      <GoogleButton onSignedIn={() => {
        setUser(localStorage.getItem('username') || 'Account');
        onSignedIn?.();
      }} />
    </div>
  );
}
