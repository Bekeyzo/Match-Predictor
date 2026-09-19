'use client';
import { useEffect, useState } from 'react';
import { getLeaguePatterns, LeaguePatterns } from '@/lib/api';

const LEAGUES: { code: string; name: string }[] = [
  { code:'PL', name:'Premier League' }, { code:'ELC', name:'Championship' },
  { code:'PD', name:'La Liga' }, { code:'BL1', name:'Bundesliga' },
  { code:'SA', name:'Serie A' }, { code:'FL1', name:'Ligue 1' },
  { code:'DED', name:'Eredivisie' }, { code:'PPL', name:'Primeira Liga' },
  { code:'SB', name:'Serie B' }, { code:'PD2', name:'Segunda División' },
  { code:'BL2', name:'2. Bundesliga' }, { code:'FL2', name:'Ligue 2' },
  { code:'GSL', name:'Super League Greece' }, { code:'BEL', name:'Belgian Pro League' },
  { code:'TUR', name:'Süper Lig' },
];

export default function LeaguePatternsPage() {
  const [data, setData] = useState<Record<string, LeaguePatterns>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(LEAGUES.map(l =>
      getLeaguePatterns(l.code).then(r => [l.code, r.data] as const).catch(() => [l.code, null] as const)
    )).then(results => {
      const map: Record<string, LeaguePatterns> = {};
      results.forEach(([code, d]) => { if (d) map[code] = d; });
      setData(map);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="state">Studying every league&rsquo;s season…</div>;

  return (
    <div className="wrap" style={{ maxWidth: 760 }}>
      <a href="/" className="back">← Back to leagues</a>
      <h1 className="display" style={{ fontSize: 30, margin: '12px 0 4px' }}>League Patterns</h1>
      <p className="eyebrow" style={{ marginBottom: 8 }}>What each league reliably does this season · real hit-rates</p>

      {LEAGUES.map(l => {
        const d = data[l.code];
        if (!d || !d.markets || d.markets.length === 0) return null;
        return (
          <div key={l.code} style={{ marginTop: 28 }}>
            <div className="k-sh">{l.name} <span className="sub">{d.games} games this season</span></div>
            <div className="k-stat">
              {d.markets.slice(0, 5).map((m, i) => (
                <div className="row" key={i} style={i > 0 ? { marginTop: 11, paddingTop: 11, borderTop: '1px solid var(--rule)' } : {}}>
                  <span className="k">{m.market}</span>
                  <span className="v num" style={{ color: m.hit_rate >= 75 ? 'var(--win)' : 'var(--ink)' }}>{m.hit_rate}%</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <p className="pred-disclaimer" style={{ marginTop: 28 }}>Season hit-rate = share of this league&rsquo;s games so far where the market landed. Descriptive of the league&rsquo;s tendency, not a guarantee for any single match.</p>
    </div>
  );
}
