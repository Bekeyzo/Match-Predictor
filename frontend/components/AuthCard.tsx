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
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (localStorage.getItem('token')) {
      setUser(localStorage.getItem('username') || 'Signed in');
    }
  }, []);

  const submit = async () => {
    if (!username || !password) { setMsg('Both fields, please.'); return; }
    setBusy(true); setMsg('');
    try {
      if (mode === 'up') await register(username, password);
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
      <input className="field" type="password" placeholder="Password" value={password}
             onChange={e => setPassword(e.target.value)}
             onKeyDown={e => e.key === 'Enter' && submit()} />

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
