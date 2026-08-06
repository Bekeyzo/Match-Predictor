'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getMe, updateName, logout } from '@/lib/api';

export default function ProfilePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [joined, setJoined] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/'); return; }
    getMe()
      .then(res => {
        setName(res.data.username);
        setEmail(res.data.email);
        setJoined(res.data.created_at);
      })
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));
  }, [router]);

  const saveName = async () => {
    const trimmed = draft.trim();
    if (trimmed.length < 1 || trimmed.length > 32) return;
    setBusy(true);
    try {
      await updateName(trimmed);
      setName(trimmed);
      localStorage.setItem('username', trimmed);
      setEditing(false);
    } catch { /* keep editing open on failure */ }
    finally { setBusy(false); }
  };

  const joinedLabel = joined
    ? new Date(joined).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : '—';

  if (loading) {
    return <div className="wrap"><div className="skel" style={{ height: 200, marginTop: 40 }} /></div>;
  }

  return (
    <div className="profile-page">
      <div className="aurora"><div className="aurora-blob aurora-1" /><div className="aurora-blob aurora-2" /></div>

      <div className="profile-head">
        <div className="profile-avatar">{(name[0] || '?').toUpperCase()}</div>
        <div style={{ minWidth: 0 }}>
          {editing ? (
            <div className="pw-wrap" style={{ display: 'flex', gap: 8 }}>
              <input className="field" value={draft} autoFocus maxLength={32}
                     onChange={e => setDraft(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && saveName()}
                     style={{ marginBottom: 0 }} />
              <button className="btn-primary" onClick={saveName} disabled={busy} style={{ whiteSpace: 'nowrap' }}>
                {busy ? '…' : 'Save'}
              </button>
            </div>
          ) : (
            <>
              <div className="profile-name">{name}</div>
              <div className="profile-email">{email || 'No email on file'}</div>
            </>
          )}
        </div>
        {!editing && (
          <button className="profile-edit" onClick={() => { setDraft(name); setEditing(true); }}>
            Edit name
          </button>
        )}
      </div>

      <div className="profile-stats">
        <div className="profile-stat">
          <div className="profile-stat-label">Member since</div>
          <div className="profile-stat-val">{joinedLabel}</div>
        </div>
        <div className="profile-stat">
          <div className="profile-stat-label">Predictions viewed</div>
          <div className="profile-stat-val" style={{ color: 'var(--ink-3)' }}>—</div>
        </div>
        <div className="profile-stat">
          <div className="profile-stat-label">Top league</div>
          <div className="profile-stat-val" style={{ color: 'var(--ink-3)' }}>—</div>
        </div>
      </div>

      <div className="profile-soon">
        <div className="profile-soon-title">Your prediction history</div>
        <div className="profile-soon-sub">Coming soon — the fixtures you view and back will show up here, with your hit rate against the model.</div>
      </div>

      <div style={{ marginTop: 24, display: 'flex', gap: 16, alignItems: 'center' }}>
        <button className="btn-link" onClick={() => { router.push('/'); }}>← Back to fixtures</button>
        <button className="btn-link" style={{ color: 'var(--away)' }}
                onClick={() => { logout(); localStorage.removeItem('username'); router.push('/'); }}>Sign out</button>
      </div>
    </div>
  );
}
