import React, { useState, useEffect, useRef, useCallback } from 'react';
import CafeGame from './CafeGame';
import { db } from '../firebase/config';
import {
  collection, doc, setDoc, getDoc, getDocs,
  query, orderBy, limit, where, serverTimestamp
} from 'firebase/firestore';
import ZombieGame from './ZombieGame';

// ─── THEME ───────────────────────────────────────────────────────────────────
const S = {
  wrap: { minHeight: '100vh', background: '#0a0400', color: '#f5e6d0', fontFamily: "'Georgia', serif", position:'relative', overflow:'hidden' },
  header: { position:'relative', zIndex:2, background: 'linear-gradient(180deg, #3d1500 0%, #1a0800 100%)', padding: '20px 16px 14px', textAlign: 'center', borderBottom: '2px solid #8b4a00', overflow:'hidden' },
  logo: { fontSize: 28, fontWeight: 'bold', letterSpacing: 3, background: 'linear-gradient(180deg, #fff8d0 0%, #ffc200 40%, #ff7700 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', animation:'logoGlow 2s ease-in-out infinite alternate' },
  sub: { fontSize: 11, color: '#c87a30', marginTop: 4, letterSpacing: 2, textTransform:'uppercase' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 16 },
  // Clean brown card — no emoji icon
  card: {
    background: 'linear-gradient(160deg, #2c1600, #1e0e00)',
    border: '1px solid #6b3a1f',
    borderTop: '3px solid #d4a85366',
    borderRadius: 16,
    padding: '22px 14px 16px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  cardTitle: { fontSize: 13, fontWeight: 'bold', letterSpacing: 1, textTransform:'uppercase', background:'linear-gradient(180deg,#fff8d0,#ffc200)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' },
  cardSub: { fontSize: 11, color: '#a07850', marginTop: 6 },
  cardBest: { fontSize: 11, color: '#8bc34a', marginTop: 8, background: 'rgba(139,195,74,0.1)', borderRadius: 8, padding: '2px 8px' },
  // Fullscreen game
  fullscreen: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#1a0a00', zIndex: 9999, display: 'flex', flexDirection: 'column' },
  gameBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#2a1000', borderBottom: '2px solid #6b3a1f', minHeight: 50, flexShrink: 0 },
  backBtn: { background: '#6b3a1f', border: 'none', color: '#d4a853', padding: '8px 16px', borderRadius: 20, fontSize: 14, cursor: 'pointer', fontWeight: 'bold' },
  gameTitle: { color: '#d4a853', fontWeight: 'bold', fontSize: 16 },
  lbBtn: { background: '#d4a853', border: 'none', color: '#1a0a00', padding: '8px 16px', borderRadius: 20, fontSize: 14, cursor: 'pointer', fontWeight: 'bold' },
  gameContent: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: 'linear-gradient(145deg, #2a1000, #3d1f00)', border: '2px solid #6b3a1f', borderRadius: 20, padding: 28, width: '100%', maxWidth: 360, textAlign: 'center' },
  input: { width: '100%', background: '#1a0a00', border: '1px solid #6b3a1f', borderRadius: 10, padding: '10px 14px', color: '#f5e6d0', fontSize: 15, marginBottom: 10, boxSizing: 'border-box' },
  btn: (color='#d4a853') => ({ width: '100%', background: color, border: 'none', borderRadius: 10, padding: '12px', color: color === '#d4a853' ? '#1a0a00' : '#f5e6d0', fontSize: 15, fontWeight: 'bold', cursor: 'pointer', marginBottom: 8 }),
  chip: { display: 'inline-block', background: '#6b3a1f', borderRadius: 20, padding: '6px 14px', margin: '4px', cursor: 'pointer', fontSize: 13, color: '#d4a853', border: '1px solid #8b5a2b' },
  lbRow: (i) => ({ display: 'flex', alignItems: 'center', padding: '10px 14px', background: i % 2 === 0 ? 'rgba(61,31,0,0.5)' : 'transparent', borderRadius: 8, marginBottom: 4 }),
  medal: (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`,
};

const MENU_NAMES = ['Latte','Matcha','Americano','Espresso','Cappuccino','Frappe','Mocha','Macchiato','Cortado','Affogato'];

const GAME_LIST = [
  { id: 'snake',       title: 'Snake',           sub: 'Collect coffee beans' },
  { id: 'tetris',      title: 'Tetris',           sub: 'Classic stacking' },
  { id: 'racing',      title: 'Café Racer',       sub: 'Dodge the barriers' },
  { id: 'zombie',      title: 'Zombie Barista',   sub: 'Multiplayer survival' },
  { id: 'guessword',   title: 'Guess the Word',   sub: 'Clues & letters' },
  { id: 'cafemystery', title: 'Café Mystery',     sub: 'Social deduction' },
];

// ─── FIREBASE AUTH ────────────────────────────────────────────────────────────
async function registerUser(username, password) {
  const ref = doc(db, 'gameUsers', username.toLowerCase());
  const snap = await getDoc(ref);
  if (snap.exists()) throw new Error('Username already taken!');
  await setDoc(ref, { username, password, createdAt: serverTimestamp() });
  return username;
}

async function loginUser(username, password) {
  const ref = doc(db, 'gameUsers', username.toLowerCase());
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Username not found!');
  if (snap.data().password !== password) throw new Error('Wrong password!');
  return snap.data().username;
}

async function saveScore(username, gameId, score) {
  const key = `${username}_${gameId}`;
  const ref = doc(db, 'leaderboard', key);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().score < score) {
    await setDoc(ref, { username, gameId, score, updatedAt: serverTimestamp() });
  }
}

async function getLeaderboard(gameId) {
  const q = query(collection(db, 'leaderboard'), where('gameId','==',gameId), orderBy('score','desc'), limit(10));
  const snaps = await getDocs(q);
  return snaps.docs.map(d => d.data());
}

// ─── AUTH MODAL ───────────────────────────────────────────────────────────────
function AuthModal({ onAuth, onClose }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!username.trim() || !password.trim()) { setError('Fill in both fields'); return; }
    setLoading(true); setError('');
    try {
      let user;
      if (mode === 'register') user = await registerUser(username.trim(), password);
      else user = await loginUser(username.trim(), password);
      onAuth(user);
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={{fontSize:36,marginBottom:8}}>☕</div>
        <div style={{fontSize:20,fontWeight:'bold',color:'#d4a853',marginBottom:4}}>
          {mode === 'login' ? 'Welcome Back!' : 'Join the Café'}
        </div>
        <div style={{fontSize:12,color:'#a07850',marginBottom:20}}>
          {mode === 'login' ? 'Sign in to track your scores' : 'Create a unique café name'}
        </div>
        <input style={S.input} placeholder="Username (e.g. Latte)" value={username} onChange={e=>setUsername(e.target.value)} autoCapitalize="none" />
        <input style={S.input} placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        {error && <div style={{color:'#ff6b6b',fontSize:13,marginBottom:8}}>{error}</div>}
        <button style={S.btn()} onClick={handle} disabled={loading}>{loading ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}</button>
        <button style={S.btn('#6b3a1f')} onClick={()=>{setMode(mode==='login'?'register':'login');setError('');}}>
          {mode === 'login' ? 'New? Create Account' : 'Already have one? Sign In'}
        </button>
        <button style={{background:'none',border:'none',color:'#a07850',cursor:'pointer',fontSize:13}} onClick={onClose}>Play as Guest</button>
      </div>
    </div>
  );
}

// ─── NAME ENTRY MODAL ─────────────────────────────────────────────────────────
function NameModal({ gameTitle, username, onStart, onClose }) {
  const [name, setName] = useState(username || '');
  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={{fontSize:36,marginBottom:8}}>🎮</div>
        <div style={{fontSize:20,fontWeight:'bold',color:'#d4a853',marginBottom:4}}>{gameTitle}</div>
        <div style={{fontSize:13,color:'#a07850',marginBottom:16}}>Enter your player name</div>
        <input style={S.input} placeholder="Your name..." value={name} onChange={e=>setName(e.target.value)} />
        <div style={{marginBottom:16}}>
          {MENU_NAMES.map(n=>(
            <span key={n} style={S.chip} onClick={()=>setName(n)}>{n}</span>
          ))}
        </div>
        <button style={S.btn()} onClick={()=>name.trim()&&onStart(name.trim())}>▶ Start Game</button>
        <button style={S.btn('#6b3a1f')} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ─── LEADERBOARD MODAL ────────────────────────────────────────────────────────
function LeaderboardModal({ onClose, username }) {
  const [tab, setTab] = useState(GAME_LIST[0].id);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getLeaderboard(tab).then(r=>{ setRows(r); setLoading(false); }).catch(()=>setLoading(false));
  }, [tab]);

  return (
    <div style={S.overlay}>
      <div style={{...S.modal, maxHeight:'85vh', overflowY:'auto', maxWidth:400}}>
        <div style={{fontSize:28,marginBottom:4}}>🏆</div>
        <div style={{fontSize:20,fontWeight:'bold',color:'#d4a853',marginBottom:12}}>Global Leaderboard</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:6,justifyContent:'center',marginBottom:16}}>
          {GAME_LIST.map(g=>(
            <button key={g.id} onClick={()=>setTab(g.id)}
              style={{background: tab===g.id ? '#d4a853':'#3d1f00', color: tab===g.id ? '#1a0a00':'#d4a853',
                border:'1px solid #6b3a1f', borderRadius:20, padding:'6px 12px', fontSize:12, cursor:'pointer'}}>
              {g.title}
            </button>
          ))}
        </div>
        {loading ? <div style={{color:'#a07850'}}>Loading...</div> : rows.length === 0 ?
          <div style={{color:'#a07850',padding:20}}>No scores yet — be the first!</div> :
          rows.map((r,i)=>(
            <div key={i} style={{...S.lbRow(i), background: r.username===username ? 'rgba(212,168,83,0.15)' : S.lbRow(i).background}}>
              <span style={{width:28,fontSize:18}}>{S.medal(i)}</span>
              <span style={{flex:1,fontWeight:'bold',color: r.username===username ? '#d4a853':'#f5e6d0'}}>{r.username}</span>
              <span style={{color:'#8bc34a',fontWeight:'bold'}}>{r.score.toLocaleString()}</span>
              {r.username===username && <span style={{marginLeft:6,fontSize:11,color:'#d4a853'}}>YOU</span>}
            </div>
          ))
        }
        <button style={{...S.btn('#6b3a1f'),marginTop:16}} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SNAKE — bigger canvas, fills screen, starts slow
// ═══════════════════════════════════════════════════════════════════════════════
const ORB_COLORS = ['#ff4444','#ff8800','#44ff88','#4488ff','#ff44ff','#ffff44','#44ffff','#ff6644','#ff2288','#00ffcc'];

function SnakeGame({ playerName, onScore }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const stateRef = useRef(null);
  const [score, setScore] = useState(0);
  const [alive, setAlive] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ w: 340, h: 520 });

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const w = Math.min(containerRef.current.clientWidth - 4, 420);
      const h = Math.min(window.innerHeight - 160, 580);
      setCanvasSize({ w, h });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const { w: W, h: H } = canvasSize;
  const CELL = 20, COLS = Math.floor(W / CELL), ROWS = Math.floor(H / CELL);

  // Joystick ref
  const jsRef = useRef({ cx: 72, cy: 0, r: 55, knobR: 22, kx: 0, ky: 0, active: false, maxDist: 32 });

  // Orbs - regenerate positions based on canvas size
  const orbsRef = useRef(null);
  const orbColors = ORB_COLORS;
  if (!orbsRef.current || orbsRef.current.length === 0) {
    orbsRef.current = Array.from({length:30},(_,i) => ({
      x: 20 + Math.random()*(W-40),
      y: 20 + Math.random()*(H-40),
      color: orbColors[i % orbColors.length],
      size: 2 + Math.random()*3.5,
      phase: Math.random()*Math.PI*2,
      speed: 0.02 + Math.random()*0.05,
      // Each orb drifts slowly
      vx: (Math.random()-0.5)*0.3,
      vy: (Math.random()-0.5)*0.3,
    }));
  }

  const placeFood = (snake, cols, rows) => {
    let pos;
    do { pos = { x: Math.floor(Math.random()*cols), y: Math.floor(Math.random()*rows) }; }
    while (snake.some(s => s.x===pos.x && s.y===pos.y));
    return pos;
  };

  const startGame = useCallback(() => {
    const cx = Math.floor(COLS/2), cy = Math.floor(ROWS/2);
    stateRef.current = {
      snake: [{x:cx,y:cy},{x:cx-1,y:cy},{x:cx-2,y:cy},{x:cx-3,y:cy},{x:cx-4,y:cy}],
      dir: {x:1,y:0}, nextDir: {x:1,y:0},
      food: {x:cx+5,y:cy},
      score: 0, frame: 0, running: true
    };
    jsRef.current.cy = H - 72;
    setScore(0); setAlive(true);
  }, [COLS, ROWS, H]);

  useEffect(() => { if (COLS > 5 && ROWS > 5) startGame(); }, [COLS, ROWS, startGame]);

  const turn = useCallback((dx, dy) => {
    const g = stateRef.current; if (!g) return;
    if (dx !== -g.dir.x || dy !== -g.dir.y) g.nextDir = {x:dx, y:dy};
  }, []);

  // Joystick input
  const handleJsMove = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W/rect.width, scaleY = H/rect.height;
    const mx = (clientX - rect.left)*scaleX, my = (clientY - rect.top)*scaleY;
    const js = jsRef.current;
    let dx = mx - js.cx, dy = my - js.cy;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > js.maxDist) { dx = dx/dist*js.maxDist; dy = dy/dist*js.maxDist; }
    js.kx = dx; js.ky = dy;
    const angle = Math.atan2(dy, dx) * (180/Math.PI);
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      if (angle > -45 && angle <= 45) turn(1,0);
      else if (angle > 45 && angle <= 135) turn(0,1);
      else if (angle > 135 || angle <= -135) turn(-1,0);
      else turn(0,-1);
    }
  }, [W, H, turn]);

  // Canvas touch/mouse events
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const js = jsRef.current;

    const isOnJs = (mx, my) => Math.sqrt((mx-js.cx)**2 + (my-js.cy)**2) < js.r * 1.4;
    const getPos = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      return [(clientX-rect.left)*(W/rect.width), (clientY-rect.top)*(H/rect.height)];
    };

    const onTouchStart = e => {
      const [mx,my] = getPos(e.touches[0].clientX, e.touches[0].clientY);
      if (isOnJs(mx,my)) { js.active=true; e.preventDefault(); }
    };
    const onTouchMove = e => {
      if (js.active) { handleJsMove(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); }
    };
    const onTouchEnd = () => { js.active=false; js.kx=0; js.ky=0; };
    const onMouseDown = e => {
      const [mx,my] = getPos(e.clientX, e.clientY);
      if (isOnJs(mx,my)) js.active=true;
    };
    const onMouseMove = e => { if (js.active) handleJsMove(e.clientX, e.clientY); };
    const onMouseUp = () => { js.active=false; js.kx=0; js.ky=0; };

    canvas.addEventListener('touchstart', onTouchStart, {passive:false});
    canvas.addEventListener('touchmove', onTouchMove, {passive:false});
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [W, H, handleJsMove]);

  useEffect(() => {
    const k = e => {
      const m = {ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
      if (m[e.key]) { e.preventDefault(); turn(...m[e.key]); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [turn]);

  useEffect(() => {
    if (!alive) return;
    const interval = setInterval(() => {
      const g = stateRef.current; if (!g || !g.running) return;
      g.frame++;
      g.dir = {...g.nextDir};
      const head = {x: g.snake[0].x+g.dir.x, y: g.snake[0].y+g.dir.y};
      if (head.x<0||head.x>=COLS||head.y<0||head.y>=ROWS||g.snake.some(s=>s.x===head.x&&s.y===head.y)) {
        g.running=false; onScore(g.score); setAlive(false); return;
      }
      g.snake.unshift(head);
      if (head.x===g.food.x && head.y===g.food.y) {
        g.score+=10; setScore(g.score); g.food=placeFood(g.snake,COLS,ROWS);
      } else g.snake.pop();
    }, Math.max(90, 220 - Math.floor((stateRef.current?.score||0)/50)*15));
    return () => clearInterval(interval);
  }, [alive, COLS, ROWS, onScore]);

  // Main draw loop
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let rafId;
    let fn = 0;

    // Pre-render hex grid once (huge performance win)
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = W; bgCanvas.height = H;
    const bgCtx = bgCanvas.getContext('2d');
    bgCtx.fillStyle='#0d1117'; bgCtx.fillRect(0,0,W,H);
    const _hs=26, _hh=_hs*Math.sqrt(3);
    bgCtx.strokeStyle='#1e2530'; bgCtx.lineWidth=0.8;
    for(let row=-1;row<H/_hh+2;row++){
      for(let col=-1;col<W/(_hs*1.5)+2;col++){
        const hcx=col*_hs*1.5, hcy=row*_hh+(col%2)*_hh/2;
        bgCtx.fillStyle=((row+col)%3===0)?'#13181f':'#0f1419';
        bgCtx.beginPath();
        for(let a=0;a<6;a++){
          const ang=Math.PI/180*(60*a);
          bgCtx.lineTo(hcx+_hs*0.95*Math.cos(ang), hcy+_hs*0.95*Math.sin(ang));
        }
        bgCtx.closePath(); bgCtx.fill(); bgCtx.stroke();
      }
    }

        const draw = () => {
      fn++;
      const g = stateRef.current;
      const js = jsRef.current;
      const orbs = orbsRef.current;
      // === DRAW PRE-RENDERED HEX BACKGROUND ===
      ctx.drawImage(bgCanvas, 0, 0);

      // === GLOWING ORBS — drift around the map ===
      orbs.forEach(o => {
        // Drift position
        o.x += o.vx; o.y += o.vy;
        // Bounce off edges
        if(o.x < 10 || o.x > W-10) o.vx *= -1;
        if(o.y < 10 || o.y > H-10) o.vy *= -1;
        // Orbs are decoration only
        const pulse=0.7+0.3*Math.sin(fn*o.speed+o.phase);
        const r=o.size*pulse;
        // Glow ring
        ctx.fillStyle=o.color; ctx.globalAlpha=0.18*pulse;
        ctx.beginPath(); ctx.arc(o.x,o.y,r*3.5,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=0.5*pulse;
        ctx.beginPath(); ctx.arc(o.x,o.y,r*1.8,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=1;
        // Core bright
        ctx.fillStyle=o.color;
        ctx.beginPath(); ctx.arc(o.x,o.y,r,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.95)';
        ctx.beginPath(); ctx.arc(o.x,o.y,r*0.35,0,Math.PI*2); ctx.fill();
      });

      if (g) {
        // === FOOD ===
        const fx=g.food.x*CELL+CELL/2, fy=g.food.y*CELL+CELL/2;
        const fp=0.85+0.15*Math.sin(fn*0.1);
        ctx.shadowColor='#d4a853'; ctx.shadowBlur=18*fp;
        ctx.fillStyle='rgba(212,168,83,0.2)';
        ctx.beginPath(); ctx.arc(fx,fy,CELL*0.7*fp,0,Math.PI*2); ctx.fill();
        const fbg=ctx.createRadialGradient(fx-2,fy-2,0,fx,fy,CELL*0.42);
        fbg.addColorStop(0,'#ffd700'); fbg.addColorStop(0.5,'#d4a853'); fbg.addColorStop(1,'#8b5a00');
        ctx.fillStyle=fbg; ctx.beginPath(); ctx.arc(fx,fy,CELL*0.38*fp,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;

        // === SMOOTH SNAKE ===
        // Draw snake body as smooth connected path first
        if(g.snake.length > 1) {
          // Draw connecting lines between segments for smoothness
          ctx.save();
          ctx.lineCap='round'; ctx.lineJoin='round';
          for(let i=g.snake.length-1;i>0;i--){
            const s=g.snake[i], s2=g.snake[i-1];
            const tt=i/g.snake.length;
            const thick=(CELL*(0.82-tt*0.35))*2;
            const hue=110-tt*20, light=55-tt*15;
            ctx.strokeStyle=`hsl(${hue},85%,${light}%)`;
            ctx.lineWidth=thick;
            ctx.beginPath();
            ctx.moveTo(s.x*CELL+CELL/2, s.y*CELL+CELL/2);
            ctx.lineTo(s2.x*CELL+CELL/2, s2.y*CELL+CELL/2);
            ctx.stroke();
          }
          ctx.restore();
        }
        // Draw circles on top for scale effect (no shadowBlur on each)
        g.snake.forEach((s,i) => {
          const px=s.x*CELL+CELL/2, py=s.y*CELL+CELL/2;
          const tt=i/g.snake.length, thick=CELL*(0.82-tt*0.35);
          const hue=110-tt*20, light=55-tt*15;
          const sg=ctx.createRadialGradient(px-thick*0.2,py-thick*0.2,0,px,py,thick);
          sg.addColorStop(0,`hsl(${hue+10},95%,${light+15}%)`);
          sg.addColorStop(0.5,`hsl(${hue},85%,${light}%)`);
          sg.addColorStop(1,`hsl(${hue-10},70%,${light-20}%)`);
          ctx.fillStyle=sg;
          if(i===0){ ctx.shadowColor=`hsl(${hue},90%,${light}%)`; ctx.shadowBlur=12; }
          ctx.beginPath(); ctx.arc(px,py,thick,0,Math.PI*2); ctx.fill();
          ctx.shadowBlur=0;
        });

        // Head details
        if (g.snake.length >= 2) {
          const h=g.snake[0], nx=g.snake[1];
          const px=h.x*CELL+CELL/2, py=h.y*CELL+CELL/2;
          ctx.save(); ctx.translate(px,py);
          ctx.rotate(Math.atan2(g.dir.y,g.dir.x));
          [-1,1].forEach(side=>{
            ctx.shadowColor='#ffd700'; ctx.shadowBlur=8;
            ctx.fillStyle='#ffd700';
            ctx.beginPath(); ctx.arc(CELL*0.18,side*CELL*0.22,3.5,0,Math.PI*2); ctx.fill();
            ctx.shadowBlur=0; ctx.fillStyle='#111';
            ctx.beginPath(); ctx.ellipse(CELL*0.2,side*CELL*0.22,1.2,3,0,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='rgba(255,255,255,0.8)';
            ctx.beginPath(); ctx.arc(CELL*0.14,side*CELL*0.22-1.2,1,0,Math.PI*2); ctx.fill();
          });
          if(fn%24<12){
            ctx.strokeStyle='#ff3366'; ctx.lineWidth=1.5; ctx.lineCap='round';
            ctx.shadowColor='#ff3366'; ctx.shadowBlur=4;
            ctx.beginPath(); ctx.moveTo(CELL*0.45,0); ctx.lineTo(CELL*0.62,0); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(CELL*0.62,0); ctx.lineTo(CELL*0.74,-CELL*0.14);
            ctx.moveTo(CELL*0.62,0); ctx.lineTo(CELL*0.74,CELL*0.14); ctx.stroke();
            ctx.shadowBlur=0;
          }
          ctx.restore();
        }
      }

      // === JOYSTICK OVERLAY ===
      const jcx=js.cx, jcy=H-72, jr=js.r, jkr=js.knobR;
      ctx.save();
      ctx.globalAlpha=js.active?0.8:0.5;
      const og=ctx.createRadialGradient(jcx,jcy-jr*0.2,jr*0.1,jcx,jcy,jr);
      og.addColorStop(0,'rgba(50,28,0,0.85)'); og.addColorStop(1,'rgba(15,8,0,0.85)');
      ctx.fillStyle=og;
      ctx.shadowColor='rgba(0,0,0,0.6)'; ctx.shadowBlur=16;
      ctx.beginPath(); ctx.arc(jcx,jcy,jr,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
      ctx.strokeStyle=`rgba(212,168,83,${js.active?0.6:0.3})`; ctx.lineWidth=1.5;
      if(js.active){ctx.shadowColor='rgba(212,168,83,0.5)';ctx.shadowBlur=12;}
      ctx.beginPath(); ctx.arc(jcx,jcy,jr,0,Math.PI*2); ctx.stroke();
      ctx.shadowBlur=0;
      ctx.strokeStyle='rgba(212,168,83,0.08)'; ctx.lineWidth=0.8;
      ctx.beginPath(); ctx.arc(jcx,jcy,jr*0.55,0,Math.PI*2); ctx.stroke();
      // Arrow hints
      ctx.fillStyle=`rgba(212,168,83,${js.active?0.2:0.12})`;
      [[0,-1],[0,1],[-1,0],[1,0]].forEach(([dx,dy])=>{
        const ax=jcx+dx*(jr-14), ay=jcy+dy*(jr-14);
        ctx.save(); ctx.translate(ax,ay); ctx.rotate(Math.atan2(dy,dx));
        ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(-5,-5); ctx.lineTo(-5,5); ctx.closePath();
        ctx.fill(); ctx.restore();
      });
      // Knob
      const kpx=jcx+js.kx, kpy=jcy+js.ky;
      if(js.active){
        ctx.shadowColor='rgba(212,168,83,0.5)'; ctx.shadowBlur=18;
        ctx.fillStyle='rgba(212,168,83,0.12)';
        ctx.beginPath(); ctx.arc(kpx,kpy,jkr*1.6,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
      }
      const kg=ctx.createRadialGradient(kpx-jkr*0.25,kpy-jkr*0.3,0,kpx,kpy,jkr);
      kg.addColorStop(0,'#e8c060'); kg.addColorStop(0.45,'#c8943a');
      kg.addColorStop(0.75,'#8b5a00'); kg.addColorStop(1,'#4a2800');
      ctx.fillStyle=kg;
      ctx.shadowColor='rgba(0,0,0,0.7)'; ctx.shadowBlur=10;
      ctx.beginPath(); ctx.arc(kpx,kpy,jkr,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
      ctx.strokeStyle=`rgba(255,200,80,${js.active?0.6:0.35})`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(kpx,kpy,jkr,0,Math.PI*2); ctx.stroke();
      ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(kpx,kpy,jkr*0.65,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(kpx,kpy,jkr*0.35,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.ellipse(kpx-jkr*0.2,kpy-jkr*0.28,jkr*0.35,jkr*0.18,-0.4,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1; ctx.restore();

      // === HUD ===
      ctx.fillStyle='rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.roundRect(8,8,110,28,8); ctx.fill();
      ctx.fillStyle='#ffd700'; ctx.font='bold 14px Georgia'; ctx.textAlign='left';
      ctx.shadowColor='#ff8800'; ctx.shadowBlur=8;
      ctx.fillText(`☕ ${stateRef.current?.score||0}`, 16, 26);
      ctx.shadowBlur=0;
      ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font='11px Georgia';
      ctx.fillText(playerName, 70, 26);

      // Game over overlay
      if (!alive && g && !g.running) {
        ctx.fillStyle='rgba(0,0,0,0.72)'; ctx.fillRect(0,H/2-44,W,80);
        ctx.shadowColor='#ff0000'; ctx.shadowBlur=24;
        ctx.fillStyle='#ff4444'; ctx.font='bold 22px Georgia'; ctx.textAlign='center';
        ctx.fillText('GAME OVER',W/2,H/2-10); ctx.shadowBlur=0;
        ctx.fillStyle='#ffd700'; ctx.font='14px Georgia';
        ctx.fillText(`Score: ${g.score}`,W/2,H/2+18);
      }

      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [alive, W, H, CELL, COLS, ROWS, playerName]);

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 14px',background:'#08060e',borderBottom:'1px solid #1e2530',flexShrink:0}}>
        <span style={{fontSize:13,color:'#ffd700',fontWeight:'bold',textShadow:'0 0 8px #ff8800'}}>☕ {score}</span>
        <span style={{fontSize:11,color:'#888'}}>{playerName}</span>
        <button style={{background:'linear-gradient(180deg,#1a0e00,#0d0700)',border:'1px solid #d4a85366',borderRadius:8,color:'#ffd700',fontSize:12,padding:'5px 12px',cursor:'pointer'}} onClick={startGame}>↺ Restart</button>
      </div>
      <div ref={containerRef} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:'#0d1117'}}>
        <canvas ref={canvasRef} width={W} height={H} style={{display:'block',maxWidth:'100%'}}/>
      </div>
    </div>
  );
}



// ═══════════════════════════════════════════════════════════════════════════════
// TETRIS GAME
// ═══════════════════════════════════════════════════════════════════════════════
function TetrisGame({ playerName, onScore }) {
  const canvasRef   = useRef(null);
  const nextCanvRef = useRef(null);
  const containerRef= useRef(null);
  const stateRef    = useRef(null);
  const rafRef      = useRef(null);
  const cellRef     = useRef(24);
  const COLS=10, ROWS=20;
  const [score,  setScore]   = useState(0);
  const [level,  setLevel]   = useState(1);
  const [lines,  setLines]   = useState(0);
  const [gameOver,setGameOver]= useState(false);
  const [started, setStarted] = useState(false);

  const PIECES=[
    {shape:[[1,1,1,1]],        color:'#00e5ff', glow:'#00e5ff'},
    {shape:[[1,1],[1,1]],      color:'#ffd600', glow:'#ffd600'},
    {shape:[[1,1,1],[0,1,0]],  color:'#d500f9', glow:'#d500f9'},
    {shape:[[1,1,1],[1,0,0]],  color:'#ff6d00', glow:'#ff6d00'},
    {shape:[[1,1,1],[0,0,1]],  color:'#2979ff', glow:'#2979ff'},
    {shape:[[1,1,0],[0,1,1]],  color:'#ff1744', glow:'#ff1744'},
    {shape:[[0,1,1],[1,1,0]],  color:'#00e676', glow:'#00e676'},
  ];
  const rng=()=>PIECES[Math.floor(Math.random()*PIECES.length)];
  const newPiece=()=>{const p=rng();return{...p,x:Math.floor(COLS/2)-Math.floor(p.shape[0].length/2),y:0};};
  const rotate=s=>s[0].map((_,i)=>s.map(r=>r[i]).reverse());
  const collides=(board,piece,ox=0,oy=0)=>piece.shape.some((row,y)=>row.some((v,x)=>v&&(piece.x+x+ox<0||piece.x+x+ox>=COLS||piece.y+y+oy>=ROWS||board[piece.y+y+oy]?.[piece.x+x+ox])));
  const merge=(board,piece)=>{const b=board.map(r=>[...r]);piece.shape.forEach((row,y)=>row.forEach((v,x)=>{if(v)b[piece.y+y][piece.x+x]=piece.color;}));return b;};
  const clearLines=(board)=>{const b=board.filter(r=>r.some(v=>!v));const n=ROWS-b.length;return{board:[...Array.from({length:n},()=>Array(COLS).fill(0)),...b],cleared:n};};
  const initState=()=>({board:Array.from({length:ROWS},()=>Array(COLS).fill(0)),piece:newPiece(),next:newPiece(),score:0,lines:0,level:1,lastTime:0,speed:600});

  const calcCell=useCallback(()=>{
    const c=containerRef.current; if(!c)return 24;
    const bw=Math.floor(c.clientWidth*0.62);
    const bh=c.clientHeight-110;
    const byW=Math.floor(bw/COLS);
    const byH=Math.floor(bh/ROWS);
    return Math.max(10,Math.min(byW,byH,30));
  },[]);

  const drawBlock=(ctx,x,y,color,cell,alpha=1)=>{
    ctx.globalAlpha=alpha;
    ctx.fillStyle=color; ctx.fillRect(x*cell+1,y*cell+1,cell-2,cell-2);
    ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fillRect(x*cell+1,y*cell+1,cell-2,Math.max(2,cell*0.18)); ctx.fillRect(x*cell+1,y*cell+1,Math.max(2,cell*0.18),cell-2);
    ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(x*cell+1,y*cell+cell-Math.max(2,cell*0.18)-1,cell-2,Math.max(2,cell*0.18));
    ctx.globalAlpha=1;
  };

  const drawBoard=useCallback(()=>{
    const canvas=canvasRef.current; if(!canvas)return;
    const st=stateRef.current; if(!st)return;
    const CELL=cellRef.current;
    const ctx=canvas.getContext('2d');
    const W=COLS*CELL, H=ROWS*CELL;
    ctx.fillStyle='#080c14'; ctx.fillRect(0,0,W,H);
    for(let x=0;x<=COLS;x++){ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x*CELL,0);ctx.lineTo(x*CELL,H);ctx.stroke();}
    for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(0,y*CELL);ctx.lineTo(W,y*CELL);ctx.stroke();}
    ctx.strokeStyle=st.piece?.glow||'#00e5ff';ctx.lineWidth=2;ctx.strokeRect(0,0,W,H);
    let gy=st.piece.y;
    while(!collides(st.board,{...st.piece,y:gy+1}))gy++;
    st.piece.shape.forEach((row,y)=>row.forEach((v,x)=>{if(v)drawBlock(ctx,st.piece.x+x,gy+y,st.piece.color,CELL,0.15);}));
    st.board.forEach((row,y)=>row.forEach((v,x)=>{if(v)drawBlock(ctx,x,y,v,CELL);}));
    ctx.shadowColor=st.piece.glow;ctx.shadowBlur=CELL*0.8;
    st.piece.shape.forEach((row,y)=>row.forEach((v,x)=>{if(v)drawBlock(ctx,st.piece.x+x,st.piece.y+y,st.piece.color,CELL);}));
    ctx.shadowBlur=0;
  },[]);

  const drawNext=useCallback(()=>{
    const canvas=nextCanvRef.current;if(!canvas)return;
    const st=stateRef.current;if(!st)return;
    const NC=16;const W=4*NC,H=4*NC;
    canvas.width=W;canvas.height=H;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#080c14';ctx.fillRect(0,0,W,H);
    const p=st.next;
    const ox=Math.floor((4-p.shape[0].length)/2),oy=Math.floor((4-p.shape.length)/2);
    ctx.shadowColor=p.glow;ctx.shadowBlur=NC*0.8;
    p.shape.forEach((row,y)=>row.forEach((v,x)=>{if(v)drawBlock(ctx,ox+x,oy+y,p.color,NC);}));
    ctx.shadowBlur=0;
  },[]);

  const gameLoop=useCallback((ts)=>{
    const st=stateRef.current;if(!st)return;
    if(ts-st.lastTime>st.speed){
      st.lastTime=ts;
      if(!collides(st.board,st.piece,0,1)){st.piece.y++;}
      else{
        const nb=merge(st.board,st.piece);
        const{board,cleared}=clearLines(nb);
        st.board=board;
        const pts=[0,100,300,500,800][cleared]||0;
        st.score+=pts*(st.level||1);
        st.lines+=cleared;st.level=Math.floor(st.lines/10)+1;st.speed=Math.max(60,600-st.level*50);
        setScore(st.score);setLines(st.lines);setLevel(st.level);
        st.piece=st.next;st.next=newPiece();
        if(collides(st.board,st.piece)){setGameOver(true);onScore(st.score);return;}
      }
    }
    drawBoard();drawNext();
    rafRef.current=requestAnimationFrame(gameLoop);
  },[drawBoard,drawNext,onScore]);

  const startGame=()=>{
    const cell=calcCell();cellRef.current=cell;
    const canvas=canvasRef.current;
    if(canvas){canvas.width=COLS*cell;canvas.height=ROWS*cell;}
    stateRef.current=initState();
    setScore(0);setLines(0);setLevel(1);setGameOver(false);setStarted(true);
    rafRef.current=requestAnimationFrame(gameLoop);
  };

  useEffect(()=>{
    const ro=new ResizeObserver(()=>{
      const cell=calcCell();cellRef.current=cell;
      const canvas=canvasRef.current;
      if(canvas){canvas.width=COLS*cell;canvas.height=ROWS*cell;}
    });
    if(containerRef.current)ro.observe(containerRef.current);
    return()=>{ro.disconnect();if(rafRef.current)cancelAnimationFrame(rafRef.current);};
  },[calcCell]);

  const move=(dx)=>{const st=stateRef.current;if(!st)return;if(!collides(st.board,st.piece,dx,0))st.piece.x+=dx;};
  const drop=()=>{const st=stateRef.current;if(!st)return;while(!collides(st.board,st.piece,0,1))st.piece.y++;};
  const rot=()=>{const st=stateRef.current;if(!st)return;const r=rotate(st.piece.shape);const old=st.piece.shape;st.piece.shape=r;if(collides(st.board,st.piece))st.piece.shape=old;};

  useEffect(()=>{
    if(!started)return;
    const k=(e)=>{
      if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}
      if(e.key==='ArrowRight'){e.preventDefault();move(1);}
      if(e.key==='ArrowDown'){e.preventDefault();drop();}
      if(e.key==='ArrowUp'){e.preventDefault();rot();}
    };
    window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);
  },[started]);

  const ctrlBtn={background:'#1a1a2e',border:'2px solid #3a3a5e',color:'#fff',borderRadius:12,padding:'14px 0',fontSize:22,cursor:'pointer',userSelect:'none',WebkitUserSelect:'none',flex:1,boxShadow:'0 4px 0 rgba(0,0,0,0.4)',fontWeight:'bold'};

  return(
    <div ref={containerRef} style={{display:'flex',flexDirection:'column',height:'100%',background:'#050810',overflow:'hidden',fontFamily:"'Arial Black',Arial,sans-serif"}}>
      <div style={{flex:1,display:'flex',gap:0,overflow:'hidden',minHeight:0}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',flex:'0 0 auto',padding:'8px 4px 4px 8px'}}>
          <canvas ref={canvasRef} style={{display:'block',imageRendering:'pixelated'}}/>
        </div>
        <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'flex-start',padding:'10px 8px 4px 4px',gap:10,minWidth:0}}>
          <div style={{background:'#0d1120',border:'1px solid #1e2a4a',borderRadius:10,padding:'6px 8px'}}>
            <div style={{fontSize:9,color:'#4a6a9a',textTransform:'uppercase',letterSpacing:1}}>Player</div>
            <div style={{fontSize:12,color:'#e0e8ff',fontWeight:'bold',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{playerName}</div>
          </div>
          <div style={{background:'#0d1120',border:'1px solid #1e2a4a',borderRadius:10,padding:'6px 8px'}}>
            <div style={{fontSize:9,color:'#4a6a9a',textTransform:'uppercase',letterSpacing:1}}>Score</div>
            <div style={{fontSize:18,color:'#ffd600',fontWeight:900,textShadow:'0 0 8px #ffd600'}}>{score.toLocaleString()}</div>
          </div>
          <div style={{display:'flex',gap:6}}>
            <div style={{flex:1,background:'#0d1120',border:'1px solid #1e2a4a',borderRadius:10,padding:'6px 8px'}}>
              <div style={{fontSize:9,color:'#4a6a9a',textTransform:'uppercase',letterSpacing:1}}>Lv</div>
              <div style={{fontSize:16,color:'#00e5ff',fontWeight:900,textShadow:'0 0 8px #00e5ff'}}>{level}</div>
            </div>
            <div style={{flex:1,background:'#0d1120',border:'1px solid #1e2a4a',borderRadius:10,padding:'6px 8px'}}>
              <div style={{fontSize:9,color:'#4a6a9a',textTransform:'uppercase',letterSpacing:1}}>Lines</div>
              <div style={{fontSize:16,color:'#00e676',fontWeight:900,textShadow:'0 0 8px #00e676'}}>{lines}</div>
            </div>
          </div>
          <div style={{background:'#0d1120',border:'1px solid #1e2a4a',borderRadius:10,padding:'6px 8px'}}>
            <div style={{fontSize:9,color:'#4a6a9a',textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Next</div>
            <canvas ref={nextCanvRef} width={64} height={64} style={{display:'block',imageRendering:'pixelated',margin:'0 auto'}}/>
          </div>
        </div>
      </div>
      {gameOver&&(
        <div style={{position:'absolute',inset:0,background:'rgba(5,8,16,0.92)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:20}}>
          <div style={{fontSize:28,fontWeight:900,color:'#ff1744',textShadow:'0 0 20px #ff1744',marginBottom:4}}>GAME OVER</div>
          <div style={{fontSize:18,color:'#ffd600',marginBottom:20,textShadow:'0 0 10px #ffd600'}}>{score.toLocaleString()} pts</div>
          <button onClick={startGame} style={{background:'linear-gradient(180deg,#00e5ff,#0077aa)',border:'none',borderRadius:12,padding:'12px 32px',color:'#fff',fontSize:16,fontWeight:900,cursor:'pointer'}}>▶ PLAY AGAIN</button>
        </div>
      )}
      {!started&&!gameOver&&(
        <div style={{position:'absolute',inset:0,background:'rgba(5,8,16,0.92)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:20}}>
          <div style={{fontSize:32,fontWeight:900,color:'#00e5ff',textShadow:'0 0 20px #00e5ff',marginBottom:8,letterSpacing:3}}>TETRIS</div>
          <div style={{fontSize:13,color:'#4a6a9a',marginBottom:24}}>by {playerName}</div>
          <button onClick={startGame} style={{background:'linear-gradient(180deg,#00e5ff,#0077aa)',border:'none',borderRadius:12,padding:'14px 40px',color:'#fff',fontSize:18,fontWeight:900,cursor:'pointer',letterSpacing:1}}>▶ START</button>
        </div>
      )}
      <div style={{display:'flex',gap:8,padding:'8px',background:'#08101e',borderTop:'1px solid #1e2a4a',flexShrink:0}}>
        <button style={ctrlBtn} onPointerDown={e=>{e.preventDefault();move(-1);}}>◀</button>
        <button style={ctrlBtn} onPointerDown={e=>{e.preventDefault();rot();}}>↻</button>
        <button style={ctrlBtn} onPointerDown={e=>{e.preventDefault();drop();}}>⬇</button>
        <button style={ctrlBtn} onPointerDown={e=>{e.preventDefault();move(1);}}>▶</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAFÉ RACER — bigger canvas
// ═══════════════════════════════════════════════════════════════════════════════
function RacingGame({ playerName, onScore }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [collected, setCollected] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ w: 320, h: 480 });

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const w = Math.min(containerRef.current.clientWidth, 380);
      const h = Math.min(containerRef.current.clientHeight - 80, 560);
      setCanvasSize({ w, h });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const { w: W, h: H } = canvasSize;
  const GRASS_W = Math.round(W * 0.09);
  const ROAD_X = GRASS_W, ROAD_W = W - GRASS_W * 2;
  const LANES = 4, LANE_W = ROAD_W / LANES;
  const laneX = (l) => ROAD_X + l * LANE_W + LANE_W / 2;
  const CAR_COLORS=['#ff3333','#3399ff','#ffcc00','#44cc44','#cc44ff','#ff8800','#00cccc','#ff66aa'];

  const drawCar=(ctx,x,y,color,isPlayer=false)=>{
    const w=Math.round(W*0.07), h=Math.round(H*0.075);
    ctx.fillStyle='rgba(0,0,0,0.3)';ctx.beginPath();ctx.ellipse(x,y+h*0.4,w*0.45,h*0.12,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x-w/2,y-h/2,w,h,5);ctx.fill();
    ctx.fillStyle='rgba(200,240,255,0.85)';ctx.beginPath();ctx.roundRect(x-w*0.35,y-h*0.38,w*0.7,h*0.22,3);ctx.fill();
    ctx.fillStyle='rgba(200,240,255,0.7)';ctx.beginPath();ctx.roundRect(x-w*0.32,y+h*0.12,w*0.64,h*0.18,3);ctx.fill();
    ctx.fillStyle='#222';
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sy])=>{
      ctx.beginPath();ctx.roundRect(x+sx*(w*0.42)-4,y+sy*(h*0.3)-5,8,10,2);ctx.fill();
      ctx.fillStyle='#555';ctx.beginPath();ctx.roundRect(x+sx*(w*0.42)-2.5,y+sy*(h*0.3)-3.5,5,7,1);ctx.fill();
      ctx.fillStyle='#222';
    });
    if(isPlayer){ctx.fillStyle='#ffffaa';ctx.beginPath();ctx.ellipse(x-w*0.28,y-h*0.46,3,2,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(x+w*0.28,y-h*0.46,3,2,0,0,Math.PI*2);ctx.fill();}
  };

  const initState=()=>({car:{lane:1,x:laneX(1),y:H-Math.round(H*0.15)},traffic:[],coffees:[],score:0,speed:1.5,lastTime:0,spawnTimer:0,coffeeTimer:0,lineOffset:0,targetX:laneX(1)});

  const drawGame=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext('2d');const st=stateRef.current;
    ctx.fillStyle='#2d7a2d';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#267026';for(let i=0;i<H;i+=12){ctx.fillRect(0,i,GRASS_W,6);ctx.fillRect(W-GRASS_W,i,GRASS_W,6);}
    ctx.fillStyle='#1a5c1a';ctx.fillRect(GRASS_W-4,0,4,H);ctx.fillRect(W-GRASS_W,0,4,H);
    ctx.fillStyle='#404040';ctx.fillRect(ROAD_X,0,ROAD_W,H);
    ctx.fillStyle='#383838';for(let i=0;i<H;i+=20){ctx.fillRect(ROAD_X,i,ROAD_W,10);}
    ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.setLineDash([25,18]);ctx.lineDashOffset=-st.lineOffset;
    for(let l=1;l<LANES;l++){ctx.strokeStyle=l===LANES/2?'#ffff00':'#ffffff';ctx.lineWidth=l===LANES/2?3:1.5;ctx.beginPath();ctx.moveTo(ROAD_X+l*LANE_W,0);ctx.lineTo(ROAD_X+l*LANE_W,H);ctx.stroke();}
    ctx.setLineDash([]);ctx.strokeStyle='#ffffff';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(ROAD_X,0);ctx.lineTo(ROAD_X,H);ctx.stroke();
    ctx.beginPath();ctx.moveTo(ROAD_X+ROAD_W,0);ctx.lineTo(ROAD_X+ROAD_W,H);ctx.stroke();
    st.traffic.forEach(t=>drawCar(ctx,t.x,t.y,t.color));
    (st.coffees||[]).forEach(c=>{
      const pulse=0.8+0.2*Math.sin(Date.now()/300+c.id);
      ctx.save();ctx.shadowColor='#ffcc00';ctx.shadowBlur=10*pulse;
      ctx.font='18px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('☕',c.x,c.y);ctx.restore();
      ctx.strokeStyle=`rgba(255,200,0,${0.4*pulse})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(c.x,c.y,14*pulse,0,Math.PI*2);ctx.stroke();
    });
    st.car.x+=(st.targetX-st.car.x)*0.18;
    drawCar(ctx,st.car.x,st.car.y,'#ff3333',true);
    ctx.fillStyle='rgba(0,0,0,0.45)';ctx.fillRect(ROAD_X,0,70,36);
    ctx.fillStyle='#ffff00';ctx.font='bold 13px Arial';ctx.textAlign='left';
    ctx.fillText(`${Math.floor(80+st.speed*20)}km/h`,ROAD_X+6,22);
  },[W,H,GRASS_W,ROAD_X,ROAD_W,LANES,LANE_W]);

  const gameLoop=useCallback((ts)=>{
    const st=stateRef.current;if(!st)return;
    const dt=Math.min(ts-st.lastTime,50);st.lastTime=ts;
    st.lineOffset=(st.lineOffset+st.speed*1.5)%(43);
    st.score+=1;st.speed=1.5+st.score/900;setScore(st.score);
    st.spawnTimer+=dt;const interval=Math.max(350,1100-st.score*0.25);
    if(st.spawnTimer>interval){st.spawnTimer=0;const lane=Math.floor(Math.random()*LANES);st.traffic.push({x:laneX(lane),y:-40,lane,color:CAR_COLORS[Math.floor(Math.random()*CAR_COLORS.length)]});}
    st.coffeeTimer=(st.coffeeTimer||0)+dt;
    if(st.coffeeTimer>2200){st.coffeeTimer=0;const lane=Math.floor(Math.random()*LANES);st.coffees=[...(st.coffees||[]),{x:laneX(lane),y:-30,id:Math.random()}];}
    st.traffic=st.traffic.map(t=>({...t,y:t.y+st.speed*2.2})).filter(t=>t.y<H+60);
    const c=st.car;
    st.coffees=(st.coffees||[]).map(cf=>({...cf,y:cf.y+st.speed*2.2})).filter(cf=>{
      if(cf.y>H+40)return false;
      if(Math.abs(cf.x-c.x)<22&&Math.abs(cf.y-c.y)<22){st.score+=50;setScore(st.score);setCollected(n=>n+1);return false;}
      return true;
    });
    const cw=Math.round(W*0.07), ch=Math.round(H*0.075);
    const hit=st.traffic.some(t=>Math.abs(t.x-c.x)<cw*0.9&&Math.abs(t.y-c.y)<ch*0.9);
    if(hit){setGameOver(true);onScore(st.score);return;}
    drawGame();rafRef.current=requestAnimationFrame(gameLoop);
  },[drawGame,onScore,H,W,LANES,laneX]);

  const startGame=()=>{stateRef.current=initState();setScore(0);setCollected(0);setGameOver(false);setStarted(true);rafRef.current=requestAnimationFrame(gameLoop);};
  useEffect(()=>()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current);},[]);

  const lastMoveRef=useRef(0);
  const moveLeft=()=>{const now=Date.now();if(now-lastMoveRef.current<220)return;lastMoveRef.current=now;const st=stateRef.current;if(!st)return;const nl=Math.max(0,st.car.lane-1);st.car.lane=nl;st.targetX=laneX(nl);};
  const moveRight=()=>{const now=Date.now();if(now-lastMoveRef.current<220)return;lastMoveRef.current=now;const st=stateRef.current;if(!st)return;const nl=Math.min(LANES-1,st.car.lane+1);st.car.lane=nl;st.targetX=laneX(nl);};

  const btnStyle={background:'linear-gradient(180deg,#555,#333)',border:'2px solid #888',color:'#fff',padding:'18px 36px',borderRadius:14,fontSize:26,cursor:'pointer',userSelect:'none',WebkitUserSelect:'none',boxShadow:'0 4px 0 #111'};

  return(
    <div ref={containerRef} style={{display:'flex',flexDirection:'column',alignItems:'center',height:'100%',background:'#1a1a1a',overflow:'hidden'}}>
      <div style={{color:'#d4a853',fontSize:14,fontWeight:'bold',padding:'4px 0',flexShrink:0}}>{playerName} — Score: {score} ☕×{collected}</div>
      <canvas ref={canvasRef} width={W} height={H} style={{display:'block',flex:1,maxWidth:'100%'}}/>
      {!started&&!gameOver&&<button style={{...{width:'100%',background:'#d4a853',border:'none',borderRadius:10,padding:'12px',color:'#1a0a00',fontSize:15,fontWeight:'bold',cursor:'pointer',marginBottom:8},width:160,flexShrink:0}} onClick={startGame}>▶ Start</button>}
      {gameOver&&(
        <div style={{textAlign:'center',flexShrink:0}}>
          <div style={{color:'#ff6b6b',fontSize:20,fontWeight:'bold'}}>CRASH! 💥</div>
          <div style={{color:'#d4a853',marginBottom:8}}>Score: {score}</div>
          <button style={{width:160,background:'#d4a853',border:'none',borderRadius:10,padding:'12px',color:'#1a0a00',fontSize:15,fontWeight:'bold',cursor:'pointer'}} onClick={startGame}>▶ Again</button>
        </div>
      )}
      {started&&!gameOver&&(
        <div style={{display:'flex',gap:20,padding:'8px 0',flexShrink:0}}>
          <button style={btnStyle} onPointerDown={e=>{e.preventDefault();moveLeft();}} onTouchStart={e=>{e.preventDefault();moveLeft();}}>◀</button>
          <button style={btnStyle} onPointerDown={e=>{e.preventDefault();moveRight();}} onTouchStart={e=>{e.preventDefault();moveRight();}}>▶</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GUESS THE WORD — Wordle-style with animated barista characters
// ═══════════════════════════════════════════════════════════════════════════════
const WORD_LIST = [
  { word:'LATTE',     hint:'Espresso + steamed milk',           category:'Drinks' },
  { word:'MOCHA',     hint:'Coffee with chocolate syrup',       category:'Drinks' },
  { word:'FRAPPE',    hint:'Blended iced coffee drink',         category:'Drinks' },
  { word:'MATCHA',    hint:'Finely ground green tea powder',    category:'Drinks' },
  { word:'BARISTA',   hint:'The person who makes your coffee',  category:'Café' },
  { word:'ALMOND',    hint:'Nut used for plant-based milk',     category:'Food' },
  { word:'MUFFIN',    hint:'Domed cup-baked treat',             category:'Food' },
  { word:'CARAMEL',   hint:'Sweet golden-brown sauce',          category:'Food' },
  { word:'VANILLA',   hint:'Classic white flavoring pod',       category:'Food' },
  { word:'COCONUT',   hint:'Tropical nut with white flesh',     category:'Food' },
  { word:'CINNAMON',  hint:'Bark spice sprinkled on lattes',    category:'Food' },
  { word:'ESPRESSO',  hint:'Strong short concentrated coffee',  category:'Drinks' },
  { word:'TIRAMISU',  hint:'Italian pick-me-up dessert',        category:'Food' },
  { word:'SMOOTHIE',  hint:'Blended fruit drink',               category:'Drinks' },
  { word:'PANCAKE',   hint:'Flat round griddle cake',           category:'Food' },
  { word:'BROWNIE',   hint:'Dense chocolate dessert square',    category:'Food' },
  { word:'WAFFLE',    hint:'Grid-patterned baked cake',         category:'Food' },
  { word:'AMERICANO', hint:'Espresso diluted with hot water',   category:'Drinks' },
  { word:'AFFOGATO',  hint:'Ice cream drowned in espresso',     category:'Drinks' },
  { word:'CROISSANT', hint:'Buttery crescent French pastry',    category:'Food' },
  { word:'MACCHIATO', hint:'Espresso stained with milk',        category:'Drinks' },
  { word:'COASTER',   hint:'Small mat placed under your cup',   category:'Café' },
  { word:'JOURNAL',   hint:'Notebook café visitors write in',   category:'Café' },
  { word:'CHEESECAKE',hint:'Creamy dessert on biscuit base',    category:'Food' },
  { word:'SANDWICH',  hint:'Two bread slices with filling',     category:'Food' },
  // Philippine Plants
  { word:'SAMPAGUITA', hint:'National flower of the Philippines, white and fragrant', category:'PH Plants' },
  { word:'WALING',     hint:'Queen of Philippine flowers, a rare orchid',             category:'PH Plants' },
  { word:'YLANGYLANG', hint:'Fragrant yellow flower used in perfumes',                category:'PH Plants' },
  { word:'BANABA',     hint:'Philippine tree with purple flowers, herbal tea source', category:'PH Plants' },
  { word:'ANAHAW',     hint:'National leaf of the Philippines, a fan palm',           category:'PH Plants' },
  { word:'NARRA',      hint:'National tree of the Philippines',                       category:'PH Plants' },
  { word:'BAMBOO',     hint:'Tall grass used in Philippine crafts and building',      category:'PH Plants' },
  { word:'KAMIAS',     hint:'Sour small green fruit used in sinigang',                category:'PH Plants' },
  // Philippine Animals
  { word:'TAMARAW',    hint:'Critically endangered dwarf buffalo of Mindoro',         category:'PH Animals' },
  { word:'TARSIER',    hint:'Tiny big-eyed primate found in Bohol',                  category:'PH Animals' },
  { word:'PAWIKAN',    hint:'Sea turtle that nests on Philippine beaches',            category:'PH Animals' },
  { word:'DUGONG',     hint:'Sea cow marine mammal found in Palawan waters',          category:'PH Animals' },
  { word:'KALAW',      hint:'Philippine hornbill whose call sounds like its name',    category:'PH Animals' },
  { word:'AGILA',      hint:'Philippine Eagle, the national bird',                    category:'PH Animals' },
  { word:'BUTIKI',     hint:'Common house lizard found on Philippine walls',          category:'PH Animals' },
  { word:'BUWAYA',     hint:'Philippine crocodile, critically endangered reptile',    category:'PH Animals' },
  { word:'BANGUS',     hint:'National fish of the Philippines, also called milkfish', category:'PH Animals' },
  { word:'KALABAW',    hint:'Water buffalo, the national animal of the Philippines',  category:'PH Animals' },
  { word:'MANOK',      hint:'Filipino word for chicken, found in every barangay',     category:'PH Animals' },
];

const PLAYABLE = WORD_LIST.filter(w => w.word.length >= 4 && w.word.length <= 9);
const KEYBOARD_ROWS = ['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];
const MAX_GUESSES = 6;

// ── Animated Barista SVG Characters ──────────────────────────────────────────
function BaristaLeft({ state }) {
  // state: 'wave' | 'cheer' | 'fight' | 'sad'
  const armLAngle = state === 'wave' ? -60 : state === 'fight' ? -100 : state === 'cheer' ? -80 : -20;
  const armRAngle = state === 'wave' ? -30 : state === 'fight' ? -80 : state === 'cheer' ? -80 : -20;
  const eyeStyle = state === 'fight' ? 'angry' : state === 'sad' ? 'sad' : 'happy';

  return (
    <svg width="72" height="110" viewBox="0 0 72 110" style={{ overflow: 'visible' }}>
      {/* Cap */}
      <ellipse cx="36" cy="22" rx="18" ry="5" fill="#1a1a1a"/>
      <rect x="20" y="16" width="32" height="8" rx="4" fill="#1a1a1a"/>
      <text x="36" y="23" textAnchor="middle" fontSize="6" fill="#fff" fontWeight="bold">BARISTA</text>
      {/* Head */}
      <ellipse cx="36" cy="34" rx="14" ry="14" fill="#e8b89a"/>
      {/* Eyes */}
      {eyeStyle === 'happy' && <>
        <ellipse cx="30" cy="32" rx="2.5" ry="2.5" fill="#3a2010"/>
        <ellipse cx="42" cy="32" rx="2.5" ry="2.5" fill="#3a2010"/>
      </>}
      {eyeStyle === 'angry' && <>
        <line x1="27" y1="29" x2="33" y2="31" stroke="#3a2010" strokeWidth="2"/>
        <line x1="39" y1="31" x2="45" y2="29" stroke="#3a2010" strokeWidth="2"/>
        <ellipse cx="30" cy="33" rx="2" ry="2" fill="#3a2010"/>
        <ellipse cx="42" cy="33" rx="2" ry="2" fill="#3a2010"/>
      </>}
      {eyeStyle === 'sad' && <>
        <line x1="27" y1="31" x2="33" y2="29" stroke="#3a2010" strokeWidth="1.5"/>
        <line x1="39" y1="29" x2="45" y2="31" stroke="#3a2010" strokeWidth="1.5"/>
        <ellipse cx="30" cy="33" rx="2" ry="2" fill="#3a2010"/>
        <ellipse cx="42" cy="33" rx="2" ry="2" fill="#3a2010"/>
      </>}
      {/* Smile */}
      {state !== 'sad' && <path d="M 30 39 Q 36 44 42 39" stroke="#a06040" strokeWidth="1.5" fill="none" strokeLinecap="round"/>}
      {state === 'sad' && <path d="M 30 42 Q 36 38 42 42" stroke="#a06040" strokeWidth="1.5" fill="none" strokeLinecap="round"/>}
      {/* Body — black shirt */}
      <rect x="22" y="47" width="28" height="32" rx="6" fill="#1a1a1a"/>
      {/* Apron */}
      <path d="M 26 48 L 22 79 L 50 79 L 46 48 Z" fill="#c8943a" opacity="0.9"/>
      <rect x="30" y="47" width="12" height="4" rx="2" fill="#c8943a"/>
      {/* Left arm */}
      <g transform={`rotate(${armLAngle}, 22, 52)`}>
        <rect x="8" y="50" width="14" height="8" rx="4" fill="#1a1a1a"/>
        <ellipse cx="8" cy="54" rx="5" ry="5" fill="#e8b89a"/>
        {/* wave hand */}
        {state === 'wave' && <>
          <ellipse cx="4" cy="50" rx="3" ry="4" fill="#e8b89a"/>
          <ellipse cx="1" cy="48" rx="2" ry="3" fill="#e8b89a"/>
        </>}
        {state === 'fight' && <>
          <rect x="2" y="51" width="8" height="6" rx="3" fill="#e8b89a"/>
        </>}
      </g>
      {/* Right arm */}
      <g transform={`rotate(${-armRAngle}, 50, 52)`}>
        <rect x="50" y="50" width="14" height="8" rx="4" fill="#1a1a1a"/>
        <ellipse cx="64" cy="54" rx="5" ry="5" fill="#e8b89a"/>
        {state === 'cheer' && <>
          <text x="66" y="46" fontSize="12">☕</text>
        </>}
      </g>
      {/* Legs */}
      <rect x="26" y="78" width="8" height="20" rx="4" fill="#3a2010"/>
      <rect x="38" y="78" width="8" height="20" rx="4" fill="#3a2010"/>
      {/* Shoes */}
      <ellipse cx="30" cy="98" rx="7" ry="4" fill="#1a1a1a"/>
      <ellipse cx="42" cy="98" rx="7" ry="4" fill="#1a1a1a"/>

      {/* Animations */}
      {state === 'wave' && (
        <animateTransform attributeName="transform" type="rotate" values="0 36 54;3 36 54;-3 36 54;0 36 54" dur="0.8s" repeatCount="indefinite"/>
      )}
      {state === 'cheer' && (
        <animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur="0.5s" repeatCount="indefinite"/>
      )}
      {state === 'fight' && (
        <animateTransform attributeName="transform" type="translate" values="0 0;3 0;0 0" dur="0.3s" repeatCount="indefinite"/>
      )}
      {state === 'sad' && (
        <animateTransform attributeName="transform" type="translate" values="0 0;0 2;0 0" dur="1.2s" repeatCount="indefinite"/>
      )}
    </svg>
  );
}

function BaristaRight({ state }) {
  const armLAngle = state === 'wave' ? 60 : state === 'fight' ? 100 : state === 'cheer' ? 80 : 20;
  const eyeStyle = state === 'fight' ? 'angry' : state === 'sad' ? 'sad' : 'happy';

  return (
    <svg width="72" height="110" viewBox="0 0 72 110" style={{ overflow: 'visible', transform: 'scaleX(-1)' }}>
      {/* Cap */}
      <ellipse cx="36" cy="22" rx="18" ry="5" fill="#1a1a1a"/>
      <rect x="20" y="16" width="32" height="8" rx="4" fill="#1a1a1a"/>
      <text x="36" y="23" textAnchor="middle" fontSize="6" fill="#fff" fontWeight="bold" transform="scale(-1,1) translate(-72,0)">BARISTA</text>
      {/* Head */}
      <ellipse cx="36" cy="34" rx="14" ry="14" fill="#d4a080"/>
      {/* Eyes */}
      {eyeStyle === 'happy' && <>
        <ellipse cx="30" cy="32" rx="2.5" ry="2.5" fill="#3a2010"/>
        <ellipse cx="42" cy="32" rx="2.5" ry="2.5" fill="#3a2010"/>
      </>}
      {eyeStyle === 'angry' && <>
        <line x1="27" y1="29" x2="33" y2="31" stroke="#3a2010" strokeWidth="2"/>
        <line x1="39" y1="31" x2="45" y2="29" stroke="#3a2010" strokeWidth="2"/>
        <ellipse cx="30" cy="33" rx="2" ry="2" fill="#3a2010"/>
        <ellipse cx="42" cy="33" rx="2" ry="2" fill="#3a2010"/>
      </>}
      {eyeStyle === 'sad' && <>
        <line x1="27" y1="31" x2="33" y2="29" stroke="#3a2010" strokeWidth="1.5"/>
        <line x1="39" y1="29" x2="45" y2="31" stroke="#3a2010" strokeWidth="1.5"/>
        <ellipse cx="30" cy="33" rx="2" ry="2" fill="#3a2010"/>
        <ellipse cx="42" cy="33" rx="2" ry="2" fill="#3a2010"/>
      </>}
      {state !== 'sad' && <path d="M 30 39 Q 36 44 42 39" stroke="#a06040" strokeWidth="1.5" fill="none" strokeLinecap="round"/>}
      {state === 'sad' && <path d="M 30 42 Q 36 38 42 42" stroke="#a06040" strokeWidth="1.5" fill="none" strokeLinecap="round"/>}
      {/* Body */}
      <rect x="22" y="47" width="28" height="32" rx="6" fill="#1a1a1a"/>
      <path d="M 26 48 L 22 79 L 50 79 L 46 48 Z" fill="#c8943a" opacity="0.9"/>
      <rect x="30" y="47" width="12" height="4" rx="2" fill="#c8943a"/>
      {/* Arms */}
      <g transform={`rotate(${armLAngle}, 22, 52)`}>
        <rect x="8" y="50" width="14" height="8" rx="4" fill="#1a1a1a"/>
        <ellipse cx="8" cy="54" rx="5" ry="5" fill="#d4a080"/>
        {state === 'wave' && <>
          <ellipse cx="4" cy="50" rx="3" ry="4" fill="#d4a080"/>
          <ellipse cx="1" cy="48" rx="2" ry="3" fill="#d4a080"/>
        </>}
        {state === 'fight' && <rect x="2" y="51" width="8" height="6" rx="3" fill="#d4a080"/>}
      </g>
      <g transform={`rotate(${-armLAngle*0.8}, 50, 52)`}>
        <rect x="50" y="50" width="14" height="8" rx="4" fill="#1a1a1a"/>
        <ellipse cx="64" cy="54" rx="5" ry="5" fill="#d4a080"/>
      </g>
      {/* Legs */}
      <rect x="26" y="78" width="8" height="20" rx="4" fill="#3a2010"/>
      <rect x="38" y="78" width="8" height="20" rx="4" fill="#3a2010"/>
      <ellipse cx="30" cy="98" rx="7" ry="4" fill="#1a1a1a"/>
      <ellipse cx="42" cy="98" rx="7" ry="4" fill="#1a1a1a"/>

      {state === 'wave' && <animateTransform attributeName="transform" type="rotate" values="0 36 54;-3 36 54;3 36 54;0 36 54" dur="0.9s" repeatCount="indefinite"/>}
      {state === 'cheer' && <animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur="0.6s" repeatCount="indefinite"/>}
      {state === 'fight' && <animateTransform attributeName="transform" type="translate" values="0 0;-3 0;0 0" dur="0.3s" repeatCount="indefinite"/>}
      {state === 'sad' && <animateTransform attributeName="transform" type="translate" values="0 0;0 2;0 0" dur="1.4s" repeatCount="indefinite"/>}
    </svg>
  );
}

function FightEffect({ show }) {
  if (!show) return null;
  return (
    <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 28, animation: 'popEffect 0.4s ease', pointerEvents: 'none', zIndex: 10 }}>
      💥
    </div>
  );
}

function GuessWordGame({ playerName, onScore }) {
  const [wordData, setWordData] = useState(null);
  const [guesses, setGuesses] = useState([]);
  const [current, setCurrent] = useState('');
  const [gameState, setGameState] = useState('playing');
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [streak, setStreak] = useState(0);
  const [shake, setShake] = useState(false);
  const [usedWords, setUsedWords] = useState([]);
  const [showHint, setShowHint] = useState(false);
  const [baristaState, setBaristaState] = useState('wave');
  const [showEffect, setShowEffect] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false);

  const pickWord = useCallback((used = []) => {
    const avail = PLAYABLE.filter(w => !used.includes(w.word));
    const list = avail.length > 0 ? avail : PLAYABLE;
    setWordData(list[Math.floor(Math.random() * list.length)]);
    setGuesses([]); setCurrent(''); setGameState('playing');
    setShowHint(false); setBaristaState('wave');
  }, []);

  useEffect(() => { pickWord([]); }, []);

  const word = wordData?.word || '';
  const WL = word.length;

  const getTileState = (guess, pos) => {
    if (!guess || pos >= guess.length) return 'empty';
    const letter = guess[pos];
    if (letter === word[pos]) return 'correct';
    if (word.includes(letter)) return 'present';
    return 'absent';
  };

  const getKeyState = (letter) => {
    let best = 'unused';
    for (const g of guesses) {
      for (let i = 0; i < g.length; i++) {
        if (g[i] !== letter) continue;
        const s = getTileState(g, i);
        if (s === 'correct') return 'correct';
        if (s === 'present') best = 'present';
        else if (best === 'unused') best = 'absent';
      }
    }
    return best;
  };

  const submitGuess = () => {
    if (current.length !== WL) {
      setShake(true); setTimeout(() => setShake(false), 500); return;
    }
    const newGuesses = [...guesses, current];
    setGuesses(newGuesses); setCurrent('');

    // Check correct
    if (current === word) {
      const pts = (MAX_GUESSES - newGuesses.length + 1) * 50 + streak * 20 + (showHint ? 0 : 30);
      setScore(s => s + pts); setStreak(s => s + 1);
      setGameState('won'); setBaristaState('cheer'); onScore(score + pts);
    } else {
      // Wrong guess — baristas fight!
      const remaining = MAX_GUESSES - newGuesses.length;
      setBaristaState('fight');
      setShowEffect(true); setWrongFlash(true);
      setTimeout(() => { setShowEffect(false); setWrongFlash(false); }, 600);
      setTimeout(() => { setBaristaState(remaining <= 1 ? 'sad' : 'wave'); }, 800);

      if (newGuesses.length >= MAX_GUESSES) {
        setGameState('lost'); setBaristaState('sad'); setStreak(0); onScore(score);
      }
    }
  };

  const pressKey = (key) => {
    if (gameState !== 'playing') return;
    if (key === 'ENTER') { submitGuess(); return; }
    if (key === 'DEL') { setCurrent(c => c.slice(0, -1)); return; }
    if (current.length < WL) setCurrent(c => c + key);
  };

  useEffect(() => {
    const k = (e) => {
      if (gameState !== 'playing') return;
      if (e.key === 'Enter') { e.preventDefault(); submitGuess(); }
      else if (e.key === 'Backspace') setCurrent(c => c.slice(0, -1));
      else if (/^[a-zA-Z]$/.test(e.key) && current.length < WL) setCurrent(c => c + e.key.toUpperCase());
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [current, gameState, word, WL]);

  const nextRound = () => {
    const nu = [...usedWords, word];
    setUsedWords(nu); setRound(r => r + 1); pickWord(nu);
  };

  const tileColors = {
    correct: { bg: '#538d4e', border: '#538d4e', color: '#fff' },
    present: { bg: '#b59f3b', border: '#b59f3b', color: '#fff' },
    absent:  { bg: '#3a3a3c', border: '#3a3a3c', color: '#fff' },
    empty:   { bg: 'transparent', border: '#3a3a3c', color: '#fff' },
    active:  { bg: 'transparent', border: '#999', color: '#fff' },
  };

  const keyColors = {
    correct: { bg: '#538d4e', color: '#fff' },
    present: { bg: '#b59f3b', color: '#fff' },
    absent:  { bg: '#3a3a3c', color: '#fff' },
    unused:  { bg: '#6b3a1f', color: '#d4a853' },
  };

  const TILE_SIZE = Math.min(46, Math.floor((Math.min(typeof window !== 'undefined' ? window.innerWidth : 390, 400) - 48) / Math.max(WL, 5)));

  if (!wordData) return <div style={{ color: '#d4a853', textAlign: 'center', padding: 40 }}>Loading...</div>;

  const wrongCount = guesses.filter((g, i) => {
    if (gameState === 'playing' && i === guesses.length - 1) return g !== word;
    return g !== word;
  }).length;

  return (
    <div style={{ height: '100%', background: '#121213', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: "'Arial',sans-serif", overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{ background: '#1a1a1b', borderBottom: '1px solid #3a3a3c', padding: '7px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: '#818384' }}>Round <b style={{ color: '#d4a853' }}>{round}</b></div>
        <div style={{ fontSize: 13, fontWeight: 'bold', color: '#d4a853', letterSpacing: 2 }}>GUESS THE WORD</div>
        <div style={{ fontSize: 11, color: '#818384' }}>⭐<b style={{ color: '#d4a853' }}>{score}</b> {streak > 0 && <span>🔥{streak}</span>}</div>
      </div>

      {/* Barista stage */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 12px', background: 'linear-gradient(180deg,#2c1400,#1a0800)', borderBottom: '2px solid #3d1f00', flexShrink: 0, height: 120, overflow: 'visible' }}>
        {/* Left barista */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <BaristaLeft state={baristaState} />
          <div style={{ fontSize: 9, color: '#d4a853', marginTop: 2, letterSpacing: 1 }}>KELLY</div>
        </div>

        {/* Center message */}
        <div style={{ flex: 1, textAlign: 'center', paddingBottom: 14 }}>
          {baristaState === 'wave' && (
            <div style={{ fontSize: 11, color: '#d4a853', animation: 'fadeIn 0.3s' }}>
              👋 Hi {playerName}! Guess the word!
            </div>
          )}
          {baristaState === 'fight' && (
            <div style={{ fontSize: 13, fontWeight: 'bold', color: '#ff4444', animation: 'popEffect 0.4s' }}>
              💥 WRONG!<br/><span style={{ fontSize: 10 }}>They're fighting!</span>
            </div>
          )}
          {baristaState === 'cheer' && (
            <div style={{ fontSize: 13, fontWeight: 'bold', color: '#538d4e', animation: 'fadeIn 0.3s' }}>
              🎉 CORRECT!<br/><span style={{ fontSize: 10, color: '#d4a853' }}>+{(MAX_GUESSES - guesses.length) * 50} pts!</span>
            </div>
          )}
          {baristaState === 'sad' && (
            <div style={{ fontSize: 11, color: '#818384' }}>
              😢 Aww...<br/><span style={{ fontSize: 10 }}>It was <b style={{ color: '#d4a853' }}>{word}</b></span>
            </div>
          )}

          {/* HP bar — lives left */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 6 }}>
            {Array.from({ length: MAX_GUESSES }).map((_, i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: i < (MAX_GUESSES - guesses.filter(g => g !== word || gameState !== 'playing').length) ? '#538d4e' : '#3a3a3c', border: '1px solid #555', transition: 'background 0.3s' }}/>
            ))}
          </div>

          {/* Category & hint */}
          <div style={{ fontSize: 9, color: '#555', marginTop: 4 }}>{wordData.category} · {WL} letters</div>
          {!showHint
            ? <button onClick={() => setShowHint(true)} style={{ background: 'transparent', border: '1px solid #3a3a3c', borderRadius: 6, padding: '2px 8px', color: '#818384', fontSize: 9, cursor: 'pointer', marginTop: 3 }}>💡 Hint −30pts</button>
            : <div style={{ fontSize: 10, color: '#b59f3b', marginTop: 3 }}>💡 {wordData.hint}</div>
          }
        </div>

        {/* Right barista */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <BaristaRight state={baristaState} />
          <div style={{ fontSize: 9, color: '#d4a853', marginTop: 2, letterSpacing: 1 }}>MARYZ</div>
        </div>

        <FightEffect show={showEffect} />
      </div>

      {/* Tile grid */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6px 0', gap: 4, overflowY: 'auto', background: wrongFlash ? 'rgba(255,50,50,0.05)' : 'transparent', transition: 'background 0.3s' }}>
        {Array.from({ length: MAX_GUESSES }).map((_, rowIdx) => {
          const guess = guesses[rowIdx];
          const isActive = rowIdx === guesses.length && gameState === 'playing';
          const displayWord = isActive ? current : (guess || '');
          const isShaking = isActive && shake;

          return (
            <div key={rowIdx} style={{ display: 'flex', gap: 4, animation: isShaking ? 'shake 0.4s ease' : 'none' }}>
              {Array.from({ length: WL }).map((_, colIdx) => {
                const letter = displayWord[colIdx] || '';
                let state = 'empty';
                if (guess) state = getTileState(guess, colIdx);
                else if (isActive && letter) state = 'active';
                const c = tileColors[state];
                return (
                  <div key={colIdx} style={{ width: TILE_SIZE, height: TILE_SIZE, background: c.bg, border: `2px solid ${c.border}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(TILE_SIZE * 0.46), fontWeight: 'bold', color: c.color, transition: guess ? `background 0.3s ${colIdx * 0.1}s, border-color 0.3s ${colIdx * 0.1}s` : 'border-color 0.1s', transform: isActive && letter && colIdx === current.length - 1 ? 'scale(1.1)' : 'scale(1)', userSelect: 'none', textTransform: 'uppercase' }}>
                    {letter}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Result banner */}
      {gameState !== 'playing' && (
        <div style={{ textAlign: 'center', padding: '8px 14px', background: gameState === 'won' ? '#538d4e22' : '#ff444422', borderTop: `1px solid ${gameState === 'won' ? '#538d4e' : '#ff4444'}`, flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 'bold', color: gameState === 'won' ? '#538d4e' : '#ff6b6b', marginBottom: 6 }}>
            {gameState === 'won' ? `🎉 ${guesses.length <= 2 ? 'Genius!' : guesses.length <= 4 ? 'Great job!' : 'Got it!'}` : `😔 It was "${word}"`}
          </div>
          <button onClick={nextRound} style={{ background: '#d4a853', border: 'none', borderRadius: 8, padding: '8px 28px', color: '#1a0a00', fontWeight: 'bold', fontSize: 13, cursor: 'pointer' }}>
            Next Word →
          </button>
        </div>
      )}

      {/* Keyboard */}
      <div style={{ background: '#1a1a1b', borderTop: '1px solid #3a3a3c', padding: '6px 4px 10px', flexShrink: 0 }}>
        {KEYBOARD_ROWS.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
            {ri === 2 && (
              <button onPointerDown={e => { e.preventDefault(); pressKey('ENTER'); }}
                style={{ background: '#818384', border: 'none', borderRadius: 4, padding: '12px 6px', color: '#fff', fontSize: 10, fontWeight: 'bold', cursor: 'pointer', minWidth: 40, userSelect: 'none' }}>
                ENTER
              </button>
            )}
            {row.split('').map(l => {
              const ks = keyColors[getKeyState(l)];
              return (
                <button key={l} onPointerDown={e => { e.preventDefault(); pressKey(l); }}
                  style={{ background: ks.bg, border: 'none', borderRadius: 4, padding: '12px 0', color: ks.color, fontSize: 13, fontWeight: 'bold', cursor: 'pointer', width: 28, userSelect: 'none', transition: 'background 0.2s' }}>
                  {l}
                </button>
              );
            })}
            {ri === 2 && (
              <button onPointerDown={e => { e.preventDefault(); pressKey('DEL'); }}
                style={{ background: '#818384', border: 'none', borderRadius: 4, padding: '12px 6px', color: '#fff', fontSize: 11, fontWeight: 'bold', cursor: 'pointer', minWidth: 40, userSelect: 'none' }}>
                ⌫
              </button>
            )}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
        @keyframes popEffect { 0%{transform:translate(-50%,-50%) scale(0.5);opacity:0} 50%{transform:translate(-50%,-50%) scale(1.4);opacity:1} 100%{transform:translate(-50%,-50%) scale(1);opacity:0} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN GAMES PAGE
const GAME_LABELS = { snake: '🐍 Snake', mario: '🏃 Café Runner', tetris: '🟦 Tetris', spot: '🔍 Spot the Diff' };

export default function GamesPage() {
  const [activeGame, setActiveGame] = useState(null);
  const [showLB, setShowLB] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [username, setUsername] = useState(()=>{try{return localStorage.getItem('cafeGameUser')||null;}catch{return null;}});
  const [showName, setShowName] = useState(false);
  const [pendingGame, setPendingGame] = useState(null);
  const [playerName, setPlayerName] = useState(()=>{try{return localStorage.getItem('cafePlayerName')||'';}catch{return '';}});
  const [localBests, setLocalBests] = useState(()=>{try{return JSON.parse(localStorage.getItem('cafeBests')||'{}');}catch{return {};}});

  const saveLocal = (gameId, score) => {
    setLocalBests(prev => {
      const upd = {...prev,[gameId]:Math.max(prev[gameId]||0,score)};
      try{localStorage.setItem('cafeBests',JSON.stringify(upd));}catch{}
      return upd;
    });
  };

  const handleGameSelect = (game) => {
    if (game.id==='cafemystery'||game.id==='zombie'){setActiveGame(game);return;}
    setPendingGame(game); setShowName(true);
  };

  const handleNameStart = (name) => {
    setPlayerName(name);try{localStorage.setItem('cafePlayerName',name);}catch{}
    setShowName(false); setActiveGame(pendingGame);
  };

  const handleScore = async (gameId, score) => {
    saveLocal(gameId, score);
    if (username && score > 0) { try{await saveScore(username,gameId,score);}catch(e){console.error(e);} }
  };

  const handleAuth = (user) => {
    setUsername(user);try{localStorage.setItem('cafeGameUser',user);}catch{}
    setShowAuth(false);
  };

  const handleLogout = () => {
    setUsername(null);try{localStorage.removeItem('cafeGameUser');}catch{}
  };

  if (activeGame) {
    return (
      <div style={S.fullscreen}>
        <div style={S.gameBar}>
          <button style={S.backBtn} onClick={()=>setActiveGame(null)}>← Exit</button>
          <span style={S.gameTitle}>{activeGame.title}</span>
          <button style={S.lbBtn} onClick={()=>{setActiveGame(null);setShowLB(true);}}>🏆</button>
        </div>
        <div style={S.gameContent}>
          {activeGame.id==='snake'       && <SnakeGame      playerName={playerName} onScore={s=>handleScore('snake',s)} />}
          {activeGame.id==='tetris'      && <TetrisGame     playerName={playerName} onScore={s=>handleScore('tetris',s)} />}
          {activeGame.id==='racing'      && <RacingGame     playerName={playerName} onScore={s=>handleScore('racing',s)} />}
          {activeGame.id==='zombie'      && <ZombieGame     playerName={playerName} username={username} onScore={s=>handleScore('zombie',s)} onBack={()=>setActiveGame(null)} />}
          {activeGame.id==='guessword'   && <GuessWordGame  playerName={playerName} onScore={s=>handleScore('guessword',s)} />}
          {activeGame.id==='cafemystery' && <CafeGame       playerName={playerName} onBack={()=>setActiveGame(null)} />}
        </div>
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      {showAuth   && <AuthModal onAuth={handleAuth} onClose={()=>setShowAuth(false)} />}
      {showName && pendingGame && <NameModal gameTitle={pendingGame.title} username={username} onStart={handleNameStart} onClose={()=>setShowName(false)} />}
      {showLB     && <LeaderboardModal onClose={()=>setShowLB(false)} username={username} />}

      {/* Header */}
      <div style={S.header}>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% 0%, rgba(255,140,0,0.2) 0%, transparent 70%)',pointerEvents:'none'}}/>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:12,position:'relative'}}>
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
            <rect x="3" y="9" width="28" height="18" rx="4" fill="#6b3a00" stroke="#d4a853" strokeWidth="1.5"/>
            <rect x="7" y="13" width="6" height="5" rx="1.5" fill="#ffc200"/>
            <rect x="21" y="13" width="6" height="5" rx="1.5" fill="#ffc200"/>
            <rect x="15" y="15" width="4" height="3" rx="1" fill="#ffc200"/>
            <line x1="10" y1="5" x2="10" y2="9" stroke="#ffc200" strokeWidth="1.8" strokeLinecap="round"/>
            <line x1="17" y1="4" x2="17" y2="9" stroke="#ffc200" strokeWidth="1.8" strokeLinecap="round"/>
            <line x1="24" y1="5" x2="24" y2="9" stroke="#ffc200" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span style={S.logo}>GAME CORNER</span>
        </div>
        <div style={S.sub}>⚔ Theonyx Café Arcade ⚔</div>
      </div>

      {/* Fire line */}
      <div style={{height:3,background:'linear-gradient(90deg,transparent 0%,#ff4400 20%,#ffcc00 50%,#ff4400 80%,transparent 100%)',boxShadow:'0 0 10px rgba(255,140,0,0.7)',position:'relative',zIndex:2}}/>

      {/* Auth bar */}
      <div style={{position:'relative',zIndex:2,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 16px',background:'linear-gradient(90deg,#1a0800,#2a1000,#1a0800)',borderBottom:'1px solid #3d1500'}}>
        {username ? (
          <>
            <span style={{color:'#8bc34a',fontSize:13}}>👤 {username}</span>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setShowLB(true)} style={{background:'#1a0800',border:'2px solid #d4a853',color:'#ffd700',padding:'6px 14px',borderRadius:16,fontSize:12,fontWeight:'bold',cursor:'pointer'}}>🏆 Leaderboard</button>
              <button onClick={handleLogout} style={{background:'transparent',border:'1px solid #6b3a1f',color:'#a07850',padding:'6px 12px',borderRadius:16,fontSize:12,cursor:'pointer'}}>Logout</button>
            </div>
          </>
        ) : (
          <>
            <span style={{color:'#c8a070',fontSize:12}}>Sign in to save scores globally</span>
            <button onClick={()=>setShowAuth(true)} style={{background:'linear-gradient(180deg,#1a0800,#2c1000)',border:'2px solid #d4a853',color:'#ffd700',padding:'7px 16px',borderRadius:20,fontSize:12,fontWeight:'bold',cursor:'pointer',textShadow:'0 0 8px rgba(255,200,0,0.8)',boxShadow:'0 0 12px rgba(212,168,83,0.4)'}}>Sign In / Register</button>
          </>
        )}
      </div>

      {/* Floating embers */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,overflow:'hidden'}}>
        {Array.from({length:20}).map((_,i)=>(
          <div key={i} style={{position:'absolute',borderRadius:'50%',width:`${2+Math.random()*4}px`,height:`${2+Math.random()*4}px`,left:`${(i*17)%100}%`,background:['#ff8800','#ffcc00','#ff4400','#ffd700','#ff6600'][i%5],boxShadow:'0 0 6px #ff8800',animation:`floatUp ${3+i*0.4}s linear ${i*0.3}s infinite`,opacity:0}}/>
        ))}
      </div>

      {/* Game grid */}
      <div style={S.grid}>
        {GAME_LIST.map(game => (
          <div key={game.id} style={S.card}
            onClick={()=>handleGameSelect(game)}
            onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.04) translateY(-2px)';e.currentTarget.style.boxShadow='0 0 20px rgba(255,140,0,0.4)';e.currentTarget.style.borderColor='#d4a853';}}
            onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.boxShadow='none';e.currentTarget.style.borderColor='#6b3a00';}}>
            <div style={{position:'absolute',top:6,left:6,width:14,height:14,borderTop:'1.5px solid rgba(255,160,0,0.6)',borderLeft:'1.5px solid rgba(255,160,0,0.6)'}}/>
            <div style={{position:'absolute',bottom:6,right:6,width:14,height:14,borderBottom:'1.5px solid rgba(255,160,0,0.6)',borderRight:'1.5px solid rgba(255,160,0,0.6)'}}/>
            <div style={{position:'absolute',top:-1,left:'20%',right:'20%',height:2,borderRadius:2,background:'rgba(255,200,0,0.7)',boxShadow:'0 0 8px rgba(255,160,0,0.8)'}}/>
            <div style={S.cardTitle}>{game.title}</div>
            <div style={S.cardSub}>{game.sub}</div>
            {localBests[game.id]>0 && <div style={S.cardBest}>Best: {localBests[game.id]}</div>}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes logoGlow {
          from { filter: drop-shadow(0 0 6px #ff8800) drop-shadow(0 0 14px #ff4400); }
          to   { filter: drop-shadow(0 0 14px #ffcc00) drop-shadow(0 0 28px #ff8800); }
        }
        @keyframes floatUp {
          0%   { transform:translateY(100vh) scale(0); opacity:0; }
          10%  { opacity:0.8; }
          90%  { opacity:0.4; }
          100% { transform:translateY(-40px) scale(1.5); opacity:0; }
        }
      `}</style>
    </div>
  );
}
