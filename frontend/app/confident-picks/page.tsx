'use client';
import { useEffect, useState } from 'react';
import { getConfidentShots, ShotMatch, ShotTeam } from '@/lib/api';

function niceDate(d: string) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); }
  catch { return d; }
}

type Data = {
  over_goals: ShotMatch[]; btts: ShotMatch[]; over_corners: ShotMatch[]; over_shots: ShotMatch[];
  over_fouls: ShotMatch[]; wins: ShotTeam[]; team_shots: ShotTeam[]; team_fouls: ShotTeam[];
};

function MatchList({ rows, accent }: { rows: ShotMatch[]; accent: string }) {
  return (
    <div className="k-stats" style={{ gridTemplateColumns: '1fr' }}>
      {rows.map((m, i) => (
        <div className="k-stat" key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{m.home} <span style={{ color: 'var(--ink-2)', fontWeight: 400 }}>v</span> {m.away}</div>
            <div className="eyebrow" style={{ marginTop: 4 }}>{m.league} · {niceDate(m.date)}</div>
          </div>
          <div className="num" style={{ fontWeight: 700, fontSize: 24, color: accent }}>{m.prob_pct.toFixed(0)}%</div>
        </div>
      ))}
    </div>
  );
}

function TeamList({ rows, suffix, accent }: { rows: ShotTeam[]; suffix: string; accent: string }) {
  return (
    <div className="k-stats" style={{ gridTemplateColumns: '1fr' }}>
      {rows.map((t, i) => (
        <div className="k-stat" key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{t.team} <span style={{ color: 'var(--ink-2)', fontWeight: 400, fontSize: 14 }}>{suffix}</span></div>
            <div className="eyebrow" style={{ marginTop: 4 }}>vs {t.opponent} · {t.league} · {niceDate(t.date)}</div>
          </div>
          <div className="num" style={{ fontWeight: 700, fontSize: 24, color: accent }}>{t.prob_pct.toFixed(0)}%</div>
        </div>
      ))}
    </div>
  );
}

export default function ConfidentPicksPage() {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getConfidentShots().then(r => setD(r.data as Data)).catch(() => setError('Could not load confident picks.'));
  }, []);

  if (error) return <div className="state">{error}<br /><a href="/" className="back" style={{ marginTop: 18 }}>← Back</a></div>;
  if (!d) return <div className="state">Crunching every fixture across the leagues…</div>;

  return (
    <div className="wrap" style={{ maxWidth: 720 }}>
      <a href="/" className="back">← Back to leagues</a>
      <h1 className="display" style={{ fontSize: 30, margin: '12px 0 4px' }}>Confident Picks</h1>
      <p className="eyebrow" style={{ marginBottom: 8 }}>This matchweek&rsquo;s strongest calls across every league · updates hourly</p>

      <div className="k-sh" style={{ marginTop: 26 }}>Most likely to win <span className="sub">team&rsquo;s chance of winning its match</span></div>
      <TeamList rows={d.wins} suffix="to win" accent="var(--win)" />

      <div className="k-sh" style={{ marginTop: 30 }}>Over 2.5 goals <span className="sub">chance of 3+ goals</span></div>
      <MatchList rows={d.over_goals} accent="var(--purple)" />

      <div className="k-sh" style={{ marginTop: 30 }}>Both teams to score <span className="sub">chance both sides find the net</span></div>
      <MatchList rows={d.btts} accent="var(--purple)" />

      <div className="k-sh" style={{ marginTop: 30 }}>Over 8.5 corners <span className="sub">chance of a corner-heavy match</span></div>
      <MatchList rows={d.over_corners} accent="var(--purple)" />

      <div className="k-sh" style={{ marginTop: 30 }}>Over 26.5 shots <span className="sub">chance of a high-shot match</span></div>
      <MatchList rows={d.over_shots} accent="var(--purple)" />

      <div className="k-sh" style={{ marginTop: 30 }}>Over 24.5 fouls <span className="sub">chance of a foul-heavy match</span></div>
      <MatchList rows={d.over_fouls} accent="var(--purple)" />

      <div className="k-sh" style={{ marginTop: 30 }}>Teams to fire 18+ shots <span className="sub">that team&rsquo;s chance of 18.5+ shots</span></div>
      <TeamList rows={d.team_shots} suffix="to fire 18+ shots" accent="var(--away)" />

      <div className="k-sh" style={{ marginTop: 30 }}>Teams to commit 13+ fouls <span className="sub">that team&rsquo;s chance of 12.5+ fouls</span></div>
      <TeamList rows={d.team_fouls} suffix="to commit 13+ fouls" accent="var(--away)" />

      <p className="pred-disclaimer" style={{ marginTop: 28 }}>Estimates from team form · a guide, not a guarantee. Higher lines (18.5 shots) read modest by design.</p>
    </div>
  );
}
