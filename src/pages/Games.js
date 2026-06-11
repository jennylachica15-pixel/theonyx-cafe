import React, { useState, useEffect, useRef, useCallback } from 'react';
import CafeGame from './CafeGame';
import { db } from '../firebase/config';
import {
  collection, doc, setDoc, getDoc, getDocs,
  query, orderBy, limit, where, serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import ZombieGame from './ZombieGame';

const S = {
  wrap: { minHeight: '100vh', background: '#0a0400', color: '#f5e6d0', fontFamily: "'Georgia', serif", position:'relative', overflow:'hidden' },
  header: { position:'relative', zIndex:2, background: 'linear-gradient(180deg, #3d1500 0%, #1a0800 100%)', padding: '20px 16px 14px', textAlign: 'center', borderBottom: '2px solid #8b4a00', overflow:'hidden' },
  logo: { fontSize: 28, fontWeight: 'bold', letterSpacing: 3, background: 'linear-gradient(180deg, #fff8d0 0%, #ffc200 40%, #ff7700 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', animation:'logoGlow 2s ease-in-out infinite alternate' },
  sub: { fontSize: 11, color: '#c87a30', marginTop: 4, letterSpacing: 2, textTransform:'uppercase' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 16 },
  card: { background: 'linear-gradient(160deg, #2c1600, #1e0e00)', border: '1px solid #6b3a1f', borderTop: '3px solid #d4a85366', borderRadius: 16, padding: '22px 14px 16px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', position: 'relative' },
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
  { id: 'fairyq',        title: 'Friends & Questions',  sub: 'Funny, deep & spicy',     mode: 'Group play'    },
  { id: 'maze',          title: 'Maze Runner 3D',       sub: 'Escape the dark maze',    mode: 'Single player' },
];

const LEADERBOARD_GAMES = GAME_LIST.filter(g => g.id !== 'cafemystery' && g.id !== 'fairyq');

const fmtScore = (gameId, score) => {
  const n = (Number(score) || 0).toLocaleString();
  if (gameId === 'zombie') return `${n} ${Number(score) === 1 ? 'day' : 'days'}`;
  return n;
};

// ─── WEEKLY RESET (resets every Monday 00:00 UTC) ────────────────────────────

function getCurrentWeekStart() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diffToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.getTime();
}

async function deleteOldScores() {
  const weekStart = getCurrentWeekStart();
  const snap = await getDocs(collection(db, 'leaderboard'));
  const toDelete = snap.docs.filter(d => {
    const data = d.data();
    return !data.weekStart || data.weekStart < weekStart;
  });
  await Promise.all(toDelete.map(d => deleteDoc(doc(db, 'leaderboard', d.id))));
}

// ─── AUTH / SCORE HELPERS ────────────────────────────────────────────────────

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
  const weekStart = getCurrentWeekStart();
  const key = `${username}_${gameId}`;
  const ref = doc(db, 'leaderboard', key);
  const snap = await getDoc(ref);
  const isExpired =
    snap.exists() &&
    snap.data().weekStart !== undefined &&
    snap.data().weekStart < weekStart;
  if (!snap.exists() || snap.data().score < score || isExpired) {
    await setDoc(ref, { username, gameId, score, weekStart, updatedAt: serverTimestamp() });
  }
}

async function getLeaderboard(gameId) {
  const weekStart = getCurrentWeekStart();
  const q = query(
    collection(db, 'leaderboard'),
    where('gameId', '==', gameId),
    orderBy('score', 'desc'),
    limit(20)
  );
  const snaps = await getDocs(q);
  return snaps.docs
    .map(d => d.data())
    .filter(d => d.weekStart === weekStart)
    .slice(0, 10);
}

// ─── DATE RANGE (Monday → Sunday) ────────────────────────────────────────────

const _now = new Date();
const _day = _now.getUTCDay();
const _diffToMonday = (_day === 0 ? -6 : 1 - _day);
const _ws = new Date(_now);
_ws.setUTCDate(_now.getUTCDate() + _diffToMonday);
_ws.setUTCHours(0, 0, 0, 0);
const _we = new Date(_ws);
_we.setUTCDate(_ws.getUTCDate() + 6);
const _fmt = d => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
const weeklyDateRange = `${_fmt(_ws)} – ${_fmt(_we)}`;

// ─── FEATURED GAME ────────────────────────────────────────────────────────────

const FEATURED_GAME_WEEKS = LEADERBOARD_GAMES.map(g => g.id);
const FEATURED_WEEK_NUM = Math.floor(getCurrentWeekStart() / (7 * 24 * 60 * 60 * 1000));
const FEATURED_GAME = FEATURED_GAME_WEEKS[FEATURED_WEEK_NUM % FEATURED_GAME_WEEKS.length];
const GAME_NAMES = { snake:'Snake', tetris:'Tetris', racing:'Cafe Racer', flappybarista:'Flappy Barista', zombie:'Zombie Barista', guessword:'Guess the Word', maze:'Maze Runner 3D' };

// ─── MODALS ───────────────────────────────────────────────────────────────────

function AuthModal({ onAuth, onClose }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState(() => { try { return localStorage.getItem('cafeGameUser') || ''; } catch { return ''; } });
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
        <div style={{fontSize:20,fontWeight:'bold',color:'#d4a853',marginBottom:4}}>{mode==='login'?'Welcome Back!':'Join the Cafe'}</div>
        <div style={{fontSize:12,color:'#a07850',marginBottom:20}}>{mode==='login'?'Sign in to track your scores':'Create a unique cafe name'}</div>
        <input style={S.input} placeholder="Username (e.g. Latte)" value={username} onChange={e=>setUsername(e.target.value)} autoCapitalize="none"/>
        <input style={S.input} placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)}/>
        {error && <div style={{color:'#ff6b6b',fontSize:13,marginBottom:8}}>{error}</div>}
        <button style={S.btn()} onClick={handle} disabled={loading}>{loading?'...':mode==='login'?'Sign In':'Create Account'}</button>
        <button style={S.btn('#6b3a1f')} onClick={()=>{setMode(mode==='login'?'register':'login');setError('');}}>{mode==='login'?'New? Create Account':'Already have one? Sign In'}</button>
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
        <input style={S.input} placeholder="Your name..." value={name} onChange={e=>setName(e.target.value)}/>
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
          {LEADERBOARD_GAMES.map(g=>(<button key={g.id} onClick={()=>setTab(g.id)} style={{background:tab===g.id?'#d4a853':'#3d1f00',color:tab===g.id?'#1a0a00':'#d4a853',border:'1px solid #6b3a1f',borderRadius:20,padding:'6px 12px',fontSize:12,cursor:'pointer'}}>{g.title}</button>))}
        </div>
        {loading ? <div style={{color:'#a07850'}}>Loading...</div> : rows.length===0 ?
          <div style={{color:'#a07850',padding:20}}>No scores yet - be the first!</div> :
          rows.map((r,i)=>(<div key={i} style={{...S.lbRow(i),background:r.username===username?'rgba(212,168,83,0.15)':S.lbRow(i).background}}><span style={{width:28,fontSize:18}}>{S.medal(i)}</span><span style={{flex:1,fontWeight:'bold',color:r.username===username?'#d4a853':'#f5e6d0'}}>{r.username}</span><span style={{color:'#8bc34a',fontWeight:'bold'}}>{fmtScore(tab,r.score)}</span>{r.username===username&&<span style={{marginLeft:6,fontSize:11,color:'#d4a853'}}>YOU</span>}</div>))
        }
        <button style={{...S.btn('#6b3a1f'),marginTop:16}} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}


// ─── SNAKE GAME ───────────────────────────────────────────────────────────────

