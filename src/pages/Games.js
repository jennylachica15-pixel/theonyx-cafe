import React, { useState, useEffect, useRef, useCallback } from 'react';
import CafeGame from './CafeGame';
import { db } from '../firebase/config';
import {
  collection, doc, setDoc, getDoc, getDocs,
  query, orderBy, limit, where, serverTimestamp
} from 'firebase/firestore';
import ZombieGame from './ZombieGame';

// - THEME -
const S = {
  wrap: { minHeight: '100vh', background: '#0a0400', color: '#f5e6d0', fontFamily: "'Georgia', serif", position:'relative', overflow:'hidden' },
  header: { position:'relative', zIndex:2, background: 'linear-gradient(180deg, #3d1500 0%, #1a0800 100%)', padding: '20px 16px 14px', textAlign: 'center', borderBottom: '2px solid #8b4a00', overflow:'hidden' },
  logo: { fontSize: 28, fontWeight: 'bold', letterSpacing: 3, background: 'linear-gradient(180deg, #fff8d0 0%, #ffc200 40%, #ff7700 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', animation:'logoGlow 2s ease-in-out infinite alternate' },
  sub: { fontSize: 11, color: '#c87a30', marginTop: 4, letterSpacing: 2, textTransform:'uppercase' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 16 },
  card: {
    background: 'linear-gradient(160deg, #2c1600, #1e0e00)',
    border: '1px solid #6b3a1f',
    borderTop: '3px solid #d4a85366',
    borderRadius: 16,
    padding: '22px 14px 16px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    position: 'relative',
  },
  cardTitle: { fontSize: 13, fontWeight: 'bold', letterSpacing: 1, textTransform:'uppercase', background:'linear-gradient(180deg,#fff8d0,#ffc200)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' },
  cardSub: { fontSize: 11, color: '#a07850', marginTop: 6 },
  cardBest: { fontSize: 11, color: '#8bc34a', marginTop: 8, background: 'rgba(139,195,74,0.1)', borderRadius: 8, padding: '2px 8px' },
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
  { id: 'snake',         title: 'Snake',               sub: 'Collect coffee beans',    mode: 'Single player' },
  { id: 'tetris',        title: 'Tetris',               sub: 'Classic stacking',        mode: 'Single player' },
  { id: 'racing',        title: 'Cafe Racer',           sub: 'Dodge the barriers',      mode: 'Single player' },
  { id: 'flappybarista', title: 'Flappy Barista',       sub: 'Tap to fly, avoid pipes', mode: 'Single player' },
  { id: 'zombie',        title: 'Zombie Barista',       sub: 'Survive the horde',       mode: 'Multiplayer'   },
  { id: 'guessword',     title: 'Guess the Word',       sub: 'Clues & letters',         mode: 'Single player' },
  { id: 'cafemystery',   title: 'Cafe Mystery',         sub: 'Who is the impostor?',    mode: 'Multiplayer'   },
  { id: 'fairyq',        title: 'Friends & Questions',  sub: 'Funny, deep & spicy',    mode: 'Group play'    },
];

const LEADERBOARD_GAMES = GAME_LIST.filter(g => g.id !== 'cafemystery' && g.id !== 'fairyq');

const fmtScore = (gameId, score) => {
  const n = (Number(score) || 0).toLocaleString();
  if (gameId === 'zombie') return `${n} ${Number(score) === 1 ? 'day' : 'days'}`;
  return n;
};

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

function AuthModal({ onAuth, onClose }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState(()=>{try{return localStorage.getItem('cafeGameUser')||null;}catch{return null;}});
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
        <div style={{fontSize:20,fontWeight:'bold',color:'#d4a853',marginBottom:4}}>{mode === 'login' ? 'Welcome Back!' : 'Join the Cafe'}</div>
        <div style={{fontSize:12,color:'#a07850',marginBottom:20}}>{mode === 'login' ? 'Sign in to track your scores' : 'Create a unique cafe name'}</div>
        <input style={S.input} placeholder="Username (e.g. Latte)" value={username} onChange={e=>setUsername(e.target.value)} autoCapitalize="none" />
        <input style={S.input} placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        {error && <div style={{color:'#ff6b6b',fontSize:13,marginBottom:8}}>{error}</div>}
        <button style={S.btn()} onClick={handle} disabled={loading}>{loading ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}</button>
        <button style={S.btn('#6b3a1f')} onClick={()=>{setMode(mode==='login'?'register':'login');setError('');}}>{mode === 'login' ? 'New? Create Account' : 'Already have one? Sign In'}</button>
        <button style={{background:'none',border:'none',color:'#a07850',cursor:'pointer',fontSize:13}} onClick={onClose}>Play as Guest</button>
      </div>
    </div>
  );
}

