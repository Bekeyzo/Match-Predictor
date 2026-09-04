'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getLeagues, getFeatured, League, FeaturedFixture } from '@/lib/api';
import AuthModal from '@/components/AuthModal';
import AccuracyCard from '@/components/AccuracyCard';

const META: Record<string, { country: string; flag: string; tier: number }> = {
  PL:{country:'England',flag:'gb-eng',tier:1}, ELC:{country:'England',flag:'gb-eng',tier:2},
  PD:{country:'Spain',flag:'es',tier:1}, PD2:{country:'Spain',flag:'es',tier:2},
  BL1:{country:'Germany',flag:'de',tier:1}, BL2:{country:'Germany',flag:'de',tier:2},
  SA:{country:'Italy',flag:'it',tier:1}, SB:{country:'Italy',flag:'it',tier:2},
  FL1:{country:'France',flag:'fr',tier:1}, FL2:{country:'France',flag:'fr',tier:2},
  DED:{country:'Netherlands',flag:'nl',tier:1}, PPL:{country:'Portugal',flag:'pt',tier:1},
  BEL:{country:'Belgium',flag:'be',tier:1}, GSL:{country:'Greece',flag:'gr',tier:1},
};
const ORDER = ['England','Spain','Germany','Italy','France','Netherlands','Portugal','Belgium','Greece'];

function useCountUp(target: number, run: boolean, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min((t - t0) / ms, 1);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return v;
}

function useTilt() {
  return useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--ry', `${(x - 0.5) * 7}deg`);
    el.style.setProperty('--rx', `${(0.5 - y) * 7}deg`);
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
  }, []);
}
const resetTilt = (e: React.MouseEvent<HTMLDivElement>) => {
  e.currentTarget.style.setProperty('--rx', '0deg');
  e.currentTarget.style.setProperty('--ry', '0deg');
};

function Headline({ text }: { text: string }) {
  return (
    <>
      {text.split(' ').map((w, i) => (
        <span key={i} className="word" style={{ animationDelay: `${i * 70}ms` }}>
          {w}&nbsp;
        </span>
      ))}
    </>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [featured, setFeatured] = useState<FeaturedFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const tilt = useTilt();
  const [gateOpen, setGateOpen] = useState(false);
  const [pending, setPending] = useState<FeaturedFixture | null>(null);

  useEffect(() => {
    getLeagues().then(r => setLeagues(r.data)).catch(console.error).finally(() => setLoading(false));
    getFeatured().then(r => setFeatured(r.data.fixtures || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(
      es => es.forEach(e => { if (e.isIntersecting) e.target.classList.add('seen'); }),
      { threshold: 0.12 }
    );
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
    return () => io.disconnect();
  });

  const nLeagues  = useCountUp(leagues.length, !loading);
  const nSeasons  = useCountUp(5, !loading, 700);
  const nFeatured = useCountUp(featured.length, featured.length > 0, 700);

  const go = (f: FeaturedFixture) => {
    const q = new URLSearchParams({
      home: f.home_team, away: f.away_team,
      date: f.utc_date.split('T')[0], league: f.league,
    });
    router.push(`/match?${q}`);
  };

  const openMatch = (f: FeaturedFixture) => {
    if (localStorage.getItem('token')) { go(f); return; }
    setPending(f);
    setGateOpen(true);
  };

  const when = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day:'numeric', month:'short' }) + ' · ' +
           d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', timeZone:'Africa/Lagos' });
  };

  const grouped = leagues.reduce((acc, l) => {
    const c = META[l.code]?.country ?? 'Other'; (acc[c] ||= []).push(l); return acc;
  }, {} as Record<string, League[]>);
  const countries = ORDER.filter(c => grouped[c]);

  return (
    <div>
      <div className="aurora">
        <div className="aurora-blob aurora-1" />
        <div className="aurora-blob aurora-2" />
        <div className="aurora-blob aurora-3" />
      </div>

      <div className="home-grid">
        <div>
          <p className="eyebrow">Model-led predictions</p>
          <h1 className="display" style={{ fontSize:46, margin:'12px 0 4px' }}>
            <Headline text="Pick your league." /><br />
            <Headline text="See who&rsquo;s favoured." />
          </h1>

          <div className="stats">
            <div><div className="stat-n">{nLeagues}</div><div className="stat-l">Competitions</div></div>
            <div><div className="stat-n">{nSeasons}</div><div className="stat-l">Seasons of data</div></div>
            <div><div className="stat-n">{nFeatured}</div><div className="stat-l">Featured now</div></div>
          </div>

          {loading ? (
            <>
              <div className="section-head"><span className="group-name">Loading</span></div>
              <div className="tiles">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skel skel-tile" />)}
              </div>
            </>
          ) : (
            <>
              {featured.length > 0 && (
                <div className="reveal">
                  <div className="section-head"><span className="group-name">Featured</span></div>
                  <div className="feat-rail">
                    {featured.map(f => (
                      <div key={f.id} className="feat-card tilt"
                           onMouseMove={tilt} onMouseLeave={resetTilt}
                           onClick={() => openMatch(f)}>
                        <span className="tilt-sheen" />
                        <div className="feat-league">
                          <span className={`fi fi-${META[f.league]?.flag ?? 'xx'}`} />
                          {f.league_name}
                        </div>
                        <div className="feat-team">{f.home_team}</div>
                        <div className="feat-vs">vs</div>
                        <div className="feat-team">{f.away_team}</div>
                        <div className="feat-when">{when(f.utc_date)}</div>
                        <div className="feat-cta">Predict →</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {countries.map(country => (
                <section key={country} className="reveal">
                  <div className="section-head"><span className="group-name">{country}</span></div>
                  <div className="tiles">
                    {grouped[country]
                      .sort((a,b)=>(META[a.code]?.tier??9)-(META[b.code]?.tier??9))
                      .map(l => {
                        const m = META[l.code];
                        return (
                          <div key={l.code} className="flag-tile tilt"
                               onMouseMove={tilt} onMouseLeave={resetTilt}
                               onClick={() => router.push(`/league/${l.code}`)}>
                            <span className="tilt-sheen" />
                            <div className="flag-crest">
                              <span className={`fi fi-${m?.flag ?? 'xx'}`} />
                            </div>
                            <div className="flag-body">
                              <div className="flag-name">
                                {l.name}
                                {m?.tier === 2 && <span className="flag-tier">2nd</span>}
                              </div>
                              <div className="flag-sub">{m?.country}</div>
                            </div>
                            <span className="flag-go">→</span>
                          </div>
                        );
                      })}
                  </div>
                </section>
              ))}
            </>
          )}
        </div>

        <aside className="side">
          <AccuracyCard />

          <div className="side-card">
            <div className="side-title">How it works</div>
            <ol className="steps">
              <li><span className="step-n">1</span> Pick a league</li>
              <li><span className="step-n">2</span> Choose a fixture</li>
              <li><span className="step-n">3</span> Read the model&rsquo;s call</li>
            </ol>
          </div>

          <div className="side-card disclaimer">
            <div className="side-title">Heads up</div>
            <p className="side-note">
              These predictions come from an AI model trained on past results. They
              estimate what is <em>likely</em> — they are not a guarantee of the actual
              outcome. Football is unpredictable, which is rather the point of it.
            </p>
            <p className="side-note" style={{ marginBottom: 0 }}>
              Treat them as a guide, never as a certainty.
            </p>
          </div>
        </aside>
      </div>

      <AuthModal
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        onSignedIn={() => { if (pending) go(pending); }}
      />
    </div>
  );
}
