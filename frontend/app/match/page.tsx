'use client';
import { useEffect, useState, Suspense, useCallback } from 'react';
import Spinner from '@/components/Spinner';
import { useSearchParams } from 'next/navigation';
import { getPrediction, resendVerification, getPredictionHistory, PredictionResult } from '@/lib/api';
import AuthCard from '@/components/AuthCard';

type WithForm = PredictionResult & { home_form?: string[]; away_form?: string[] };

function useCountUp(target: number, run: boolean, ms = 950) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min((t - t0) / ms, 1);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return v;
}

function FormLine({ form, away }: { form?: string[]; away?: boolean }) {
  if (!form?.length) return null;
  return (
    <div className={`form-line${away ? ' away' : ''}`}>
      {form.map((r, i) => (
        <span key={i} className={`form-chip form-${r.toLowerCase()}`}
              style={{ animationDelay: `${i * 70}ms` }}>{r}</span>
      ))}
    </div>
  );
}

function MatchContent() {
  const q = useSearchParams();
  const home = q.get('home') || '', away = q.get('away') || '';
  const date = q.get('date') || '', league = q.get('league') || '';
  const stored = q.get('stored') === '1';

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [p, setP] = useState<WithForm | null>(null);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unverified, setUnverified] = useState(false);
  const [resent, setResent] = useState(false);
  const [run, setRun] = useState(false);

  useEffect(() => {
    setAuthed(!!localStorage.getItem('token'));
  }, []);

  const load = useCallback(() => {
    if (!home || !away || !date || !league) return;
    setLoading(true); setError(''); setUnverified(false);
    if (stored) {
      getPredictionHistory(league, date)
        .then(res => {
          const items = res.data.predictions || [];
          const match = items.find((it: { home_team: string; away_team: string }) =>
            it.home_team === home && it.away_team === away);
          if (match) { setP(match.prediction); setCached(false); }
          else setError('That stored prediction could not be found.');
        })
        .catch(() => setError('Could not load this stored prediction.'))
        .finally(() => setLoading(false));
      return;
    }
    getPrediction(home, away, date, league)
      .then(res => { setP(res.data.prediction); setCached(res.data.cached); })
      .catch((err: unknown) => {
        const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        if (code === 'unverified') setUnverified(true);
        else setError('Could not load this prediction. Please try again.');
      })
      .finally(() => setLoading(false));
  }, [home, away, date, league, stored]);

  useEffect(() => { if (stored || authed) load(); }, [authed, load, stored]);
  useEffect(() => { if (p) { const t = setTimeout(() => setRun(true), 120); return () => clearTimeout(t); } }, [p]);

  const called = p?.predicted_result ?? '';
  const topPct = useCountUp(
    called === 'H' ? (p?.home_win_prob_pct ?? 0)
      : called === 'A' ? (p?.away_win_prob_pct ?? 0)
      : (p?.draw_prob_pct ?? 0),
    run
  );

  const niceDate = date
    ? new Date(date).toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })
    : '';

  /* ---------- not signed in: gate ---------- */
  if (authed === false && !stored) {
    return (
      <div>
        <div className="aurora">
          <div className="aurora-blob aurora-1" />
          <div className="aurora-blob aurora-2" />
        </div>

        <button className="back" onClick={() => history.back()}>← Back to fixtures</button>

        <div className="gate">
          <div className="gate-preview">
            <p className="eyebrow">{league} · {niceDate}</p>
            <h1 className="display" style={{ fontSize:34, margin:'12px 0 4px' }}>{home}</h1>
            <div className="gate-v">versus</div>
            <h1 className="display" style={{ fontSize:34, margin:'4px 0 18px' }}>{away}</h1>

            <div className="gate-blur">
              <div className="gate-blur-row"><span /><span /><span /></div>
              <div className="gate-blur-bar" />
              <div className="gate-blur-row"><span /><span /><span /></div>
            </div>
            <p className="gate-tease">
              Win probabilities, expected goals, likeliest scoreline, corners and cards
              — all waiting behind a free account.
            </p>
          </div>

          <div className="gate-auth">
            <AuthCard
              heading="Sign in to see the prediction"
              note="Free account. Browse everything else without one."
              onSignedIn={() => setAuthed(true)}
            />
          </div>
        </div>
      </div>
    );
  }

  if (authed === null || loading) return (
    <Spinner block label="Loading prediction…" />
  );

  if (unverified) return (
    <div>
      <div className="aurora">
        <div className="aurora-blob aurora-1" />
        <div className="aurora-blob aurora-2" />
      </div>
      <button className="back" onClick={() => history.back()}>← Back to fixtures</button>
      <div className="gate">
        <div className="gate-auth">
          <div className="side-card">
            <div className="side-title">Verify your email to see predictions</div>
            <p className="side-note">
              We sent a confirmation link to your email. Click it to unlock predictions across all 14 leagues.
              Don't forget to check your spam folder.
            </p>
            <button
              className="btn-primary"
              style={{ marginTop: 14 }}
              disabled={resent}
              onClick={async () => {
                try { await resendVerification(); setResent(true); } catch {}
              }}
            >
              {resent ? 'Verification email sent ✓' : 'Resend verification email'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (error || !p) return (
    <div className="state">
      {error || 'No prediction available for this fixture.'}<br />
      <a href="/" className="back" style={{ marginTop:18 }}>← Back to leagues</a>
    </div>
  );

  const verdict = called === 'H' ? `${p.home_team} to win`
    : called === 'A' ? `${p.away_team} to win` : 'Honours even — a draw';

  // Model's pick with confidence tier (gap between top two outcomes)
  const outcomes = [
    { label: `${p.home_team} to win`, v: p.home_win_prob_pct },
    { label: 'a draw', v: p.draw_prob_pct },
    { label: `${p.away_team} to win`, v: p.away_win_prob_pct },
  ].sort((a, b) => b.v - a.v);
  const pickGap = outcomes[0].v - outcomes[1].v;
  const pickTier = pickGap >= 15 ? 'strong' : pickGap >= 5 ? 'lean' : 'close';
  const pickChip = pickTier === 'strong' ? 'Strong pick'
    : pickTier === 'lean' ? 'Model leans this way' : 'Close call';
  const pickLabel = outcomes[0].label;
  const pickPct = outcomes[0].v;

  return (
    <div>
      <div className="aurora">
        <div className="aurora-blob aurora-1" />
        <div className="aurora-blob aurora-2" />
      </div>

      <button className="back" onClick={() => history.back()}>← Back to fixtures</button>

      <div className="pred-shell">
        <div className="pred-head">
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <span className="eyebrow" style={{ color:'rgba(250,249,246,.5)' }}>
              {league} · {new Date(date).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}
            </span>
          </div>
          <div className="pred-teams">
            <div className="pred-team">
              <div className="pred-name">{p.home_team}</div>
              <div className="pred-side">Home</div>
              <FormLine form={p.home_form} />
            </div>
            <div className="pred-v">V</div>
            <div className="pred-team away">
              <div className="pred-name">{p.away_team}</div>
              <div className="pred-side">Away</div>
              <FormLine form={p.away_form} away />
            </div>
          </div>
        </div>

        <div className="strip-wrap">
          <div className="strip-legend">
            <span className="strip-item" style={{ color:'var(--home)' }}>
              Home<span className="num">{p.home_win_prob_pct.toFixed(1)}%</span></span>
            <span className="strip-item" style={{ color:'var(--draw)' }}>
              Draw<span className="num">{p.draw_prob_pct.toFixed(1)}%</span></span>
            <span className="strip-item" style={{ color:'var(--away)' }}>
              Away<span className="num">{p.away_win_prob_pct.toFixed(1)}%</span></span>
          </div>
          <div className="strip">
            <div className={`strip-seg${called==='H'?' on':''}`}
                 style={{ width: run ? `${p.home_win_prob_pct}%` : 0, background:'var(--home)' }} />
            <div className={`strip-seg${called==='D'?' on':''}`}
                 style={{ width: run ? `${p.draw_prob_pct}%` : 0, background:'var(--draw)', transitionDelay:'.07s' }} />
            <div className={`strip-seg${called==='A'?' on':''}`}
                 style={{ width: run ? `${p.away_win_prob_pct}%` : 0, background:'var(--away)', transitionDelay:'.14s' }} />
          </div>
          <div className={`pick-card pick-${pickTier} ${run ? 'in' : ''}`}>
            <div className="pick-head">
              <span className="pick-eyebrow">MODEL&rsquo;S PICK</span>
              <span className="pick-conf">{pickChip}</span>
            </div>
            <div className="pick-body">
              <span className="pick-label">{pickLabel}</span>
              <span className="pick-pct">{pickPct.toFixed(0)}%</span>
            </div>
          </div>
        </div>

        <div className="body">
          <table className="stat-table">
            <thead><tr><th>Expected</th><th>Home</th><th>Away</th><th>Total</th></tr></thead>
            <tbody>
              <tr><td>Goals</td>
                <td className="lead">{p.expected_home_goals.toFixed(2)}</td>
                <td className="lead">{p.expected_away_goals.toFixed(2)}</td>
                <td>{p.expected_total_goals.toFixed(2)}</td></tr>
              <tr><td>Corners</td>
                <td>{p.expected_home_corners.toFixed(1)}</td>
                <td>{p.expected_away_corners.toFixed(1)}</td>
                <td>{p.expected_total_corners.toFixed(1)}</td></tr>
              <tr><td>Cards</td>
                <td>{p.expected_home_cards.toFixed(1)}</td>
                <td>{p.expected_away_cards.toFixed(1)}</td>
                <td>{p.expected_total_cards.toFixed(1)}</td></tr>
            </tbody>
          </table>

          <div className="markets">
            <div>
              <div className="market-val">{p.most_likely_score}</div>
              <div className="eyebrow" style={{ marginTop:4 }}>
                Likeliest · {p.prob_most_likely_score_pct.toFixed(1)}%</div>
            </div>
            <div>
              <div className="market-val">{p.btts_prob_pct.toFixed(0)}%</div>
              <div className="eyebrow" style={{ marginTop:4 }}>Both score</div>
            </div>
            <div>
              <div className="market-val">{p.prob_over_1_5_pct.toFixed(0)}%</div>
              <div className="eyebrow" style={{ marginTop:4 }}>Over 1.5</div>
            </div>
            <div>
              <div className="market-val">{p.prob_over_2_5_pct.toFixed(0)}%</div>
              <div className="eyebrow" style={{ marginTop:4 }}>Over 2.5</div>
            </div>
            <div>
              <div className="market-val">{p.prob_over_3_5_pct.toFixed(0)}%</div>
              <div className="eyebrow" style={{ marginTop:4 }}>Over 3.5</div>
            </div>
          </div>

          <p className="pred-disclaimer">
            AI-generated estimate from past results — a guide, not a guarantee.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function MatchPage() {
  return (
    <Suspense fallback={<Spinner block label="Loading…" />}>
      <MatchContent />
    </Suspense>
  );
}