function NameModal({ gameTitle, username, onStart, onClose }) {
  const [name, setName] = useState(username || '');
  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={{fontSize:36,marginBottom:8}}>🎮</div>
        <div style={{fontSize:20,fontWeight:'bold',color:'#d4a853',marginBottom:4}}>{gameTitle}</div>
        <div style={{fontSize:13,color:'#a07850',marginBottom:16}}>Enter your player name</div>
        <input style={S.input} placeholder="Your name..." value={name} onChange={e=>setName(e.target.value)} />
        <div style={{marginBottom:16}}>{MENU_NAMES.map(n=>(<span key={n} style={S.chip} onClick={()=>setName(n)}>{n}</span>))}</div>
        <button style={S.btn()} onClick={()=>name.trim()&&onStart(name.trim())}>Start Game</button>
        <button style={S.btn('#6b3a1f')} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

function LeaderboardModal({ onClose, username }) {
  const [tab, setTab] = useState(LEADERBOARD_GAMES[0].id);
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
          {LEADERBOARD_GAMES.map(g=>(<button key={g.id} onClick={()=>setTab(g.id)} style={{background: tab===g.id ? '#d4a853':'#3d1f00', color: tab===g.id ? '#1a0a00':'#d4a853', border:'1px solid #6b3a1f', borderRadius:20, padding:'6px 12px', fontSize:12, cursor:'pointer'}}>{g.title}</button>))}
        </div>
        {loading ? <div style={{color:'#a07850'}}>Loading...</div> : rows.length === 0 ?
          <div style={{color:'#a07850',padding:20}}>No scores yet - be the first!</div> :
          rows.map((r,i)=>(<div key={i} style={{...S.lbRow(i), background: r.username===username ? 'rgba(212,168,83,0.15)' : S.lbRow(i).background}}><span style={{width:28,fontSize:18}}>{S.medal(i)}</span><span style={{flex:1,fontWeight:'bold',color: r.username===username ? '#d4a853':'#f5e6d0'}}>{r.username}</span><span style={{color:'#8bc34a',fontWeight:'bold'}}>{fmtScore(tab, r.score)}</span>{r.username===username && <span style={{marginLeft:6,fontSize:11,color:'#d4a853'}}>YOU</span>}</div>))
        }
        <button style={{...S.btn('#6b3a1f'),marginTop:16}} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

const ORB_COLORS = ['#ff4444','#ff8800','#44ff88','#4488ff','#ff44ff','#ffff44','#44ffff','#ff6644','#ff2288','#00ffcc'];

function SnakeGame({ playerName, onScore }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const stateRef = useRef(null);
  const [score, setScore] = useState(0);
  const [alive, setAlive] = useState(true);

  const W = 340, H = 580;
  const CELL = 12;
  const COLS = Math.floor(W / CELL);
  const ROWS = Math.floor(H / CELL);

  const jsRef = useRef({ cx:70, cy:H-75, r:50, kR:19, kx:0, ky:0, on:false, md:28 });

  const beansRef = useRef([]);
  const spawnBean = () => ({
    x: 20 + Math.random()*(W-40),
    y: 20 + Math.random()*(H-120),
    phase: Math.random()*Math.PI*2,
    size: 3 + Math.random()*2,
    id: Math.random()
  });
  if (beansRef.current.length === 0) {
    for (let i=0; i<8; i++) beansRef.current.push(spawnBean());
  }

  const placeFood = (snake) => {
    let pos;
    do { pos = { x:1+Math.floor(Math.random()*(COLS-2)), y:1+Math.floor(Math.random()*(ROWS-2)) }; }
    while (snake.some(s => s.x===pos.x && s.y===pos.y));
    return pos;
  };

  const startGame = useCallback(() => {
    const cx = Math.floor(COLS/2), cy = Math.floor(ROWS/2);
    stateRef.current = {
      snake: [{x:cx,y:cy},{x:cx-1,y:cy},{x:cx-2,y:cy},{x:cx-3,y:cy}],
      dir: {x:1,y:0}, nextDir: {x:1,y:0},
      food: {x:cx+5, y:cy},
      score: 0, frame: 0, running: true
    };
    beansRef.current = [];
    for (let i=0; i<8; i++) beansRef.current.push(spawnBean());
    setScore(0); setAlive(true);
  }, [COLS, ROWS]);

  useEffect(() => { startGame(); }, [startGame]);

  const turn = useCallback((dx, dy) => {
    const g = stateRef.current; if (!g) return;
    if (dx !== -g.dir.x || dy !== -g.dir.y) g.nextDir = {x:dx, y:dy};
  }, []);

  const handleJsMove = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = W/rect.width, sy = H/rect.height;
    const mx = (clientX-rect.left)*sx, my = (clientY-rect.top)*sy;
    const js = jsRef.current;
    let dx = mx-js.cx, dy = my-js.cy;
    const dist = Math.sqrt(dx*dx+dy*dy);
    if (dist > js.md) { dx=dx/dist*js.md; dy=dy/dist*js.md; }
    js.kx=dx; js.ky=dy;
    const angle = Math.atan2(dy,dx)*180/Math.PI;
    if (Math.abs(dx)>6||Math.abs(dy)>6) {
      if (angle>-45&&angle<=45&&stateRef.current?.dir.x!==-1) turn(1,0);
      else if (angle>45&&angle<=135&&stateRef.current?.dir.y!==-1) turn(0,1);
      else if ((angle>135||angle<=-135)&&stateRef.current?.dir.x!==1) turn(-1,0);
      else if (angle>-135&&angle<=-45&&stateRef.current?.dir.y!==1) turn(0,-1);
    }
  }, [turn]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const js = jsRef.current;
    const onJS = (mx,my) => Math.hypot(mx-js.cx,my-js.cy) < js.r*1.4;
    const gp = (cx,cy) => { const r=canvas.getBoundingClientRect(); return [(cx-r.left)*(W/r.width),(cy-r.top)*(H/r.height)]; };
    const onTouchStart = e => { const [mx,my]=gp(e.touches[0].clientX,e.touches[0].clientY); if(onJS(mx,my)){js.on=true;e.preventDefault();} };
    const onTouchMove = e => { if(js.on){handleJsMove(e.touches[0].clientX,e.touches[0].clientY);e.preventDefault();} };
    const onTouchEnd = () => { js.on=false; js.kx=0; js.ky=0; };
    const onMouseDown = e => { const [mx,my]=gp(e.clientX,e.clientY); if(onJS(mx,my)) js.on=true; };
    const onMouseMove = e => { if(js.on) handleJsMove(e.clientX,e.clientY); };
    const onMouseUp = () => { js.on=false; js.kx=0; js.ky=0; };
    canvas.addEventListener('touchstart',onTouchStart,{passive:false});
    canvas.addEventListener('touchmove',onTouchMove,{passive:false});
    canvas.addEventListener('touchend',onTouchEnd);
    canvas.addEventListener('mousedown',onMouseDown);
    window.addEventListener('mousemove',onMouseMove);
    window.addEventListener('mouseup',onMouseUp);
    return () => {
      canvas.removeEventListener('touchstart',onTouchStart);
      canvas.removeEventListener('touchmove',onTouchMove);
      canvas.removeEventListener('touchend',onTouchEnd);
      canvas.removeEventListener('mousedown',onMouseDown);
      window.removeEventListener('mousemove',onMouseMove);
      window.removeEventListener('mouseup',onMouseUp);
    };
  }, [handleJsMove]);

  useEffect(() => {
    const k = e => {
      const m = {ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
      if (m[e.key]) { e.preventDefault(); turn(...m[e.key]); }
    };
    window.addEventListener('keydown',k);
    return () => window.removeEventListener('keydown',k);
  }, [turn]);

  useEffect(() => {
    if (!alive) return;
    const interval = setInterval(() => {
      const g = stateRef.current; if (!g||!g.running) return;
      g.dir = {...g.nextDir};
      const head = {x:g.snake[0].x+g.dir.x, y:g.snake[0].y+g.dir.y};
      if (head.x<0||head.x>=COLS||head.y<0||head.y>=ROWS||g.snake.some(s=>s.x===head.x&&s.y===head.y)) {
        g.running=false; onScore(g.score); setAlive(false); return;
      }
      g.snake.unshift(head);
      if (head.x===g.food.x&&head.y===g.food.y) {
        g.score+=10; setScore(g.score); g.food=placeFood(g.snake);
      } else g.snake.pop();
    }, Math.max(110, 250 - Math.floor((stateRef.current?.score||0)/40)*15));
    return () => clearInterval(interval);
  }, [alive, COLS, ROWS, onScore]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let rafId, fn=0;

    const bgC = document.createElement('canvas');
    bgC.width=W; bgC.height=H;
    const bc = bgC.getContext('2d');
    bc.fillStyle='#111418'; bc.fillRect(0,0,W,H);
    const hs=24, hh=hs*Math.sqrt(3);
    bc.strokeStyle='#1a2028'; bc.lineWidth=1;
    for(let row=-1;row<H/hh+2;row++){
      for(let col=-1;col<W/(hs*1.5)+2;col++){
        const hcx=col*hs*1.5, hcy=row*hh+(col%2)*hh/2;
        bc.fillStyle='#131820';
        bc.beginPath();
        for(let a=0;a<6;a++){const ang=Math.PI/180*(60*a);bc.lineTo(hcx+hs*0.96*Math.cos(ang),hcy+hs*0.96*Math.sin(ang));}
        bc.closePath(); bc.fill(); bc.stroke();
      }
    }

    const drawBean = (x,y,size,alpha,glow) => {
      ctx.save(); ctx.globalAlpha=alpha||1;
      ctx.shadowColor='#c8943a'; ctx.shadowBlur=glow?18:5;
      const g=ctx.createRadialGradient(x-size*.25,y-size*.25,0,x,y,size);
      g.addColorStop(0,'#e8b84b'); g.addColorStop(.45,'#a06828'); g.addColorStop(1,'#3a1a00');
      ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(x,y,size,size*.78,.4,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0; ctx.strokeStyle='rgba(0,0,0,.5)'; ctx.lineWidth=size*.2; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(x-size*.32,y-size*.25); ctx.bezierCurveTo(x+size*.08,y,x-size*.08,y,x+size*.32,y+size*.25); ctx.stroke();
      ctx.restore();
    };

    const drawJS = () => {
      const js=jsRef.current;
      ctx.save(); ctx.globalAlpha=js.on?.8:.45;
      ctx.fillStyle='rgba(30,15,0,.88)'; ctx.shadowColor='rgba(0,0,0,.5)'; ctx.shadowBlur=10;
      ctx.beginPath(); ctx.arc(js.cx,js.cy,js.r,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
      ctx.strokeStyle=`rgba(212,168,83,${js.on?.6:.28})`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(js.cx,js.cy,js.r,0,Math.PI*2); ctx.stroke();
      [[0,-1],[0,1],[-1,0],[1,0]].forEach(([dx,dy])=>{
        const ax=js.cx+dx*(js.r-11),ay=js.cy+dy*(js.r-11);
        ctx.fillStyle='rgba(212,168,83,.15)';
        ctx.save(); ctx.translate(ax,ay); ctx.rotate(Math.atan2(dy,dx));
        ctx.beginPath(); ctx.moveTo(5,0); ctx.lineTo(-4,-4); ctx.lineTo(-4,4); ctx.closePath(); ctx.fill(); ctx.restore();
      });
      const kpx=js.cx+js.kx, kpy=js.cy+js.ky;
      const kg=ctx.createRadialGradient(kpx-js.kR*.25,kpy-js.kR*.3,0,kpx,kpy,js.kR);
      kg.addColorStop(0,'#e8c060'); kg.addColorStop(.45,'#c8943a'); kg.addColorStop(1,'#4a2800');
      ctx.fillStyle=kg; ctx.shadowColor='rgba(0,0,0,.6)'; ctx.shadowBlur=7;
      ctx.beginPath(); ctx.arc(kpx,kpy,js.kR,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
      ctx.strokeStyle=`rgba(255,200,80,${js.on?.6:.35})`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(kpx,kpy,js.kR,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1; ctx.restore();
    };

    const draw = () => {
      fn++;
      const g = stateRef.current;
      const beans = beansRef.current;
      ctx.drawImage(bgC,0,0);

      for (let i=beans.length-1; i>=0; i--) {
        const b=beans[i];
        if (g && g.snake.length>0) {
          const hx=g.snake[0].x*CELL+CELL/2, hy=g.snake[0].y*CELL+CELL/2;
          if (Math.hypot(b.x-hx,b.y-hy)<CELL*.9) {
            g.score+=5; setScore(g.score);
            beans.splice(i,1);
            setTimeout(()=>beans.push(spawnBean()),700);
            continue;
          }
        }
        const p=.78+.18*Math.sin(fn*.05+b.phase);
        drawBean(b.x,b.y,b.size*p,.85);
      }

      if (g) {
        const fp=.88+.12*Math.sin(fn*.1);
        drawBean(g.food.x*CELL+CELL/2,g.food.y*CELL+CELL/2,8*fp,1,true);

        if (g.snake.length>1) {
          ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
          for (let i=g.snake.length-1;i>0;i--) {
            const s=g.snake[i],s2=g.snake[i-1],tt=i/g.snake.length;
            const tk=Math.max(2,(CELL*.32-tt*CELL*.08)*2);
            ctx.strokeStyle='rgba(0,0,0,.4)'; ctx.lineWidth=tk+2.5;
            ctx.beginPath(); ctx.moveTo(s.x*CELL+CELL/2,s.y*CELL+CELL/2); ctx.lineTo(s2.x*CELL+CELL/2,s2.y*CELL+CELL/2); ctx.stroke();
            ctx.strokeStyle=`hsl(120,${85-tt*10}%,${44+tt*5}%)`; ctx.lineWidth=tk;
            ctx.beginPath(); ctx.moveTo(s.x*CELL+CELL/2,s.y*CELL+CELL/2); ctx.lineTo(s2.x*CELL+CELL/2,s2.y*CELL+CELL/2); ctx.stroke();
            ctx.strokeStyle=`hsla(120,90%,70%,.35)`; ctx.lineWidth=tk*.25;
            ctx.beginPath(); ctx.moveTo(s.x*CELL+CELL/2,s.y*CELL+CELL/2); ctx.lineTo(s2.x*CELL+CELL/2,s2.y*CELL+CELL/2); ctx.stroke();
          }
          ctx.restore();
        }

        const h=g.snake[0], hpx=h.x*CELL+CELL/2, hpy=h.y*CELL+CELL/2, hr=CELL*.34;
        ctx.fillStyle='rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(hpx+1,hpy+1,hr,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='hsl(120,85%,42%)'; ctx.beginPath(); ctx.arc(hpx,hpy,hr,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='hsla(120,90%,70%,.4)'; ctx.beginPath(); ctx.arc(hpx-hr*.2,hpy-hr*.22,hr*.45,0,Math.PI*2); ctx.fill();
        ctx.save(); ctx.translate(hpx,hpy); ctx.rotate(Math.atan2(g.dir.y,g.dir.x));
        [-1,1].forEach(s=>{
          ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(hr*.35,s*hr*.42,hr*.28,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(hr*.42,s*hr*.42,hr*.15,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(hr*.38,s*hr*.38,hr*.07,0,Math.PI*2); ctx.fill();
        });
        ctx.restore();
      }

      drawJS();

      ctx.fillStyle='rgba(0,0,0,.5)'; ctx.beginPath(); ctx.roundRect(8,8,120,28,8); ctx.fill();
      ctx.fillStyle='#ffd700'; ctx.font='bold 13px Arial'; ctx.textAlign='left';
      ctx.fillText('Score: '+(stateRef.current?.score||0),14,26);

      if (!alive && g && !g.running) {
        ctx.fillStyle='rgba(0,0,0,.72)'; ctx.fillRect(0,H/2-44,W,88);
        ctx.fillStyle='#ff4444'; ctx.font='bold 22px Arial'; ctx.textAlign='center';
        ctx.shadowColor='#ff0000'; ctx.shadowBlur=20;
        ctx.fillText('GAME OVER',W/2,H/2-10); ctx.shadowBlur=0;
        ctx.fillStyle='#ffd700'; ctx.font='14px Arial';
        ctx.fillText('Score: '+(g.score||0),W/2,H/2+18);
      }
      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [alive, W, H, CELL, playerName]);

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,alignItems:'center',background:'#111418'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 14px',background:'#0d1117',borderBottom:'1px solid #1e2530',width:'100%',boxSizing:'border-box',flexShrink:0}}>
        <span style={{fontSize:13,color:'#ffd700',fontWeight:'bold'}}>Score: {score}</span>
        <span style={{fontSize:11,color:'#888'}}>{playerName}</span>
        <button style={{background:'rgba(212,168,83,0.15)',border:'1px solid #d4a85366',borderRadius:8,color:'#ffd700',fontSize:12,padding:'5px 12px',cursor:'pointer'}} onClick={startGame}>Restart</button>
      </div>
      <canvas ref={canvasRef} width={W} height={H} style={{display:'block',maxWidth:'100%'}}/>
    </div>
  );
}


function TetrisGame({ playerName, onScore }) {
  const canvasRef=useRef(null),nextCanvRef=useRef(null),containerRef=useRef(null),stateRef=useRef(null),rafRef=useRef(null),cellRef=useRef(24);
  const COLS=10,ROWS=20;
  const [score,setScore]=useState(0),[level,setLevel]=useState(1),[lines,setLines]=useState(0),[gameOver,setGameOver]=useState(false),[started,setStarted]=useState(false);
  const PIECES=[{shape:[[1,1,1,1]],color:'#00e5ff',glow:'#00e5ff'},{shape:[[1,1],[1,1]],color:'#ffd600',glow:'#ffd600'},{shape:[[1,1,1],[0,1,0]],color:'#d500f9',glow:'#d500f9'},{shape:[[1,1,1],[1,0,0]],color:'#ff6d00',glow:'#ff6d00'},{shape:[[1,1,1],[0,0,1]],color:'#2979ff',glow:'#2979ff'},{shape:[[1,1,0],[0,1,1]],color:'#ff1744',glow:'#ff1744'},{shape:[[0,1,1],[1,1,0]],color:'#00e676',glow:'#00e676'}];
  const rng=()=>PIECES[Math.floor(Math.random()*PIECES.length)];
  const newPiece=()=>{const p=rng();return{...p,x:Math.floor(COLS/2)-Math.floor(p.shape[0].length/2),y:0};};
  const rotate=s=>s[0].map((_,i)=>s.map(r=>r[i]).reverse());
  const collides=(board,piece,ox=0,oy=0)=>piece.shape.some((row,y)=>row.some((v,x)=>v&&(piece.x+x+ox<0||piece.x+x+ox>=COLS||piece.y+y+oy>=ROWS||board[piece.y+y+oy]?.[piece.x+x+ox])));
  const merge=(board,piece)=>{const b=board.map(r=>[...r]);piece.shape.forEach((row,y)=>row.forEach((v,x)=>{if(v)b[piece.y+y][piece.x+x]=piece.color;}));return b;};
  const clearLines=(board)=>{const b=board.filter(r=>r.some(v=>!v));const n=ROWS-b.length;return{board:[...Array.from({length:n},()=>Array(COLS).fill(0)),...b],cleared:n};};
  const initState=()=>({board:Array.from({length:ROWS},()=>Array(COLS).fill(0)),piece:newPiece(),next:newPiece(),score:0,lines:0,level:1,lastTime:0,speed:600});
  const calcCell=useCallback(()=>{const c=containerRef.current;if(!c)return 24;const bw=Math.floor(c.clientWidth*0.62),bh=c.clientHeight-110,byW=Math.floor(bw/COLS),byH=Math.floor(bh/ROWS);return Math.max(10,Math.min(byW,byH,30));},[]);
  const drawBlock=(ctx,x,y,color,cell,alpha=1)=>{ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(x*cell+1,y*cell+1,cell-2,cell-2);ctx.fillStyle='rgba(255,255,255,0.3)';ctx.fillRect(x*cell+1,y*cell+1,cell-2,Math.max(2,cell*0.18));ctx.fillRect(x*cell+1,y*cell+1,Math.max(2,cell*0.18),cell-2);ctx.fillStyle='rgba(0,0,0,0.35)';ctx.fillRect(x*cell+1,y*cell+cell-Math.max(2,cell*0.18)-1,cell-2,Math.max(2,cell*0.18));ctx.globalAlpha=1;};
  const drawBoard=useCallback(()=>{const canvas=canvasRef.current;if(!canvas)return;const st=stateRef.current;if(!st)return;const CELL=cellRef.current,ctx=canvas.getContext('2d'),W=COLS*CELL,H=ROWS*CELL;ctx.fillStyle='#080c14';ctx.fillRect(0,0,W,H);for(let x=0;x<=COLS;x++){ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x*CELL,0);ctx.lineTo(x*CELL,H);ctx.stroke();}for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(0,y*CELL);ctx.lineTo(W,y*CELL);ctx.stroke();}ctx.strokeStyle=st.piece?.glow||'#00e5ff';ctx.lineWidth=2;ctx.strokeRect(0,0,W,H);let gy=st.piece.y;while(!collides(st.board,{...st.piece,y:gy+1}))gy++;st.piece.shape.forEach((row,y)=>row.forEach((v,x)=>{if(v)drawBlock(ctx,st.piece.x+x,gy+y,st.piece.color,CELL,0.15);}));st.board.forEach((row,y)=>row.forEach((v,x)=>{if(v)drawBlock(ctx,x,y,v,CELL);}));ctx.shadowColor=st.piece.glow;ctx.shadowBlur=CELL*0.8;st.piece.shape.forEach((row,y)=>row.forEach((v,x)=>{if(v)drawBlock(ctx,st.piece.x+x,st.piece.y+y,st.piece.color,CELL);}));ctx.shadowBlur=0;},[]);
  const drawNext=useCallback(()=>{const canvas=nextCanvRef.current;if(!canvas)return;const st=stateRef.current;if(!st)return;const NC=16,W=4*NC,H=4*NC;canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');ctx.fillStyle='#080c14';ctx.fillRect(0,0,W,H);const p=st.next,ox=Math.floor((4-p.shape[0].length)/2),oy=Math.floor((4-p.shape.length)/2);ctx.shadowColor=p.glow;ctx.shadowBlur=NC*0.8;p.shape.forEach((row,y)=>row.forEach((v,x)=>{if(v)drawBlock(ctx,ox+x,oy+y,p.color,NC);}));ctx.shadowBlur=0;},[]);
  const gameLoop=useCallback((ts)=>{const st=stateRef.current;if(!st)return;if(ts-st.lastTime>st.speed){st.lastTime=ts;if(!collides(st.board,st.piece,0,1)){st.piece.y++;}else{const nb=merge(st.board,st.piece);const{board,cleared}=clearLines(nb);st.board=board;const pts=[0,100,300,500,800][cleared]||0;st.score+=pts*(st.level||1);st.lines+=cleared;st.level=Math.floor(st.lines/10)+1;st.speed=Math.max(60,600-st.level*50);setScore(st.score);setLines(st.lines);setLevel(st.level);st.piece=st.next;st.next=newPiece();if(collides(st.board,st.piece)){setGameOver(true);onScore(st.score);return;}}}drawBoard();drawNext();rafRef.current=requestAnimationFrame(gameLoop);},[drawBoard,drawNext,onScore]);
  const startGame=()=>{const cell=calcCell();cellRef.current=cell;const canvas=canvasRef.current;if(canvas){canvas.width=COLS*cell;canvas.height=ROWS*cell;}stateRef.current=initState();setScore(0);setLines(0);setLevel(1);setGameOver(false);setStarted(true);rafRef.current=requestAnimationFrame(gameLoop);};
  useEffect(()=>{const ro=new ResizeObserver(()=>{const cell=calcCell();cellRef.current=cell;const canvas=canvasRef.current;if(canvas){canvas.width=COLS*cell;canvas.height=ROWS*cell;}});if(containerRef.current)ro.observe(containerRef.current);return()=>{ro.disconnect();if(rafRef.current)cancelAnimationFrame(rafRef.current);};},[calcCell]);
  const move=(dx)=>{const st=stateRef.current;if(!st)return;if(!collides(st.board,st.piece,dx,0))st.piece.x+=dx;};
  const drop=()=>{const st=stateRef.current;if(!st)return;while(!collides(st.board,st.piece,0,1))st.piece.y++;};
  const rot=()=>{const st=stateRef.current;if(!st)return;const r=rotate(st.piece.shape);const old=st.piece.shape;st.piece.shape=r;if(collides(st.board,st.piece))st.piece.shape=old;};
  useEffect(()=>{if(!started)return;const k=(e)=>{if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}if(e.key==='ArrowRight'){e.preventDefault();move(1);}if(e.key==='ArrowDown'){e.preventDefault();drop();}if(e.key==='ArrowUp'){e.preventDefault();rot();}};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[started]);
  const ctrlBtn={background:'#1a1a2e',border:'2px solid #3a3a5e',color:'#fff',borderRadius:12,padding:'14px 0',fontSize:22,cursor:'pointer',userSelect:'none',WebkitUserSelect:'none',flex:1,boxShadow:'0 4px 0 rgba(0,0,0,0.4)',fontWeight:'bold'};
  return(
    <div ref={containerRef} style={{display:'flex',flexDirection:'column',height:'100%',background:'#050810',overflow:'hidden',fontFamily:"'Arial Black',Arial,sans-serif"}}>
      <div style={{flex:1,display:'flex',gap:0,overflow:'hidden',minHeight:0}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',flex:'0 0 auto',padding:'8px 4px 4px 8px'}}><canvas ref={canvasRef} style={{display:'block',imageRendering:'pixelated'}}/></div>
        <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'flex-start',padding:'10px 8px 4px 4px',gap:10,minWidth:0}}>
          <div style={{background:'#0d1120',border:'1px solid #1e2a4a',borderRadius:10,padding:'6px 8px'}}><div style={{fontSize:9,color:'#4a6a9a',textTransform:'uppercase',letterSpacing:1}}>Player</div><div style={{fontSize:12,color:'#e0e8ff',fontWeight:'bold',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{playerName}</div></div>
          <div style={{background:'#0d1120',border:'1px solid #1e2a4a',borderRadius:10,padding:'6px 8px'}}><div style={{fontSize:9,color:'#4a6a9a',textTransform:'uppercase',letterSpacing:1}}>Score</div><div style={{fontSize:18,color:'#ffd600',fontWeight:900,textShadow:'0 0 8px #ffd600'}}>{score.toLocaleString()}</div></div>
          <div style={{display:'flex',gap:6}}>
            <div style={{flex:1,background:'#0d1120',border:'1px solid #1e2a4a',borderRadius:10,padding:'6px 8px'}}><div style={{fontSize:9,color:'#4a6a9a',textTransform:'uppercase',letterSpacing:1}}>Lv</div><div style={{fontSize:16,color:'#00e5ff',fontWeight:900,textShadow:'0 0 8px #00e5ff'}}>{level}</div></div>
            <div style={{flex:1,background:'#0d1120',border:'1px solid #1e2a4a',borderRadius:10,padding:'6px 8px'}}><div style={{fontSize:9,color:'#4a6a9a',textTransform:'uppercase',letterSpacing:1}}>Lines</div><div style={{fontSize:16,color:'#00e676',fontWeight:900,textShadow:'0 0 8px #00e676'}}>{lines}</div></div>
          </div>
          <div style={{background:'#0d1120',border:'1px solid #1e2a4a',borderRadius:10,padding:'6px 8px'}}><div style={{fontSize:9,color:'#4a6a9a',textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Next</div><canvas ref={nextCanvRef} width={64} height={64} style={{display:'block',imageRendering:'pixelated',margin:'0 auto'}}/></div>
        </div>
      </div>
      {gameOver&&(<div style={{position:'absolute',inset:0,background:'rgba(5,8,16,0.92)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:20}}><div style={{fontSize:28,fontWeight:900,color:'#ff1744',textShadow:'0 0 20px #ff1744',marginBottom:4}}>GAME OVER</div><div style={{fontSize:18,color:'#ffd600',marginBottom:20,textShadow:'0 0 10px #ffd600'}}>{score.toLocaleString()} pts</div><button onClick={startGame} style={{background:'linear-gradient(180deg,#00e5ff,#0077aa)',border:'none',borderRadius:12,padding:'12px 32px',color:'#fff',fontSize:16,fontWeight:900,cursor:'pointer'}}>PLAY AGAIN</button></div>)}
      {!started&&!gameOver&&(<div style={{position:'absolute',inset:0,background:'rgba(5,8,16,0.92)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:20}}><div style={{fontSize:32,fontWeight:900,color:'#00e5ff',textShadow:'0 0 20px #00e5ff',marginBottom:8,letterSpacing:3}}>TETRIS</div><div style={{fontSize:13,color:'#4a6a9a',marginBottom:24}}>by {playerName}</div><button onClick={startGame} style={{background:'linear-gradient(180deg,#00e5ff,#0077aa)',border:'none',borderRadius:12,padding:'14px 40px',color:'#fff',fontSize:18,fontWeight:900,cursor:'pointer',letterSpacing:1}}>START</button></div>)}
      <div style={{display:'flex',gap:8,padding:'8px',background:'#08101e',borderTop:'1px solid #1e2a4a',flexShrink:0}}>
        <button style={ctrlBtn} onPointerDown={e=>{e.preventDefault();move(-1);}}>&lt;</button>
        <button style={ctrlBtn} onPointerDown={e=>{e.preventDefault();rot();}}>Rot</button>
        <button style={ctrlBtn} onPointerDown={e=>{e.preventDefault();drop();}}>Drop</button>
        <button style={ctrlBtn} onPointerDown={e=>{e.preventDefault();move(1);}}>&gt;</button>
      </div>
    </div>
  );
}

function RacingGame({ playerName, onScore }) {
  const canvasRef=useRef(null),containerRef=useRef(null),stateRef=useRef(null),rafRef=useRef(null);
  const [score,setScore]=useState(0),[gameOver,setGameOver]=useState(false),[started,setStarted]=useState(false),[collected,setCollected]=useState(0),[canvasSize,setCanvasSize]=useState({w:320,h:480});
  useEffect(()=>{const update=()=>{if(!containerRef.current)return;const w=Math.min(containerRef.current.clientWidth,380),h=Math.min(containerRef.current.clientHeight-80,560);setCanvasSize({w,h});};update();window.addEventListener('resize',update);return()=>window.removeEventListener('resize',update);},[]);
  const{w:W,h:H}=canvasSize,GRASS_W=Math.round(W*0.09),ROAD_X=GRASS_W,ROAD_W=W-GRASS_W*2,LANES=4,LANE_W=ROAD_W/LANES;
  const laneX=(l)=>ROAD_X+l*LANE_W+LANE_W/2;
  const CAR_COLORS=['#ff3333','#3399ff','#ffcc00','#44cc44','#cc44ff','#ff8800','#00cccc','#ff66aa'];
  const drawCar=(ctx,x,y,color,isPlayer=false)=>{const w=Math.round(W*0.07),h=Math.round(H*0.075);ctx.fillStyle='rgba(0,0,0,0.3)';ctx.beginPath();ctx.ellipse(x,y+h*0.4,w*0.45,h*0.12,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x-w/2,y-h/2,w,h,5);ctx.fill();ctx.fillStyle='rgba(200,240,255,0.85)';ctx.beginPath();ctx.roundRect(x-w*0.35,y-h*0.38,w*0.7,h*0.22,3);ctx.fill();ctx.fillStyle='rgba(200,240,255,0.7)';ctx.beginPath();ctx.roundRect(x-w*0.32,y+h*0.12,w*0.64,h*0.18,3);ctx.fill();ctx.fillStyle='#222';[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sy])=>{ctx.beginPath();ctx.roundRect(x+sx*(w*0.42)-4,y+sy*(h*0.3)-5,8,10,2);ctx.fill();ctx.fillStyle='#555';ctx.beginPath();ctx.roundRect(x+sx*(w*0.42)-2.5,y+sy*(h*0.3)-3.5,5,7,1);ctx.fill();ctx.fillStyle='#222';});if(isPlayer){ctx.fillStyle='#ffffaa';ctx.beginPath();ctx.ellipse(x-w*0.28,y-h*0.46,3,2,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(x+w*0.28,y-h*0.46,3,2,0,0,Math.PI*2);ctx.fill();}};
  const initState=()=>({car:{lane:1,x:laneX(1),y:H-Math.round(H*0.15)},traffic:[],coffees:[],score:0,speed:1.5,lastTime:0,spawnTimer:0,coffeeTimer:0,lineOffset:0,targetX:laneX(1)});
  const drawGame=useCallback(()=>{const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext('2d');const st=stateRef.current;ctx.fillStyle='#2d7a2d';ctx.fillRect(0,0,W,H);ctx.fillStyle='#267026';for(let i=0;i<H;i+=12){ctx.fillRect(0,i,GRASS_W,6);ctx.fillRect(W-GRASS_W,i,GRASS_W,6);}ctx.fillStyle='#1a5c1a';ctx.fillRect(GRASS_W-4,0,4,H);ctx.fillRect(W-GRASS_W,0,4,H);ctx.fillStyle='#404040';ctx.fillRect(ROAD_X,0,ROAD_W,H);ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.setLineDash([25,18]);ctx.lineDashOffset=-st.lineOffset;for(let l=1;l<LANES;l++){ctx.strokeStyle=l===LANES/2?'#ffff00':'#ffffff';ctx.lineWidth=l===LANES/2?3:1.5;ctx.beginPath();ctx.moveTo(ROAD_X+l*LANE_W,0);ctx.lineTo(ROAD_X+l*LANE_W,H);ctx.stroke();}ctx.setLineDash([]);ctx.strokeStyle='#ffffff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(ROAD_X,0);ctx.lineTo(ROAD_X,H);ctx.stroke();ctx.beginPath();ctx.moveTo(ROAD_X+ROAD_W,0);ctx.lineTo(ROAD_X+ROAD_W,H);ctx.stroke();st.traffic.forEach(t=>drawCar(ctx,t.x,t.y,t.color));(st.coffees||[]).forEach(c=>{const pulse=0.8+0.2*Math.sin(Date.now()/300+c.id);ctx.save();ctx.shadowColor='#ffcc00';ctx.shadowBlur=10*pulse;ctx.font='18px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('☕',c.x,c.y);ctx.restore();ctx.strokeStyle=`rgba(255,200,0,${0.4*pulse})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(c.x,c.y,14*pulse,0,Math.PI*2);ctx.stroke();});st.car.x+=(st.targetX-st.car.x)*0.18;drawCar(ctx,st.car.x,st.car.y,'#ff3333',true);ctx.fillStyle='rgba(0,0,0,0.45)';ctx.fillRect(ROAD_X,0,70,36);ctx.fillStyle='#ffff00';ctx.font='bold 13px Arial';ctx.textAlign='left';ctx.fillText(`${Math.floor(80+st.speed*20)}km/h`,ROAD_X+6,22);},[W,H,GRASS_W,ROAD_X,ROAD_W,LANES,LANE_W]);
  const gameLoop=useCallback((ts)=>{const st=stateRef.current;if(!st)return;const dt=Math.min(ts-st.lastTime,50);st.lastTime=ts;st.lineOffset=(st.lineOffset+st.speed*1.5)%(43);st.score+=1;st.speed=1.5+st.score/900;setScore(st.score);st.spawnTimer+=dt;const interval=Math.max(350,1100-st.score*0.25);if(st.spawnTimer>interval){st.spawnTimer=0;const lane=Math.floor(Math.random()*LANES);st.traffic.push({x:laneX(lane),y:-40,lane,color:CAR_COLORS[Math.floor(Math.random()*CAR_COLORS.length)]});}st.coffeeTimer=(st.coffeeTimer||0)+dt;if(st.coffeeTimer>2200){st.coffeeTimer=0;const lane=Math.floor(Math.random()*LANES);st.coffees=[...(st.coffees||[]),{x:laneX(lane),y:-30,id:Math.random()}];}st.traffic=st.traffic.map(t=>({...t,y:t.y+st.speed*2.2})).filter(t=>t.y<H+60);const c=st.car;st.coffees=(st.coffees||[]).map(cf=>({...cf,y:cf.y+st.speed*2.2})).filter(cf=>{if(cf.y>H+40)return false;if(Math.abs(cf.x-c.x)<22&&Math.abs(cf.y-c.y)<22){st.score+=50;setScore(st.score);setCollected(n=>n+1);return false;}return true;});const cw=Math.round(W*0.07),ch=Math.round(H*0.075);const hit=st.traffic.some(t=>Math.abs(t.x-c.x)<cw*0.9&&Math.abs(t.y-c.y)<ch*0.9);if(hit){setGameOver(true);onScore(st.score);return;}drawGame();rafRef.current=requestAnimationFrame(gameLoop);},[drawGame,onScore,H,W,LANES,laneX]);
  const startGame=()=>{stateRef.current=initState();setScore(0);setCollected(0);setGameOver(false);setStarted(true);rafRef.current=requestAnimationFrame(gameLoop);};
  useEffect(()=>()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current);},[]);
  const lastMoveRef=useRef(0);
  const moveLeft=()=>{const now=Date.now();if(now-lastMoveRef.current<220)return;lastMoveRef.current=now;const st=stateRef.current;if(!st)return;const nl=Math.max(0,st.car.lane-1);st.car.lane=nl;st.targetX=laneX(nl);};
  const moveRight=()=>{const now=Date.now();if(now-lastMoveRef.current<220)return;lastMoveRef.current=now;const st=stateRef.current;if(!st)return;const nl=Math.min(LANES-1,st.car.lane+1);st.car.lane=nl;st.targetX=laneX(nl);};
  const btnStyle={background:'linear-gradient(180deg,#555,#333)',border:'2px solid #888',color:'#fff',padding:'18px 36px',borderRadius:14,fontSize:26,cursor:'pointer',userSelect:'none',WebkitUserSelect:'none',boxShadow:'0 4px 0 #111'};
  return(<div ref={containerRef} style={{display:'flex',flexDirection:'column',alignItems:'center',height:'100%',background:'#1a1a1a',overflow:'hidden'}}><div style={{color:'#d4a853',fontSize:14,fontWeight:'bold',padding:'4px 0',flexShrink:0}}>{playerName} - Score: {score} ☕x{collected}</div><canvas ref={canvasRef} width={W} height={H} style={{display:'block',flex:1,maxWidth:'100%'}}/>{!started&&!gameOver&&<button style={{width:160,background:'#d4a853',border:'none',borderRadius:10,padding:'12px',color:'#1a0a00',fontSize:15,fontWeight:'bold',cursor:'pointer',flexShrink:0}} onClick={startGame}>Start</button>}{gameOver&&(<div style={{textAlign:'center',flexShrink:0}}><div style={{color:'#ff6b6b',fontSize:20,fontWeight:'bold'}}>CRASH! 💥</div><div style={{color:'#d4a853',marginBottom:8}}>Score: {score}</div><button style={{width:160,background:'#d4a853',border:'none',borderRadius:10,padding:'12px',color:'#1a0a00',fontSize:15,fontWeight:'bold',cursor:'pointer'}} onClick={startGame}>Again</button></div>)}{started&&!gameOver&&(<div style={{display:'flex',gap:20,padding:'8px 0',flexShrink:0}}><button style={btnStyle} onPointerDown={e=>{e.preventDefault();moveLeft();}} onTouchStart={e=>{e.preventDefault();moveLeft();}}>&lt;</button><button style={btnStyle} onPointerDown={e=>{e.preventDefault();moveRight();}} onTouchStart={e=>{e.preventDefault();moveRight();}}>&gt;</button></div>)}</div>);
}

const KELLY_FACE_B64 = "data:image/jpeg;base64,/9j/4QkhaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJYTVAgQ29yZSA2LjAuMCI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiLz4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8P3hwYWNrZXQgZW5kPSJ3Ij8+AP/iAihJQ0NfUFJPRklMRQABAQAAAhhhcHBsBAAAAG1udHJSR0IgWFlaIAfmAAEAAQAAAAAAAGFjc3BBUFBMAAAAAEFQUEwAAAAAAAAAAAAAAAAAAAAAAAD21gABAAAAANMtYXBwbAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmRlc2MAAAD8AAAAMGNwcnQAAAEsAAAAUHd0cHQAAAF8AAAAFHJYWVoAAAGQAAAAFGdYWVoAAAGkAAAAFGJYWVoAAAG4AAAAFHJUUkMAAAHMAAAAIGNoYWQAAAHsAAAALGJUUkMAAAHMAAAAIGdUUkMAAAHMAAAAIG1sdWMAAAAAAAAAAQAAAAxlblVTAAAAFAAAABwARABpAHMAcABsAGEAeQAgAFAAM21sdWMAAAAAAAAAAQAAAAxlblVTAAAANAAAABwAQwBvAHAAeQByAGkA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";
const MARYZ_FACE_B64 = "data:image/jpeg;base64,/9j/4QkhaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJYTVAgQ29yZSA2LjAuMCI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiLz4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8P3hwYWNrZXQgZW5kPSJ3Ij8+AP/iAihJQ0NfUFJPRklMRQABAQAAAhhhcHBsBAAAAG1udHJSR0IgWFlaIAfmAAEAAQAAAAAAAGFjc3BBUFBMAAAAAEFQUEwAAAAAAAAAAAAAAAAAAAAAAAD21gABAAAAANMtYXBwbAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmRlc2MAAAD8AAAAMGNwcnQAAAEsAAAAUHd0cHQAAAF8AAAAFHJYWVoAAAGQAAAAFGdYWVoAAAGkAAAAFGJYWVoAAAG4AAAAFHJUUkMAAAHMAAAAIGNoYWQAAAHsAAAALGJUUkMAAAHMAAAAIGdUUkMAAAHMAAAAIG1sdWMAAAAAAAAAAQAAAAxlblVTAAAAFAAAABwARABpAHMAcABsAGEAeQAgAFAAM21sdWMAAAAAAAAAAQAAAAxlblVTAAAANAAAABwAQwBvAHAAeQByAGkA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B0X41aS8CQXDgP0Net6J4o0fWcEXAXPuKPqzOGpDlOpiKwjbW1a34UYrNjisjKoikEi+vH9K6RLS28rhRXLUoNM5WaNpeCcMT0UV574ssY9XBCjpXZWShWcL0x0rOv7dB/qwB9Kx5uU6qdZLQ8n8Ns2l6utp/nivp3R7pmshn0r541iwKL9qh+WQEcivQfCeub4VtXb5ulcdaPO7o9zBYtcp7NYPg5NbaXSpXK6cWQqrHO6r17EythXxXFPQ9KNa51SalhawpbksTUFlCW+82cVclCBcYqYyuauVjJk+Y1xt4R9rdfeusnO37vFcZOrteO3bNUTzlyGENxTms18zpVu0XC81u28cci5KionsROpoZtrZDg4rcgtBtxRsWPgCrdux2tWRxTroyrqMIOK5PVn/AHH411t63WuN1eNnhwvrRbocs6qSOIvZOK4nVH/cuPau8vLKTys15ldJIl4vnNiPPOemK1pwszglK54zfwfatS8qqHifRVstNeQD+A15d47+LFloviZ7W0wdh7e30ryzxZ8d7nWVGn2+5TjBwDXo02cvsdTyPWp2l1aVfeu2+GelJOspPv8AzrlrG3l8Q6orQRY3HnivpC18PxeHtHEioImI5xxXdDF2drHVVapx1OM8I65YSeDte0e7f94l0Qgz2C19e/8ABPLWv2ePC3iiO7+L0kazxkbFdlHb0Ir478FeCf8AiU63qc5BMryOpP8Au1+VvjPXfEuj+NruUX0i+W52c9PpX1GX4b2q0PgM4xqex/YN+2B+2f8ACLSdMuLfwcY47VYgE27ccD2Ffys/tE/tFaP411O5kWfIye9fFvi34seOdWd7O91eeaLptLcV8/azfTzFjIxOa+3w+X8qR+f16vvHbeIvE8F8sjWh4BryI3DtLuNMjdgCinik2ivVpWickrMQ/fp9N2jOadVzldiCiiioAKKKKACiiigAooooAKKKKAP/0f4B6KKKACiiigAooooAKKKKACiiigAooooAKKKKAEJA60tRuOgFPByKB20J7c7J0fH3SDXb29/i5N3Cf4gVrircAkg+lXrK9aOZYWI2jiuTF0uaJrhKtpH9M/8AwTD+OU2oeDh4XupMtABxn1NfuL4T8UrLjmv5AP2HPidd+CPibpemafKqQX8qpMG5yB6elf1J+BNRd/DiX+f37n5fTb24r8b4nwn7w/YO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";

function FlappyBarista({ playerName, onScore }) {
  const canvasRef = useRef(null);
  const stateRef  = useRef(null);
  const rafRef    = useRef(null);
  const [phase, setPhase]   = useState('idle'); // idle | playing | dead
  const [score, setScore]   = useState(0);
  const [best,  setBest]    = useState(() => { try { return parseInt(localStorage.getItem('flappyBest')||'0',10); } catch { return 0; } });

  const W = 340, H = 620;
  const GRAVITY   = 0.34;
  const FLAP_VEL  = -7.2;
  const PIPE_W    = 52;
  const PIPE_INT  = 220;
  const flapCoolRef = useRef(0);

  const initState = () => ({
    by: H / 2, bv: 0,
    pipes: [],
    tick: 0, score: 0, running: false,
  });

  useEffect(() => { stateRef.current = initState(); }, []);

  const flap = useCallback(() => {
    const now = Date.now();
    if (now - flapCoolRef.current < 180) return; // 180ms cooldown prevents double jump
    flapCoolRef.current = now;
    const st = stateRef.current;
    if (!st) return;
    if (phase === 'idle') {
      st.running = true; st.bv = FLAP_VEL;
      setPhase('playing');
    } else if (phase === 'playing') {
      st.bv = FLAP_VEL;
    } else if (phase === 'dead') {
      stateRef.current = initState();
      setScore(0); setPhase('idle');
    }
  }, [phase]);

  useEffect(() => {
    const onKey = (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); flap(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flap]);

  // Draw barista character on canvas
  const drawBarista = (ctx, x, y, angle) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(0.7, 0.7); // smaller barista
    // Body — apron shape
    ctx.fillStyle = '#1a0800';
    ctx.beginPath(); ctx.ellipse(0, 0, 18, 20, 0, 0, Math.PI * 2); ctx.fill();
    // Apron
    ctx.fillStyle = '#d4a853';
    ctx.fillRect(-9, -6, 18, 18);
    ctx.beginPath(); ctx.arc(0, -6, 9, Math.PI, 0); ctx.fill();
    // Hat
    ctx.fillStyle = '#1a0800';
    ctx.fillRect(-11, -22, 22, 8); ctx.fillRect(-7, -34, 14, 13);
    // Face
    ctx.fillStyle = '#e8b89a';
    ctx.beginPath(); ctx.arc(0, -14, 9, 0, Math.PI * 2); ctx.fill();
    // Eyes
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(-3, -15, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3, -15, 2, 0, Math.PI * 2); ctx.fill();
    // Smile
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, -11, 3, 0, Math.PI); ctx.stroke();
    // Coffee cup in hand
    ctx.fillStyle = '#fff';
    ctx.fillRect(14, -4, 12, 14);
    ctx.fillStyle = '#c8943a';
    ctx.fillRect(14, -4, 12, 4);
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(20, 0, 6, 0, Math.PI/2); ctx.stroke();
    // Steam
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
    const tick = stateRef.current?.tick || 0;
    [0,3,6].forEach((off,i) => {
      ctx.beginPath();
      ctx.moveTo(15+i*4, -5);
      ctx.bezierCurveTo(13+i*4, -10+Math.sin((tick+off)*0.2)*2, 17+i*4, -14+Math.sin((tick+off)*0.2)*2, 15+i*4, -18);
      ctx.stroke();
    });
    ctx.restore();
  };

  const drawPipe = (ctx, x, gapY, gapSize = 145) => {
    const topH  = gapY - gapSize / 2;
    const botY  = gapY + gapSize / 2;
    const botH  = H - botY;
    // Pipe gradient
    const grad = (y, h) => {
      const g = ctx.createLinearGradient(x, 0, x + PIPE_W, 0);
      g.addColorStop(0, '#2a6b2a'); g.addColorStop(0.4,'#4a9a4a');
      g.addColorStop(0.7,'#3a8a3a'); g.addColorStop(1,'#1a4a1a');
      return g;
    };
    // Top pipe
    ctx.fillStyle = grad(); ctx.fillRect(x, 0, PIPE_W, topH);
    ctx.fillStyle = '#1a4a1a'; ctx.fillRect(x - 4, topH - 20, PIPE_W + 8, 20);
    // Bot pipe
    ctx.fillStyle = grad(); ctx.fillRect(x, botY, PIPE_W, botH);
    ctx.fillStyle = '#1a4a1a'; ctx.fillRect(x - 4, botY, PIPE_W + 8, 20);
    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x + 4, 0, 6, topH);
    ctx.fillRect(x + 4, botY + 20, 6, botH - 20);
  };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const loop = () => {
      const st = stateRef.current;
      ctx.clearRect(0, 0, W, H);

      // Sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#87ceeb'); sky.addColorStop(1, '#c8e6f5');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      // Clouds
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      [[40,80,60],[130,50,45],[230,100,55],[290,60,40]].forEach(([cx,cy,r]) => {
        ctx.beginPath(); ctx.arc(cx + (st?.tick||0)*0.3%W, cy, r*0.6, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+r*0.5 + (st?.tick||0)*0.3%W, cy-r*0.2, r*0.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx-r*0.4 + (st?.tick||0)*0.3%W, cy-r*0.1, r*0.4, 0, Math.PI*2); ctx.fill();
      });

      // Ground
      ctx.fillStyle = '#8B6914'; ctx.fillRect(0, H - 40, W, 40);
      ctx.fillStyle = '#5a8a3a'; ctx.fillRect(0, H - 40, W, 8);
      // Ground pattern
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      for (let gx = (st?.tick||0) * 2 % 40 - 40; gx < W; gx += 40) {
        ctx.fillRect(gx, H - 38, 2, 36);
      }

      if (!st) { rafRef.current = requestAnimationFrame(loop); return; }

      st.tick++;

      if (st.running) {
        // Physics
        st.bv += GRAVITY;
        st.by += st.bv;

        // Dynamic speed: starts 1.6, caps at 3.8 at score 30
        const dynSpd = Math.min(1.6 + st.score * 0.07, 3.8);
        // Dynamic gap: starts 170 wide, narrows to 128 at score 20
        const dynGap = Math.max(128, 170 - st.score * 2.1);
        st.dynGap = dynGap;

        // Spawn pipes
        const lastPipe = st.pipes[st.pipes.length - 1];
        if (!lastPipe || lastPipe.x < W - PIPE_INT) {
          st.pipes.push({ x: W, gapY: 140 + Math.random() * (H - 220 - 140) });
        }

        // Move + score pipes
        st.pipes = st.pipes.map(p => {
          if (!p.scored && p.x + PIPE_W < 60) {
            p.scored = true;
            st.score++;
            setScore(st.score);
          }
          return { ...p, x: p.x - dynSpd };
        }).filter(p => p.x + PIPE_W > 0);

        // Collision - pipes
        const bx = 60, br = 11;
        const hit = st.pipes.some(p => {
          const inX = bx + br > p.x + 4 && bx - br < p.x + PIPE_W - 4;
          const inY = st.by - br < p.gapY - dynGap / 2 || st.by + br > p.gapY + dynGap / 2;
          return inX && inY;
        });

        // Ceiling / floor
        if (st.by - br < 0 || st.by + br > H - 40 || hit) {
          st.running = false;
          const newBest = Math.max(best, st.score);
          setBest(newBest);
          try { localStorage.setItem('flappyBest', String(newBest)); } catch {}
          onScore(st.score);
          setPhase('dead');
        }
      }

      // Draw pipes
      const curGap = st.dynGap || 170;
      st.pipes.forEach(p => drawPipe(ctx, p.x, p.gapY, curGap));

      // Draw barista
      const angle = Math.min(Math.max(st.bv * 0.04, -0.4), 0.6);
      drawBarista(ctx, 60, st.by, angle);

      // HUD score
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.roundRect(W/2-40, 14, 80, 30, 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center';
      ctx.fillText(st.score, W/2, 36);

      // Overlays
      if (phase === 'idle' || (!st.running && phase !== 'dead')) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ffd700'; ctx.font = 'bold 28px Arial'; ctx.textAlign = 'center';
        ctx.fillText('FLAPPY BARISTA', W/2, H/2 - 50);
        ctx.fillStyle = '#fff'; ctx.font = '14px Arial';
        ctx.fillText(playerName, W/2, H/2 - 20);
        ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 16px Arial';
        ctx.fillText('TAP  /  SPACE  to flap!', W/2, H/2 + 20);
        if (best > 0) { ctx.fillStyle = '#8bc34a'; ctx.font = '13px Arial'; ctx.fillText(`Best: ${best}`, W/2, H/2 + 50); }
      }

      if (phase === 'dead') {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ff4444'; ctx.font = 'bold 26px Arial'; ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', W/2, H/2 - 55);
        ctx.fillStyle = '#ffd700'; ctx.font = 'bold 18px Arial';
        ctx.fillText(`Score: ${st.score}`, W/2, H/2 - 18);
        ctx.fillStyle = '#8bc34a'; ctx.font = '15px Arial';
        ctx.fillText(`Best: ${Math.max(best, st.score)}`, W/2, H/2 + 14);
        ctx.fillStyle = '#fff'; ctx.font = '14px Arial';
        ctx.fillText('Tap to play again', W/2, H/2 + 50);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [phase, playerName, best, onScore]);

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, alignItems:'center', background:'#87ceeb', overflow:'hidden' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 14px', background:'#1a0800', borderBottom:'1px solid #3d1f00', width:'100%', boxSizing:'border-box', flexShrink:0 }}>
        <span style={{ fontSize:12, color:'#ffd700', fontWeight:'bold' }}>{playerName}</span>
        <span style={{ fontSize:13, color:'#d4a853', fontWeight:'bold', letterSpacing:1 }}>FLAPPY BARISTA</span>
        <span style={{ fontSize:12, color:'#8bc34a', fontWeight:'bold' }}>Best: {best}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={W} height={H}
        style={{ display:'block', maxWidth:'100%', cursor:'pointer', touchAction:'none' }}
        onClick={flap}
        onTouchStart={e => { e.preventDefault(); flap(); }}
      />
    </div>
  );
}

const WORD_LIST = [
  { word:'LATTE',      hint:'Espresso + steamed milk',                         category:'Drinks' },
  { word:'MOCHA',      hint:'Coffee with chocolate syrup',                     category:'Drinks' },
  { word:'FRAPPE',     hint:'Blended iced coffee drink',                       category:'Drinks' },
  { word:'MATCHA',     hint:'Finely ground green tea powder',                  category:'Drinks' },
  { word:'BARISTA',    hint:'The person who makes your coffee',                category:'Cafe' },
  { word:'ALMOND',     hint:'Nut used for plant-based milk',                   category:'Food' },
  { word:'MUFFIN',     hint:'Domed cup-baked treat',                           category:'Food' },
  { word:'CARAMEL',    hint:'Sweet golden-brown sauce',                        category:'Food' },
  { word:'VANILLA',    hint:'Classic white flavoring pod',                     category:'Food' },
  { word:'COCONUT',    hint:'Tropical nut with white flesh',                   category:'Food' },
  { word:'CINNAMON',   hint:'Bark spice sprinkled on lattes',                  category:'Food' },
  { word:'ESPRESSO',   hint:'Strong short concentrated coffee',                category:'Drinks' },
  { word:'TIRAMISU',   hint:'Italian pick-me-up dessert',                      category:'Food' },
  { word:'SMOOTHIE',   hint:'Blended fruit drink',                             category:'Drinks' },
  { word:'PANCAKE',    hint:'Flat round griddle cake',                         category:'Food' },
  { word:'BROWNIE',    hint:'Dense chocolate dessert square',                  category:'Food' },
  { word:'WAFFLE',     hint:'Grid-patterned baked cake',                       category:'Food' },
  { word:'AMERICANO',  hint:'Espresso diluted with hot water',                 category:'Drinks' },
  { word:'AFFOGATO',   hint:'Ice cream drowned in espresso',                   category:'Drinks' },
  { word:'CROISSANT',  hint:'Buttery crescent French pastry',                  category:'Food' },
  { word:'MACCHIATO',  hint:'Espresso stained with milk',                      category:'Drinks' },
  { word:'COASTER',    hint:'Small mat placed under your cup',                 category:'Cafe' },
  { word:'JOURNAL',    hint:'Notebook cafe visitors write in',                 category:'Cafe' },
  { word:'CHEESECAKE', hint:'Creamy dessert on biscuit base',                  category:'Food' },
  { word:'SANDWICH',   hint:'Two bread slices with filling',                   category:'Food' },
  { word:'SAMPAGUITA', hint:'National flower of the Philippines',               category:'PH Plants' },
  { word:'WALING',     hint:'Queen of Philippine flowers, a rare orchid',      category:'PH Plants' },
  { word:'YLANGYLANG', hint:'Fragrant yellow flower used in perfumes',         category:'PH Plants' },
  { word:'BANABA',     hint:'Philippine tree with purple flowers',             category:'PH Plants' },
  { word:'ANAHAW',     hint:'National leaf of the Philippines, a fan palm',    category:'PH Plants' },
  { word:'NARRA',      hint:'National tree of the Philippines',                category:'PH Plants' },
  { word:'BAMBOO',     hint:'Tall grass used in Philippine crafts',            category:'PH Plants' },
  { word:'KAMIAS',     hint:'Sour small green fruit used in sinigang',         category:'PH Plants' },
  { word:'TAMARAW',    hint:'Critically endangered dwarf buffalo of Mindoro',  category:'PH Animals' },
  { word:'TARSIER',    hint:'Tiny big-eyed primate found in Bohol',            category:'PH Animals' },
  { word:'PAWIKAN',    hint:'Sea turtle that nests on Philippine beaches',     category:'PH Animals' },
  { word:'DUGONG',     hint:'Sea cow mammal found in Palawan waters',          category:'PH Animals' },
  { word:'KALAW',      hint:'Philippine hornbill, call sounds like its name',  category:'PH Animals' },
  { word:'AGILA',      hint:'Philippine Eagle, the national bird',             category:'PH Animals' },
  { word:'BUTIKI',     hint:'Common house lizard on Philippine walls',         category:'PH Animals' },
  { word:'BUWAYA',     hint:'Philippine crocodile, critically endangered',     category:'PH Animals' },
  { word:'BANGUS',     hint:'National fish of the Philippines, milkfish',      category:'PH Animals' },
  { word:'KALABAW',    hint:'Water buffalo, national animal of the PH',        category:'PH Animals' },
  { word:'MANOK',      hint:'Filipino word for chicken',                       category:'PH Animals' },
  { word:'LAPU',       hint:'First Filipino hero who defeated Magellan',       category:'PH History' },
  { word:'RIZAL',      hint:'National hero, wrote Noli Me Tangere',            category:'PH History' },
  { word:'BATAAN',     hint:'Province known for the Death March in WW2',       category:'PH History' },
  { word:'KATIPUNAN',  hint:'Secret revolutionary society founded in 1892',    category:'PH History' },
  { word:'AGUINALDO',  hint:'First President of the Philippines',              category:'PH History' },
  { word:'CAVITE',     hint:'Province where the Cry of revolution happened',   category:'PH History' },
  { word:'MAGELLAN',   hint:'Portuguese explorer who arrived in PH in 1521',   category:'PH History' },
  { word:'LEYTE',      hint:'Island where MacArthur returned in WW2',          category:'PH History' },
  { word:'INTRAMUROS', hint:'Walled city built by Spanish in Manila',          category:'PH History' },
  { word:'MABINI',     hint:'Brains of the Philippine Revolution, paralyzed',  category:'PH History' },
  { word:'BONIFACIO',  hint:'Supremo of the Katipunan',                        category:'PH History' },
  { word:'BULAKAN',    hint:'Province where the Cry of 1896 took place',       category:'PH History' },
  { word:'EDSA',       hint:'Highway famous for the 1986 People Power revolt', category:'PH History' },
  { word:'CORREGIDOR', hint:'Island fortress at the mouth of Manila Bay',      category:'PH History' },
  { word:'LUNA',       hint:'General Antonio, brilliant PH military leader',   category:'PH History' },
  { word:'SINIGANG',   hint:'Sour Filipino soup with tamarind broth',          category:'PH Food' },
  { word:'ADOBO',      hint:'Most famous Filipino dish, vinegar and soy',      category:'PH Food' },
  { word:'KARE',       hint:'Filipino peanut-based stew with oxtail',          category:'PH Food' },
  { word:'LECHON',     hint:'Whole roasted pig, centerpiece of fiestas',       category:'PH Food' },
  { word:'PANCIT',     hint:'Filipino noodle dish symbolizing long life',      category:'PH Food' },
  { word:'LUMPIA',     hint:'Filipino spring roll, fried or fresh',            category:'PH Food' },
  { word:'BIBINGKA',   hint:'Rice cake cooked in a clay pot, Christmas food',  category:'PH Food' },
  { word:'HALO',       hint:'Popular Filipino shaved ice dessert',             category:'PH Food' },
  { word:'BALUT',      hint:'Fertilized duck egg, popular street food',        category:'PH Food' },
  { word:'TINOLA',     hint:'Ginger chicken soup with green papaya',           category:'PH Food' },
  { word:'KINILAW',    hint:'Filipino ceviche, raw fish cured in vinegar',     category:'PH Food' },
  { word:'TOCINO',     hint:'Sweet cured pork, popular breakfast meat',        category:'PH Food' },
  { word:'DINUGUAN',   hint:'Pork blood stew, also called chocolate meat',     category:'PH Food' },
  { word:'PUTO',       hint:'Steamed rice cake, sweet and fluffy',             category:'PH Food' },
  { word:'ILOILO',     hint:'City in Visayas known as the City of Love',       category:'PH Places' },
  { word:'BATANES',    hint:'Northernmost province, stone house island group', category:'PH Places' },
  { word:'PALAWAN',    hint:'Last ecological frontier of the Philippines',     category:'PH Places' },
  { word:'BORACAY',    hint:'Famous white sand beach island in Aklan',         category:'PH Places' },
  { word:'TAGAYTAY',   hint:'Cool highland city overlooking Taal Volcano',     category:'PH Places' },
  { word:'VIGAN',      hint:'UNESCO heritage city with Spanish cobblestones',  category:'PH Places' },
  { word:'CEBU',       hint:'Queen City of the South, oldest city in PH',      category:'PH Places' },
  { word:'DAVAO',      hint:'Largest city by area in the Philippines',         category:'PH Places' },
  { word:'BAGUIO',     hint:'Summer capital, City of Pines in Benguet',        category:'PH Places' },
  { word:'TAAL',       hint:'Volcano inside a lake inside a lake, Batangas',   category:'PH Places' },
  { word:'TUBBATAHA',  hint:'UNESCO reef in Sulu Sea, no-take marine park',    category:'PH Places' },
  { word:'MAYON',      hint:'Most active volcano, perfect cone shape',         category:'PH Places' },
  { word:'CHOCOLATE',  hint:'Hills of Bohol that look like this dessert',      category:'PH Places' },
  { word:'TAGALOG',    hint:'Main language of Luzon, basis of Filipino',       category:'PH Culture' },
  { word:'BAYANIHAN',  hint:'Filipino spirit of communal unity and helping',   category:'PH Culture' },
  { word:'JEEPNEY',    hint:'Colorful PH public transport, king of the road',  category:'PH Culture' },
  { word:'TINIKLING',  hint:'Philippine national dance with bamboo poles',     category:'PH Culture' },
  { word:'BARONG',     hint:'Sheer embroidered formal shirt, national wear',   category:'PH Culture' },
  { word:'PAROL',      hint:'Star-shaped Christmas lantern from Pampanga',     category:'PH Culture' },
  { word:'SINULOG',    hint:'Grand festival in Cebu honoring Santo Nino',      category:'PH Culture' },
  { word:'ATI',        hint:'Annual festival in Kalibo, Aklan, pre-Lenten',    category:'PH Culture' },
  { word:'ALIBATA',    hint:'Ancient Philippine writing script, also Baybayin',category:'PH Culture' },
  { word:'BALAGTASAN', hint:'Filipino verbal joust debate in verse form',      category:'PH Culture' },
  { word:'KULINTANG',  hint:'Mindanao gong ensemble, traditional music',       category:'PH Culture' },
  { word:'BANIG',      hint:'Woven sleeping mat, Filipino traditional craft',  category:'PH Culture' },
  { word:'PASKO',      hint:'Filipino word for Christmas',                     category:'PH Culture' },
  { word:'FIESTA',     hint:'Town festival celebrating the patron saint',      category:'PH Culture' },
  { word:'HARANA',     hint:'Traditional Filipino serenade under a window',    category:'PH Culture' },
  { word:'LUZON',      hint:'Largest island group of the Philippines',         category:'PH Geography' },
  { word:'VISAYAS',    hint:'Central island group, heart of the Philippines',  category:'PH Geography' },
  { word:'MINDANAO',   hint:'Second largest island, southernmost major group', category:'PH Geography' },
  { word:'MANILA',     hint:'Capital city of the Philippines',                 category:'PH Geography' },
  { word:'PASIG',      hint:'River running through Metro Manila',              category:'PH Geography' },
  { word:'LAGUNA',     hint:'Largest lake in the Philippines',                 category:'PH Geography' },
  { word:'SULU',       hint:'Archipelago in southwestern Philippines',         category:'PH Geography' },
  { word:'CORDILLERA', hint:'Mountain range in northern Luzon',                category:'PH Geography' },
  { word:'CAGAYAN',    hint:'Valley region and river in northern Luzon',       category:'PH Geography' },
  { word:'SIBUYAN',    hint:'Sea between Luzon, Visayas and Mindoro',          category:'PH Geography' },
  { word:'AETA',       hint:'Indigenous people of Luzon, original inhabitants',category:'PH People' },
  { word:'IGOROT',     hint:'Indigenous people of the Cordillera mountains',   category:'PH People' },
  { word:'LUMAD',      hint:'Collective term for indigenous peoples of Mindanao',category:'PH People' },
  { word:'MORO',       hint:'Filipino Muslim communities of Mindanao and Sulu',category:'PH People' },
  { word:'ILUSTRADO',  hint:'Educated Filipino elite during Spanish colonial era',category:'PH People' },
  { word:'INDIO',      hint:'Term used by Spaniards for native Filipinos',     category:'PH People' },
  { word:'BAYANI',     hint:'Filipino word for hero or volunteer',             category:'PH People' },
  { word:'BABAYLAN',   hint:'Pre-colonial Filipino shaman or spiritual healer',category:'PH People' },
  { word:'DATU',       hint:'Pre-colonial Filipino chieftain or leader',       category:'PH People' },
  { word:'ALIMANGO',   hint:'Mud crab, prized seafood in Philippine markets',  category:'PH Science' },
  { word:'ABACA',      hint:'Philippine fiber plant, Manila hemp source',      category:'PH Science' },
  { word:'CAPIZ',      hint:'Shell used for windows and decor, found in Panay',category:'PH Science' },
  { word:'COGON',      hint:'Tall grass used for thatching roofs in PH',       category:'PH Science' },
  { word:'CAMOTE',     hint:'Sweet potato, staple crop in rural Philippines',  category:'PH Science' },
  { word:'AMPALAYA',   hint:'Bitter gourd vegetable, known health food in PH', category:'PH Science' },
  { word:'MALUNGGAY',  hint:'Moringa tree, Filipino superfood and herbal plant',category:'PH Science' },
  { word:'LANGKA',     hint:'Jackfruit, largest tree fruit, used in veggie dishes',category:'PH Science' },
];

const PLAYABLE = WORD_LIST.filter(w => w.word.length >= 4 && w.word.length <= 9);
const KEYBOARD_ROWS = ['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];
const MAX_MISTAKES = 3;

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
  const [mistakes, setMistakes] = useState(0);
  const [baristaMsg, setBaristaMsg] = useState('wave');

  const pickWord = useCallback((used = []) => {
    const avail = PLAYABLE.filter(w => !used.includes(w.word));
    const list = avail.length > 0 ? avail : PLAYABLE;
    setWordData(list[Math.floor(Math.random() * list.length)]);
    setGuesses([]); setCurrent(''); setGameState('playing');
    setMistakes(0); setBaristaMsg('wave');
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

  const isCorrectGuess = (guess) => guess === word;

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
    if (current.length !== WL) { setShake(true); setTimeout(() => setShake(false), 500); return; }
    if (gameState !== 'playing') return;
    const newGuesses = [...guesses, current];
    const isRight = current === word;
    const newMistakes = isRight ? mistakes : mistakes + 1;
    setGuesses(newGuesses); setCurrent('');
    if (isRight) {
      const pts = Math.max(10, 100 - mistakes * 20) + streak * 15;
      setScore(s => s + pts); setStreak(s => s + 1);
      setBaristaMsg('cheer'); setGameState('won'); onScore(score + pts);
    } else {
      setMistakes(newMistakes);
      setBaristaMsg('fight');
      if (newMistakes >= MAX_MISTAKES) {
        setGameState('lost'); setBaristaMsg('sad'); setStreak(0); onScore(score);
      } else {
        setTimeout(() => { setBaristaMsg(newMistakes === MAX_MISTAKES - 1 ? 'sad' : 'wave'); }, 700);
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
  }, [current, gameState, word, WL, mistakes]);

  const nextRound = () => { const nu = [...usedWords, word]; setUsedWords(nu); setRound(r => r + 1); pickWord(nu); };

  const tileColors = {
    correct: { bg: '#538d4e', border: '#538d4e', color: '#fff' },
    present: { bg: '#b59f3b', border: '#b59f3b', color: '#fff' },
    absent:  { bg: '#3a3a3c', border: '#3a3a3c', color: '#fff' },
    empty:   { bg: 'transparent', border: '#3a3a3c', color: '#fff' },
    active:  { bg: 'transparent', border: '#999', color: '#fff' },
  };
  const keyColors = { correct:{bg:'#538d4e',color:'#fff'}, present:{bg:'#b59f3b',color:'#fff'}, absent:{bg:'#3a3a3c',color:'#fff'}, unused:{bg:'#6b3a1f',color:'#d4a853'} };
  const TILE_SIZE = Math.min(46, Math.floor((Math.min(typeof window !== 'undefined' ? window.innerWidth : 390, 400) - 48) / Math.max(WL, 5)));

  if (!wordData) return <div style={{ color: '#d4a853', textAlign: 'center', padding: 40 }}>Loading...</div>;

  const msgMap = {
    wave:  { text: `Guess the word!`, color: '#ffd700' },
    fight: { text: mistakes >= MAX_MISTAKES - 1 ? 'Last chance!' : 'WRONG!', color: mistakes >= MAX_MISTAKES - 1 ? '#ff8800' : '#ff4444' },
    cheer: { text: 'CORRECT!', color: '#44ff88' },
    sad:   { text: 'Game Over!', color: '#888' },
  };
  const msg = msgMap[baristaMsg] || msgMap.wave;

  return (
    <div style={{ height: '100%', background: '#121213', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: "'Arial',sans-serif", overflow: 'hidden' }}>

      {/* Top HUD */}
      <div style={{ background: '#1a1a1b', borderBottom: '1px solid #3a3a3c', padding: '7px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: '#818384' }}>Round <b style={{ color: '#d4a853' }}>{round}</b></div>
        <div style={{ fontSize: 13, fontWeight: 'bold', color: '#d4a853', letterSpacing: 2 }}>GUESS THE WORD</div>
        <div style={{ fontSize: 11, color: '#818384' }}><b style={{ color: '#d4a853' }}>{score}</b>{streak > 0 && <span style={{color:'#ff8800'}}> 🔥{streak}</span>}</div>
      </div>

      {/* Description */}
      <div style={{ background: '#1e0e00', borderBottom: '1px solid #3d1f00', padding: '8px 16px', flexShrink: 0, textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: '#6b3a1f', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Description</div>
        <div style={{ fontSize: 14, color: '#f5e6d0', fontStyle: 'italic', lineHeight: 1.4 }}>"{wordData.hint}"</div>
        <div style={{ fontSize: 10, color: '#6b3a1f', marginTop: 2 }}>{wordData.category} · {WL} letters</div>
      </div>

      {/* Barista row — real photos on sides, message in center */}
      <div style={{ background: '#1a0800', borderBottom: '2px solid #3d1f00', padding: '4px 8px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        {/* Left barista — Kelly */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', border: '2px solid #d4a853' }}>
            <img src={KELLY_FACE_B64} alt="Kelly" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%' }} />
          </div>
          <span style={{ fontSize: 9, color: '#c8943a', fontWeight: 'bold', letterSpacing: 0.5 }}>KELLY</span>
        </div>

        {/* Center: mistake boxes + message */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 3 }}>
            {Array.from({ length: MAX_MISTAKES }).map((_, i) => (
              <div key={i} style={{ width: 16, height: 16, borderRadius: 3, background: i < mistakes ? '#ff4444' : '#538d4e', border: `1px solid ${i < mistakes ? '#ff2222' : '#3a6a3a'}`, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
                {i < mistakes ? 'X' : ''}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: msg.color }}>{msg.text}</div>
        </div>

        {/* Right barista — Maryz */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', border: '2px solid #d4a853' }}>
            <img src={MARYZ_FACE_B64} alt="Maryz" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%' }} />
          </div>
          <span style={{ fontSize: 9, color: '#c8943a', fontWeight: 'bold', letterSpacing: 0.5 }}>MARYZ</span>
        </div>
      </div>

      {/* Tile grid */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 0', gap: 5, overflowY: 'auto' }}>
        {Array.from({ length: gameState === 'playing' ? guesses.length + 1 : guesses.length }).map((_, rowIdx) => {
          const guess = guesses[rowIdx];
          const isActive = rowIdx === guesses.length && gameState === 'playing';
          const displayWord = isActive ? current : (guess || '');
          const isShaking = isActive && shake;
          const isWrong = guess && guess !== word;
          return (
            <div key={rowIdx} style={{ display: 'flex', gap: 5, animation: isShaking ? 'shake 0.4s ease' : 'none', opacity: isWrong ? 0.75 : 1 }}>
              {Array.from({ length: WL }).map((_, colIdx) => {
                const letter = displayWord[colIdx] || '';
                let state = 'empty';
                if (guess) state = getTileState(guess, colIdx);
                else if (isActive && letter) state = 'active';
                const c = tileColors[state];
                return (<div key={colIdx} style={{ width: TILE_SIZE, height: TILE_SIZE, background: c.bg, border: `2px solid ${c.border}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(TILE_SIZE * 0.46), fontWeight: 'bold', color: c.color, transition: guess ? `background 0.3s ${colIdx * 0.1}s` : 'border-color 0.1s', transform: isActive && letter && colIdx === current.length - 1 ? 'scale(1.12)' : 'scale(1)', userSelect: 'none', textTransform: 'uppercase' }}>{letter}</div>);
              })}
            </div>
          );
        })}
        {gameState === 'playing' && mistakes === 0 && guesses.length === 0 && (
          <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>3 wrong guesses = game over</div>
        )}
      </div>

      {/* Result panel — only shown when not playing */}
      {gameState !== 'playing' && (
        <div style={{ textAlign: 'center', padding: '14px 14px 16px', background: gameState === 'won' ? '#0a1f0a' : '#1f0a0a', borderTop: `2px solid ${gameState === 'won' ? '#44ff88' : '#ff4444'}`, flexShrink: 0 }}>
          <div style={{ fontSize: gameState==='won' ? 22 : 17, fontWeight: 'bold', color: gameState==='won' ? '#44ff88' : '#ff6b6b', marginBottom: 6 }}>
            {gameState === 'won'
              ? (mistakes === 0 ? 'PERFECT!!' : mistakes === 1 ? 'GREAT!' : 'GOT IT!')
              : `It was "${word}"`}
          </div>
          {gameState === 'won' && <div style={{ fontSize: 13, color: '#ffd700', marginBottom: 10 }}>+{Math.max(10, 100 - mistakes * 20) + streak * 15} pts{streak > 1 ? ` · ${streak}x streak` : ''}</div>}
          <button onClick={nextRound} style={{ background: gameState==='won' ? '#44cc66' : '#d4a853', border: 'none', borderRadius: 12, padding: '11px 32px', color: gameState==='won' ? '#fff' : '#1a0a00', fontWeight: 'bold', fontSize: 15, cursor: 'pointer' }}>
            Next Word
          </button>
        </div>
      )}

      {/* Keyboard */}
      <div style={{ background: '#2a1400', borderTop: '1px solid #3d1f00', padding: '8px 4px 14px', flexShrink: 0 }}>
        {KEYBOARD_ROWS.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 6 }}>
            {ri === 2 && <button onPointerDown={e => { e.preventDefault(); pressKey('ENTER'); }} style={{ background: '#818384', border: 'none', borderRadius: 6, padding: '16px 8px', color: '#fff', fontSize: 11, fontWeight: 'bold', cursor: 'pointer', minWidth: 44, userSelect: 'none' }}>ENTER</button>}
            {row.split('').map(l => { const ks = keyColors[getKeyState(l)]; return (<button key={l} onPointerDown={e => { e.preventDefault(); pressKey(l); }} style={{ background: ks.bg, border: 'none', borderRadius: 6, padding: '16px 0', color: ks.color, fontSize: 15, fontWeight: 'bold', cursor: 'pointer', width: 30, userSelect: 'none', transition: 'background 0.2s' }}>{l}</button>); })}
            {ri === 2 && <button onPointerDown={e => { e.preventDefault(); pressKey('DEL'); }} style={{ background: '#818384', border: 'none', borderRadius: 6, padding: '16px 8px', color: '#fff', fontSize: 13, fontWeight: 'bold', cursor: 'pointer', minWidth: 44, userSelect: 'none' }}>DEL</button>}
          </div>
        ))}
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}`}</style>
    </div>
  );
}

const FAIRY_QUESTIONS = [
  { text: "If your life had a theme song, what would it be and why?", tag: "deep" },
  { text: "What is one thing you would never eat even if someone paid you?", tag: "funny" },
  { text: "If you could only eat one food for the rest of your life, what would it be?", tag: "funny" },
  { text: "What is your biggest fear that most people would laugh at?", tag: "deep" },
  { text: "If you woke up tomorrow with one superpower, what would you choose?", tag: "funny" },
  { text: "What is the most embarrassing thing you have done in public?", tag: "funny" },
  { text: "If you could relive one day of your life, which would it be?", tag: "deep" },
  { text: "What would you do first if you won a million pesos?", tag: "funny" },
  { text: "Who in this group would survive a zombie apocalypse the longest?", tag: "funny" },
  { text: "What is one thing you thought you were good at but actually are not?", tag: "funny" },
  { text: "If you had to describe yourself as a food, what would you be?", tag: "funny" },
  { text: "What is the worst advice you have ever given someone?", tag: "funny" },
  { text: "What is something you do when no one is watching?", tag: "spicy" },
  { text: "If you could trade lives with anyone in this room for a day, who would it be?", tag: "spicy" },
  { text: "What is the most childish thing you still do?", tag: "funny" },
  { text: "Have you ever pretended to not see someone in public to avoid talking to them?", tag: "spicy" },
  { text: "What is one thing on your bucket list that surprises people?", tag: "deep" },
  { text: "If animals could talk, which one do you think would be the rudest?", tag: "funny" },
  { text: "What is a guilty pleasure you are embarrassed to admit?", tag: "spicy" },
  { text: "If you had to wear one outfit for the rest of your life, what would it be?", tag: "funny" },
  { text: "What is the most random skill you have that no one knows about?", tag: "deep" },
  { text: "Who in this group is most likely to become famous?", tag: "funny" },
  { text: "What is the most spontaneous thing you have ever done?", tag: "deep" },
  { text: "If you were a villain in a movie, what would your evil plan be?", tag: "funny" },
  { text: "What is something you believed as a child that turned out to be completely wrong?", tag: "funny" },
  { text: "If you could only keep three apps on your phone, which would they be?", tag: "funny" },
  { text: "What is the weirdest dream you can remember?", tag: "funny" },
  { text: "If you were stuck on a deserted island with one person in this group, who would you pick?", tag: "spicy" },
  { text: "What is one thing you would change about yourself if you could?", tag: "deep" },
  { text: "If your personality was a weather forecast, what would today's forecast be?", tag: "funny" },
];

const FAIRY_CATEGORIES = [
  { id: "all",   label: "All questions", icon: "ti-diamond" },
  { id: "funny", label: "Funny only",    icon: "ti-mood-happy" },
  { id: "deep",  label: "Deep only",     icon: "ti-moon" },
  { id: "spicy", label: "Spicy only",    icon: "ti-flame" },
];

const FAIRY_TAG_COLORS = {
  deep:  { bg: "#3d1060", color: "#d48fff", label: "Thoughtful" },
  funny: { bg: "#1a3060", color: "#8fc8ff", label: "Funny"      },
  spicy: { bg: "#601020", color: "#ffb0b0", label: "Spicy"      },
};

function shuffleArr(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function FairyQGame({ playerName, onBack }) {
  const [screen, setScreen]   = React.useState("intro");
  const [category, setCategory] = React.useState("all");
  const [questions, setQuestions] = React.useState([]);
  const [qIdx, setQIdx]       = React.useState(0);
  const [skipped, setSkipped] = React.useState(0);

  const startGame = (cat) => {
    const pool = FAIRY_QUESTIONS.filter(q => cat === "all" || q.tag === cat);
    setQuestions(shuffleArr(pool).slice(0, 15));
    setCategory(cat);
    setQIdx(0);
    setSkipped(0);
    setScreen("game");
  };

  const nextQ = (skip) => {
    if (skip) setSkipped(s => s + 1);
    if (qIdx + 1 >= questions.length) { setScreen("done"); }
    else { setQIdx(i => i + 1); }
  };

  const C = {
    bg:"#1a0530", card:"#2d0a50", cardBorder:"#7a3db5", softBorder:"#4a2070",
    purple:"#9455d0", purpleDim:"#7a3db5", textPrimary:"#f0c6ff",
    textMuted:"#c48de8", textDim:"#7a5090",
  };

  const btnPrimary = { width:"100%", padding:"14px", borderRadius:14, background:C.purpleDim, border:"none", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer", marginTop:4, fontFamily:"inherit" };
  const btnSecondary = { width:"100%", padding:"10px", borderRadius:14, background:"transparent", border:`1.5px solid ${C.softBorder}`, color:C.textDim, fontSize:13, fontWeight:600, cursor:"pointer", marginTop:8, fontFamily:"inherit" };
  const topBar = { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", background:"#12022a", borderBottom:`1px solid ${C.softBorder}`, flexShrink:0 };
  const base = { minHeight:"100%", background:C.bg, color:C.textPrimary, fontFamily:"'Georgia', serif", display:"flex", flexDirection:"column" };

  if (screen === "intro") {
    return (
      <div style={base}>
        <div style={topBar}>
          <button onClick={onBack} style={{ background:C.card, border:`1px solid ${C.softBorder}`, borderRadius:20, padding:"6px 14px", color:C.textMuted, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Exit</button>
          <span style={{ fontSize:14, fontWeight:700, color:C.textPrimary, letterSpacing:1 }}>Friends & Questions</span>
          <div style={{ width:60 }} />
        </div>
        <div style={{ flex:1, padding:"28px 20px 24px", overflowY:"auto" }}>
          <div style={{ textAlign:"center", fontSize:52, marginBottom:4 }}>&#10024;</div>
          <div style={{ fontSize:24, fontWeight:700, color:C.textPrimary, textAlign:"center", marginBottom:4 }}>Friends & Questions</div>
          <div style={{ fontSize:13, color:C.textMuted, textAlign:"center", marginBottom:22 }}>A magical game of laughs, spice & deep thoughts</div>
          <div style={{ background:C.card, border:`1.5px solid ${C.softBorder}`, borderRadius:16, padding:"16px 14px", marginBottom:18 }}>
            <div style={{ fontSize:11, color:"#b06adf", fontWeight:700, letterSpacing:1.2, textTransform:"uppercase", marginBottom:12 }}>Choose a vibe</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {FAIRY_CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => startGame(cat.id)}
                  style={{ padding:"16px 10px", borderRadius:14, border:`1.5px solid ${C.softBorder}`, background:C.bg, color:C.textPrimary, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", textAlign:"center" }}>
                  <i className={`ti ${cat.icon}`} style={{ fontSize:26, display:"block", marginBottom:6, color:C.textMuted }} aria-hidden="true" />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ fontSize:12, color:C.textDim, textAlign:"center" }}>30 questions - answer together - no right or wrong</div>
        </div>
      </div>
    );
  }

  if (screen === "game") {
    const q = questions[qIdx];
    const tc = FAIRY_TAG_COLORS[q.tag] || FAIRY_TAG_COLORS.funny;
    const prog = Math.round((qIdx / questions.length) * 100);
    return (
      <div style={base}>
        <div style={topBar}>
          <button onClick={onBack} style={{ background:C.card, border:`1px solid ${C.softBorder}`, borderRadius:20, padding:"6px 14px", color:C.textMuted, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Exit</button>
          <span style={{ fontSize:13, fontWeight:700, color:C.textPrimary }}>{qIdx + 1} / {questions.length}</span>
          <div style={{ width:60 }} />
        </div>
        <div style={{ height:4, background:C.card }}><div style={{ height:"100%", width:`${prog}%`, background:C.purple, transition:"width 0.4s" }} /></div>
        <div style={{ flex:1, padding:"20px 18px 24px", overflowY:"auto", display:"flex", flexDirection:"column" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
            <span style={{ fontSize:11, color:C.textDim, fontWeight:700 }}>Question {qIdx + 1}</span>
            <span style={{ fontSize:11, color:C.textDim }}>{skipped} skipped</span>
          </div>
          <div style={{ background:C.card, border:`1.5px solid ${C.cardBorder}`, borderRadius:18, padding:"22px 18px", flex:1, display:"flex", flexDirection:"column", justifyContent:"center", marginBottom:16 }}>
            <div style={{ fontSize:20, fontWeight:700, color:C.textPrimary, lineHeight:1.55, marginBottom:14 }}>{q.text}</div>
            <div style={{ display:"inline-block", background:tc.bg, color:tc.color, borderRadius:20, padding:"4px 12px", fontSize:11, fontWeight:700 }}>{tc.label}</div>
          </div>
          <div style={{ display:"flex", justifyContent:"center", gap:6, marginBottom:14, flexWrap:"wrap" }}>
            {questions.map((_, i) => (<div key={i} style={{ width:8, height:8, borderRadius:"50%", background:i < qIdx ? C.purple : C.softBorder, transition:"background 0.3s" }} />))}
          </div>
          <button style={btnPrimary} onClick={() => nextQ(false)}>Next question &#10024;</button>
          <button style={btnSecondary} onClick={() => nextQ(true)}>Skip this one</button>
        </div>
      </div>
    );
  }

  return (
    <div style={base}>
      <div style={topBar}>
        <button onClick={onBack} style={{ background:C.card, border:`1px solid ${C.softBorder}`, borderRadius:20, padding:"6px 14px", color:C.textMuted, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Exit</button>
        <span style={{ fontSize:14, fontWeight:700, color:C.textPrimary }}>Done!</span>
        <div style={{ width:60 }} />
      </div>
      <div style={{ flex:1, padding:"32px 20px 28px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
        <div style={{ fontSize:56, marginBottom:8 }}>&#127775;</div>
        <div style={{ fontSize:22, fontWeight:700, color:C.textPrimary, textAlign:"center", marginBottom:8 }}>All done, fairies!</div>
        <div style={{ fontSize:14, color:C.textMuted, textAlign:"center", lineHeight:1.6, marginBottom:28 }}>
          You answered {questions.length - skipped} questions<br />and skipped {skipped}.
        </div>
        <button style={{ ...btnPrimary, maxWidth:280 }} onClick={() => startGame(category)}>Play again &#10024;</button>
        <button style={{ ...btnSecondary, maxWidth:280 }} onClick={() => setScreen("intro")}>Change vibe</button>
      </div>
    </div>
  );
}

const FEATURED_GAME_WEEKS = LEADERBOARD_GAMES.map(g => g.id);
const FEATURED_WEEK_NUM = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
const FEATURED_GAME = FEATURED_GAME_WEEKS[FEATURED_WEEK_NUM % FEATURED_GAME_WEEKS.length];
const GAME_NAMES = { snake:'Snake', tetris:'Tetris', racing:'Cafe Racer', flappybarista:'Flappy Barista', zombie:'Zombie Barista', guessword:'Guess the Word' };
const _now = new Date();
const _ws = new Date(_now); _ws.setDate(_now.getDate() - _now.getDay());
const _we = new Date(_ws); _we.setDate(_ws.getDate() + 6);
const _fmt = d => d.toLocaleDateString('en-PH', { month:'short', day:'numeric' });
const weeklyDateRange = `${_fmt(_ws)} – ${_fmt(_we)}`;

export default function GamesPage() {
  const [activeGame, setActiveGame] = useState(null);
  const [showLB, setShowLB] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [musicOn, setMusicOn] = useState(true);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/game-music.mp3');
      audioRef.current.loop = true;
      audioRef.current.volume = 0.35;
    }
    const audio = audioRef.current;
    if (!activeGame && musicOn) { audio.play().catch(() => {}); }
    else { audio.pause(); }
    return () => { audio.pause(); };
  }, [activeGame, musicOn]);

  const [username, setUsername] = useState(()=>{try{return localStorage.getItem('cafeGameUser')||null;}catch{return null;}});
  const [showName, setShowName] = useState(false);
  const [pendingGame, setPendingGame] = useState(null);
  const [playerName, setPlayerName] = useState(()=>{try{return localStorage.getItem('cafePlayerName')||'';}catch{return '';}});
  const [localBests, setLocalBests] = useState(()=>{try{return JSON.parse(localStorage.getItem('cafeBests')||'{}');}catch{return {};}});
  const [lbGame, setLbGame] = useState(FEATURED_GAME);
  const [lbRows, setLbRows] = useState([]);
  const [lbLoading, setLbLoading] = useState(true);
  const [featuredLeader, setFeaturedLeader] = useState(null);

  React.useEffect(() => {
    const fetchLB = async () => {
      setLbLoading(true);
      try {
        const snap = await getDocs(collection(db, 'leaderboard'));
        const all = snap.docs.map(d => d.data());
        const filtered = all.filter(d => d.gameId === lbGame).sort((a,b) => (b.score||0)-(a.score||0)).slice(0,10);
        setLbRows(filtered);
        const fl = all.filter(d => d.gameId === FEATURED_GAME).sort((a,b) => (b.score||0)-(a.score||0))[0] || null;
        setFeaturedLeader(fl);
      } catch (e) { setLbRows([]); }
      setLbLoading(false);
    };
    fetchLB();
  }, [lbGame]);

  const saveLocal = (gameId, score) => {
    setLocalBests(prev => {
      const upd = {...prev,[gameId]:Math.max(prev[gameId]||0,score)};
      try{localStorage.setItem('cafeBests',JSON.stringify(upd));}catch{}
      return upd;
    });
  };

  const handleGameSelect = (game) => {
    if (game.id==='cafemystery'||game.id==='zombie'||game.id==='fairyq') { setActiveGame(game); return; }
    setPendingGame(game); setShowName(true);
  };
  const handleNameStart = (name) => {
    setPlayerName(name);
    try{localStorage.setItem('cafePlayerName',name);}catch{}
    setShowName(false); setActiveGame(pendingGame);
  };
  const handleScore = async (gameId, score) => {
    saveLocal(gameId, score);
    if (username && score > 0) { try{await saveScore(username,gameId,score);}catch(e){} }
  };
  const handleAuth = (user) => {
    setUsername(user);
    try{localStorage.setItem('cafeGameUser',user);}catch{}
    setShowAuth(false);
  };
  const handleLogout = () => {
    setUsername(null);
    try{localStorage.removeItem('cafeGameUser');}catch{}
  };

  if (activeGame) {
    return (
      <div style={S.fullscreen}>
        <div style={S.gameBar}>
          <button style={S.backBtn} onClick={()=>setActiveGame(null)}>Exit</button>
          <span style={S.gameTitle}>{activeGame.title}</span>
          <button style={S.lbBtn} onClick={()=>{setActiveGame(null);setShowLB(true);}}>🏆</button>
        </div>
        <div style={S.gameContent}>
          {activeGame.id==='snake'         && <SnakeGame        playerName={playerName} onScore={s=>handleScore('snake',s)} />}
          {activeGame.id==='tetris'        && <TetrisGame       playerName={playerName} onScore={s=>handleScore('tetris',s)} />}
          {activeGame.id==='racing'        && <RacingGame       playerName={playerName} onScore={s=>handleScore('racing',s)} />}
          {activeGame.id==='flappybarista' && <FlappyBarista    playerName={playerName} onScore={s=>handleScore('flappybarista',s)} />}
          {activeGame.id==='zombie'        && <ZombieGame       playerName={playerName} username={username} onScore={s=>handleScore('zombie',s)} onBack={()=>setActiveGame(null)} />}
          {activeGame.id==='guessword'     && <GuessWordGame    playerName={playerName} onScore={s=>handleScore('guessword',s)} />}
          {activeGame.id==='cafemystery'   && <CafeGame         playerName={playerName} onBack={()=>setActiveGame(null)} />}
          {activeGame.id==='fairyq'        && <FairyQGame       playerName={playerName} onBack={()=>setActiveGame(null)} />}
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
        <div style={S.sub}>Theonyx Cafe Arcade</div>
      </div>

      <div style={{height:3,background:'linear-gradient(90deg,transparent 0%,#ff4400 20%,#ffcc00 50%,#ff4400 80%,transparent 100%)',boxShadow:'0 0 10px rgba(255,140,0,0.7)',position:'relative',zIndex:2}}/>

      {/* Music toggle */}
      <div style={{position:'absolute',top:12,right:12,zIndex:10}}>
        <button onClick={()=>setMusicOn(m=>!m)} style={{background:'rgba(0,0,0,0.5)',border:'1px solid rgba(212,168,83,0.4)',borderRadius:20,padding:'4px 10px',color:'#ffd700',fontSize:13,cursor:'pointer'}}>
          {musicOn ? '🔊' : '🔇'}
        </button>
      </div>

      {/* Auth bar */}
      <div style={{position:'relative',zIndex:2,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 14px',background:'linear-gradient(90deg,#1a0800,#2a1000,#1a0800)',borderBottom:'1px solid #3d1500'}}>
        {username ? (
          <>
            <span style={{color:'#8bc34a',fontSize:12}}>{username}</span>
            <div style={{display:'flex',gap:6}}>
              <button onClick={()=>setShowLB(true)} style={{background:'#1a0800',border:'1.5px solid #d4a853',color:'#ffd700',padding:'5px 11px',borderRadius:14,fontSize:11,fontWeight:'bold',cursor:'pointer'}}>Leaderboard</button>
              <button onClick={handleLogout} style={{background:'transparent',border:'1px solid #6b3a1f',color:'#a07850',padding:'5px 10px',borderRadius:14,fontSize:11,cursor:'pointer'}}>Logout</button>
            </div>
          </>
        ) : (
          <>
            <span style={{color:'#7a5020',fontSize:11}}>Save scores to the global board</span>
            <div style={{display:'flex',gap:6}}>
              <button onClick={()=>setShowAuth(true)} style={{background:'linear-gradient(135deg,#ffd700,#e8a000)',border:'none',color:'#1a0800',padding:'6px 13px',borderRadius:14,fontSize:11,fontWeight:'bold',cursor:'pointer'}}>Sign Up</button>
              <button onClick={()=>setShowAuth(true)} style={{background:'#1a0800',border:'1.5px solid #d4a853',color:'#ffd700',padding:'6px 13px',borderRadius:14,fontSize:11,fontWeight:'bold',cursor:'pointer'}}>Sign In</button>
            </div>
          </>
        )}
      </div>

      {/* Floating particles */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,overflow:'hidden'}}>
        {Array.from({length:20}).map((_,i)=>(<div key={i} style={{position:'absolute',borderRadius:'50%',width:`${2+Math.random()*4}px`,height:`${2+Math.random()*4}px`,left:`${(i*17)%100}%`,background:['#ff8800','#ffcc00','#ff4400','#ffd700','#ff6600'][i%5],boxShadow:'0 0 6px #ff8800',animation:`floatUp ${3+i*0.4}s linear ${i*0.3}s infinite`,opacity:0}}/>))}
      </div>

      {/* Ticker */}
      <div style={{overflow:'hidden',height:22,display:'flex',alignItems:'center',background:'#ffd700',position:'relative',zIndex:2}}>
        <div style={{display:'flex',whiteSpace:'nowrap',animation:'lbTicker 16s linear infinite',fontSize:10,fontWeight:700,color:'#1a0800',letterSpacing:0.8}}>
          {[1,2].map(i=>(<span key={i} style={{padding:'0 28px'}}>TOP SCORER THIS WEEK WINS 1 FREE DRINK &nbsp;&#9733;&nbsp; REGISTER TO SAVE SCORES &nbsp;&#9733;&nbsp;</span>))}
        </div>
      </div>

      {/* Inline Leaderboard */}
      <div style={{background:'linear-gradient(180deg,#120800,#0a0400)',padding:'10px 12px 14px',position:'relative',zIndex:2}}>

        {/* LB header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:16,filter:'drop-shadow(0 0 5px #ffd700aa)',animation:'crownSpin 2.5s ease-in-out infinite',display:'inline-block'}}>&#127942;</span>
            <span style={{fontSize:12,fontWeight:700,background:'linear-gradient(90deg,#ffd700,#fff8cc,#ffaa00,#ffd700)',backgroundSize:'200% auto',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',animation:'shimmerLB 2s linear infinite'}}>HALL OF FAME</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:'#44ff88',display:'inline-block',animation:'lbPulse 1.2s infinite'}}/>
            <span style={{fontSize:9,color:'#c8943a',fontWeight:700}}>Live</span>
          </div>
        </div>

        {/* Weekly prize */}
        <div style={{background:'#1a0d00',border:'1px solid #ffd70033',borderRadius:10,padding:'7px 10px',marginBottom:8,display:'flex',alignItems:'center',gap:9}}>
          <svg width="24" height="24" viewBox="0 0 44 44" fill="none" style={{flexShrink:0,animation:'floatLB 2.5s ease-in-out infinite'}}>
            <rect x="8" y="18" width="24" height="18" rx="4" fill="#3d2200" stroke="#ffd700" strokeWidth="1.5"/>
            <path d="M32 22 Q40 22 40 28 Q40 34 32 34" stroke="#ffd700" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <rect x="12" y="13" width="16" height="5" rx="2" fill="#2a1400" stroke="#ffd70066" strokeWidth="1"/>
            <line x1="16" y1="10" x2="16" y2="13" stroke="#c8943a" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="22" y1="9" x2="22" y2="13" stroke="#c8943a" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="28" y1="10" x2="28" y2="13" stroke="#c8943a" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:1}}>
              <span style={{background:'#ffd700',borderRadius:4,padding:'1px 6px',fontSize:8,fontWeight:700,color:'#1a0800'}}>THIS WEEK</span>
              <span style={{fontSize:9,color:'#5a3a10'}}>{weeklyDateRange}</span>
            </div>
            <div style={{fontSize:11,fontWeight:700,color:'#f5e6d0'}}>Top scorer in <span style={{background:'linear-gradient(90deg,#ffd700,#fff8cc,#ffaa00,#ffd700)',backgroundSize:'200% auto',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',animation:'shimmerLB 2s linear infinite'}}>{GAME_NAMES[FEATURED_GAME]}</span></div>
            <div style={{fontSize:9,color:'#a07030'}}>wins <span style={{color:'#ffd700',fontWeight:700}}>1 FREE DRINK</span></div>
          </div>
          {featuredLeader ? (
            <div style={{textAlign:'center',flexShrink:0}}>
              <div style={{width:28,height:28,borderRadius:'50%',background:'#2a1400',border:'2px solid #ffd700',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'#ffd700',margin:'0 auto 2px',boxShadow:'0 0 6px #ffd70088'}}>{featuredLeader.username.slice(0,2).toUpperCase()}</div>
              <div style={{fontSize:9,color:'#ffd700',fontWeight:700,maxWidth:52,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{featuredLeader.username}</div>
              <div style={{fontSize:8,color:'#7a5020'}}>{fmtScore(FEATURED_GAME, featuredLeader.score)}</div>
            </div>
          ) : (
            <div style={{fontSize:9,color:'#4a3010',textAlign:'center',maxWidth:60}}>No scores yet!</div>
          )}
        </div>

        {/* ── GAME TABS — CENTERED ── */}
        <div style={{display:'flex',overflowX:'auto',background:'#100600',borderRadius:8,padding:'0 4px',gap:1,scrollbarWidth:'none',marginBottom:8,justifyContent:'center'}}>
          {LEADERBOARD_GAMES.map(g => (
            <button key={g.id}
              onClick={()=>setLbGame(g.id)}
              style={{flexShrink:0,padding:'6px 11px',border:'none',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:'inherit',transition:'all 0.15s',borderBottom:`2px solid ${lbGame===g.id?'#ffe066':'transparent'}`,background:lbGame===g.id?'linear-gradient(180deg,#c8943a,#9a6010)':'transparent',color:lbGame===g.id?'#1a0800':'#6a4820'}}>
              {g.title.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Podium top 3 */}
        {lbLoading ? (
          <div style={{textAlign:'center',color:'#4a3010',fontSize:11,padding:'16px 0',animation:'lbPulse 1s infinite'}}>Loading...</div>
        ) : (
          <>
            <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center',gap:5,marginBottom:8}}>
              {[1,0,2].map((rankIdx) => {
                const p = lbRows[rankIdx];
                const mc = ['#ffd700','#c8d0dc','#cd7f32'][rankIdx];
                const mg = ['#ffd70099','#c0c0c066','#cd7f3266'][rankIdx];
                const isFirst = rankIdx===0;
                const ph = [56,40,32][rankIdx];
                return (
                  <div key={rankIdx} style={{display:'flex',flexDirection:'column',alignItems:'center',flex:1,maxWidth:100,animation:`floatLB ${1.4+rankIdx*0.3}s ease-in-out infinite`}}>
                    {isFirst ? <span style={{fontSize:14,filter:'drop-shadow(0 0 5px #ffd700)',animation:'crownSpin 2.5s ease-in-out infinite',display:'inline-block',marginBottom:1}}>&#128081;</span> : <div style={{height:17}}/>}
                    <div style={{width:isFirst?34:26,height:isFirst?34:26,borderRadius:'50%',background:'#2a1400',border:`2px solid ${mc}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:isFirst?11:9,fontWeight:700,color:mc,flexShrink:0,boxShadow:`0 0 5px ${mg}`}}>{p?p.username.slice(0,2).toUpperCase():'?'}</div>
                    <div style={{fontSize:isFirst?10:9,fontWeight:700,color:'#f0ddb0',margin:'3px 0 1px',maxWidth:86,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p?p.username:'---'}</div>
                    <div style={{fontSize:isFirst?11:10,fontWeight:700,color:mc,marginBottom:3,filter:`drop-shadow(0 0 2px ${mc})`}}>{p?fmtScore(lbGame,p.score):'---'}</div>
                    <div style={{width:'100%',height:ph,background:`${mc}12`,border:`1px solid ${mc}44`,borderBottom:'none',borderRadius:'5px 5px 0 0',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <span style={{fontSize:14,fontWeight:700,color:mc,opacity:0.7}}>{rankIdx===0?'1':rankIdx===1?'2':'3'}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {lbRows.slice(3).map((p,idx) => (
              <div key={idx} style={{display:'flex',alignItems:'center',gap:7,padding:'5px 8px',background:idx%2===0?'#1a0e00':'#120800',borderRadius:7,marginBottom:3,border:'0.5px solid #2a1400'}}>
                <div style={{width:14,fontSize:10,fontWeight:700,color:'#4a3010',textAlign:'center'}}>{idx+4}</div>
                <div style={{width:22,height:22,borderRadius:'50%',background:'#2a1400',border:'1.5px solid #5a3a10',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'#c8943a',flexShrink:0}}>{p.username.slice(0,2).toUpperCase()}</div>
                <div style={{flex:1,fontSize:11,fontWeight:700,color:'#c89050'}}>{p.username}</div>
                <div style={{fontSize:11,fontWeight:700,background:'linear-gradient(90deg,#c8943a,#ffd700,#c8943a)',backgroundSize:'200% auto',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',animation:'shimmerLB 2.5s linear infinite'}}>{fmtScore(lbGame,p.score)}</div>
              </div>
            ))}
            {lbRows.length===0 && <div style={{textAlign:'center',color:'#4a3010',fontSize:11,padding:'12px 0'}}>No scores yet. Be the first!</div>}
          </>
        )}
      </div>

      {/* Game Grid */}
      <div style={{height:2,background:'linear-gradient(90deg,transparent,#ff4400 20%,#ffcc00 50%,#ff4400 80%,transparent)'}}/>
      <div style={{padding:'12px 12px 16px',background:'#0f0700',position:'relative',zIndex:2}}>
        <div style={{fontSize:10,color:'#7a4a10',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:700,marginBottom:10,textAlign:'center'}}>Choose your game</div>
        <div style={S.grid}>
          {GAME_LIST.map(game => (
            <div key={game.id} style={S.card}
              onClick={()=>handleGameSelect(game)}
              onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.04) translateY(-2px)';e.currentTarget.style.boxShadow='0 0 20px rgba(255,140,0,0.4)';e.currentTarget.style.borderColor='#d4a853';}}
              onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.boxShadow='none';e.currentTarget.style.borderColor='#6b3a1f';}}>
              <div style={{position:'absolute',top:6,left:6,width:14,height:14,borderTop:'1.5px solid rgba(255,160,0,0.6)',borderLeft:'1.5px solid rgba(255,160,0,0.6)'}}/>
              <div style={{position:'absolute',bottom:6,right:6,width:14,height:14,borderBottom:'1.5px solid rgba(255,160,0,0.6)',borderRight:'1.5px solid rgba(255,160,0,0.6)'}}/>
              <div style={{position:'absolute',top:-1,left:'20%',right:'20%',height:2,borderRadius:2,background:'rgba(255,200,0,0.7)',boxShadow:'0 0 8px rgba(255,160,0,0.8)'}}/>
              <div style={S.cardTitle}>{game.title}</div>
              <div style={S.cardSub}>{game.sub}</div>
              <div style={{fontSize:9,color:'#8a6030',marginTop:3,background:'#2a1200',border:'1px solid #4a2600',borderRadius:8,padding:'2px 7px',display:'inline-block'}}>{game.mode}</div>
              {localBests[game.id]>0 && <div style={S.cardBest}>Best: {fmtScore(game.id,localBests[game.id])}</div>}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes logoGlow{from{filter:drop-shadow(0 0 6px #ff8800) drop-shadow(0 0 14px #ff4400)}to{filter:drop-shadow(0 0 14px #ffcc00) drop-shadow(0 0 28px #ff8800)}}
        @keyframes lbTicker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes shimmerLB{0%{background-position:-200% center}100%{background-position:200% center}}
        @keyframes lbPulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes floatLB{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        @keyframes crownSpin{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
        @keyframes floatUp{0%{transform:translateY(100vh) scale(0);opacity:0}10%{opacity:0.8}90%{opacity:0.4}100%{transform:translateY(-40px) scale(1.5);opacity:0}}
      `}</style>
    </div>
  );
}
