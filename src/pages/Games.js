import React, { useState, useEffect, useRef, useCallback } from 'react';
import CafeGame from './CafeGame';

// ─── THEME ───────────────────────────────────────────────────────────────────
const T = {
  bg: '#1a0f00',
  card: '#2c1a00',
  cardLight: '#3d2500',
  gold: '#d4a853',
  goldLight: '#e8c87a',
  cream: '#f5e6c8',
  brown: '#6b3d11',
  text: '#f0d9b5',
  dim: '#8a6a3a',
  danger: '#e05c2a',
  success: '#5a9a3a',
};

// ─── LEADERBOARD HELPERS ──────────────────────────────────────────────────────
const LS_KEY = 'theonyx_leaderboard';
const getBoard = () => { try { const d = localStorage.getItem(LS_KEY); return d ? JSON.parse(d) : {}; } catch { return {}; } };
const saveScore = (game, name, score) => {
  const board = getBoard();
  if (!board[game]) board[game] = [];
  board[game].push({ name, score, date: new Date().toLocaleDateString() });
  board[game].sort((a, b) => b.score - a.score);
  board[game] = board[game].slice(0, 10);
  try { localStorage.setItem(LS_KEY, JSON.stringify(board)); } catch { }
};
const getTop = (game) => (getBoard()[game] || []).slice(0, 10);

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const S = {
  wrap: { minHeight: '100vh', background: `linear-gradient(160deg, #140800 0%, #2c1400 60%, #1a0a00 100%)`, color: T.text, fontFamily: 'Georgia, serif', paddingBottom: 20 },
  header: { textAlign: 'center', padding: '20px 16px 6px', borderBottom: `1px solid ${T.brown}33` },
  title: { fontSize: 22, fontWeight: 'bold', color: T.gold, letterSpacing: 3, textTransform: 'uppercase', margin: 0 },
  sub: { fontSize: 11, color: T.dim, letterSpacing: 2, marginTop: 3 },
  gameGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: 14 },
  card: (active) => ({ background: active ? '#3d2500' : '#261200', border: `1.5px solid ${active ? T.gold : T.brown + '88'}`, borderRadius: 14, padding: '16px 10px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.18s', transform: active ? 'scale(1.02)' : 'scale(1)' }),
  gameArea: { margin: '0 12px', background: '#1e0e00', borderRadius: 18, border: `1.5px solid ${T.brown}88`, overflow: 'hidden' },
  gameBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#2c1400', borderBottom: `1px solid ${T.brown}55` },
  score: { fontSize: 13, color: T.gold, fontWeight: 'bold' },
  btn: (bg = T.gold) => ({ background: bg, color: bg === T.gold ? '#1a0800' : T.gold, border: `1px solid ${T.gold}55`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', letterSpacing: 0.5 }),
  pad: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, maxWidth: 180, margin: '8px auto' },
  padBtn: { background: '#2c1400', border: `1px solid ${T.brown}`, color: T.gold, borderRadius: 8, padding: '13px 0', fontSize: 17, cursor: 'pointer', textAlign: 'center' },
  // Name entry
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#1e0e00', border: `1.5px solid ${T.gold}55`, borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 340, textAlign: 'center' },
  input: { width: '100%', padding: '11px 14px', borderRadius: 10, border: `1px solid ${T.gold}44`, fontSize: 14, background: 'rgba(255,255,255,0.06)', color: T.cream, outline: 'none', boxSizing: 'border-box', marginBottom: 10, textAlign: 'center', fontFamily: 'Georgia, serif' },
  // Fullscreen game
  fullscreen: { position: 'fixed', inset: 0, zIndex: 400, background: `linear-gradient(160deg, #140800 0%, #2c1400 60%, #1a0a00 100%)`, display: 'flex', flexDirection: 'column', overflowY: 'auto' },
  fsHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(10,4,0,0.8)', borderBottom: `1px solid ${T.brown}55`, flexShrink: 0 },
  backBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(212,168,83,0.12)', border: `1px solid ${T.gold}44`, borderRadius: 10, color: T.gold, fontSize: 13, fontWeight: 'bold', padding: '7px 14px', cursor: 'pointer', letterSpacing: 0.5 },
  fsTitle: { fontSize: 14, fontWeight: 'bold', color: T.gold, letterSpacing: 2, textTransform: 'uppercase' },
  fsContent: { flex: 1, overflowY: 'auto' },
  // Leaderboard
  lbTab: (active) => ({ flex: 1, padding: '8px 4px', textAlign: 'center', fontSize: 10, fontWeight: active ? 'bold' : 'normal', color: active ? T.gold : T.dim, borderBottom: `2px solid ${active ? T.gold : 'transparent'}`, cursor: 'pointer', letterSpacing: 0.5, textTransform: 'uppercase' }),
  row: (i) => ({ display: 'flex', alignItems: 'center', padding: '8px 14px', background: i % 2 === 0 ? '#1e0e00' : '#261200', borderBottom: `1px solid ${T.brown}22` }),
  medal: ['🥇', '🥈', '🥉'],
};

// ─── NAME ENTRY MODAL ─────────────────────────────────────────────────────────
const MENU_SUGGESTIONS = ['Latte', 'Matcha', 'Americano', 'Espresso', 'Cappuccino', 'Frappe', 'Dirty Matcha', 'Milk Tea', 'Mocha', 'Caramel'];

