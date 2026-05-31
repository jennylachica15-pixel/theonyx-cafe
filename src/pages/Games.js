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

  let anim = '';
  if (isWave)  anim = 'chibiBob 1s ease-in-out infinite';
  if (isCheer) anim = 'chibiJump 0.5s ease-in-out infinite';
  if (isAngry) anim = 'chibiShake 0.25s ease-in-out infinite';
  if (isSad)   anim = 'chibiSad 1.5s ease-in-out infinite';

  const leftArmRot  = isAngry ? -120 : isCheer ? -100 : isWave ? -80 : -30;
  const rightArmRot = isAngry ?  120 : isCheer ?  100 : -20;

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:70, animation:anim, transform: flip ? 'scaleX(-1)' : 'none', flexShrink:0 }}>
      {/* Cap */}
      <div style={{ width:54, height:9, background:'#1a1a1a', borderRadius:'50% 50% 0 0', position:'relative', zIndex:3, marginBottom:-2, textAlign:'center', lineHeight:'9px', fontSize:4, color:'#fff', letterSpacing:0.5 }}>
        BARISTA
        <div style={{ position:'absolute', bottom:-3, left:-4, right:-4, height:5, background:'#1a1a1a', borderRadius:2 }}/>
      </div>

      {/* Face - square crop showing face centered */}
      <div style={{ width:54, height:54, borderRadius:'50%', overflow:'hidden', border:'2px solid #c8943a', flexShrink:0 }}>
        <img
          src={faceImg}
          style={{
            width:'160%',
            height:'160%',
            objectFit:'cover',
            marginLeft:'-30%',
            marginTop:flip ? '-5%' : '-8%',
            transform: flip ? 'scaleX(-1)' : 'none',
            display:'block',
          }}
          alt="barista"
        />
      </div>

      {/* Neck */}
      <div style={{ width:10, height:5, background:'#e8b89a' }}/>

      {/* Body */}
      <div style={{ position:'relative', width:48, height:36 }}>
        <div style={{ position:'absolute', inset:0, background:'#1a1a1a', borderRadius:'8px 8px 4px 4px' }}/>
        <div style={{ position:'absolute', top:2, left:8, right:8, bottom:0, background:'#c8943a', borderRadius:4, opacity:0.92 }}/>
        <div style={{ position:'absolute', top:-4, left:'50%', transform:'translateX(-50%)', width:14, height:5, background:'#c8943a', borderRadius:2 }}/>
        {/* Left arm */}
        <div style={{ position:'absolute', left:-10, top:4, width:10, height:26, background:'#1a1a1a', borderRadius:5, transformOrigin:'top center', transform:`rotate(${leftArmRot}deg)`, transition:'transform 0.2s' }}>
          <div style={{ position:'absolute', bottom:-5, left:-2, width:13, height:13, background:'#e8b89a', borderRadius:'50%' }}/>
        </div>
        {/* Right arm */}
        <div style={{ position:'absolute', right:-10, top:4, width:10, height:26, background:'#1a1a1a', borderRadius:5, transformOrigin:'top center', transform:`rotate(${rightArmRot}deg)`, transition:'transform 0.2s' }}>
          <div style={{ position:'absolute', bottom:-5, right:-2, width:13, height:13, background:'#e8b89a', borderRadius:'50%' }}/>
          {isCheer && <div style={{ position:'absolute', bottom:-16, right:-2, fontSize:10 }}>☕</div>}
        </div>
      </div>

      {/* Legs */}
      <div style={{ display:'flex', gap:6, marginTop:2 }}>
        <div style={{ width:12, height:18, background:'#3a2010', borderRadius:5 }}/>
        <div style={{ width:12, height:18, background:'#3a2010', borderRadius:5 }}/>
      </div>
      {/* Shoes */}
      <div style={{ display:'flex', gap:2, marginTop:-1 }}>
        <div style={{ width:15, height:6, background:'#1a1a1a', borderRadius:'0 0 6px 6px' }}/>
        <div style={{ width:15, height:6, background:'#1a1a1a', borderRadius:'0 0 6px 6px' }}/>
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
      <div style={{position:'relative',display:'flex',alignItems:'flex-end',justifyContent:'center',gap:16,padding:'8px 10px 6px',background:'linear-gradient(180deg,#2c1400,#1a0800)',borderBottom:'2px solid #3d1f00',flexShrink:0}}>
        <ChibiBarista faceImg={KELLY_FACE} state={baristaState} flip={false}/>

        {/* Center info */}
        <div style={{flex:0,textAlign:'center',padding:'0 12px',paddingBottom:4,minWidth:140}}>
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

      {/* Game grid */}
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
