import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── THEME ───────────────────────────────────────────────────────────────────
const C = {
  bg: '#1a0f0a', card: '#2d1a10', brown: '#6b3a2a', gold: '#c8902a',
  cream: '#f5e6c8', light: '#e8d5b0', white: '#fff8f0',
  green: '#4a7c59', red: '#8b2020', blue: '#2a4a8b',
};

// ─── SAFE LOCALSTORAGE ───────────────────────────────────────────────────────
const storage = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ─── SPOT THE DIFFERENCE SCENES ──────────────────────────────────────────────
// Each scene: id, title, differences array [{x,y,r,label}]
const SPOT_SCENES = [
  {
    id: 'morning',
    title: '☀️ Morning Rush',
    drawLeft: (ctx, w, h) => {
      // Background
      ctx.fillStyle = '#f5e6c8'; ctx.fillRect(0, 0, w, h);
      // Sky window
      ctx.fillStyle = '#87CEEB'; ctx.fillRect(10, 10, w - 20, 80);
      // Counter
      ctx.fillStyle = '#8B4513'; ctx.fillRect(0, h - 80, w, 80);
      ctx.fillStyle = '#6b3a2a'; ctx.fillRect(0, h - 85, w, 8);
      // Coffee machine
      ctx.fillStyle = '#333'; ctx.fillRect(30, h - 160, 60, 80);
      ctx.fillStyle = '#c00'; ctx.beginPath(); ctx.arc(60, h - 130, 8, 0, Math.PI * 2); ctx.fill();
      // Cups on counter
      ctx.fillStyle = '#fff'; ctx.fillRect(120, h - 110, 25, 30); // cup1
      ctx.fillStyle = '#6b3000'; ctx.fillRect(123, h - 108, 19, 15); // coffee
      ctx.fillStyle = '#fff'; ctx.fillRect(160, h - 110, 25, 30); // cup2
      ctx.fillStyle = '#4a7c59'; ctx.fillRect(163, h - 108, 19, 15); // matcha
      // Clock
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(w - 40, 60, 25, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.moveTo(w - 40, 60); ctx.lineTo(w - 40, 42); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w - 40, 60); ctx.lineTo(w - 26, 60); ctx.stroke();
      // Chalkboard menu
      ctx.fillStyle = '#2d5a27'; ctx.fillRect(w - 100, h - 200, 90, 110);
      ctx.fillStyle = '#fff'; ctx.font = '10px monospace';
      ctx.fillText('MENU', w - 88, h - 185);
      ctx.fillText('Latte $4', w - 92, h - 170);
      ctx.fillText('Matcha $5', w - 92, h - 155);
      ctx.fillText('Espresso $3', w - 92, h - 140);
      // Plant
      ctx.fillStyle = '#4a7c59';
      ctx.beginPath(); ctx.arc(w - 160, h - 130, 20, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(w - 145, h - 148, 15, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#6b3a2a'; ctx.fillRect(w - 168, h - 112, 16, 32);
    },
    drawRight: (ctx, w, h) => {
      // Same but with differences
      ctx.fillStyle = '#f5e6c8'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#87CEEB'; ctx.fillRect(10, 10, w - 20, 80);
      ctx.fillStyle = '#8B4513'; ctx.fillRect(0, h - 80, w, 80);
      ctx.fillStyle = '#6b3a2a'; ctx.fillRect(0, h - 85, w, 8);
      // Coffee machine — DIFF1: machine is blue instead of #333
      ctx.fillStyle = '#2244aa'; ctx.fillRect(30, h - 160, 60, 80);
      ctx.fillStyle = '#c00'; ctx.beginPath(); ctx.arc(60, h - 130, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(120, h - 110, 25, 30);
      ctx.fillStyle = '#6b3000'; ctx.fillRect(123, h - 108, 19, 15);
      // DIFF2: second cup missing
      // Clock — DIFF3: clock hands point differently
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(w - 40, 60, 25, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w - 40, 60); ctx.lineTo(w - 40, 42); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w - 40, 60); ctx.lineTo(w - 40, 76); ctx.stroke(); // down not right
      // DIFF4: Chalkboard is brown
      ctx.fillStyle = '#6b3a2a'; ctx.fillRect(w - 100, h - 200, 90, 110);
      ctx.fillStyle = '#fff'; ctx.font = '10px monospace';
      ctx.fillText('MENU', w - 88, h - 185);
      ctx.fillText('Latte $4', w - 92, h - 170);
      ctx.fillText('Matcha $5', w - 92, h - 155);
      ctx.fillText('Espresso $3', w - 92, h - 140);
      // DIFF5: Plant is red/flower
      ctx.fillStyle = '#cc3333';
      ctx.beginPath(); ctx.arc(w - 160, h - 130, 20, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(w - 145, h - 148, 15, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#6b3a2a'; ctx.fillRect(w - 168, h - 112, 16, 32);
    },
    diffs: [
      { x: 0.18, y: 0.52, r: 0.07, label: 'Machine color' },
      { x: 0.55, y: 0.65, r: 0.06, label: 'Missing cup' },
      { x: 0.87, y: 0.2, r: 0.06, label: 'Clock hands' },
      { x: 0.75, y: 0.45, r: 0.09, label: 'Chalkboard color' },
      { x: 0.68, y: 0.58, r: 0.07, label: 'Plant color' },
    ],
  },
  {
    id: 'afternoon',
    title: '🌤 Afternoon Café',
    drawLeft: (ctx, w, h) => {
      ctx.fillStyle = '#fde8c8'; ctx.fillRect(0, 0, w, h);
      // Table
      ctx.fillStyle = '#c8a060'; ctx.fillRect(20, h * 0.55, w - 40, 15);
      ctx.fillStyle = '#a07840'; ctx.fillRect(40, h * 0.55 + 15, 12, h * 0.35);
      ctx.fillStyle = '#a07840'; ctx.fillRect(w - 52, h * 0.55 + 15, 12, h * 0.35);
      // Coffee cup on table
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(w * 0.3, h * 0.4); ctx.lineTo(w * 0.3 + 5, h * 0.55); ctx.lineTo(w * 0.5 - 5, h * 0.55); ctx.lineTo(w * 0.5, h * 0.4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5c2d00'; ctx.fillRect(w * 0.32, h * 0.42, w * 0.16, h * 0.08);
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(w * 0.5 + 10, h * 0.49, 8, 0.5, 2.6); ctx.stroke();
      // Book
      ctx.fillStyle = '#c8401a'; ctx.fillRect(w * 0.55, h * 0.38, 50, 65);
      ctx.fillStyle = '#b03010'; ctx.fillRect(w * 0.55, h * 0.38, 6, 65);
      ctx.fillStyle = '#fff'; ctx.font = '8px monospace';
      ctx.fillText('CAFE', w * 0.56 + 8, h * 0.38 + 25);
      ctx.fillText('STORY', w * 0.56 + 6, h * 0.38 + 38);
      // Window with sunshine
      ctx.fillStyle = '#87CEEB'; ctx.fillRect(10, 10, w * 0.4, 90);
      ctx.fillStyle = '#FFD700'; ctx.beginPath(); ctx.arc(50, 55, 20, 0, Math.PI * 2); ctx.fill();
      // Flower vase
      ctx.fillStyle = '#6b8baa'; ctx.beginPath();
      ctx.moveTo(w * 0.78, h * 0.55); ctx.lineTo(w * 0.72, h * 0.3); ctx.lineTo(w * 0.84, h * 0.3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff69b4'; ctx.beginPath(); ctx.arc(w * 0.78, h * 0.26, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff9999'; ctx.beginPath(); ctx.arc(w * 0.71, h * 0.3, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff9999'; ctx.beginPath(); ctx.arc(w * 0.85, h * 0.3, 8, 0, Math.PI * 2); ctx.fill();
    },
    drawRight: (ctx, w, h) => {
      ctx.fillStyle = '#fde8c8'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c8a060'; ctx.fillRect(20, h * 0.55, w - 40, 15);
      ctx.fillStyle = '#a07840'; ctx.fillRect(40, h * 0.55 + 15, 12, h * 0.35);
      ctx.fillStyle = '#a07840'; ctx.fillRect(w - 52, h * 0.55 + 15, 12, h * 0.35);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(w * 0.3, h * 0.4); ctx.lineTo(w * 0.3 + 5, h * 0.55); ctx.lineTo(w * 0.5 - 5, h * 0.55); ctx.lineTo(w * 0.5, h * 0.4); ctx.closePath(); ctx.fill();
      // DIFF1: coffee is green (matcha)
      ctx.fillStyle = '#4a7c3a'; ctx.fillRect(w * 0.32, h * 0.42, w * 0.16, h * 0.08);
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(w * 0.5 + 10, h * 0.49, 8, 0.5, 2.6); ctx.stroke();
      // DIFF2: book is blue
      ctx.fillStyle = '#1a4488'; ctx.fillRect(w * 0.55, h * 0.38, 50, 65);
      ctx.fillStyle = '#0a2468'; ctx.fillRect(w * 0.55, h * 0.38, 6, 65);
      ctx.fillStyle = '#fff'; ctx.font = '8px monospace';
      ctx.fillText('CAFE', w * 0.56 + 8, h * 0.38 + 25);
      ctx.fillText('STORY', w * 0.56 + 6, h * 0.38 + 38);
      // Window with sunshine — DIFF3: no sun
      ctx.fillStyle = '#87CEEB'; ctx.fillRect(10, 10, w * 0.4, 90);
      // Flower vase — DIFF4: vase is red
      ctx.fillStyle = '#aa3a2a'; ctx.beginPath();
      ctx.moveTo(w * 0.78, h * 0.55); ctx.lineTo(w * 0.72, h * 0.3); ctx.lineTo(w * 0.84, h * 0.3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff69b4'; ctx.beginPath(); ctx.arc(w * 0.78, h * 0.26, 12, 0, Math.PI * 2); ctx.fill();
      // DIFF5: only 1 side flower, not 2
      ctx.fillStyle = '#ff9999'; ctx.beginPath(); ctx.arc(w * 0.71, h * 0.3, 8, 0, Math.PI * 2); ctx.fill();
    },
    diffs: [
      { x: 0.4, y: 0.46, r: 0.07, label: 'Coffee color' },
      { x: 0.65, y: 0.55, r: 0.08, label: 'Book color' },
      { x: 0.16, y: 0.3, r: 0.08, label: 'Missing sun' },
      { x: 0.78, y: 0.44, r: 0.07, label: 'Vase color' },
      { x: 0.88, y: 0.3, r: 0.06, label: 'Missing flower' },
    ],
  },
  {
    id: 'evening',
    title: '🌙 Evening Closing',
    drawLeft: (ctx, w, h) => {
      // Night scene
      ctx.fillStyle = '#1a1a3a'; ctx.fillRect(0, 0, w, h);
      // Moon
      ctx.fillStyle = '#fffabb'; ctx.beginPath(); ctx.arc(w - 50, 50, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1a3a'; ctx.beginPath(); ctx.arc(w - 40, 44, 18, 0, Math.PI * 2); ctx.fill();
      // Stars
      [[30, 30], [80, 20], [120, 45], [60, 70], [150, 25]].forEach(([x, y]) => {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      });
      // Café storefront
      ctx.fillStyle = '#3d1a08'; ctx.fillRect(20, h * 0.25, w - 40, h * 0.65);
      // Sign
      ctx.fillStyle = '#c8902a'; ctx.fillRect(40, h * 0.2, w - 80, 40);
      ctx.fillStyle = '#1a0f0a'; ctx.font = 'bold 14px serif'; ctx.textAlign = 'center';
      ctx.fillText('THEONYX CAFÉ', w / 2, h * 0.2 + 26);
      ctx.textAlign = 'left';
      // Windows lit up
      ctx.fillStyle = '#ffe090'; ctx.fillRect(50, h * 0.35, 50, 50);
      ctx.fillStyle = '#ffe090'; ctx.fillRect(w - 100, h * 0.35, 50, 50);
      // Door
      ctx.fillStyle = '#6b3a2a'; ctx.fillRect(w / 2 - 20, h * 0.6, 40, 70);
      ctx.fillStyle = '#c8902a'; ctx.beginPath(); ctx.arc(w / 2 + 10, h * 0.6 + 38, 3, 0, Math.PI * 2); ctx.fill();
      // Chairs outside
      ctx.fillStyle = '#5c2d00'; ctx.fillRect(30, h * 0.72, 30, 4); // seat
      ctx.fillStyle = '#5c2d00'; ctx.fillRect(32, h * 0.72 + 4, 4, 20); // leg L
      ctx.fillStyle = '#5c2d00'; ctx.fillRect(52, h * 0.72 + 4, 4, 20); // leg R
      ctx.fillStyle = '#5c2d00'; ctx.fillRect(w - 60, h * 0.72, 30, 4);
      ctx.fillStyle = '#5c2d00'; ctx.fillRect(w - 58, h * 0.72 + 4, 4, 20);
      ctx.fillStyle = '#5c2d00'; ctx.fillRect(w - 38, h * 0.72 + 4, 4, 20);
      // Closed sign
      ctx.fillStyle = '#aa1111'; ctx.fillRect(w / 2 - 30, h * 0.38, 60, 24);
      ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
      ctx.fillText('CLOSED', w / 2, h * 0.38 + 16);
      ctx.textAlign = 'left';
    },
    drawRight: (ctx, w, h) => {
      ctx.fillStyle = '#1a1a3a'; ctx.fillRect(0, 0, w, h);
      // DIFF1: full moon (no crescent)
      ctx.fillStyle = '#fffabb'; ctx.beginPath(); ctx.arc(w - 50, 50, 22, 0, Math.PI * 2); ctx.fill();
      // Stars — DIFF2: fewer stars (3 instead of 5)
      [[30, 30], [80, 20], [150, 25]].forEach(([x, y]) => {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = '#3d1a08'; ctx.fillRect(20, h * 0.25, w - 40, h * 0.65);
      ctx.fillStyle = '#c8902a'; ctx.fillRect(40, h * 0.2, w - 80, 40);
      ctx.fillStyle = '#1a0f0a'; ctx.font = 'bold 14px serif'; ctx.textAlign = 'center';
      ctx.fillText('THEONYX CAFÉ', w / 2, h * 0.2 + 26);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffe090'; ctx.fillRect(50, h * 0.35, 50, 50);
      // DIFF3: right window is dark
      ctx.fillStyle = '#2a1a08'; ctx.fillRect(w - 100, h * 0.35, 50, 50);
      ctx.fillStyle = '#6b3a2a'; ctx.fillRect(w / 2 - 20, h * 0.6, 40, 70);
      ctx.fillStyle = '#c8902a'; ctx.beginPath(); ctx.arc(w / 2 + 10, h * 0.6 + 38, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5c2d00'; ctx.fillRect(30, h * 0.72, 30, 4);
      ctx.fillStyle = '#5c2d00'; ctx.fillRect(32, h * 0.72 + 4, 4, 20);
      ctx.fillStyle = '#5c2d00'; ctx.fillRect(52, h * 0.72 + 4, 4, 20);
      // DIFF4: right chair missing
      // DIFF5: Open sign (not Closed)
      ctx.fillStyle = '#11aa44'; ctx.fillRect(w / 2 - 30, h * 0.38, 60, 24);
      ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
      ctx.fillText('OPEN!', w / 2, h * 0.38 + 16);
      ctx.textAlign = 'left';
    },
    diffs: [
      { x: 0.86, y: 0.15, r: 0.07, label: 'Full moon' },
      { x: 0.35, y: 0.15, r: 0.1, label: 'Fewer stars' },
      { x: 0.82, y: 0.4, r: 0.08, label: 'Dark window' },
      { x: 0.88, y: 0.74, r: 0.08, label: 'Missing chair' },
      { x: 0.5, y: 0.41, r: 0.09, label: 'Sign changed' },
    ],
  },
];

// ─── GAMES METADATA ──────────────────────────────────────────────────────────
const GAME_LIST = [
  { id: 'snake', label: 'Snake', icon: '🐍', desc: 'Collect coffee beans!' },
  { id: 'tetris', label: 'Tetris', icon: '🟦', desc: 'Stack the blocks!' },
  { id: 'runner', label: 'Café Runner', icon: '🏃', desc: 'Ocean to the Sun!' },
  { id: 'spot', label: 'Spot It', icon: '🔍', desc: 'Find 5 differences!' },
];

const MENU_NAMES = ['Latte', 'Matcha', 'Americano', 'Espresso', 'Cappuccino', 'Frappe', 'Mocha', 'Barista'];

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────
function getScores(gameId) { return storage.get(`scores_${gameId}`, []); }
function addScore(gameId, name, score) {
  const scores = getScores(gameId);
  scores.push({ name, score, date: new Date().toLocaleDateString() });
  scores.sort((a, b) => b.score - a.score);
  storage.set(`scores_${gameId}`, scores.slice(0, 10));
}

// ─── NAME ENTRY ───────────────────────────────────────────────────────────────
function NameEntry({ gameLabel, onStart }) {
  const [name, setName] = useState('');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24, gap: 16 }}>
      <div style={{ fontSize: 48 }}>{GAME_LIST.find(g => g.label === gameLabel)?.icon}</div>
      <div style={{ color: C.gold, fontSize: 22, fontWeight: 'bold' }}>{gameLabel}</div>
      <div style={{ color: C.cream, fontSize: 14 }}>Enter your name:</div>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Your name..."
        style={{ padding: '10px 16px', borderRadius: 10, border: `2px solid ${C.gold}`, background: C.card, color: C.white, fontSize: 16, textAlign: 'center', width: 200 }}
        autoFocus
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 280 }}>
        {MENU_NAMES.map(n => (
          <button key={n} onClick={() => setName(n)}
            style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${C.brown}`, background: name === n ? C.gold : C.card, color: name === n ? C.bg : C.cream, fontSize: 12, cursor: 'pointer' }}>
            {n}
          </button>
        ))}
      </div>
      <button onClick={() => name.trim() && onStart(name.trim())}
        style={{ padding: '12px 40px', borderRadius: 25, background: C.gold, color: C.bg, fontWeight: 'bold', fontSize: 16, border: 'none', cursor: 'pointer', opacity: name.trim() ? 1 : 0.5 }}>
        Play!
      </button>
    </div>
  );
}

// ─── LEADERBOARD PANEL ───────────────────────────────────────────────────────
function Leaderboard({ onClose }) {
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ color: C.gold, fontSize: 20, fontWeight: 'bold' }}>🏆 Leaderboard</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.cream, fontSize: 22, cursor: 'pointer' }}>✕</button>
      </div>
      {GAME_LIST.map(g => {
        const scores = getScores(g.id);
        return (
          <div key={g.id} style={{ background: C.card, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ color: C.gold, fontWeight: 'bold', marginBottom: 8 }}>{g.icon} {g.label}</div>
            {scores.length === 0
              ? <div style={{ color: C.brown, fontSize: 13 }}>No scores yet!</div>
              : scores.slice(0, 5).map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: C.cream, fontSize: 13, padding: '3px 0', borderBottom: i < 4 ? `1px solid ${C.brown}33` : 'none' }}>
                  <span>{medals[i] || `${i + 1}.`} {s.name}</span>
                  <span style={{ color: C.gold }}>{s.score} pts</span>
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── SNAKE GAME ──────────────────────────────────────────────────────────────
function SnakeGame({ playerName, onExit, onScore }) {
  const canvasRef = useRef();
  const state = useRef({
    snake: [{ x: 10, y: 10 }], dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 },
    food: { x: 15, y: 15 }, score: 0, running: true, speed: 220,
  });
  const animRef = useRef();
  const lastRef = useRef(0);
  const CELL = 22, COLS = 16, ROWS = 22;

  const placeFood = useCallback(() => {
    const s = state.current;
    let pos;
    do { pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }; }
    while (s.snake.some(b => b.x === pos.x && b.y === pos.y));
    s.food = pos;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const s = state.current;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Grid
    ctx.strokeStyle = C.card; ctx.lineWidth = 0.5;
    for (let i = 0; i <= COLS; i++) { ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, ROWS * CELL); ctx.stroke(); }
    for (let j = 0; j <= ROWS; j++) { ctx.beginPath(); ctx.moveTo(0, j * CELL); ctx.lineTo(COLS * CELL, j * CELL); ctx.stroke(); }
    // Food (coffee bean)
    const fx = s.food.x * CELL + CELL / 2, fy = s.food.y * CELL + CELL / 2;
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.ellipse(fx, fy, 7, 9, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.brown; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(fx - 3, fy - 5); ctx.quadraticCurveTo(fx, fy, fx + 3, fy + 5); ctx.stroke();
    // Snake
    s.snake.forEach((b, i) => {
      const x = b.x * CELL + 1, y = b.y * CELL + 1, sz = CELL - 2;
      ctx.fillStyle = i === 0 ? C.gold : (i % 2 === 0 ? '#8b5e3c' : C.brown);
      ctx.beginPath(); ctx.roundRect(x, y, sz, sz, 4); ctx.fill();
      if (i === 0) { ctx.fillStyle = '#1a0f0a'; ctx.beginPath(); ctx.arc(x + sz * 0.65, y + sz * 0.3, 2.5, 0, Math.PI * 2); ctx.fill(); }
    });
    // Score
    ctx.fillStyle = C.cream; ctx.font = 'bold 14px monospace';
    ctx.fillText(`☕ ${s.score}`, 8, canvas.height - 8);
    ctx.fillStyle = C.brown; ctx.font = '11px monospace';
    ctx.fillText(playerName, canvas.width - ctx.measureText(playerName).width - 8, canvas.height - 8);
  }, [playerName]);

  const step = useCallback((ts) => {
    const s = state.current;
    if (!s.running) return;
    if (ts - lastRef.current < s.speed) { animRef.current = requestAnimationFrame(step); return; }
    lastRef.current = ts;
    s.dir = { ...s.nextDir };
    const head = { x: s.snake[0].x + s.dir.x, y: s.snake[0].y + s.dir.y };
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS || s.snake.some(b => b.x === head.x && b.y === head.y)) {
      s.running = false;
      addScore('snake', playerName, s.score);
      onScore(s.score);
      return;
    }
    s.snake.unshift(head);
    if (head.x === s.food.x && head.y === s.food.y) {
      s.score += 10; placeFood();
      if (s.score % 50 === 0) s.speed = Math.max(80, s.speed - 20);
    } else { s.snake.pop(); }
    draw();
    animRef.current = requestAnimationFrame(step);
  }, [playerName, placeFood, draw, onScore]);

  useEffect(() => {
    placeFood(); draw();
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [placeFood, draw, step]);

  const setDir = useCallback((dx, dy) => {
    const s = state.current;
    if ((dx !== 0 && s.dir.x === 0) || (dy !== 0 && s.dir.y === 0)) s.nextDir = { x: dx, y: dy };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'center', gap: 8 }}>
      <canvas ref={canvasRef} width={COLS * CELL} height={ROWS * CELL}
        style={{ borderRadius: 10, border: `2px solid ${C.brown}`, maxWidth: '100%' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,52px)', gridTemplateRows: 'repeat(3,52px)', gap: 4 }}>
        {[['', '▲', ''], ['◀', '', '▶'], ['', '▼', '']].flat().map((btn, i) => {
          const dirs = { '▲': [0,-1], '▼': [0,1], '◀': [-1,0], '▶': [1,0] };
          return btn ? (
            <button key={i} onPointerDown={() => { const d = dirs[btn]; if (d) setDir(d[0], d[1]); }}
              style={{ width: 52, height: 52, borderRadius: 10, background: C.card, border: `2px solid ${C.brown}`, color: C.gold, fontSize: 20, cursor: 'pointer', touchAction: 'manipulation' }}>
              {btn}
            </button>
          ) : <div key={i} />;
        })}
      </div>
    </div>
  );
}

// ─── TETRIS GAME ─────────────────────────────────────────────────────────────
const PIECES = [
  { shape: [[1,1,1,1]], color: '#00f5d4' },
  { shape: [[1,1],[1,1]], color: '#fee440' },
  { shape: [[0,1,0],[1,1,1]], color: '#9b5de5' },
  { shape: [[1,0],[1,0],[1,1]], color: '#f15bb5' },
  { shape: [[0,1],[0,1],[1,1]], color: '#00bbf9' },
  { shape: [[0,1,1],[1,1,0]], color: '#4CAF50' },
  { shape: [[1,1,0],[0,1,1]], color: '#ff9f1c' },
];

function TetrisGame({ playerName, onExit, onScore }) {
  const COLS = 10, ROWS = 20, CELL = 28;
  const canvasRef = useRef();
  const stRef = useRef({ board: Array(ROWS).fill(null).map(() => Array(COLS).fill(0)), cur: null, score: 0, running: true, dropTime: 0, speed: 600 });
  const animRef = useRef();

  const newPiece = useCallback(() => {
    const t = PIECES[Math.floor(Math.random() * PIECES.length)];
    return { shape: t.shape, color: t.color, x: Math.floor(COLS / 2) - Math.floor(t.shape[0].length / 2), y: 0 };
  }, []);

  const collides = useCallback((board, piece, ox = 0, oy = 0) => {
    for (let r = 0; r < piece.shape.length; r++)
      for (let c = 0; c < piece.shape[r].length; c++)
        if (piece.shape[r][c]) {
          const nx = piece.x + c + ox, ny = piece.y + r + oy;
          if (nx < 0 || nx >= COLS || ny >= ROWS || (ny >= 0 && board[ny][nx])) return true;
        }
    return false;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const s = stRef.current;
    ctx.fillStyle = '#0d0d1a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Grid
    ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 0.5;
    for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, ROWS * CELL); ctx.stroke(); }
    for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(COLS * CELL, r * CELL); ctx.stroke(); }
    // Board
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (s.board[r][c]) {
      ctx.fillStyle = s.board[r][c];
      ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, 4);
    }
    // Current piece
    if (s.cur) s.cur.shape.forEach((row, r) => row.forEach((v, c) => {
      if (v) {
        const px = (s.cur.x + c) * CELL, py = (s.cur.y + r) * CELL;
        ctx.fillStyle = s.cur.color; ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(px + 1, py + 1, CELL - 2, 4);
      }
    }));
    // Score
    ctx.fillStyle = C.gold; ctx.font = 'bold 14px monospace';
    ctx.fillText(`${s.score}`, 4, canvas.height - 4);
  }, []);

  const lock = useCallback(() => {
    const s = stRef.current;
    s.cur.shape.forEach((row, r) => row.forEach((v, c) => {
      if (v && s.cur.y + r >= 0) s.board[s.cur.y + r][s.cur.x + c] = s.cur.color;
    }));
    let cleared = 0;
    s.board = s.board.filter(row => { if (row.every(c => c)) { cleared++; return false; } return true; });
    while (s.board.length < ROWS) s.board.unshift(Array(COLS).fill(0));
    s.score += [0, 40, 100, 300, 1200][cleared] || 0;
    if (cleared) s.speed = Math.max(100, s.speed - cleared * 20);
    const next = newPiece();
    if (collides(s.board, next)) { s.running = false; addScore('tetris', playerName, s.score); onScore(s.score); return; }
    s.cur = next;
  }, [newPiece, collides, playerName, onScore]);

  const loop = useCallback((ts) => {
    const s = stRef.current; if (!s.running) { draw(); return; }
    if (ts - s.dropTime > s.speed) {
      s.dropTime = ts;
      if (!collides(s.board, s.cur, 0, 1)) s.cur.y++;
      else lock();
    }
    draw();
    animRef.current = requestAnimationFrame(loop);
  }, [collides, lock, draw]);

  useEffect(() => {
    stRef.current.cur = newPiece();
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [newPiece, loop]);

  const moveLeft = () => { const s = stRef.current; if (!collides(s.board, s.cur, -1, 0)) s.cur.x--; };
  const moveRight = () => { const s = stRef.current; if (!collides(s.board, s.cur, 1, 0)) s.cur.x++; };
  const rotate = () => {
    const s = stRef.current;
    const rot = s.cur.shape[0].map((_, i) => s.cur.shape.map(r => r[i]).reverse());
    const orig = s.cur.shape; s.cur.shape = rot;
    if (collides(s.board, s.cur)) s.cur.shape = orig;
  };
  const drop = () => { const s = stRef.current; while (!collides(s.board, s.cur, 0, 1)) s.cur.y++; lock(); };

  const btnStyle = { width: 64, height: 52, borderRadius: 10, background: C.card, border: `2px solid ${C.brown}`, color: C.gold, fontSize: 22, cursor: 'pointer', touchAction: 'manipulation' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'center', gap: 8 }}>
      <canvas ref={canvasRef} width={COLS * CELL} height={ROWS * CELL}
        style={{ borderRadius: 10, border: `2px solid ${C.brown}`, maxWidth: '100%', maxHeight: '55vh' }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onPointerDown={moveLeft} style={btnStyle}>◀</button>
        <button onPointerDown={rotate} style={btnStyle}>↺</button>
        <button onPointerDown={drop} style={{ ...btnStyle, width: 80 }}>▼▼</button>
        <button onPointerDown={moveRight} style={btnStyle}>▶</button>
      </div>
    </div>
  );
}

// ─── CAFÉ RUNNER ──────────────────────────────────────────────────────────────
const RUNNER_LEVELS = [
  { id: 'ocean', label: '🌊 Ocean Floor', bg: '#0a1628', ground: '#1a3d6b', sky: 'linear-gradient(#0a1628,#1a3d6b)', obstacles: ['🦑', '🐙', '🦀'], collectibles: ['🐚', '💎'], speed: 4 },
  { id: 'beach', label: '🏖 Sandy Beach', bg: '#f5deb3', ground: '#c2a060', sky: 'linear-gradient(#87CEEB,#f5deb3)', obstacles: ['🌴', '🦀', '⛱️'], collectibles: ['🐚', '🌸'], speed: 5 },
  { id: 'city', label: '🌆 City Streets', bg: '#1a1a2e', ground: '#333', sky: 'linear-gradient(#1a1a2e,#16213e)', obstacles: ['🚗', '🚧', '🗑️'], collectibles: ['☕', '💰'], speed: 6 },
  { id: 'mountain', label: '⛰️ Mountains', bg: '#2d4a2d', ground: '#4a7c3a', sky: 'linear-gradient(#87CEEB,#2d4a2d)', obstacles: ['🪨', '🌲', '🐻'], collectibles: ['🍄', '⭐'], speed: 7 },
  { id: 'sky', label: '☁️ Sky High', bg: '#87CEEB', ground: '#f0f0ff', sky: 'linear-gradient(#87CEEB,#ffffff)', obstacles: ['☁️', '🦅', '⛈️'], collectibles: ['⭐', '🌈'], speed: 8 },
  { id: 'space', label: '🚀 Outer Space', bg: '#0a0a1a', ground: '#1a1a3a', sky: 'linear-gradient(#0a0a1a,#1a1a3a)', obstacles: ['☄️', '👾', '🛸'], collectibles: ['⭐', '💫'], speed: 9 },
  { id: 'sun', label: '☀️ The Sun!', bg: '#ff8c00', ground: '#ff4500', sky: 'linear-gradient(#ffd700,#ff4500)', obstacles: ['🔥', '💥', '🌋'], collectibles: ['💎', '🏆'], speed: 11 },
];

function RunnerGame({ playerName, onExit, onScore }) {
  const canvasRef = useRef();
  const [levelIdx, setLevelIdx] = useState(0);
  const stRef = useRef(null);
  const animRef = useRef();
  const W = 360, H = 260, GY = H - 60;

  const initState = useCallback((lvlIdx) => {
    stRef.current = {
      x: 60, y: GY, vy: 0, onGround: true,
      obstacles: [], collectibles: [],
      score: 0, dist: 0, running: true,
      spawnTimer: 0, lvlIdx,
    };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const s = stRef.current;
    const lvl = RUNNER_LEVELS[s.lvlIdx];
    // Sky
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    const colors = lvl.sky.match(/#[0-9a-fA-F]{6}/g) || ['#87CEEB', '#f5deb3'];
    grad.addColorStop(0, colors[0]); grad.addColorStop(1, colors[1] || colors[0]);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    // Ground
    ctx.fillStyle = lvl.ground; ctx.fillRect(0, GY + 40, W, H - GY - 40);
    ctx.fillStyle = lvl.bg + '88'; ctx.fillRect(0, GY + 36, W, 8);
    // Player (barista running)
    ctx.font = '36px serif'; ctx.fillText('🏃', s.x - 18, s.y + 36);
    // Obstacles
    s.obstacles.forEach(o => { ctx.font = '30px serif'; ctx.fillText(o.emoji, o.x - 15, GY + 38); });
    // Collectibles
    s.collectibles.forEach(c => { ctx.font = '22px serif'; ctx.fillText(c.emoji, c.x - 11, c.y + 11); });
    // Level label
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, 28);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
    ctx.fillText(lvl.label, W / 2, 19);
    ctx.textAlign = 'left';
    // Score
    ctx.fillStyle = C.gold; ctx.font = 'bold 13px monospace';
    ctx.fillText(`⭐ ${s.score}`, 6, H - 6);
    // Level progress bar
    const progress = Math.min(1, s.dist / 800);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, H - 20, W, 6);
    ctx.fillStyle = C.gold; ctx.fillRect(0, H - 20, W * progress, 6);
  }, []);

  const gameLoop = useCallback((ts) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const s = stRef.current; if (!s || !s.running) return;
    const lvl = RUNNER_LEVELS[s.lvlIdx];
    // Physics
    s.vy += 0.7;
    s.y += s.vy;
    if (s.y >= GY) { s.y = GY; s.vy = 0; s.onGround = true; }
    const spd = lvl.speed;
    // Obstacles
    s.spawnTimer++;
    if (s.spawnTimer > 90 - s.lvlIdx * 5) {
      s.spawnTimer = 0;
      s.obstacles.push({ x: W + 20, emoji: lvl.obstacles[Math.floor(Math.random() * lvl.obstacles.length)] });
      if (Math.random() < 0.4) s.collectibles.push({ x: W + 80 + Math.random() * 100, y: GY - 40 - Math.random() * 60, emoji: lvl.collectibles[Math.floor(Math.random() * lvl.collectibles.length)] });
    }
    s.obstacles.forEach(o => { o.x -= spd; });
    s.collectibles.forEach(c => { c.x -= spd; });
    s.obstacles = s.obstacles.filter(o => o.x > -40);
    s.collectibles = s.collectibles.filter(c => c.x > -40);
    // Collision
    for (const o of s.obstacles) {
      if (Math.abs(o.x - s.x) < 24 && s.y >= GY - 5) {
        s.running = false; addScore('runner', playerName, s.score); onScore(s.score); return;
      }
    }
    for (let i = s.collectibles.length - 1; i >= 0; i--) {
      const c = s.collectibles[i];
      if (Math.abs(c.x - s.x) < 22 && Math.abs(c.y - s.y) < 30) { s.score += 5; s.collectibles.splice(i, 1); }
    }
    s.score++; s.dist++;
    // Level up
    if (s.dist >= 800 && s.lvlIdx < RUNNER_LEVELS.length - 1) {
      s.lvlIdx++; s.dist = 0; s.obstacles = []; s.collectibles = [];
      setLevelIdx(s.lvlIdx);
    }
    draw();
    animRef.current = requestAnimationFrame(gameLoop);
  }, [playerName, draw, onScore]);

  useEffect(() => {
    initState(0);
    animRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animRef.current);
  }, [initState, gameLoop]);

  const jump = () => { const s = stRef.current; if (s.onGround) { s.vy = -13; s.onGround = false; } };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'center', gap: 10 }}>
      <div style={{ color: C.gold, fontSize: 13 }}>Level: {RUNNER_LEVELS[levelIdx].label}</div>
      <canvas ref={canvasRef} width={W} height={H} style={{ borderRadius: 10, border: `2px solid ${C.brown}`, maxWidth: '100%' }} />
      <button onPointerDown={jump}
        style={{ padding: '16px 64px', borderRadius: 25, background: C.gold, color: C.bg, fontSize: 20, fontWeight: 'bold', border: 'none', cursor: 'pointer', touchAction: 'manipulation' }}>
        JUMP!
      </button>
      <div style={{ color: C.brown, fontSize: 12 }}>Reach the ☀️ Sun!</div>
    </div>
  );
}

// ─── SPOT THE DIFFERENCE ─────────────────────────────────────────────────────
function SpotGame({ playerName, onExit, onScore }) {
  const [sceneIdx] = useState(() => Math.floor(Math.random() * SPOT_SCENES.length));
  const scene = SPOT_SCENES[sceneIdx];
  const leftRef = useRef(); const rightRef = useRef();
  const [found, setFound] = useState([]);
  const [flashes, setFlashes] = useState([]);
  const [time, setTime] = useState(90);
  const [done, setDone] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  useEffect(() => {
    const draw = (canvas, fn) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      fn(ctx, canvas.width, canvas.height);
    };
    draw(leftRef.current, scene.drawLeft);
    draw(rightRef.current, scene.drawRight);
  }, [scene]);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setTime(p => { if (p <= 1) { setDone(true); return 0; } return p - 1; }), 1000);
    return () => clearInterval(t);
  }, [done]);

  const handleTap = useCallback((e, side) => {
    if (done) return;
    const canvas = side === 'right' ? rightRef.current : leftRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    for (let i = 0; i < scene.diffs.length; i++) {
      if (found.includes(i)) continue;
      const d = scene.diffs[i];
      const dx = rx - d.x, dy = ry - d.y;
      if (Math.sqrt(dx * dx + dy * dy) < d.r) {
        const newFound = [...found, i];
        setFound(newFound);
        setFlashes(f => [...f, { x: d.x, y: d.y, id: Date.now() }]);
        if (newFound.length === scene.diffs.length) {
          const sc = newFound.length * 20 + time * 2;
          setFinalScore(sc); setDone(true); addScore('spot', playerName, sc); onScore(sc);
        }
        return;
      }
    }
  }, [done, found, scene, time, playerName, onScore]);

  const cW = 160, cH = 200;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'center', gap: 8, padding: 12 }}>
      <div style={{ color: C.gold, fontWeight: 'bold', fontSize: 15 }}>{scene.title}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        {[leftRef, rightRef].map((ref, idx) => (
          <div key={idx} style={{ position: 'relative' }}>
            <canvas ref={ref} width={cW} height={cH}
              onClick={e => handleTap(e, idx === 1 ? 'right' : 'left')}
              style={{ borderRadius: 8, border: `2px solid ${C.brown}`, display: 'block', cursor: 'crosshair' }} />
            {found.map(fi => {
              const d = scene.diffs[fi];
              return (
                <div key={fi} style={{ position: 'absolute', left: d.x * cW - 14, top: d.y * cH - 14, width: 28, height: 28, borderRadius: '50%', border: '3px solid #0f0', pointerEvents: 'none' }} />
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ color: time <= 15 ? '#f55' : C.cream, fontSize: 14 }}>⏱ {time}s</div>
        <div style={{ color: C.gold, fontSize: 14 }}>{found.length}/{scene.diffs.length} found</div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 340 }}>
        {scene.diffs.map((d, i) => (
          <div key={i} style={{ padding: '4px 10px', borderRadius: 12, background: found.includes(i) ? C.green : C.card, color: found.includes(i) ? '#fff' : C.brown, fontSize: 12, border: `1px solid ${found.includes(i) ? C.green : C.brown}` }}>
            {found.includes(i) ? '✓ ' : ''}{d.label}
          </div>
        ))}
      </div>
      {done && (
        <div style={{ textAlign: 'center', color: C.gold, fontWeight: 'bold', fontSize: 16 }}>
          {found.length === scene.diffs.length ? `🎉 All found! +${finalScore} pts` : `⏰ Time's up! ${found.length}/${scene.diffs.length}`}
        </div>
      )}
    </div>
  );
}

// ─── FULLSCREEN WRAPPER ───────────────────────────────────────────────────────
function FullscreenGame({ game, playerName, onExit }) {
  const [score, setScore] = useState(null);
  const [showLB, setShowLB] = useState(false);

  const handleScore = (s) => setScore(s);

  const GameComp = { snake: SnakeGame, tetris: TetrisGame, runner: RunnerGame, spot: SpotGame }[game.id];

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, display: 'flex', flexDirection: 'column', zIndex: 9999 }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: C.card, borderBottom: `2px solid ${C.brown}`, flexShrink: 0 }}>
        <button onClick={onExit} style={{ background: 'none', border: 'none', color: C.cream, fontSize: 22, cursor: 'pointer', padding: '4px 8px' }}>← Exit</button>
        <div style={{ color: C.gold, fontWeight: 'bold', fontSize: 15 }}>{game.icon} {game.label}</div>
        <button onClick={() => setShowLB(true)} style={{ background: 'none', border: 'none', color: C.gold, fontSize: 22, cursor: 'pointer', padding: '4px 8px' }}>🏆</button>
      </div>
      {/* Game */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {showLB ? <Leaderboard onClose={() => setShowLB(false)} /> : (
          <>
            {score !== null && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, gap: 16 }}>
                <div style={{ fontSize: 48 }}>🎮</div>
                <div style={{ color: C.gold, fontSize: 24, fontWeight: 'bold' }}>Game Over!</div>
                <div style={{ color: C.cream, fontSize: 18 }}>Score: {score}</div>
                <button onClick={onExit} style={{ padding: '12px 32px', borderRadius: 25, background: C.gold, color: C.bg, fontWeight: 'bold', fontSize: 16, border: 'none', cursor: 'pointer' }}>Back to Games</button>
                <button onClick={() => setShowLB(true)} style={{ padding: '10px 28px', borderRadius: 25, background: 'transparent', color: C.gold, fontWeight: 'bold', fontSize: 14, border: `2px solid ${C.gold}`, cursor: 'pointer' }}>View Leaderboard</button>
              </div>
            )}
            <GameComp playerName={playerName} onExit={onExit} onScore={handleScore} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── MAIN GAMES PAGE ─────────────────────────────────────────────────────────
export default function GamesPage() {
  const [screen, setScreen] = useState('menu'); // menu | name | game | leaderboard
  const [selectedGame, setSelectedGame] = useState(null);
  const [playerName, setPlayerName] = useState('');

  const selectGame = (g) => { setSelectedGame(g); setScreen('name'); };
  const startGame = (name) => { setPlayerName(name); setScreen('game'); };
  const exitGame = () => { setSelectedGame(null); setPlayerName(''); setScreen('menu'); };

  // Fullscreen game overlay
  if (screen === 'game' && selectedGame) {
    return <FullscreenGame game={selectedGame} playerName={playerName} onExit={exitGame} />;
  }

  return (
    <div style={{ height: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: C.card, borderBottom: `2px solid ${C.brown}`, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="2" y="6" width="24" height="16" rx="4" fill={C.brown} />
            <rect x="5" y="9" width="6" height="6" rx="1.5" fill={C.gold} />
            <rect x="13" y="9" width="6" height="6" rx="1.5" fill={C.gold} />
            <circle cx="7" cy="20" r="2" fill={C.gold} />
            <circle cx="21" cy="20" r="2" fill={C.gold} />
            <rect x="10" y="2" width="8" height="4" rx="2" fill={C.gold} />
          </svg>
          <div style={{ color: C.gold, fontWeight: 'bold', fontSize: 18 }}>Arcade</div>
        </div>
        <button onClick={() => setScreen('leaderboard')}
          style={{ background: C.brown, border: 'none', color: C.gold, padding: '6px 14px', borderRadius: 16, fontSize: 13, fontWeight: 'bold', cursor: 'pointer' }}>
          🏆 Top Scores
        </button>
      </div>

      {screen === 'leaderboard' && (
        <div style={{ flex: 1, overflow: 'hidden', background: C.bg }}>
          <Leaderboard onClose={() => setScreen('menu')} />
        </div>
      )}

      {screen === 'name' && selectedGame && (
        <div style={{ flex: 1, overflow: 'hidden', background: C.bg }}>
          <NameEntry gameLabel={selectedGame.label} onStart={startGame} />
        </div>
      )}

      {screen === 'menu' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          <div style={{ color: C.light, fontSize: 13, marginBottom: 14, textAlign: 'center' }}>
            ☕ Pick a game and play!
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {GAME_LIST.map(g => {
              const scores = getScores(g.id);
              const top = scores[0];
              return (
                <button key={g.id} onClick={() => selectGame(g)}
                  style={{ background: C.card, border: `2px solid ${C.brown}`, borderRadius: 16, padding: '18px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ fontSize: 40 }}>{g.icon}</div>
                  <div style={{ color: C.gold, fontWeight: 'bold', fontSize: 15 }}>{g.label}</div>
                  <div style={{ color: C.light, fontSize: 11 }}>{g.desc}</div>
                  {top && <div style={{ color: C.brown, fontSize: 10 }}>🥇 {top.name}: {top.score}</div>}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 16, padding: 14, background: C.card, borderRadius: 14, border: `1px solid ${C.brown}` }}>
            <div style={{ color: C.gold, fontWeight: 'bold', fontSize: 13, marginBottom: 6 }}>🎯 How to play</div>
            <div style={{ color: C.light, fontSize: 12, lineHeight: 1.6 }}>
              🐍 Snake — avoid walls, eat coffee beans<br />
              🟦 Tetris — clear rows, stack smart<br />
              🏃 Runner — jump obstacles, reach the Sun!<br />
              🔍 Spot It — find 5 differences before time runs out
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
