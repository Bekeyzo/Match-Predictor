'use client';
import { useEffect, useState } from 'react';
import { getConfidentShots, ShotMatch, ShotTeam } from '@/lib/api';

function niceDate(d: string) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); }
  catch { return d; }
}

export default function ConfidentPicksPage() {
  const [matches, setMatches] = useState<ShotMatch[] | null>(null);
  const [teams, setTeams] = useState<ShotTeam[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getConfidentShots()
      .then(r => { setMatches(r.data.matches || []); setTeams(r.data.teams || []); })
      .catch(() => setError('Could not load confident picks.'));
  }, []);

  if (error) return <div className="state">{error}<br /><a href="/" className="back" style={{ marginTop: 18 }}>← Back</a></div>;
  if (!matches || !teams) return <div className="state">Crunching every fixture across the leagues…</div>;

  return (
    <div className="wrap" style={{ maxWidth: 720 }}>
      <a href="/" className="back">← Back to leagues</a>
      <h1 className="display" style={{ fontSize: 30, margin: '12px 0 4px' }}>Shot Confident Picks</h1>
      <p className="eyebrow" style={{ marginBottom: 8 }}>Highest shot-volume matchups this matchweek · updates hourly</p>

      <div className="k-sh" style={{ marginTop: 26 }}>Most likely high-shot matches <span className="sub">chance of over 26.5 total shots</span></div>
      <div className="k-stats" style={{ gridTemplateColumns: '1fr' }}>
        {matches.map((m, i) => (
          <div className="k-stat" key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{m.home} <span style={{ color: 'var(--ink-2)', fontWeight: 400 }}>v</span> {m.away}</div>
              <div className="eyebrow" style={{ marginTop: 4 }}>{m.league} · {niceDate(m.date)}</div>
            </div>
            <div className="num" style={{ fontWeight: 700, fontSize: 24, color: 'var(--purple)' }}>{m.prob_pct.toFixed(0)}%</div>
          </div>
        ))}
      </div>

      <div className="k-sh" style={{ marginTop: 32 }}>Teams likely to rack up shots <span className="sub">chance of that team taking over 18.5 shots</span></div>
      <div className="k-stats" style={{ gridTemplateColumns: '1fr' }}>
        {teams.map((t, i) => (
          <div className="k-stat" key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{t.team} <span style={{ color: 'var(--ink-2)', fontWeight: 400, fontSize: 14 }}>to fire 18+ shots</span></div>
              <div className="eyebrow" style={{ marginTop: 4 }}>vs {t.opponent} · {t.league} · {niceDate(t.date)}</div>
            </div>
            <div className="num" style={{ fontWeight: 700, fontSize: 24, color: 'var(--away)' }}>{t.prob_pct.toFixed(0)}%</div>
          </div>
        ))}
      </div>

      <p className="pred-disclaimer" style={{ marginTop: 28 }}>Shot estimates from team form (blend of shots taken and shots faced) · a guide, not a guarantee. 18.5 shots is a high bar, so team percentages read modest.</p>
    </div>
  );
}
