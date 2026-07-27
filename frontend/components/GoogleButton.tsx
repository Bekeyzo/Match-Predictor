'use client';
import { useEffect, useRef, useState } from 'react';
import { googleLogin } from '@/lib/api';

declare global {
  interface Window { google?: { accounts?: { id?: {
    initialize: (o: unknown) => void;
    renderButton: (el: HTMLElement, o: unknown) => void;
  } } }; }
}

function GMark() {
  return (
    <svg className="g-mark" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

export default function GoogleButton({ onSignedIn }: { onSignedIn?: () => void }) {
  const hidden = useRef<HTMLDivElement>(null);
  const cb = useRef(onSignedIn);
  cb.current = onSignedIn;

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;

    const init = () => {
      const gid = window.google?.accounts?.id;
      if (!gid || !hidden.current) return;
      gid.initialize({
        client_id: clientId,
        callback: async (resp: { credential: string }) => {
          setBusy(true);
          try {
            const res = await googleLogin(resp.credential);
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('username', res.data.username);
            cb.current?.();
          } catch {
            console.error('Google sign-in failed');
          } finally {
            setBusy(false);
          }
        },
      });
      // Real Google button, kept off-screen — our styled button forwards clicks to it
      gid.renderButton(hidden.current, { theme: 'outline', size: 'large', width: 300 });
      setReady(true);
    };

    if (window.google?.accounts?.id) { init(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = init;
    document.head.appendChild(s);
  }, [clientId]);

  const fire = () => {
    const real = hidden.current?.querySelector('div[role="button"]') as HTMLElement | null;
    if (real) real.click();
    else hidden.current?.classList.add('g-hidden--show'); // fallback: reveal Google's own button
  };

  if (!clientId) return null;

  return (
    <div className="g-wrap">
      <div className="g-divider"><span>or continue with</span></div>

      <button className="g-btn" onClick={fire} disabled={!ready || busy}>
        <span className="g-btn-sheen" />
        <GMark />
        <span className="g-btn-text">{busy ? 'Signing you in…' : 'Google'}</span>
      </button>

      <div className="g-hidden" ref={hidden} />
    </div>
  );
}
