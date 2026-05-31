import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase/config';
import {
  doc, setDoc, onSnapshot, updateDoc, getDoc, serverTimestamp
} from 'firebase/firestore';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const MAP_W = 320, MAP_H = 380;
const TILE = 20;
const PLAYER_SPEED = 3;
const ZOMBIE_SPEED = 0.7;
const DAY_DURATION = 45000;
const NIGHT_DURATION = 40000;
const BARRIER_HP = 5;

const AVATARS = [
  { id: 'red',    emoji: '🧑', name: 'Red',     color: '#ff4444', bg: '#ff0000' },
  { id: 'blue',   emoji: '🧑', name: 'Blue',    color: '#4488ff', bg: '#2266ff' },
  { id: 'green',  emoji: '🧑', name: 'Green',   color: '#44cc44', bg: '#22aa22' },
  { id: 'yellow', emoji: '🧑', name: 'Yellow',  color: '#ffcc00', bg: '#ddaa00' },
  { id: 'purple', emoji: '🧑', name: 'Purple',  color: '#cc44ff', bg: '#aa22dd' },
  { id: 'orange', emoji: '🧑', name: 'Orange',  color: '#ff8800', bg: '#dd6600' },
];

const AVATAR_BODIES = {
  red:    { body:'#ff3333', head:'#ffccaa', shirt:'#cc0000' },
  blue:   { body:'#3366ff', head:'#ffccaa', shirt:'#0033cc' },
  green:  { body:'#33cc33', head:'#ffccaa', shirt:'#009900' },
  yellow: { body:'#ffcc00', head:'#ffccaa', shirt:'#cc9900' },
  purple: { body:'#cc33ff', head:'#ffccaa', shirt:'#9900cc' },
  orange: { body:'#ff8800', head:'#ffccaa', shirt:'#cc5500' },
};

const BASE_MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,2,2,2,0,0,0,0,0,0,2,2,2,0,1],
  [1,0,2,0,0,0,0,0,0,0,0,0,0,2,0,1],
  [1,0,2,2,2,0,0,0,0,0,0,2,2,2,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,3,0,0,0,0,0,0,0,0,3,0,0,1],
  [1,0,3,3,3,0,0,0,0,0,0,3,3,3,0,1],
  [1,0,0,3,0,0,0,0,0,0,0,0,3,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,2,2,0,0,0,0,0,0,0,0,2,2,0,1],
  [1,0,2,2,0,0,0,0,0,0,0,0,2,2,0,1],
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
  if (tx<0||ty<0||tx>=COLS||ty>=ROWS) return true;
  if (map[ty][tx]===1||map[ty][tx]===2) return true;
  if (barriers[`${tx},${ty}`]) return true;
  return false;
}

// ─── ROBLOX-STYLE DRAW HELPERS ───────────────────────────────────────────────
function drawRobloxChar(ctx, x, y, colors, label, labelColor, isZombie=false) {
  const s = 14;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y+s*0.6, s*0.7, s*0.2, 0, 0, Math.PI*2);
  ctx.fill();
  // body
  ctx.fillStyle = isZombie ? '#228822' : colors.body;
  ctx.fillRect(x-s*0.35, y-s*0.6, s*0.7, s*0.65);
  // shirt detail
  ctx.fillStyle = isZombie ? '#116611' : colors.shirt;
  ctx.fillRect(x-s*0.35, y-s*0.6, s*0.7, s*0.15);
  // legs
  ctx.fillStyle = isZombie ? '#1a5c1a' : '#2244aa';
  ctx.fillRect(x-s*0.32, y+s*0.04, s*0.28, s*0.5);
  ctx.fillRect(x+s*0.04, y+s*0.04, s*0.28, s*0.5);
  // arms
  ctx.fillStyle = isZombie ? '#228822' : colors.body;
  if (isZombie) {
    // outstretched zombie arms
    ctx.fillRect(x-s*0.75, y-s*0.55, s*0.38, s*0.18);
    ctx.fillRect(x+s*0.36, y-s*0.65, s*0.38, s*0.18);
  } else {
    ctx.fillRect(x-s*0.65, y-s*0.55, s*0.28, s*0.45);
    ctx.fillRect(x+s*0.36, y-s*0.55, s*0.28, s*0.45);
  }
  // head
  ctx.fillStyle = isZombie ? '#88cc44' : colors.head;
  ctx.fillRect(x-s*0.3, y-s*1.15, s*0.6, s*0.55);
  // eyes
  if (isZombie) {
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(x-s*0.18, y-s*0.95, s*0.1, s*0.1);
    ctx.fillRect(x+s*0.08, y-s*0.95, s*0.1, s*0.1);
    // stitches
    ctx.strokeStyle = '#004400';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x-s*0.05, y-s*0.75); ctx.lineTo(x+s*0.05, y-s*0.7); ctx.stroke();
  } else {
    ctx.fillStyle = '#333';
    ctx.fillRect(x-s*0.18, y-s*0.95, s*0.1, s*0.12);
    ctx.fillRect(x+s*0.08, y-s*0.95, s*0.1, s*0.12);
    ctx.fillStyle = '#ffaaaa';
    ctx.fillRect(x-s*0.1, y-s*0.72, s*0.2, s*0.06);
  }
  // name tag
  if (label) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const tw = ctx.measureText(label).width + 6;
    ctx.fillRect(x - tw/2, y - s*1.35, tw, 12);
    ctx.fillStyle = labelColor || '#fff';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y - s*1.25);
  }
}

