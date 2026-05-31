import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase/config';
import {
  doc, setDoc, onSnapshot, updateDoc, getDoc, serverTimestamp
} from 'firebase/firestore';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const MAP_W = 320, MAP_H = 420;
const TILE = 20;
const PLAYER_SPEED = 3;
const ZOMBIE_SPEED = 0.8;
const DAY_DURATION = 45000;   // 45s day
const NIGHT_DURATION = 40000; // 40s night
const BARRIER_HP = 5;

const AVATARS = [
  { id: 'barista',  emoji: '👨‍🍳', name: 'Barista',   color: '#d4a853' },
  { id: 'customer', emoji: '🧑',   name: 'Customer',  color: '#64b5f6' },
  { id: 'manager',  emoji: '👩‍💼',  name: 'Manager',   color: '#ce93d8' },
  { id: 'chef',     emoji: '👨‍🍳',  name: 'Chef',      color: '#ef9a9a' },
  { id: 'waiter',   emoji: '🧑‍🍽️',  name: 'Waiter',    color: '#80cbc4' },
  { id: 'cleaner',  emoji: '🧹',   name: 'Cleaner',   color: '#a5d6a7' },
];

const ZOMBIE_EMOJIS = ['🧟','🧟‍♂️','🧟‍♀️'];

