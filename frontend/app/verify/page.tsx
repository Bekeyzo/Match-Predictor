'use client';
import { useState, useEffect, Suspense } from 'react';
import Spinner from '@/components/Spinner';
import { useSearchParams, useRouter } from 'next/navigation';
import { verifyEmail } from '@/lib/api';

function VerifyInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';
  const [status, setStatus] = useState<'working' | 'ok' | 'fail'>('working');
  const [msg, setMsg] = useState('Confirming your email…');

  useEffect(() => {
    if (!token) { setStatus('fail'); setMsg('This verification link is missing its token.'); return; }
    verifyEmail(token)
      .then(() => { setStatus('ok'); setMsg('Your email is confirmed — predictions are unlocked.'); })
      .catch((err: unknown) => {
        setStatus('fail');
        const m = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setMsg(m || 'This link may have expired or already been used.');
      });
  }, [token]);

  return (
    <div className="reset-page">
      <div className="aurora"><div className="aurora-blob aurora-1" /><div className="aurora-blob aurora-2" /></div>
      <div className="side-card reset-card">
        <div className="reset-brand">TEHUTI.AI</div>
        <h1 className="reset-title">
          {status === 'working' ? 'Verifying…' : status === 'ok' ? 'Email confirmed' : 'Verification failed'}
        </h1>
        <p className="reset-sub">{msg}</p>
        {status !== 'working' && (
          <button className="btn-primary" onClick={() => router.push('/')}>
            {status === 'ok' ? 'Go to predictions' : 'Back to home'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="reset-page"><div className="reset-card"><Spinner block label="Loading…" /></div></div>}>
      <VerifyInner />
    </Suspense>
  );
}
