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
// GUESS THE WORD — Wordle-style UI
// ═══════════════════════════════════════════════════════════════════════════════
const WORD_LIST = [
  { word:'LATTE',    hint:'Espresso + steamed milk' },
  { word:'MOCHA',    hint:'Coffee with chocolate' },
  { word:'FRAPPE',   hint:'Blended iced coffee' },
  { word:'MATCHA',   hint:'Green tea powder' },
  { word:'BROWNIE',  hint:'Dense chocolate square' },
  { word:'WAFFLE',   hint:'Grid-patterned cake' },
  { word:'BARISTA',  hint:'Coffee maker' },
  { word:'ALMOND',   hint:'Nut milk source' },
  { word:'MUFFIN',   hint:'Domed baked treat' },
  { word:'CARAMEL',  hint:'Brown sugar sauce' },
  { word:'VANILLA',  hint:'White flavoring pod' },
  { word:'COCONUT',  hint:'Tropical white nut' },
  { word:'CINNAMON', hint:'Bark spice for lattes' },
  { word:'ESPRESSO', hint:'Strong short coffee' },
  { word:'MACCHIATO',hint:'Stained espresso' },
  { word:'TIRAMISU', hint:'Pick-me-up dessert' },
  { word:'SMOOTHIE', hint:'Blended fruit drink' },
  { word:'SANDWICH', hint:'Two slices of bread' },
  { word:'PANCAKE',  hint:'Flat griddle cake' },
  { word:'CHEESECAKE',hint:'Cream cheese dessert'},
  { word:'CROISSANT',hint:'Crescent French pastry'},
  { word:'AFFOGATO', hint:'Ice cream + espresso' },
  { word:'AMERICANO',hint:'Diluted espresso' },
  { word:'JOURNAL',  hint:'Café writing book' },
  { word:'COASTER',  hint:'Cup protector mat' },
];

// Pick words by length 4-8 for playability
const PLAYABLE = WORD_LIST.filter(w => w.word.length >= 4 && w.word.length <= 8);

const KEYBOARD_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const MAX_GUESSES = 6;

