import { PredictionResult } from '@/lib/api';
import ProbabilityBar from './ProbabilityBar';

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      background: '#F5F3FF',
      borderRadius: '8px',
      padding: '12px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '18px', fontWeight: 700, color: '#1E1B4B', fontFamily: 'monospace' }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
    </div>
  );
}

export default function PredictionCard({
  prediction,
  cached,
}: {
  prediction: PredictionResult;
  cached: boolean;
}) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      border: '1px solid #EDE9FE',
      overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(124, 58, 237, 0.08)',
    }} className="fade-in">

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
        padding: '24px',
        color: 'white',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: '13px', opacity: 0.8, marginBottom: '8px' }}>Match Prediction</div>
          {cached && (
            <span style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '2px 8px',
              borderRadius: '999px',
              fontSize: '11px',
            }}>
              ⚡ Cached
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '20px', fontWeight: 800 }}>{prediction.home_team}</div>
            <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>HOME</div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, opacity: 0.6, padding: '0 16px' }}>VS</div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '20px', fontWeight: 800 }}>{prediction.away_team}</div>
            <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>AWAY</div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '24px' }}>

        {/* Probability bar — the signature element */}
        <ProbabilityBar
          home={prediction.home_win_prob_pct}
          draw={prediction.draw_prob_pct}
          away={prediction.away_win_prob_pct}
          predicted={prediction.predicted_result}
        />

        <div style={{ height: '24px' }} />

        {/* Goals section */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
            Goals
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            <StatBox label="Home xG" value={prediction.expected_home_goals} />
            <StatBox label="Away xG" value={prediction.expected_away_goals} />
            <StatBox label="Most Likely" value={prediction.most_likely_score} />
            <StatBox label="Total xG" value={prediction.expected_total_goals} />
          </div>
        </div>

        {/* Markets section */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
            Markets
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            <StatBox label="BTTS %" value={`${prediction.btts_prob_pct}%`} />
            <StatBox label="Over 2.5 %" value={`${prediction.prob_over_2_5_pct}%`} />
            <StatBox label="Score %" value={`${prediction.prob_most_likely_score_pct}%`} />
          </div>
        </div>

        {/* Corners section */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
            Corners
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            <StatBox label="Home" value={prediction.expected_home_corners} />
            <StatBox label="Away" value={prediction.expected_away_corners} />
            <StatBox label="Total" value={prediction.expected_total_corners} />
          </div>
        </div>

        {/* Cards section */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
            Cards
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            <StatBox label="Home" value={prediction.expected_home_cards} />
            <StatBox label="Away" value={prediction.expected_away_cards} />
            <StatBox label="Total" value={prediction.expected_total_cards} />
          </div>
        </div>
      </div>
    </div>
  );
}