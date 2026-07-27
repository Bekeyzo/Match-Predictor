'use client';
import { useEffect, useState } from 'react';
import { logout } from '@/lib/api';
import AuthModal from '@/components/AuthModal';

export default function NavAuth() {
  const [user, setUser] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const sync = () => setUser(
    localStorage.getItem('token') ? (localStorage.getItem('username') || 'Account') : null
  );

  useEffect(() => { sync(); }, []);

  const signOut = () => {
    logout();
    localStorage.removeItem('username');
    setUser(null);
  };

  if (user) {
    return (
      <button className="nav-avatar" onClick={signOut} title={`${user} — sign out`}>
        {user.slice(0, 1).toUpperCase()}
      </button>
    );
  }

  return (
    <>
      <button className="nav-signin" onClick={() => setOpen(true)}>Sign in</button>
      <AuthModal
        open={open}
        onClose={() => setOpen(false)}
        onSignedIn={sync}
        heading="Sign in"
        note="Free account. Needed only for predictions."
      />
    </>
  );
}
