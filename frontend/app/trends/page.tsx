'use client';
import { useEffect, useState } from 'react';
import { getTrends, TrendStat } from '@/lib/api';

const LEAGUE_NAMES: Record<string, string> = {
  PL:'Premier League', ELC:'Championship', PD:'La Liga', PD2:'Segunda División',
  BL1:'Bundesliga', BL2:'2. Bundesliga', SA:'Serie A', SB:'Serie B',
  FL1:'Ligue 1', FL2:'Ligue 2', DED:'Eredivisie', DED2:'Eerste Divisie',
  PPL:'Primeira Liga', PPL2:'Liga Portugal 2', SPL:'Scottish Premiership',
  SPL2:'Scottish Championship', BEL:'Belgian Pro League', BEL2:'Challenger Pro',
  GSL:'Super League Greece', GSL2:'Super League 2', TUR:'Süper Lig',
};

const STAT_META: { key: 'shots'|'sot'|'corners'|'fouls'|'cards'; label: string; sub: string; unit: string }[] = [
  { key:'shots',   label:'Most shots',   sub:'per game',  unit:'shots' },
  { key:'sot',     label:'Most shots on target', sub:'per game', unit:'on target' },
  { key:'corners', label:'Most corners', sub:'per game',  unit:'corners' },
  { key:'fouls',   label:'Most fouls',   sub:'per game',  unit:'fouls' },
  { key:'cards',   label:'Most cards',   sub:'per game',  unit:'cards' },
];

export default function TrendsPage() {
  const [data, setData] = useState<Record<string, TrendStat> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getTrends().then(r => setData(r.data as unknown as Record<string, TrendStat>))
      .catch(() => setError('Could not load trends.'));
  }, []);

  if (error) return <div className="state">{error}<br /><a href="/" className="back" style={{ marginTop:18 }}>← Back</a></div>;
  if (!data) return <div className="state">Loading league trends…</div>;

  return (
    <div className="wrap" style={{ maxWidth: 760 }}>
      <a href="/" className="back">← Back to leagues</a>
      <h1 className="display" style={{ fontSize: 30, margin: '12px 0 4px' }}>League Trends</h1>
      <p className="eyebrow" style={{ marginBottom: 8 }}>Which leagues lead each stat this season · updates weekly</p>

      {STAT_META.map(({ key, label, sub, unit }) => {
        const s = data[key];
        if (!s || !s.league) return null;
        return (
          <div key={key} style={{ marginTop: 28 }}>
            <div className="k-sh">{label} <span className="sub">{sub}</span></div>
            <div className="k-stat" style={{ marginBottom: 12 }}>
              <div className="row">
                <span className="k" style={{ fontWeight:700, color:'var(--ink)' }}>{LEAGUE_NAMES[s.league] || s.league}</span>
                <span className="v num" style={{ color:'var(--purple)' }}>{s.league_avg} {unit}/game</span>
              </div>
            </div>
            <table className="stat-table" style={{ width:'100%' }}>
              <thead><tr>
                <th style={{ textAlign:'left' }}>#</th>
                <th style={{ textAlign:'left' }}>Team</th>
                <th>Games</th>
                <th>{unit}/game</th>
              </tr></thead>
              <tbody>
                {s.top_teams.map((t, i) => (
                  <tr key={t.team}>
                    <td>{i + 1}</td>
                    <td style={{ textAlign:'left', fontWeight:600 }}>{t.team}</td>
                    <td>{t.games}</td>
                    <td className="lead">{t.avg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      <p className="pred-disclaimer" style={{ marginTop: 28 }}>Current-season averages from real match data · early-season samples are small and will settle.</p>
    </div>
  );
}
