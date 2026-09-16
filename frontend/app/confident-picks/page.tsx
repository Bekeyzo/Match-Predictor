'use client';
import { useEffect, useState } from 'react';
import { getConfidentShots, getPicksHistory, PickResult, ShotMatch, ShotTeam } from '@/lib/api';

function niceDate(d: string) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); }
  catch { return d; }
}

type Data = {
  banker: { market: string; league: string; label: string; detail: string; date: string; prob_pct: number }[];
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
  const [hist, setHist] = useState<{ snapshot_date: string | null; markets: Record<string, PickResult[]>; rates: Record<string, { right: number; total: number }> } | null>(null);

  useEffect(() => {
    getConfidentShots().then(r => setD(r.data as Data)).catch(() => setError('Could not load confident picks.'));
    getPicksHistory().then(r => setHist(r.data)).catch(() => {});
  }, []);


  const HIST_LABELS: Record<string, string> = {
    wins: 'Most likely to win', over_goals: 'Over 2.5 goals', btts: 'Both teams to score',
    over_corners: 'Over 8.5 corners', over_shots: 'Over 26.5 shots', over_fouls: 'Over 24.5 fouls',
    team_shots: 'Teams over 18.5 shots', team_fouls: 'Teams over 12.5 fouls',
  };

  if (error) return <div className="state">{error}<br /><a href="/" className="back" style={{ marginTop: 18 }}>← Back</a></div>;
  if (!d) return <div className="state">Crunching every fixture across the leagues…</div>;

  return (
    <div className="wrap" style={{ maxWidth: 720 }}>
      <a href="/" className="back">← Back to leagues</a>
      <h1 className="display" style={{ fontSize: 30, margin: '12px 0 4px' }}>Confident Picks</h1>
      <p className="eyebrow" style={{ marginBottom: 8 }}>This matchweek&rsquo;s strongest calls across every league · updates hourly</p>

      <div className="k-sh" style={{ marginTop: 26 }}>🏦 Banker <span className="sub">the 6 safest calls across all markets</span></div>
      <div className="k-stats" style={{ gridTemplateColumns: '1fr' }}>
        {d.banker.map((b, i) => (
          <div className="k-stat" key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderColor: 'var(--purple)' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{b.label}</div>
              <div className="eyebrow" style={{ marginTop: 4 }}>{b.detail} · {b.league}</div>
            </div>
            <div className="num" style={{ fontWeight: 700, fontSize: 26, color: 'var(--win)' }}>{b.prob_pct.toFixed(0)}%</div>
          </div>
        ))}
      </div>

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


      {hist && hist.snapshot_date && (
        <>
          <div className="k-sh" style={{ marginTop: 40 }}>How last week&rsquo;s picks did <span className="sub">graded from real results</span></div>
          {Object.keys(hist.markets).map(mk => {
            const rate = hist.rates[mk];
            return (
              <div key={mk} style={{ marginTop: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700 }}>{HIST_LABELS[mk] || mk}</span>
                  {rate && <span className="num" style={{ color: 'var(--purple)', fontWeight: 700 }}>{rate.right}/{rate.total} ✓</span>}
                </div>
                {hist.markets[mk].map((p, i) => {
                  const who = p.team ? `${p.team} (vs ${p.opponent})` : `${p.home} v ${p.away}`;
                  const ok = p.verdict === 'right';
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, borderBottom: '1px solid var(--rule)' }}>
                      <span>{ok ? '✓' : '✗'} {who}</span>
                      <span style={{ color: 'var(--ink-2)' }}>{p.actual}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </>
      )}

      <p className="pred-disclaimer" style={{ marginTop: 28 }}>Estimates from team form · a guide, not a guarantee. Higher lines (18.5 shots) read modest by design.</p>
    </div>
  );
}
