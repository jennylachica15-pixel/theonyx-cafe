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
  { id: 'runner',   emoji: '🍄', title: 'Mario Runner',       sub: 'Jump like Mario!' },
  { id: 'racing',   emoji: '🏎️', title: 'Café Racer',         sub: 'Dodge the barriers' },
  { id: 'zombie',   emoji: '🧟', title: 'Zombie Barista',     sub: 'Multiplayer survival' },
  { id: 'guessword',   emoji: '🔤', title: 'Guess the Word',  sub: 'Clues & letters' },
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
  const containerRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const COLS=12,ROWS=30;
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
  const btnStyle={background:'#3d1f00',border:'2px solid #6b3a1f',color:'#d4a853',padding:'14px 22px',borderRadius:10,fontSize:20,cursor:'pointer',userSelect:'none',WebkitUserSelect:'none'};
  return(
    <div ref={containerRef} style={{display:'flex',flexDirection:'column',height:'100%',background:'#1a0a00'}}>
      <div style={{color:'#d4a853',fontSize:13,fontWeight:'bold',textAlign:'center',padding:'3px 0',flexShrink:0}}>{playerName} | Score: {score}</div>
      <canvas ref={canvasRef} style={{width:'100%',flex:1,display:'block'}}/>
      {!started&&!gameOver&&<div style={{textAlign:'center',padding:12}}><button style={{...S.btn(),width:160}} onClick={startGame}>▶ Start</button></div>}
      {gameOver&&<div style={{textAlign:'center',padding:8,flexShrink:0}}><div style={{color:'#ff6b6b',fontSize:16,fontWeight:'bold'}}>Game Over!</div><div style={{color:'#d4a853',marginBottom:6}}>Score: {score}</div><button style={{...S.btn(),width:160}} onClick={startGame}>▶ Again</button></div>}
      {started&&!gameOver&&(
        <div style={{display:'flex',gap:8,padding:'6px 8px',justifyContent:'center',background:'#0a0500',flexShrink:0}}>
          <button style={btnStyle} onPointerDown={e=>{e.preventDefault();move(-1);}}>◀</button>
          <button style={btnStyle} onPointerDown={e=>{e.preventDefault();rot();}}>↻</button>
          <button style={btnStyle} onPointerDown={e=>{e.preventDefault();drop();}}>⬇</button>
          <button style={btnStyle} onPointerDown={e=>{e.preventDefault();move(1);}}>▶</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARIO RUNNER
// ═══════════════════════════════════════════════════════════════════════════════
function RunnerGame({ playerName, onScore }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const W=320, H=380;
  const GY=300; // ground y

  // Mario pixel art draw
  const drawMario = (ctx, x, y, frame) => {
    const s=18;
    // shadow
    ctx.fillStyle='rgba(0,0,0,0.2)';
    ctx.beginPath();ctx.ellipse(x,y+2,s*0.6,4,0,0,Math.PI*2);ctx.fill();
    // legs (animated)
    const legOff = frame%2===0?3:-3;
    ctx.fillStyle='#c84b00';
    ctx.fillRect(x-s*0.35,y-s*0.5+legOff,s*0.28,s*0.5);
    ctx.fillRect(x+s*0.07,y-s*0.5-legOff,s*0.28,s*0.5);
    // shoes
    ctx.fillStyle='#5a3010';
    ctx.fillRect(x-s*0.42,y-s*0.05+legOff,s*0.38,s*0.18);
    ctx.fillRect(x+s*0.04,y-s*0.05-legOff,s*0.38,s*0.18);
    // body/overalls
    ctx.fillStyle='#e52c00';
    ctx.fillRect(x-s*0.42,y-s*1.1,s*0.84,s*0.6);
    ctx.fillStyle='#0066cc';
    ctx.fillRect(x-s*0.32,y-s*1.15,s*0.64,s*0.35);
    // overall straps
    ctx.fillStyle='#ffd700';
    ctx.fillRect(x-s*0.28,y-s*1.1,s*0.12,s*0.05);
    ctx.fillRect(x+s*0.16,y-s*1.1,s*0.12,s*0.05);
    // arms
    ctx.fillStyle='#e52c00';
    ctx.fillRect(x-s*0.65,y-s*1.05,s*0.26,s*0.38);
    ctx.fillRect(x+s*0.38,y-s*1.05,s*0.26,s*0.38);
    // hands
    ctx.fillStyle='#ffe0b0';
    ctx.fillRect(x-s*0.65,y-s*0.7,s*0.26,s*0.22);
    ctx.fillRect(x+s*0.38,y-s*0.7,s*0.26,s*0.22);
    // head
    ctx.fillStyle='#ffe0b0';
    ctx.fillRect(x-s*0.38,y-s*1.8,s*0.76,s*0.65);
    // hat
    ctx.fillStyle='#e52c00';
    ctx.fillRect(x-s*0.5,y-s*2.0,s,s*0.28);
    ctx.fillRect(x-s*0.28,y-s*2.28,s*0.56,s*0.3);
    // eyes
    ctx.fillStyle='#333';
    ctx.fillRect(x-s*0.2,y-s*1.55,s*0.14,s*0.16);
    ctx.fillRect(x+s*0.06,y-s*1.55,s*0.14,s*0.16);
    // mustache
    ctx.fillStyle='#5a2d00';
    ctx.fillRect(x-s*0.32,y-s*1.3,s*0.64,s*0.14);
  };

  const drawGoomba = (ctx, x, y) => {
    const s=16;
    ctx.fillStyle='rgba(0,0,0,0.2)';ctx.beginPath();ctx.ellipse(x,y+2,s*0.7,4,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#8b4513';
    ctx.beginPath();ctx.ellipse(x,y-s*0.3,s*0.7,s*0.55,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#a0522d';
    ctx.fillRect(x-s*0.6,y-s*0.35,s*0.3,s*0.55);
    ctx.fillRect(x+s*0.3,y-s*0.35,s*0.3,s*0.55);
    ctx.fillStyle='#ffe0b0';
    ctx.beginPath();ctx.ellipse(x,y-s*0.8,s*0.6,s*0.55,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#333';
    ctx.fillRect(x-s*0.3,y-s*0.95,s*0.2,s*0.22);
    ctx.fillRect(x+s*0.1,y-s*0.95,s*0.2,s*0.22);
    ctx.fillStyle='#fff';
    ctx.fillRect(x-s*0.4,y-s*0.6,s*0.22,s*0.18);
    ctx.fillRect(x+s*0.18,y-s*0.6,s*0.22,s*0.18);
  };

  const drawPipe = (ctx, x, y, h) => {
    const w=42;
    ctx.fillStyle='#1a8a1a';
    ctx.fillRect(x-w/2,y-h,w,h);
    ctx.fillStyle='#22aa22';
    ctx.fillRect(x-w/2+3,y-h,w-6,h-4);
    ctx.fillStyle='#0d6b0d';
    ctx.fillRect(x-w/2-4,y-h-16,w+8,18);
    ctx.fillStyle='#1a8a1a';
    ctx.fillRect(x-w/2-4+3,y-h-14,w+8-6,14);
  };

  const drawCoin = (ctx, x, y, frame) => {
    const pulse = Math.abs(Math.sin(frame*0.15));
    ctx.fillStyle='#ffd700';
    ctx.beginPath();ctx.ellipse(x,y,10*pulse+3,12,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ffee88';
    ctx.beginPath();ctx.ellipse(x,y,5*pulse+1,8,0,0,Math.PI*2);ctx.fill();
  };

  const LEVELS=[
    {skyTop:'#5c94fc',skyBot:'#5c94fc',ground:'#c84b00',groundTop:'#6ab04c',pipes:true,name:'World 1-1'},
    {skyTop:'#ff9a3c',skyBot:'#ff6622',ground:'#a04020',groundTop:'#8b6914',pipes:true,name:'World 1-2'},
    {skyTop:'#1a1a3a',skyBot:'#0a0a2a',ground:'#4040aa',groundTop:'#8080ff',pipes:false,name:'World 1-3 Night'},
    {skyTop:'#ff4444',skyBot:'#aa0000',ground:'#555',groundTop:'#888',pipes:true,name:'World 1-4 Castle'},
    {skyTop:'#001133',skyBot:'#003366',ground:'#001a44',groundTop:'#4488ff',pipes:false,name:'World 2-1 Sky'},
  ];

  const initState=()=>({
    player:{x:70,y:GY,vy:0,onGround:true,frame:0},
    obstacles:[],coins:[],score:0,speed:3.2,
    lastTime:0,spawnTimer:0,coinTimer:0,
    level:0,dist:0,lives:3,cloudX:[40,140,240],
    bgX:0,
  });

  const drawGame=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext('2d');
    const st=stateRef.current;if(!st)return;
    const lv=LEVELS[st.level];
    // sky gradient
    const grad=ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,lv.skyTop);grad.addColorStop(1,lv.skyBot);
    ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    // clouds (day levels)
    if(st.level<2||st.level===4){
      st.cloudX.forEach(cx=>{
        ctx.fillStyle='rgba(255,255,255,0.9)';
        ctx.beginPath();ctx.ellipse(cx,60,28,18,0,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.ellipse(cx-20,68,18,14,0,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.ellipse(cx+20,68,18,14,0,0,Math.PI*2);ctx.fill();
      });
    }
    // stars (night level)
    if(st.level===2){
      ctx.fillStyle='#fff';
      for(let i=0;i<20;i++){
        const sx=(i*73+st.bgX*0.3)%W;
        const sy=(i*37)%200;
        ctx.fillRect(sx,sy,2,2);
      }
    }
    // ground
    ctx.fillStyle=lv.ground;ctx.fillRect(0,GY+8,W,H-GY-8);
    ctx.fillStyle=lv.groundTop;ctx.fillRect(0,GY,W,14);
    // ground bricks
    ctx.strokeStyle='rgba(0,0,0,0.2)';ctx.lineWidth=1;
    for(let i=0;i<W;i+=32)ctx.strokeRect(i,GY,32,14);
    for(let i=0;i<W;i+=32)ctx.strokeRect(i,GY+14,32,14);
    // coins
    st.coins.forEach(c=>drawCoin(ctx,c.x,c.y,c.frame||0));
    // obstacles
    st.obstacles.forEach(o=>{
      if(o.type==='pipe') drawPipe(ctx,o.x,GY,o.h);
      else drawGoomba(ctx,o.x,o.y);
    });
    // mario
    drawMario(ctx,st.player.x,st.player.y,st.player.frame);
    // HUD bar at top
    ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(0,0,W,28);
    ctx.fillStyle='#fff';ctx.font='bold 12px Arial';ctx.textAlign='left';
    ctx.fillText(`MARIO`,8,18);
    ctx.textAlign='center';
    ctx.fillText(`⭐ ${st.score}`,W/2,18);
    ctx.fillText(lv.name,W/2,H-8);
    ctx.textAlign='right';
    ctx.fillText(`❤️ ${'♥'.repeat(st.lives)}`,W-8,18);
  },[]);

  const gameLoop=useCallback((ts)=>{
    const st=stateRef.current;if(!st)return;
    const dt=Math.min(ts-st.lastTime,50);st.lastTime=ts;
    st.player.frame++;
    st.bgX+=st.speed;
    st.cloudX=st.cloudX.map(cx=>(cx-st.speed*0.4+W)%W);
    // gravity
    st.player.vy+=0.55;st.player.y+=st.player.vy;
    if(st.player.y>=GY){st.player.y=GY;st.player.vy=0;st.player.onGround=true;}
    st.dist+=st.speed;st.score=Math.floor(st.dist/8)+st.coins.filter(c=>c.collected).length*50;
    st.level=Math.min(4,Math.floor(st.dist/1200));
    st.speed=3.2+st.dist/2000;
    setScore(st.score);
    // spawn obstacles
    st.spawnTimer+=dt;
    const interval=Math.max(800,2200-st.dist*0.15);
    if(st.spawnTimer>interval){
      st.spawnTimer=0;
      const isPipe=LEVELS[st.level].pipes&&Math.random()<0.5;
      if(isPipe){
        const h=40+Math.floor(Math.random()*60);
        st.obstacles.push({type:'pipe',x:W+30,h,w:42});
      } else {
        st.obstacles.push({type:'goomba',x:W+20,y:GY,w:28,h:28});
      }
    }
    // spawn coins
    st.coinTimer+=dt;
    if(st.coinTimer>1400){st.coinTimer=0;st.coins.push({x:W+10,y:GY-50-Math.random()*80,frame:0,collected:false});}
    // move obstacles
    st.obstacles=st.obstacles.map(o=>({...o,x:o.x-st.speed})).filter(o=>o.x>-60);
    st.coins=st.coins.map(c=>({...c,x:c.x-st.speed,frame:c.frame+1})).filter(c=>c.x>-30);
    // collect coins
    st.coins.forEach(c=>{
      if(!c.collected&&Math.abs(c.x-st.player.x)<20&&Math.abs(c.y-st.player.y)<28){
        c.collected=true;st.score+=50;setScore(st.score);
      }
    });
    st.coins=st.coins.filter(c=>!c.collected);
    // collisions
    const px=st.player.x, py=st.player.y;
    const hit=st.obstacles.some(o=>{
      if(o.type==='pipe') return Math.abs(o.x-px)<26&&py>GY-o.h-10&&py<=GY+5;
      return Math.abs(o.x-px)<22&&Math.abs(o.y-py)<26;
    });
    if(hit){
      st.lives--;
      setLives(st.lives);
      if(st.lives<=0){setGameOver(true);onScore(st.score);return;}
      // respawn
      st.player.x=70;st.player.y=GY;st.player.vy=0;
      st.obstacles=[];
    }
    drawGame();rafRef.current=requestAnimationFrame(gameLoop);
  },[drawGame,onScore]);

  const startGame=()=>{stateRef.current=initState();setScore(0);setLives(3);setGameOver(false);setStarted(true);rafRef.current=requestAnimationFrame(gameLoop);};
  useEffect(()=>()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current);},[]);
  const jump=()=>{const st=stateRef.current;if(st&&st.player.onGround){st.player.vy=-13;st.player.onGround=false;}};

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#1a0a00',overflow:'hidden'}}>
      <canvas ref={canvasRef} width={W} height={H} style={{width:'100%',flex:1,display:'block',imageRendering:'pixelated'}}/>
      {!started&&!gameOver&&(
        <div style={{position:'absolute',top:'40%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center'}}>
          <div style={{background:'rgba(0,0,0,0.8)',border:'4px solid #fff',borderRadius:8,padding:'20px 32px',fontFamily:"'Arial Black',Arial,sans-serif"}}>
            <div style={{fontSize:22,color:'#ffd700',fontWeight:900,marginBottom:4}}>MARIO RUNNER</div>
            <div style={{fontSize:13,color:'#fff',marginBottom:16}}>Jump pipes & collect coins!</div>
            <button onClick={startGame} style={{background:'linear-gradient(180deg,#44dd44,#22aa22)',border:'none',borderRadius:8,padding:'12px 28px',color:'#fff',fontSize:16,fontWeight:900,cursor:'pointer',boxShadow:'0 4px 0 #116611',textTransform:'uppercase'}}>▶ START</button>
          </div>
        </div>
      )}
      {gameOver&&(
        <div style={{position:'absolute',top:'40%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center'}}>
          <div style={{background:'rgba(0,0,0,0.88)',border:'4px solid #ff4444',borderRadius:8,padding:'20px 32px',fontFamily:"'Arial Black',Arial,sans-serif"}}>
            <div style={{fontSize:22,color:'#ff4444',fontWeight:900,marginBottom:4}}>GAME OVER</div>
            <div style={{fontSize:14,color:'#ffd700',marginBottom:16}}>Score: {score}</div>
            <button onClick={startGame} style={{background:'linear-gradient(180deg,#ff4444,#cc0000)',border:'none',borderRadius:8,padding:'12px 28px',color:'#fff',fontSize:15,fontWeight:900,cursor:'pointer',boxShadow:'0 4px 0 #880000',textTransform:'uppercase'}}>▶ TRY AGAIN</button>
          </div>
        </div>
      )}
      {started&&!gameOver&&(
        <button
          onPointerDown={e=>{e.preventDefault();jump();}}
          onTouchStart={e=>{e.preventDefault();jump();}}
          style={{background:'linear-gradient(180deg,#e52c00,#aa1100)',border:'4px solid #ffd700',color:'#ffd700',padding:'18px',fontSize:22,fontWeight:900,cursor:'pointer',fontFamily:"'Arial Black',Arial,sans-serif",letterSpacing:1,boxShadow:'0 5px 0 #880000',flexShrink:0,touchAction:'none',userSelect:'none',WebkitUserSelect:'none'}}>
          🍄 JUMP
        </button>
      )}
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
  const W=320, H=480;
  const GRASS_W=30;
  const ROAD_X=GRASS_W, ROAD_W=W-GRASS_W*2;
  const LANES=4;
  const LANE_W=ROAD_W/LANES;
  const laneX=(l)=>ROAD_X+l*LANE_W+LANE_W/2;

  const CAR_COLORS=['#ff3333','#3399ff','#ffcc00','#44cc44','#cc44ff','#ff8800','#00cccc','#ff66aa'];
  const drawCar=(ctx,x,y,color,isPlayer=false)=>{
    const w=22,h=34;
    // shadow
    ctx.fillStyle='rgba(0,0,0,0.3)';
    ctx.beginPath();ctx.ellipse(x,y+h*0.4,w*0.45,h*0.12,0,0,Math.PI*2);ctx.fill();
    // body
    ctx.fillStyle=color;
    ctx.beginPath();ctx.roundRect(x-w/2,y-h/2,w,h,5);ctx.fill();
    // windshield
    ctx.fillStyle='rgba(200,240,255,0.85)';
    ctx.beginPath();ctx.roundRect(x-w*0.35,y-h*0.38,w*0.7,h*0.22,3);ctx.fill();
    // rear window
    ctx.fillStyle='rgba(200,240,255,0.7)';
    ctx.beginPath();ctx.roundRect(x-w*0.32,y+h*0.12,w*0.64,h*0.18,3);ctx.fill();
    // wheels
    ctx.fillStyle='#222';
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sy])=>{
      ctx.beginPath();ctx.roundRect(x+sx*(w*0.42)-4,y+sy*(h*0.3)-5,8,10,2);ctx.fill();
      ctx.fillStyle='#555';ctx.beginPath();ctx.roundRect(x+sx*(w*0.42)-2.5,y+sy*(h*0.3)-3.5,5,7,1);ctx.fill();
      ctx.fillStyle='#222';
    });
    // headlights (player only)
    if(isPlayer){
      ctx.fillStyle='#ffffaa';
      ctx.beginPath();ctx.ellipse(x-w*0.28,y-h*0.46,3,2,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(x+w*0.28,y-h*0.46,3,2,0,0,Math.PI*2);ctx.fill();
    }
    // roof stripe
    ctx.fillStyle='rgba(255,255,255,0.25)';
    ctx.beginPath();ctx.roundRect(x-w*0.15,y-h*0.35,w*0.3,h*0.6,3);ctx.fill();
  };

  const initState=()=>({
    car:{lane:1,x:laneX(1),y:H-70},
    traffic:[],coffees:[],score:0,speed:1.5,lastTime:0,spawnTimer:0,coffeeTimer:0,
    lineOffset:0, targetX:laneX(1),
  });

  const drawGame=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext('2d');const st=stateRef.current;
    // grass
    ctx.fillStyle='#2d7a2d';ctx.fillRect(0,0,W,H);
    // grass texture
    ctx.fillStyle='#267026';
    for(let i=0;i<H;i+=12){ctx.fillRect(0,i,GRASS_W,6);ctx.fillRect(W-GRASS_W,i,GRASS_W,6);}
    // grass edge decoration
    ctx.fillStyle='#1a5c1a';
    ctx.fillRect(GRASS_W-4,0,4,H);ctx.fillRect(W-GRASS_W,0,4,H);
    // road base
    ctx.fillStyle='#404040';ctx.fillRect(ROAD_X,0,ROAD_W,H);
    // road texture
    ctx.fillStyle='#383838';
    for(let i=0;i<H;i+=20){ctx.fillRect(ROAD_X,i,ROAD_W,10);}
    // lane dividers (dashed, scrolling)
    ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.setLineDash([25,18]);
    ctx.lineDashOffset=-st.lineOffset;
    for(let l=1;l<LANES;l++){
      ctx.strokeStyle= l===LANES/2 ? '#ffff00':'#ffffff';
      ctx.lineWidth= l===LANES/2 ? 3:1.5;
      ctx.beginPath();ctx.moveTo(ROAD_X+l*LANE_W,0);ctx.lineTo(ROAD_X+l*LANE_W,H);ctx.stroke();
    }
    ctx.setLineDash([]);
    // road edges white line
    ctx.strokeStyle='#ffffff';ctx.lineWidth=3;ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(ROAD_X,0);ctx.lineTo(ROAD_X,H);ctx.stroke();
    ctx.beginPath();ctx.moveTo(ROAD_X+ROAD_W,0);ctx.lineTo(ROAD_X+ROAD_W,H);ctx.stroke();
    // traffic cars
    st.traffic.forEach(t=>drawCar(ctx,t.x,t.y,t.color));
    // coffee collectibles — glowing
    (st.coffees||[]).forEach(c=>{
      const pulse=0.8+0.2*Math.sin(Date.now()/300+c.id);
      ctx.save();
      ctx.shadowColor='#ffcc00';ctx.shadowBlur=10*pulse;
      ctx.font='18px serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('☕',c.x,c.y);
      ctx.restore();
      // sparkle ring
      ctx.strokeStyle=`rgba(255,200,0,${0.4*pulse})`;ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(c.x,c.y,14*pulse,0,Math.PI*2);ctx.stroke();
    });
    // player car (smooth x)
    st.car.x+=(st.targetX-st.car.x)*0.18;
    drawCar(ctx,st.car.x,st.car.y,'#ff3333',true);
    // speed overlay
    ctx.fillStyle='rgba(0,0,0,0.45)';ctx.fillRect(ROAD_X,0,60,32);
    ctx.fillStyle='#ffff00';ctx.font='bold 12px Arial';ctx.textAlign='left';
    const spd=Math.floor(80+st.speed*20);
    ctx.fillText(`${spd}km/h`,ROAD_X+5,20);
  },[]);

  const [collected,setCollected]=useState(0);
  const gameLoop=useCallback((ts)=>{
    const st=stateRef.current;if(!st)return;
    const dt=Math.min(ts-st.lastTime,50);st.lastTime=ts;
    st.lineOffset=(st.lineOffset+st.speed*1.5)%(25+18);
    st.score+=1;st.speed=1.5+st.score/900;
    setScore(st.score);
    // spawn traffic
    st.spawnTimer+=dt;
    const interval=Math.max(350,1100-st.score*0.25);
    if(st.spawnTimer>interval){
      st.spawnTimer=0;
      const lane=Math.floor(Math.random()*LANES);
      const color=CAR_COLORS[Math.floor(Math.random()*CAR_COLORS.length)];
      st.traffic.push({x:laneX(lane),y:-40,lane,color});
    }
    // spawn coffee
    st.coffeeTimer=(st.coffeeTimer||0)+dt;
    if(st.coffeeTimer>2200){
      st.coffeeTimer=0;
      const lane=Math.floor(Math.random()*LANES);
      st.coffees=[...(st.coffees||[]),{x:laneX(lane),y:-30,id:Math.random()}];
    }
    st.traffic=st.traffic.map(t=>({...t,y:t.y+st.speed*2.2})).filter(t=>t.y<H+60);
    // move & collect coffee
    const c=st.car;
    st.coffees=(st.coffees||[]).map(cf=>({...cf,y:cf.y+st.speed*2.2})).filter(cf=>{
      if(cf.y>H+40)return false;
      if(Math.abs(cf.x-c.x)<22&&Math.abs(cf.y-c.y)<22){
        st.score+=50;setScore(st.score);
        setCollected(n=>n+1);
        return false;
      }
      return true;
    });
    // collision with traffic
    const hit=st.traffic.some(t=>Math.abs(t.x-c.x)<20&&Math.abs(t.y-c.y)<32);
    if(hit){setGameOver(true);onScore(st.score);return;}
    drawGame();rafRef.current=requestAnimationFrame(gameLoop);
  },[drawGame,onScore]);

  const startGame=()=>{stateRef.current=initState();setScore(0);setGameOver(false);setStarted(true);rafRef.current=requestAnimationFrame(gameLoop);};
  useEffect(()=>()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current);},[]);

  const lastMoveRef=useRef(0);
  const moveLeft=()=>{const now=Date.now();if(now-lastMoveRef.current<220)return;lastMoveRef.current=now;const st=stateRef.current;if(!st)return;const nl=Math.max(0,st.car.lane-1);st.car.lane=nl;st.targetX=laneX(nl);};
  const moveRight=()=>{const now=Date.now();if(now-lastMoveRef.current<220)return;lastMoveRef.current=now;const st=stateRef.current;if(!st)return;const nl=Math.min(LANES-1,st.car.lane+1);st.car.lane=nl;st.targetX=laneX(nl);};

  const btnStyle={background:'linear-gradient(180deg,#555,#333)',border:'2px solid #888',color:'#fff',
    padding:'18px 36px',borderRadius:14,fontSize:26,cursor:'pointer',
    userSelect:'none',WebkitUserSelect:'none',boxShadow:'0 4px 0 #111',fontFamily:"'Arial Black',Arial,sans-serif"};

  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',height:'100%',background:'#1a1a1a',overflow:'hidden'}}>
      <div style={{color:'#d4a853',fontSize:14,fontWeight:'bold',padding:'4px 0'}}>{playerName} — Score: {score} ☕×{collected}</div>
      <canvas ref={canvasRef} width={W} height={H} style={{maxWidth:'100%',display:'block',flex:1}}/>
      {!started&&!gameOver&&<button style={{...S.btn(),marginTop:16,width:160}} onClick={startGame}>▶ Start</button>}
      {gameOver&&(
        <div style={{textAlign:'center',marginTop:12}}>
          <div style={{color:'#ff6b6b',fontSize:20,fontWeight:'bold'}}>CRASH! 💥</div>
          <div style={{color:'#d4a853',marginBottom:8}}>Score: {score}</div>
          <button style={{...S.btn(),width:160}} onClick={startGame}>▶ Again</button>
        </div>
      )}
      {started&&!gameOver&&(
        <div style={{display:'flex',gap:20,padding:'10px 0'}}>
          <button style={btnStyle} onPointerDown={e=>{e.preventDefault();moveLeft();}} onTouchStart={e=>{e.preventDefault();moveLeft();}}>◀</button>
          <button style={btnStyle} onPointerDown={e=>{e.preventDefault();moveRight();}} onTouchStart={e=>{e.preventDefault();moveRight();}}>▶</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAFÉ MYSTERY (social deduction - placeholder shell)
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// GUESS THE WORD
// ═══════════════════════════════════════════════════════════════════════════════
const WORD_LIST = [
  { word:'ESPRESSO', desc:'A strong concentrated coffee shot brewed under pressure', clue:'Type of coffee ☕', category:'Drinks' },
  { word:'LATTE',    desc:'A coffee drink made with steamed milk and a shot of espresso', clue:'Has the word "milk" in Italian', category:'Drinks' },
  { word:'CAPPUCCINO',desc:'An espresso-based drink with equal parts espresso, steamed milk, and foam', clue:'Named after Italian friars 🇮🇹', category:'Drinks' },
  { word:'MATCHA',   desc:'A finely ground powder of specially grown green tea leaves', clue:'Bright green color 🍵', category:'Drinks' },
  { word:'FRAPPE',   desc:'A blended iced coffee drink topped with whipped cream', clue:'Cold and blended with ice 🧊', category:'Drinks' },
  { word:'MACCHIATO',desc:'An espresso coffee drink with a small amount of milk', clue:'Means "stained" in Italian', category:'Drinks' },
  { word:'MOCHA',    desc:'A chocolate-flavored variant of a latte', clue:'Has chocolate in it 🍫', category:'Drinks' },
  { word:'CROISSANT',desc:'A buttery, flaky viennoiserie pastry shaped like a crescent', clue:'French pastry, crescent shaped 🥐', category:'Food' },
  { word:'TIRAMISU', desc:'An Italian dessert made of ladyfingers dipped in coffee', clue:'Italian dessert, means "pick me up"', category:'Food' },
  { word:'BARISTA',  desc:'A person who makes and serves coffee in a café', clue:'The person who makes your coffee ☕', category:'Café' },
  { word:'AFFOGATO', desc:'A coffee-based dessert: a scoop of ice cream drowned in hot espresso', clue:'Ice cream + espresso 🍨', category:'Drinks' },
  { word:'AMERICANO',desc:'A style of coffee prepared by diluting an espresso with hot water', clue:'Named after Americans in WWII 🇺🇸', category:'Drinks' },
  { word:'MUFFIN',   desc:'A small domed spongy cake baked in a cup-shaped pan', clue:'Common café baked treat 🧁', category:'Food' },
  { word:'WAFFLE',   desc:'A batter-based food cooked in a waffle iron with a grid pattern', clue:'Has a grid pattern, often with syrup 🧇', category:'Food' },
  { word:'CHEESECAKE',desc:'A sweet dessert with a smooth creamy filling on a biscuit base', clue:'A dessert with cream cheese 🍰', category:'Food' },
  { word:'BROWNIE',  desc:'A flat baked chocolate dessert square, denser than cake', clue:'Chocolate square dessert 🍫', category:'Food' },
  { word:'SMOOTHIE', desc:'A thick blended drink made from fresh fruits and vegetables', clue:'Blended fruits in a cup 🍓', category:'Drinks' },
  { word:'PANCAKE',  desc:'A flat round cake made from batter and cooked on a griddle', clue:'Flat, round, served with syrup 🥞', category:'Food' },
  { word:'SANDWICH', desc:'Two slices of bread with a filling between them', clue:'Bread with something in the middle 🥪', category:'Food' },
  { word:'PLAYLIST', desc:'A curated list of songs that play in sequence', clue:'Café background music 🎵', category:'Café' },
  { word:'COASTER',  desc:'A small mat placed under a cup or glass to protect the table', clue:'Goes under your cup ☕', category:'Café' },
  { word:'MENU',     desc:'A list of food and drinks available at a restaurant or café', clue:'You read this to order 📋', category:'Café' },
  { word:'RECEIPT',  desc:'A document you get after paying that shows what you bought', clue:'Proof of purchase 🧾', category:'Café' },
  { word:'WIFI',     desc:'A wireless networking technology that allows internet connection', clue:'Free in most cafés 📶', category:'Café' },
  { word:'JOURNAL',  desc:'A book used for writing personal entries or notes daily', clue:'Many café visitors write in one 📓', category:'Café' },
  { word:'CINNAMON', desc:'A spice made from the inner bark of trees, used in baking', clue:'Common spice sprinkled on lattes 🌿', category:'Food' },
  { word:'VANILLA',  desc:'A flavoring derived from orchid plants, used in many desserts', clue:'Popular ice cream flavor 🍦', category:'Food' },
  { word:'CARAMEL',  desc:'A confection made by heating sugar until it browns', clue:'Sweet brown sauce drizzled on drinks 🍯', category:'Food' },
  { word:'ALMOND',   desc:'A tree nut used to make plant-based milk alternative for coffee', clue:'Nut used in non-dairy milk 🌰', category:'Food' },
  { word:'COCONUT',  desc:'A tropical fruit used to make a sweet creamy milk', clue:'Tropical nut with white flesh 🥥', category:'Food' },
];

function GuessWordGame({ playerName, onScore }) {
  const [wordData, setWordData] = useState(null);
  const [guessed, setGuessed] = useState([]);
  const [wrong, setWrong] = useState([]);
  const [showClue, setShowClue] = useState(false);
  const [result, setResult] = useState(null); // 'win' | 'lose'
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [round, setRound] = useState(1);
  const [usedWords, setUsedWords] = useState([]);
  const MAX_WRONG = 6;

  const pickWord = useCallback((used=[]) => {
    const available = WORD_LIST.filter(w => !used.includes(w.word));
    if (available.length === 0) {
      setUsedWords([]); // reset
      const w = WORD_LIST[Math.floor(Math.random()*WORD_LIST.length)];
      setWordData(w);
    } else {
      const w = available[Math.floor(Math.random()*available.length)];
      setWordData(w);
    }
    setGuessed([]);
    setWrong([]);
    setShowClue(false);
    setResult(null);
  }, []);

  useEffect(() => { pickWord([]); }, []);

  const guess = (letter) => {
    if (!wordData || result) return;
    if (guessed.includes(letter) || wrong.includes(letter)) return;
    if (wordData.word.includes(letter)) {
      const ng = [...guessed, letter];
      setGuessed(ng);
      const won = wordData.word.split('').every(l => ng.includes(l));
      if (won) {
        const pts = (MAX_WRONG - wrong.length) * 20 + (showClue ? 0 : 30) + streak * 10;
        const ns = score + pts;
        setScore(ns);
        setStreak(s => s + 1);
        setResult('win');
        onScore(ns);
      }
    } else {
      const nw = [...wrong, letter];
      setWrong(nw);
      if (nw.length >= MAX_WRONG) {
        setStreak(0);
        setResult('lose');
        onScore(score);
      }
    }
  };

  const next = () => {
    const nu = [...usedWords, wordData?.word];
    setUsedWords(nu);
    setRound(r => r + 1);
    pickWord(nu);
  };

  if (!wordData) return <div style={{color:'#d4a853',textAlign:'center',padding:40}}>Loading...</div>;

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const word = wordData.word;
  const hpPct = ((MAX_WRONG - wrong.length) / MAX_WRONG) * 100;
  const hpColor = hpPct > 60 ? '#44dd44' : hpPct > 30 ? '#ffcc00' : '#ff4444';

  // hangman drawing
  const HangmanSVG = ({ wrong }) => (
    <svg width="120" height="110" viewBox="0 0 120 110">
      {/* gallows */}
      <line x1="10" y1="105" x2="80" y2="105" stroke="#8b5a2b" strokeWidth="3" strokeLinecap="round"/>
      <line x1="30" y1="105" x2="30" y2="10" stroke="#8b5a2b" strokeWidth="3" strokeLinecap="round"/>
      <line x1="30" y1="10" x2="70" y2="10" stroke="#8b5a2b" strokeWidth="3" strokeLinecap="round"/>
      <line x1="70" y1="10" x2="70" y2="22" stroke="#8b5a2b" strokeWidth="2" strokeLinecap="round"/>
      {/* head */}
      {wrong>=1 && <circle cx="70" cy="32" r="10" stroke={wrong>=6?"#ff4444":"#d4a853"} strokeWidth="2.5" fill="none"/>}
      {/* eyes when dead */}
      {wrong>=6 && <><line x1="65" y1="28" x2="68" y2="31" stroke="#ff4444" strokeWidth="2"/><line x1="68" y1="28" x2="65" y2="31" stroke="#ff4444" strokeWidth="2"/><line x1="72" y1="28" x2="75" y2="31" stroke="#ff4444" strokeWidth="2"/><line x1="75" y1="28" x2="72" y2="31" stroke="#ff4444" strokeWidth="2"/></>}
      {/* body */}
      {wrong>=2 && <line x1="70" y1="42" x2="70" y2="72" stroke="#d4a853" strokeWidth="2.5" strokeLinecap="round"/>}
      {/* left arm */}
      {wrong>=3 && <line x1="70" y1="50" x2="52" y2="62" stroke="#d4a853" strokeWidth="2.5" strokeLinecap="round"/>}
      {/* right arm */}
      {wrong>=4 && <line x1="70" y1="50" x2="88" y2="62" stroke="#d4a853" strokeWidth="2.5" strokeLinecap="round"/>}
      {/* left leg */}
      {wrong>=5 && <line x1="70" y1="72" x2="54" y2="90" stroke="#d4a853" strokeWidth="2.5" strokeLinecap="round"/>}
      {/* right leg */}
      {wrong>=6 && <line x1="70" y1="72" x2="86" y2="90" stroke="#d4a853" strokeWidth="2.5" strokeLinecap="round"/>}
    </svg>
  );

  return (
    <div style={{height:'100%',background:'#1a0a00',color:'#f5e6d0',display:'flex',flexDirection:'column',fontFamily:"'Georgia',serif",overflowY:'auto'}}>

      {/* top info bar */}
      <div style={{background:'#2a1000',borderBottom:'2px solid #6b3a1f',padding:'8px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{fontSize:12,color:'#a07850'}}>Round <b style={{color:'#d4a853'}}>{round}</b></div>
        <div style={{fontSize:12,color:'#a07850'}}>⭐ <b style={{color:'#d4a853'}}>{score}</b></div>
        <div style={{fontSize:12,color:'#a07850'}}>🔥 <b style={{color:'#ff8800'}}>{streak}</b> streak</div>
        <div style={{fontSize:11,color:'#6b3a1f',background:'#3d1f00',borderRadius:6,padding:'2px 8px'}}>{wordData.category}</div>
      </div>

      <div style={{flex:1,padding:'12px 16px',display:'flex',flexDirection:'column',gap:12}}>

        {/* hangman + lives */}
        <div style={{display:'flex',alignItems:'center',gap:12,background:'#2a1000',borderRadius:14,padding:'10px 14px',border:'1px solid #3d1f00'}}>
          <HangmanSVG wrong={wrong.length}/>
          <div style={{flex:1}}>
            <div style={{fontSize:12,color:'#a07850',marginBottom:4}}>Lives remaining</div>
            <div style={{height:10,background:'#3d1f00',borderRadius:5,overflow:'hidden',marginBottom:6,border:'1px solid #5a2d00'}}>
              <div style={{width:`${hpPct}%`,height:'100%',background:hpColor,transition:'width 0.4s',borderRadius:5}}/>
            </div>
            <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
              {wrong.map(l=>(
                <span key={l} style={{background:'#5a0000',color:'#ff8888',borderRadius:6,padding:'2px 7px',fontSize:13,fontWeight:'bold'}}>{l}</span>
              ))}
              {wrong.length===0&&<span style={{color:'#6b3a1f',fontSize:12}}>No wrong guesses yet!</span>}
            </div>
          </div>
        </div>

        {/* description */}
        <div style={{background:'linear-gradient(135deg,#2a1800,#3d2400)',border:'1px solid #6b3a1f',borderRadius:12,padding:'12px 14px'}}>
          <div style={{fontSize:11,color:'#a07850',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Description</div>
          <div style={{fontSize:14,color:'#f5e6d0',lineHeight:1.6}}>{wordData.desc}</div>
        </div>

        {/* clue toggle */}
        {!showClue ? (
          <button onClick={()=>setShowClue(true)} style={{background:'transparent',border:'1px dashed #6b3a1f',borderRadius:10,padding:'8px',color:'#a07850',fontSize:13,cursor:'pointer'}}>
            💡 Show Clue (costs 30 pts bonus)
          </button>
        ) : (
          <div style={{background:'rgba(212,168,83,0.1)',border:'1px solid #d4a853',borderRadius:10,padding:'8px 14px',fontSize:13,color:'#d4a853',textAlign:'center'}}>
            💡 <b>Clue:</b> {wordData.clue}
          </div>
        )}

        {/* word blanks */}
        <div style={{textAlign:'center',padding:'8px 0'}}>
          <div style={{display:'flex',justifyContent:'center',flexWrap:'wrap',gap:6}}>
            {word.split('').map((l,i)=>(
              <div key={i} style={{
                width:30,height:38,display:'flex',alignItems:'center',justifyContent:'center',
                borderBottom:`3px solid ${guessed.includes(l)?'#d4a853':'#6b3a1f'}`,
                fontSize:20,fontWeight:'bold',
                color: result==='lose' && !guessed.includes(l) ? '#ff6b6b' : '#d4a853',
              }}>
                {guessed.includes(l) ? l : result==='lose' ? l : ''}
              </div>
            ))}
          </div>
          <div style={{fontSize:12,color:'#6b3a1f',marginTop:6}}>{word.length} letters</div>
        </div>

        {/* result overlay */}
        {result && (
          <div style={{background: result==='win'?'rgba(68,220,68,0.12)':'rgba(255,68,68,0.12)', border:`2px solid ${result==='win'?'#44dd44':'#ff4444'}`, borderRadius:14, padding:'16px', textAlign:'center'}}>
            <div style={{fontSize:28,marginBottom:4}}>{result==='win'?'🎉':'💀'}</div>
            <div style={{fontSize:18,fontWeight:'bold',color:result==='win'?'#44dd44':'#ff4444',marginBottom:4}}>
              {result==='win'?'Correct!':'Game Over!'}
            </div>
            {result==='win'&&<div style={{fontSize:13,color:'#d4a853',marginBottom:8}}>+{(MAX_WRONG-wrong.length)*20+(showClue?0:30)+streak*10} points!</div>}
            {result==='lose'&&<div style={{fontSize:13,color:'#f5e6d0',marginBottom:8}}>The word was <b style={{color:'#d4a853'}}>{word}</b></div>}
            <button onClick={next} style={{background:'#d4a853',border:'none',borderRadius:10,padding:'10px 24px',color:'#1a0a00',fontWeight:'bold',fontSize:14,cursor:'pointer'}}>
              Next Word →
            </button>
          </div>
        )}

        {/* keyboard */}
        {!result && (
          <div style={{paddingBottom:8}}>
            {['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'].map((row,ri)=>(
              <div key={ri} style={{display:'flex',justifyContent:'center',gap:4,marginBottom:4}}>
                {row.split('').map(l=>{
                  const isGuessed=guessed.includes(l);
                  const isWrong=wrong.includes(l);
                  return(
                    <button key={l} onClick={()=>guess(l)} disabled={isGuessed||isWrong}
                      style={{
                        width:32,height:38,borderRadius:7,border:'none',fontSize:13,fontWeight:'bold',cursor:isGuessed||isWrong?'default':'pointer',
                        background: isGuessed?'#44aa22': isWrong?'#5a0000':'#3d1f00',
                        color: isGuessed?'#8bc34a': isWrong?'#ff6666':'#d4a853',
                        opacity: isGuessed||isWrong?0.7:1,
                        transition:'all 0.15s',
                        boxShadow: isGuessed||isWrong?'none':'0 2px 0 #1a0800',
                      }}>
                      {l}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CafeMysteryGame({ playerName, onBack }) {
  return <CafeGame playerName={playerName} onBack={onBack}/>;
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
          {activeGame.id === 'racing' && <RacingGame playerName={playerName} onScore={s=>handleScore('racing',s)} />}
          {activeGame.id === 'zombie' && <ZombieGame playerName={playerName} username={username} onScore={s=>handleScore('zombie',s)} onBack={()=>setActiveGame(null)} />}
          {activeGame.id === 'guessword' && <GuessWordGame playerName={playerName} onScore={s=>handleScore('guessword',s)} />}
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