function GuessWordGame({ playerName, onScore }) {
  const [wordData, setWordData] = useState(null);
  const [guesses, setGuesses] = useState([]); // array of strings
  const [current, setCurrent] = useState('');
  const [gameState, setGameState] = useState('playing'); // playing | won | lost
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [streak, setStreak] = useState(0);
  const [shake, setShake] = useState(false);
  const [usedWords, setUsedWords] = useState([]);
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef(null);

  const pickWord = useCallback((used = []) => {
    const avail = PLAYABLE.filter(w => !used.includes(w.word));
    const list = avail.length > 0 ? avail : PLAYABLE;
    setWordData(list[Math.floor(Math.random() * list.length)]);
    setGuesses([]); setCurrent(''); setGameState('playing'); setShowHint(false);
  }, []);

  useEffect(() => { pickWord([]); }, []);

  const word = wordData?.word || '';
  const WL = word.length;

  // Get tile color for a letter at position in a guess
  const getTileState = (guess, pos) => {
    if (!guess || pos >= guess.length) return 'empty';
    const letter = guess[pos];
    if (letter === word[pos]) return 'correct';       // green
    if (word.includes(letter)) return 'present';      // yellow
    return 'absent';                                   // gray
  };

  // Keyboard letter state (best state across all guesses)
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
    const newGuesses = [...guesses, current];
    setGuesses(newGuesses);
    setCurrent('');
    if (current === word) {
      const pts = (MAX_GUESSES - newGuesses.length + 1) * 50 + streak * 20 + (showHint ? 0 : 30);
      const ns = score + pts;
      setScore(ns); setStreak(s => s + 1); setGameState('won'); onScore(ns);
    } else if (newGuesses.length >= MAX_GUESSES) {
      setStreak(0); setGameState('lost'); onScore(score);
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
      else if (/^[a-zA-Z]$/.test(e.key)) { if (current.length < WL) setCurrent(c => c + e.key.toUpperCase()); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [current, gameState, word]);

  const nextRound = () => {
    const nu = [...usedWords, word];
    setUsedWords(nu); setRound(r => r + 1); pickWord(nu);
  };

  const tileColors = {
    correct: { bg: '#538d4e', border: '#538d4e', color: '#fff' },
    present: { bg: '#b59f3b', border: '#b59f3b', color: '#fff' },
    absent:  { bg: '#3a3a3c', border: '#3a3a3c', color: '#fff' },
    empty:   { bg: '#1e1e1e', border: '#565656', color: '#fff' },
    active:  { bg: '#1e1e1e', border: '#999',    color: '#fff' },
  };

  const keyColors = {
    correct: { bg: '#538d4e', color: '#fff' },
    present: { bg: '#b59f3b', color: '#fff' },
    absent:  { bg: '#3a3a3c', color: '#fff' },
    unused:  { bg: '#6b3a1f', color: '#d4a853' },
  };

  const TILE_SIZE = Math.min(52, Math.floor((Math.min(window.innerWidth, 400) - 40) / WL));

  if (!wordData) return <div style={{color:'#d4a853',textAlign:'center',padding:40}}>Loading...</div>;

  return (
    <div style={{height:'100%',background:'#121213',color:'#fff',display:'flex',flexDirection:'column',fontFamily:"'Arial',sans-serif",overflow:'hidden'}}>

      {/* Top bar */}
      <div style={{background:'#1a1a1b',borderBottom:'1px solid #3a3a3c',padding:'8px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{fontSize:11,color:'#818384'}}>Round <b style={{color:'#d4a853'}}>{round}</b></div>
        <div style={{fontSize:13,fontWeight:'bold',color:'#d4a853',letterSpacing:2}}>GUESS THE WORD</div>
        <div style={{fontSize:11,color:'#818384'}}>⭐ <b style={{color:'#d4a853'}}>{score}</b> {streak>0&&<span>🔥{streak}</span>}</div>
      </div>

      {/* Hint */}
      <div style={{textAlign:'center',padding:'6px 16px',flexShrink:0}}>
        <div style={{fontSize:11,color:'#818384',marginBottom:3}}>{WL}-letter word · {wordData.hint}</div>
        {!showHint
          ? <button onClick={()=>setShowHint(true)} style={{background:'transparent',border:'1px solid #3a3a3c',borderRadius:6,padding:'3px 12px',color:'#818384',fontSize:11,cursor:'pointer'}}>💡 Reveal hint (−30 pts)</button>
          : <div style={{fontSize:12,color:'#b59f3b',fontWeight:'bold'}}>💡 {wordData.hint}</div>
        }
      </div>

      {/* Tile grid */}
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'4px 0',gap:5,overflowY:'auto'}}>
        {Array.from({length:MAX_GUESSES}).map((_,rowIdx) => {
          const guess = guesses[rowIdx];
          const isActive = rowIdx === guesses.length && gameState === 'playing';
          const displayWord = isActive ? current : (guess || '');
          const isShaking = isActive && shake;

          return (
            <div key={rowIdx} style={{display:'flex',gap:5,animation:isShaking?'shake 0.4s ease':'none'}}>
              {Array.from({length:WL}).map((_,colIdx) => {
                const letter = displayWord[colIdx] || '';
                let state = 'empty';
                if (guess) state = getTileState(guess, colIdx);
                else if (isActive && letter) state = 'active';
                const c = tileColors[state];
                const isFlipping = !!guess;
                return (
                  <div key={colIdx} style={{
                    width: TILE_SIZE, height: TILE_SIZE,
                    background: c.bg,
                    border: `2px solid ${c.border}`,
                    borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: Math.round(TILE_SIZE * 0.46),
                    fontWeight: 'bold',
                    color: c.color,
                    transition: isFlipping ? `background 0.3s ${colIdx * 0.1}s` : 'border-color 0.1s',
                    transform: isActive && letter && colIdx === current.length - 1 ? 'scale(1.08)' : 'scale(1)',
                    textTransform: 'uppercase',
                    userSelect: 'none',
                  }}>
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
        <div style={{textAlign:'center',padding:'10px 16px',background:gameState==='won'?'#538d4e22':'#ff444422',borderTop:`1px solid ${gameState==='won'?'#538d4e':'#ff4444'}`,flexShrink:0}}>
          <div style={{fontSize:gameState==='won'?18:15,fontWeight:'bold',color:gameState==='won'?'#538d4e':'#ff6b6b',marginBottom:4}}>
            {gameState==='won' ? `🎉 ${guesses.length === 1 ? 'Genius!' : guesses.length <= 3 ? 'Great!' : 'Got it!'}` : `😔 The word was ${word}`}
          </div>
          <button onClick={nextRound} style={{background:'#d4a853',border:'none',borderRadius:8,padding:'8px 24px',color:'#1a0a00',fontWeight:'bold',fontSize:13,cursor:'pointer'}}>
            Next Word →
          </button>
        </div>
      )}

      {/* Keyboard */}
      <div style={{background:'#1a1a1b',borderTop:'1px solid #3a3a3c',padding:'8px 6px 12px',flexShrink:0}}>
        {KEYBOARD_ROWS.map((row, ri) => (
          <div key={ri} style={{display:'flex',justifyContent:'center',gap:5,marginBottom:5}}>
            {ri === 2 && (
              <button onPointerDown={e=>{e.preventDefault();pressKey('ENTER');}}
                style={{background:'#818384',border:'none',borderRadius:4,padding:'14px 8px',color:'#fff',fontSize:11,fontWeight:'bold',cursor:'pointer',minWidth:44,userSelect:'none'}}>
                ENTER
              </button>
            )}
            {row.split('').map(l => {
              const ks = keyColors[getKeyState(l)];
              return (
                <button key={l} onPointerDown={e=>{e.preventDefault();pressKey(l);}}
                  style={{background:ks.bg,border:'none',borderRadius:4,padding:'14px 0',color:ks.color,fontSize:13,fontWeight:'bold',cursor:'pointer',width:30,userSelect:'none',transition:'background 0.2s'}}>
                  {l}
                </button>
              );
            })}
            {ri === 2 && (
              <button onPointerDown={e=>{e.preventDefault();pressKey('DEL');}}
                style={{background:'#818384',border:'none',borderRadius:4,padding:'14px 8px',color:'#fff',fontSize:11,fontWeight:'bold',cursor:'pointer',minWidth:44,userSelect:'none'}}>
                ⌫
              </button>
            )}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-6px)}
          40%{transform:translateX(6px)}
          60%{transform:translateX(-4px)}
          80%{transform:translateX(4px)}
        }
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