// map tiles: 0=floor, 1=wall, 2=counter, 3=table
const BASE_MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,2,2,2,2,0,0,0,0,2,2,2,2,0,1],
  [1,0,2,0,0,2,0,0,0,0,2,0,0,2,0,1],
  [1,0,2,2,2,2,0,0,0,0,2,2,2,2,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,3,3,0,0,0,0,0,3,3,0,0,0,1],
  [1,0,3,0,0,3,0,0,0,0,3,0,0,3,0,1],
  [1,0,0,3,3,0,0,0,0,0,0,3,3,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,2,2,0,0,0,0,0,0,0,0,2,2,0,1],
  [1,0,2,2,0,0,0,0,0,0,0,0,2,2,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const COLS = BASE_MAP[0].length;
const ROWS = BASE_MAP.length;

function genCode() {
  return Array.from({length:4},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
}

function isSolid(map, barriers, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  if (map[ty][tx] === 1 || map[ty][tx] === 2) return true;
  if (barriers[`${tx},${ty}`]) return true;
  return false;
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const S = {
  wrap: { position:'relative', width:'100%', height:'100%', background:'#0a0a0a', color:'#e0e0e0', fontFamily:"'Georgia',serif", display:'flex', flexDirection:'column', overflow:'hidden' },
  center: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, padding:20, textAlign:'center', overflowY:'auto' },
  title: { fontSize:26, fontWeight:'bold', color:'#8bc34a', marginBottom:4, textShadow:'0 0 10px rgba(139,195,74,0.4)' },
  sub: { fontSize:13, color:'#a07850', marginBottom:16 },
  card: { background:'#1a1a1a', border:'1px solid #333', borderRadius:14, padding:16, marginBottom:12, width:'100%', maxWidth:360 },
  btn: (c='#8bc34a') => ({ width:'100%', background:c, border:'none', borderRadius:10, padding:12, color:c==='#8bc34a'?'#000':'#e0e0e0', fontSize:15, fontWeight:'bold', cursor:'pointer', marginBottom:8 }),
  input: { width:'100%', background:'#1a1a1a', border:'1px solid #3d3d3d', borderRadius:10, padding:'10px 14px', color:'#e0e0e0', fontSize:15, marginBottom:10, boxSizing:'border-box', textAlign:'center' },
  avatarBox: (sel) => ({ display:'flex', flexDirection:'column', alignItems:'center', padding:'10px 6px', borderRadius:12, border: sel?'2px solid #8bc34a':'2px solid #333', cursor:'pointer', background: sel?'#0a1a0a':'#1a1a1a', minWidth:56 }),
  hud: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 12px', background:'rgba(0,0,0,0.8)', borderBottom:'1px solid #333', zIndex:10 },
  dpadWrap: { display:'grid', gridTemplateColumns:'repeat(3,52px)', gridTemplateRows:'repeat(3,52px)', gap:4, justifyContent:'center', padding:'8px 0' },
  dpadBtn: { background:'rgba(61,31,0,0.85)', border:'2px solid #6b3a1f', color:'#d4a853', borderRadius:10, fontSize:22, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', userSelect:'none', WebkitUserSelect:'none', touchAction:'none' },
  actionRow: { display:'flex', justifyContent:'center', gap:12, padding:'6px 12px' },
  actionBtn: (c) => ({ background:c, border:'none', borderRadius:10, padding:'10px 20px', color:'#fff', fontWeight:'bold', fontSize:14, cursor:'pointer' }),
  overlay: { position:'absolute', top:0, left:0, right:0, bottom:0, pointerEvents:'none', zIndex:5, transition:'background 1.5s' },
};

// ─── HOW TO PLAY ─────────────────────────────────────────────────────────────
function HowToPlay({ onDone }) {
  const steps = [
    { icon:'🕹️', title:'Movement', desc:'Use the D-pad at the bottom to walk around the café map.' },
    { icon:'🧱', title:'Build Barriers', desc:'During daytime ☀️ tap BUILD to place walls. Zombies will eat through them at night!' },
    { icon:'⚔️', title:'Attack', desc:'Get next to a zombie at night and tap ATTACK to fight back.' },
    { icon:'🌙', title:'Night Cycle', desc:'Screen turns red/dark. Zombies spawn and chase you! Hide behind barriers.' },
    { icon:'☀️', title:'Day Cycle', desc:'Screen turns yellow/bright. Zombies vanish. Use this time to build and repair!' },
    { icon:'💀', title:'Survive', desc:'If a zombie touches you, you lose HP. Reach 0 HP = game over. Survive as many nights as possible!' },
    { icon:'👥', title:'Multiplayer', desc:'Host a room, share the code. Friends join on their own phones and play together!' },
  ];
  return (
    <div style={{...S.wrap, overflowY:'auto'}}>
      <div style={S.center}>
        <div style={{fontSize:44, marginBottom:8}}>📖</div>
        <div style={S.title}>How To Play</div>
        <div style={S.sub}>Zombie Barista Survival</div>
        <div style={{width:'100%', maxWidth:360}}>
          {steps.map((s,i) => (
            <div key={i} style={{display:'flex', gap:14, alignItems:'flex-start', background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:12, padding:'12px 14px', marginBottom:8}}>
              <span style={{fontSize:26, minWidth:32}}>{s.icon}</span>
              <div style={{textAlign:'left'}}>
                <div style={{fontWeight:'bold', color:'#8bc34a', fontSize:14, marginBottom:3}}>{s.title}</div>
                <div style={{color:'#aaa', fontSize:13, lineHeight:1.5}}>{s.desc}</div>
              </div>
            </div>
          ))}
          <div style={{background:'#0a1a0a', border:'1px solid #2a4a2a', borderRadius:12, padding:12, marginBottom:12, fontSize:13, color:'#8bc34a', lineHeight:1.6}}>
            💡 <b>Pro tip:</b> Build a small fort around yourself before night falls — leave one tile gap to attack from!
          </div>
          <button style={S.btn()} onClick={onDone}>Got it! Let's Play →</button>
        </div>
      </div>
    </div>
  );
}

// ─── AVATAR SELECT ────────────────────────────────────────────────────────────
function AvatarSelect({ onSelect, playerName }) {
  const [sel, setSel] = useState(AVATARS[0].id);
  return (
    <div style={S.center}>
      <div style={{fontSize:44, marginBottom:8}}>🎭</div>
      <div style={S.title}>Pick Your Avatar</div>
      <div style={S.sub}>Playing as: <b style={{color:'#d4a853'}}>{playerName}</b></div>
      <div style={{display:'flex', flexWrap:'wrap', gap:10, justifyContent:'center', marginBottom:20}}>
        {AVATARS.map(a => (
          <div key={a.id} style={S.avatarBox(sel===a.id)} onClick={()=>setSel(a.id)}>
            <span style={{fontSize:32}}>{a.emoji}</span>
            <span style={{fontSize:11, color: sel===a.id?'#8bc34a':'#888', marginTop:4}}>{a.name}</span>
          </div>
        ))}
      </div>
      <button style={{...S.btn(), maxWidth:300}} onClick={()=>onSelect(AVATARS.find(a=>a.id===sel))}>
        ✅ Choose {AVATARS.find(a=>a.id===sel)?.name}
      </button>
    </div>
  );
}

// ─── GAME ENGINE ─────────────────────────────────────────────────────────────
function GameEngine({ roomCode, myName, myAvatar, isHost, roomData, onGameOver, onBack }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const keysRef = useRef({});
  const lastSyncRef = useRef(0);

  const [phase, setPhase] = useState('day'); // day | night | transition
  const [phaseTimer, setPhaseTimer] = useState(DAY_DURATION / 1000);
  const [day, setDay] = useState(1);
  const [hp, setHp] = useState(100);
  const [mode, setMode] = useState('move'); // move | build | attack
  const [log, setLog] = useState(['☀️ Day 1 — Build your defenses!']);
  const [dead, setDead] = useState(false);

  const phaseRef = useRef('day');
  const phaseStartRef = useRef(Date.now());
  const dayRef = useRef(1);
  const hpRef = useRef(100);
  const modeRef = useRef('move');

  // init local state
  useEffect(() => {
    const startX = 5 * TILE + TILE/2;
    const startY = 10 * TILE + TILE/2;
    const barriers = {};
    // pre-place a few starter barriers
    [[7,9],[8,9],[7,10],[8,10]].forEach(([x,y]) => barriers[`${x},${y}`] = BARRIER_HP);

    stateRef.current = {
      player: { x: startX, y: startY, hp: 100 },
      others: {},
      zombies: [],
      barriers: { ...barriers },
      phaseStart: Date.now(),
      phase: 'day',
      day: 1,
    };
    phaseStartRef.current = Date.now();
    startLoop();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  // sync other players from Firestore
  useEffect(() => {
    if (!roomData?.players) return;
    const st = stateRef.current;
    if (!st) return;
    const others = {};
    Object.entries(roomData.players || {}).forEach(([name, data]) => {
      if (name !== myName) others[name] = data;
    });
    st.others = others;
    // sync barriers from host
    if (roomData.barriers) st.barriers = { ...roomData.barriers };
  }, [roomData]);

  const pushState = useCallback(async () => {
    const st = stateRef.current;
    if (!st) return;
    const now = Date.now();
    if (now - lastSyncRef.current < 200) return;
    lastSyncRef.current = now;
    try {
      await updateDoc(doc(db, 'zombieRooms', roomCode), {
        [`players.${myName}`]: {
          x: Math.round(st.player.x),
          y: Math.round(st.player.y),
          hp: st.player.hp,
          avatar: myAvatar.emoji,
          color: myAvatar.color,
        },
        ...(isHost ? { barriers: st.barriers, phase: st.phase, day: st.day } : {}),
      });
    } catch(e) {}
  }, [roomCode, myName, myAvatar, isHost]);

  const startLoop = () => {
    const loop = (ts) => {
      update(ts);
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const update = (ts) => {
    const st = stateRef.current;
    if (!st || dead) return;

    const elapsed = Date.now() - phaseStartRef.current;
    const currentPhase = phaseRef.current;
    const phaseDur = currentPhase === 'day' ? DAY_DURATION : NIGHT_DURATION;
    const remaining = Math.max(0, Math.floor((phaseDur - elapsed) / 1000));
    setPhaseTimer(remaining);

    // phase transition
    if (elapsed >= phaseDur) {
      const newPhase = currentPhase === 'day' ? 'night' : 'day';
      phaseRef.current = newPhase;
      phaseStartRef.current = Date.now();
      setPhase(newPhase);
      if (newPhase === 'night') {
        spawnZombies(st);
        const d = dayRef.current;
        setLog(l => [`🌙 Night ${d} — Zombies are coming!`, ...l.slice(0,4)]);
      } else {
        st.zombies = [];
        const nd = dayRef.current + 1;
        dayRef.current = nd;
        setDay(nd);
        setLog(l => [`☀️ Day ${nd} — Build your defenses!`, ...l.slice(0,4)]);
      }
      st.phase = phaseRef.current;
      st.day = dayRef.current;
    }

    // player movement
    const spd = PLAYER_SPEED;
    let dx = 0, dy = 0;
    if (keysRef.current['up'])    dy = -spd;
    if (keysRef.current['down'])  dy =  spd;
    if (keysRef.current['left'])  dx = -spd;
    if (keysRef.current['right']) dx =  spd;

    const nx = st.player.x + dx;
    const ny = st.player.y + dy;
    const tx = Math.floor(nx / TILE), ty = Math.floor(ny / TILE);
    const tw = Math.floor((nx + TILE*0.6) / TILE), th = Math.floor((ny + TILE*0.6) / TILE);

    if (!isSolid(BASE_MAP, st.barriers, tx, ty) && !isSolid(BASE_MAP, st.barriers, tw, th)) {
      st.player.x = Math.max(TILE, Math.min(MAP_W - TILE, nx));
      st.player.y = Math.max(TILE, Math.min(MAP_H - TILE, ny));
    } else if (!isSolid(BASE_MAP, st.barriers, Math.floor((nx + TILE*0.6)/TILE), Math.floor((st.player.y + TILE*0.6)/TILE))) {
      st.player.x = Math.max(TILE, Math.min(MAP_W - TILE, nx));
    } else if (!isSolid(BASE_MAP, st.barriers, Math.floor(nx/TILE), Math.floor((ny + TILE*0.6)/TILE))) {
      st.player.y = Math.max(TILE, Math.min(MAP_H - TILE, ny));
    }

    // zombie AI
    if (phaseRef.current === 'night') {
      st.zombies.forEach(z => {
        if (z.hp <= 0) return;
        const pdx = st.player.x - z.x, pdy = st.player.y - z.y;
        const dist = Math.hypot(pdx, pdy);
        if (dist > 2) {
          const nx2 = z.x + (pdx/dist) * ZOMBIE_SPEED;
          const ny2 = z.y + (pdy/dist) * ZOMBIE_SPEED;
          const ztx = Math.floor(nx2/TILE), zty = Math.floor(ny2/TILE);
          // eat barriers
          const bKey = `${ztx},${zty}`;
          if (st.barriers[bKey] !== undefined) {
            st.barriers[bKey] -= 0.02;
            if (st.barriers[bKey] <= 0) {
              delete st.barriers[bKey];
              setLog(l => ['🧱 Barrier destroyed!', ...l.slice(0,4)]);
            }
          } else if (!isSolid(BASE_MAP, {}, ztx, zty)) {
            z.x = nx2; z.y = ny2;
          }
        }
        // attack player
        if (dist < TILE * 1.2) {
          z.attackTimer = (z.attackTimer || 0) + 1;
          if (z.attackTimer > 40) {
            z.attackTimer = 0;
            hpRef.current = Math.max(0, hpRef.current - 10);
            st.player.hp = hpRef.current;
            setHp(hpRef.current);
            if (hpRef.current <= 0) {
              setDead(true);
              onGameOver(dayRef.current * 50);
            }
          }
        }
      });
      st.zombies = st.zombies.filter(z => z.hp > 0);
    }

    pushState();
  };

  const spawnZombies = (st) => {
    const count = Math.min(2 + dayRef.current, 8);
    const spawnPoints = [[1,1],[14,1],[1,19],[14,19],[7,1],[7,19]];
    st.zombies = Array.from({length: count}, (_, i) => {
      const sp = spawnPoints[i % spawnPoints.length];
      return {
        id: i, x: sp[0]*TILE + Math.random()*10, y: sp[1]*TILE + Math.random()*10,
        hp: 3, maxHp: 3, emoji: ZOMBIE_EMOJIS[i%3],
        attackTimer: 0,
      };
    });
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const st = stateRef.current;
    if (!st) return;
    const isNight = phaseRef.current === 'night';

    // background
    ctx.fillStyle = isNight ? '#0a0a12' : '#1a1200';
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // tiles
    for (let ty2 = 0; ty2 < ROWS; ty2++) {
      for (let tx2 = 0; tx2 < COLS; tx2++) {
        const tile = BASE_MAP[ty2][tx2];
        const x = tx2 * TILE, y = ty2 * TILE;
        if (tile === 1) {
          ctx.fillStyle = isNight ? '#1a1a2a' : '#2a1a00';
          ctx.fillRect(x, y, TILE, TILE);
        } else if (tile === 2) {
          ctx.fillStyle = isNight ? '#2a2a1a' : '#5d3010';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = isNight ? '#3a3a2a' : '#8b5a2b';
          ctx.strokeRect(x+1, y+1, TILE-2, TILE-2);
        } else if (tile === 3) {
          ctx.fillStyle = isNight ? '#1a1a0a' : '#3a2000';
          ctx.fillRect(x, y, TILE, TILE);
        } else {
          ctx.fillStyle = isNight ? '#080810' : '#120d00';
          ctx.fillRect(x, y, TILE, TILE);
        }
      }
    }

    // grid lines
    ctx.strokeStyle = isNight ? 'rgba(100,100,150,0.08)' : 'rgba(150,100,0,0.08)';
    ctx.lineWidth = 0.5;
    for (let tx2=0;tx2<=COLS;tx2++){ctx.beginPath();ctx.moveTo(tx2*TILE,0);ctx.lineTo(tx2*TILE,MAP_H);ctx.stroke();}
    for (let ty2=0;ty2<=ROWS;ty2++){ctx.beginPath();ctx.moveTo(0,ty2*TILE);ctx.lineTo(MAP_W,ty2*TILE);ctx.stroke();}

    // barriers
    Object.entries(st.barriers).forEach(([key, hp2]) => {
      const [bx, by] = key.split(',').map(Number);
      const ratio = hp2 / BARRIER_HP;
      ctx.fillStyle = `rgba(139,90,43,${0.4 + ratio*0.6})`;
      ctx.fillRect(bx*TILE, by*TILE, TILE, TILE);
      ctx.strokeStyle = `rgba(212,168,83,${ratio})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx*TILE+1, by*TILE+1, TILE-2, TILE-2);
      ctx.fillStyle = '#d4a853';
      ctx.font = '12px serif';
      ctx.textAlign = 'center';
      ctx.fillText('🧱', bx*TILE+TILE/2, by*TILE+TILE/2+4);
    });

    // other players
    Object.entries(st.others).forEach(([name, data]) => {
      ctx.font = '16px serif';
      ctx.textAlign = 'center';
      ctx.fillText(data.avatar || '🧑', data.x, data.y);
      ctx.fillStyle = data.color || '#64b5f6';
      ctx.font = 'bold 8px Arial';
      ctx.fillText(name.slice(0,6), data.x, data.y - 12);
    });

    // zombies
    st.zombies.forEach(z => {
      if (z.hp <= 0) return;
      ctx.font = '18px serif';
      ctx.textAlign = 'center';
      ctx.fillText(z.emoji, z.x, z.y);
      // hp bar
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(z.x - 10, z.y - 20, 20, 4);
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(z.x - 10, z.y - 20, 20 * (z.hp/z.maxHp), 4);
    });

    // player
    ctx.font = '18px serif';
    ctx.textAlign = 'center';
    ctx.fillText(myAvatar.emoji, st.player.x, st.player.y);
    // player hp bar
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(st.player.x - 14, st.player.y - 24, 28, 5);
    ctx.fillStyle = hpRef.current > 50 ? '#8bc34a' : hpRef.current > 25 ? '#ff9800' : '#ff4444';
    ctx.fillRect(st.player.x - 14, st.player.y - 24, 28 * (hpRef.current/100), 5);
    // name tag
    ctx.fillStyle = myAvatar.color;
    ctx.font = 'bold 8px Arial';
    ctx.fillText(myName.slice(0,6), st.player.x, st.player.y - 26);

    // night vignette
    if (isNight) {
      const vg = ctx.createRadialGradient(st.player.x, st.player.y, 60, st.player.x, st.player.y, MAP_W*0.8);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.7)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, MAP_W, MAP_H);
    }

    // mode indicator on canvas
    if (modeRef.current === 'build') {
      ctx.fillStyle = 'rgba(212,168,83,0.15)';
      ctx.fillRect(0, 0, MAP_W, MAP_H);
    } else if (modeRef.current === 'attack') {
      ctx.fillStyle = 'rgba(255,68,68,0.08)';
      ctx.fillRect(0, 0, MAP_W, MAP_H);
    }
  };

  const handleDPad = useCallback((dir, down) => {
    keysRef.current[dir] = down;
  }, []);

  const handleBuild = () => {
    const st = stateRef.current;
    if (!st || phaseRef.current === 'night') {
      setLog(l => ['⚠️ Can only build during the day!', ...l.slice(0,4)]);
      return;
    }
    const tx2 = Math.floor(st.player.x / TILE);
    const ty2 = Math.floor(st.player.y / TILE);
    const offsets = [[0,0],[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
    for (const [ox,oy] of offsets) {
      const bx = tx2+ox, by = ty2+oy;
      const key = `${bx},${by}`;
      if (!isSolid(BASE_MAP, {}, bx, by) && !st.barriers[key] &&
          !(Math.abs(ox)===0 && Math.abs(oy)===0)) {
        st.barriers[key] = BARRIER_HP;
        setLog(l => [`🧱 Barrier built at (${bx},${by})`, ...l.slice(0,4)]);
        return;
      }
    }
    setLog(l => ['⚠️ No space nearby!', ...l.slice(0,4)]);
  };

  const handleAttack = () => {
    const st = stateRef.current;
    if (!st || phaseRef.current === 'day') {
      setLog(l => ['☀️ No zombies during the day!', ...l.slice(0,4)]);
      return;
    }
    let hit = false;
    st.zombies.forEach(z => {
      if (Math.hypot(z.x - st.player.x, z.y - st.player.y) < TILE * 2) {
        z.hp -= 1;
        hit = true;
        if (z.hp <= 0) setLog(l => ['⚔️ Zombie defeated!', ...l.slice(0,4)]);
        else setLog(l => ['⚔️ Hit!', ...l.slice(0,4)]);
      }
    });
    if (!hit) setLog(l => ['⚠️ No zombie in range!', ...l.slice(0,4)]);
  };

  const isNight = phase === 'night';

  const bgOverlay = isNight
    ? 'rgba(80,0,0,0.18)'
    : `rgba(255,220,0,0.10)`;

  return (
    <div style={{...S.wrap, position:'relative'}}>
      {/* phase overlay tint */}
      <div style={{position:'absolute', top:0, left:0, right:0, bottom:0, background:bgOverlay, pointerEvents:'none', zIndex:1, transition:'background 2s'}}/>

      {/* HUD */}
      <div style={{...S.hud, zIndex:10, position:'relative'}}>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <span style={{fontSize:20}}>{isNight ? '🌙' : '☀️'}</span>
          <span style={{color: isNight?'#ff6b6b':'#ffd54f', fontWeight:'bold', fontSize:13}}>
            {isNight ? 'NIGHT' : 'DAY'} {day}
          </span>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:6}}>
          <span style={{fontSize:12, color:'#888'}}>⏱</span>
          <span style={{color: phaseTimer < 10 ? '#ff6b6b':'#8bc34a', fontWeight:'bold', fontSize:14}}>{phaseTimer}s</span>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:4}}>
          <span style={{fontSize:12, color: hp>50?'#8bc34a':hp>25?'#ff9800':'#ff4444'}}>❤️ {hp}</span>
        </div>
      </div>

      {/* canvas */}
      <div style={{display:'flex', justifyContent:'center', position:'relative', zIndex:2}}>
        <canvas ref={canvasRef} width={MAP_W} height={MAP_H} style={{display:'block', maxWidth:'100%'}}/>
      </div>

      {/* log */}
      <div style={{background:'rgba(0,0,0,0.7)', padding:'4px 12px', fontSize:11, color:'#8bc34a', minHeight:22, zIndex:10, position:'relative'}}>
        {log[0]}
      </div>

      {/* controls */}
      <div style={{background:'rgba(10,10,10,0.95)', borderTop:'1px solid #222', zIndex:10, position:'relative'}}>
        <div style={{display:'flex', gap:0}}>
          {/* dpad */}
          <div style={S.dpadWrap}>
            <div/><DPadBtn dir="up" onPress={handleDPad}>▲</DPadBtn><div/>
            <DPadBtn dir="left" onPress={handleDPad}>◀</DPadBtn><div/><DPadBtn dir="right" onPress={handleDPad}>▶</DPadBtn>
            <div/><DPadBtn dir="down" onPress={handleDPad}>▼</DPadBtn><div/>
          </div>
          {/* action buttons */}
          <div style={{display:'flex', flexDirection:'column', justifyContent:'center', gap:8, padding:'8px 12px', flex:1}}>
            <button style={{...S.actionBtn(isNight?'#8b0000':'#555'), opacity: isNight?1:0.4}} onClick={handleAttack}>
              ⚔️ ATTACK
            </button>
            <button style={{...S.actionBtn(isNight?'#555':'#4a5a00'), opacity: isNight?0.4:1}} onClick={handleBuild}>
              🧱 BUILD
            </button>
            <button style={{background:'#1a1a1a', border:'1px solid #333', borderRadius:8, padding:'6px 10px', color:'#888', fontSize:12, cursor:'pointer'}} onClick={onBack}>
              ← Exit
            </button>
          </div>
        </div>
      </div>

      {/* death screen */}
      {dead && (
        <div style={{position:'absolute', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.85)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:20}}>
          <div style={{fontSize:56}}>💀</div>
          <div style={{fontSize:22, fontWeight:'bold', color:'#ff4444', marginBottom:8}}>You Fell!</div>
          <div style={{color:'#aaa', marginBottom:4}}>Survived {day} day{day>1?'s':''}</div>
          <div style={{color:'#d4a853', fontSize:18, fontWeight:'bold', marginBottom:20}}>Score: {day * 50}</div>
          <button style={{...S.btn(), maxWidth:200}} onClick={onBack}>▶ Play Again</button>
        </div>
      )}
    </div>
  );
}

function DPadBtn({ dir, onPress, children }) {
  return (
    <div style={S.dpadBtn}
      onPointerDown={e=>{e.preventDefault();onPress(dir,true);}}
      onPointerUp={e=>{e.preventDefault();onPress(dir,false);}}
      onPointerLeave={e=>{onPress(dir,false);}}>
      {children}
    </div>
  );
}

// ─── LOBBY ───────────────────────────────────────────────────────────────────
function Lobby({ roomCode, myName, myAvatar, roomData, isHost, onStart, onLeave }) {
  return (
    <div style={S.center}>
      <div style={{fontSize:40, marginBottom:8}}>🏠</div>
      <div style={S.title}>Waiting Room</div>
      <div style={S.sub}>Share this code with friends:</div>
      <div style={{fontSize:36, fontWeight:'bold', color:'#8bc34a', letterSpacing:6, background:'#0a1a0a', padding:'12px 24px', borderRadius:12, border:'2px solid #4a8a2a', marginBottom:16}}>{roomCode}</div>
      <div style={{...S.card, maxWidth:320}}>
        <div style={{color:'#8bc34a', marginBottom:8, fontWeight:'bold'}}>Players ({Object.keys(roomData?.players||{}).length || 1}):</div>
        {(roomData?.members||[myName]).map((p,i)=>(
          <div key={i} style={{display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid #222'}}>
            <span style={{fontSize:20}}>{roomData?.avatars?.[p] || myAvatar.emoji}</span>
            <span style={{flex:1, color:p===myName?'#d4a853':'#e0e0e0'}}>{p}{p===myName?' (you)':''}</span>
            {p === roomData?.host && <span style={{fontSize:11, color:'#d4a853'}}>HOST</span>}
          </div>
        ))}
      </div>
      {isHost
        ? <button style={{...S.btn(), maxWidth:320}} onClick={onStart}>▶ Start Game!</button>
        : <div style={{color:'#a07850', fontSize:14}}>Waiting for host to start...</div>}
      <button style={{...S.btn('#1a1a1a'), maxWidth:320, marginTop:8}} onClick={onLeave}>Leave Room</button>
    </div>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
export default function ZombieGame({ playerName, username, onScore, onBack }) {
  const [screen, setScreen] = useState('howtoplay'); // howtoplay | menu | avatarselect | lobby | game
  const [avatar, setAvatar] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [roomData, setRoomData] = useState(null);
  const unsubRef = useRef(null);
  const myName = playerName || username || 'Guest';

  const subscribeRoom = useCallback((code) => {
    if (unsubRef.current) unsubRef.current();
    unsubRef.current = onSnapshot(doc(db, 'zombieRooms', code), snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      setRoomData(data);
      if (data.status === 'playing') setScreen('game');
    });
  }, []);

  useEffect(() => () => { if (unsubRef.current) unsubRef.current(); }, []);

  const hostGame = async (av) => {
    setLoading(true);
    const code = genCode();
    try {
      await setDoc(doc(db, 'zombieRooms', code), {
        code, host: myName,
        members: [myName],
        players: {},
        avatars: { [myName]: av.emoji },
        barriers: {},
        status: 'waiting',
        phase: 'day', day: 1,
        createdAt: serverTimestamp(),
      });
      setRoomCode(code);
      setIsHost(true);
      subscribeRoom(code);
      setScreen('lobby');
    } catch(e) { setError('Failed to create room'); }
    setLoading(false);
  };

  const joinGame = async (av) => {
    const code = joinCode.trim().toUpperCase();
    if (!code) { setError('Enter a room code'); return; }
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'zombieRooms', code));
      if (!snap.exists()) { setError('Room not found!'); setLoading(false); return; }
      const data = snap.data();
      if (data.status !== 'waiting') { setError('Game already started!'); setLoading(false); return; }
      await updateDoc(doc(db, 'zombieRooms', code), {
        members: [...(data.members||[]), myName],
        [`avatars.${myName}`]: av.emoji,
      });
      setRoomCode(code);
      setIsHost(false);
      subscribeRoom(code);
      setScreen('lobby');
    } catch(e) { setError('Failed to join'); }
    setLoading(false);
  };

  const startGame = async () => {
    await updateDoc(doc(db, 'zombieRooms', roomCode), { status: 'playing' });
  };

  const leaveRoom = () => {
    if (unsubRef.current) unsubRef.current();
    setScreen('menu');
    setRoomCode('');
    setRoomData(null);
  };

  const handleAvatarSelect = (av) => {
    setAvatar(av);
    setScreen('menu');
  };

  const handleGameOver = (score) => {
    onScore(score);
  };

  // ── how to play ──
  if (screen === 'howtoplay') return <HowToPlay onDone={() => setScreen('avatarselect')} />;

  // ── avatar select ──
  if (screen === 'avatarselect') return (
    <div style={S.wrap}>
      <AvatarSelect playerName={myName} onSelect={handleAvatarSelect} />
    </div>
  );

  // ── game ──
  if (screen === 'game' && avatar) return (
    <GameEngine
      roomCode={roomCode}
      myName={myName}
      myAvatar={avatar}
      isHost={isHost}
      roomData={roomData}
      onGameOver={handleGameOver}
      onBack={() => { leaveRoom(); onBack(); }}
    />
  );

  // ── lobby ──
  if (screen === 'lobby') return (
    <div style={S.wrap}>
      <Lobby roomCode={roomCode} myName={myName} myAvatar={avatar||AVATARS[0]} roomData={roomData} isHost={isHost} onStart={startGame} onLeave={leaveRoom} />
    </div>
  );

  // ── menu ──
  return (
    <div style={S.wrap}>
      <div style={S.center}>
        <div style={{fontSize:52, marginBottom:8}}>🧟</div>
        <div style={S.title}>ZOMBIE BARISTA</div>
        <div style={S.sub}>Build. Defend. Survive the night.</div>

        {avatar && (
          <div style={{display:'flex', alignItems:'center', gap:10, background:'#0a1a0a', border:'1px solid #2a4a2a', borderRadius:12, padding:'10px 16px', marginBottom:16}}>
            <span style={{fontSize:28}}>{avatar.emoji}</span>
            <div style={{textAlign:'left'}}>
              <div style={{color:'#8bc34a', fontWeight:'bold', fontSize:13}}>{myName}</div>
              <div style={{color:'#666', fontSize:12}}>Playing as {avatar.name}</div>
            </div>
            <button style={{marginLeft:'auto', background:'#1a1a1a', border:'1px solid #333', borderRadius:8, padding:'4px 10px', color:'#888', fontSize:12, cursor:'pointer'}} onClick={()=>setScreen('avatarselect')}>Change</button>
          </div>
        )}

        <div style={{width:'100%', maxWidth:320}}>
          <button style={S.btn()} onClick={()=>avatar?setScreen('soloconfirm'):setScreen('avatarselect')} disabled={loading}>
            ⚔️ Play Solo
          </button>
          <button style={S.btn('#1a3a1a')} onClick={()=>{setIsHost(true);avatar?hostGame(avatar):setScreen('avatarselect')}} disabled={loading}>
            🏠 Host Multiplayer
          </button>
          <div style={{display:'flex', gap:8, marginBottom:8}}>
            <input style={{...S.input, marginBottom:0, flex:1, letterSpacing:3, fontWeight:'bold'}}
              placeholder="Room code" value={joinCode}
              onChange={e=>setJoinCode(e.target.value.toUpperCase())} maxLength={4} />
            <button style={{...S.btn('#1a1a3a'), width:'auto', padding:'0 16px', marginBottom:0}}
              onClick={()=>avatar?joinGame(avatar):setScreen('avatarselect')} disabled={loading}>
              Join
            </button>
          </div>
          <button style={S.btn('#1a1a1a')} onClick={()=>setScreen('howtoplay')}>📖 How to Play</button>
          <button style={S.btn('#111')} onClick={onBack}>← Back to Games</button>
        </div>
        {error && <div style={{color:'#ff6b6b', marginTop:8, fontSize:13}}>{error}</div>}
      </div>
    </div>
  );
}
