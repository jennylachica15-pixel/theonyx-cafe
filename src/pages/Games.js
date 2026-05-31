import React, { useState, useEffect, useRef, useCallback } from 'react';
import CafeGame from './CafeGame';

const T = {
  bg: '#140800', card: '#2c1a00', cardLight: '#3d2500',
  gold: '#d4a853', goldLight: '#e8c87a', cream: '#f5e6c8',
  brown: '#6b3d11', text: '#f0d9b5', dim: '#8a6a3a',
  danger: '#e05c2a', success: '#5a9a3a',
};

const LS_KEY = 'theonyx_leaderboard';
const getBoard = () => { try { const d = localStorage.getItem(LS_KEY); return d ? JSON.parse(d) : {}; } catch { return {}; } };
const saveScore = (game, name, score) => {
  const board = getBoard();
  if (!board[game]) board[game] = [];
  board[game].push({ name, score, date: new Date().toLocaleDateString() });
  board[game].sort((a, b) => b.score - a.score);
  board[game] = board[game].slice(0, 10);
  try { localStorage.setItem(LS_KEY, JSON.stringify(board)); } catch {}
};
const getTop = (game) => (getBoard()[game] || []).slice(0, 10);

const S = {
  wrap: { minHeight: '100vh', background: `linear-gradient(160deg,#140800 0%,#2c1400 60%,#1a0a00 100%)`, color: T.text, fontFamily: 'Georgia,serif', paddingBottom: 20 },
  header: { textAlign: 'center', padding: '20px 16px 6px', borderBottom: `1px solid ${T.brown}33` },
  title: { fontSize: 22, fontWeight: 'bold', color: T.gold, letterSpacing: 3, textTransform: 'uppercase', margin: 0 },
  sub: { fontSize: 11, color: T.dim, letterSpacing: 2, marginTop: 3 },
  gameGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: 14 },
  card: () => ({ background: '#261200', border: `1.5px solid ${T.brown}88`, borderRadius: 14, padding: '16px 10px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.18s' }),
  fullscreen: { position: 'fixed', inset: 0, zIndex: 400, background: `linear-gradient(160deg,#140800 0%,#2c1400 60%,#1a0a00 100%)`, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  fsHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(10,4,0,0.85)', borderBottom: `1px solid ${T.brown}55`, flexShrink: 0 },
  backBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(212,168,83,0.12)', border: `1px solid ${T.gold}44`, borderRadius: 10, color: T.gold, fontSize: 13, fontWeight: 'bold', padding: '7px 14px', cursor: 'pointer' },
  fsTitle: { fontSize: 13, fontWeight: 'bold', color: T.gold, letterSpacing: 2, textTransform: 'uppercase' },
  fsContent: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  gameBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', background: '#1e0e00', borderBottom: `1px solid ${T.brown}44`, flexShrink: 0 },
  score: { fontSize: 13, color: T.gold, fontWeight: 'bold' },
  btn: (bg = T.gold) => ({ background: bg, color: bg === T.gold ? '#1a0800' : T.gold, border: `1px solid ${T.gold}44`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer' }),
  padBtn: { background: '#2c1400', border: `1px solid ${T.brown}`, color: T.gold, borderRadius: 8, padding: '14px 0', fontSize: 18, cursor: 'pointer', textAlign: 'center', userSelect: 'none' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#1e0e00', border: `1.5px solid ${T.gold}55`, borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 340, textAlign: 'center' },
  input: { width: '100%', padding: '11px 14px', borderRadius: 10, border: `1px solid ${T.gold}44`, fontSize: 14, background: 'rgba(255,255,255,0.06)', color: T.cream, outline: 'none', boxSizing: 'border-box', marginBottom: 10, textAlign: 'center', fontFamily: 'Georgia,serif' },
  lbTab: (active) => ({ flex: 1, padding: '8px 4px', textAlign: 'center', fontSize: 10, fontWeight: active ? 'bold' : 'normal', color: active ? T.gold : T.dim, borderBottom: `2px solid ${active ? T.gold : 'transparent'}`, cursor: 'pointer', letterSpacing: 0.5, textTransform: 'uppercase' }),
  row: (i) => ({ display: 'flex', alignItems: 'center', padding: '8px 14px', background: i % 2 === 0 ? '#1e0e00' : '#261200', borderBottom: `1px solid ${T.brown}22` }),
  medal: ['🥇', '🥈', '🥉'],
};

// ─── MENU SUGGESTIONS ─────────────────────────────────────────────
const MENU_SUGGESTIONS = ['Latte','Matcha','Americano','Espresso','Cappuccino','Frappe','Dirty Matcha','Milk Tea','Mocha','Caramel'];

// ─── NAME MODAL ───────────────────────────────────────────────────
function NameModal({ game, onStart }) {
  const [name, setName] = useState('');
  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>{{ snake:'🐍',mario:'🏃',tetris:'🟦',spot:'🔍' }[game]}</div>
        <div style={{ fontSize: 16, fontWeight: 'bold', color: T.gold, marginBottom: 4 }}>Enter Your Name</div>
        <div style={{ fontSize: 11, color: T.dim, marginBottom: 14 }}>Name yourself after a menu item!</div>
        <input style={S.input} placeholder="e.g. Latte, Matcha..." value={name} onChange={e => setName(e.target.value)} maxLength={20} autoFocus onKeyDown={e => e.key === 'Enter' && name.trim() && onStart(name.trim())} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center', marginBottom: 14 }}>
          {MENU_SUGGESTIONS.map(s => <span key={s} onClick={() => setName(s)} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: name === s ? T.gold+'33' : T.card, color: name === s ? T.gold : T.dim, border: `1px solid ${name === s ? T.gold : T.brown+'55'}`, cursor: 'pointer' }}>{s}</span>)}
        </div>
        <button style={{ ...S.btn(), width: '100%', padding: '12px', opacity: name.trim() ? 1 : 0.4 }} disabled={!name.trim()} onClick={() => onStart(name.trim())}>Start Game →</button>
      </div>
    </div>
  );
}

// ─── GAME OVER MODAL ──────────────────────────────────────────────
function GameOverModal({ game, playerName, score, onRestart, onLeaderboard }) {
  const top = getTop(game);
  const rank = top.findIndex(e => e.name === playerName && e.score === score) + 1;
  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>☠️</div>
        <div style={{ fontSize: 18, fontWeight: 'bold', color: T.gold, marginBottom: 2 }}>Game Over</div>
        <div style={{ fontSize: 13, color: T.dim, marginBottom: 10 }}>{playerName}</div>
        <div style={{ fontSize: 36, fontWeight: 'bold', color: T.cream, marginBottom: 4 }}>{score}</div>
        <div style={{ fontSize: 11, color: T.dim, marginBottom: 16 }}>{rank > 0 ? `🏆 #${rank} on leaderboard!` : 'Keep practicing!'}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...S.btn(T.cardLight), flex: 1, padding: '11px' }} onClick={onLeaderboard}>🏆 Board</button>
          <button style={{ ...S.btn(), flex: 1, padding: '11px' }} onClick={onRestart}>Play Again</button>
        </div>
      </div>
    </div>
  );
}