function drawBarrier(ctx, x, y, ratio) {
  const s = TILE;
  ctx.fillStyle = `rgba(139,90,43,${0.5+ratio*0.5})`;
  ctx.fillRect(x+1, y+1, s-2, s-2);
  // brick pattern
  ctx.strokeStyle = `rgba(80,40,10,${ratio*0.8})`;
  ctx.lineWidth = 1;
  for (let r=0;r<3;r++) {
    const ry = y + 2 + r*(s-4)/3;
    ctx.beginPath(); ctx.moveTo(x+1,ry); ctx.lineTo(x+s-1,ry); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(x+s/2,y+2); ctx.lineTo(x+s/2,y+(s-4)/3+2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+s/4,y+2+(s-4)/3); ctx.lineTo(x+s/4,y+2*(s-4)/3+2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+3*s/4,y+2+(s-4)/3); ctx.lineTo(x+3*s/4,y+2*(s-4)/3+2); ctx.stroke();
  // cracks at low hp
  if (ratio < 0.5) {
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x+s*0.3, y+s*0.2); ctx.lineTo(x+s*0.5, y+s*0.6); ctx.lineTo(x+s*0.4, y+s*0.9); ctx.stroke();
  }
  // border
  ctx.strokeStyle = `rgba(212,168,83,${ratio})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(x+1,y+1,s-2,s-2);
}

// ─── HOW TO PLAY ─────────────────────────────────────────────────────────────
function HowToPlay({ onDone }) {
  const steps = [
    { icon:'🕹️', title:'Move Around',    desc:'Use the D-pad to walk. Dodge zombies and explore the café map.' },
    { icon:'☀️', title:'Daytime = Build', desc:'During day, tap BUILD near open tiles to place brick barriers. Plan your fort!' },
    { icon:'🌙', title:'Nighttime = Fight',desc:'Screen goes dark red. Zombies spawn at the edges and hunt you down!' },
    { icon:'🧱', title:'Barriers',         desc:'Zombies slowly eat through walls. Build thick forts — multiple layers help!' },
    { icon:'⚔️', title:'Attack',           desc:'Get close to a zombie at night and tap ATTACK. Each hit does 1 damage.' },
    { icon:'💡', title:'Pro Tip',          desc:'Leave a 1-tile gap in your fort to attack from safety. Surround yourself!' },
    { icon:'👥', title:'Multiplayer',      desc:'Host a room, share the 4-letter code. Teammates see each other on the map!' },
  ];
  return (
    <div style={{minHeight:'100%', background:'linear-gradient(180deg,#1a0a2e 0%,#0a1a0e 100%)', color:'#fff', fontFamily:"'Arial Black',Arial,sans-serif", overflowY:'auto'}}>
      {/* title banner */}
      <div style={{background:'linear-gradient(135deg,#ff6600,#ffcc00)', padding:'18px 16px 14px', textAlign:'center', borderBottom:'4px solid #ff8800', boxShadow:'0 4px 0 #cc5500'}}>
        <div style={{fontSize:32, fontWeight:900, color:'#fff', textShadow:'3px 3px 0 #cc4400,-1px -1px 0 #ff8800', letterSpacing:1}}>HOW TO PLAY</div>
        <div style={{fontSize:13, color:'#fff8', marginTop:2}}>Zombie Barista Survival</div>
      </div>
      <div style={{padding:'14px 14px 4px'}}>
        {steps.map((s,i) => (
          <div key={i} style={{display:'flex', gap:12, alignItems:'flex-start', background:'rgba(255,255,255,0.07)', border:'2px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'10px 12px', marginBottom:10, boxShadow:'0 3px 0 rgba(0,0,0,0.3)'}}>
            <div style={{fontSize:26, minWidth:34, textAlign:'center'}}>{s.icon}</div>
            <div>
              <div style={{fontWeight:900, color:'#ffcc00', fontSize:13, marginBottom:2, textTransform:'uppercase', letterSpacing:0.5}}>{s.title}</div>
              <div style={{color:'#ccc', fontSize:12, lineHeight:1.5}}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{padding:'0 14px 14px'}}>
        <button onClick={onDone} style={{width:'100%', background:'linear-gradient(180deg,#44dd44,#22aa22)', border:'none', borderRadius:12, padding:'14px', color:'#fff', fontSize:17, fontWeight:900, cursor:'pointer', boxShadow:'0 5px 0 #116611', textTransform:'uppercase', letterSpacing:1, textShadow:'1px 1px 0 #004400', display:'block'}}>
          LET'S GO! →
        </button>
      </div>
    </div>
  );
}

// ─── AVATAR SELECT ─────────────────────────────────────────────────────────────
function AvatarSelect({ playerName, onSelect }) {
  const [sel, setSel] = useState(AVATARS[0].id);
  const selAv = AVATARS.find(a=>a.id===sel);
  return (
    <div style={{minHeight:'100%', background:'linear-gradient(180deg,#1a0a2e 0%,#0a1a0e 100%)', fontFamily:"'Arial Black',Arial,sans-serif", overflowY:'auto'}}>
      <div style={{background:'linear-gradient(135deg,#9900cc,#ff44ff)', padding:'18px 16px 14px', textAlign:'center', borderBottom:'4px solid #cc00ff', boxShadow:'0 4px 0 #660099'}}>
        <div style={{fontSize:28, fontWeight:900, color:'#fff', textShadow:'3px 3px 0 #660099', letterSpacing:1}}>PICK YOUR CHARACTER</div>
        <div style={{fontSize:12, color:'#ffccff', marginTop:2}}>Playing as: <b style={{color:'#ffff00'}}>{playerName}</b></div>
      </div>
      <div style={{padding:14}}>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14}}>
          {AVATARS.map(av => {
            const isSel = sel===av.id;
            return (
              <div key={av.id} onClick={()=>setSel(av.id)} style={{background: isSel?`${av.bg}33`:'rgba(255,255,255,0.05)', border:`3px solid ${isSel?av.color:'rgba(255,255,255,0.1)'}`, borderRadius:14, padding:'12px 6px', textAlign:'center', cursor:'pointer', boxShadow: isSel?`0 0 12px ${av.color}44`:'none', transition:'all 0.15s'}}>
                {/* mini roblox character preview */}
                <svg width="40" height="48" viewBox="0 0 40 48" style={{display:'block',margin:'0 auto 6px'}}>
                  {/* shadow */}
                  <ellipse cx="20" cy="45" rx="10" ry="3" fill="rgba(0,0,0,0.3)"/>
                  {/* legs */}
                  <rect x="12" y="30" width="7" height="12" rx="2" fill="#224499"/>
                  <rect x="21" y="30" width="7" height="12" rx="2" fill="#224499"/>
                  {/* body */}
                  <rect x="10" y="17" width="20" height="15" rx="2" fill={AVATAR_BODIES[av.id].body}/>
                  <rect x="10" y="17" width="20" height="5" rx="2" fill={AVATAR_BODIES[av.id].shirt}/>
                  {/* arms */}
                  <rect x="3" y="17" width="7" height="12" rx="2" fill={AVATAR_BODIES[av.id].body}/>
                  <rect x="30" y="17" width="7" height="12" rx="2" fill={AVATAR_BODIES[av.id].body}/>
                  {/* head */}
                  <rect x="12" y="3" width="16" height="15" rx="3" fill="#ffccaa"/>
                  {/* eyes */}
                  <rect x="15" y="8" width="4" height="4" rx="1" fill="#333"/>
                  <rect x="22" y="8" width="4" height="4" rx="1" fill="#333"/>
                  {/* smile */}
                  <path d="M16 15 Q20 18 25 15" stroke="#cc8866" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                  {/* selected checkmark */}
                  {isSel && <><circle cx="33" cy="6" r="6" fill="#44dd44"/><text x="33" y="10" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold">✓</text></>}
                </svg>
                <div style={{fontWeight:900, fontSize:12, color: isSel?av.color:'#aaa', textTransform:'uppercase'}}>{av.name}</div>
              </div>
            );
          })}
        </div>
        <button onClick={()=>onSelect(selAv)} style={{width:'100%', background:`linear-gradient(180deg,${selAv.color},${selAv.bg})`, border:'none', borderRadius:12, padding:'14px', color:'#fff', fontSize:16, fontWeight:900, cursor:'pointer', boxShadow:`0 5px 0 ${selAv.bg}`, textShadow:'1px 1px 0 rgba(0,0,0,0.4)', textTransform:'uppercase', letterSpacing:1}}>
          PLAY AS {selAv.name} →
        </button>
      </div>
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
  const phaseRef = useRef('day');
  const phaseStartRef = useRef(Date.now());
  const dayRef = useRef(1);
  const hpRef = useRef(100);

  const [phase, setPhase] = useState('day');
  const [phaseTimer, setPhaseTimer] = useState(DAY_DURATION/1000);
  const [day, setDay] = useState(1);
  const [hp, setHp] = useState(100);
  const [zombieCount, setZombieCount] = useState(0);
  const [log, setLog] = useState('☀️ Day 1 — Build your fort!');
  const [dead, setDead] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    stateRef.current = {
      player: { x: 8*TILE, y: 10*TILE, hp: 100 },
      others: {},
      zombies: [],
      barriers: { '7,9':BARRIER_HP,'8,9':BARRIER_HP,'7,10':BARRIER_HP,'8,10':BARRIER_HP,'9,10':BARRIER_HP,'9,9':BARRIER_HP },
      phase: 'day', day: 1,
    };
    phaseStartRef.current = Date.now();
    const loop = (ts) => { update(); draw(); rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  useEffect(() => {
    if (!roomData?.players || !stateRef.current) return;
    const others = {};
    Object.entries(roomData.players||{}).forEach(([name,data]) => { if(name!==myName) others[name]=data; });
    stateRef.current.others = others;
    if (roomData.barriers && !isHost) stateRef.current.barriers = {...roomData.barriers};
  }, [roomData]);

  const pushState = useCallback(async () => {
    const st = stateRef.current;
    if (!st) return;
    const now = Date.now();
    if (now - lastSyncRef.current < 250) return;
    lastSyncRef.current = now;
    try {
      await updateDoc(doc(db,'zombieRooms',roomCode), {
        [`players.${myName}`]: { x:Math.round(st.player.x), y:Math.round(st.player.y), hp:st.player.hp, avatarId:myAvatar.id, color:myAvatar.color },
        ...(isHost ? { barriers:st.barriers, phase:st.phase, day:st.day } : {}),
      });
    } catch(e) {}
  }, [roomCode, myName, myAvatar, isHost]);

  const spawnZombies = (st) => {
    const count = Math.min(2 + dayRef.current * 2, 10);
    const pts = [[1,1],[14,1],[1,18],[14,18],[7,1],[7,18],[1,9],[14,9]];
    st.zombies = Array.from({length:count},(_,i) => {
      const p = pts[i%pts.length];
      return { id:i, x:p[0]*TILE+Math.random()*8, y:p[1]*TILE+Math.random()*8, hp:2+Math.floor(dayRef.current/2), maxHp:2+Math.floor(dayRef.current/2), attackTimer:0 };
    });
    setZombieCount(count);
  };

  const update = () => {
    const st = stateRef.current;
    if (!st || dead) return;

    const elapsed = Date.now() - phaseStartRef.current;
    const dur = phaseRef.current==='day' ? DAY_DURATION : NIGHT_DURATION;
    setPhaseTimer(Math.max(0,Math.floor((dur-elapsed)/1000)));
    setScore(dayRef.current * 50 + (phaseRef.current==='night' ? 25 : 0));

    if (elapsed >= dur) {
      const newPhase = phaseRef.current==='day' ? 'night' : 'day';
      phaseRef.current = newPhase;
      phaseStartRef.current = Date.now();
      setPhase(newPhase);
      if (newPhase==='night') {
        spawnZombies(st);
        setLog(`🌙 Night ${dayRef.current} — ZOMBIES INCOMING!`);
      } else {
        st.zombies = [];
        setZombieCount(0);
        dayRef.current++;
        setDay(dayRef.current);
        setLog(`☀️ Day ${dayRef.current} — Build up your defenses!`);
      }
      st.phase = phaseRef.current;
      st.day = dayRef.current;
    }

    // movement
    let dx=0,dy=0;
    if(keysRef.current.up)    dy=-PLAYER_SPEED;
    if(keysRef.current.down)  dy= PLAYER_SPEED;
    if(keysRef.current.left)  dx=-PLAYER_SPEED;
    if(keysRef.current.right) dx= PLAYER_SPEED;
    if(dx&&dy){dx*=0.707;dy*=0.707;}

    const nx=st.player.x+dx, ny=st.player.y+dy;
    const margin=TILE*0.45;
    const corners=[[nx-margin,ny-margin],[nx+margin,ny-margin],[nx-margin,ny+margin],[nx+margin,ny+margin]];
    const blocked=corners.some(([cx,cy])=>isSolid(BASE_MAP,st.barriers,Math.floor(cx/TILE),Math.floor(cy/TILE)));
    if(!blocked){st.player.x=Math.max(TILE,Math.min(MAP_W-TILE,nx));st.player.y=Math.max(TILE,Math.min(MAP_H-TILE,ny));}
    else{
      const bx=corners.some(([cx,cy])=>isSolid(BASE_MAP,st.barriers,Math.floor((st.player.x+dx-margin)/TILE),Math.floor((st.player.y+0-margin)/TILE))||isSolid(BASE_MAP,st.barriers,Math.floor((st.player.x+dx+margin)/TILE),Math.floor((st.player.y+0+margin)/TILE)));
      if(!bx) st.player.x=Math.max(TILE,Math.min(MAP_W-TILE,nx));
      const by2=corners.some(([cx,cy])=>isSolid(BASE_MAP,st.barriers,Math.floor((st.player.x+0-margin)/TILE),Math.floor((st.player.y+dy-margin)/TILE))||isSolid(BASE_MAP,st.barriers,Math.floor((st.player.x+0+margin)/TILE),Math.floor((st.player.y+dy+margin)/TILE)));
      if(!by2) st.player.y=Math.max(TILE,Math.min(MAP_H-TILE,ny));
    }

    // zombies
    if(phaseRef.current==='night'){
      st.zombies.forEach(z=>{
        if(z.hp<=0) return;
        const pdx=st.player.x-z.x, pdy=st.player.y-z.y;
        const dist=Math.hypot(pdx,pdy);
        if(dist>4){
          const nx2=z.x+(pdx/dist)*ZOMBIE_SPEED;
          const ny2=z.y+(pdy/dist)*ZOMBIE_SPEED;
          const ztx=Math.floor(nx2/TILE),zty=Math.floor(ny2/TILE);
          const bKey=`${ztx},${zty}`;
          if(st.barriers[bKey]!==undefined){
            st.barriers[bKey]-=0.015;
            if(st.barriers[bKey]<=0){ delete st.barriers[bKey]; setLog('🧱 A barrier was destroyed!'); }
          } else if(!isSolid(BASE_MAP,{},ztx,zty)){z.x=nx2;z.y=ny2;}
        }
        if(dist<TILE*1.3){
          z.attackTimer=(z.attackTimer||0)+1;
          if(z.attackTimer>50){
            z.attackTimer=0;
            hpRef.current=Math.max(0,hpRef.current-12);
            st.player.hp=hpRef.current;
            setHp(hpRef.current);
            if(hpRef.current<=0){setDead(true);onGameOver(dayRef.current*50);}
          }
        }
      });
      st.zombies=st.zombies.filter(z=>z.hp>0);
      setZombieCount(st.zombies.filter(z=>z.hp>0).length);
    }
    pushState();
  };

  const draw = () => {
    const canvas=canvasRef.current; if(!canvas)return;
    const ctx=canvas.getContext('2d');
    const st=stateRef.current; if(!st)return;
    const isNight=phaseRef.current==='night';

    // sky bg
    ctx.fillStyle = isNight ? '#050510' : '#1a2e00';
    ctx.fillRect(0,0,MAP_W,MAP_H);

    // ground tiles
    for(let ty2=0;ty2<ROWS;ty2++) for(let tx2=0;tx2<COLS;tx2++){
      const tile=BASE_MAP[ty2][tx2];
      const x=tx2*TILE, y=ty2*TILE;
      if(tile===1){ ctx.fillStyle=isNight?'#1a1a2e':'#3a2200'; ctx.fillRect(x,y,TILE,TILE); ctx.strokeStyle=isNight?'#2a2a3e':'#5a3a00'; ctx.lineWidth=1; ctx.strokeRect(x,y,TILE,TILE); }
      else if(tile===2){ ctx.fillStyle=isNight?'#2a2a1e':'#5d3a10'; ctx.fillRect(x,y,TILE,TILE); ctx.fillStyle=isNight?'#1a1a10':'#4a2a00'; ctx.fillRect(x+2,y+2,TILE-4,TILE-4); }
      else if(tile===3){ ctx.fillStyle=isNight?'#0e1e0e':'#2a3a00'; ctx.fillRect(x,y,TILE,TILE); }
      else { ctx.fillStyle=isNight?'#080810':'#141a00'; ctx.fillRect(x,y,TILE,TILE); }
    }

    // grass texture (day only)
    if(!isNight){
      ctx.strokeStyle='rgba(80,120,0,0.2)'; ctx.lineWidth=0.5;
      for(let i=0;i<MAP_W;i+=8){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,MAP_H);ctx.stroke();}
      for(let i=0;i<MAP_H;i+=8){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(MAP_W,i);ctx.stroke();}
    }

    // barriers
    Object.entries(st.barriers).forEach(([key,hp2])=>{
      const [bx,by]=key.split(',').map(Number);
      drawBarrier(ctx,bx*TILE,by*TILE,hp2/BARRIER_HP);
    });

    // other players
    Object.entries(st.others).forEach(([name,data])=>{
      const col = AVATAR_BODIES[data.avatarId||'blue'];
      drawRobloxChar(ctx,data.x,data.y,col||AVATAR_BODIES.blue,name.slice(0,6),data.color||'#4488ff');
    });

    // zombies
    st.zombies.forEach(z=>{
      if(z.hp<=0)return;
      drawRobloxChar(ctx,z.x,z.y,null,null,null,true);
      // zombie hp bar
      ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(z.x-12,z.y-28,24,5);
      ctx.fillStyle='#ff2222'; ctx.fillRect(z.x-12,z.y-28,24*(z.hp/z.maxHp),5);
      ctx.strokeStyle='#000'; ctx.lineWidth=0.5; ctx.strokeRect(z.x-12,z.y-28,24,5);
    });

    // player
    const pc=AVATAR_BODIES[myAvatar.id];
    drawRobloxChar(ctx,st.player.x,st.player.y,pc,myName.slice(0,6),myAvatar.color);

    // night vignette + red tint
    if(isNight){
      const vg=ctx.createRadialGradient(st.player.x,st.player.y,50,st.player.x,st.player.y,MAP_W);
      vg.addColorStop(0,'rgba(0,0,0,0)');
      vg.addColorStop(1,'rgba(0,0,0,0.75)');
      ctx.fillStyle=vg; ctx.fillRect(0,0,MAP_W,MAP_H);
      ctx.fillStyle='rgba(120,0,0,0.12)'; ctx.fillRect(0,0,MAP_W,MAP_H);
    } else {
      ctx.fillStyle='rgba(255,220,0,0.04)'; ctx.fillRect(0,0,MAP_W,MAP_H);
    }
  };

  const handleDPad = useCallback((dir,down)=>{ keysRef.current[dir]=down; },[]);

  const handleBuild = () => {
    const st=stateRef.current; if(!st) return;
    if(phaseRef.current==='night'){ setLog('⚠️ Can only build during the day!'); return; }
    const tx2=Math.floor(st.player.x/TILE), ty2=Math.floor(st.player.y/TILE);
    for(const [ox,oy] of [[0,-1],[1,0],[0,1],[-1,0],[1,-1],[-1,-1],[1,1],[-1,1]]){
      const bx=tx2+ox,by=ty2+oy,key=`${bx},${by}`;
      if(!isSolid(BASE_MAP,{},bx,by)&&!st.barriers[key]){
        st.barriers[key]=BARRIER_HP;
        setLog('🧱 Barrier placed!');
        return;
      }
    }
    setLog('⚠️ No space to build here!');
  };

  const handleAttack = () => {
    const st=stateRef.current; if(!st) return;
    if(phaseRef.current==='day'){ setLog('☀️ No zombies during the day!'); return; }
    let hit=false;
    st.zombies.forEach(z=>{
      if(Math.hypot(z.x-st.player.x,z.y-st.player.y)<TILE*2.2){ z.hp-=1; hit=true; }
    });
    st.zombies=st.zombies.filter(z=>z.hp>0);
    if(hit){ setLog('⚔️ Hit!'); setZombieCount(st.zombies.length); }
    else setLog('⚠️ No zombie in range!');
  };

  const isNight = phase==='night';
  const hpColor = hp>60?'#44dd44':hp>30?'#ffcc00':'#ff3333';

  return (
    <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',background:'#000',fontFamily:"'Arial Black',Arial,sans-serif",overflow:'hidden'}}>

      {/* TOP HUD */}
      <div style={{background: isNight?'linear-gradient(90deg,#200000,#100010,#200000)':'linear-gradient(90deg,#003300,#001a00,#003300)', padding:'6px 10px', display:'flex', alignItems:'center', gap:8, borderBottom:`3px solid ${isNight?'#ff0000':'#44aa00'}`, position:'relative'}}>
        {/* phase badge */}
        <div style={{background: isNight?'linear-gradient(180deg,#ff3300,#880000)':'linear-gradient(180deg,#ffcc00,#aa7700)', borderRadius:8, padding:'3px 10px', boxShadow:`0 3px 0 ${isNight?'#550000':'#665500'}`, border:`2px solid ${isNight?'#ff6600':'#ffee00'}`}}>
          <div style={{fontSize:11, fontWeight:900, color:'#fff', textShadow:'1px 1px 0 rgba(0,0,0,0.5)', lineHeight:1}}>{isNight?'🌙 NIGHT':'☀️ DAY'} {day}</div>
        </div>
        {/* timer */}
        <div style={{background:'rgba(0,0,0,0.5)', borderRadius:8, padding:'3px 8px', border:'2px solid rgba(255,255,255,0.2)'}}>
          <span style={{fontSize:12, fontWeight:900, color: phaseTimer<10?'#ff4444':'#fff'}}>⏱ {phaseTimer}s</span>
        </div>
        {/* zombie count */}
        {isNight && <div style={{background:'rgba(200,0,0,0.4)', borderRadius:8, padding:'3px 8px', border:'2px solid #ff4444'}}>
          <span style={{fontSize:11, fontWeight:900, color:'#ff8888'}}>🧟 {zombieCount}</span>
        </div>}
        {/* score */}
        <div style={{marginLeft:'auto', background:'rgba(255,200,0,0.15)', borderRadius:8, padding:'3px 8px', border:'2px solid rgba(255,200,0,0.3)'}}>
          <span style={{fontSize:11, fontWeight:900, color:'#ffcc00'}}>⭐ {score}</span>
        </div>
      </div>

      {/* HP BAR */}
      <div style={{background:'rgba(0,0,0,0.8)', padding:'4px 10px', display:'flex', alignItems:'center', gap:8}}>
        <span style={{fontSize:11, fontWeight:900, color:hpColor, minWidth:28}}>❤️ {hp}</span>
        <div style={{flex:1, height:10, background:'#330000', borderRadius:5, border:'2px solid #550000', overflow:'hidden', boxShadow:'inset 0 1px 3px rgba(0,0,0,0.5)'}}>
          <div style={{width:`${hp}%`, height:'100%', background:`linear-gradient(90deg,${hpColor},${hpColor}aa)`, borderRadius:5, transition:'width 0.3s', boxShadow:`0 0 6px ${hpColor}`}}/>
        </div>
        <span style={{fontSize:10, color:'#666', minWidth:30}}>{myAvatar.name}</span>
      </div>

      {/* CANVAS */}
      <div style={{flex:'0 0 auto', display:'flex', justifyContent:'center', background:'#000', position:'relative'}}>
        <canvas ref={canvasRef} width={MAP_W} height={MAP_H} style={{display:'block', maxWidth:'100%'}}/>
        {/* phase flash overlay */}
        <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,pointerEvents:'none',background: isNight?'rgba(80,0,0,0.0)':'rgba(255,220,0,0.0)',transition:'background 2s'}}/>
      </div>

      {/* LOG */}
      <div style={{background: isNight?'rgba(80,0,0,0.9)':'rgba(0,40,0,0.9)', padding:'4px 12px', fontSize:11, color: isNight?'#ff8888':'#88ff88', fontWeight:'bold', textAlign:'center', minHeight:20, borderTop:`2px solid ${isNight?'#440000':'#224400'}`}}>
        {log}
      </div>

      {/* CONTROLS */}
      <div style={{background:'linear-gradient(180deg,#111,#0a0a0a)', borderTop:'3px solid #222', flex:1, display:'flex', alignItems:'center'}}>
        {/* DPAD */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(3,52px)', gridTemplateRows:'repeat(3,52px)', gap:3, padding:'6px 8px', flexShrink:0}}>
          {[['','up',''],['left','','right'],['','down','']].map((row,ri)=>row.map((dir,ci)=>(
            <div key={`${ri}-${ci}`} style={dir?{
              background:'linear-gradient(180deg,#444,#222)',
              border:'2px solid #555',
              borderRadius:10,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:20, color:'#fff', cursor:'pointer',
              boxShadow:'0 4px 0 #111',
              userSelect:'none', WebkitUserSelect:'none', touchAction:'none',
            }:{}} 
            onPointerDown={dir?e=>{e.preventDefault();handleDPad(dir,true);}:undefined}
            onPointerUp={dir?e=>{e.preventDefault();handleDPad(dir,false);}:undefined}
            onPointerLeave={dir?()=>handleDPad(dir,false):undefined}>
              {dir==='up'?'▲':dir==='down'?'▼':dir==='left'?'◀':dir==='right'?'▶':''}
            </div>
          )))}
        </div>

        {/* ACTION BUTTONS */}
        <div style={{display:'flex', flexDirection:'column', gap:8, padding:'6px 8px', flex:1}}>
          <button onClick={handleAttack} style={{
            background: isNight?'linear-gradient(180deg,#ff3333,#aa0000)':'linear-gradient(180deg,#555,#333)',
            border:`2px solid ${isNight?'#ff6666':'#444'}`,
            borderRadius:10, padding:'11px 8px', color:'#fff', fontSize:13, fontWeight:900,
            cursor:'pointer', boxShadow:`0 4px 0 ${isNight?'#660000':'#111'}`,
            opacity: isNight?1:0.5, textShadow:'1px 1px 0 rgba(0,0,0,0.5)',
            textTransform:'uppercase', letterSpacing:0.5,
          }}>⚔️ ATTACK</button>
          <button onClick={handleBuild} style={{
            background: !isNight?'linear-gradient(180deg,#886633,#553311)':'linear-gradient(180deg,#444,#222)',
            border:`2px solid ${!isNight?'#ddaa55':'#333'}`,
            borderRadius:10, padding:'11px 8px', color:'#fff', fontSize:13, fontWeight:900,
            cursor:'pointer', boxShadow:`0 4px 0 ${!isNight?'#332200':'#111'}`,
            opacity: !isNight?1:0.5, textShadow:'1px 1px 0 rgba(0,0,0,0.5)',
            textTransform:'uppercase', letterSpacing:0.5,
          }}>🧱 BUILD</button>
          <button onClick={onBack} style={{background:'#1a1a1a', border:'1px solid #333', borderRadius:8, padding:'6px', color:'#666', fontSize:11, cursor:'pointer', textTransform:'uppercase'}}>← EXIT</button>
        </div>
      </div>

      {/* DEATH OVERLAY */}
      {dead && (
        <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.88)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:50,fontFamily:"'Arial Black',Arial,sans-serif"}}>
          <div style={{fontSize:60,marginBottom:8}}>💀</div>
          <div style={{fontSize:28,fontWeight:900,color:'#ff3333',textShadow:'3px 3px 0 #880000',marginBottom:4,textTransform:'uppercase'}}>YOU DIED!</div>
          <div style={{color:'#aaa',marginBottom:4,fontSize:14}}>Survived <b style={{color:'#ffcc00'}}>{day}</b> day{day>1?'s':''}</div>
          <div style={{fontSize:22,fontWeight:900,color:'#ffcc00',textShadow:'2px 2px 0 #886600',marginBottom:24}}>⭐ {day*50} POINTS</div>
          <button onClick={onBack} style={{background:'linear-gradient(180deg,#44dd44,#22aa22)',border:'none',borderRadius:12,padding:'14px 32px',color:'#fff',fontSize:16,fontWeight:900,cursor:'pointer',boxShadow:'0 5px 0 #116611',textTransform:'uppercase',letterSpacing:1}}>PLAY AGAIN</button>
        </div>
      )}
    </div>
  );
}

// ─── LOBBY ───────────────────────────────────────────────────────────────────
function Lobby({ roomCode, myName, myAvatar, roomData, isHost, onStart, onLeave }) {
  const members = roomData?.members || [myName];
  return (
    <div style={{minHeight:'100%', background:'linear-gradient(180deg,#001a2e,#001a00)', fontFamily:"'Arial Black',Arial,sans-serif", overflowY:'auto'}}>
      <div style={{background:'linear-gradient(135deg,#004488,#0066cc)', padding:'16px', textAlign:'center', borderBottom:'4px solid #0088ff', boxShadow:'0 4px 0 #002255'}}>
        <div style={{fontSize:24,fontWeight:900,color:'#fff',textShadow:'2px 2px 0 #002255'}}>WAITING ROOM</div>
      </div>
      <div style={{padding:16, textAlign:'center'}}>
        <div style={{fontSize:12,color:'#88aacc',marginBottom:8,fontWeight:'bold',textTransform:'uppercase',letterSpacing:1}}>Room Code</div>
        <div style={{fontSize:42,fontWeight:900,color:'#44dd44',letterSpacing:8,background:'rgba(0,0,0,0.4)',padding:'12px 20px',borderRadius:14,border:'3px solid #44dd44',marginBottom:16,textShadow:'0 0 20px #44dd44',display:'inline-block'}}>{roomCode}</div>
        <div style={{background:'rgba(255,255,255,0.05)',border:'2px solid rgba(255,255,255,0.1)',borderRadius:14,padding:12,marginBottom:16,textAlign:'left'}}>
          <div style={{color:'#44dd44',fontWeight:900,fontSize:12,marginBottom:8,textTransform:'uppercase'}}>Players ({members.length})</div>
          {members.map((p,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
              <div style={{width:28,height:28,borderRadius:8,background:AVATARS.find(a=>a.id===(roomData?.avatars?.[p]||'blue'))?.bg||'#224499',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>🧑</div>
              <span style={{flex:1,color:p===myName?'#ffcc00':'#ddd',fontWeight:p===myName?900:400,fontSize:13}}>{p}{p===myName?' (you)':''}</span>
              {p===roomData?.host&&<span style={{background:'#ffcc00',color:'#000',fontSize:9,fontWeight:900,padding:'2px 6px',borderRadius:6,textTransform:'uppercase'}}>HOST</span>}
            </div>
          ))}
          <div style={{color:'#666',fontSize:11,marginTop:8,textAlign:'center'}}>{Math.max(0,4-members.length)} slot{4-members.length!==1?'s':''} remaining</div>
        </div>
        {isHost
          ? <button onClick={onStart} style={{width:'100%',background:'linear-gradient(180deg,#44dd44,#22aa22)',border:'none',borderRadius:12,padding:14,color:'#fff',fontSize:16,fontWeight:900,cursor:'pointer',boxShadow:'0 5px 0 #116611',textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>▶ START GAME!</button>
          : <div style={{color:'#aaa',fontSize:13,marginBottom:10,padding:12,background:'rgba(255,255,255,0.05)',borderRadius:10,border:'2px solid #333'}}>Waiting for host to start...</div>
        }
        <button onClick={onLeave} style={{width:'100%',background:'#1a1a1a',border:'2px solid #333',borderRadius:10,padding:10,color:'#888',fontSize:12,cursor:'pointer',textTransform:'uppercase',fontWeight:900}}>← LEAVE ROOM</button>
      </div>
    </div>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
export default function ZombieGame({ playerName, username, onScore, onBack }) {
  const [screen, setScreen] = useState('howtoplay');
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
    unsubRef.current = onSnapshot(doc(db,'zombieRooms',code), snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      setRoomData(data);
      if (data.status==='playing') setScreen('game');
    });
  }, []);

  useEffect(() => () => { if (unsubRef.current) unsubRef.current(); }, []);

  const hostGame = async (av) => {
    setLoading(true);
    const code = genCode();
    try {
      await setDoc(doc(db,'zombieRooms',code), {
        code, host:myName, members:[myName],
        players:{}, avatars:{[myName]:av.id},
        barriers:{}, status:'waiting', phase:'day', day:1,
        createdAt:serverTimestamp(),
      });
      setRoomCode(code); setIsHost(true);
      subscribeRoom(code); setScreen('lobby');
    } catch(e) { setError('Failed to create room'); }
    setLoading(false);
  };

  const joinGame = async (av) => {
    const code = joinCode.trim().toUpperCase();
    if (!code) { setError('Enter a room code'); return; }
    setLoading(true);
    try {
      const snap = await getDoc(doc(db,'zombieRooms',code));
      if (!snap.exists()) { setError('Room not found!'); setLoading(false); return; }
      const data = snap.data();
      if (data.status!=='waiting') { setError('Game already started!'); setLoading(false); return; }
      await updateDoc(doc(db,'zombieRooms',code), { members:[...(data.members||[]),myName], [`avatars.${myName}`]:av.id });
      setRoomCode(code); setIsHost(false);
      subscribeRoom(code); setScreen('lobby');
    } catch(e) { setError('Failed to join'); }
    setLoading(false);
  };

  const startGame = async () => {
    await updateDoc(doc(db,'zombieRooms',roomCode),{status:'playing'});
  };

  const leaveRoom = () => {
    if (unsubRef.current) unsubRef.current();
    setScreen('menu'); setRoomCode(''); setRoomData(null);
  };

  if (screen==='howtoplay') return <HowToPlay onDone={()=>setScreen('avatarselect')}/>;
  if (screen==='avatarselect') return <AvatarSelect playerName={myName} onSelect={av=>{setAvatar(av);setScreen('menu');}}/>;

  if (screen==='game' && avatar) return (
    <GameEngine roomCode={roomCode||'SOLO'} myName={myName} myAvatar={avatar}
      isHost={isHost||!roomCode} roomData={roomData}
      onGameOver={s=>{onScore(s);}} onBack={()=>{leaveRoom();onBack();}}/>
  );

  if (screen==='lobby') return (
    <div style={{width:'100%',height:'100%',overflow:'auto'}}>
      <Lobby roomCode={roomCode} myName={myName} myAvatar={avatar||AVATARS[0]}
        roomData={roomData} isHost={isHost} onStart={startGame} onLeave={leaveRoom}/>
    </div>
  );

  // MENU
  return (
    <div style={{minHeight:'100%', background:'linear-gradient(180deg,#0a0010 0%,#000a00 100%)', fontFamily:"'Arial Black',Arial,sans-serif", overflowY:'auto'}}>
      {/* hero banner */}
      <div style={{background:'linear-gradient(135deg,#330000,#660000,#330000)', padding:'20px 16px', textAlign:'center', borderBottom:'4px solid #ff0000', boxShadow:'0 4px 0 #880000', position:'relative', overflow:'hidden'}}>
        <div style={{fontSize:52, marginBottom:4}}>🧟</div>
        <div style={{fontSize:30, fontWeight:900, color:'#ff3333', textShadow:'3px 3px 0 #660000,-1px -1px 0 #ff8888', letterSpacing:2, textTransform:'uppercase'}}>ZOMBIE BARISTA</div>
        <div style={{fontSize:13, color:'#ff9999', fontWeight:'bold', marginTop:2, textTransform:'uppercase', letterSpacing:1}}>BUILD • DEFEND • SURVIVE</div>
      </div>

      <div style={{padding:14}}>
        {/* avatar display */}
        {avatar && (
          <div style={{display:'flex',alignItems:'center',gap:12,background:'rgba(255,255,255,0.05)',border:`2px solid ${avatar.color}44`,borderRadius:14,padding:'10px 14px',marginBottom:14}}>
            <div style={{width:36,height:36,borderRadius:10,background:avatar.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,border:`2px solid ${avatar.color}`}}>🧑</div>
            <div>
              <div style={{color:avatar.color,fontWeight:900,fontSize:14,textTransform:'uppercase'}}>{myName}</div>
              <div style={{color:'#666',fontSize:11,textTransform:'uppercase',letterSpacing:0.5}}>Playing as {avatar.name}</div>
            </div>
            <button onClick={()=>setScreen('avatarselect')} style={{marginLeft:'auto',background:'#1a1a1a',border:'1px solid #333',borderRadius:8,padding:'5px 10px',color:'#888',fontSize:10,cursor:'pointer',textTransform:'uppercase',fontWeight:900}}>CHANGE</button>
          </div>
        )}

        {/* buttons */}
        <button onClick={()=>avatar?setScreen('game'):setScreen('avatarselect')} style={{width:'100%',background:'linear-gradient(180deg,#ff4444,#cc0000)',border:'none',borderRadius:12,padding:14,color:'#fff',fontSize:16,fontWeight:900,cursor:'pointer',boxShadow:'0 5px 0 #880000',textTransform:'uppercase',letterSpacing:1,marginBottom:10,textShadow:'1px 1px 0 rgba(0,0,0,0.4)'}}>
          ⚔️ PLAY SOLO
        </button>
        <button onClick={()=>avatar?hostGame(avatar):setScreen('avatarselect')} disabled={loading} style={{width:'100%',background:'linear-gradient(180deg,#4488ff,#2255cc)',border:'none',borderRadius:12,padding:14,color:'#fff',fontSize:15,fontWeight:900,cursor:'pointer',boxShadow:'0 5px 0 #113388',textTransform:'uppercase',letterSpacing:1,marginBottom:10,textShadow:'1px 1px 0 rgba(0,0,0,0.4)'}}>
          {loading?'CREATING...':'🏠 HOST MULTIPLAYER'}
        </button>

        <div style={{display:'flex',gap:8,marginBottom:10}}>
          <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} maxLength={4}
            placeholder="CODE" style={{flex:1,background:'#111',border:'2px solid #333',borderRadius:10,padding:'12px',color:'#fff',fontSize:20,fontWeight:900,textAlign:'center',letterSpacing:6,fontFamily:"'Arial Black',Arial,sans-serif"}}/>
          <button onClick={()=>avatar?joinGame(avatar):setScreen('avatarselect')} disabled={loading}
            style={{background:'linear-gradient(180deg,#44cc44,#228822)',border:'none',borderRadius:10,padding:'0 16px',color:'#fff',fontSize:14,fontWeight:900,cursor:'pointer',boxShadow:'0 4px 0 #116611',textTransform:'uppercase'}}>
            JOIN
          </button>
        </div>

        <button onClick={()=>setScreen('howtoplay')} style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'2px solid rgba(255,255,255,0.12)',borderRadius:10,padding:10,color:'#aaa',fontSize:13,cursor:'pointer',textTransform:'uppercase',fontWeight:900,marginBottom:8,letterSpacing:1}}>
          📖 HOW TO PLAY
        </button>
        <button onClick={onBack} style={{width:'100%',background:'transparent',border:'1px solid #222',borderRadius:8,padding:8,color:'#444',fontSize:11,cursor:'pointer',textTransform:'uppercase'}}>
          ← BACK TO GAMES
        </button>

        {error && <div style={{color:'#ff4444',marginTop:10,textAlign:'center',fontSize:13,fontWeight:'bold'}}>{error}</div>}
      </div>
    </div>
  );
}
