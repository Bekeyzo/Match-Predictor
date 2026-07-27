export default function ProbabilityBar({
  home,
  draw,
  away,
  predicted,
}: {
  home: number;
  draw: number;
  away: number;
  predicted: string;
}) {
  return (
    <div style={{ width: '100%' }}>
      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', fontWeight: 600 }}>
        <span style={{ color: '#10B981' }}>Home {home.toFixed(1)}%</span>
        <span style={{ color: '#F59E0B' }}>Draw {draw.toFixed(1)}%</span>
        <span style={{ color: '#EF4444' }}>Away {away.toFixed(1)}%</span>
      </div>

      {/* Bar */}
      <div style={{
        display: 'flex',
        height: '10px',
        borderRadius: '999px',
        overflow: 'hidden',
        gap: '2px',
      }}>
        <div style={{
          width: `${home}%`,
          background: '#10B981',
          borderRadius: '999px 0 0 999px',
          boxShadow: predicted === 'H' ? '0 0 8px rgba(16, 185, 129, 0.6)' : 'none',
        }} />
        <div style={{
          width: `${draw}%`,
          background: '#F59E0B',
          boxShadow: predicted === 'D' ? '0 0 8px rgba(245, 158, 11, 0.6)' : 'none',
        }} />
        <div style={{
          width: `${away}%`,
          background: '#EF4444',
          borderRadius: '0 999px 999px 0',
          boxShadow: predicted === 'A' ? '0 0 8px rgba(239, 68, 68, 0.6)' : 'none',
        }} />
      </div>

      {/* Predicted outcome label */}
      <div style={{ textAlign: 'center', marginTop: '8px' }}>
        <span style={{
          background: '#EDE9FE',
          color: '#7C3AED',
          padding: '2px 10px',
          borderRadius: '999px',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.5px',
        }}>
          PREDICTED: {predicted === 'H' ? 'HOME WIN' : predicted === 'A' ? 'AWAY WIN' : 'DRAW'}
        </span>
      </div>
    </div>
  );
}