function NameModal({ game, onStart }) {
  const [name, setName] = useState('');
  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>
          {{ snake: '🐍', mario: '🏃', tetris: '🟦', spot: '🔍' }[game]}
        </div>
        <div style={{ fontSize: 16, fontWeight: 'bold', color: T.gold, marginBottom: 4 }}>Enter Your Name</div>
        <div style={{ fontSize: 11, color: T.dim, marginBottom: 16 }}>Name yourself after a menu item!</div>
        <input
          style={S.input}
          placeholder="e.g. Latte, Matcha, Espresso..."
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={20}
          autoFocus
          onKeyDown={e => e.key === 'Enter' && name.trim() && onStart(name.trim())}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 14 }}>
          {MENU_SUGGESTIONS.map(s => (
            <span key={s} onClick={() => setName(s)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: name === s ? T.gold + '33' : T.card, color: name === s ? T.gold : T.dim, border: `1px solid ${name === s ? T.gold : T.brown + '55'}`, cursor: 'pointer' }}>{s}</span>
          ))}
        </div>
        <button style={{ ...S.btn(), width: '100%', padding: '12px', fontSize: 14, opacity: name.trim() ? 1 : 0.4 }} disabled={!name.trim()} onClick={() => onStart(name.trim())}>
          Start Game →
        </button>
      </div>
    </div>
  );
}

// ─── GAME OVER MODAL ──────────────────────────────────────────────────────────
function GameOverModal({ game, playerName, score, onRestart, onLeaderboard }) {
  const top = getTop(game);
  const rank = top.findIndex(e => e.name === playerName && e.score === score) + 1;
  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>☠️</div>
        <div style={{ fontSize: 18, fontWeight: 'bold', color: T.gold, marginBottom: 2 }}>Game Over</div>
        <div style={{ fontSize: 13, color: T.dim, marginBottom: 12 }}>{playerName}</div>
        <div style={{ fontSize: 32, fontWeight: 'bold', color: T.cream, marginBottom: 4 }}>{score}</div>
        <div style={{ fontSize: 11, color: T.dim, marginBottom: 16 }}>
          {rank > 0 ? `🏆 #${rank} on leaderboard!` : 'Keep practicing!'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...S.btn(T.cardLight), flex: 1, padding: '11px' }} onClick={onLeaderboard}>🏆 Board</button>
          <button style={{ ...S.btn(), flex: 1, padding: '11px' }} onClick={onRestart}>Play Again</button>
        </div>
      </div>
    </div>
  );
}

