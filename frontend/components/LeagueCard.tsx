'use client';
import { League } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function LeagueCard({ league }: { league: League }) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/league/${league.code}`)}
      style={{
        background: 'white',
        border: '1px solid #EDE9FE',
        borderRadius: '12px',
        padding: '20px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#7C3AED';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(124, 58, 237, 0.15)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#EDE9FE';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      }}
    >
      <span style={{ fontSize: '32px' }}>{league.flag}</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: '15px', color: '#1E1B4B' }}>
          {league.name}
        </div>
        <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
          {league.code}
        </div>
      </div>
      <div style={{ marginLeft: 'auto', color: '#7C3AED', fontSize: '18px' }}>→</div>
    </div>
  );
}