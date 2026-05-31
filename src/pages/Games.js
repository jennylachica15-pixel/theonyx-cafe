import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase/config';
import {
  collection, doc, setDoc, getDoc, getDocs,
  query, orderBy, limit, where, serverTimestamp
} from 'firebase/firestore';
import ZombieGame from './ZombieGame';

// ─── THEME ───────────────────────────────────────────────────────────────────
const S = {
  wrap: { minHeight: '100vh', background: '#1a0a00', color: '#f5e6d0', fontFamily: "'Georgia', serif" },
  header: { background: 'linear-gradient(135deg, #3d1f00 0%, #6b3a1f 100%)', padding: '20px 16px 12px', textAlign: 'center', borderBottom: '2px solid #8b5a2b' },
  logo: { fontSize: 28, fontWeight: 'bold', color: '#d4a853', letterSpacing: 2 },
  sub: { fontSize: 12, color: '#a07850', marginTop: 2 },
  tabs: { display: 'flex', borderBottom: '2px solid #3d1f00', background: '#2a1000' },
  tab: (a) => ({ flex: 1, padding: '12px 4px', border: 'none', background: a ? '#6b3a1f' : 'transparent', color: a ? '#d4a853' : '#a07850', fontSize: 13, fontWeight: a ? 'bold' : 'normal', cursor: 'pointer' }),
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 16 },
  card: { background: 'linear-gradient(145deg, #2a1000, #3d1f00)', border: '1px solid #6b3a1f', borderRadius: 16, padding: 16, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' },
  cardIcon: { fontSize: 40, marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#d4a853' },
  cardSub: { fontSize: 11, color: '#a07850', marginTop: 4 },
  cardBest: { fontSize: 11, color: '#8bc34a', marginTop: 6, background: 'rgba(139,195,74,0.1)', borderRadius: 8, padding: '2px 8px' },
  fullscreen: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#1a0a00', zIndex: 9999, display: 'flex', flexDirection: 'column' },
  gameBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#2a1000', borderBottom: '2px solid #6b3a1f', minHeight: 50 },
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
  { id: 'snake',    emoji: '🐍', title: 'Snake',              sub: 'Collect coffee beans' },
  { id: 'tetris',   emoji: '🟦', title: 'Tetris',             sub: 'Classic stacking' },
  { id: 'runner',   emoji: '🏃', title: 'Café Runner',        sub: 'Jump the obstacles' },
  { id: 'spotdiff', emoji: '🔍', title: 'Spot the Difference',sub: 'Find 5 differences' },
  { id: 'racing',   emoji: '🏎️', title: 'Café Racer',         sub: 'Dodge the barriers' },
  { id: 'zombie',   emoji: '🧟', title: 'Zombie Barista',     sub: 'Multiplayer survival' },
  { id: 'cafemystery', emoji: '☕', title: 'Café Mystery',    sub: 'Social deduction' },
];

// ─── FIREBASE AUTH (username/password stored in Firestore) ────────────────────
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
        <input style={S.input} placeholder="Username (e.g. Latte)" value={username}
          onChange={e=>setUsername(e.target.value)} autoCapitalize="none" />
        <input style={S.input} placeholder="Password" type="password" value={password}
          onChange={e=>setPassword(e.target.value)} />
        {error && <div style={{color:'#ff6b6b',fontSize:13,marginBottom:8}}>{error}</div>}
        <button style={S.btn()} onClick={handle} disabled={loading}>
          {loading ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
        <button style={S.btn('#6b3a1f')} onClick={()=>{setMode(mode==='login'?'register':'login');setError('');}}>
          {mode === 'login' ? 'New? Create Account' : 'Already have one? Sign In'}
        </button>
        <button style={{background:'none',border:'none',color:'#a07850',cursor:'pointer',fontSize:13}} onClick={onClose}>
          Play as Guest
        </button>
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

// ─── LEADERBOARD MODAL ───────────────────────────────────────────────────────
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
              {g.emoji} {g.title}
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
// SNAKE GAME
// ═══════════════════════════════════════════════════════════════════════════════
function SnakeGame({ playerName, onScore }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const CELL = 20, COLS = 16, ROWS = 22;

  const initState = () => ({
    snake: [{x:8,y:11},{x:7,y:11},{x:6,y:11}],
    dir: {x:1,y:0}, nextDir: {x:1,y:0},
    food: {x:12,y:8}, score: 0,
    lastTime: 0, speed: 250,
  });

  const drawGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const st = stateRef.current;
    ctx.fillStyle = '#1a0a00';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    // grid
    ctx.strokeStyle = 'rgba(61,31,0,0.4)';
    ctx.lineWidth = 0.5;
    for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(x*CELL,0);ctx.lineTo(x*CELL,ROWS*CELL);ctx.stroke();}
    for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(0,y*CELL);ctx.lineTo(COLS*CELL,y*CELL);ctx.stroke();}
    // food
    ctx.fillStyle='#d4a853';
    ctx.beginPath();ctx.arc(st.food.x*CELL+CELL/2,st.food.y*CELL+CELL/2,CELL/2-2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#1a0a00';ctx.font='11px serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('☕',st.food.x*CELL+CELL/2,st.food.y*CELL+CELL/2);
    // snake
    st.snake.forEach((seg,i)=>{
      ctx.fillStyle = i===0 ? '#8bc34a' : `rgba(139,195,74,${0.9-i*0.03})`;
      ctx.beginPath();ctx.roundRect(seg.x*CELL+1,seg.y*CELL+1,CELL-2,CELL-2,4);ctx.fill();
    });
  }, []);

  const gameLoop = useCallback((ts) => {
    const st = stateRef.current;
    if (!st) return;
    if (ts - st.lastTime > st.speed) {
      st.lastTime = ts;
      st.dir = st.nextDir;
      const head = {x: st.snake[0].x+st.dir.x, y: st.snake[0].y+st.dir.y};
      if (head.x<0||head.x>=COLS||head.y<0||head.y>=ROWS||st.snake.some(s=>s.x===head.x&&s.y===head.y)) {
        setGameOver(true); onScore(st.score); return;
      }
      st.snake.unshift(head);
      if (head.x===st.food.x&&head.y===st.food.y) {
        st.score += 10; st.speed = Math.max(80, st.speed-3);
        setScore(st.score);
        do { st.food={x:Math.floor(Math.random()*COLS),y:Math.floor(Math.random()*ROWS)};
        } while(st.snake.some(s=>s.x===st.food.x&&s.y===st.food.y));
      } else st.snake.pop();
    }
    drawGame();
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [drawGame, onScore]);

  const startGame = () => {
    stateRef.current = initState();
    setScore(0); setGameOver(false); setStarted(true);
    rafRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(()=>()=>{if(rafRef.current) cancelAnimationFrame(rafRef.current);},[]);

  const dir = (dx,dy) => {
    const st = stateRef.current;
    if (!st) return;
    if (dx!==0&&st.dir.x!==0) return;
    if (dy!==0&&st.dir.y!==0) return;
    st.nextDir={x:dx,y:dy};
  };

  const btnStyle = {background:'#3d1f00',border:'2px solid #6b3a1f',color:'#d4a853',
    width:64,height:64,borderRadius:12,fontSize:24,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'};

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',height:'100%',paddingTop:8}}>
      <div style={{color:'#d4a853',fontSize:18,fontWeight:'bold',marginBottom:8}}>
        {playerName} | Score: {score}
      </div>
      <canvas ref={canvasRef} width={COLS*CELL} height={ROWS*CELL}
        style={{border:'2px solid #6b3a1f',borderRadius:8,maxWidth:'100%'}} />
      {!started && !gameOver && (
        <button style={{...S.btn(),marginTop:16,width:160}} onClick={startGame}>▶ Start</button>
      )}
      {gameOver && (
        <div style={{textAlign:'center',marginTop:12}}>
          <div style={{color:'#ff6b6b',fontSize:18,fontWeight:'bold'}}>Game Over!</div>
          <div style={{color:'#d4a853',fontSize:16,marginBottom:8}}>Score: {score}</div>
          <button style={{...S.btn(),width:160}} onClick={startGame}>▶ Play Again</button>
        </div>
      )}
      {started && !gameOver && (
        <div style={{marginTop:16,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,width:200}}>
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
// TETRIS GAME
// ═══════════════════════════════════════════════════════════════════════════════
function TetrisGame({ playerName, onScore }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const CELL=24,COLS=10,ROWS=20;
  const PIECES=[
    {shape:[[1,1,1,1]],color:'#00bcd4'},
    {shape:[[1,1],[1,1]],color:'#d4a853'},
    {shape:[[1,1,1],[0,1,0]],color:'#9c27b0'},
    {shape:[[1,1,1],[1,0,0]],color:'#ff9800'},
    {shape:[[1,1,1],[0,0,1]],color:'#2196f3'},
    {shape:[[1,1,0],[0,1,1]],color:'#f44336'},
    {shape:[[0,1,1],[1,1,0]],color:'#4caf50'},
  ];
  const newPiece=()=>{const p=PIECES[Math.floor(Math.random()*PIECES.length)];return{shape:p.shape,color:p.color,x:Math.floor(COLS/2)-Math.floor(p.shape[0].length/2),y:0};};
  const rotate=s=>s[0].map((_,i)=>s.map(r=>r[i]).reverse());
  const collides=(board,piece,ox=0,oy=0)=>piece.shape.some((row,y)=>row.some((v,x)=>v&&(piece.x+x+ox<0||piece.x+x+ox>=COLS||piece.y+y+oy>=ROWS||board[piece.y+y+oy]?.[piece.x+x+ox])));
  const merge=(board,piece)=>{const b=board.map(r=>[...r]);piece.shape.forEach((row,y)=>row.forEach((v,x)=>{if(v)b[piece.y+y][piece.x+x]=piece.color;}));return b;};
  const clearLines=(board)=>{const b=board.filter(r=>r.some(v=>!v));const cleared=ROWS-b.length;const empty=Array.from({length:cleared},()=>Array(COLS).fill(0));return{board:[...empty,...b],cleared};};
  const initState=()=>({board:Array.from({length:ROWS},()=>Array(COLS).fill(0)),piece:newPiece(),next:newPiece(),score:0,lastTime:0,speed:600});
  const drawGame=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext('2d');const st=stateRef.current;
    ctx.fillStyle='#1a0a00';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle='rgba(61,31,0,0.4)';ctx.lineWidth=0.5;
    for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(x*CELL,0);ctx.lineTo(x*CELL,ROWS*CELL);ctx.stroke();}
    for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(0,y*CELL);ctx.lineTo(COLS*CELL,y*CELL);ctx.stroke();}
    st.board.forEach((row,y)=>row.forEach((v,x)=>{if(v){ctx.fillStyle=v;ctx.fillRect(x*CELL+1,y*CELL+1,CELL-2,CELL-2);}}));
    st.piece.shape.forEach((row,y)=>row.forEach((v,x)=>{if(v){ctx.fillStyle=st.piece.color;ctx.fillRect((st.piece.x+x)*CELL+1,(st.piece.y+y)*CELL+1,CELL-2,CELL-2);}}));
  },[]);
  const gameLoop=useCallback((ts)=>{
    const st=stateRef.current;if(!st)return;
    if(ts-st.lastTime>st.speed){
      st.lastTime=ts;
      if(!collides(st.board,st.piece,0,1)){st.piece.y++;}
      else{
        const nb=merge(st.board,st.piece);const{board,cleared}=clearLines(nb);
        st.board=board;st.score+=cleared*100*(cleared>1?cleared:1);st.speed=Math.max(100,600-st.score/5);
        setScore(st.score);st.piece=st.next;st.next=newPiece();
        if(collides(st.board,st.piece)){setGameOver(true);onScore(st.score);return;}
      }
    }
    drawGame();rafRef.current=requestAnimationFrame(gameLoop);
  },[drawGame,onScore]);
  const startGame=()=>{stateRef.current=initState();setScore(0);setGameOver(false);setStarted(true);rafRef.current=requestAnimationFrame(gameLoop);};
  useEffect(()=>()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current);},[]);
  const move=(dx)=>{const st=stateRef.current;if(!st)return;if(!collides(st.board,st.piece,dx,0))st.piece.x+=dx;};
  const drop=()=>{const st=stateRef.current;if(!st)return;while(!collides(st.board,st.piece,0,1))st.piece.y++;};
  const rot=()=>{const st=stateRef.current;if(!st)return;const r=rotate(st.piece.shape);const old=st.piece.shape;st.piece.shape=r;if(collides(st.board,st.piece))st.piece.shape=old;};
  const btnStyle={background:'#3d1f00',border:'2px solid #6b3a1f',color:'#d4a853',padding:'14px 20px',borderRadius:12,fontSize:20,cursor:'pointer'};
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',height:'100%',paddingTop:8}}>
      <div style={{color:'#d4a853',fontSize:16,fontWeight:'bold',marginBottom:8}}>{playerName} | Score: {score}</div>
      <canvas ref={canvasRef} width={COLS*CELL} height={ROWS*CELL} style={{border:'2px solid #6b3a1f',borderRadius:8,maxWidth:'100%'}}/>
      {!started&&!gameOver&&<button style={{...S.btn(),marginTop:16,width:160}} onClick={startGame}>▶ Start</button>}
      {gameOver&&<div style={{textAlign:'center',marginTop:12}}><div style={{color:'#ff6b6b',fontSize:18,fontWeight:'bold'}}>Game Over!</div><div style={{color:'#d4a853',marginBottom:8}}>Score: {score}</div><button style={{...S.btn(),width:160}} onClick={startGame}>▶ Again</button></div>}
      {started&&!gameOver&&(
        <div style={{display:'flex',gap:12,marginTop:16}}>
          <button style={btnStyle} onClick={()=>move(-1)}>◀</button>
          <button style={btnStyle} onClick={rot}>↻</button>
          <button style={btnStyle} onClick={drop}>⬇</button>
          <button style={btnStyle} onClick={()=>move(1)}>▶</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAFÉ RUNNER
// ═══════════════════════════════════════════════════════════════════════════════
function RunnerGame({ playerName, onScore }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const W=320, H=300;
  const LEVELS=[
    {bg:'#0a1628',ground:'#1a3a5c',sky:'Deep Ocean',obstacles:['🦑','🐙','🦐']},
    {bg:'#1a0a00',ground:'#3d1f00',sky:'Café Street',obstacles:['☕','🧁','🍰']},
    {bg:'#1a2a0a',ground:'#2a4a0a',sky:'Forest',obstacles:['🌳','🌿','🍄']},
    {bg:'#0a0a2a',ground:'#1a1a4a',sky:'Night Sky',obstacles:['⭐','🌙','💫']},
    {bg:'#000000',ground:'#1a0a1a',sky:'Space',obstacles:['🪐','☄️','🌠']},
  ];
  const initState=()=>({
    player:{x:60,y:220,vy:0,onGround:true},
    obstacles:[],score:0,speed:3,lastTime:0,spawnTimer:0,level:0,dist:0
  });
  const drawGame=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext('2d');const st=stateRef.current;
    const lv=LEVELS[st.level];
    ctx.fillStyle=lv.bg;ctx.fillRect(0,0,W,H);
    ctx.fillStyle=lv.ground;ctx.fillRect(0,240,W,60);
    ctx.fillStyle='rgba(255,255,255,0.6)';ctx.font='12px serif';ctx.fillText(`${lv.sky} — Lv ${st.level+1}`,8,20);
    ctx.font='30px serif';ctx.fillText('🏃',st.player.x,st.player.y);
    st.obstacles.forEach(o=>{ctx.font='28px serif';ctx.fillText(o.emoji,o.x,o.y);});
  },[]);
  const gameLoop=useCallback((ts)=>{
    const st=stateRef.current;if(!st)return;
    const dt=Math.min(ts-st.lastTime,50);st.lastTime=ts;
    st.player.vy+=0.6;st.player.y+=st.player.vy;
    if(st.player.y>=220){st.player.y=220;st.player.vy=0;st.player.onGround=true;}
    st.dist+=st.speed;st.score=Math.floor(st.dist/10);st.level=Math.min(4,Math.floor(st.score/200));
    st.speed=3+st.score/150;
    setScore(st.score);
    st.spawnTimer+=dt;
    if(st.spawnTimer>1000-st.score*0.3){
      st.spawnTimer=0;
      const lv=LEVELS[st.level];
      st.obstacles.push({x:W+20,y:225,emoji:lv.obstacles[Math.floor(Math.random()*lv.obstacles.length)]});
    }
    st.obstacles=st.obstacles.map(o=>({...o,x:o.x-st.speed})).filter(o=>o.x>-40);
    const px=st.player.x+8,py=st.player.y-20;
    if(st.obstacles.some(o=>Math.abs(o.x+14-px)<22&&Math.abs(o.y-14-py)<20)){
      setGameOver(true);onScore(st.score);return;
    }
    drawGame();rafRef.current=requestAnimationFrame(gameLoop);
  },[drawGame,onScore]);
  const startGame=()=>{stateRef.current=initState();setScore(0);setGameOver(false);setStarted(true);rafRef.current=requestAnimationFrame(gameLoop);};
  useEffect(()=>()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current);},[]);
  const jump=()=>{const st=stateRef.current;if(st&&st.player.onGround){st.player.vy=-12;st.player.onGround=false;}};
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',height:'100%',paddingTop:8}}>
      <div style={{color:'#d4a853',fontSize:16,fontWeight:'bold',marginBottom:8}}>{playerName} | Score: {score}</div>
      <canvas ref={canvasRef} width={W} height={H} style={{border:'2px solid #6b3a1f',borderRadius:8,maxWidth:'100%'}}/>
      {!started&&!gameOver&&<button style={{...S.btn(),marginTop:16,width:160}} onClick={startGame}>▶ Start</button>}
      {gameOver&&<div style={{textAlign:'center',marginTop:12}}><div style={{color:'#ff6b6b',fontSize:18,fontWeight:'bold'}}>Game Over!</div><div style={{color:'#d4a853',marginBottom:8}}>Score: {score}</div><button style={{...S.btn(),width:160}} onClick={startGame}>▶ Again</button></div>}
      {started&&!gameOver&&<button style={{background:'#6b3a1f',border:'2px solid #d4a853',color:'#d4a853',padding:'16px 60px',borderRadius:12,fontSize:20,cursor:'pointer',marginTop:16}} onClick={jump}>⬆ JUMP</button>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPOT THE DIFFERENCE
// ═══════════════════════════════════════════════════════════════════════════════
function SpotDiffGame({ playerName, onScore }) {
  const [score, setScore] = useState(0);
  const [found, setFound] = useState([]);
  const [wrong, setWrong] = useState(null);
  const [timeLeft, setTimeLeft] = useState(90);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [sceneIdx, setSceneIdx] = useState(0);
  const timerRef = useRef(null);

  const SCENES = [
    { title:'☕ The Coffee Bar', w:300, h:220,
      base: [{type:'rect',x:10,y:180,w:280,h:30,fill:'#6b3a1f'},{type:'rect',x:0,y:140,w:300,h:45,fill:'#3d1f00'},{type:'circle',x:60,y:120,r:30,fill:'#d4a853'},{type:'circle',x:150,y:110,r:25,fill:'#8b4513'},{type:'circle',x:240,y:125,r:28,fill:'#a0522d'},{type:'rect',x:20,y:50,w:60,h:80,fill:'#2a1000'},{type:'rect',x:200,y:60,w:70,h:70,fill:'#2a1000'}],
      diffs:[{id:0,x:60,y:120,r:30,desc:'Cup color'},{id:1,x:240,y:125,r:28,desc:'Cup size'},{id:2,x:20,y:50,w:60,h:80,desc:'Left window'},{id:3,x:200,y:60,w:70,h:70,desc:'Right window'},{id:4,x:10,y:180,w:280,h:30,desc:'Counter color'}]
    },
    { title:'🍰 The Cake Display', w:300, h:220,
      base:[{type:'rect',x:0,y:160,w:300,h:60,fill:'#5d3010'},{type:'rect',x:20,y:80,w:80,h:85,fill:'#f5e6d0',stroke:'#8b5a2b'},{type:'rect',x:110,y:90,w:80,h:75,fill:'#ffe4b5',stroke:'#8b5a2b'},{type:'rect',x:200,y:85,w:80,h:80,fill:'#ffc0cb',stroke:'#8b5a2b'},{type:'circle',x:60,y:75,r:20,fill:'#ff6b6b'},{type:'circle',x:150,y:65,r:18,fill:'#d4a853'},{type:'circle',x:240,y:70,r:22,fill:'#8bc34a'}],
      diffs:[{id:0,x:20,y:80,w:80,h:85,desc:'Left cake'},{id:1,x:110,y:90,w:80,h:75,desc:'Middle cake'},{id:2,x:60,y:75,r:20,desc:'Red topping'},{id:3,x:150,y:65,r:18,desc:'Gold topping'},{id:4,x:240,y:70,r:22,desc:'Green topping'}]
    },
    { title:'🌿 The Garden Table', w:300, h:220,
      base:[{type:'rect',x:0,y:0,w:300,h:220,fill:'#0a2a0a'},{type:'ellipse',x:150,y:160,rx:140,ry:30,fill:'#5d3010'},{type:'circle',x:50,y:80,r:35,fill:'#2a6a2a'},{type:'circle',x:150,y:60,r:40,fill:'#1a5a1a'},{type:'circle',x:250,y:75,r:32,fill:'#3a7a3a'},{type:'rect',x:120,y:130,w:60,h:60,fill:'#f5e6d0'},{type:'circle',x:150,y:110,r:15,fill:'#d4a853'}],
      diffs:[{id:0,x:50,y:80,r:35,desc:'Left plant'},{id:1,x:150,y:60,r:40,desc:'Center plant'},{id:2,x:250,y:75,r:32,desc:'Right plant'},{id:3,x:120,y:130,w:60,h:60,desc:'Table cloth'},{id:4,x:150,y:110,r:15,desc:'Cup'}]
    },
  ];

  const scene = SCENES[sceneIdx];

  useEffect(()=>{
    if(started&&!gameOver){
      timerRef.current=setInterval(()=>{
        setTimeLeft(t=>{if(t<=1){clearInterval(timerRef.current);setGameOver(true);onScore(score);return 0;}return t-1;});
      },1000);
    }
    return()=>clearInterval(timerRef.current);
  },[started,gameOver]);

  const startGame=()=>{setFound([]);setWrong(null);setTimeLeft(90);setScore(0);setStarted(true);setGameOver(false);setSceneIdx(Math.floor(Math.random()*SCENES.length));};

  const tapRight=(id)=>{
    if(found.includes(id)) return;
    const nf=[...found,id];setFound(nf);
    const ns=score+20;setScore(ns);
    if(nf.length===5){clearInterval(timerRef.current);setGameOver(true);onScore(ns);}
  };
  const tapWrong=(x,y)=>{setWrong({x,y});setTimeout(()=>setWrong(null),600);};

  const renderScene=(isDiff)=>(
    <svg width={scene.w} height={scene.h} style={{border:'1px solid #6b3a1f',borderRadius:8,cursor:'crosshair'}}
      onClick={(e)=>{
        if(!isDiff) return;
        const rect=e.currentTarget.getBoundingClientRect();
        const sx=e.clientX-rect.left,sy=e.clientY-rect.top;
        const scaleX=scene.w/rect.width,scaleY=scene.h/rect.height;
        const cx=sx*scaleX,cy=sy*scaleY;
        const hit=scene.diffs.find(d=>{
          if(found.includes(d.id)) return false;
          if(d.r) return Math.hypot(cx-d.x,cy-d.y)<d.r+10;
          return cx>=d.x-5&&cx<=d.x+d.w+5&&cy>=d.y-5&&cy<=d.y+d.h+5;
        });
        if(hit) tapRight(hit.id);
        else tapWrong(cx,cy);
      }}>
      {scene.base.map((s,i)=>{
        if(s.type==='rect') return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} fill={s.fill} stroke={s.stroke||'none'} strokeWidth={s.stroke?2:0}/>;
        if(s.type==='circle') return <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={isDiff&&!found.includes(i%5)?'#ff6b6b':s.fill}/>;
        if(s.type==='ellipse') return <ellipse key={i} cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} fill={s.fill}/>;
        return null;
      })}
      {isDiff&&found.map(id=>{
        const d=scene.diffs[id];
        return d.r?<circle key={id} cx={d.x} cy={d.y} r={d.r+4} fill="none" stroke="#8bc34a" strokeWidth={3}/>
          :<rect key={id} x={d.x-2} y={d.y-2} width={(d.w||0)+4} height={(d.h||0)+4} fill="none" stroke="#8bc34a" strokeWidth={3}/>;
      })}
      {isDiff&&wrong&&<>
        <circle cx={wrong.x} cy={wrong.y} r={15} fill="none" stroke="#ff6b6b" strokeWidth={3}/>
        <line x1={wrong.x-10} y1={wrong.y-10} x2={wrong.x+10} y2={wrong.y+10} stroke="#ff6b6b" strokeWidth={2}/>
        <line x1={wrong.x+10} y1={wrong.y-10} x2={wrong.x-10} y2={wrong.y+10} stroke="#ff6b6b" strokeWidth={2}/>
      </>}
    </svg>
  );

  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',height:'100%',padding:'8px 8px 0',overflowY:'auto'}}>
      <div style={{color:'#d4a853',fontSize:15,fontWeight:'bold',marginBottom:4}}>{scene.title}</div>
      <div style={{display:'flex',gap:12,marginBottom:8,fontSize:13,color:'#a07850'}}>
        <span>Found: {found.length}/5</span><span>⏱ {timeLeft}s</span><span>Score: {score}</span>
      </div>
      {!started&&!gameOver&&<button style={{...S.btn(),width:160,marginTop:40}} onClick={startGame}>▶ Start</button>}
      {gameOver&&<div style={{textAlign:'center',marginTop:12}}><div style={{color:found.length===5?'#8bc34a':'#ff6b6b',fontSize:18,fontWeight:'bold'}}>{found.length===5?'All Found! 🎉':'Time Up!'}</div><div style={{color:'#d4a853',marginBottom:8}}>Score: {score}</div><button style={{...S.btn(),width:160}} onClick={startGame}>▶ Again</button></div>}
      {started&&!gameOver&&(
        <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center'}}>
          {renderScene(false)}{renderScene(true)}
        </div>
      )}
      <div style={{fontSize:12,color:'#a07850',marginTop:6}}>Tap differences on the RIGHT image</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAFÉ RACER
