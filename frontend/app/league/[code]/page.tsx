'use client';
import { useEffect, useState, use, useCallback } from 'react';
import Spinner from '@/components/Spinner';
import { useRouter } from 'next/navigation';
import { getFixtures, getPredictionDates, getPredictionHistory, Fixture } from '@/lib/api';

function strongPickLabel(pick: string | undefined, home: string, away: string): string {
  switch (pick) {
    case 'home': return `${home} to win`;
    case 'away': return `${away} to win`;
    case 'draw': return 'Draw';
    case 'over_1_5': return 'Over 1.5 goals';
    case 'over_2_5': return 'Over 2.5 goals';
    case 'over_3_5': return 'Over 3.5 goals';
    case 'btts': return 'Both teams to score';
    default: return '';
  }
}

const FLAG: Record<string, string> = {
  PL:'gb-eng', ELC:'gb-eng', PD:'es', PD2:'es', BL1:'de', BL2:'de',
  SA:'it', SB:'it', FL1:'fr', FL2:'fr', DED:'nl', PPL:'pt', PPL2:'pt',
  SPL:'gb-sct', SPL2:'gb-sct', BEL:'be', GSL:'gr',
};

function useTilt() {
  return useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--ry', `${(x - 0.5) * 4}deg`);
    el.style.setProperty('--rx', `${(0.5 - y) * 4}deg`);
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
  }, []);
}
const resetTilt = (e: React.MouseEvent<HTMLDivElement>) => {
  e.currentTarget.style.setProperty('--rx', '0deg');
  e.currentTarget.style.setProperty('--ry', '0deg');
};

