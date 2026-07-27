'use client';
import { useEffect } from 'react';
import AuthCard from '@/components/AuthCard';

type Props = {
  open: boolean;
  onClose: () => void;
  onSignedIn?: () => void;
  heading?: string;
  note?: string;
};

export default function AuthModal({ open, onClose, onSignedIn, heading, note }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-veil" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose} aria-label="Close">×</button>
        <AuthCard
          heading={heading ?? 'Sign in to see the prediction'}
          note={note ?? 'Free account. Everything else stays open.'}
          onSignedIn={() => { onSignedIn?.(); onClose(); }}
        />
      </div>
    </div>
  );
}