// ═══════════════════════════════════════════════════════════════════════════════
function RacingGame({ playerName, onScore }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const W=300, H=420;

  const ROAD_W=200;
  const ROAD_X=(W-ROAD_W)/2;

  const initState=()=>({
    car:{x:W/2-18,y:H-100,w:36,h:56},
    barriers:[],score:0,speed:4,lastTime:0,spawnTimer:0,
    roadOffset:0,
  });

  const drawGame=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext('2d');const st=stateRef.current;
    // sky/background
    const grad=ctx.createLinearGradient(0,0,0,H);grad.addColorStop(0,'#0a0a1a');grad.addColorStop(1,'#1a0a00');
    ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    // road
    ctx.fillStyle='#2a2a2a';ctx.fillRect(ROAD_X,0,ROAD_W,H);
    // road lines (scrolling)
    ctx.strokeStyle='#d4a853';ctx.lineWidth=3;ctx.setLineDash([30,20]);
    ctx.lineDashOffset=-st.roadOffset;
    ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke();
    ctx.setLineDash([]);
    // road edges
    ctx.strokeStyle='#ffffff';ctx.lineWidth=4;
    ctx.beginPath();ctx.moveTo(ROAD_X,0);ctx.lineTo(ROAD_X,H);ctx.stroke();
    ctx.beginPath();ctx.moveTo(ROAD_X+ROAD_W,0);ctx.lineTo(ROAD_X+ROAD_W,H);ctx.stroke();
    // barriers
    st.barriers.forEach(b=>{
      ctx.fillStyle=b.color;ctx.fillRect(b.x,b.y,b.w,b.h);
      ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillRect(b.x+4,b.y+4,b.w-4,b.h-4);
      ctx.fillStyle='#fff';ctx.font='20px serif';ctx.textAlign='center';
      ctx.fillText(b.emoji,b.x+b.w/2,b.y+b.h/2+7);
    });
    // player car (drawn as emoji for charm)
    ctx.font='50px serif';ctx.textAlign='center';
    ctx.fillText('🚗',st.car.x+st.car.w/2,st.car.y+st.car.h-4);
    // score
    ctx.fillStyle='#d4a853';ctx.font='bold 16px Georgia';ctx.textAlign='left';
    ctx.fillText(`Score: ${st.score}`,8,24);
    const spd=Math.floor(60+st.speed*15);
    ctx.fillStyle='#a07850';ctx.font='12px Georgia';
    ctx.fillText(`${spd} km/h`,8,42);
  },[]);

  const BARRIERS=[
    {emoji:'🧱',color:'#8b4513',w:60,h:40},
    {emoji:'🚧',color:'#ff9800',w:70,h:36},
    {emoji:'☕',color:'#3d1f00',w:44,h:44},
    {emoji:'🍰',color:'#f5e6d0',w:44,h:44},
    {emoji:'🪣',color:'#2196f3',w:44,h:44},
  ];

  const gameLoop=useCallback((ts)=>{
    const st=stateRef.current;if(!st)return;
    const dt=Math.min(ts-st.lastTime,50);st.lastTime=ts;
    st.roadOffset=(st.roadOffset+st.speed*2)%50;
    st.score+=1;st.speed=4+st.score/800;
    setScore(st.score);
    st.spawnTimer+=dt;
    const spawnInterval=Math.max(400,1200-st.score*0.3);
    if(st.spawnTimer>spawnInterval){
      st.spawnTimer=0;
      const bType=BARRIERS[Math.floor(Math.random()*BARRIERS.length)];
      // spawn in left or right lane
      const lane=Math.random()<0.5?ROAD_X+10:ROAD_X+ROAD_W/2+10;
      st.barriers.push({...bType,x:lane,y:-60});
    }
    st.barriers=st.barriers.map(b=>({...b,y:b.y+st.speed*2})).filter(b=>b.y<H+60);
    // collision
    const c=st.car;
    const hit=st.barriers.some(b=>c.x+6<b.x+b.w&&c.x+c.w-6>b.x&&c.y+10<b.y+b.h&&c.y+c.h-10>b.y);
    if(hit){setGameOver(true);onScore(st.score);return;}
    drawGame();rafRef.current=requestAnimationFrame(gameLoop);
  },[drawGame,onScore]);

  const startGame=()=>{stateRef.current=initState();setScore(0);setGameOver(false);setStarted(true);rafRef.current=requestAnimationFrame(gameLoop);};
  useEffect(()=>()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current);},[]);

  const moveLeft=()=>{const st=stateRef.current;if(!st)return;st.car.x=Math.max(ROAD_X+4,st.car.x-50);};
  const moveRight=()=>{const st=stateRef.current;if(!st)return;st.car.x=Math.min(ROAD_X+ROAD_W-st.car.w-4,st.car.x+50);};

  const btnStyle={background:'#3d1f00',border:'2px solid #d4a853',color:'#d4a853',
    padding:'18px 32px',borderRadius:14,fontSize:28,cursor:'pointer',userSelect:'none',WebkitUserSelect:'none'};

  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',height:'100%',paddingTop:8}}>
      <div style={{color:'#d4a853',fontSize:16,fontWeight:'bold',marginBottom:8}}>{playerName}</div>
      <canvas ref={canvasRef} width={W} height={H} style={{border:'2px solid #6b3a1f',borderRadius:8,maxWidth:'100%'}}/>
      {!started&&!gameOver&&<button style={{...S.btn(),marginTop:16,width:160}} onClick={startGame}>▶ Start</button>}
      {gameOver&&<div style={{textAlign:'center',marginTop:12}}><div style={{color:'#ff6b6b',fontSize:18,fontWeight:'bold'}}>Crash! 💥</div><div style={{color:'#d4a853',marginBottom:8}}>Score: {score}</div><button style={{...S.btn(),width:160}} onClick={startGame}>▶ Again</button></div>}
      {started&&!gameOver&&(
        <div style={{display:'flex',gap:24,marginTop:16}}>
          <button style={btnStyle} onPointerDown={moveLeft} onPointerUp={()=>{}} onTouchStart={e=>{e.preventDefault();moveLeft();}}>◀</button>
          <button style={btnStyle} onPointerDown={moveRight} onPointerUp={()=>{}} onTouchStart={e=>{e.preventDefault();moveRight();}}>▶</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAFÉ MYSTERY (social deduction - placeholder shell)
// ═══════════════════════════════════════════════════════════════════════════════
function CafeMysteryGame({ playerName, onBack }) {
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',padding:24,textAlign:'center'}}>
      <div style={{fontSize:48,marginBottom:16}}>☕</div>
      <div style={{fontSize:20,fontWeight:'bold',color:'#d4a853',marginBottom:8}}>Café Mystery</div>
      <div style={{color:'#a07850',marginBottom:24}}>The social deduction game is loaded from CafeGame.js — make sure that file is in your src/pages/ folder!</div>
      <button style={{...S.btn(),width:160}} onClick={onBack}>← Back</button>
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
  const [username, setUsername] = useState(() => { try { return localStorage.getItem('cafeGameUser') || null; } catch { return null; } });
  const [showName, setShowName] = useState(false);
  const [pendingGame, setPendingGame] = useState(null);
  const [playerName, setPlayerName] = useState(() => { try { return localStorage.getItem('cafePlayerName') || ''; } catch { return ''; } });
  const [localBests, setLocalBests] = useState(() => { try { return JSON.parse(localStorage.getItem('cafeBests') || '{}'); } catch { return {}; } });

  const [tab, setTab] = useState('games');

  const saveLocal = (gameId, score) => {
    setLocalBests(prev => {
      const upd = { ...prev, [gameId]: Math.max(prev[gameId] || 0, score) };
      try { localStorage.setItem('cafeBests', JSON.stringify(upd)); } catch {}
      return upd;
    });
  };

  const handleGameSelect = (game) => {
    if (game.id === 'cafemystery') { setActiveGame(game); return; }
    if (game.id === 'zombie') { setActiveGame(game); return; }
    setPendingGame(game);
    setShowName(true);
  };

  const handleNameStart = (name) => {
    setPlayerName(name);
    try { localStorage.setItem('cafePlayerName', name); } catch {}
    setShowName(false);
    setActiveGame(pendingGame);
  };

  const handleScore = async (gameId, score) => {
    saveLocal(gameId, score);
    if (username && score > 0) {
      try { await saveScore(username, gameId, score); } catch (e) { console.error(e); }
    }
  };

  const handleAuth = (user) => {
    setUsername(user);
    try { localStorage.setItem('cafeGameUser', user); } catch {}
    setShowAuth(false);
  };

  const handleLogout = () => {
    setUsername(null);
    try { localStorage.removeItem('cafeGameUser'); } catch {}
  };

  // ── render active game ──
  if (activeGame) {
    const isSpecial = activeGame.id === 'cafemystery' || activeGame.id === 'zombie';
    return (
      <div style={S.fullscreen}>
        <div style={S.gameBar}>
          <button style={S.backBtn} onClick={() => setActiveGame(null)}>← Exit</button>
          <span style={S.gameTitle}>{activeGame.emoji} {activeGame.title}</span>
          <button style={S.lbBtn} onClick={() => { setActiveGame(null); setShowLB(true); }}>🏆</button>
        </div>
        <div style={S.gameContent}>
          {activeGame.id === 'snake' && <SnakeGame playerName={playerName} onScore={s=>handleScore('snake',s)} />}
          {activeGame.id === 'tetris' && <TetrisGame playerName={playerName} onScore={s=>handleScore('tetris',s)} />}
          {activeGame.id === 'runner' && <RunnerGame playerName={playerName} onScore={s=>handleScore('runner',s)} />}
          {activeGame.id === 'spotdiff' && <SpotDiffGame playerName={playerName} onScore={s=>handleScore('spotdiff',s)} />}
          {activeGame.id === 'racing' && <RacingGame playerName={playerName} onScore={s=>handleScore('racing',s)} />}
          {activeGame.id === 'zombie' && <ZombieGame playerName={playerName} username={username} onScore={s=>handleScore('zombie',s)} onBack={()=>setActiveGame(null)} />}
          {activeGame.id === 'cafemystery' && <CafeMysteryGame playerName={playerName} onBack={()=>setActiveGame(null)} />}
        </div>
      </div>
    );
  }

  // ── main grid ──
  return (
    <div style={S.wrap}>
      {showAuth && <AuthModal onAuth={handleAuth} onClose={() => setShowAuth(false)} />}
      {showName && pendingGame && <NameModal gameTitle={`${pendingGame.emoji} ${pendingGame.title}`} username={username} onStart={handleNameStart} onClose={()=>setShowName(false)} />}
      {showLB && <LeaderboardModal onClose={()=>setShowLB(false)} username={username} />}

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

      {/* auth bar */}
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

      {/* game grid */}
      <div style={S.grid}>
        {GAME_LIST.map(game => (
          <div key={game.id} style={S.card} onClick={() => handleGameSelect(game)}
            onMouseEnter={e=>e.currentTarget.style.transform='scale(1.03)'}
            onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
            <div style={S.cardIcon}>{game.emoji}</div>
            <div style={S.cardTitle}>{game.title}</div>
            <div style={S.cardSub}>{game.sub}</div>
            {localBests[game.id] > 0 && (
              <div style={S.cardBest}>Best: {localBests[game.id]}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