export default function LeaguePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [today, setToday] = useState('');
  const [loading, setLoading] = useState(true);
  const [pastDates, setPastDates] = useState<string[]>([]);
  const [pastIdx, setPastIdx] = useState(-1); // -1 = live view; 0+ = index into pastDates
  const [nextDate, setNextDate] = useState('');
  const [pastPreds, setPastPreds] = useState<{ home_team: string; away_team: string; prediction: { predicted_result?: string; home_win_prob_pct?: number; draw_prob_pct?: number; away_win_prob_pct?: number }; verdict?: string | null; result?: { pick?: string; home_goals?: number; away_goals?: number } | null }[]>([]);
  const [pastLoading, setPastLoading] = useState(false);
  const tilt = useTilt();

  useEffect(() => {
    getFixtures(code)
      .then(res => { setFixtures(res.data.fixtures || []); setToday(res.data.date); setNextDate(res.data.next_fixture_date || ''); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [code]);

  useEffect(() => {
    getPredictionDates(code)
      .then(res => setPastDates(res.data.dates || []))
      .catch(() => setPastDates([]));
  }, [code]);

  const activePastDate = pastIdx >= 0 ? pastDates[pastIdx] : null;

  useEffect(() => {
    if (!activePastDate) { setPastPreds([]); return; }
    setPastLoading(true);
    getPredictionHistory(code, activePastDate)
      .then(res => setPastPreds(res.data.predictions || []))
      .catch(() => setPastPreds([]))
      .finally(() => setPastLoading(false));
  }, [code, activePastDate]);

  const openStored = (homeTeam: string, awayTeam: string) => {
    if (!activePastDate) return;
    const q = new URLSearchParams({
      home: homeTeam, away: awayTeam, date: activePastDate, league: code, stored: '1',
    });
    router.push(`/match?${q}`);
  };

  useEffect(() => {
    const io = new IntersectionObserver(
      es => es.forEach(e => { if (e.isIntersecting) e.target.classList.add('seen'); }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
    return () => io.disconnect();
  });

  const grouped = fixtures.reduce((acc, f) => {
    (acc[f.utcDate.split('T')[0]] ||= []).push(f); return acc;
  }, {} as Record<string, Fixture[]>);
  const days = Object.keys(grouped).sort();
  const leagueName = fixtures[0]?.competition?.name ?? code;

  const label = (day: string) => {
    if (day === today) return 'Today';
    const diff = Math.round((+new Date(day) - +new Date(today)) / 86400000);
    if (diff === 1) return 'Tomorrow';
    return new Date(day).toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' });
  };

  const open = (f: Fixture) => {
    const q = new URLSearchParams({
      home: f.homeTeam.name, away: f.awayTeam.name,
      date: f.utcDate.split('T')[0], league: code,
    });
    router.push(`/match?${q}`);
  };

  return (
    <div>
      <div className="aurora">
        <div className="aurora-blob aurora-1" />
        <div className="aurora-blob aurora-2" />
      </div>

      <a href="/" className="back">← All leagues</a>

      <div className="lg-head">
        <div className="flag-crest lg-crest">
          <span className={`fi fi-${FLAG[code] ?? 'xx'}`} />
        </div>
        <div>
          <p className="eyebrow">{code}</p>
          <h1 className="display" style={{ fontSize:32, marginTop:6 }}>{leagueName}</h1>
        </div>
      </div>

      <p style={{ color:'var(--ink-2)', fontSize:14, margin:'14px 0 14px' }}>
        {loading ? 'Loading fixtures…'
          : pastIdx >= 0 ? 'Predicted before this matchday'
          : fixtures.length ? `Next ${fixtures.length} fixtures`
          : 'Nothing scheduled right now'}
      </p>

      {pastDates.length > 0 && (
        <div className="md-stepper">
          <button className="md-step-btn"
                  disabled={pastIdx >= pastDates.length - 1}
                  onClick={() => setPastIdx(i => Math.min(i + 1, pastDates.length - 1))}
                  aria-label="Older matchday">◀</button>
          <span className="md-step-label">
            {pastIdx < 0
              ? 'Current fixtures'
              : new Date(pastDates[pastIdx]).toLocaleDateString('en-GB',
                  { weekday:'short', day:'numeric', month:'short' })}
          </span>
          <button className="md-step-btn"
                  disabled={pastIdx < 0}
                  onClick={() => setPastIdx(i => i - 1)}
                  aria-label="Newer matchday">▶</button>
        </div>
      )}

      {pastIdx >= 0 ? (
        pastLoading ? (
          <Spinner block label="Loading predictions…" />
        ) : pastPreds.length === 0 ? (
          <div className="state">No stored predictions for this matchday.</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {(() => {
              const right = pastPreds.filter(p => p.verdict === 'right').length;
              const wrong = pastPreds.filter(p => p.verdict === 'wrong').length;
              if (right + wrong === 0) return null;
              return (
                <div className="matchday-tally">
                  Model this matchday: <span className="tally-right">{right} ✓</span>
                  <span className="tally-sep">·</span>
                  <span className="tally-wrong">{wrong} ✗</span>
                </div>
              );
            })()}
            {pastPreds.map((pp, i) => {
              const res = pp.result as { pick?: string; home_goals?: number; away_goals?: number } | null;
              const pick = res?.pick;
              const pickText = strongPickLabel(pick, pp.home_team, pp.away_team);
              const score = res && res.home_goals != null && res.away_goals != null
                ? `${res.home_goals}–${res.away_goals}` : null;
              return (
                <div key={i} className="fx-row tilt"
                     onMouseMove={tilt} onMouseLeave={resetTilt}
                     onClick={() => openStored(pp.home_team, pp.away_team)}>
                  <span className="tilt-sheen" />
                  <div className="fx-teams">
                    <div className="fx-team">{pp.home_team}</div>
                    <div className="fx-team">{pp.away_team}</div>
                  </div>
                  <div className="fx-verdict-wrap">
                    {pickText && <span className="fx-pick">Pick: {pickText}</span>}
                    {pp.verdict === 'right' && (
                      <span className="fx-grade fx-right">✓ Called it right{score ? ` · ${score}` : ''}</span>
                    )}
                    {pp.verdict === 'wrong' && (
                      <span className="fx-grade fx-wrong">✗ Called it wrong{score ? ` · ${score}` : ''}</span>
                    )}
                    {!pp.verdict && (
                      <span className="fx-grade fx-pending">· Awaiting result</span>
                    )}
                  </div>
                  <span className="fx-cta">View →</span>
                </div>
              );
            })}
          </div>
        )
      ) : loading ? (
        <Spinner block label="Loading fixtures…" />
      ) : days.length === 0 ? (
        <div className="empty-fixtures">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <div className="empty-title">No fixtures in the next 7 days</div>
          {nextDate ? (
            <div className="empty-sub">Next up: <strong>{new Date(nextDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</strong></div>
          ) : (
            <div className="empty-sub">This league is between matchdays right now. Fixtures usually appear a few days before the next round — check back closer to the weekend.</div>
          )}
        </div>
      ) : (
        days.map(day => (
          <section key={day} className="reveal">
            <div className="section-head">
              <span className="group-name"
                    style={day === today ? { color:'var(--purple)' } : undefined}>
                {label(day)}
              </span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {grouped[day].map(f => (
                <div key={f.id} className="fx-row tilt"
                     onMouseMove={tilt} onMouseLeave={resetTilt}
                     onClick={() => open(f)}>
                  <span className="tilt-sheen" />
                  <span className="fx-time">
                    {new Date(f.utcDate).toLocaleTimeString('en-GB',
                      { hour:'2-digit', minute:'2-digit', timeZone:'Africa/Lagos' })}
                  </span>
                  <div className="fx-teams">
                    <div className="fx-team">{f.homeTeam.name}</div>
                    <div className="fx-team">{f.awayTeam.name}</div>
                  </div>
                  <span className="fx-cta">Predict →</span>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}