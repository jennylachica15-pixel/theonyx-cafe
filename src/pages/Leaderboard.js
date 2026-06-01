import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase/config';
import {
  collection, query, where, orderBy, limit, getDocs
} from 'firebase/firestore';

const GAME_LIST = [
  { id: 'snake',     label: 'Snake'              },
  { id: 'tetris',    label: 'Tetris'             },
  { id: 'racing',    label: 'Cafe Racer'         },
  { id: 'zombie',    label: 'Zombie Barista'     },
  { id: 'guessword', label: 'Guess the Word'     },
  { id: 'fairyq',    label: 'Friends & Questions'},
];

const GAME_NAMES = {
  snake:     'Snake',
  tetris:    'Tetris',
  racing:    'Cafe Racer',
  zombie:    'Zombie Barista',
  guessword: 'Guess the Word',
  fairyq:    'Friends & Questions',
};

const MC = ['#ffd700', '#c8d0dc', '#cd7f32'];
const MG = ['#ffd70099', '#c0c0c066', '#cd7f3266'];
const PH = [94, 68, 52];

const WEEKS = GAME_LIST.map(g => g.id);
const weekNum = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
const FEATURED_GAME = WEEKS[weekNum % WEEKS.length];

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Quicksand:wght@600;700&display=swap');
  @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
  @keyframes floatUp{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
  @keyframes crownSpin{0%,100%{transform:rotate(-8deg) scale(1)}50%{transform:rotate(8deg) scale(1.15)}}
  @keyframes lbGlow{0%,100%{box-shadow:0 0 8px #ffd70055}50%{box-shadow:0 0 20px #ffd700aa}}
  @keyframes lbPulse{0%,100%{opacity:1}50%{opacity:0.3}}
  @keyframes lbRankIn{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}
  @keyframes lbTicker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
  @keyframes lbFlashBorder{0%,100%{border-color:#ffd70033}50%{border-color:#ffd700aa}}
  @keyframes lbFadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  .lb-tab{flex-shrink:0;padding:9px 13px;border:none;font-size:11px;font-weight:700;cursor:pointer;font-family:'Quicksand',sans-serif;transition:all 0.2s;border-bottom:3px solid transparent;}
  .lb-tab.on{color:#1a0800;border-bottom:3px solid #ffe066;}
  .lb-tab:not(.on){background:transparent;color:#6a4820;}
  .lb-ri{animation:lbRankIn 0.3s ease both;}
  .lb-st{background:linear-gradient(90deg,#ffd700,#fff8cc,#ffaa00,#ffd700);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 2s linear infinite;}
  .lb-gs{background:linear-gradient(90deg,#c8943a,#ffd700,#c8943a);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 2.5s linear infinite;}
  .lb-cta{background:#1a0900;border:2px solid #ffd700;border-radius:12px;padding:14px;color:#ffd700;font-size:15px;font-weight:700;cursor:pointer;font-family:'Quicksand',sans-serif;width:100%;animation:lbGlow 2s ease-in-out infinite;letter-spacing:0.5px;}
  .lb-cta:hover{background:#2a1400;}
`;

function Avatar({ name, size, borderColor, glowColor }) {
  const initials = (name || '??').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: '#2a1400', border: `2px solid ${borderColor}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size > 40 ? 14 : 11, fontWeight: 700,
      color: borderColor, flexShrink: 0,
      boxShadow: `0 0 8px ${glowColor}`,
    }}>
      {initials}
    </div>
  );
}

function PodiumBlock({ player, rank, isFeatured, activeGame }) {
  const isFirst = rank === 0;
  const mc = MC[rank];
  const mg = MG[rank];
  const ph = PH[rank];
  const showDrink = isFirst && isFeatured && activeGame === FEATURED_GAME;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: 115, animation: `floatUp ${1.4 + rank * 0.3}s ease-in-out infinite` }}>
      {isFirst
        ? <div style={{ fontSize: 22, marginBottom: 2, filter: 'drop-shadow(0 0 8px #ffd700aa)', animation: 'crownSpin 2.5s ease-in-out infinite', display: 'inline-block' }}>&#128081;</div>
        : <div style={{ height: 28 }} />
      }
      {showDrink && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#ffd700', borderRadius: 6, padding: '2px 8px', marginBottom: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#1a0800', fontFamily: "'Quicksand',sans-serif" }}>FREE DRINK</span>
        </div>
      )}
      <Avatar name={player?.username || '?'} size={isFirst ? 48 : 38} borderColor={mc} glowColor={mg} />
      <div style={{ fontSize: isFirst ? 13 : 11, fontWeight: 700, color: '#f0ddb0', margin: '5px 0 2px', textAlign: 'center', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Quicksand',sans-serif" }}>
        {player?.username || '---'}
      </div>
      <div style={{ fontSize: isFirst ? 15 : 12, fontWeight: 700, color: mc, marginBottom: 6, filter: `drop-shadow(0 0 3px ${mc})`, fontFamily: "'Quicksand',sans-serif" }}>
        {player ? (player.score || 0).toLocaleString() : '---'}
      </div>
      <div style={{ width: '100%', height: ph, background: `${mc}12`, border: `1px solid ${mc}44`, borderBottom: 'none', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'Cinzel',serif", fontSize: 20, fontWeight: 900, color: mc, opacity: 0.7 }}>{rank + 1 === 1 ? '1' : rank + 1 === 2 ? '2' : '3'}</span>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const [activeGame, setActiveGame]     = useState(FEATURED_GAME);
  const [rows, setRows]                 = useState([]);
  const [loading, setLoading]           = useState(true);
  const [muted, setMuted]               = useState(false);
  const audioRef                        = useRef(null);

  // Week label
  const now       = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const fmt       = d => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  const weekLabel = `${fmt(weekStart)} – ${fmt(weekEnd)}`;

  // Music
  useEffect(() => {
    audioRef.current = new Audio('/game-music.mp3');
    audioRef.current.loop   = true;
    audioRef.current.volume = 0.3;
    audioRef.current.play().catch(() => {});
    return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } };
  }, []);

  const toggleMute = () => {
    setMuted(m => {
      if (audioRef.current) audioRef.current.muted = !m;
      return !m;
    });
  };

  // Fetch leaderboard
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'leaderboard'),
          where('gameId', '==', activeGame),
          orderBy('score', 'desc'),
          limit(10)
        );
        const snap = await getDocs(q);
        setRows(snap.docs.map(d => d.data()));
      } catch (e) {
        setRows([]);
      }
      setLoading(false);
    };
    fetch();
  }, [activeGame]);

  const top3    = rows.slice(0, 3);
  const rest    = rows.slice(3);
  const leader  = rows[0];
  const podiumOrder = [1, 0, 2]; // silver, gold, bronze

  return (
    <>
      <style>{CSS}</style>
      <div style={{ background: '#080400', minHeight: '100vh', fontFamily: "'Quicksand',sans-serif" }}>

        {/* Ticker */}
        <div style={{ background: '#ffd700', overflow: 'hidden', height: 24, display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', whiteSpace: 'nowrap', animation: 'lbTicker 16s linear infinite', fontSize: 11, fontWeight: 700, color: '#1a0800', letterSpacing: 1 }}>
            {[1, 2].map(i => (
              <span key={i} style={{ padding: '0 32px' }}>
                TOP SCORER THIS WEEK WINS 1 FREE DRINK &nbsp;&#9733;&nbsp; PLAY NOW AT THE GAME CORNER &nbsp;&#9733;&nbsp; REGISTER FREE &nbsp;&#9733;&nbsp;
              </span>
            ))}
          </div>
        </div>

        {/* Header */}
        <div style={{ background: '#1a0900', padding: '18px 20px 14px', textAlign: 'center', borderBottom: '1.5px solid #3d2000', position: 'relative' }}>
          {/* Mute button */}
          <button onClick={toggleMute} style={{ position: 'absolute', top: 14, right: 14, background: '#2a1400', border: '1px solid #5a3000', borderRadius: 20, padding: '5px 12px', color: '#c8943a', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Quicksand',sans-serif" }}>
            {muted ? 'unmute' : 'mute'}
          </button>
          <div style={{ fontSize: 36, display: 'inline-block', filter: 'drop-shadow(0 0 10px #ffd700aa)', animation: 'crownSpin 2.5s ease-in-out infinite' }}>&#127942;</div>
          <div className="lb-st" style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 900, letterSpacing: 3, margin: '5px 0 2px' }}>HALL OF FAME</div>
          <div style={{ fontSize: 10, color: '#7a5020', letterSpacing: 2, marginBottom: 10 }}>THEONYX CAFE GAME CORNER</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#2a1200', border: '1px solid #ffd70022', borderRadius: 20, padding: '5px 14px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#44ff88', display: 'inline-block', animation: 'lbPulse 1.2s infinite' }} />
            <span style={{ fontSize: 10, color: '#c8943a', fontWeight: 700 }}>Live rankings</span>
          </div>
        </div>

        {/* Weekly Banner */}
        <div style={{ margin: '14px 14px 0', borderRadius: 16, overflow: 'hidden', border: '1.5px solid #ffd70044', animation: 'lbFlashBorder 2.5s ease-in-out infinite' }}>
          <div style={{ background: '#1a0d00', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* SVG cup */}
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none" style={{ flexShrink: 0, filter: 'drop-shadow(0 0 6px #ffd70077)', animation: 'floatUp 2.5s ease-in-out infinite' }}>
                <rect x="8" y="18" width="24" height="18" rx="4" fill="#3d2200" stroke="#ffd700" strokeWidth="1.5" />
                <path d="M32 22 Q40 22 40 28 Q40 34 32 34" stroke="#ffd700" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <rect x="12" y="13" width="16" height="5" rx="2" fill="#2a1400" stroke="#ffd70066" strokeWidth="1" />
                <line x1="16" y1="10" x2="16" y2="13" stroke="#c8943a" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="22" y1="9" x2="22" y2="13" stroke="#c8943a" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="28" y1="10" x2="28" y2="13" stroke="#c8943a" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                  <div style={{ background: '#ffd700', borderRadius: 6, padding: '2px 8px', fontSize: 9, fontWeight: 700, color: '#1a0800', letterSpacing: 1 }}>THIS WEEK</div>
                  <div style={{ fontSize: 10, color: '#5a3a10' }}>{weekLabel}</div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f5e6d0', lineHeight: 1.3 }}>
                  Top scorer in <span className="lb-st">{GAME_NAMES[FEATURED_GAME]}</span>
                </div>
                <div style={{ fontSize: 12, color: '#a07030', marginTop: 2 }}>
                  wins <span style={{ color: '#ffd700', fontWeight: 700 }}>1 FREE DRINK</span> of their choice
                </div>
              </div>
            </div>
            {/* Leader row */}
            <div style={{ marginTop: 10, background: '#2a1600', border: '1px solid #ffd70022', borderRadius: 10, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              {loading ? (
                <div style={{ fontSize: 12, color: '#5a3a10', animation: 'lbPulse 1s infinite' }}>Loading...</div>
              ) : leader ? (
                <>
                  <div style={{ fontSize: 20, filter: 'drop-shadow(0 0 5px #ffd700)' }}>&#128081;</div>
                  <Avatar name={leader.username} size={34} borderColor="#ffd700" glowColor="#ffd70088" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#ffd700' }}>{leader.username}</div>
                    <div style={{ fontSize: 10, color: '#7a5020' }}>Current leader — {(leader.score || 0).toLocaleString()} pts</div>
                  </div>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect x="4" y="12" width="16" height="12" rx="3" fill="#3d2200" stroke="#ffd700" strokeWidth="1.2" />
                    <path d="M20 14.5 Q26 14.5 26 18.5 Q26 22.5 20 22.5" stroke="#ffd700" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                    <rect x="7" y="9" width="10" height="3" rx="1.5" fill="#2a1400" stroke="#ffd70055" strokeWidth="0.8" />
                    <line x1="10" y1="7" x2="10" y2="9" stroke="#c8943a" strokeWidth="1" strokeLinecap="round" />
                    <line x1="14" y1="6.5" x2="14" y2="9" stroke="#c8943a" strokeWidth="1" strokeLinecap="round" />
                    <line x1="18" y1="7" x2="18" y2="9" stroke="#c8943a" strokeWidth="1" strokeLinecap="round" />
                  </svg>
                </>
              ) : (
                <div style={{ fontSize: 12, color: '#5a3a10' }}>No scores yet — be the first!</div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', overflowX: 'auto', background: '#100600', borderBottom: '1px solid #2a1200', padding: '0 6px', gap: 2, scrollbarWidth: 'none', marginTop: 14 }}>
          {GAME_LIST.map(g => (
            <button key={g.id} className={`lb-tab${activeGame === g.id ? ' on' : ''}`}
              onClick={() => setActiveGame(g.id)}
              style={activeGame === g.id ? { background: 'linear-gradient(180deg,#c8943a,#9a6010)' } : {}}>
              {g.label.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Podium */}
        <div style={{ background: 'linear-gradient(180deg,#140800,#0a0400)', padding: '18px 14px 12px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#5a3a10', fontSize: 13, padding: '30px 0', animation: 'lbPulse 1s infinite' }}>Loading scores...</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 6 }}>
              {podiumOrder.map((rankIdx, i) => {
                const player = top3[rankIdx];
                return (
                  <PodiumBlock key={i} player={player || null} rank={rankIdx} isFeatured={true} activeGame={activeGame} />
                );
              })}
            </div>
          )}
        </div>

        {/* Rank list 4–10 */}
        <div style={{ padding: '0 12px 8px' }}>
          {!loading && rest.map((p, idx) => (
            <div key={idx} className="lb-ri" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: idx % 2 === 0 ? '#1a0e00' : '#120800', borderRadius: 10, marginBottom: 4, border: '0.5px solid #2a1400', animationDelay: `${idx * 0.06}s` }}>
              <div style={{ width: 18, fontSize: 11, fontWeight: 700, color: '#4a3010', textAlign: 'center' }}>{idx + 4}</div>
              <Avatar name={p.username} size={32} borderColor="#5a3a10" glowColor="#c8943a22" />
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#c89050' }}>{p.username}</div>
              <div className="lb-gs" style={{ fontSize: 13, fontWeight: 700 }}>{(p.score || 0).toLocaleString()}</div>
            </div>
          ))}
          {!loading && rows.length === 0 && (
            <div style={{ textAlign: 'center', color: '#4a3010', fontSize: 13, padding: '16px 0' }}>No scores yet for this game. Be the first!</div>
          )}
        </div>

        {/* CTA */}
        <div style={{ margin: '8px 14px 6px', background: '#1a0d00', border: '1px solid #3a2000', borderRadius: 16, padding: 16, textAlign: 'center' }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ margin: '0 auto 8px', display: 'block', filter: 'drop-shadow(0 0 6px #ffd70088)' }}>
            <path d="M10 4h12v12a6 6 0 0 1-12 0V4z" fill="#3d2200" stroke="#ffd700" strokeWidth="1.5" />
            <path d="M4 6h6v8a3 3 0 0 1-6 0V6z" stroke="#ffd70088" strokeWidth="1.2" fill="none" />
            <path d="M22 6h6v8a3 3 0 0 1-6 0V6z" stroke="#ffd70088" strokeWidth="1.2" fill="none" />
            <rect x="13" y="22" width="6" height="4" fill="#3d2200" stroke="#c8943a" strokeWidth="1" />
            <rect x="9" y="26" width="14" height="2.5" rx="1" fill="#c8943a" />
          </svg>
          <div className="lb-st" style={{ fontFamily: "'Cinzel',serif", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Can you beat this week's #1?</div>
          <div style={{ fontSize: 12, color: '#7a5020', marginBottom: 14, lineHeight: 1.6 }}>
            Register free at the counter and play.<br />
            Top scorer wins a <span style={{ color: '#ffd700', fontWeight: 700 }}>free drink</span> every week.
          </div>
          <button className="lb-cta">Register &amp; Play Now</button>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {['7 Games', 'Weekly Prize', 'Free to play'].map(t => (
              <span key={t} style={{ background: '#2a1400', border: '1px solid #4a2600', borderRadius: 20, padding: '4px 11px', fontSize: 10, color: '#c8943a', fontWeight: 700 }}>{t}</span>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
          <span style={{ fontSize: 10, color: '#3a2010' }}>theonyx-cafe.vercel.app/leaderboard</span>
        </div>

      </div>
    </>
  );
}
