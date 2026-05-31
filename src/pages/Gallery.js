import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase/config';
import {
  collection, doc, setDoc, getDoc, getDocs,
  query, orderBy, limit, where, serverTimestamp
} from 'firebase/firestore';
import ZombieGame from './ZombieGame';
import CafeGame from './CafeGame';

// ─── THEME ───────────────────────────────────────────────────────────────────
const S = {
  wrap: { minHeight: '100vh', background: '#1a0a00', color: '#f5e6d0', fontFamily: "'Georgia', serif" },
  header: { background: 'linear-gradient(135deg, #3d1f00 0%, #6b3a1f 100%)', padding: '20px 16px 12px', textAlign: 'center', borderBottom: '2px solid #8b5a2b' },
  logo: { fontSize: 28, fontWeight: 'bold', color: '#d4a853', letterSpacing: 2 },
  sub: { fontSize: 12, color: '#a07850', marginTop: 2 },
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
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#d4a853', textTransform: 'uppercase', letterSpacing: 1 },
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
function SnakeGame({ playerName, onScore }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 320, h: 460, cell: 20 });

  // Fit canvas to container
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const availW = containerRef.current.clientWidth - 8;
      const availH = containerRef.current.clientHeight - 100; // room for controls
      const cell = Math.max(16, Math.min(24, Math.floor(Math.min(availW / 16, availH / 22))));
      setCanvasSize({ w: cell * 16, h: cell * 22, cell });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const { w: W, h: H, cell: CELL } = canvasSize;
  const COLS = Math.floor(W / CELL);
  const ROWS = Math.floor(H / CELL);

  const initState = () => ({
    snake: [{x:Math.floor(COLS/2),y:Math.floor(ROWS/2)},{x:Math.floor(COLS/2)-1,y:Math.floor(ROWS/2)},{x:Math.floor(COLS/2)-2,y:Math.floor(ROWS/2)}],
    dir: {x:1,y:0}, nextDir: {x:1,y:0},
    food: {x:Math.floor(COLS/2)+4, y:Math.floor(ROWS/2)},
    score: 0, lastTime: 0, speed: 260, // starts slow!
  });

  const drawGame = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const st = stateRef.current; if (!st) return;
    ctx.fillStyle = '#0a0500'; ctx.fillRect(0,0,W,H);
    // grid dots
    ctx.fillStyle = 'rgba(61,31,0,0.3)';
    for(let x=0;x<COLS;x++) for(let y=0;y<ROWS;y++) ctx.fillRect(x*CELL+CELL/2-1,y*CELL+CELL/2-1,2,2);
    // food — coffee bean
    ctx.fillStyle='#d4a853';
    ctx.beginPath();ctx.arc(st.food.x*CELL+CELL/2,st.food.y*CELL+CELL/2,CELL/2-2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#1a0a00';ctx.font=`${CELL-4}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('☕',st.food.x*CELL+CELL/2,st.food.y*CELL+CELL/2+1);
    // snake
    st.snake.forEach((seg,i)=>{
      ctx.fillStyle = i===0 ? '#8bc34a' : `rgba(139,195,74,${Math.max(0.2,0.95-i*0.04)})`;
      ctx.beginPath();ctx.roundRect(seg.x*CELL+1,seg.y*CELL+1,CELL-2,CELL-2,5);ctx.fill();
      if(i===0){
        // eyes
        ctx.fillStyle='#1a0a00';
        ctx.beginPath();ctx.arc(seg.x*CELL+CELL*0.3,seg.y*CELL+CELL*0.35,2,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(seg.x*CELL+CELL*0.7,seg.y*CELL+CELL*0.35,2,0,Math.PI*2);ctx.fill();
      }
    });
  }, [W,H,CELL,COLS,ROWS]);

  const gameLoop = useCallback((ts) => {
    const st = stateRef.current; if (!st) return;
    if (ts - st.lastTime > st.speed) {
      st.lastTime = ts;
      st.dir = st.nextDir;
      const head = {x: st.snake[0].x+st.dir.x, y: st.snake[0].y+st.dir.y};
      if (head.x<0||head.x>=COLS||head.y<0||head.y>=ROWS||st.snake.some(s=>s.x===head.x&&s.y===head.y)) {
        setGameOver(true); onScore(st.score); return;
      }
      st.snake.unshift(head);
      if (head.x===st.food.x&&head.y===st.food.y) {
        st.score+=10; st.speed=Math.max(90,st.speed-4); setScore(st.score);
        do { st.food={x:Math.floor(Math.random()*COLS),y:Math.floor(Math.random()*ROWS)};
        } while(st.snake.some(s=>s.x===st.food.x&&s.y===st.food.y));
      } else st.snake.pop();
    }
    drawGame();
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [drawGame, onScore, COLS, ROWS]);

  const startGame = () => {
    if(rafRef.current) cancelAnimationFrame(rafRef.current);
    stateRef.current = initState();
    setScore(0); setGameOver(false); setStarted(true);
    rafRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(()=>()=>{if(rafRef.current) cancelAnimationFrame(rafRef.current);},[]);

  const dir = (dx,dy) => {
    const st = stateRef.current; if (!st) return;
    if (dx!==0&&st.dir.x!==0) return;
    if (dy!==0&&st.dir.y!==0) return;
    st.nextDir={x:dx,y:dy};
  };

  useEffect(()=>{
    const k=(e)=>{const m={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};if(m[e.key]){e.preventDefault();dir(...m[e.key]);}};
    window.addEventListener('keydown',k); return()=>window.removeEventListener('keydown',k);
  },[]);

  const btnStyle = {background:'#3d1f00',border:'2px solid #6b3a1f',color:'#d4a853',
    width:60,height:60,borderRadius:12,fontSize:22,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'};

  return (
    <div ref={containerRef} style={{display:'flex',flexDirection:'column',alignItems:'center',height:'100%',padding:'8px 4px 0',overflow:'hidden'}}>
      <div style={{color:'#d4a853',fontSize:15,fontWeight:'bold',marginBottom:6}}>{playerName} | ☕ {score}</div>
      <canvas ref={canvasRef} width={W} height={H} style={{border:'2px solid #6b3a1f',borderRadius:8,maxWidth:'100%',flex:'0 0 auto'}} />
      {!started&&!gameOver&&(
        <button style={{...S.btn(),marginTop:12,width:160}} onClick={startGame}>▶ Start</button>
      )}
      {gameOver&&(
        <div style={{textAlign:'center',marginTop:10}}>
          <div style={{color:'#ff6b6b',fontSize:18,fontWeight:'bold'}}>Game Over!</div>
          <div style={{color:'#d4a853',fontSize:15,marginBottom:8}}>Score: {score}</div>
          <button style={{...S.btn(),width:160}} onClick={startGame}>▶ Play Again</button>
        </div>
      )}
      {started&&!gameOver&&(
        <div style={{marginTop:10,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,width:190,flexShrink:0}}>
          <div/><button style={btnStyle} onClick={()=>dir(0,-1)}>↑</button><div/>
          <button style={btnStyle} onClick={()=>dir(-1,0)}>←</button>
          <div/>
          <button style={btnStyle} onClick={()=>dir(1,0)}>→</button>
          <div/><button style={btnStyle} onClick={()=>dir(0,1)}>↓</button><div/>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TETRIS — fills full screen width dynamically
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
      {!started&&!gameOver&&<button style={{...S.btn(),width:160,flexShrink:0}} onClick={startGame}>▶ Start</button>}
      {gameOver&&(
        <div style={{textAlign:'center',flexShrink:0}}>
          <div style={{color:'#ff6b6b',fontSize:20,fontWeight:'bold'}}>CRASH! 💥</div>
          <div style={{color:'#d4a853',marginBottom:8}}>Score: {score}</div>
          <button style={{...S.btn(),width:160}} onClick={startGame}>▶ Again</button>
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
];

const PLAYABLE = WORD_LIST.filter(w => w.word.length >= 4 && w.word.length <= 9);
const KEYBOARD_ROWS = ['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];
const MAX_GUESSES = 6;


// ── Real-face Chibi Barista Characters ───────────────────────────────────────
const KELLY_FACE = "data:image/png;base64,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";
const MARYZ_FACE = "data:image/png;base64,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";

function ChibiBarista({ faceImg, state, flip }) {
  const isAngry = state === 'fight';
  const isSad   = state === 'sad';
  const isCheer = state === 'cheer';
  const isWave  = state === 'wave';

  // Body sway / jump animation
  let anim = '';
  if (isWave)  anim = 'chibiBob 1s ease-in-out infinite';
  if (isCheer) anim = 'chibiJump 0.5s ease-in-out infinite';
  if (isAngry) anim = 'chibiShake 0.25s ease-in-out infinite';
  if (isSad)   anim = 'chibiSad 1.5s ease-in-out infinite';

  // Arm angles
  const leftArmRot  = isAngry ? -120 : isCheer ? -100 : isWave ? -80 : -30;
  const rightArmRot = isAngry ?  120 : isCheer ?  100 : -20;

  return (
    <div style={{ position:'relative', width:64, display:'flex', flexDirection:'column', alignItems:'center', animation:anim, transform: flip ? 'scaleX(-1)' : 'none' }}>
      {/* Cap */}
      <div style={{ width:52, height:10, background:'#1a1a1a', borderRadius:'50% 50% 0 0', position:'relative', zIndex:3, marginBottom:-2 }}>
        <div style={{ position:'absolute', bottom:0, left:'50%', transform:'translateX(-50%)', fontSize:5, color:'#fff', fontWeight:'bold', letterSpacing:0.5, whiteSpace:'nowrap' }}>BARISTA</div>
        {/* Brim */}
        <div style={{ position:'absolute', bottom:-4, left:-4, right:-4, height:6, background:'#1a1a1a', borderRadius:3 }}/>
      </div>

      {/* Real face circle */}
      <div style={{ width:52, height:52, borderRadius:'50%', overflow:'hidden', border:'2px solid #c8943a', zIndex:2, flexShrink:0 }}>
        <img src={faceImg} style={{ width:'100%', height:'100%', objectFit:'cover', transform: flip ? 'scaleX(-1)' : 'none' }} alt="barista"/>
      </div>

      {/* Neck */}
      <div style={{ width:10, height:6, background:'#e8b89a', marginTop:-1 }}/>

      {/* Body — black shirt + apron */}
      <div style={{ position:'relative', width:46, height:38, display:'flex', alignItems:'center', justifyContent:'center' }}>
        {/* Shirt */}
        <div style={{ position:'absolute', inset:0, background:'#1a1a1a', borderRadius:'8px 8px 4px 4px' }}/>
        {/* Apron */}
        <div style={{ position:'absolute', top:2, left:8, right:8, bottom:0, background:'#c8943a', borderRadius:'4px 4px 4px 4px', opacity:0.92 }}/>
        {/* Apron bib strap */}
        <div style={{ position:'absolute', top:-4, left:'50%', transform:'translateX(-50%)', width:14, height:6, background:'#c8943a', borderRadius:3 }}/>

        {/* Left arm */}
        <div style={{ position:'absolute', left:-10, top:4, width:10, height:28, background:'#1a1a1a', borderRadius:5, transformOrigin:'top center', transform:`rotate(${leftArmRot}deg)`, transition:'transform 0.2s' }}>
          <div style={{ position:'absolute', bottom:-6, left:-2, width:14, height:14, background:'#e8b89a', borderRadius:'50%' }}/>
          {isWave && <div style={{ position:'absolute', bottom:-16, left:-1, width:12, height:10, background:'#e8b89a', borderRadius:'50% 50% 40% 40%', transform:'rotate(-20deg)' }}/>}
        </div>

        {/* Right arm */}
        <div style={{ position:'absolute', right:-10, top:4, width:10, height:28, background:'#1a1a1a', borderRadius:5, transformOrigin:'top center', transform:`rotate(${rightArmRot}deg)`, transition:'transform 0.2s' }}>
          <div style={{ position:'absolute', bottom:-6, right:-2, width:14, height:14, background:'#e8b89a', borderRadius:'50%' }}/>
          {isCheer && <div style={{ position:'absolute', bottom:-16, right:-1, fontSize:10 }}>☕</div>}
        </div>
      </div>

      {/* Legs */}
      <div style={{ display:'flex', gap:6, marginTop:2 }}>
        <div style={{ width:12, height:20, background:'#3a2010', borderRadius:6 }}/>
        <div style={{ width:12, height:20, background:'#3a2010', borderRadius:6 }}/>
      </div>
      {/* Shoes */}
      <div style={{ display:'flex', gap:2, marginTop:-2 }}>
        <div style={{ width:16, height:7, background:'#1a1a1a', borderRadius:'0 0 8px 8px' }}/>
        <div style={{ width:16, height:7, background:'#1a1a1a', borderRadius:'0 0 8px 8px' }}/>
      </div>
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

  const pickWord = useCallback((used = []) => {
    const avail = PLAYABLE.filter(w => !used.includes(w.word));
    const list = avail.length > 0 ? avail : PLAYABLE;
    const w = list[Math.floor(Math.random() * list.length)];
    setWordData(w); setGuesses([]); setCurrent('');
    setGameState('playing'); setShowHint(false); setBaristaState('wave');
  }, []);

  useEffect(() => { pickWord([]); }, []);

  const word = wordData?.word || '';
  const WL = word.length;

  const getTileState = (guess, pos) => {
    if (!guess || pos >= guess.length) return 'empty';
    const l = guess[pos];
    if (l === word[pos]) return 'correct';
    if (word.includes(l)) return 'present';
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
    if (current.length !== WL) { setShake(true); setTimeout(() => setShake(false), 500); return; }
    const ng = [...guesses, current]; setGuesses(ng); setCurrent('');
    if (current === word) {
      const pts = (MAX_GUESSES - ng.length + 1) * 50 + streak * 20 + (showHint ? 0 : 30);
      setScore(s => s + pts); setStreak(s => s + 1); setGameState('won'); setBaristaState('cheer'); onScore(score + pts);
    } else {
      setBaristaState('fight'); setShowEffect(true);
      setTimeout(() => setShowEffect(false), 700);
      const rem = MAX_GUESSES - ng.length;
      setTimeout(() => setBaristaState(rem <= 0 ? 'sad' : rem === 1 ? 'sad' : 'wave'), 800);
      if (ng.length >= MAX_GUESSES) { setGameState('lost'); setStreak(0); setBaristaState('sad'); onScore(score); }
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
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [current, gameState, word, WL]);

  const nextRound = () => { const nu = [...usedWords, word]; setUsedWords(nu); setRound(r => r + 1); pickWord(nu); };

  const tileColors = {
    correct: { bg:'#538d4e', border:'#538d4e', color:'#fff' },
    present: { bg:'#b59f3b', border:'#b59f3b', color:'#fff' },
    absent:  { bg:'#3a3a3c', border:'#3a3a3c', color:'#fff' },
    empty:   { bg:'transparent', border:'#3a3a3c', color:'#fff' },
    active:  { bg:'transparent', border:'#d4a853', color:'#fff' },
  };
  const keyColors = {
    correct:{ bg:'#538d4e', color:'#fff' },
    present:{ bg:'#b59f3b', color:'#fff' },
    absent: { bg:'#3a3a3c', color:'#fff' },
    unused: { bg:'#6b3a1f', color:'#d4a853' },
  };

  const TILE_SIZE = Math.min(50, Math.floor((Math.min(typeof window !== 'undefined' ? window.innerWidth : 390, 420) - 60) / Math.max(WL, 4)));

  if (!wordData) return <div style={{color:'#d4a853',textAlign:'center',padding:40}}>Loading...</div>;

  return (
    <div style={{height:'100%',background:'#121213',color:'#fff',display:'flex',flexDirection:'column',fontFamily:"'Arial',sans-serif",overflow:'hidden'}}>

      {/* Top bar */}
      <div style={{background:'#1a1a1b',borderBottom:'1px solid #3a3a3c',padding:'7px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{fontSize:11,color:'#818384'}}>Round <b style={{color:'#d4a853'}}>{round}</b></div>
        <div style={{fontSize:13,fontWeight:'bold',color:'#d4a853',letterSpacing:2}}>GUESS THE WORD</div>
        <div style={{fontSize:11,color:'#818384'}}>⭐<b style={{color:'#d4a853'}}>{score}</b>{streak>0&&<span style={{marginLeft:4}}>🔥{streak}</span>}</div>
      </div>

      {/* Barista stage */}
      <div style={{position:'relative',display:'flex',alignItems:'flex-end',justifyContent:'space-between',padding:'8px 10px 6px',background:'linear-gradient(180deg,#2c1400,#1a0800)',borderBottom:'2px solid #3d1f00',flexShrink:0}}>
        <ChibiBarista faceImg={KELLY_FACE} state={baristaState} flip={false}/>

        {/* Center info */}
        <div style={{flex:1,textAlign:'center',padding:'0 8px',paddingBottom:4}}>
          {/* Word description — always shown */}
          <div style={{fontSize:12,color:'#f0d9b5',lineHeight:1.5,marginBottom:6,fontStyle:'italic',background:'rgba(0,0,0,0.3)',borderRadius:8,padding:'6px 10px'}}>
            "{wordData.hint}"
          </div>

          {/* State message */}
          <div style={{fontSize:12,fontWeight:'bold',minHeight:18,color:
            baristaState==='fight'?'#ff4444':
            baristaState==='cheer'?'#538d4e':
            baristaState==='sad'?'#818384':'#d4a853'}}>
            {baristaState==='wave'  && `👋 Hi ${playerName}!`}
            {baristaState==='fight' && '💥 Wrong!'}
            {baristaState==='cheer' && '🎉 Correct!'}
            {baristaState==='sad'   && '😢 Aww...'}
            {showEffect && <span style={{marginLeft:6,fontSize:16,animation:'popEffect 0.5s ease'}}>💢</span>}
          </div>

          {/* Life dots */}
          <div style={{display:'flex',justifyContent:'center',gap:5,margin:'5px 0'}}>
            {Array.from({length:MAX_GUESSES}).map((_,i)=>(
              <div key={i} style={{width:10,height:10,borderRadius:'50%',background:i<(MAX_GUESSES-guesses.length)?'#538d4e':'#3a3a3c',border:'1px solid #555',transition:'background 0.4s'}}/>
            ))}
          </div>

          {/* Category + letters count */}
          <div style={{fontSize:10,color:'#818384'}}>{wordData.category} · {WL} letters</div>

          {/* Hint toggle */}
          {!showHint
            ? <button onClick={()=>setShowHint(true)} style={{background:'transparent',border:'1px solid #3a3a3c',borderRadius:6,padding:'2px 10px',color:'#818384',fontSize:10,cursor:'pointer',marginTop:3}}>💡 Hint −30pts</button>
            : <div style={{fontSize:10,color:'#b59f3b',marginTop:3,fontWeight:'bold'}}>💡 {wordData.hint}</div>
          }
        </div>

        <ChibiBarista faceImg={MARYZ_FACE} state={baristaState} flip={true}/>
      </div>

      {/* Tile grid — exact word length */}
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'8px 0',gap:5,overflowY:'auto'}}>
        {Array.from({length:MAX_GUESSES}).map((_,rowIdx)=>{
          const guess = guesses[rowIdx];
          const isActive = rowIdx === guesses.length && gameState === 'playing';
          const displayWord = isActive ? current : (guess || '');
          return (
            <div key={rowIdx} style={{display:'flex',gap:5,animation:isActive&&shake?'shake 0.4s ease':'none'}}>
              {Array.from({length:WL}).map((_,colIdx)=>{
                const letter = displayWord[colIdx] || '';
                let state = 'empty';
                if (guess) state = getTileState(guess, colIdx);
                else if (isActive && letter) state = 'active';
                const c = tileColors[state];
                return (
                  <div key={colIdx} style={{width:TILE_SIZE,height:TILE_SIZE,background:c.bg,border:`2px solid ${c.border}`,borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:Math.round(TILE_SIZE*0.46),fontWeight:'bold',color:c.color,transition:guess?`background 0.3s ${colIdx*0.1}s,border-color 0.3s ${colIdx*0.1}s`:'border-color 0.1s',userSelect:'none',textTransform:'uppercase'}}>
                    {letter}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Result banner */}
      {gameState!=='playing'&&(
        <div style={{textAlign:'center',padding:'8px 14px',background:gameState==='won'?'#538d4e22':'#ff444422',borderTop:`1px solid ${gameState==='won'?'#538d4e':'#ff4444'}`,flexShrink:0}}>
          <div style={{fontSize:15,fontWeight:'bold',color:gameState==='won'?'#538d4e':'#ff6b6b',marginBottom:6}}>
            {gameState==='won'?`🎉 ${guesses.length<=2?'Genius!':guesses.length<=4?'Great job!':'Got it!'}`:`😔 The word was "${word}"`}
          </div>
          <button onClick={nextRound} style={{background:'#d4a853',border:'none',borderRadius:8,padding:'8px 28px',color:'#1a0a00',fontWeight:'bold',fontSize:13,cursor:'pointer'}}>Next Word →</button>
        </div>
      )}

      {/* Keyboard */}
      <div style={{background:'#1a1a1b',borderTop:'1px solid #3a3a3c',padding:'6px 4px 10px',flexShrink:0}}>
        {['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'].map((row,ri)=>(
          <div key={ri} style={{display:'flex',justifyContent:'center',gap:4,marginBottom:4}}>
            {ri===2&&<button onPointerDown={e=>{e.preventDefault();pressKey('ENTER');}} style={{background:'#818384',border:'none',borderRadius:4,padding:'12px 6px',color:'#fff',fontSize:10,fontWeight:'bold',cursor:'pointer',minWidth:40,userSelect:'none'}}>ENTER</button>}
            {row.split('').map(l=>{
              const ks=keyColors[getKeyState(l)];
              return(<button key={l} onPointerDown={e=>{e.preventDefault();pressKey(l);}} style={{background:ks.bg,border:'none',borderRadius:4,padding:'12px 0',color:ks.color,fontSize:13,fontWeight:'bold',cursor:'pointer',width:28,userSelect:'none',transition:'background 0.2s'}}>{l}</button>);
            })}
            {ri===2&&<button onPointerDown={e=>{e.preventDefault();pressKey('DEL');}} style={{background:'#818384',border:'none',borderRadius:4,padding:'12px 6px',color:'#fff',fontSize:11,fontWeight:'bold',cursor:'pointer',minWidth:40,userSelect:'none'}}>⌫</button>}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
        @keyframes popEffect{0%{transform:scale(0.5);opacity:0}50%{transform:scale(1.4);opacity:1}100%{transform:scale(1);opacity:0}}
        @keyframes chibiBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        @keyframes chibiJump{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes chibiShake{0%,100%{transform:translateX(0)}25%{transform:translateX(4px)}75%{transform:translateX(-4px)}}
        @keyframes chibiSad{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(2px) rotate(-2deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN GAMES PAGE

// ═══════════════════════════════════════════════════════════════════════════════
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

  // Active game fullscreen
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
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="4" y="8" width="20" height="14" rx="3" fill="#6b3a1f" stroke="#d4a853" strokeWidth="1.5"/>
            <rect x="7" y="11" width="5" height="4" rx="1" fill="#d4a853"/>
            <rect x="16" y="11" width="5" height="4" rx="1" fill="#d4a853"/>
            <rect x="12" y="13" width="4" height="2" rx="1" fill="#d4a853"/>
            <line x1="9" y1="4" x2="9" y2="8" stroke="#d4a853" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="14" y1="3" x2="14" y2="8" stroke="#d4a853" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="19" y1="4" x2="19" y2="8" stroke="#d4a853" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span style={S.logo}>GAME CORNER</span>
        </div>
        <div style={S.sub}>Theonyx Café Arcade</div>
      </div>

      {/* Auth bar */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 16px',background:'#2a1000',borderBottom:'1px solid #3d1f00'}}>
        {username ? (
          <>
            <span style={{color:'#8bc34a',fontSize:13}}>👤 {username}</span>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setShowLB(true)} style={{background:'#d4a853',border:'none',color:'#1a0a00',padding:'6px 14px',borderRadius:16,fontSize:12,fontWeight:'bold',cursor:'pointer'}}>🏆 Leaderboard</button>
              <button onClick={handleLogout} style={{background:'#3d1f00',border:'1px solid #6b3a1f',color:'#a07850',padding:'6px 12px',borderRadius:16,fontSize:12,cursor:'pointer'}}>Logout</button>
            </div>
          </>
        ) : (
          <>
            <span style={{color:'#a07850',fontSize:13}}>Sign in to save scores globally</span>
            <button onClick={()=>setShowAuth(true)} style={{background:'#d4a853',border:'none',color:'#1a0a00',padding:'6px 14px',borderRadius:16,fontSize:12,fontWeight:'bold',cursor:'pointer'}}>Sign In / Register</button>
          </>
        )}
      </div>

      {/* Game grid — NO emoji icons, clean brown cards */}
      <div style={S.grid}>
        {GAME_LIST.map(game => (
          <div key={game.id} style={S.card}
            onClick={()=>handleGameSelect(game)}
            onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.03)';e.currentTarget.style.borderColor='#d4a853';}}
            onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.borderColor='#6b3a1f';}}>
            <div style={S.cardTitle}>{game.title}</div>
            <div style={S.cardSub}>{game.sub}</div>
            {localBests[game.id]>0 && <div style={S.cardBest}>Best: {localBests[game.id]}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
