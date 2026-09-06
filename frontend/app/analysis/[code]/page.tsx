'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getAnalysis, TeamStat } from '@/lib/api';

export default function AnalysisPage() {
  const params = useParams();
  const code = (params?.code as string) || '';
  const [teams, setTeams] = useState<TeamStat[] | null>(null);
  const [season, setSeason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    getAnalysis(code)
      .then((res) => { setTeams(res.data.teams || []); setSeason(res.data.season_start); })
      .catch(() => setError('Could not load analysis.'));
  }, [code]);

  if (error) return <div style={{ padding: 40, textAlign: 'center' }}>{error}<br /><a href="/" className="back">← Back</a></div>;
  if (!teams) return <div style={{ padding: 40, textAlign: 'center' }}>Loading analysis…</div>;

  const byShots = [...teams].sort((a, b) => b.shots_pg - a.shots_pg);
  const byCorners = [...teams].sort((a, b) => b.corners_pg - a.corners_pg);
  const byFouls = [...teams].sort((a, b) => b.fouls_pg - a.fouls_pg);
  const byCards = [...teams].sort((a, b) => b.cards_pg - a.cards_pg);

  const Table = ({ title, rows, metric, extra }: { title: string; rows: TeamStat[]; metric: 'shots_pg' | 'corners_pg' | 'fouls_pg' | 'cards_pg'; extra?: 'sot_pg' }) => (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12, color: '#1E1B4B' }}>{title}</h2>
      <table className="stat-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>#</th>
            <th style={{ textAlign: 'left' }}>Team</th>
            <th>Games</th>
            <th>{metric === 'shots_pg' ? 'Shots/game' : metric === 'corners_pg' ? 'Corners/game' : metric === 'fouls_pg' ? 'Fouls/game' : 'Cards/game'}</th>
            {extra && <th>On Target/game</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <tr key={t.team}>
              <td>{i + 1}</td>
              <td style={{ textAlign: 'left', fontWeight: 600 }}>{t.team}</td>
              <td>{t.games}</td>
              <td className="lead">{t[metric].toFixed(1)}</td>
              {extra && <td>{t.sot_pg.toFixed(1)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      <a href="/" className="back">← Back to leagues</a>
      <h1 style={{ fontSize: 26, fontWeight: 900, margin: '12px 0 4px' }}>{code} · Shots & Corners</h1>
      <p className="eyebrow" style={{ marginBottom: 24 }}>Current season averages · since {season}</p>
      <Table title="Most shots per game" rows={byShots} metric="shots_pg" extra="sot_pg" />
      <Table title="Most corners per game" rows={byCorners} metric="corners_pg" />
      <Table title="Most fouls per game" rows={byFouls} metric="fouls_pg" />
      <Table title="Most cards per game" rows={byCards} metric="cards_pg" />
      <p className="pred-disclaimer">Averages from real match data · updates as the season progresses.</p>
    </div>
  );
}
