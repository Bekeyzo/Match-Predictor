'use client';
import { Fixture } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function FixtureCard({
  fixture,
  leagueCode,
}: {
  fixture: Fixture;
  leagueCode: string;
}) {
  const router = useRouter();

  const kickoff = new Date(fixture.utcDate).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Lagos', // Nigerian time
  });

  const matchDate = new Date(fixture.utcDate).toISOString().split('T')[0];

  const handleClick = () => {
    const params = new URLSearchParams({
      home: fixture.homeTeam.name,
      away: fixture.awayTeam.name,
      date: matchDate,
      league: leagueCode,
    });
    router.push(`/match?${params.toString()}`);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        background: 'white',
        border: '1px solid #EDE9FE',
        borderRadius: '12px',
        padding: '16px 20px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#7C3AED';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(124, 58, 237, 0.12)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#EDE9FE';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      }}
    >
      {/* Kickoff time */}
      <div style={{
        background: '#EDE9FE',
        color: '#7C3AED',
        padding: '6px 10px',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: 700,
        minWidth: '52px',
        textAlign: 'center',
        fontFamily: 'monospace',
      }}>
        {kickoff}
      </div>

      {/* Teams */}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '14px', color: '#1E1B4B' }}>
          {fixture.homeTeam.name}
        </div>
        <div style={{ fontWeight: 700, fontSize: '14px', color: '#1E1B4B', marginTop: '2px' }}>
          {fixture.awayTeam.name}
        </div>
      </div>

      {/* Status */}
      <div style={{
        fontSize: '11px',
        color: fixture.status === 'LIVE' ? '#10B981' : '#6B7280',
        fontWeight: fixture.status === 'LIVE' ? 700 : 400,
      }}>
        {fixture.status === 'SCHEDULED' ? 'Predict →' : fixture.status}
      </div>
    </div>
  );
}