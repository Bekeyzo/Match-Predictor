'use client';
import { useEffect, useState } from 'react';
import AuthModal from '@/components/AuthModal';

export default function NavAuth() {
  const [user, setUser] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const sync = () => setUser(
    localStorage.getItem('token') ? (localStorage.getItem('username') || 'Account') : null
  );

  useEffect(() => { sync(); }, []);

  if (user) {
    return (
      <a href="/profile" className="nav-avatar" title={`${user} — view profile`}>
        {user.slice(0, 1).toUpperCase()}
      </a>
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
