'use client';
import { useEffect, useState } from 'react';
import { getAccuracy, getLeagues, AccuracyStats, League } from '@/lib/api';

export default function AccuracyCard() {
  const [s, setS] = useState<AccuracyStats | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getAccuracy().then(r => setS(r.data)).catch(() => {});
    getLeagues()
      .then(r => {
        const map: Record<string, string> = {};
        r.data.forEach((l: League) => { map[l.code] = l.name; });
        setNames(map);
      })
      .catch(() => {});
  }, []);

  if (!s) return null;
  const edge = +(s.overall - s.baseline).toFixed(1);

  return (
    <div className="side-card">
      <div className="side-title">Model scorecard</div>

      <div className="acc-hero">
        <span className="acc-big">{s.overall}%</span>
        <span className="acc-unit">correct</span>
      </div>
      <p className="acc-sub">
        on {s.tested.toLocaleString()} matches it never trained on
      </p>

      <div className="acc-bar">
        <div className="acc-fill" style={{ width: `${s.overall}%` }} />
        <div className="acc-mark" style={{ left: `${s.baseline}%` }} />
      </div>
      <div className="acc-legend">
        <span>Always-home baseline {s.baseline}%</span>
        <span className={edge > 0 ? 'acc-up' : 'acc-down'}>
          {edge > 0 ? '+' : ''}{edge} pts
        </span>
      </div>

      <button className="btn-link" onClick={() => setOpen(!open)}>
        {open ? 'Hide per-league' : 'See per-league'}
      </button>

      {open && (
        <div className="acc-list">
          {s.leagues.map(l => {
            const delta = +(l.accuracy - l.baseline).toFixed(1);
            return (
              <div key={l.league} className="acc-row" title={names[l.league] ?? l.league}>
                <span className="acc-name">{names[l.league] ?? l.league}</span>
                <span className="acc-val">{l.accuracy}%</span>
                <span className={delta > 0 ? 'acc-up' : 'acc-down'}>
                  {delta > 0 ? '+' : ''}{delta}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