function SnakeGame({ playerName, onScore }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const [score, setScore] = useState(0);
  const [alive, setAlive] = useState(true);
  const W = 340, H = 580, CELL = 12;
  const COLS = Math.floor(W / CELL);
  const ROWS = Math.floor(H / CELL);
  const jsRef = useRef({ cx:70, cy:H-75, r:50, kR:19, kx:0, ky:0, on:false, md:28 });
  const beansRef = useRef([]);
  const spawnBean = () => ({ x:20+Math.random()*(W-40), y:20+Math.random()*(H-120), phase:Math.random()*Math.PI*2, size:3+Math.random()*2, id:Math.random() });
  if (beansRef.current.length===0) for (let i=0;i<8;i++) beansRef.current.push(spawnBean());
  const placeFood = (snake) => { let pos; do { pos={x:1+Math.floor(Math.random()*(COLS-2)),y:1+Math.floor(Math.random()*(ROWS-2))}; } while (snake.some(s=>s.x===pos.x&&s.y===pos.y)); return pos; };
  const startGame = useCallback(() => {
    const cx=Math.floor(COLS/2), cy=Math.floor(ROWS/2);
    stateRef.current = { snake:[{x:cx,y:cy},{x:cx-1,y:cy},{x:cx-2,y:cy},{x:cx-3,y:cy}], dir:{x:1,y:0}, nextDir:{x:1,y:0}, food:{x:cx+5,y:cy}, score:0, frame:0, running:true };
    beansRef.current=[]; for(let i=0;i<8;i++) beansRef.current.push(spawnBean());
    setScore(0); setAlive(true);
  }, [COLS, ROWS]);
  useEffect(() => { startGame(); }, [startGame]);
  const turn = useCallback((dx,dy) => { const g=stateRef.current; if(!g) return; if(dx!== -g.dir.x||dy!== -g.dir.y) g.nextDir={x:dx,y:dy}; }, []);
  const handleJsMove = useCallback((clientX,clientY) => {
    const canvas=canvasRef.current; if(!canvas) return;
    const rect=canvas.getBoundingClientRect();
    const sx=W/rect.width, sy=H/rect.height;
    const mx=(clientX-rect.left)*sx, my=(clientY-rect.top)*sy;
    const js=jsRef.current;
    let dx=mx-js.cx, dy=my-js.cy;
    const dist=Math.sqrt(dx*dx+dy*dy);
    if(dist>js.md){dx=dx/dist*js.md;dy=dy/dist*js.md;}
    js.kx=dx; js.ky=dy;
    const angle=Math.atan2(dy,dx)*180/Math.PI;
    if(Math.abs(dx)>6||Math.abs(dy)>6){
      if(angle>-45&&angle<=45&&stateRef.current?.dir.x!==-1) turn(1,0);
      else if(angle>45&&angle<=135&&stateRef.current?.dir.y!==-1) turn(0,1);
      else if((angle>135||angle<=-135)&&stateRef.current?.dir.x!==1) turn(-1,0);
      else if(angle>-135&&angle<=-45&&stateRef.current?.dir.y!==1) turn(0,-1);
    }
  }, [turn]);
  useEffect(() => {
    const canvas=canvasRef.current; if(!canvas) return;
    const js=jsRef.current;
    const onJS=(mx,my)=>Math.hypot(mx-js.cx,my-js.cy)<js.r*1.4;
    const gp=(cx,cy)=>{const r=canvas.getBoundingClientRect();return[(cx-r.left)*(W/r.width),(cy-r.top)*(H/r.height)];};
    const onTouchStart=e=>{const[mx,my]=gp(e.touches[0].clientX,e.touches[0].clientY);if(onJS(mx,my)){js.on=true;e.preventDefault();}};
    const onTouchMove=e=>{if(js.on){handleJsMove(e.touches[0].clientX,e.touches[0].clientY);e.preventDefault();}};
    const onTouchEnd=()=>{js.on=false;js.kx=0;js.ky=0;};
    const onMouseDown=e=>{const[mx,my]=gp(e.clientX,e.clientY);if(onJS(mx,my))js.on=true;};
    const onMouseMove=e=>{if(js.on)handleJsMove(e.clientX,e.clientY);};
    const onMouseUp=()=>{js.on=false;js.kx=0;js.ky=0;};
    canvas.addEventListener('touchstart',onTouchStart,{passive:false});
    canvas.addEventListener('touchmove',onTouchMove,{passive:false});
    canvas.addEventListener('touchend',onTouchEnd);
    canvas.addEventListener('mousedown',onMouseDown);
    window.addEventListener('mousemove',onMouseMove);
    window.addEventListener('mouseup',onMouseUp);
    return()=>{canvas.removeEventListener('touchstart',onTouchStart);canvas.removeEventListener('touchmove',onTouchMove);canvas.removeEventListener('touchend',onTouchEnd);canvas.removeEventListener('mousedown',onMouseDown);window.removeEventListener('mousemove',onMouseMove);window.removeEventListener('mouseup',onMouseUp);};
  }, [handleJsMove]);
  useEffect(() => {
    const k=e=>{const m={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};if(m[e.key]){e.preventDefault();turn(...m[e.key]);}};
    window.addEventListener('keydown',k); return()=>window.removeEventListener('keydown',k);
  }, [turn]);
  useEffect(() => {
    if(!alive) return;
    const interval=setInterval(()=>{
      const g=stateRef.current; if(!g||!g.running) return;
      g.dir={...g.nextDir};
      const head={x:g.snake[0].x+g.dir.x,y:g.snake[0].y+g.dir.y};
      if(head.x<0||head.x>=COLS||head.y<0||head.y>=ROWS||g.snake.some(s=>s.x===head.x&&s.y===head.y)){g.running=false;onScore(g.score);setAlive(false);return;}
      g.snake.unshift(head);
      if(head.x===g.food.x&&head.y===g.food.y){g.score+=10;setScore(g.score);g.food=placeFood(g.snake);}else g.snake.pop();
    }, Math.max(110,250-Math.floor((stateRef.current?.score||0)/40)*15));
    return()=>clearInterval(interval);
  }, [alive, COLS, ROWS, onScore]);
  useEffect(() => {
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext('2d'); let rafId, fn=0;
    const bgC=document.createElement('canvas'); bgC.width=W; bgC.height=H;
    const bc=bgC.getContext('2d'); bc.fillStyle='#111418'; bc.fillRect(0,0,W,H);
    const hs=24,hh=hs*Math.sqrt(3); bc.strokeStyle='#1a2028'; bc.lineWidth=1;
    for(let row=-1;row<H/hh+2;row++){for(let col=-1;col<W/(hs*1.5)+2;col++){const hcx=col*hs*1.5,hcy=row*hh+(col%2)*hh/2;bc.fillStyle='#131820';bc.beginPath();for(let a=0;a<6;a++){const ang=Math.PI/180*(60*a);bc.lineTo(hcx+hs*0.96*Math.cos(ang),hcy+hs*0.96*Math.sin(ang));}bc.closePath();bc.fill();bc.stroke();}}
    const drawBean=(x,y,size,alpha,glow)=>{ctx.save();ctx.globalAlpha=alpha||1;ctx.shadowColor='#c8943a';ctx.shadowBlur=glow?18:5;const g=ctx.createRadialGradient(x-size*.25,y-size*.25,0,x,y,size);g.addColorStop(0,'#e8b84b');g.addColorStop(.45,'#a06828');g.addColorStop(1,'#3a1a00');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y,size,size*.78,.4,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=size*.2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x-size*.32,y-size*.25);ctx.bezierCurveTo(x+size*.08,y,x-size*.08,y,x+size*.32,y+size*.25);ctx.stroke();ctx.restore();};
    const drawJS=()=>{const js=jsRef.current;ctx.save();ctx.globalAlpha=js.on?.8:.45;ctx.fillStyle='rgba(30,15,0,.88)';ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=10;ctx.beginPath();ctx.arc(js.cx,js.cy,js.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle=`rgba(212,168,83,${js.on?.6:.28})`;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(js.cx,js.cy,js.r,0,Math.PI*2);ctx.stroke();[[0,-1],[0,1],[-1,0],[1,0]].forEach(([dx,dy])=>{const ax=js.cx+dx*(js.r-11),ay=js.cy+dy*(js.r-11);ctx.fillStyle='rgba(212,168,83,.15)';ctx.save();ctx.translate(ax,ay);ctx.rotate(Math.atan2(dy,dx));ctx.beginPath();ctx.moveTo(5,0);ctx.lineTo(-4,-4);ctx.lineTo(-4,4);ctx.closePath();ctx.fill();ctx.restore();});const kpx=js.cx+js.kx,kpy=js.cy+js.ky;const kg=ctx.createRadialGradient(kpx-js.kR*.25,kpy-js.kR*.3,0,kpx,kpy,js.kR);kg.addColorStop(0,'#e8c060');kg.addColorStop(.45,'#c8943a');kg.addColorStop(1,'#4a2800');ctx.fillStyle=kg;ctx.shadowColor='rgba(0,0,0,.6)';ctx.shadowBlur=7;ctx.beginPath();ctx.arc(kpx,kpy,js.kR,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle=`rgba(255,200,80,${js.on?.6:.35})`;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(kpx,kpy,js.kR,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;ctx.restore();};
    const draw=()=>{fn++;const g=stateRef.current;const beans=beansRef.current;ctx.drawImage(bgC,0,0);for(let i=beans.length-1;i>=0;i--){const b=beans[i];if(g&&g.snake.length>0){const hx=g.snake[0].x*CELL+CELL/2,hy=g.snake[0].y*CELL+CELL/2;if(Math.hypot(b.x-hx,b.y-hy)<CELL*.9){g.score+=5;setScore(g.score);beans.splice(i,1);setTimeout(()=>beans.push(spawnBean()),700);continue;}}const p=.78+.18*Math.sin(fn*.05+b.phase);drawBean(b.x,b.y,b.size*p,.85);}if(g){const fp=.88+.12*Math.sin(fn*.1);drawBean(g.food.x*CELL+CELL/2,g.food.y*CELL+CELL/2,8*fp,1,true);if(g.snake.length>1){ctx.save();ctx.lineCap='round';ctx.lineJoin='round';for(let i=g.snake.length-1;i>0;i--){const s=g.snake[i],s2=g.snake[i-1],tt=i/g.snake.length;const tk=Math.max(2,(CELL*.32-tt*CELL*.08)*2);ctx.strokeStyle='rgba(0,0,0,.4)';ctx.lineWidth=tk+2.5;ctx.beginPath();ctx.moveTo(s.x*CELL+CELL/2,s.y*CELL+CELL/2);ctx.lineTo(s2.x*CELL+CELL/2,s2.y*CELL+CELL/2);ctx.stroke();ctx.strokeStyle=`hsl(120,${85-tt*10}%,${44+tt*5}%)`;ctx.lineWidth=tk;ctx.beginPath();ctx.moveTo(s.x*CELL+CELL/2,s.y*CELL+CELL/2);ctx.lineTo(s2.x*CELL+CELL/2,s2.y*CELL+CELL/2);ctx.stroke();ctx.strokeStyle='hsla(120,90%,70%,.35)';ctx.lineWidth=tk*.25;ctx.beginPath();ctx.moveTo(s.x*CELL+CELL/2,s.y*CELL+CELL/2);ctx.lineTo(s2.x*CELL+CELL/2,s2.y*CELL+CELL/2);ctx.stroke();}ctx.restore();}const h=g.snake[0],hpx=h.x*CELL+CELL/2,hpy=h.y*CELL+CELL/2,hr=CELL*.34;ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.arc(hpx+1,hpy+1,hr,0,Math.PI*2);ctx.fill();ctx.fillStyle='hsl(120,85%,42%)';ctx.beginPath();ctx.arc(hpx,hpy,hr,0,Math.PI*2);ctx.fill();ctx.fillStyle='hsla(120,90%,70%,.4)';ctx.beginPath();ctx.arc(hpx-hr*.2,hpy-hr*.22,hr*.45,0,Math.PI*2);ctx.fill();ctx.save();ctx.translate(hpx,hpy);ctx.rotate(Math.atan2(g.dir.y,g.dir.x));[-1,1].forEach(s=>{ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(hr*.35,s*hr*.42,hr*.28,0,Math.PI*2);ctx.fill();ctx.fillStyle='#222';ctx.beginPath();ctx.arc(hr*.42,s*hr*.42,hr*.15,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,255,.8)';ctx.beginPath();ctx.arc(hr*.38,s*hr*.38,hr*.07,0,Math.PI*2);ctx.fill();});ctx.restore();}drawJS();ctx.fillStyle='rgba(0,0,0,.5)';ctx.beginPath();ctx.roundRect(8,8,120,28,8);ctx.fill();ctx.fillStyle='#ffd700';ctx.font='bold 13px Arial';ctx.textAlign='left';ctx.fillText('Score: '+(stateRef.current?.score||0),14,26);if(!alive&&g&&!g.running){ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(0,H/2-44,W,88);ctx.fillStyle='#ff4444';ctx.font='bold 22px Arial';ctx.textAlign='center';ctx.shadowColor='#ff0000';ctx.shadowBlur=20;ctx.fillText('GAME OVER',W/2,H/2-10);ctx.shadowBlur=0;ctx.fillStyle='#ffd700';ctx.font='14px Arial';ctx.fillText('Score: '+(g.score||0),W/2,H/2+18);}rafId=requestAnimationFrame(draw);};
    rafId=requestAnimationFrame(draw); return()=>cancelAnimationFrame(rafId);
  }, [alive, W, H, CELL]);
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


// ─── TETRIS GAME ──────────────────────────────────────────────────────────────

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


// ─── RACING GAME ──────────────────────────────────────────────────────────────

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


// ─── FLAPPY BARISTA ───────────────────────────────────────────────────────────

const KELLY_FACE_B64 = "data:image/jpeg;base64,/9j/4QkhaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJYTVAgQ29yZSA2LjAuMCI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiLz4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gICAgICAgICAgICAgICAgICAgICAgICA8P3hwYWNrZXQgZW5kPSJ3Ij8+AP/tABhQaG90b3Nob3AgMy4wADhCSU0EBAAAAAAAHBwBWgADGyVHHAIAAAIAAhwCeAAMMDIwMDA2MDAwMDAwAP/iAihJQ0NfUFJPRklMRQABAQAAAhhhcHBsBAAAAG1udHJSR0IgWFlaIAfmAAEAAQAAAAAAAGFjc3BBUFBMAAAAAEFQUEwAAAAAAAAAAAAAAAAAAAAAAAD21gABAAAAANMtYXBwbAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARZGVzYwAAAVAAAABiZG1kZAAAAbQAAAAkY3BydAAAAdgAAAAjd3RwdAAAAfwAAAAUclhZWgAAAgAAAAAUZ1hZWgAAA";

const MARYZ_FACE_B64 = "data:image/jpeg;base64,/9j/4QkhaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJYTVAgQ29yZSA2LjAuMCI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiLz4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gICAgICAgICAgICAgICAgICAgICAgICA8P3hwYWNrZXQgZW5kPSJ3Ij8+AP/tABhQaG90b3Nob3AgMy4wADhCSU0EBAAAAAAAHBwBWgADGyVHHAIAAAIAAhwCeAAMMDIwMDA2MDAwMDAwAP/iAihJQ0NfUFJPRklMRQABAQAAAhhhcHBsBAAAAG1udHJSR0IgWFlaIAfmAAEAAQAAAAAAAGFjc3BBUFBMAAAAAEFQUEwAAAAAAAAAAAAAAAAAAAAAAAD21gABAAAAANMtYXBwbAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARZGVzYwAAAVAAAABiZG1kZAAAAbQAAAAkY3BydAAAAdgAAAAjd3RwdAAAAfwAAAAUclhZWgAAAgAAAAAUZ1hZWgAAA";

function FlappyBarista({ playerName, onScore }) {
  const canvasRef = useRef(null);
  const stateRef  = useRef(null);
  const rafRef    = useRef(null);
  const [phase, setPhase]   = useState('idle');
  const [score, setScore]   = useState(0);
  const [best,  setBest]    = useState(() => { try { return parseInt(localStorage.getItem('flappyBest')||'0',10); } catch { return 0; } });
  const W = 340, H = 620;
  const GRAVITY = 0.34, FLAP_VEL = -7.2, PIPE_W = 52, PIPE_INT = 220;
  const flapCoolRef = useRef(0);
  const initState = () => ({ by: H/2, bv: 0, pipes: [], tick: 0, score: 0, running: false });
  useEffect(() => { stateRef.current = initState(); }, []);
  const flap = useCallback(() => {
    const now = Date.now();
    if (now - flapCoolRef.current < 180) return;
    flapCoolRef.current = now;
    const st = stateRef.current; if (!st) return;
    if (phase==='idle') { st.running=true; st.bv=FLAP_VEL; setPhase('playing'); }
    else if (phase==='playing') { st.bv=FLAP_VEL; }
    else if (phase==='dead') { stateRef.current=initState(); setScore(0); setPhase('idle'); }
  }, [phase]);
  useEffect(() => {
    const onKey=e=>{ if(e.code==='Space'||e.code==='ArrowUp'){e.preventDefault();flap();}};
    window.addEventListener('keydown',onKey); return()=>window.removeEventListener('keydown',onKey);
  }, [flap]);
  const drawBarista=(ctx,x,y,angle)=>{ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(0.7,0.7);ctx.fillStyle='#1a0800';ctx.beginPath();ctx.ellipse(0,0,18,20,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d4a853';ctx.fillRect(-9,-6,18,18);ctx.beginPath();ctx.arc(0,-6,9,Math.PI,0);ctx.fill();ctx.fillStyle='#1a0800';ctx.fillRect(-11,-22,22,8);ctx.fillRect(-7,-34,14,13);ctx.fillStyle='#e8b89a';ctx.beginPath();ctx.arc(0,-14,9,0,Math.PI*2);ctx.fill();ctx.fillStyle='#222';ctx.beginPath();ctx.arc(-3,-15,2,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(3,-15,2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#222';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,-11,3,0,Math.PI);ctx.stroke();ctx.fillStyle='#fff';ctx.fillRect(14,-4,12,14);ctx.fillStyle='#c8943a';ctx.fillRect(14,-4,12,4);ctx.strokeStyle='#ccc';ctx.lineWidth=1;ctx.beginPath();ctx.arc(20,0,6,0,Math.PI/2);ctx.stroke();ctx.strokeStyle='rgba(255,255,255,0.6)';ctx.lineWidth=1.5;const tick=stateRef.current?.tick||0;[0,3,6].forEach((off,i)=>{ctx.beginPath();ctx.moveTo(15+i*4,-5);ctx.bezierCurveTo(13+i*4,-10+Math.sin((tick+off)*0.2)*2,17+i*4,-14+Math.sin((tick+off)*0.2)*2,15+i*4,-18);ctx.stroke();});ctx.restore();};
  const drawPipe=(ctx,x,gapY,gapSize=145)=>{const topH=gapY-gapSize/2,botY=gapY+gapSize/2,botH=H-botY;const grad=()=>{const g=ctx.createLinearGradient(x,0,x+PIPE_W,0);g.addColorStop(0,'#2a6b2a');g.addColorStop(0.4,'#4a9a4a');g.addColorStop(0.7,'#3a8a3a');g.addColorStop(1,'#1a4a1a');return g;};ctx.fillStyle=grad();ctx.fillRect(x,0,PIPE_W,topH);ctx.fillStyle='#1a4a1a';ctx.fillRect(x-4,topH-20,PIPE_W+8,20);ctx.fillStyle=grad();ctx.fillRect(x,botY,PIPE_W,botH);ctx.fillStyle='#1a4a1a';ctx.fillRect(x-4,botY,PIPE_W+8,20);ctx.fillStyle='rgba(255,255,255,0.08)';ctx.fillRect(x+4,0,6,topH);ctx.fillRect(x+4,botY+20,6,botH-20);};
  useEffect(() => {
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext('2d');
    const loop=()=>{
      const st=stateRef.current;
      ctx.clearRect(0,0,W,H);
      const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#87ceeb');sky.addColorStop(1,'#c8e6f5');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
      ctx.fillStyle='rgba(255,255,255,0.85)';[[40,80,60],[130,50,45],[230,100,55],[290,60,40]].forEach(([cx,cy,r])=>{ctx.beginPath();ctx.arc(cx+(st?.tick||0)*0.3%W,cy,r*0.6,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(cx+r*0.5+(st?.tick||0)*0.3%W,cy-r*0.2,r*0.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(cx-r*0.4+(st?.tick||0)*0.3%W,cy-r*0.1,r*0.4,0,Math.PI*2);ctx.fill();});
      ctx.fillStyle='#8B6914';ctx.fillRect(0,H-40,W,40);ctx.fillStyle='#5a8a3a';ctx.fillRect(0,H-40,W,8);
      if(!st){rafRef.current=requestAnimationFrame(loop);return;}
      st.tick++;
      if(st.running){
        st.bv+=GRAVITY; st.by+=st.bv;
        const dynSpd=Math.min(1.6+st.score*0.07,3.8);
        const dynGap=Math.max(128,170-st.score*2.1);
        st.dynGap=dynGap;
        const lastPipe=st.pipes[st.pipes.length-1];
        if(!lastPipe||lastPipe.x<W-PIPE_INT) st.pipes.push({x:W,gapY:140+Math.random()*(H-220-140)});
        st.pipes=st.pipes.map(p=>{if(!p.scored&&p.x+PIPE_W<60){p.scored=true;st.score++;setScore(st.score);}return{...p,x:p.x-dynSpd};}).filter(p=>p.x+PIPE_W>0);
        const bx=60,br=11;
        const hit=st.pipes.some(p=>{const inX=bx+br>p.x+4&&bx-br<p.x+PIPE_W-4;const inY=st.by-br<p.gapY-dynGap/2||st.by+br>p.gapY+dynGap/2;return inX&&inY;});
        if(st.by-br<0||st.by+br>H-40||hit){st.running=false;const newBest=Math.max(best,st.score);setBest(newBest);try{localStorage.setItem('flappyBest',String(newBest));}catch{}onScore(st.score);setPhase('dead');}
      }
      const curGap=st.dynGap||170;
      st.pipes.forEach(p=>drawPipe(ctx,p.x,p.gapY,curGap));
      const angle=Math.min(Math.max(st.bv*0.04,-0.4),0.6);
      drawBarista(ctx,60,st.by,angle);
      ctx.fillStyle='rgba(0,0,0,0.35)';ctx.beginPath();ctx.roundRect(W/2-40,14,80,30,8);ctx.fill();ctx.fillStyle='#fff';ctx.font='bold 20px Arial';ctx.textAlign='center';ctx.fillText(st.score,W/2,36);
      if(phase==='idle'||(!st.running&&phase!=='dead')){ctx.fillStyle='rgba(0,0,0,0.45)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#ffd700';ctx.font='bold 28px Arial';ctx.textAlign='center';ctx.fillText('FLAPPY BARISTA',W/2,H/2-50);ctx.fillStyle='#fff';ctx.font='14px Arial';ctx.fillText(playerName,W/2,H/2-20);ctx.fillStyle='#ffcc00';ctx.font='bold 16px Arial';ctx.fillText('TAP  /  SPACE  to flap!',W/2,H/2+20);if(best>0){ctx.fillStyle='#8bc34a';ctx.font='13px Arial';ctx.fillText(`Best: ${best}`,W/2,H/2+50);}}
      if(phase==='dead'){ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#ff4444';ctx.font='bold 26px Arial';ctx.textAlign='center';ctx.fillText('GAME OVER',W/2,H/2-55);ctx.fillStyle='#ffd700';ctx.font='bold 18px Arial';ctx.fillText(`Score: ${st.score}`,W/2,H/2-18);ctx.fillStyle='#8bc34a';ctx.font='15px Arial';ctx.fillText(`Best: ${Math.max(best,st.score)}`,W/2,H/2+14);ctx.fillStyle='#fff';ctx.font='14px Arial';ctx.fillText('Tap to play again',W/2,H/2+50);}
      rafRef.current=requestAnimationFrame(loop);
    };
    rafRef.current=requestAnimationFrame(loop);
    return()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current);};
  }, [phase, playerName, best, onScore]);
  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,alignItems:'center',background:'#87ceeb',overflow:'hidden'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 14px',background:'#1a0800',borderBottom:'1px solid #3d1f00',width:'100%',boxSizing:'border-box',flexShrink:0}}>
        <span style={{fontSize:12,color:'#ffd700',fontWeight:'bold'}}>{playerName}</span>
        <span style={{fontSize:13,color:'#d4a853',fontWeight:'bold',letterSpacing:1}}>FLAPPY BARISTA</span>
        <span style={{fontSize:12,color:'#8bc34a',fontWeight:'bold'}}>Best: {best}</span>
      </div>
      <canvas ref={canvasRef} width={W} height={H} style={{display:'block',maxWidth:'100%',cursor:'pointer',touchAction:'none'}} onClick={flap} onTouchStart={e=>{e.preventDefault();flap();}}/>
    </div>
  );
}


// ─── GUESS THE WORD ───────────────────────────────────────────────────────────

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
  { word:'SAMPAGUITA', hint:'National flower of the Philippines',               category:'PH Plants' },
  { word:'YLANGYLANG', hint:'Fragrant yellow flower used in perfumes',         category:'PH Plants' },
  { word:'NARRA',      hint:'National tree of the Philippines',                category:'PH Plants' },
  { word:'BAMBOO',     hint:'Tall grass used in Philippine crafts',            category:'PH Plants' },
  { word:'MALUNGGAY',  hint:'Moringa tree, Filipino superfood',                category:'PH Plants' },
  { word:'TAMARAW',    hint:'Critically endangered dwarf buffalo of Mindoro',  category:'PH Animals' },
  { word:'TARSIER',    hint:'Tiny big-eyed primate found in Bohol',            category:'PH Animals' },
  { word:'PAWIKAN',    hint:'Sea turtle that nests on Philippine beaches',     category:'PH Animals' },
  { word:'DUGONG',     hint:'Sea cow mammal found in Palawan waters',          category:'PH Animals' },
  { word:'AGILA',      hint:'Philippine Eagle, the national bird',             category:'PH Animals' },
  { word:'KALABAW',    hint:'Water buffalo, national animal of the PH',        category:'PH Animals' },
  { word:'BANGUS',     hint:'National fish of the Philippines, milkfish',      category:'PH Animals' },
  { word:'RIZAL',      hint:'National hero, wrote Noli Me Tangere',            category:'PH History' },
  { word:'KATIPUNAN',  hint:'Secret revolutionary society founded in 1892',    category:'PH History' },
  { word:'AGUINALDO',  hint:'First President of the Philippines',              category:'PH History' },
  { word:'MAGELLAN',   hint:'Portuguese explorer who arrived in PH in 1521',   category:'PH History' },
  { word:'BONIFACIO',  hint:'Supremo of the Katipunan',                        category:'PH History' },
  { word:'INTRAMUROS', hint:'Walled city built by Spanish in Manila',          category:'PH History' },
  { word:'EDSA',       hint:'Highway famous for the 1986 People Power revolt', category:'PH History' },
  { word:'SINIGANG',   hint:'Sour Filipino soup with tamarind broth',          category:'PH Food' },
  { word:'ADOBO',      hint:'Most famous Filipino dish, vinegar and soy',      category:'PH Food' },
  { word:'LECHON',     hint:'Whole roasted pig, centerpiece of fiestas',       category:'PH Food' },
  { word:'PANCIT',     hint:'Filipino noodle dish symbolizing long life',      category:'PH Food' },
  { word:'LUMPIA',     hint:'Filipino spring roll, fried or fresh',            category:'PH Food' },
  { word:'BIBINGKA',   hint:'Rice cake cooked in a clay pot, Christmas food',  category:'PH Food' },
  { word:'BALUT',      hint:'Fertilized duck egg, popular street food',        category:'PH Food' },
  { word:'TINOLA',     hint:'Ginger chicken soup with green papaya',           category:'PH Food' },
  { word:'TOCINO',     hint:'Sweet cured pork, popular breakfast meat',        category:'PH Food' },
  { word:'ILOILO',     hint:'City in Visayas known as the City of Love',       category:'PH Places' },
  { word:'BATANES',    hint:'Northernmost province, stone house island group', category:'PH Places' },
  { word:'PALAWAN',    hint:'Last ecological frontier of the Philippines',     category:'PH Places' },
  { word:'BORACAY',    hint:'Famous white sand beach island in Aklan',         category:'PH Places' },
  { word:'TAGAYTAY',   hint:'Cool highland city overlooking Taal Volcano',     category:'PH Places' },
  { word:'VIGAN',      hint:'UNESCO heritage city with Spanish cobblestones',  category:'PH Places' },
  { word:'CEBU',       hint:'Queen City of the South, oldest city in PH',      category:'PH Places' },
  { word:'BAGUIO',     hint:'Summer capital, City of Pines in Benguet',        category:'PH Places' },
  { word:'TAAL',       hint:'Volcano inside a lake inside a lake, Batangas',   category:'PH Places' },
  { word:'MAYON',      hint:'Most active volcano, perfect cone shape',         category:'PH Places' },
  { word:'TAGALOG',    hint:'Main language of Luzon, basis of Filipino',       category:'PH Culture' },
  { word:'BAYANIHAN',  hint:'Filipino spirit of communal unity and helping',   category:'PH Culture' },
  { word:'JEEPNEY',    hint:'Colorful PH public transport, king of the road',  category:'PH Culture' },
  { word:'TINIKLING',  hint:'Philippine national dance with bamboo poles',     category:'PH Culture' },
  { word:'SINULOG',    hint:'Grand festival in Cebu honoring Santo Nino',      category:'PH Culture' },
  { word:'PAROL',      hint:'Star-shaped Christmas lantern from Pampanga',     category:'PH Culture' },
  { word:'FIESTA',     hint:'Town festival celebrating the patron saint',      category:'PH Culture' },
  { word:'HARANA',     hint:'Traditional Filipino serenade under a window',    category:'PH Culture' },
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
  const [mistakes, setMistakes] = useState(0);
  const [baristaMsg, setBaristaMsg] = useState('wave');
  const [usedWords, setUsedWords] = useState(() => { try { return JSON.parse(localStorage.getItem('gwUsedWords')||'[]'); } catch { return []; } });

  const pickWord = useCallback((used=[]) => {
    const avail = PLAYABLE.filter(w => !used.includes(w.word));
    const list = avail.length > 0 ? avail : PLAYABLE;
    if (avail.length === 0) { try { localStorage.removeItem('gwUsedWords'); } catch {} }
    setWordData(list[Math.floor(Math.random()*list.length)]);
    setGuesses([]); setCurrent(''); setGameState('playing'); setMistakes(0); setBaristaMsg('wave');
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
    if (current.length !== WL) { setShake(true); setTimeout(()=>setShake(false),500); return; }
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
      setScore(s => Math.max(0, s - 15));
      setMistakes(newMistakes); setBaristaMsg('fight');
      if (newMistakes >= MAX_MISTAKES) { setGameState('lost'); setBaristaMsg('sad'); setStreak(0); setScore(0); onScore(0); }
      else { setTimeout(()=>{ setBaristaMsg(newMistakes===MAX_MISTAKES-1?'sad':'wave'); },700); }
    }
  };

  const pressKey = (key) => {
    if (gameState !== 'playing') return;
    if (key === 'ENTER') { submitGuess(); return; }
    if (key === 'DEL') { setCurrent(c=>c.slice(0,-1)); return; }
    if (current.length < WL) setCurrent(c => c + key);
  };

  useEffect(() => {
    const k = e => {
      if (gameState !== 'playing') return;
      if (e.key === 'Enter') { e.preventDefault(); submitGuess(); }
      else if (e.key === 'Backspace') setCurrent(c => c.slice(0,-1));
      else if (/^[a-zA-Z]$/.test(e.key) && current.length < WL) setCurrent(c => c + e.key.toUpperCase());
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [current, gameState, word, WL, mistakes]);

  const nextRound = () => {
    const nu = [...usedWords, word];
    setUsedWords(nu); try { localStorage.setItem('gwUsedWords', JSON.stringify(nu)); } catch {}
    setRound(r => r + 1); pickWord(nu);
  };

  const tileColors = { correct:{bg:'#538d4e',border:'#538d4e',color:'#fff'}, present:{bg:'#b59f3b',border:'#b59f3b',color:'#fff'}, absent:{bg:'#3a3a3c',border:'#3a3a3c',color:'#fff'}, empty:{bg:'transparent',border:'#3a3a3c',color:'#fff'}, active:{bg:'transparent',border:'#999',color:'#fff'} };
  const keyColors = { correct:{bg:'#538d4e',color:'#fff'}, present:{bg:'#b59f3b',color:'#fff'}, absent:{bg:'#3a3a3c',color:'#fff'}, unused:{bg:'#6b3a1f',color:'#d4a853'} };
  const TILE_SIZE = Math.min(46, Math.floor((Math.min(typeof window !== 'undefined' ? window.innerWidth : 390, 400) - 48) / Math.max(WL, 5)));
  const msgMap = { wave:{text:'Guess the word!',color:'#ffd700'}, fight:{text:mistakes>=MAX_MISTAKES-1?'Last chance! -15pts':'WRONG! -15pts',color:mistakes>=MAX_MISTAKES-1?'#ff8800':'#ff4444'}, cheer:{text:'CORRECT!',color:'#44ff88'}, sad:{text:'Game Over!',color:'#888'} };
  const msg = msgMap[baristaMsg] || msgMap.wave;

  if (!wordData) return <div style={{color:'#d4a853',textAlign:'center',padding:40}}>Loading...</div>;

  return (
    <div style={{height:'100%',background:'#121213',color:'#fff',display:'flex',flexDirection:'column',fontFamily:"'Arial',sans-serif",overflow:'hidden'}}>
      <div style={{background:'#1a1a1b',borderBottom:'1px solid #3a3a3c',padding:'7px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{fontSize:11,color:'#818384'}}>Round <b style={{color:'#d4a853'}}>{round}</b></div>
        <div style={{fontSize:13,fontWeight:'bold',color:'#d4a853',letterSpacing:2}}>GUESS THE WORD</div>
        <div style={{fontSize:11,color:'#818384'}}><b style={{color:'#d4a853'}}>{score}</b>{streak>0&&<span style={{color:'#ff8800'}}> 🔥{streak}</span>}</div>
      </div>
      <div style={{background:'#1e0e00',borderBottom:'1px solid #3d1f00',padding:'8px 16px',flexShrink:0,textAlign:'center'}}>
        <div style={{fontSize:10,color:'#6b3a1f',marginBottom:2,textTransform:'uppercase',letterSpacing:1}}>Description</div>
        <div style={{fontSize:14,color:'#f5e6d0',fontStyle:'italic',lineHeight:1.4}}>"{wordData.hint}"</div>
        <div style={{fontSize:10,color:'#6b3a1f',marginTop:2}}>{wordData.category} · {WL} letters</div>
      </div>
      <div style={{background:'#1a0800',borderBottom:'2px solid #3d1f00',padding:'4px 8px',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between',gap:6}}>
        <div style={{flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:1}}>
          <div style={{width:42,height:42,borderRadius:'50%',overflow:'hidden',border:'2px solid #d4a853',background:'#3d1f00',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>👩</div>
          <span style={{fontSize:9,color:'#c8943a',fontWeight:'bold'}}>KELLY</span>
        </div>
        <div style={{flex:1,textAlign:'center'}}>
          <div style={{display:'flex',justifyContent:'center',gap:5,marginBottom:3}}>
            {Array.from({length:MAX_MISTAKES}).map((_,i)=>(<div key={i} style={{width:16,height:16,borderRadius:3,background:i<mistakes?'#ff4444':'#538d4e',border:`1px solid ${i<mistakes?'#ff2222':'#3a6a3a'}`,fontSize:10,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:'bold'}}>{i<mistakes?'X':''}</div>))}
          </div>
          <div style={{fontSize:13,fontWeight:'bold',color:msg.color}}>{msg.text}</div>
        </div>
        <div style={{flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:1}}>
          <div style={{width:42,height:42,borderRadius:'50%',overflow:'hidden',border:'2px solid #d4a853',background:'#3d1f00',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>👩‍🦱</div>
          <span style={{fontSize:9,color:'#c8943a',fontWeight:'bold'}}>MARYZ</span>
        </div>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'8px 0',gap:5,overflowY:'auto'}}>
        {Array.from({length:gameState==='playing'?guesses.length+1:guesses.length}).map((_,rowIdx)=>{
          const guess=guesses[rowIdx]; const isActive=rowIdx===guesses.length&&gameState==='playing';
          const displayWord=isActive?current:(guess||''); const isShaking=isActive&&shake; const isWrong=guess&&guess!==word;
          return (<div key={rowIdx} style={{display:'flex',gap:5,animation:isShaking?'shake 0.4s ease':'none',opacity:isWrong?0.75:1}}>
            {Array.from({length:WL}).map((_,colIdx)=>{
              const letter=displayWord[colIdx]||''; let state='empty';
              if(guess) state=getTileState(guess,colIdx); else if(isActive&&letter) state='active';
              const c=tileColors[state];
              return (<div key={colIdx} style={{width:TILE_SIZE,height:TILE_SIZE,background:c.bg,border:`2px solid ${c.border}`,borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:Math.round(TILE_SIZE*0.46),fontWeight:'bold',color:c.color,transition:guess?`background 0.3s ${colIdx*0.1}s`:'border-color 0.1s',transform:isActive&&letter&&colIdx===current.length-1?'scale(1.12)':'scale(1)',userSelect:'none',textTransform:'uppercase'}}>{letter}</div>);
            })}
          </div>);
        })}
      </div>
      {gameState==='won'&&(<div style={{textAlign:'center',padding:'14px 14px 16px',background:'#0a1f0a',borderTop:'2px solid #44ff88',flexShrink:0}}>
        <div style={{fontSize:22,fontWeight:'bold',color:'#44ff88',marginBottom:6}}>{mistakes===0?'PERFECT!!':mistakes===1?'GREAT!':'GOT IT!'}</div>
        <div style={{fontSize:13,color:'#ffd700',marginBottom:10}}>+{Math.max(10,100-mistakes*20)+streak*15} pts{streak>1?` · ${streak}x streak`:''}</div>
        <button onClick={nextRound} style={{background:'#44cc66',border:'none',borderRadius:12,padding:'11px 32px',color:'#fff',fontWeight:'bold',fontSize:15,cursor:'pointer'}}>Next Word</button>
      </div>)}
      {gameState==='lost'&&(<div style={{position:'fixed',inset:0,background:'rgba(10,4,0,0.82)',zIndex:400,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{background:'linear-gradient(160deg,#2a0a0a,#1a0000)',border:'2px solid #ff4444',borderRadius:24,padding:'36px 28px 28px',width:290,textAlign:'center'}}>
          <div style={{display:'flex',justifyContent:'center',gap:8,marginBottom:14}}>{Array.from({length:MAX_MISTAKES}).map((_,i)=>(<div key={i} style={{width:28,height:28,borderRadius:6,background:'#ff4444',border:'1.5px solid #ff2222',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:'bold',color:'#fff'}}>X</div>))}</div>
          <div style={{fontSize:30,fontWeight:800,color:'#ff4444',marginBottom:6}}>GAME OVER!</div>
          <div style={{fontSize:14,color:'#f5e6d0',marginBottom:4}}>The word was</div>
          <div style={{fontSize:22,fontWeight:800,color:'#ffd700',marginBottom:6,letterSpacing:2}}>"{word}"</div>
          <div style={{fontSize:12,color:'#a07850',marginBottom:20}}>Score reset to 0</div>
          <button onClick={()=>{setScore(0);setStreak(0);nextRound();}} style={{width:'100%',padding:'14px',background:'linear-gradient(135deg,#d4a853,#ffd700)',border:'none',borderRadius:14,color:'#1a0800',fontSize:16,fontWeight:800,cursor:'pointer'}}>Want to Try Again?</button>
        </div>
      </div>)}
      <div style={{background:'#2a1400',borderTop:'1px solid #3d1f00',padding:'8px 4px 14px',flexShrink:0}}>
        {KEYBOARD_ROWS.map((row,ri)=>(
          <div key={ri} style={{display:'flex',justifyContent:'center',gap:5,marginBottom:6}}>
            {ri===2&&<button onPointerDown={e=>{e.preventDefault();pressKey('ENTER');}} style={{background:'#818384',border:'none',borderRadius:6,padding:'16px 8px',color:'#fff',fontSize:11,fontWeight:'bold',cursor:'pointer',minWidth:44,userSelect:'none'}}>ENTER</button>}
            {row.split('').map(l=>{const ks=keyColors[getKeyState(l)];return(<button key={l} onPointerDown={e=>{e.preventDefault();pressKey(l);}} style={{background:ks.bg,border:'none',borderRadius:6,padding:'16px 0',color:ks.color,fontSize:15,fontWeight:'bold',cursor:'pointer',width:30,userSelect:'none',transition:'background 0.2s'}}>{l}</button>);})}
            {ri===2&&<button onPointerDown={e=>{e.preventDefault();pressKey('DEL');}} style={{background:'#818384',border:'none',borderRadius:6,padding:'16px 8px',color:'#fff',fontSize:13,fontWeight:'bold',cursor:'pointer',minWidth:44,userSelect:'none'}}>DEL</button>}
          </div>
        ))}
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}`}</style>
    </div>
  );
}


// ─── FRIENDS & QUESTIONS ─────────────────────────────────────────────────────

const FAIRY_QUESTIONS = [
  { text:"If your life had a theme song, what would it be and why?", tag:"deep" },
  { text:"What is one thing you would never eat even if someone paid you?", tag:"funny" },
  { text:"If you could only eat one food for the rest of your life, what would it be?", tag:"funny" },
  { text:"What is your biggest fear that most people would laugh at?", tag:"deep" },
  { text:"If you woke up tomorrow with one superpower, what would you choose?", tag:"funny" },
  { text:"What is the most embarrassing thing you have done in public?", tag:"funny" },
  { text:"If you could relive one day of your life, which would it be?", tag:"deep" },
  { text:"What would you do first if you won a million pesos?", tag:"funny" },
  { text:"Who in this group would survive a zombie apocalypse the longest?", tag:"funny" },
  { text:"What is one thing you thought you were good at but actually are not?", tag:"funny" },
  { text:"If you had to describe yourself as a food, what would you be?", tag:"funny" },
  { text:"What is the worst advice you have ever given someone?", tag:"funny" },
  { text:"What is something you do when no one is watching?", tag:"spicy" },
  { text:"If you could trade lives with anyone in this room for a day, who would it be?", tag:"spicy" },
  { text:"What is the most childish thing you still do?", tag:"funny" },
  { text:"Have you ever pretended to not see someone in public to avoid talking to them?", tag:"spicy" },
  { text:"What is one thing on your bucket list that surprises people?", tag:"deep" },
  { text:"If animals could talk, which one do you think would be the rudest?", tag:"funny" },
  { text:"What is a guilty pleasure you are embarrassed to admit?", tag:"spicy" },
  { text:"If you had to wear one outfit for the rest of your life, what would it be?", tag:"funny" },
  { text:"What is the most random skill you have that no one knows about?", tag:"deep" },
  { text:"Who in this group is most likely to become famous?", tag:"funny" },
  { text:"What is the most spontaneous thing you have ever done?", tag:"deep" },
  { text:"If you were a villain in a movie, what would your evil plan be?", tag:"funny" },
  { text:"What is something you believed as a child that turned out to be completely wrong?", tag:"funny" },
  { text:"If you could only keep three apps on your phone, which would they be?", tag:"funny" },
  { text:"What is the weirdest dream you can remember?", tag:"funny" },
  { text:"If you were stuck on a deserted island with one person in this group, who would you pick?", tag:"spicy" },
  { text:"What is one thing you would change about yourself if you could?", tag:"deep" },
  { text:"If your personality was a weather forecast, what would today's forecast be?", tag:"funny" },
];

const FAIRY_CATEGORIES = [
  { id:"all",   label:"All questions", icon:"✦" },
  { id:"funny", label:"Funny only",    icon:"😄" },
  { id:"deep",  label:"Deep only",     icon:"🌙" },
  { id:"spicy", label:"Spicy only",    icon:"🔥" },
];

const FAIRY_TAG_COLORS = {
  deep:  { bg:"#3d1060", color:"#d48fff", label:"Thoughtful" },
  funny: { bg:"#1a3060", color:"#8fc8ff", label:"Funny"      },
  spicy: { bg:"#601020", color:"#ffb0b0", label:"Spicy"      },
};

function shuffleArr(arr) { return [...arr].sort(()=>Math.random()-0.5); }

function FairyQGame({ playerName, onBack }) {
  const [screen, setScreen] = useState("intro");
  const [category, setCategory] = useState("all");
  const [questions, setQuestions] = useState([]);
  const [qIdx, setQIdx] = useState(0);
  const [skipped, setSkipped] = useState(0);

  const startGame = (cat) => {
    const pool = FAIRY_QUESTIONS.filter(q => cat==="all" || q.tag===cat);
    setQuestions(shuffleArr(pool).slice(0,15));
    setCategory(cat); setQIdx(0); setSkipped(0); setScreen("game");
  };

  const nextQ = (skip) => {
    if (skip) setSkipped(s=>s+1);
    if (qIdx+1 >= questions.length) { setScreen("done"); }
    else { setQIdx(i=>i+1); }
  };

  const C = { bg:"#1a0530", card:"#2d0a50", cardBorder:"#7a3db5", softBorder:"#4a2070", purple:"#9455d0", purpleDim:"#7a3db5", textPrimary:"#f0c6ff", textMuted:"#c48de8", textDim:"#7a5090" };
  const btnPrimary = { width:"100%", padding:"14px", borderRadius:14, background:C.purpleDim, border:"none", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer", marginTop:4, fontFamily:"inherit" };
  const btnSecondary = { width:"100%", padding:"10px", borderRadius:14, background:"transparent", border:`1.5px solid ${C.softBorder}`, color:C.textDim, fontSize:13, fontWeight:600, cursor:"pointer", marginTop:8, fontFamily:"inherit" };
  const topBar = { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", background:"#12022a", borderBottom:`1px solid ${C.softBorder}`, flexShrink:0 };
  const base = { minHeight:"100%", background:C.bg, color:C.textPrimary, fontFamily:"'Georgia', serif", display:"flex", flexDirection:"column" };

  if (screen==="intro") {
    return (
      <div style={base}>
        <div style={topBar}>
          <button onClick={onBack} style={{background:C.card,border:`1px solid ${C.softBorder}`,borderRadius:20,padding:"6px 14px",color:C.textMuted,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Exit</button>
          <span style={{fontSize:14,fontWeight:700,color:C.textPrimary,letterSpacing:1}}>Friends & Questions</span>
          <div style={{width:60}}/>
        </div>
        <div style={{flex:1,padding:"28px 20px 24px",overflowY:"auto"}}>
          <div style={{textAlign:"center",fontSize:52,marginBottom:4}}>✨</div>
          <div style={{fontSize:24,fontWeight:700,color:C.textPrimary,textAlign:"center",marginBottom:4}}>Friends & Questions</div>
          <div style={{fontSize:13,color:C.textMuted,textAlign:"center",marginBottom:22}}>A magical game of laughs, spice & deep thoughts</div>
          <div style={{background:C.card,border:`1.5px solid ${C.softBorder}`,borderRadius:16,padding:"16px 14px",marginBottom:18}}>
            <div style={{fontSize:11,color:"#b06adf",fontWeight:700,letterSpacing:1.2,textTransform:"uppercase",marginBottom:12}}>Choose a vibe</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {FAIRY_CATEGORIES.map(cat=>(
                <button key={cat.id} onClick={()=>startGame(cat.id)} style={{padding:"16px 10px",borderRadius:14,border:`1.5px solid ${C.softBorder}`,background:C.bg,color:C.textPrimary,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}>
                  <span style={{fontSize:26,display:"block",marginBottom:6}}>{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{fontSize:12,color:C.textDim,textAlign:"center"}}>30 questions - answer together - no right or wrong</div>
        </div>
      </div>
    );
  }

  if (screen==="game") {
    const q = questions[qIdx];
    const tc = FAIRY_TAG_COLORS[q.tag] || FAIRY_TAG_COLORS.funny;
    const prog = Math.round((qIdx/questions.length)*100);
    return (
      <div style={base}>
        <div style={topBar}>
          <button onClick={onBack} style={{background:C.card,border:`1px solid ${C.softBorder}`,borderRadius:20,padding:"6px 14px",color:C.textMuted,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Exit</button>
          <span style={{fontSize:13,fontWeight:700,color:C.textPrimary}}>{qIdx+1} / {questions.length}</span>
          <div style={{width:60}}/>
        </div>
        <div style={{height:4,background:C.card}}><div style={{height:"100%",width:`${prog}%`,background:C.purple,transition:"width 0.4s"}}/></div>
        <div style={{flex:1,padding:"20px 18px 24px",overflowY:"auto",display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
            <span style={{fontSize:11,color:C.textDim,fontWeight:700}}>Question {qIdx+1}</span>
            <span style={{fontSize:11,color:C.textDim}}>{skipped} skipped</span>
          </div>
          <div style={{background:C.card,border:`1.5px solid ${C.cardBorder}`,borderRadius:18,padding:"22px 18px",flex:1,display:"flex",flexDirection:"column",justifyContent:"center",marginBottom:16}}>
            <div style={{fontSize:20,fontWeight:700,color:C.textPrimary,lineHeight:1.55,marginBottom:14}}>{q.text}</div>
            <div style={{display:"inline-block",background:tc.bg,color:tc.color,borderRadius:20,padding:"4px 12px",fontSize:11,fontWeight:700}}>{tc.label}</div>
          </div>
          <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:14,flexWrap:"wrap"}}>
            {questions.map((_,i)=>(<div key={i} style={{width:8,height:8,borderRadius:"50%",background:i<qIdx?C.purple:C.softBorder,transition:"background 0.3s"}}/>))}
          </div>
          <button style={btnPrimary} onClick={()=>nextQ(false)}>Next question ✨</button>
          <button style={btnSecondary} onClick={()=>nextQ(true)}>Skip this one</button>
        </div>
      </div>
    );
  }

  return (
    <div style={base}>
      <div style={topBar}>
        <button onClick={onBack} style={{background:C.card,border:`1px solid ${C.softBorder}`,borderRadius:20,padding:"6px 14px",color:C.textMuted,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Exit</button>
        <span style={{fontSize:14,fontWeight:700,color:C.textPrimary}}>Done!</span>
        <div style={{width:60}}/>
      </div>
      <div style={{flex:1,padding:"32px 20px 28px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontSize:56,marginBottom:8}}>🌟</div>
        <div style={{fontSize:22,fontWeight:700,color:C.textPrimary,textAlign:"center",marginBottom:8}}>All done, fairies!</div>
        <div style={{fontSize:14,color:C.textMuted,textAlign:"center",lineHeight:1.6,marginBottom:28}}>You answered {questions.length-skipped} questions<br/>and skipped {skipped}.</div>
        <button style={{...btnPrimary,maxWidth:280}} onClick={()=>startGame(category)}>Play again ✨</button>
        <button style={{...btnSecondary,maxWidth:280}} onClick={()=>setScreen("intro")}>Change vibe</button>
      </div>
    </div>
  );
}



// ─── MAZE RUNNER 3D ───────────────────────────────────────────────────────────

function MazeGame({ onScore }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.data && e.data.type === 'MAZE_SCORE') {
        onScore(e.data.score);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onScore]);

  return (
    <iframe
      src="https://63fc9f4d-de57-4e56-86d0-2d7c8c75273c-00-1xy9zyge2ykdb.pike.replit.dev/"
      style={{ flex: 1, border: 'none', width: '100%', height: '100%', display: 'block' }}
      allow="pointer-lock"
      title="Maze Runner 3D"
    />
  );
}

// ─── MAIN GAMES PAGE ─────────────────────────────────────────────────────────

const FEATURED_GAME_WEEKS_LB = LEADERBOARD_GAMES.map(g => g.id);

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
    if (!activeGame && musicOn) { audio.play().catch(()=>{}); }
    else { audio.pause(); }
    return () => { audio.pause(); };
  }, [activeGame, musicOn]);

  // ── Weekly reset on every Monday ──────────────────────────────────────────
  useEffect(() => {
    // Delete old Firestore scores
    deleteOldScores().catch(console.error);
    // Reset localStorage if the week has changed
    const storedWeek = localStorage.getItem('cafeWeekStart');
    const currentWeek = String(getCurrentWeekStart());
    if (storedWeek !== currentWeek) {
      localStorage.setItem('cafeWeekStart', currentWeek);
      localStorage.removeItem('cafeBests');
      localStorage.removeItem('flappyBest');
      localStorage.removeItem('gwUsedWords');
      setLocalBests({});
    }
  }, []);

  const [username, setUsername] = useState(() => { try { return localStorage.getItem('cafeGameUser') || null; } catch { return null; } });
  const [showName, setShowName] = useState(false);
  const [pendingGame, setPendingGame] = useState(null);
  const [playerName, setPlayerName] = useState(() => { try { return localStorage.getItem('cafePlayerName') || ''; } catch { return ''; } });
  const [localBests, setLocalBests] = useState(() => { try { return JSON.parse(localStorage.getItem('cafeBests') || '{}'); } catch { return {}; } });
  const [lbGame, setLbGame] = useState(FEATURED_GAME);
  const [lbRows, setLbRows] = useState([]);
  const [lbLoading, setLbLoading] = useState(true);
  const [featuredLeader, setFeaturedLeader] = useState(null);

  useEffect(() => {
    const fetchLB = async () => {
      setLbLoading(true);
      try {
        const snap = await getDocs(collection(db, 'leaderboard'));
        const all = snap.docs.map(d => d.data());
        const weekStart = getCurrentWeekStart();
        const filtered = all.filter(d => d.gameId===lbGame && d.weekStart===weekStart).sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,10);
        setLbRows(filtered);
        const fl = all.filter(d => d.gameId===FEATURED_GAME && d.weekStart===weekStart).sort((a,b)=>(b.score||0)-(a.score||0))[0] || null;
        setFeaturedLeader(fl);
      } catch(e) { setLbRows([]); }
      setLbLoading(false);
    };
    fetchLB();
  }, [lbGame]);

  const saveLocal = (gameId, score) => {
    setLocalBests(prev => {
      const upd = {...prev, [gameId]: Math.max(prev[gameId]||0, score)};
      try { localStorage.setItem('cafeBests', JSON.stringify(upd)); } catch {}
      return upd;
    });
  };

  const handleGameSelect = (game) => {
    if (game.id==='cafemystery' || game.id==='zombie' || game.id==='fairyq' || game.id==='maze') { setActiveGame(game); return; }
    setPendingGame(game); setShowName(true);
  };
  const handleNameStart = (name) => {
    setPlayerName(name); try { localStorage.setItem('cafePlayerName', name); } catch {}
    setShowName(false); setActiveGame(pendingGame);
  };
  const handleScore = async (gameId, score) => {
    saveLocal(gameId, score);
    if (username && score > 0) { try { await saveScore(username, gameId, score); } catch(e) {} }
  };
  const handleAuth = (user) => {
    setUsername(user); try { localStorage.setItem('cafeGameUser', user); } catch {}
    setShowAuth(false);
  };
  const handleLogout = () => {
    setUsername(null); try { localStorage.removeItem('cafeGameUser'); } catch {}
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
          {activeGame.id==='snake'         && <SnakeGame        playerName={playerName} onScore={s=>handleScore('snake',s)}/>}
          {activeGame.id==='tetris'        && <TetrisGame       playerName={playerName} onScore={s=>handleScore('tetris',s)}/>}
          {activeGame.id==='racing'        && <RacingGame       playerName={playerName} onScore={s=>handleScore('racing',s)}/>}
          {activeGame.id==='flappybarista' && <FlappyBarista    playerName={playerName} onScore={s=>handleScore('flappybarista',s)}/>}
          {activeGame.id==='zombie'        && <ZombieGame       playerName={playerName} username={username} onScore={s=>handleScore('zombie',s)} onBack={()=>setActiveGame(null)}/>}
          {activeGame.id==='guessword'     && <GuessWordGame    playerName={playerName} onScore={s=>handleScore('guessword',s)}/>}
          {activeGame.id==='cafemystery'   && <CafeGame         playerName={playerName} onBack={()=>setActiveGame(null)}/>}
          {activeGame.id==='fairyq'        && <FairyQGame       playerName={playerName} onBack={()=>setActiveGame(null)}/>}
          {activeGame.id==='maze'           && <MazeGame          onScore={s=>handleScore('maze',s)}/>}
        </div>
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      {showAuth   && <AuthModal onAuth={handleAuth} onClose={()=>setShowAuth(false)}/>}
      {showName && pendingGame && <NameModal gameTitle={pendingGame.title} username={username} onStart={handleNameStart} onClose={()=>setShowName(false)}/>}
      {showLB     && <LeaderboardModal onClose={()=>setShowLB(false)} username={username}/>}

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
          {musicOn?'🔊':'🔇'}
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

      {/* Ticker */}
      <div style={{overflow:'hidden',height:22,display:'flex',alignItems:'center',background:'#ffd700',position:'relative',zIndex:2}}>
        <div style={{display:'flex',whiteSpace:'nowrap',animation:'lbTicker 16s linear infinite',fontSize:10,fontWeight:700,color:'#1a0800',letterSpacing:0.8}}>
          {[1,2].map(i=>(<span key={i} style={{padding:'0 28px'}}>TOP SCORER THIS WEEK WINS 1 FREE DRINK &nbsp;★&nbsp; REGISTER TO SAVE SCORES &nbsp;★&nbsp;</span>))}
        </div>
      </div>

      {/* Inline Leaderboard */}
      <div style={{background:'linear-gradient(180deg,#120800,#0a0400)',padding:'10px 12px 14px',position:'relative',zIndex:2}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:16,animation:'crownSpin 2.5s ease-in-out infinite',display:'inline-block'}}>🏆</span>
            <span style={{fontSize:12,fontWeight:700,background:'linear-gradient(90deg,#ffd700,#fff8cc,#ffaa00,#ffd700)',backgroundSize:'200% auto',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',animation:'shimmerLB 2s linear infinite'}}>HALL OF FAME</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:'#44ff88',display:'inline-block',animation:'lbPulse 1.2s infinite'}}/>
            <span style={{fontSize:9,color:'#c8943a',fontWeight:700}}>Live · Resets Monday</span>
          </div>
        </div>

        {/* Weekly prize */}
        <div style={{background:'#1a0d00',border:'1px solid #ffd70033',borderRadius:10,padding:'7px 10px',marginBottom:8,display:'flex',alignItems:'center',gap:9}}>
          <span style={{fontSize:28,animation:'floatLB 2.5s ease-in-out infinite',display:'inline-block'}}>☕</span>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:1}}>
              <span style={{background:'#ffd700',borderRadius:4,padding:'1px 6px',fontSize:8,fontWeight:700,color:'#1a0800'}}>THIS WEEK</span>
              <span style={{fontSize:9,color:'#5a3a10'}}>{weeklyDateRange}</span>
            </div>
            <div style={{fontSize:11,fontWeight:700,color:'#f5e6d0'}}>Top scorer in <span style={{color:'#ffd700'}}>{GAME_NAMES[FEATURED_GAME]}</span></div>
            <div style={{fontSize:9,color:'#a07030'}}>wins <span style={{color:'#ffd700',fontWeight:700}}>1 FREE DRINK</span></div>
          </div>
          {featuredLeader ? (
            <div style={{textAlign:'center',flexShrink:0}}>
              <div style={{width:28,height:28,borderRadius:'50%',background:'#2a1400',border:'2px solid #ffd700',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'#ffd700',margin:'0 auto 2px'}}>{featuredLeader.username.slice(0,2).toUpperCase()}</div>
              <div style={{fontSize:9,color:'#ffd700',fontWeight:700,maxWidth:52,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{featuredLeader.username}</div>
              <div style={{fontSize:8,color:'#7a5020'}}>{fmtScore(FEATURED_GAME,featuredLeader.score)}</div>
            </div>
          ) : (
            <div style={{fontSize:9,color:'#4a3010',textAlign:'center',maxWidth:60}}>No scores yet!</div>
          )}
        </div>

        {/* Game tabs */}
        <div style={{display:'flex',overflowX:'auto',background:'#100600',borderRadius:8,padding:'0 4px',gap:1,scrollbarWidth:'none',marginBottom:8,justifyContent:'center'}}>
          {LEADERBOARD_GAMES.map(g=>(
            <button key={g.id} onClick={()=>setLbGame(g.id)} style={{flexShrink:0,padding:'6px 11px',border:'none',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:'inherit',transition:'all 0.15s',borderBottom:`2px solid ${lbGame===g.id?'#ffe066':'transparent'}`,background:lbGame===g.id?'linear-gradient(180deg,#c8943a,#9a6010)':'transparent',color:lbGame===g.id?'#1a0800':'#6a4820'}}>
              {g.title.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Podium top 3 */}
        {lbLoading ? (
          <div style={{textAlign:'center',color:'#4a3010',fontSize:11,padding:'16px 0'}}>Loading...</div>
        ) : (
          <>
            <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center',gap:5,marginBottom:8}}>
              {[1,0,2].map((rankIdx)=>{
                const p=lbRows[rankIdx];
                const mc=['#ffd700','#c8d0dc','#cd7f32'][rankIdx];
                const mg=['#ffd70099','#c0c0c066','#cd7f3266'][rankIdx];
                const isFirst=rankIdx===0;
                const ph=[56,40,32][rankIdx];
                return (
                  <div key={rankIdx} style={{display:'flex',flexDirection:'column',alignItems:'center',flex:1,maxWidth:100,animation:`floatLB ${1.4+rankIdx*0.3}s ease-in-out infinite`}}>
                    {isFirst?<span style={{fontSize:14,marginBottom:1}}>👑</span>:<div style={{height:17}}/>}
                    <div style={{width:isFirst?34:26,height:isFirst?34:26,borderRadius:'50%',background:'#2a1400',border:`2px solid ${mc}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:isFirst?11:9,fontWeight:700,color:mc,flexShrink:0,boxShadow:`0 0 5px ${mg}`}}>{p?p.username.slice(0,2).toUpperCase():'?'}</div>
                    <div style={{fontSize:isFirst?10:9,fontWeight:700,color:'#f0ddb0',margin:'3px 0 1px',maxWidth:86,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p?p.username:'---'}</div>
                    <div style={{fontSize:isFirst?11:10,fontWeight:700,color:mc,marginBottom:3}}>{p?fmtScore(lbGame,p.score):'---'}</div>
                    <div style={{width:'100%',height:ph,background:`${mc}12`,border:`1px solid ${mc}44`,borderBottom:'none',borderRadius:'5px 5px 0 0',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <span style={{fontSize:14,fontWeight:700,color:mc,opacity:0.7}}>{rankIdx===0?'1':rankIdx===1?'2':'3'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {lbRows.slice(3).map((p,idx)=>(
              <div key={idx} style={{display:'flex',alignItems:'center',gap:7,padding:'5px 8px',background:idx%2===0?'#1a0e00':'#120800',borderRadius:7,marginBottom:3,border:'0.5px solid #2a1400'}}>
                <div style={{width:14,fontSize:10,fontWeight:700,color:'#4a3010',textAlign:'center'}}>{idx+4}</div>
                <div style={{width:22,height:22,borderRadius:'50%',background:'#2a1400',border:'1.5px solid #5a3a10',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'#c8943a',flexShrink:0}}>{p.username.slice(0,2).toUpperCase()}</div>
                <div style={{flex:1,fontSize:11,fontWeight:700,color:'#c89050'}}>{p.username}</div>
                <div style={{fontSize:11,fontWeight:700,color:'#ffd700'}}>{fmtScore(lbGame,p.score)}</div>
              </div>
            ))}
            {lbRows.length===0&&<div style={{textAlign:'center',color:'#4a3010',fontSize:11,padding:'12px 0'}}>No scores yet. Be the first!</div>}
          </>
        )}
      </div>

      {/* Game Grid */}
      <div style={{height:2,background:'linear-gradient(90deg,transparent,#ff4400 20%,#ffcc00 50%,#ff4400 80%,transparent)'}}/>
      <div style={{padding:'12px 12px 16px',background:'#0f0700',position:'relative',zIndex:2}}>
        <div style={{fontSize:10,color:'#7a4a10',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:700,marginBottom:10,textAlign:'center'}}>Choose your game</div>
        <div style={S.grid}>
          {GAME_LIST.map(game=>(
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
              {localBests[game.id]>0&&<div style={S.cardBest}>Best: {fmtScore(game.id,localBests[game.id])}</div>}
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
      `}</style>
    </div>
  );
}