// ─── LEADERBOARD ──────────────────────────────────────────────────
function Leaderboard({ onClose }) {
  const [tab, setTab] = useState('snake');
  const GAMES = [{ id:'snake',label:'Snake' },{ id:'mario',label:'Runner' },{ id:'tetris',label:'Tetris' },{ id:'spot',label:'Spot' }];
  const entries = getTop(tab);
  return (
    <div style={{ ...S.wrap, paddingBottom: 0 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'#1e0e00', borderBottom:`1px solid ${T.brown}55` }}>
        <div style={{ fontSize:15, fontWeight:'bold', color:T.gold, letterSpacing:2 }}>🏆 LEADERBOARD</div>
        <button style={S.btn(T.card)} onClick={onClose}>✕ Close</button>
      </div>
      <div style={{ display:'flex', borderBottom:`1px solid ${T.brown}55` }}>
        {GAMES.map(g => <div key={g.id} style={S.lbTab(tab===g.id)} onClick={() => setTab(g.id)}>{g.label}</div>)}
      </div>
      {entries.length === 0
        ? <div style={{ textAlign:'center', padding:40, color:T.dim, fontSize:13 }}>No scores yet — be the first! 🎮</div>
        : entries.map((e,i) => (
          <div key={i} style={S.row(i)}>
            <div style={{ width:28, fontSize:i<3?18:13, textAlign:'center' }}>{i<3?S.medal[i]:`${i+1}.`}</div>
            <div style={{ flex:1, fontSize:14, color:i===0?T.gold:T.cream, fontWeight:i===0?'bold':'normal', paddingLeft:8 }}>{e.name}</div>
            <div style={{ fontSize:14, fontWeight:'bold', color:T.gold }}>{e.score.toLocaleString()}</div>
            <div style={{ fontSize:10, color:T.dim, marginLeft:8 }}>{e.date}</div>
          </div>
        ))
      }
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SNAKE — bigger grid, starts slow
// ═══════════════════════════════════════════════════════════════════
function SnakeGame({ playerName, onGameOver }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const containerRef = useRef(null);
  const [score, setScore] = useState(0);
  const [alive, setAlive] = useState(true);
  const [size, setSize] = useState({ w: 340, h: 480 });

  const CELL = 22;
  const COLS = Math.floor(size.w / CELL);
  const ROWS = Math.floor(size.h / CELL);
  const W = COLS * CELL;
  const H = ROWS * CELL;

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const w = Math.min(containerRef.current.clientWidth, 420);
        const h = Math.min(window.innerHeight - 140, 600);
        setSize({ w, h });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const placeFood = (snake) => {
    let pos;
    do { pos = { x: Math.floor(Math.random()*COLS), y: Math.floor(Math.random()*ROWS) }; }
    while (snake.some(s => s.x===pos.x && s.y===pos.y));
    return pos;
  };

  const startGame = useCallback(() => {
    const cx = Math.floor(COLS/2), cy = Math.floor(ROWS/2);
    gameRef.current = { snake:[{x:cx,y:cy},{x:cx-1,y:cy},{x:cx-2,y:cy}], dir:{x:1,y:0}, nextDir:{x:1,y:0}, food:{x:cx+4,y:cy}, score:0, running:true, speed:220 };
    setScore(0); setAlive(true);
  }, [COLS, ROWS]);

  useEffect(() => { if (COLS > 5 && ROWS > 5) startGame(); }, [COLS, ROWS, startGame]);

  const draw = useCallback((g) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a0500'; ctx.fillRect(0,0,W,H);
    // subtle grid
    ctx.fillStyle = '#1a0f0033';
    for (let x=0;x<COLS;x++) for(let y=0;y<ROWS;y++) ctx.fillRect(x*CELL+CELL/2-1,y*CELL+CELL/2-1,2,2);
    // food
    ctx.fillStyle = T.gold;
    ctx.beginPath(); ctx.arc(g.food.x*CELL+CELL/2, g.food.y*CELL+CELL/2, CELL/2-2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1a0f00';
    ctx.beginPath(); ctx.ellipse(g.food.x*CELL+CELL/2, g.food.y*CELL+CELL/2, 2, CELL/2-5, 0, 0, Math.PI*2); ctx.fill();
    // snake
    g.snake.forEach((seg,i) => {
      const ratio = Math.max(0, 1 - i/g.snake.length);
      ctx.fillStyle = i===0 ? `rgb(220,90,50)` : `rgb(${Math.round(180*ratio+40)},${Math.round(60*ratio+15)},${Math.round(20*ratio+5)})`;
      const p = i===0 ? 1 : 3;
      ctx.beginPath(); ctx.roundRect(seg.x*CELL+p, seg.y*CELL+p, CELL-p*2, CELL-p*2, 5); ctx.fill();
    });
    // eyes
    const h=g.snake[0];
    ctx.fillStyle='#fff';
    ctx.beginPath();
    ctx.arc(h.x*CELL+CELL/2+g.dir.y*3-g.dir.x*4, h.y*CELL+CELL/2+g.dir.x*3-g.dir.y*4, 2.5,0,Math.PI*2);
    ctx.arc(h.x*CELL+CELL/2+g.dir.y*3+g.dir.x*4, h.y*CELL+CELL/2+g.dir.x*3+g.dir.y*4, 2.5,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle='#1a0f00';
    ctx.beginPath();
    ctx.arc(h.x*CELL+CELL/2+g.dir.y*3-g.dir.x*4, h.y*CELL+CELL/2+g.dir.x*3-g.dir.y*4, 1.2,0,Math.PI*2);
    ctx.arc(h.x*CELL+CELL/2+g.dir.y*3+g.dir.x*4, h.y*CELL+CELL/2+g.dir.x*3+g.dir.y*4, 1.2,0,Math.PI*2);
    ctx.fill();
  }, [W,H,CELL,COLS,ROWS]);

  useEffect(() => {
    if (!alive) return;
    const g = gameRef.current; if (!g) return;
    const speed = Math.max(80, 220 - Math.floor(g.score/50)*15);
    const interval = setInterval(() => {
      const g = gameRef.current; if (!g||!g.running) return;
      g.dir = {...g.nextDir};
      const head = {x:g.snake[0].x+g.dir.x, y:g.snake[0].y+g.dir.y};
      if (head.x<0||head.x>=COLS||head.y<0||head.y>=ROWS||g.snake.some(s=>s.x===head.x&&s.y===head.y)) {
        g.running=false; saveScore('snake',playerName,g.score); setAlive(false); onGameOver(g.score); return;
      }
      g.snake.unshift(head);
      if (head.x===g.food.x&&head.y===g.food.y) { g.score+=10; setScore(g.score); g.food=placeFood(g.snake); } else g.snake.pop();
      draw(g);
    }, speed);
    return () => clearInterval(interval);
  }, [alive, draw, COLS, ROWS, playerName, onGameOver]);

  useEffect(() => {
    if (!alive) {
      const canvas = canvasRef.current; if(!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle='#0a0500'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle=T.gold; ctx.font=`bold 26px Georgia`; ctx.textAlign='center'; ctx.fillText('🐍 SNAKE',W/2,H/2-16);
      ctx.font='13px Georgia'; ctx.fillStyle=T.dim; ctx.fillText('Collect the coffee beans!',W/2,H/2+14);
    }
  }, [alive,W,H]);

  const turn = (d) => { const g=gameRef.current; if(!g) return; const m={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}}[d]; if(m.x!==-g.dir.x||m.y!==-g.dir.y) g.nextDir=m; };
  useEffect(() => { const k=(e)=>{const m={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}; if(m[e.key]){e.preventDefault();turn(m[e.key]);}}; window.addEventListener('keydown',k); return()=>window.removeEventListener('keydown',k); },[]);

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1 }}>
      <div style={S.gameBar}>
        <span style={S.score}>☕ {score}</span>
        <span style={{ fontSize:11, color:T.dim }}>{playerName}</span>
        <button style={S.btn()} onClick={startGame}>↺ Restart</button>
      </div>
      <div ref={containerRef} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'8px 0' }}>
        <canvas ref={canvasRef} width={W} height={H} style={{ display:'block', maxWidth:'100%' }} />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, maxWidth:200, margin:'10px auto 0', width:'100%' }}>
          <div/><div style={S.padBtn} onClick={()=>turn('up')}>▲</div><div/>
          <div style={S.padBtn} onClick={()=>turn('left')}>◀</div>
          <div style={S.padBtn} onClick={()=>turn('down')}>▼</div>
          <div style={S.padBtn} onClick={()=>turn('right')}>▶</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CAFÉ RUNNER — bigger, ocean→beach→city→sky→space levels