// ─── LEADERBOARD PANEL ────────────────────────────────────────────────────────
function Leaderboard({ onClose }) {
  const [tab, setTab] = useState('snake');
  const GAMES = [
    { id: 'snake', label: 'Snake' },
    { id: 'mario', label: 'Runner' },
    { id: 'tetris', label: 'Tetris' },
    { id: 'spot', label: 'Spot' },
  ];
  const entries = getTop(tab);
  return (
    <div style={{ ...S.wrap, paddingBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#1e0e00', borderBottom: `1px solid ${T.brown}55` }}>
        <div style={{ fontSize: 15, fontWeight: 'bold', color: T.gold, letterSpacing: 2 }}>🏆 LEADERBOARD</div>
        <button style={S.btn(T.card)} onClick={onClose}>✕ Close</button>
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.brown}55` }}>
        {GAMES.map(g => <div key={g.id} style={S.lbTab(tab === g.id)} onClick={() => setTab(g.id)}>{g.label}</div>)}
      </div>
      {entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: T.dim, fontSize: 13 }}>No scores yet — be the first! 🎮</div>
      ) : (
        entries.map((e, i) => (
          <div key={i} style={S.row(i)}>
            <div style={{ width: 28, fontSize: i < 3 ? 18 : 13, textAlign: 'center' }}>{i < 3 ? S.medal[i] : `${i + 1}.`}</div>
            <div style={{ flex: 1, fontSize: 14, color: i === 0 ? T.gold : T.cream, fontWeight: i === 0 ? 'bold' : 'normal', paddingLeft: 8 }}>{e.name}</div>
            <div style={{ fontSize: 14, fontWeight: 'bold', color: T.gold }}>{e.score.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: T.dim, marginLeft: 10, minWidth: 50, textAlign: 'right' }}>{e.date}</div>
          </div>
        ))
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SNAKE GAME
// ═══════════════════════════════════════════════════════════════════
function SnakeGame({ playerName, onGameOver }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [score, setScore] = useState(0);
  const [alive, setAlive] = useState(true);
  const CELL = 20, COLS = 15, ROWS = 20;
  const W = CELL * COLS, H = CELL * ROWS;

  const placeFood = (snake) => {
    let pos;
    do { pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }; }
    while (snake.some(s => s.x === pos.x && s.y === pos.y));
    return pos;
  };

  const startGame = useCallback(() => {
    const g = { snake: [{ x: 7, y: 10 }, { x: 6, y: 10 }, { x: 5, y: 10 }], dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 }, food: { x: 11, y: 10 }, score: 0, running: true };
    gameRef.current = g;
    setScore(0); setAlive(true);
  }, []);

  useEffect(() => { startGame(); }, [startGame]);

  const draw = useCallback((g) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0d0700'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2c1a0044';
    for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) ctx.fillRect(x * CELL + CELL / 2 - 1, y * CELL + CELL / 2 - 1, 2, 2);
    // Food
    ctx.fillStyle = T.gold; ctx.beginPath(); ctx.arc(g.food.x * CELL + CELL / 2, g.food.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a0f00'; ctx.beginPath(); ctx.ellipse(g.food.x * CELL + CELL / 2, g.food.y * CELL + CELL / 2, 2, CELL / 2 - 5, 0, 0, Math.PI * 2); ctx.fill();
    // Snake
    g.snake.forEach((seg, i) => {
      const r = i === 0 ? 210 : Math.round(160 - i * 3); const gb = i === 0 ? 80 : Math.round(50 - i * 1);
      ctx.fillStyle = `rgb(${Math.max(r, 80)},${Math.max(gb, 20)},${Math.max(gb - 10, 10)})`;
      const p = i === 0 ? 1 : 3;
      ctx.beginPath(); ctx.roundRect(seg.x * CELL + p, seg.y * CELL + p, CELL - p * 2, CELL - p * 2, 4); ctx.fill();
    });
    const h = g.snake[0];
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(h.x * CELL + CELL / 2 + g.dir.y * 3 - g.dir.x * 4, h.y * CELL + CELL / 2 + g.dir.x * 3 - g.dir.y * 4, 2, 0, Math.PI * 2);
    ctx.arc(h.x * CELL + CELL / 2 + g.dir.y * 3 + g.dir.x * 4, h.y * CELL + CELL / 2 + g.dir.x * 3 + g.dir.y * 4, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a0f00';
    ctx.beginPath(); ctx.arc(h.x * CELL + CELL / 2 + g.dir.y * 3 - g.dir.x * 4, h.y * CELL + CELL / 2 + g.dir.x * 3 - g.dir.y * 4, 1, 0, Math.PI * 2);
    ctx.arc(h.x * CELL + CELL / 2 + g.dir.y * 3 + g.dir.x * 4, h.y * CELL + CELL / 2 + g.dir.x * 3 + g.dir.y * 4, 1, 0, Math.PI * 2); ctx.fill();
  }, [W, H, CELL, COLS, ROWS]);

  useEffect(() => {
    if (!alive) return;
    const interval = setInterval(() => {
      const g = gameRef.current; if (!g || !g.running) return;
      g.dir = { ...g.nextDir };
      const head = { x: g.snake[0].x + g.dir.x, y: g.snake[0].y + g.dir.y };
      if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS || g.snake.some(s => s.x === head.x && s.y === head.y)) {
        g.running = false; saveScore('snake', playerName, g.score); setAlive(false); onGameOver(g.score); return;
      }
      g.snake.unshift(head);
      if (head.x === g.food.x && head.y === g.food.y) { g.score += 10; setScore(g.score); g.food = placeFood(g.snake); } else g.snake.pop();
      draw(g);
    }, 140);
    return () => clearInterval(interval);
  }, [alive, draw, COLS, ROWS, playerName, onGameOver]);

  const turn = (d) => { const g = gameRef.current; if (!g) return; const m = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[d]; if (m.x !== -g.dir.x || m.y !== -g.dir.y) g.nextDir = m; };
  useEffect(() => { const k = (e) => { const m = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }; if (m[e.key]) { e.preventDefault(); turn(m[e.key]); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);

  return (
    <div>
      <div style={S.gameBar}><span style={S.score}>☕ {score}</span><span style={{ fontSize: 12, color: T.dim }}>{playerName}</span></div>
      <canvas ref={canvasRef} width={W} height={H} style={{ display: 'block', margin: '0 auto', maxWidth: '100%' }} />
      <div style={S.pad}>
        <div /><div style={S.padBtn} onClick={() => turn('up')}>▲</div><div />
        <div style={S.padBtn} onClick={() => turn('left')}>◀</div>
        <div style={S.padBtn} onClick={() => turn('down')}>▼</div>
        <div style={S.padBtn} onClick={() => turn('right')}>▶</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CAFÉ RUNNER (MARIO)
// ═══════════════════════════════════════════════════════════════════
function MarioGame({ playerName, onGameOver }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(false);
  const W = 320, H = 260, GROUND = H - 48;

  const init = () => ({ player: { x: 55, y: GROUND - 38, vy: 0, w: 26, h: 38, onGround: true, frame: 0 }, obstacles: [], clouds: [{ x: 60, y: 35, w: 55 }, { x: 190, y: 22, w: 75 }, { x: 270, y: 50, w: 45 }], speed: 3, score: 0, frame: 0, spawn: 80, running: true });

  const jump = useCallback(() => { const s = stateRef.current; if (s && s.running && s.player.onGround) { s.player.vy = -13.5; s.player.onGround = false; } }, []);

  const start = () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); stateRef.current = init(); setScore(0); setRunning(true); };

  useEffect(() => {
    if (!running) return;
    const loop = () => {
      const s = stateRef.current; if (!s || !s.running) return;
      const canvas = canvasRef.current; if (!canvas) return;
      const ctx = canvas.getContext('2d');
      s.frame++; s.score += 0.05; s.speed = 3 + s.score * 0.015; setScore(Math.floor(s.score));
      s.player.vy += 0.68; s.player.y += s.player.vy;
      if (s.player.y >= GROUND - s.player.h) { s.player.y = GROUND - s.player.h; s.player.vy = 0; s.player.onGround = true; }
      if (s.frame % 8 === 0 && s.player.onGround) s.player.frame = (s.player.frame + 1) % 2;
      s.spawn--;
      if (s.spawn <= 0) { const h = 28 + Math.random() * 28; s.obstacles.push({ x: W, y: GROUND - h, w: 18 + Math.random() * 12, h }); s.spawn = 55 + Math.random() * 55; }
      s.obstacles.forEach(o => o.x -= s.speed); s.obstacles = s.obstacles.filter(o => o.x > -50);
      s.clouds.forEach(c => { c.x -= 0.5; if (c.x < -100) c.x = W + 50; });
      const p = s.player;
      for (const o of s.obstacles) { if (p.x + p.w - 5 > o.x + 4 && p.x + 4 < o.x + o.w - 4 && p.y + p.h - 4 > o.y + 4) { s.running = false; saveScore('mario', playerName, Math.floor(s.score)); setRunning(false); onGameOver(Math.floor(s.score)); return; } }
      // Draw sky
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND); sky.addColorStop(0, '#1a0f30'); sky.addColorStop(1, '#2c1a10'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff33'; for (let i = 0; i < 18; i++) { ctx.fillRect((i * 137 + s.frame * 0.1) % W, (i * 53) % (GROUND - 20), 1.5, 1.5); }
      s.clouds.forEach(c => { ctx.fillStyle = '#3d250088'; ctx.beginPath(); ctx.ellipse(c.x, c.y, c.w / 2, 13, 0, 0, Math.PI * 2); ctx.ellipse(c.x - 14, c.y + 5, c.w / 3, 9, 0, 0, Math.PI * 2); ctx.ellipse(c.x + 14, c.y + 5, c.w / 3, 9, 0, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = '#3d1f00'; ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = T.gold; ctx.fillRect(0, GROUND, W, 2);
      ctx.fillStyle = '#4a2800'; for (let gx = (s.frame * s.speed * 0.3) % 40; gx < W; gx += 40) ctx.fillRect(gx, GROUND + 5, 18, 2);
      s.obstacles.forEach(o => { ctx.fillStyle = T.brown; ctx.fillRect(o.x, o.y, o.w, o.h); ctx.fillStyle = T.gold; ctx.fillRect(o.x + 2, o.y + 2, o.w - 4, 5); ctx.fillStyle = T.card; ctx.fillRect(o.x + 2, o.y + 8, o.w - 4, o.h - 10); ctx.strokeStyle = T.brown; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(o.x + o.w + 3, o.y + o.h / 2, 5, -Math.PI / 2, Math.PI / 2); ctx.stroke(); });
      const px = p.x, py = p.y;
      ctx.fillStyle = '#c8943a'; ctx.fillRect(px + 4, py + 13, 18, 18);
      ctx.fillStyle = '#e8b85a'; ctx.beginPath(); ctx.ellipse(px + 13, py + 9, 11, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a0f00'; ctx.beginPath(); ctx.arc(px + 9, py + 8, 1.8, 0, Math.PI * 2); ctx.arc(px + 17, py + 8, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f5e6c8'; ctx.fillRect(px + 6, py + 15, 14, 12);
      ctx.fillStyle = '#6b3d11';
      if (p.onGround && p.frame === 1) { ctx.fillRect(px + 3, py + 31, 7, 9); ctx.fillRect(px + 16, py + 33, 7, 7); } else { ctx.fillRect(px + 4, py + 31, 7, 9); ctx.fillRect(px + 15, py + 31, 7, 9); }
      ctx.fillStyle = '#1a0f00'; ctx.fillRect(px + 5, py, 16, 4); ctx.fillRect(px + 7, py - 7, 10, 8);
      ctx.fillStyle = T.gold; ctx.font = 'bold 13px Georgia'; ctx.textAlign = 'left'; ctx.fillText(`☕ ${Math.floor(s.score)}`, 8, 22);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [running, GROUND, playerName, onGameOver]);

  useEffect(() => {
    if (!running) { const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#0d0700'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#3d1f00'; ctx.fillRect(0, GROUND, W, H - GROUND); ctx.fillStyle = T.gold; ctx.font = 'bold 20px Georgia'; ctx.textAlign = 'center'; ctx.fillText('🏃 CAFÉ RUNNER', W / 2, H / 2 - 12); ctx.font = '12px Georgia'; ctx.fillStyle = T.dim; ctx.fillText('Jump over the coffee cups!', W / 2, H / 2 + 12); }
  }, [running, GROUND]);

  useEffect(() => { const k = (e) => { if (e.code === 'Space' || e.key === 'ArrowUp') { e.preventDefault(); jump(); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [jump]);

  return (
    <div>
      <div style={S.gameBar}><span style={S.score}>☕ {score}</span><span style={{ fontSize: 12, color: T.dim }}>{playerName}</span></div>
      <canvas ref={canvasRef} width={W} height={H} style={{ display: 'block', margin: '0 auto', maxWidth: '100%', cursor: 'pointer' }} onClick={running ? jump : start} />
      {running ? (
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}><button style={{ ...S.btn(T.brown), border: `1px solid ${T.gold}55`, padding: '11px 44px', fontSize: 20 }} onClick={jump}>JUMP ↑</button></div>
      ) : (
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}><button style={{ ...S.btn(), padding: '11px 32px' }} onClick={start}>START</button></div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TETRIS
// ═══════════════════════════════════════════════════════════════════
function TetrisGame({ playerName, onGameOver }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const timerRef = useRef(null);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [alive, setAlive] = useState(false);
  const COLS = 10, ROWS = 20, CELL = 22, W = COLS * CELL, H = ROWS * CELL;

  const PIECES = [
    { shape: [[1,1,1,1]], color: T.gold },
    { shape: [[1,1],[1,1]], color: '#c8501a' },
    { shape: [[1,1,1],[0,1,0]], color: '#8a3a9a' },
    { shape: [[1,1,1],[1,0,0]], color: T.danger },
    { shape: [[1,1,1],[0,0,1]], color: '#3a7ac8' },
    { shape: [[1,1,0],[0,1,1]], color: T.success },
    { shape: [[0,1,1],[1,1,0]], color: '#c83a6a' },
  ];

  const emptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const rndPiece = () => { const p = PIECES[Math.floor(Math.random() * PIECES.length)]; return { shape: p.shape.map(r => [...r]), color: p.color, x: Math.floor(COLS / 2) - Math.floor(p.shape[0].length / 2), y: 0 }; };
  const rotate = (s) => s[0].map((_, i) => s.map(r => r[i]).reverse());
  const valid = (board, piece, dx = 0, dy = 0, shape = null) => { const sh = shape || piece.shape; for (let r = 0; r < sh.length; r++) for (let c = 0; c < sh[r].length; c++) if (sh[r][c]) { const nx = piece.x + c + dx, ny = piece.y + r + dy; if (nx < 0 || nx >= COLS || ny >= ROWS) return false; if (ny >= 0 && board[ny][nx]) return false; } return true; };

  const drawBoard = useCallback((ctx, board, piece) => {
    ctx.fillStyle = '#0d0700'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#2c1a0022'; ctx.lineWidth = 0.5;
    for (let r = 0; r < ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL); ctx.stroke(); }
    for (let c = 0; c < COLS; c++) { ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, H); ctx.stroke(); }
    const dc = (x, y, color, a = 1) => { ctx.globalAlpha = a; ctx.fillStyle = color; ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, 4); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x * CELL + 1, y * CELL + CELL - 5, CELL - 2, 4); ctx.globalAlpha = 1; };
    board.forEach((row, r) => row.forEach((cell, c) => { if (cell) dc(c, r, cell); }));
    if (piece) { let gy = piece.y; while (valid(board, { ...piece, y: gy + 1 })) gy++; piece.shape.forEach((row, r) => row.forEach((cell, c) => { if (cell && gy + r >= 0) dc(piece.x + c, gy + r, piece.color, 0.18); })); piece.shape.forEach((row, r) => row.forEach((cell, c) => { if (cell && piece.y + r >= 0) dc(piece.x + c, piece.y + r, piece.color); })); }
  }, [W, H, CELL, ROWS, COLS, valid]);

  const startGame = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const s = { board: emptyBoard(), piece: rndPiece(), score: 0, lines: 0, running: true };
    stateRef.current = s; setScore(0); setLines(0); setAlive(true);
    drawBoard(canvasRef.current?.getContext('2d'), s.board, s.piece);
  };

  const stepDown = useCallback(() => {
    const s = stateRef.current; if (!s || !s.running) return;
    if (valid(s.board, s.piece, 0, 1)) { s.piece.y++; }
    else {
      s.piece.shape.forEach((row, r) => row.forEach((cell, c) => { if (cell && s.piece.y + r >= 0) s.board[s.piece.y + r][s.piece.x + c] = s.piece.color; }));
      let cleared = 0;
      for (let r = ROWS - 1; r >= 0; r--) { if (s.board[r].every(c => c)) { s.board.splice(r, 1); s.board.unshift(Array(COLS).fill(null)); cleared++; r++; } }
      s.lines += cleared; s.score += ([0, 100, 300, 500, 800][cleared] || 0) + 10;
      setScore(s.score); setLines(s.lines);
      s.piece = rndPiece();
      if (!valid(s.board, s.piece)) { s.running = false; saveScore('tetris', playerName, s.score); setAlive(false); onGameOver(s.score); return; }
    }
    drawBoard(canvasRef.current?.getContext('2d'), s.board, s.piece);
  }, [ROWS, COLS, valid, drawBoard, playerName, onGameOver]);

  useEffect(() => {
    if (!alive) return;
    const spd = Math.max(100, 500 - Math.floor((stateRef.current?.lines || 0) / 5) * 40);
    timerRef.current = setInterval(stepDown, spd);
    return () => clearInterval(timerRef.current);
  }, [alive, stepDown, lines]);

  const move = (dx) => { const s = stateRef.current; if (!s || !s.running) return; if (valid(s.board, s.piece, dx, 0)) s.piece.x += dx; drawBoard(canvasRef.current?.getContext('2d'), s.board, s.piece); };
  const rot = () => { const s = stateRef.current; if (!s || !s.running) return; const r = rotate(s.piece.shape); if (valid(s.board, s.piece, 0, 0, r)) s.piece.shape = r; drawBoard(canvasRef.current?.getContext('2d'), s.board, s.piece); };
  const drop = () => { const s = stateRef.current; if (!s || !s.running) return; while (valid(s.board, s.piece, 0, 1)) s.piece.y++; stepDown(); };

  useEffect(() => { if (!alive) return; const k = (e) => { if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); } if (e.key === 'ArrowRight') { e.preventDefault(); move(1); } if (e.key === 'ArrowDown') { e.preventDefault(); stepDown(); } if (e.key === 'ArrowUp') { e.preventDefault(); rot(); } if (e.key === ' ') { e.preventDefault(); drop(); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [alive, stepDown]);

  useEffect(() => { if (!alive) { const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#0d0700'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = T.gold; ctx.font = 'bold 20px Georgia'; ctx.textAlign = 'center'; ctx.fillText('🟦 TETRIS', W / 2, H / 2 - 12); ctx.font = '12px Georgia'; ctx.fillStyle = T.dim; ctx.fillText('Stack the blocks!', W / 2, H / 2 + 12); } }, [alive, W, H]);

  return (
    <div>
      <div style={S.gameBar}>
        <span style={S.score}>{score} pts</span>
        <span style={{ fontSize: 11, color: T.dim }}>{playerName} · {lines} lines</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <canvas ref={canvasRef} width={W} height={H} style={{ display: 'block' }} />
      </div>
      {alive ? (
        <div style={{ padding: '8px 12px' }}>
          <div style={S.pad}>
            <div /><div style={S.padBtn} onClick={rot}>↻</div><div />
            <div style={S.padBtn} onClick={() => move(-1)}>◀</div>
            <div style={S.padBtn} onClick={stepDown}>▼</div>
            <div style={S.padBtn} onClick={() => move(1)}>▶</div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 4 }}>
            <button style={{ ...S.btn(T.brown), border: `1px solid ${T.gold}55`, padding: '9px 36px' }} onClick={drop}>DROP ↓↓</button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <button style={{ ...S.btn(), padding: '11px 32px' }} onClick={startGame}>START</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SPOT THE DIFFERENCE
// ═══════════════════════════════════════════════════════════════════
const SPOT_DIFFS = [
  { id: 0, x: 222, y: 30, r: 16 },
  { id: 1, x: 58, y: 102, r: 15 },
  { id: 2, x: 157, y: 147, r: 14 },
  { id: 3, x: 252, y: 138, r: 13 },
  { id: 4, x: 110, y: 55, r: 13 },
];

function SpotDiffGame({ playerName, onGameOver }) {
  const [found, setFound] = useState([]);
  const [flash, setFlash] = useState(null);
  const [timeLeft, setTimeLeft] = useState(90);
  const [done, setDone] = useState(false);
  const canvasA = useRef(null), canvasB = useRef(null);
  const W = 290, H = 210;

  const draw = useCallback((ctx, isB, foundIds, fl) => {
    const GROUND = H - 48;
    const wall = ctx.createLinearGradient(0, 0, 0, H); wall.addColorStop(0, '#2c1a00'); wall.addColorStop(1, '#1a0f00'); ctx.fillStyle = wall; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#3d2200'; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = '#4a2a00'; for (let fx = 0; fx < W; fx += 38) ctx.fillRect(fx, GROUND, 19, H - GROUND);
    ctx.fillStyle = '#1a3060'; ctx.fillRect(28, 18, 78, 68);
    ctx.fillStyle = '#2a5090'; ctx.fillRect(30, 20, 35, 64); ctx.fillStyle = '#3a70b0'; ctx.fillRect(67, 20, 37, 64);
    ctx.strokeStyle = '#6b3d11'; ctx.lineWidth = 4; ctx.strokeRect(28, 18, 78, 68); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(67, 18); ctx.lineTo(67, 86); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(28, 52); ctx.lineTo(106, 52); ctx.stroke();
    ctx.fillStyle = '#ffe08088'; [[43, 33],[78, 27],[93, 43],[53, 58],[83, 63]].forEach(([sx, sy]) => { ctx.beginPath(); ctx.arc(sx, sy, 2, 0, Math.PI * 2); ctx.fill(); });
    if (isB) { ctx.fillStyle = '#ffe080'; ctx.beginPath(); ctx.arc(222, 30, 5, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#5c3010'; ctx.fillRect(0, GROUND - 33, W, 33);
    ctx.fillStyle = '#7a4020'; ctx.fillRect(0, GROUND - 36, W, 5);
    ctx.fillStyle = '#8a5530'; ctx.fillRect(168, GROUND - 88, 48, 55);
    ctx.fillStyle = '#c8943a'; ctx.fillRect(173, GROUND - 83, 38, 18);
    ctx.fillStyle = '#1a0f00'; ctx.beginPath(); ctx.arc(192, GROUND - 75, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a6030'; ctx.beginPath(); ctx.arc(192, GROUND - 75, 4.5, 0, Math.PI * 2); ctx.fill();
    if (!isB) { ctx.fillStyle = '#f5e6c8'; ctx.fillRect(50, GROUND - 36, 14, 18); ctx.fillStyle = '#c8943a'; ctx.fillRect(48, GROUND - 38, 18, 4); ctx.strokeStyle = '#6b3d11'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(64, GROUND - 28, 4, -Math.PI / 2, Math.PI / 2); ctx.stroke(); }
    ctx.fillStyle = '#3d1f00'; ctx.fillRect(128, 23, 58, 52);
    ctx.fillStyle = '#5a3010'; ctx.fillRect(131, 26, 52, 47);
    ctx.fillStyle = T.gold; ctx.font = 'bold 7px Georgia'; ctx.textAlign = 'left'; ctx.fillText('MENU', 138, 37);
    ctx.fillStyle = T.cream; ctx.font = '6px Georgia'; ctx.fillText('Latte  ₱150', 134, 48); ctx.fillText('Espresso ₱120', 134, 57); ctx.fillText('Matcha ₱160', 134, 66);
    ctx.fillStyle = '#c8943a'; ctx.beginPath(); ctx.arc(110, 55, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a0f00'; ctx.beginPath(); ctx.arc(110, 55, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c8943a'; ctx.beginPath(); ctx.arc(110, 55, 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1a0f00'; ctx.lineWidth = 2;
    const ha = isB ? -Math.PI / 6 : Math.PI / 3;
    ctx.beginPath(); ctx.moveTo(110, 55); ctx.lineTo(110 + Math.cos(ha) * 8, 55 + Math.sin(ha) * 8); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(110, 55); ctx.lineTo(110, 55 - 11); ctx.stroke();
    ctx.fillStyle = '#8a3010'; ctx.fillRect(238, GROUND - 45, 18, 10);
    ctx.fillStyle = '#5a8030'; ctx.beginPath(); ctx.arc(247, GROUND - 50, 11, 0, Math.PI * 2); ctx.fill();
    if (isB) { ctx.fillStyle = '#4a7025'; ctx.beginPath(); ctx.ellipse(265, GROUND - 52, 9, 4.5, Math.PI / 4, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = isB ? '#8a3030' : '#2a5020';
    ctx.fillRect(143, GROUND - 30, 28, 20); ctx.strokeStyle = '#6b3d11'; ctx.lineWidth = 2; ctx.strokeRect(143, GROUND - 30, 28, 20);
    ctx.fillStyle = '#f5e6c8'; ctx.font = 'bold 6px Georgia'; ctx.textAlign = 'center'; ctx.fillText('OPEN', 157, GROUND - 20); ctx.fillText('10-11', 157, GROUND - 13);
    if (foundIds?.length) { foundIds.forEach(id => { const d = SPOT_DIFFS[id]; ctx.strokeStyle = T.success; ctx.lineWidth = 2.5; ctx.setLineDash([4, 2]); ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 4, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }); }
    if (fl && fl.canvas === (isB ? 'b' : 'a')) { ctx.strokeStyle = T.danger; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(fl.x, fl.y, 12, 0, Math.PI * 2); ctx.stroke(); }
  }, [H, DIFFS]);

  const redraw = useCallback(() => {
    if (canvasA.current) draw(canvasA.current.getContext('2d'), false, found, flash);
    if (canvasB.current) draw(canvasB.current.getContext('2d'), true, found, flash);
  }, [found, flash, draw]);

  useEffect(() => { redraw(); }, [redraw]);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setTimeLeft(tl => { if (tl <= 1) { const sc = found.length * 20; saveScore('spot', playerName, sc); setDone(true); onGameOver(sc); return 0; } return tl - 1; }), 1000);
    return () => clearInterval(t);
  }, [done, found.length, playerName, onGameOver]);

  const tap = (e, isB) => {
    if (done) return;
    const canvas = isB ? canvasB.current : canvasA.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width), y = (e.clientY - rect.top) * (H / rect.height);
    for (const d of SPOT_DIFFS) {
      if (found.includes(d.id)) continue;
      if (Math.sqrt((x - d.x) ** 2 + (y - d.y) ** 2) < d.r + 8) {
        const nf = [...found, d.id]; setFound(nf);
        if (nf.length === SPOT_DIFFS.length) { const sc = nf.length * 20 + timeLeft * 2; saveScore('spot', playerName, sc); setDone(true); onGameOver(sc); } return;
      }
    }
    setFlash({ x, y, canvas: isB ? 'b' : 'a' }); setTimeout(() => setFlash(null), 500);
  };

  return (
    <div>
      <div style={S.gameBar}>
        <span style={S.score}>Found: {found.length}/5</span>
        <span style={{ ...S.score, color: timeLeft < 20 ? T.danger : T.dim }}>⏱ {timeLeft}s</span>
        <span style={{ fontSize: 11, color: T.dim }}>{playerName}</span>
      </div>
      <div style={{ padding: '6px 10px 2px', textAlign: 'center', fontSize: 11, color: T.dim }}>Tap the differences in either image!</div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '0 6px 6px', flexWrap: 'wrap' }}>
        {[false, true].map(isB => (
          <div key={String(isB)}>
            <div style={{ fontSize: 9, color: T.dim, textAlign: 'center', marginBottom: 2 }}>{isB ? 'Find here →' : 'Original'}</div>
            <canvas ref={isB ? canvasB : canvasA} width={W} height={H} style={{ borderRadius: 8, border: `1px solid ${T.brown}55`, cursor: 'crosshair', maxWidth: '47vw' }} onClick={e => tap(e, isB)} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', padding: '0 10px' }}>
        {SPOT_DIFFS.map(d => <span key={d.id} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: found.includes(d.id) ? T.success + '33' : T.cardLight, color: found.includes(d.id) ? T.success : T.dim, border: `1px solid ${found.includes(d.id) ? T.success : T.brown + '44'}` }}>{found.includes(d.id) ? '✓' : '?'} #{d.id + 1}</span>)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN GAMES PAGE
// ═══════════════════════════════════════════════════════════════════
const GAME_LABELS = { snake: '🐍 Snake', mario: '🏃 Café Runner', tetris: '🟦 Tetris', spot: '🔍 Spot the Diff' };
const GAME_LIST = [
  { id: 'snake', icon: '🐍', name: 'Snake', desc: 'Eat the beans!' },
  { id: 'mario', icon: '🏃', name: 'Café Runner', desc: 'Jump over cups!' },
  { id: 'tetris', icon: '🟦', name: 'Tetris', desc: 'Stack blocks!' },
  { id: 'spot', icon: '🔍', name: 'Spot Diff', desc: 'Find 5 differences!' },
  { id: 'cafemystery', icon: '☕', name: 'Café Mystery', desc: 'Multiplayer · 3-10 players!' },
];

export default function GamesPage() {
  const [activeGame, setActiveGame] = useState(null);
  const [playerName, setPlayerName] = useState(null);
  const [showName, setShowName] = useState(false);
  const [pendingGame, setPendingGame] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [showBoard, setShowBoard] = useState(false);

  const pickGame = (id) => {
    setActiveGame(null); setGameOver(null); setPlayerName(null);
    setPendingGame(id);
    if (id === 'cafemystery') {
      setActiveGame('cafemystery');
      setPlayerName('multiplayer');
    } else {
      setShowName(true);
    }
  };

  const handleName = (name) => {
    setPlayerName(name); setShowName(false); setActiveGame(pendingGame); setGameOver(null);
  };

  const handleGameOver = (score) => { setGameOver({ score }); };

  const exitGame = () => {
    setActiveGame(null); setGameOver(null); setPlayerName(null); setPendingGame(null);
  };

  const restart = () => {
    setGameOver(null); setActiveGame(null);
    setTimeout(() => setActiveGame(pendingGame), 50);
  };

  // FULLSCREEN GAME VIEW
  if (activeGame && playerName) {
    return (
      <div style={S.fullscreen}>
        <div style={S.fsHeader}>
          <button style={S.backBtn} onClick={exitGame}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Exit
          </button>
          <div style={S.fsTitle}>{GAME_LABELS[activeGame]}</div>
          <button style={{ ...S.backBtn, padding: '7px 10px' }} onClick={() => { exitGame(); setShowBoard(true); }}>
            🏆
          </button>
        </div>
        <div style={S.fsContent}>
          {activeGame === 'snake' && <SnakeGame key={'snake' + playerName} playerName={playerName} onGameOver={handleGameOver} />}
          {activeGame === 'mario' && <MarioGame key={'mario' + playerName} playerName={playerName} onGameOver={handleGameOver} />}
          {activeGame === 'tetris' && <TetrisGame key={'tetris' + playerName} playerName={playerName} onGameOver={handleGameOver} />}
          {activeGame === 'spot' && <SpotDiffGame key={'spot' + playerName} playerName={playerName} onGameOver={handleGameOver} />}
          {activeGame === 'cafemystery' && <CafeGame onExit={exitGame} />}
        </div>
        {gameOver && (
          <GameOverModal
            game={pendingGame}
            playerName={playerName}
            score={gameOver.score}
            onRestart={restart}
            onLeaderboard={() => { exitGame(); setShowBoard(true); }}
          />
        )}
      </div>
    );
  }

  if (showBoard) return <Leaderboard onClose={() => setShowBoard(false)} />;

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 4 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="12" rx="3"/>
            <circle cx="8" cy="12" r="1.5" fill={T.gold}/>
            <circle cx="16" cy="12" r="1.5" fill={T.gold}/>
            <line x1="12" y1="9" x2="12" y2="15"/>
            <line x1="9" y1="12" x2="15" y2="12"/>
          </svg>
          <h1 style={S.title}>Arcade Corner</h1>
        </div>
        <p style={S.sub}>THEONYX CAFE · PLAY & WIN</p>
        <button style={{ ...S.btn(T.card), marginTop: 8, border: `1px solid ${T.gold}55`, fontSize: 12, padding: '6px 18px' }} onClick={() => setShowBoard(true)}>
          🏆 Leaderboard
        </button>
      </div>
      <div style={S.gameGrid}>
        {GAME_LIST.map(g => (
          <div key={g.id} style={S.card(false)} onClick={() => pickGame(g.id)}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>{g.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: T.gold, letterSpacing: 0.5 }}>{g.name}</div>
            <div style={{ fontSize: 10, color: T.dim, marginTop: 3 }}>{g.desc}</div>
            {getTop(g.id).length > 0 && (
              <div style={{ fontSize: 10, color: T.dim, marginTop: 6, borderTop: `1px solid ${T.brown}44`, paddingTop: 5 }}>
                🥇 {getTop(g.id)[0].name}: {getTop(g.id)[0].score}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', padding: '8px 16px 20px', color: T.dim, fontSize: 11 }}>
        Tap a game to play · Name yourself after a menu item ☕
      </div>
      {showName && <NameModal game={pendingGame} onStart={handleName} />}
    </div>
  );
}