// ═══════════════════════════════════════════════════════════════════
const LEVELS = [
  { name:'🌊 Deep Ocean',   bg1:'#001830', bg2:'#003060', ground:'#0a3050', gline:'#0080b0', scoreMin:0,   scoreMax:80,  obstacleColor:'#2060a0', obstacleColor2:'#40a0d0' },
  { name:'🏖️ Beach Shore',   bg1:'#0a2040', bg2:'#2060a0', ground:'#c8a050', gline:'#e8c070', scoreMin:80,  scoreMax:180, obstacleColor:'#d08030', obstacleColor2:'#f0c060' },
  { name:'🌆 City Streets', bg1:'#1a1a2e', bg2:'#16213e', ground:'#2c2c3e', gline:'#d4a853', scoreMin:180, scoreMax:320, obstacleColor:'#8a3010', obstacleColor2:'#d4a853' },
  { name:'☁️ Sky High',      bg1:'#1a0f30', bg2:'#4060a0', ground:'#8090a0', gline:'#ffffff', scoreMin:320, scoreMax:500, obstacleColor:'#8080c0', obstacleColor2:'#c0c0ff' },
  { name:'🌙 Moon Base',     bg1:'#050510', bg2:'#101030', ground:'#303050', gline:'#8080c0', scoreMin:500, scoreMax:700, obstacleColor:'#606080', obstacleColor2:'#a0a0c0' },
  { name:'☀️ Solar Wind',    bg1:'#200800', bg2:'#601800', ground:'#c04010', gline:'#ffa020', scoreMin:700, scoreMax:9999,obstacleColor:'#ff6020', obstacleColor2:'#ffc040' },
];

function MarioGame({ playerName, onGameOver }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(false);
  const [levelName, setLevelName] = useState(LEVELS[0].name);
  const [size, setSize] = useState({ w: 380, h: 300 });

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const w = Math.min(containerRef.current.clientWidth, 480);
        const h = Math.min(Math.round(w * 0.65), 320);
        setSize({ w, h });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const W = size.w, H = size.h, GROUND = H - Math.round(H * 0.18);

  const init = () => ({
    player: { x: Math.round(W*0.15), y: GROUND-42, vy: 0, w: 28, h: 42, onGround: true, frame: 0 },
    obstacles: [], particles: [],
    clouds: [{x:W*0.15,y:H*0.15,w:60},{x:W*0.5,y:H*0.08,w:80},{x:W*0.8,y:H*0.2,w:50}],
    speed: 3.5, score: 0, frame: 0, spawn: 80, running: true, level: 0,
  });

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (s && s.running && s.player.onGround) { s.player.vy = -Math.sqrt(2 * 0.72 * (GROUND - 20)); s.player.onGround = false; }
  }, [GROUND]);

  const start = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    stateRef.current = init(); setScore(0); setLevelName(LEVELS[0].name); setRunning(true);
  };

  useEffect(() => {
    if (!running) return;
    const loop = () => {
      const s = stateRef.current; if (!s||!s.running) return;
      const canvas = canvasRef.current; if (!canvas) return;
      const ctx = canvas.getContext('2d');

      s.frame++; s.score += 0.06; s.speed = 3.5 + s.score * 0.018; setScore(Math.floor(s.score));

      // Level detection
      const lvlIdx = LEVELS.findIndex(l => s.score >= l.scoreMin && s.score < l.scoreMax);
      const lvl = LEVELS[Math.max(0, lvlIdx)];
      if (s.level !== lvlIdx && lvlIdx >= 0) { s.level = lvlIdx; setLevelName(lvl.name); }

      // Physics
      s.player.vy += 0.72; s.player.y += s.player.vy;
      if (s.player.y >= GROUND - s.player.h) { s.player.y = GROUND - s.player.h; s.player.vy = 0; s.player.onGround = true; }
      if (s.frame % 7 === 0 && s.player.onGround) s.player.frame = (s.player.frame+1)%2;

      // Spawn obstacles
      s.spawn--;
      if (s.spawn <= 0) {
        const h = 30 + Math.random()*35;
        const isDouble = Math.random() > 0.7 && s.score > 50;
        s.obstacles.push({ x: W+10, y: GROUND-h, w: 20+Math.random()*14, h, double: isDouble });
        if (isDouble) s.obstacles.push({ x: W+10, y: GROUND-h*1.6, w: 16, h: h*0.6, floating: true });
        s.spawn = Math.max(40, 75 - Math.floor(s.score/30)*3) + Math.random()*40;
      }
      s.obstacles.forEach(o => o.x -= s.speed);
      s.obstacles = s.obstacles.filter(o => o.x > -60);
      s.clouds.forEach(c => { c.x -= 0.6; if (c.x < -120) c.x = W+60; });

      // Collision
      const p = s.player;
      for (const o of s.obstacles) {
        if (p.x+p.w-6>o.x+3 && p.x+5<o.x+o.w-3 && p.y+p.h-4>o.y+3 && p.y+5<o.y+o.h) {
          s.running=false; saveScore('mario',playerName,Math.floor(s.score)); setRunning(false); onGameOver(Math.floor(s.score)); return;
        }
      }

      // Draw BG
      const sky = ctx.createLinearGradient(0,0,0,GROUND);
      sky.addColorStop(0, lvl.bg1); sky.addColorStop(1, lvl.bg2);
      ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);

      // Stars/bubbles depending on level
      if (s.level <= 1) { // ocean: bubbles
        ctx.fillStyle='rgba(100,200,255,0.15)';
        for (let i=0;i<12;i++) { ctx.beginPath(); ctx.arc((i*97+s.frame*0.3)%W, (i*67+s.frame*0.2)%(GROUND-10), 3+i%3, 0, Math.PI*2); ctx.fill(); }
      } else {
        ctx.fillStyle='#ffffff44';
        for (let i=0;i<20;i++) ctx.fillRect((i*137+s.frame*0.1)%W, (i*53)%(GROUND-20), 1.5, 1.5);
      }

      // Sun/moon
      if (s.level >= 4) {
        ctx.fillStyle = s.level>=5 ? '#ffa020aa' : '#ffffffff';
        ctx.beginPath(); ctx.arc(W-40, 30, s.level>=5 ? 22 : 14, 0, Math.PI*2); ctx.fill();
      }

      // Clouds
      s.clouds.forEach(c => {
        ctx.fillStyle = s.level<=1 ? '#0040801a' : '#3d250055';
        ctx.beginPath(); ctx.ellipse(c.x,c.y,c.w/2,14,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(c.x-14,c.y+6,c.w/3,10,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(c.x+14,c.y+6,c.w/3,10,0,0,Math.PI*2); ctx.fill();
      });

      // Ground
      ctx.fillStyle = lvl.ground; ctx.fillRect(0,GROUND,W,H-GROUND);
      ctx.fillStyle = lvl.gline; ctx.fillRect(0,GROUND,W,3);
      // Ground pattern
      ctx.fillStyle = lvl.ground+'99';
      for (let gx=(s.frame*s.speed*0.3)%44; gx<W; gx+=44) ctx.fillRect(gx,GROUND+6,22,2);

      // Obstacles (themed)
      s.obstacles.forEach(o => {
        ctx.fillStyle = lvl.obstacleColor;
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = lvl.obstacleColor2;
        ctx.fillRect(o.x+2, o.y+2, o.w-4, 6);
        ctx.fillStyle = lvl.obstacleColor+'99';
        ctx.fillRect(o.x+2, o.y+10, o.w-4, o.h-12);
        // handle
        ctx.strokeStyle = lvl.obstacleColor; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.arc(o.x+o.w+4, o.y+o.h/2, 5, -Math.PI/2, Math.PI/2); ctx.stroke();
      });

      // Player (barista character)
      const px=p.x, py=p.y;
      ctx.fillStyle='#c8943a'; ctx.fillRect(px+4,py+15,20,20);
      ctx.fillStyle='#e8b85a'; ctx.beginPath(); ctx.ellipse(px+14,py+10,12,12,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#1a0f00'; ctx.beginPath(); ctx.arc(px+10,py+9,2,0,Math.PI*2); ctx.arc(px+18,py+9,2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#f5e6c8'; ctx.fillRect(px+6,py+17,16,14);
      ctx.fillStyle='#6b3d11';
      if (p.onGround&&p.frame===1) { ctx.fillRect(px+3,py+35,8,11); ctx.fillRect(px+17,py+37,8,9); }
      else { ctx.fillRect(px+4,py+35,8,10); ctx.fillRect(px+16,py+35,8,10); }
      ctx.fillStyle='#1a0f00'; ctx.fillRect(px+5,py+1,18,5); ctx.fillRect(px+8,py-8,12,10);

      // Level badge
      ctx.fillStyle=T.gold; ctx.font=`bold 12px Georgia`; ctx.textAlign='left';
      ctx.fillText(`☕ ${Math.floor(s.score)}`, 8, 22);
      ctx.font='10px Georgia'; ctx.fillStyle='rgba(255,255,255,0.6)';
      ctx.fillText(lvl.name, 8, 36);

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if(rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [running, GROUND, W, H, playerName, onGameOver]);

  useEffect(() => {
    if (running) return;
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext('2d');
    const sky=ctx.createLinearGradient(0,0,0,H); sky.addColorStop(0,'#001830'); sky.addColorStop(1,'#003060');
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#0a3050'; ctx.fillRect(0,GROUND,W,H-GROUND);
    ctx.fillStyle=T.gold; ctx.font=`bold 22px Georgia`; ctx.textAlign='center';
    ctx.fillText('🏃 CAFÉ RUNNER',W/2,H/2-14);
    ctx.font='12px Georgia'; ctx.fillStyle=T.dim; ctx.fillText('Ocean → Beach → City → Sky → Space!',W/2,H/2+12);
  }, [running, W, H, GROUND]);

  useEffect(() => { const k=(e)=>{if(e.code==='Space'||e.key==='ArrowUp'){e.preventDefault();jump();}}; window.addEventListener('keydown',k); return()=>window.removeEventListener('keydown',k); },[jump]);

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1 }}>
      <div style={S.gameBar}>
        <span style={S.score}>☕ {score}</span>
        <span style={{ fontSize:11, color:T.dim }}>{levelName}</span>
        <span style={{ fontSize:11, color:T.dim }}>{playerName}</span>
      </div>
      <div ref={containerRef} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'6px 0' }}>
        <canvas ref={canvasRef} width={W} height={H} style={{ display:'block', maxWidth:'100%', cursor:'pointer', borderRadius:8 }} onClick={running ? jump : start} />
        {running
          ? <button style={{ ...S.btn(T.brown), border:`1px solid ${T.gold}55`, padding:'12px 60px', fontSize:22, marginTop:8 }} onClick={jump}>JUMP ↑</button>
          : <button style={{ ...S.btn(), padding:'12px 48px', marginTop:8 }} onClick={start}>START</button>
        }
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TETRIS — fills full screen width
// ═══════════════════════════════════════════════════════════════════
function TetrisGame({ playerName, onGameOver }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const stateRef = useRef(null);
  const timerRef = useRef(null);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [alive, setAlive] = useState(false);
  const [highScore, setHighScore] = useState(() => getTop('tetris')[0]?.score || 0);
  const [size, setSize] = useState({ cell: 28, cols: 10, rows: 20 });

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const avail = Math.min(containerRef.current.clientWidth - 16, 360);
        const cell = Math.floor(avail / 10);
        const rows = Math.floor((window.innerHeight - 160) / cell);
        setSize({ cell, cols: 10, rows: Math.max(16, Math.min(22, rows)) });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const { cell: CELL, cols: COLS, rows: ROWS } = size;
  const W = COLS * CELL, H = ROWS * CELL;

  const PIECES = [
    { shape:[[1,1,1,1]], color:T.gold },
    { shape:[[1,1],[1,1]], color:'#c8501a' },
    { shape:[[1,1,1],[0,1,0]], color:'#8a3a9a' },
    { shape:[[1,1,1],[1,0,0]], color:T.danger },
    { shape:[[1,1,1],[0,0,1]], color:'#3a7ac8' },
    { shape:[[1,1,0],[0,1,1]], color:T.success },
    { shape:[[0,1,1],[1,1,0]], color:'#c83a6a' },
  ];

  const emptyBoard = () => Array.from({length:ROWS},()=>Array(COLS).fill(null));
  const rndPiece = () => { const p=PIECES[Math.floor(Math.random()*PIECES.length)]; return {shape:p.shape.map(r=>[...r]),color:p.color,x:Math.floor(COLS/2)-Math.floor(p.shape[0].length/2),y:0}; };
  const rotate = (s) => s[0].map((_,i)=>s.map(r=>r[i]).reverse());
  const valid = useCallback((board,piece,dx=0,dy=0,shape=null)=>{
    const sh=shape||piece.shape;
    for(let r=0;r<sh.length;r++) for(let c=0;c<sh[r].length;c++) if(sh[r][c]){const nx=piece.x+c+dx,ny=piece.y+r+dy; if(nx<0||nx>=COLS||ny>=ROWS) return false; if(ny>=0&&board[ny][nx]) return false;} return true;
  },[COLS,ROWS]);

  const drawBoard = useCallback((ctx, board, piece) => {
    if (!ctx) return;
    ctx.fillStyle='#080400'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#2c1a0022'; ctx.lineWidth=0.5;
    for(let r=0;r<ROWS;r++){ctx.beginPath();ctx.moveTo(0,r*CELL);ctx.lineTo(W,r*CELL);ctx.stroke();}
    for(let c=0;c<COLS;c++){ctx.beginPath();ctx.moveTo(c*CELL,0);ctx.lineTo(c*CELL,H);ctx.stroke();}
    const dc=(x,y,color,a=1)=>{
      ctx.globalAlpha=a;
      ctx.fillStyle=color; ctx.fillRect(x*CELL+1,y*CELL+1,CELL-2,CELL-2);
      ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.fillRect(x*CELL+1,y*CELL+1,CELL-2,4);
      ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.fillRect(x*CELL+1,y*CELL+CELL-5,CELL-2,4);
      ctx.globalAlpha=1;
    };
    board.forEach((row,r)=>row.forEach((cell,c)=>{if(cell)dc(c,r,cell);}));
    if(piece){
      let gy=piece.y; while(valid(board,{...piece,y:gy+1})) gy++;
      piece.shape.forEach((row,r)=>row.forEach((cell,c)=>{if(cell&&gy+r>=0)dc(piece.x+c,gy+r,piece.color,0.18);}));
      piece.shape.forEach((row,r)=>row.forEach((cell,c)=>{if(cell&&piece.y+r>=0)dc(piece.x+c,piece.y+r,piece.color);}));
    }
  },[W,H,CELL,ROWS,COLS,valid]);

  const startGame = useCallback(() => {
    if(timerRef.current) clearInterval(timerRef.current);
    const s={board:emptyBoard(),piece:rndPiece(),score:0,lines:0,running:true};
    stateRef.current=s; setScore(0); setLines(0); setAlive(true);
    drawBoard(canvasRef.current?.getContext('2d'),s.board,s.piece);
  },[ROWS,COLS,drawBoard]);

  const stepDown = useCallback(()=>{
    const s=stateRef.current; if(!s||!s.running) return;
    if(valid(s.board,s.piece,0,1)){s.piece.y++;}
    else{
      s.piece.shape.forEach((row,r)=>row.forEach((cell,c)=>{if(cell&&s.piece.y+r>=0)s.board[s.piece.y+r][s.piece.x+c]=s.piece.color;}));
      let cleared=0;
      for(let r=ROWS-1;r>=0;r--){if(s.board[r].every(c=>c)){s.board.splice(r,1);s.board.unshift(Array(COLS).fill(null));cleared++;r++;}}
      s.lines+=cleared; s.score+=([0,100,300,500,800][cleared]||0)+10;
      setScore(s.score); setLines(s.lines);
      s.piece=rndPiece();
      if(!valid(s.board,s.piece)){s.running=false; saveScore('tetris',playerName,s.score); setAlive(false); setHighScore(h=>Math.max(h,s.score)); onGameOver(s.score); return;}
    }
    drawBoard(canvasRef.current?.getContext('2d'),s.board,s.piece);
  },[ROWS,COLS,valid,drawBoard,playerName,onGameOver]);

  useEffect(()=>{
    if(!alive) return;
    const spd=Math.max(80,600-Math.floor((stateRef.current?.lines||0)/5)*45);
    timerRef.current=setInterval(stepDown,spd);
    return()=>clearInterval(timerRef.current);
  },[alive,stepDown,lines]);

  const move=(dx)=>{const s=stateRef.current; if(!s||!s.running) return; if(valid(s.board,s.piece,dx,0))s.piece.x+=dx; drawBoard(canvasRef.current?.getContext('2d'),s.board,s.piece);};
  const rot=()=>{const s=stateRef.current; if(!s||!s.running) return; const r=rotate(s.piece.shape); if(valid(s.board,s.piece,0,0,r))s.piece.shape=r; drawBoard(canvasRef.current?.getContext('2d'),s.board,s.piece);};
  const drop=()=>{const s=stateRef.current; if(!s||!s.running) return; while(valid(s.board,s.piece,0,1))s.piece.y++; stepDown();};

  useEffect(()=>{
    if(!alive) return;
    const k=(e)=>{
      if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}
      if(e.key==='ArrowRight'){e.preventDefault();move(1);}
      if(e.key==='ArrowDown'){e.preventDefault();stepDown();}
      if(e.key==='ArrowUp'){e.preventDefault();rot();}
      if(e.key===' '){e.preventDefault();drop();}
    };
    window.addEventListener('keydown',k); return()=>window.removeEventListener('keydown',k);
  },[alive,stepDown]);

  useEffect(()=>{
    if(!alive){const canvas=canvasRef.current; if(!canvas) return; const ctx=canvas.getContext('2d'); ctx.fillStyle='#080400'; ctx.fillRect(0,0,W,H); ctx.fillStyle=T.gold; ctx.font=`bold ${Math.round(CELL*0.9)}px Georgia`; ctx.textAlign='center'; ctx.fillText('🟦 TETRIS',W/2,H/2-16); ctx.font=`${Math.round(CELL*0.55)}px Georgia`; ctx.fillStyle=T.dim; ctx.fillText('Stack the blocks!',W/2,H/2+16);}
  },[alive,W,H,CELL]);

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1 }}>
      <div style={S.gameBar}>
        <span style={S.score}>{score} pts</span>
        <span style={{ fontSize:11, color:T.dim }}>{playerName} · {lines} lines</span>
        <span style={{ fontSize:11, color:T.dim }}>Best:{highScore}</span>
      </div>
      <div ref={containerRef} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', padding:'6px 0', overflowY:'auto' }}>
        <canvas ref={canvasRef} width={W} height={H} style={{ display:'block' }} />
        {alive ? (
          <div style={{ padding:'8px 12px', width:'100%', maxWidth:300 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, margin:'0 auto', maxWidth:200 }}>
              <div/><div style={S.padBtn} onClick={rot}>↻</div><div/>
              <div style={S.padBtn} onClick={()=>move(-1)}>◀</div>
              <div style={S.padBtn} onClick={stepDown}>▼</div>
              <div style={S.padBtn} onClick={()=>move(1)}>▶</div>
            </div>
            <button style={{ ...S.btn(T.brown), border:`1px solid ${T.gold}55`, padding:'11px', width:'100%', marginTop:6 }} onClick={drop}>DROP ↓↓</button>
          </div>
        ) : (
          <button style={{ ...S.btn(), padding:'12px 48px', marginTop:10 }} onClick={startGame}>START</button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SPOT THE DIFFERENCE — multiple scene sets
// ═══════════════════════════════════════════════════════════════════
const SPOT_DIFFS = [
  { id:0, x:222, y:30,  r:16 },
  { id:1, x:58,  y:102, r:15 },
  { id:2, x:157, y:147, r:14 },
  { id:3, x:252, y:138, r:13 },
  { id:4, x:110, y:55,  r:13 },
];

// Scene drawers — each returns a draw function
const SCENES = [
  // Scene 0: Café interior
  {
    name: 'The Café',
    draw: (ctx, isB, W, H, foundIds, fl) => {
      const GR = H - 48;
      const wall = ctx.createLinearGradient(0,0,0,H); wall.addColorStop(0,'#2c1a00'); wall.addColorStop(1,'#1a0f00');
      ctx.fillStyle=wall; ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#3d2200'; ctx.fillRect(0,GR,W,H-GR);
      ctx.fillStyle='#4a2a00'; for(let fx=0;fx<W;fx+=38) ctx.fillRect(fx,GR,19,H-GR);
      ctx.fillStyle='#1a3060'; ctx.fillRect(28,18,78,68);
      ctx.fillStyle='#2a5090'; ctx.fillRect(30,20,35,64); ctx.fillStyle='#3a70b0'; ctx.fillRect(67,20,37,64);
      ctx.strokeStyle='#6b3d11'; ctx.lineWidth=4; ctx.strokeRect(28,18,78,68); ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(67,18); ctx.lineTo(67,86); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(28,52); ctx.lineTo(106,52); ctx.stroke();
      ctx.fillStyle='#ffe08088'; [[43,33],[78,27],[93,43],[53,58],[83,63]].forEach(([sx,sy])=>{ctx.beginPath();ctx.arc(sx,sy,2,0,Math.PI*2);ctx.fill();});
      if(isB){ctx.fillStyle='#ffe080';ctx.beginPath();ctx.arc(222,30,5,0,Math.PI*2);ctx.fill();}
      ctx.fillStyle='#5c3010'; ctx.fillRect(0,GR-33,W,33);
      ctx.fillStyle='#7a4020'; ctx.fillRect(0,GR-36,W,5);
      ctx.fillStyle='#8a5530'; ctx.fillRect(168,GR-88,48,55);
      ctx.fillStyle='#c8943a'; ctx.fillRect(173,GR-83,38,18);
      ctx.fillStyle='#1a0f00'; ctx.beginPath(); ctx.arc(192,GR-75,7,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#3a6030'; ctx.beginPath(); ctx.arc(192,GR-75,4.5,0,Math.PI*2); ctx.fill();
      if(!isB){ctx.fillStyle='#f5e6c8';ctx.fillRect(50,GR-36,14,18);ctx.fillStyle='#c8943a';ctx.fillRect(48,GR-38,18,4);ctx.strokeStyle='#6b3d11';ctx.lineWidth=2;ctx.beginPath();ctx.arc(64,GR-28,4,-Math.PI/2,Math.PI/2);ctx.stroke();}
      ctx.fillStyle='#3d1f00'; ctx.fillRect(128,23,58,52);
      ctx.fillStyle='#5a3010'; ctx.fillRect(131,26,52,47);
      ctx.fillStyle='#d4a853'; ctx.font='bold 7px Georgia'; ctx.textAlign='left'; ctx.fillText('MENU',138,37);
      ctx.fillStyle='#f5e6c8'; ctx.font='6px Georgia'; ctx.fillText('Latte ₱150',134,48); ctx.fillText('Espresso ₱120',134,57); ctx.fillText('Matcha ₱160',134,66);
      ctx.fillStyle='#c8943a'; ctx.beginPath(); ctx.arc(110,55,15,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#1a0f00'; ctx.beginPath(); ctx.arc(110,55,12,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#c8943a'; ctx.beginPath(); ctx.arc(110,55,2,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#1a0f00'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(110,55); ctx.lineTo(110+Math.cos(isB?-Math.PI/6:Math.PI/3)*8,55+Math.sin(isB?-Math.PI/6:Math.PI/3)*8); ctx.stroke();
      ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(110,55); ctx.lineTo(110,44); ctx.stroke();
      ctx.fillStyle='#8a3010'; ctx.fillRect(238,GR-45,18,10);
      ctx.fillStyle='#5a8030'; ctx.beginPath(); ctx.arc(247,GR-50,11,0,Math.PI*2); ctx.fill();
      if(isB){ctx.fillStyle='#4a7025';ctx.beginPath();ctx.ellipse(265,GR-52,9,4.5,Math.PI/4,0,Math.PI*2);ctx.fill();}
      ctx.fillStyle=isB?'#8a3030':'#2a5020'; ctx.fillRect(143,GR-30,28,20);
      ctx.strokeStyle='#6b3d11'; ctx.lineWidth=2; ctx.strokeRect(143,GR-30,28,20);
      ctx.fillStyle='#f5e6c8'; ctx.font='bold 6px Georgia'; ctx.textAlign='center'; ctx.fillText('OPEN',157,GR-20); ctx.fillText('10-11',157,GR-13);
    }
  },
  // Scene 1: Outdoor garden café
  {
    name: 'Garden Café',
    draw: (ctx, isB, W, H, foundIds, fl) => {
      const GR = H - 45;
      // Sky gradient
      const sky = ctx.createLinearGradient(0,0,0,GR);
      sky.addColorStop(0,'#87CEEB'); sky.addColorStop(1,'#c8e8ff');
      ctx.fillStyle=sky; ctx.fillRect(0,0,W,GR);
      // Ground
      ctx.fillStyle='#4a8030'; ctx.fillRect(0,GR,W,H-GR);
      ctx.fillStyle='#5a9040'; for(let i=0;i<W;i+=20) ctx.fillRect(i,GR,10,H-GR);
      // Sun (diff 0: bigger in B)
      ctx.fillStyle='#FFD700';
      ctx.beginPath(); ctx.arc(isB?222:218, 30, isB?12:8, 0, Math.PI*2); ctx.fill();
      // Big tree
      ctx.fillStyle='#5a3010'; ctx.fillRect(30,GR-80,14,80);
      ctx.fillStyle='#3a7020'; ctx.beginPath(); ctx.arc(37,GR-90,35,0,Math.PI*2); ctx.fill();
      // Umbrella table
      ctx.fillStyle='#c8302a'; ctx.beginPath(); ctx.moveTo(155,GR-55); ctx.lineTo(215,GR-55); ctx.lineTo(235,GR-40); ctx.lineTo(135,GR-40); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#8a1a14'; ctx.fillRect(183,GR-55,4,55);
      ctx.fillStyle='#8a6030'; ctx.ellipse && (ctx.beginPath(),ctx.ellipse(185,GR-5,30,6,0,0,Math.PI*2),ctx.fill());
      // Chairs (diff 1: missing chair in B)
      if(!isB){ctx.fillStyle='#8a6030';ctx.fillRect(58,GR-22,18,22);ctx.fillRect(55,GR-30,24,8);}
      ctx.fillStyle='#8a6030'; ctx.fillRect(240,GR-22,18,22); ctx.fillRect(237,GR-30,24,8);
      // Flower pot (diff 2: different color)
      ctx.fillStyle=isB?'#e05c2a':'#c8302a'; ctx.fillRect(255,GR-18,14,18);
      ctx.fillStyle='#5a9040'; ctx.beginPath(); ctx.arc(262,GR-22,10,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ff80a0'; ctx.beginPath(); ctx.arc(262,GR-25,5,0,Math.PI*2); ctx.fill();
      // Bird (diff 3: extra bird in B)
      if(isB){ctx.fillStyle='#333';ctx.beginPath();ctx.arc(252,35,4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#555';ctx.beginPath();ctx.moveTo(248,35);ctx.quadraticCurveTo(242,28,250,30);ctx.stroke();}
      // Cloud (diff 4: different shape)
      ctx.fillStyle='#ffffffcc';
      ctx.beginPath(); ctx.ellipse(110,40,isB?35:28,16,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(90,45,20,14,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(130,44,isB?22:16,12,0,0,Math.PI*2); ctx.fill();
    }
  },
  // Scene 2: Rooftop at night
  {
    name: 'Rooftop Night',
    draw: (ctx, isB, W, H, foundIds, fl) => {
      const GR = H - 42;
      ctx.fillStyle='#050510'; ctx.fillRect(0,0,W,H);
      // Stars
      const stars = [[20,15],[45,30],[80,10],[120,25],[160,8],[200,20],[240,35],[270,12],[50,50],[140,45],[210,55]];
      stars.forEach(([sx,sy]) => { ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(sx,sy,1.5,0,Math.PI*2); ctx.fill(); });
      // Moon (diff 0: full moon in B vs crescent)
      if(isB){ctx.fillStyle='#ffffc0';ctx.beginPath();ctx.arc(222,30,12,0,Math.PI*2);ctx.fill();}
      else{ctx.fillStyle='#ffffc0';ctx.beginPath();ctx.arc(222,30,12,0,Math.PI*2);ctx.fill();ctx.fillStyle='#050510';ctx.beginPath();ctx.arc(228,27,10,0,Math.PI*2);ctx.fill();}
      // Rooftop floor
      ctx.fillStyle='#1a1a2e'; ctx.fillRect(0,GR,W,H-GR);
      ctx.fillStyle='#252540'; ctx.fillRect(0,GR,W,4);
      // City skyline in bg
      [[0,30,20,GR],[25,20,18,GR],[48,35,15,GR],[68,15,22,GR],[95,28,20,GR],[235,25,20,GR],[258,18,16,GR],[278,30,18,GR]].forEach(([x,h,w,gr])=>{
        ctx.fillStyle='#10102a'; ctx.fillRect(x,gr-h,w,h);
        ctx.fillStyle='#ffd70044'; if(Math.random()>0.5) ctx.fillRect(x+3,gr-h+5,4,4);
      });
      // Table with candle
      ctx.fillStyle='#3d2800'; ctx.fillRect(100,GR-25,100,25); ctx.fillRect(120,GR-5,10,5); ctx.fillRect(170,GR-5,10,5);
      // Candle (diff 1: no candle in B)
      if(!isB){ctx.fillStyle='#f5e6c8';ctx.fillRect(147,GR-38,8,14);ctx.fillStyle='#ff8020';ctx.beginPath();ctx.arc(151,GR-40,4,0,Math.PI*2);ctx.fill();}
      // Cups on table
      ctx.fillStyle='#f5e6c8'; ctx.fillRect(108,GR-32,12,8); ctx.fillRect(175,GR-32,12,8);
      ctx.fillStyle='#c8943a'; ctx.fillRect(106,GR-34,16,4); ctx.fillRect(173,GR-34,16,4);
      // String lights (diff 2: color change)
      for(let lx=0;lx<W;lx+=20){
        ctx.fillStyle=isB?`hsl(${lx*5},80%,60%)`:'#ffd700';
        ctx.beginPath(); ctx.arc(lx,GR-50+Math.sin(lx*0.1)*8,3,0,Math.PI*2); ctx.fill();
      }
      ctx.strokeStyle='#88880044'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(0,GR-50);
      for(let lx=0;lx<W;lx+=5) { ctx.lineTo(lx, GR-50+Math.sin(lx*0.1)*8); } ctx.stroke();
      // Plant (diff 3: extra in B)
      if(isB){ctx.fillStyle='#3d1800';ctx.fillRect(260,GR-30,14,30);ctx.fillStyle='#3a7020';ctx.beginPath();ctx.arc(267,GR-35,14,0,Math.PI*2);ctx.fill();}
      // Telescope (diff 4: pointing direction)
      ctx.fillStyle='#808080'; ctx.save(); ctx.translate(55,GR-30);
      ctx.rotate(isB?-Math.PI/4:-Math.PI/6); ctx.fillRect(-4,-20,8,22); ctx.restore();
      ctx.fillStyle='#606060'; ctx.fillRect(48,GR-30,18,6);
    }
  },
];

function SpotDiffGame({ playerName, onGameOver }) {
  const [found, setFound] = useState([]);
  const [flash, setFlash] = useState(null);
  const [timeLeft, setTimeLeft] = useState(90);
  const [done, setDone] = useState(false);
  const [sceneIdx] = useState(() => Math.floor(Math.random() * SCENES.length));
  const canvasA = useRef(null), canvasB = useRef(null);
  const containerRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ w: 280, h: 200 });

  const scene = SCENES[sceneIdx];

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const w = Math.min(Math.floor((containerRef.current.clientWidth - 20) / 2), 280);
        const h = Math.round(w * 0.72);
        setCanvasSize({ w, h });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const { w: W, h: H } = canvasSize;

  const redraw = useCallback(() => {
    [canvasA, canvasB].forEach((ref, idx) => {
      const canvas = ref.current; if (!canvas) return;
      const ctx = canvas.getContext('2d');
      scene.draw(ctx, idx === 1, W, H, found, flash);
      // Draw found circles
      if (found.length > 0) {
        found.forEach(id => {
          const d = SPOT_DIFFS[id];
          if (!d) return;
          const scaleX = W / 290, scaleY = H / 210;
          ctx.strokeStyle = T.success; ctx.lineWidth = 2.5; ctx.setLineDash([4,2]);
          ctx.beginPath(); ctx.arc(d.x*scaleX, d.y*scaleY, (d.r+4)*Math.min(scaleX,scaleY), 0, Math.PI*2); ctx.stroke();
          ctx.setLineDash([]);
        });
      }
      if (flash && flash.canvas === (idx===1?'b':'a')) {
        ctx.strokeStyle=T.danger; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(flash.x, flash.y, 12, 0, Math.PI*2); ctx.stroke();
      }
    });
  }, [found, flash, W, H, scene]);

  useEffect(() => { redraw(); }, [redraw]);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setTimeLeft(tl => {
      if (tl <= 1) { const sc=found.length*20; saveScore('spot',playerName,sc); setDone(true); onGameOver(sc); return 0; }
      return tl - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [done, found.length, playerName, onGameOver]);

  const tap = (e, isB) => {
    if (done) return;
    const canvas = isB ? canvasB.current : canvasA.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width, scaleY = H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const baseScaleX = W / 290, baseScaleY = H / 210;
    for (const d of SPOT_DIFFS) {
      if (found.includes(d.id)) continue;
      if (Math.sqrt((x-d.x*baseScaleX)**2 + (y-d.y*baseScaleY)**2) < (d.r+10)*Math.min(baseScaleX,baseScaleY)) {
        const nf = [...found, d.id]; setFound(nf);
        if (nf.length === SPOT_DIFFS.length) { const sc=nf.length*20+timeLeft*2; saveScore('spot',playerName,sc); setDone(true); onGameOver(sc); }
        return;
      }
    }
    setFlash({ x, y, canvas: isB?'b':'a' }); setTimeout(()=>setFlash(null), 500);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1 }}>
      <div style={S.gameBar}>
        <span style={S.score}>Found: {found.length}/5</span>
        <span style={{ fontSize:12, color: timeLeft<20?T.danger:T.dim }}>⏱ {timeLeft}s</span>
        <span style={{ fontSize:11, color:T.dim }}>{scene.name}</span>
      </div>
      <div ref={containerRef} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', overflowY:'auto', padding:'6px 8px' }}>
        <div style={{ fontSize:11, color:T.dim, marginBottom:6, textAlign:'center' }}>
          {done ? (found.length===5?'🎉 All found!':'⏰ Time up!') : 'Tap the differences in either picture!'}
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
          {[false,true].map(isB => (
            <div key={String(isB)}>
              <div style={{ fontSize:9, color:T.dim, textAlign:'center', marginBottom:3 }}>{isB?'Find here →':'Original'}</div>
              <canvas ref={isB?canvasB:canvasA} width={W} height={H} style={{ borderRadius:8, border:`1px solid ${T.brown}55`, cursor:'crosshair', display:'block' }} onClick={e=>tap(e,isB)} />
            </div>
          ))}
        </div>
        <div style={{ display:'flex', justifyContent:'center', gap:6, flexWrap:'wrap', marginTop:10, padding:'0 8px' }}>
          {SPOT_DIFFS.map(d => (
            <span key={d.id} style={{ fontSize:11, padding:'3px 10px', borderRadius:20, background:found.includes(d.id)?T.success+'33':T.cardLight, color:found.includes(d.id)?T.success:T.dim, border:`1px solid ${found.includes(d.id)?T.success:T.brown+'44'}` }}>
              {found.includes(d.id)?'✓':'?'} #{d.id+1}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN GAMES PAGE
// ═══════════════════════════════════════════════════════════════════
const GAME_LIST = [
  { id:'snake',       icon:'🐍', name:'Snake',        desc:'Eat the beans!' },
  { id:'mario',       icon:'🏃', name:'Café Runner',  desc:'Ocean → Space!' },
  { id:'tetris',      icon:'🟦', name:'Tetris',        desc:'Stack blocks!' },
  { id:'spot',        icon:'🔍', name:'Spot the Diff', desc:'3 random scenes!' },
  { id:'cafemystery', icon:'☕', name:'Café Mystery',  desc:'Multiplayer · 3-10 players!' },
];

const GAME_LABELS = { snake:'🐍 Snake', mario:'🏃 Café Runner', tetris:'🟦 Tetris', spot:'🔍 Spot the Diff', cafemystery:'☕ Café Mystery' };

export default function GamesPage() {
  const [activeGame, setActiveGame] = useState(null);
  const [playerName, setPlayerName] = useState(null);
  const [showName, setShowName] = useState(false);
  const [pendingGame, setPendingGame] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [showBoard, setShowBoard] = useState(false);

  const pickGame = (id) => {
    setActiveGame(null); setGameOver(null); setPlayerName(null); setPendingGame(id);
    if (id === 'cafemystery') { setActiveGame('cafemystery'); setPlayerName('multiplayer'); }
    else setShowName(true);
  };

  const handleName = (name) => { setPlayerName(name); setShowName(false); setActiveGame(pendingGame); setGameOver(null); };
  const handleGameOver = (score) => { setGameOver({ score }); };
  const exitGame = () => { setActiveGame(null); setGameOver(null); setPlayerName(null); setPendingGame(null); };
  const restart = () => { setGameOver(null); setActiveGame(null); setTimeout(()=>setActiveGame(pendingGame),50); };

  // FULLSCREEN GAME
  if (activeGame && playerName) {
    return (
      <div style={S.fullscreen}>
        <div style={S.fsHeader}>
          <button style={S.backBtn} onClick={exitGame}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Exit
          </button>
          <div style={S.fsTitle}>{GAME_LABELS[activeGame]}</div>
          <button style={{ ...S.backBtn, padding:'7px 10px' }} onClick={() => { exitGame(); setShowBoard(true); }}>🏆</button>
        </div>
        <div style={S.fsContent}>
          {activeGame==='snake'       && <SnakeGame    key={'s'+playerName} playerName={playerName} onGameOver={handleGameOver} />}
          {activeGame==='mario'       && <MarioGame    key={'m'+playerName} playerName={playerName} onGameOver={handleGameOver} />}
          {activeGame==='tetris'      && <TetrisGame   key={'t'+playerName} playerName={playerName} onGameOver={handleGameOver} />}
          {activeGame==='spot'        && <SpotDiffGame key={'d'+playerName} playerName={playerName} onGameOver={handleGameOver} />}
          {activeGame==='cafemystery' && <CafeGame onExit={exitGame} />}
        </div>
        {gameOver && (
          <GameOverModal game={pendingGame} playerName={playerName} score={gameOver.score}
            onRestart={restart} onLeaderboard={()=>{exitGame();setShowBoard(true);}} />
        )}
      </div>
    );
  }

  if (showBoard) return <Leaderboard onClose={() => setShowBoard(false)} />;

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:4 }}>
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
        <button style={{ ...S.btn(T.card), marginTop:8, border:`1px solid ${T.gold}55`, fontSize:12, padding:'6px 18px' }} onClick={()=>setShowBoard(true)}>
          🏆 Leaderboard
        </button>
      </div>
      <div style={S.gameGrid}>
        {GAME_LIST.map(g => (
          <div key={g.id} style={S.card()} onClick={() => pickGame(g.id)}>
            <div style={{ fontSize:34, marginBottom:8 }}>{g.icon}</div>
            <div style={{ fontSize:13, fontWeight:'bold', color:T.gold, letterSpacing:0.5 }}>{g.name}</div>
            <div style={{ fontSize:10, color:T.dim, marginTop:3 }}>{g.desc}</div>
            {getTop(g.id).length>0 && (
              <div style={{ fontSize:10, color:T.dim, marginTop:6, borderTop:`1px solid ${T.brown}44`, paddingTop:5 }}>
                🥇 {getTop(g.id)[0].name}: {getTop(g.id)[0].score}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ textAlign:'center', padding:'8px 16px 20px', color:T.dim, fontSize:11 }}>
        Tap a game to play · Name yourself after a menu item ☕
      </div>
      {showName && <NameModal game={pendingGame} onStart={handleName} />}
    </div>
  );
}
