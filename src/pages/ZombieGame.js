import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase/config';
import { doc, setDoc, onSnapshot, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const TILE = 20;
const BARRIER_HP = 5;
const DAY_DURATION = 45000;
const NIGHT_DURATION = 40000;
const HUNGER_DRAIN = 0.008; // per frame
const HUNGER_DAMAGE_RATE = 60; // frames between starvation damage

const AVATARS = [
  { id:'red',    name:'Red',    color:'#ff4444', bg:'#cc0000' },
  { id:'blue',   name:'Blue',   color:'#4488ff', bg:'#2255cc' },
  { id:'green',  name:'Green',  color:'#44cc44', bg:'#228822' },
  { id:'yellow', name:'Yellow', color:'#ffcc00', bg:'#cc9900' },
  { id:'purple', name:'Purple', color:'#cc44ff', bg:'#9922cc' },
  { id:'orange', name:'Orange', color:'#ff8800', bg:'#cc5500' },
];
const AVATAR_BODIES = {
  red:{body:'#ff3333',head:'#ffccaa',shirt:'#cc0000'},
  blue:{body:'#3366ff',head:'#ffccaa',shirt:'#0033cc'},
  green:{body:'#33cc33',head:'#ffccaa',shirt:'#009900'},
  yellow:{body:'#ffcc00',head:'#ffccaa',shirt:'#cc9900'},
  purple:{body:'#cc33ff',head:'#ffccaa',shirt:'#9900cc'},
  orange:{body:'#ff8800',head:'#ffccaa',shirt:'#cc5500'},
};

const FOOD_ITEMS = ['☕','🍰','🧁','🍩','🥐','🍫'];

// map grows each day — base 16x20, expands outward
function buildMap(day) {
  const extraRows = Math.min((day-1)*2, 10);
  const rows = 20 + extraRows;
  const cols = 16;
  const map = Array.from({length:rows}, (_, r) =>
    Array.from({length:cols}, (_, c) => {
      if (r===0||r===rows-1||c===0||c===cols-1) return 1;
      // counters
      if ((r===2||r===4)&&(c>=2&&c<=4)) return 2;
      if ((r===2||r===4)&&(c>=11&&c<=13)) return 2;
      if (r>=rows-6&&r<=rows-5&&(c===2||c===3||c===12||c===13)) return 2;
      // tables
      if ((r===6||r===8)&&(c===3||c===12)) return 3;
      if (r===7&&(c>=2&&c<=4||c>=11&&c<=13)) return 3;
      // extra map objects for higher days
      if (day>=3 && r===Math.floor(rows/2) && (c===4||c===11)) return 2;
      if (day>=5 && r===Math.floor(rows*0.7) && (c===6||c===9)) return 3;
      return 0;
    })
  );
  return {map, cols, rows, w:cols*TILE, h:rows*TILE};
}

function isSolid(map, barriers, tx, ty, cols, rows) {
  if (tx<0||ty<0||tx>=cols||ty>=rows) return true;
  if (map[ty][tx]===1||map[ty][tx]===2) return true;
  if (barriers[`${tx},${ty}`]) return true;
  return false;
}

// ─── DRAW HELPERS ─────────────────────────────────────────────────────────────
function drawRobloxChar(ctx, x, y, colors, label, labelColor, isZombie=false, hungerRatio=1) {
  const s = 14;
  ctx.fillStyle='rgba(0,0,0,0.22)';
  ctx.beginPath();ctx.ellipse(x,y+s*0.6,s*0.7,s*0.18,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=isZombie?'#228822':(hungerRatio<0.3?'#888':colors.body);
  ctx.fillRect(x-s*0.35,y-s*0.6,s*0.7,s*0.65);
  ctx.fillStyle=isZombie?'#116611':colors.shirt;
  ctx.fillRect(x-s*0.35,y-s*0.6,s*0.7,s*0.15);
  ctx.fillStyle=isZombie?'#1a5c1a':'#2244aa';
  ctx.fillRect(x-s*0.32,y+s*0.04,s*0.28,s*0.5);
  ctx.fillRect(x+s*0.04,y+s*0.04,s*0.28,s*0.5);
  ctx.fillStyle=isZombie?'#228822':(hungerRatio<0.3?'#888':colors.body);
  if(isZombie){ctx.fillRect(x-s*0.75,y-s*0.55,s*0.38,s*0.18);ctx.fillRect(x+s*0.36,y-s*0.65,s*0.38,s*0.18);}
  else{ctx.fillRect(x-s*0.65,y-s*0.55,s*0.28,s*0.45);ctx.fillRect(x+s*0.36,y-s*0.55,s*0.28,s*0.45);}
  ctx.fillStyle=isZombie?'#88cc44':colors.head;
  ctx.fillRect(x-s*0.3,y-s*1.15,s*0.6,s*0.55);
  if(isZombie){
    ctx.fillStyle='#ff0000';
    ctx.fillRect(x-s*0.18,y-s*0.95,s*0.1,s*0.1);
    ctx.fillRect(x+s*0.08,y-s*0.95,s*0.1,s*0.1);
  } else {
    ctx.fillStyle='#333';
    ctx.fillRect(x-s*0.18,y-s*0.95,s*0.1,s*0.12);
    ctx.fillRect(x+s*0.08,y-s*0.95,s*0.1,s*0.12);
    ctx.fillStyle='#ffaaaa';
    ctx.fillRect(x-s*0.1,y-s*0.72,s*0.2,s*0.06);
    // hunger indicator — mouth goes sad
    if(hungerRatio<0.4){
      ctx.fillStyle='#ff8800';
      ctx.fillRect(x-s*0.1,y-s*0.68,s*0.2,s*0.06);
    }
  }
  if(label){
    ctx.font='bold 8px Arial';ctx.textAlign='center';
    const tw=ctx.measureText(label).width+6;
    ctx.fillStyle='rgba(0,0,0,0.55)';
    ctx.fillRect(x-tw/2,y-s*1.35,tw,12);
    ctx.fillStyle=labelColor||'#fff';
    ctx.fillText(label,x,y-s*1.25);
  }
}

function drawBarrier(ctx,x,y,ratio){
  const s=TILE;
  ctx.fillStyle=`rgba(139,90,43,${0.5+ratio*0.5})`;
  ctx.fillRect(x+1,y+1,s-2,s-2);
  ctx.strokeStyle=`rgba(80,40,10,${ratio*0.8})`;ctx.lineWidth=1;
  for(let r=0;r<3;r++){const ry=y+2+r*(s-4)/3;ctx.beginPath();ctx.moveTo(x+1,ry);ctx.lineTo(x+s-1,ry);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(x+s/2,y+2);ctx.lineTo(x+s/2,y+(s-4)/3+2);ctx.stroke();
  if(ratio<0.5){ctx.strokeStyle='rgba(0,0,0,0.5)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+s*0.3,y+s*0.2);ctx.lineTo(x+s*0.5,y+s*0.6);ctx.lineTo(x+s*0.4,y+s*0.9);ctx.stroke();}
  ctx.strokeStyle=`rgba(212,168,83,${ratio})`;ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,s-2,s-2);
}

function genCode(){return Array.from({length:4},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');}

// ─── HOW TO PLAY ──────────────────────────────────────────────────────────────
function HowToPlay({onDone}){
  const steps=[
    {icon:'🕹️',title:'Move',desc:'Drag the left joystick to walk around. Push hard to sprint!'},
    {icon:'☀️',title:'Daytime — Build & Eat',desc:'Place barriers with BUILD. Collect food 🍰☕ scattered around the map to fill your hunger bar!'},
    {icon:'🌙',title:'Nighttime — Survive',desc:'Screen goes dark red. Zombies spawn and hunt you. Use ATTACK when they are close!'},
    {icon:'🧱',title:'Barriers',desc:'Place brick walls to slow zombies. Use REMOVE to demolish your own barriers. Zombies eat through them over time!'},
    {icon:'🍽️',title:'Hunger',desc:'Your hunger bar drains constantly. Eat food on the map or you will lose HP! Find glowing items everywhere.'},
    {icon:'🗺️',title:'Expanding Map',desc:'Each new day the map grows bigger — new rooms open up but zombies get faster and more numerous!'},
    {icon:'👥',title:'Multiplayer',desc:'Host a room, share the 4-letter code. Teammates play together on their own phones!'},
  ];
  return(
    <div style={{minHeight:'100%',background:'linear-gradient(180deg,#1a0a2e 0%,#0a1a0e 100%)',color:'#fff',fontFamily:"'Arial Black',Arial,sans-serif",overflowY:'auto'}}>
      <div style={{background:'linear-gradient(135deg,#ff6600,#ffcc00)',padding:'18px 16px 14px',textAlign:'center',borderBottom:'4px solid #ff8800',boxShadow:'0 4px 0 #cc5500'}}>
        <div style={{fontSize:30,fontWeight:900,color:'#fff',textShadow:'3px 3px 0 #cc4400',letterSpacing:1}}>HOW TO PLAY</div>
        <div style={{fontSize:13,color:'#fff8',marginTop:2}}>Zombie Barista Survival</div>
      </div>
      <div style={{padding:'14px 14px 4px'}}>
        {steps.map((s,i)=>(
          <div key={i} style={{display:'flex',gap:12,alignItems:'flex-start',background:'rgba(255,255,255,0.07)',border:'2px solid rgba(255,255,255,0.1)',borderRadius:14,padding:'10px 12px',marginBottom:10,boxShadow:'0 3px 0 rgba(0,0,0,0.3)'}}>
            <div style={{fontSize:24,minWidth:32,textAlign:'center'}}>{s.icon}</div>
            <div><div style={{fontWeight:900,color:'#ffcc00',fontSize:13,marginBottom:2,textTransform:'uppercase'}}>{s.title}</div>
            <div style={{color:'#ccc',fontSize:12,lineHeight:1.5}}>{s.desc}</div></div>
          </div>
        ))}
      </div>
      <div style={{padding:'0 14px 14px'}}>
        <button onClick={onDone} style={{width:'100%',background:'linear-gradient(180deg,#44dd44,#22aa22)',border:'none',borderRadius:12,padding:'14px',color:'#fff',fontSize:17,fontWeight:900,cursor:'pointer',boxShadow:'0 5px 0 #116611',textTransform:'uppercase',letterSpacing:1,textShadow:'1px 1px 0 #004400',display:'block'}}>LET'S GO! →</button>
      </div>
    </div>
  );
}

// ─── AVATAR SELECT ─────────────────────────────────────────────────────────────
function AvatarSelect({playerName,onSelect}){
  const [sel,setSel]=useState(AVATARS[0].id);
  const selAv=AVATARS.find(a=>a.id===sel);
  return(
    <div style={{minHeight:'100%',background:'linear-gradient(180deg,#1a0a2e 0%,#0a1a0e 100%)',fontFamily:"'Arial Black',Arial,sans-serif",overflowY:'auto'}}>
      <div style={{background:'linear-gradient(135deg,#9900cc,#ff44ff)',padding:'18px 16px 14px',textAlign:'center',borderBottom:'4px solid #cc00ff',boxShadow:'0 4px 0 #660099'}}>
        <div style={{fontSize:26,fontWeight:900,color:'#fff',textShadow:'3px 3px 0 #660099'}}>PICK YOUR CHARACTER</div>
        <div style={{fontSize:12,color:'#ffccff',marginTop:2}}>Playing as: <b style={{color:'#ffff00'}}>{playerName}</b></div>
      </div>
      <div style={{padding:14}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
          {AVATARS.map(av=>{
            const isSel=sel===av.id;
            return(
              <div key={av.id} onClick={()=>setSel(av.id)} style={{background:isSel?`${av.bg}33`:'rgba(255,255,255,0.05)',border:`3px solid ${isSel?av.color:'rgba(255,255,255,0.1)'}`,borderRadius:14,padding:'12px 6px',textAlign:'center',cursor:'pointer',boxShadow:isSel?`0 0 12px ${av.color}44`:'none',transition:'all 0.15s'}}>
                <svg width="40" height="48" viewBox="0 0 40 48" style={{display:'block',margin:'0 auto 6px'}}>
                  <ellipse cx="20" cy="45" rx="10" ry="3" fill="rgba(0,0,0,0.3)"/>
                  <rect x="12" y="30" width="7" height="12" rx="2" fill="#224499"/>
                  <rect x="21" y="30" width="7" height="12" rx="2" fill="#224499"/>
                  <rect x="10" y="17" width="20" height="15" rx="2" fill={AVATAR_BODIES[av.id].body}/>
                  <rect x="10" y="17" width="20" height="5" rx="2" fill={AVATAR_BODIES[av.id].shirt}/>
                  <rect x="3" y="17" width="7" height="12" rx="2" fill={AVATAR_BODIES[av.id].body}/>
                  <rect x="30" y="17" width="7" height="12" rx="2" fill={AVATAR_BODIES[av.id].body}/>
                  <rect x="12" y="3" width="16" height="15" rx="3" fill="#ffccaa"/>
                  <rect x="15" y="8" width="4" height="4" rx="1" fill="#333"/>
                  <rect x="22" y="8" width="4" height="4" rx="1" fill="#333"/>
                  <path d="M16 15 Q20 18 25 15" stroke="#cc8866" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                  {isSel&&<><circle cx="33" cy="6" r="6" fill="#44dd44"/><text x="33" y="10" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold">✓</text></>}
                </svg>
                <div style={{fontWeight:900,fontSize:12,color:isSel?av.color:'#aaa',textTransform:'uppercase'}}>{av.name}</div>
              </div>
            );
          })}
        </div>
        <button onClick={()=>onSelect(selAv)} style={{width:'100%',background:`linear-gradient(180deg,${selAv.color},${selAv.bg})`,border:'none',borderRadius:12,padding:'14px',color:'#fff',fontSize:16,fontWeight:900,cursor:'pointer',boxShadow:`0 5px 0 ${selAv.bg}`,textShadow:'1px 1px 0 rgba(0,0,0,0.4)',textTransform:'uppercase',letterSpacing:1}}>
          PLAY AS {selAv.name} →
        </button>
      </div>
    </div>
  );
}

// ─── GAME ENGINE ──────────────────────────────────────────────────────────────
function GameEngine({roomCode,myName,myAvatar,isHost,roomData,onGameOver,onBack}){
  const canvasRef=useRef(null);
  const stateRef=useRef(null);
  const rafRef=useRef(null);
  const keysRef=useRef({joystick:{x:0,y:0}});
  const lastSyncRef=useRef(0);
  const phaseRef=useRef('day');
  const phaseStartRef=useRef(Date.now());
  const dayRef=useRef(1);
  const hpRef=useRef(100);
  const hungerRef=useRef(100);
  const hungerDmgRef=useRef(0);
  const mapRef=useRef(buildMap(1));

  const [phase,setPhase]=useState('day');
  const [phaseTimer,setPhaseTimer]=useState(DAY_DURATION/1000);
  const [day,setDay]=useState(1);
  const [hp,setHp]=useState(100);
  const [hunger,setHunger]=useState(100);
  const [zombieCount,setZombieCount]=useState(0);
  const [log,setLog]=useState('☀️ Day 1 — Build & eat before night!');
  const [dead,setDead]=useState(false);
  const [score,setScore]=useState(0);
  const [removeMode,setRemoveMode]=useState(false);

  // spawn food randomly on open tiles
  const spawnFood=(map,cols,rows,count=6)=>{
    const food=[];
    let attempts=0;
    while(food.length<count&&attempts<200){
      attempts++;
      const tx=1+Math.floor(Math.random()*(cols-2));
      const ty=1+Math.floor(Math.random()*(rows-2));
      if(map[ty][tx]===0) food.push({x:tx*TILE+TILE/2,y:ty*TILE+TILE/2,type:FOOD_ITEMS[Math.floor(Math.random()*FOOD_ITEMS.length)],id:Math.random()});
    }
    return food;
  };

  useEffect(()=>{
    const m=buildMap(1);
    mapRef.current=m;
    stateRef.current={
      player:{x:8*TILE,y:10*TILE,hp:100},
      others:{},zombies:[],barriers:{},
      food:spawnFood(m.map,m.cols,m.rows,8),
      phase:'day',day:1,
    };
    phaseStartRef.current=Date.now();
    const loop=()=>{update();draw();rafRef.current=requestAnimationFrame(loop);};
    rafRef.current=requestAnimationFrame(loop);
    return()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current);};
  },[]);

  useEffect(()=>{
    if(!roomData?.players||!stateRef.current)return;
    const others={};
    Object.entries(roomData.players||{}).forEach(([n,d])=>{if(n!==myName)others[n]=d;});
    stateRef.current.others=others;
    if(roomData.barriers&&!isHost)stateRef.current.barriers={...roomData.barriers};
  },[roomData]);

  const pushState=useCallback(async()=>{
    const st=stateRef.current;if(!st)return;
    const now=Date.now();if(now-lastSyncRef.current<250)return;lastSyncRef.current=now;
    try{await updateDoc(doc(db,'zombieRooms',roomCode),{[`players.${myName}`]:{x:Math.round(st.player.x),y:Math.round(st.player.y),hp:st.player.hp,avatarId:myAvatar.id,color:myAvatar.color},...(isHost?{barriers:st.barriers,phase:st.phase,day:st.day}:{})});}catch(e){}
  },[roomCode,myName,myAvatar,isHost]);

  const spawnZombies=(st,d)=>{
    const m=mapRef.current;
    const count=Math.min(2+d*2,14);
    const spd=ZOMBIE_SPEED+d*0.12;
    const hp2=2+Math.floor(d/2);
    // spawn far from player at map edges
    const px=st.player.x,py=st.player.y;
    const pts=[[1,1],[m.cols-2,1],[1,m.rows-2],[m.cols-2,m.rows-2],
      [Math.floor(m.cols/2),1],[Math.floor(m.cols/2),m.rows-2],
      [1,Math.floor(m.rows/2)],[m.cols-2,Math.floor(m.rows/2)]];
    const newZombies=[];
    for(let i=0;i<count;i++){
      const p=pts[i%pts.length];
      newZombies.push({
        id:Date.now()+i,
        x:p[0]*TILE+Math.random()*6,
        y:p[1]*TILE+Math.random()*6,
        hp:hp2,maxHp:hp2,speed:spd,attackTimer:0
      });
    }
    st.zombies=newZombies;
    setZombieCount(newZombies.length);
    console.log('Spawned zombies:',newZombies.length,'on day',d);
  };

  const removeModeRef=useRef(false);
  const setRemoveModeSync=(v)=>{removeModeRef.current=v;setRemoveMode(v);};

  const update=()=>{
    const st=stateRef.current;if(!st||dead)return;
    const m=mapRef.current;
    const elapsed=Date.now()-phaseStartRef.current;
    const dur=phaseRef.current==='day'?DAY_DURATION:NIGHT_DURATION;
    setPhaseTimer(Math.max(0,Math.floor((dur-elapsed)/1000)));
    setScore(dayRef.current*50+(phaseRef.current==='night'?25:0));

    // hunger drain
    hungerRef.current=Math.max(0,hungerRef.current-HUNGER_DRAIN);
    setHunger(Math.floor(hungerRef.current));
    if(hungerRef.current<=0){
      hungerDmgRef.current++;
      if(hungerDmgRef.current>=HUNGER_DAMAGE_RATE){
        hungerDmgRef.current=0;
        hpRef.current=Math.max(0,hpRef.current-5);
        st.player.hp=hpRef.current;
        setHp(hpRef.current);
        setLog('😵 Starving! Find food!');
        if(hpRef.current<=0){setDead(true);onGameOver(dayRef.current*50);return;}
      }
    }

    // phase transition
    if(elapsed>=dur){
      const newPhase=phaseRef.current==='day'?'night':'day';
      phaseRef.current=newPhase;phaseStartRef.current=Date.now();setPhase(newPhase);
      if(newPhase==='night'){
        spawnZombies(st,dayRef.current);
        setLog(`🌙 Night ${dayRef.current} — ZOMBIES INCOMING!`);
      } else {
        st.zombies=[];setZombieCount(0);
        dayRef.current++;
        const newMap=buildMap(dayRef.current);
        mapRef.current=newMap;
        // add new food on expanded map
        const newFood=spawnFood(newMap.map,newMap.cols,newMap.rows,6+dayRef.current);
        st.food=[...(st.food||[]),...newFood];
        setDay(dayRef.current);
        setLog(`☀️ Day ${dayRef.current} — Map expanded! Find food!`);
      }
      st.phase=phaseRef.current;st.day=dayRef.current;
    }

    // movement — use smaller margin so barriers don't trap player
    const jv=keysRef.current.joystick||{x:0,y:0};
    const spd=3+(hungerRef.current<20?-1:0);
    const dx=jv.x*spd,dy=jv.y*spd;
    if(Math.abs(dx)>0.01||Math.abs(dy)>0.01){
      const nx=st.player.x+dx,ny=st.player.y+dy;
      const margin=TILE*0.35; // tighter margin - less likely to get stuck
      // try full move
      const cFull=[[nx-margin,ny-margin],[nx+margin,ny-margin],[nx-margin,ny+margin],[nx+margin,ny+margin]];
      const blockedFull=cFull.some(([cx,cy])=>isSolid(m.map,st.barriers,Math.floor(cx/TILE),Math.floor(cy/TILE),m.cols,m.rows));
      if(!blockedFull){
        st.player.x=Math.max(TILE,Math.min(m.w-TILE,nx));
        st.player.y=Math.max(TILE,Math.min(m.h-TILE,ny));
      } else {
        // try x only
        const cX=[[nx-margin,st.player.y-margin],[nx+margin,st.player.y-margin],[nx-margin,st.player.y+margin],[nx+margin,st.player.y+margin]];
        if(!cX.some(([cx,cy])=>isSolid(m.map,st.barriers,Math.floor(cx/TILE),Math.floor(cy/TILE),m.cols,m.rows)))
          st.player.x=Math.max(TILE,Math.min(m.w-TILE,nx));
        // try y only
        const cY=[[st.player.x-margin,ny-margin],[st.player.x+margin,ny-margin],[st.player.x-margin,ny+margin],[st.player.x+margin,ny+margin]];
        if(!cY.some(([cx,cy])=>isSolid(m.map,st.barriers,Math.floor(cx/TILE),Math.floor(cy/TILE),m.cols,m.rows)))
          st.player.y=Math.max(TILE,Math.min(m.h-TILE,ny));
      }
    }

    // eat food
    st.food=(st.food||[]).filter(f=>{
      const dist=Math.hypot(f.x-st.player.x,f.y-st.player.y);
      if(dist<TILE*1.1){
        hungerRef.current=Math.min(100,hungerRef.current+25);
        hpRef.current=Math.min(100,hpRef.current+3);
        st.player.hp=hpRef.current;
        setHunger(Math.floor(hungerRef.current));
        setHp(Math.floor(hpRef.current));
        setLog(`😋 Ate ${f.type} +25 hunger!`);
        return false;
      }
      return true;
    });
    // respawn food if low
    if((st.food||[]).length<3){
      st.food=[...(st.food||[]),...spawnFood(m.map,m.cols,m.rows,4)];
    }

    // zombies
    if(phaseRef.current==='night'){
      st.zombies.forEach(z=>{
        if(z.hp<=0)return;
        const pdx=st.player.x-z.x,pdy=st.player.y-z.y;
        const dist=Math.hypot(pdx,pdy);
        if(dist>4){
          const angle=Math.atan2(pdy,pdx);
          const nx2=z.x+Math.cos(angle)*z.speed;
          const ny2=z.y+Math.sin(angle)*z.speed;
          const ztx=Math.floor(nx2/TILE),zty=Math.floor(ny2/TILE);
          const bKey=`${ztx},${zty}`;
          if(st.barriers[bKey]!==undefined){
            st.barriers[bKey]-=0.02;
            if(st.barriers[bKey]<=0){delete st.barriers[bKey];setLog('🧱 Barrier destroyed!');}
          } else if(!isSolid(m.map,{},ztx,zty,m.cols,m.rows)){z.x=nx2;z.y=ny2;}
        }
        if(dist<TILE*1.3){
          z.attackTimer=(z.attackTimer||0)+1;
          if(z.attackTimer>50){
            z.attackTimer=0;
            hpRef.current=Math.max(0,hpRef.current-12);
            st.player.hp=hpRef.current;setHp(hpRef.current);
            if(hpRef.current<=0){setDead(true);onGameOver(dayRef.current*50);}
          }
        }
      });
      st.zombies=st.zombies.filter(z=>z.hp>0);
      setZombieCount(st.zombies.filter(z=>z.hp>0).length);
    }
    pushState();
  };

  const draw=()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext('2d');
    const st=stateRef.current;if(!st)return;
    const m=mapRef.current;
    const isNight=phaseRef.current==='night';
    const cw=canvas.width,ch=canvas.height;

    // camera follow player — clamp to map
    const camX=Math.max(0,Math.min(m.w-cw,st.player.x-cw/2));
    const camY=Math.max(0,Math.min(m.h-ch,st.player.y-ch/2));
    ctx.save();ctx.translate(-camX,-camY);

    ctx.fillStyle=isNight?'#050510':'#141a00';
    ctx.fillRect(camX,camY,cw,ch);

    // tiles
    for(let ty=0;ty<m.rows;ty++)for(let tx=0;tx<m.cols;tx++){
      const tile=m.map[ty][tx];
      const x=tx*TILE,y=ty*TILE;
      if(x+TILE<camX||x>camX+cw||y+TILE<camY||y>camY+ch)continue;
      if(tile===1){ctx.fillStyle=isNight?'#1a1a2e':'#3a2200';ctx.fillRect(x,y,TILE,TILE);ctx.strokeStyle=isNight?'#2a2a3e':'#5a3a00';ctx.lineWidth=1;ctx.strokeRect(x,y,TILE,TILE);}
      else if(tile===2){ctx.fillStyle=isNight?'#2a2a1e':'#5d3a10';ctx.fillRect(x,y,TILE,TILE);ctx.fillStyle=isNight?'#1a1a10':'#4a2a00';ctx.fillRect(x+2,y+2,TILE-4,TILE-4);}
      else if(tile===3){ctx.fillStyle=isNight?'#0e1e0e':'#2a3a00';ctx.fillRect(x,y,TILE,TILE);}
      else{ctx.fillStyle=isNight?'#080810':'#141a00';ctx.fillRect(x,y,TILE,TILE);}
    }
    if(!isNight){ctx.strokeStyle='rgba(80,120,0,0.15)';ctx.lineWidth=0.5;for(let i=0;i<m.w;i+=8){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,m.h);ctx.stroke();}for(let i=0;i<m.h;i+=8){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(m.w,i);ctx.stroke();}}

    // food items — glowing
    (st.food||[]).forEach(f=>{
      const pulse=0.7+0.3*Math.sin(Date.now()/400+f.id*10);
      ctx.save();
      ctx.shadowColor='#ffcc00';ctx.shadowBlur=8*pulse;
      ctx.font='14px serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(f.type,f.x,f.y);
      ctx.restore();
    });

    // barriers
    Object.entries(st.barriers).forEach(([key,hp2])=>{
      const [bx,by]=key.split(',').map(Number);
      drawBarrier(ctx,bx*TILE,by*TILE,hp2/BARRIER_HP);
      // remove mode indicator
      if(removeModeRef.current){
        ctx.fillStyle='rgba(255,0,0,0.25)';
        ctx.fillRect(bx*TILE,by*TILE,TILE,TILE);
        ctx.fillStyle='#ff4444';ctx.font='bold 14px Arial';ctx.textAlign='center';
        ctx.fillText('✕',bx*TILE+TILE/2,by*TILE+TILE/2+5);
      }
    });

    // others
    Object.entries(st.others).forEach(([name,data])=>{
      const col=AVATAR_BODIES[data.avatarId||'blue']||AVATAR_BODIES.blue;
      drawRobloxChar(ctx,data.x,data.y,col,name.slice(0,6),data.color||'#4488ff');
    });

    // zombies
    st.zombies.forEach(z=>{
      if(z.hp<=0)return;
      drawRobloxChar(ctx,z.x,z.y,null,null,null,true);
      ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(z.x-12,z.y-28,24,5);
      ctx.fillStyle='#ff2222';ctx.fillRect(z.x-12,z.y-28,24*(z.hp/z.maxHp),5);
      ctx.strokeStyle='#000';ctx.lineWidth=0.5;ctx.strokeRect(z.x-12,z.y-28,24,5);
    });

    // player
    const pc=AVATAR_BODIES[myAvatar.id];
    drawRobloxChar(ctx,st.player.x,st.player.y,pc,myName.slice(0,6),myAvatar.color,false,hungerRef.current/100);
    ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(st.player.x-14,st.player.y-28,28,5);
    ctx.fillStyle=hpRef.current>50?'#44dd44':hpRef.current>25?'#ff9800':'#ff4444';
    ctx.fillRect(st.player.x-14,st.player.y-28,28*(hpRef.current/100),5);

    // night vignette
    if(isNight){
      const vg=ctx.createRadialGradient(st.player.x,st.player.y,60,st.player.x,st.player.y,Math.max(m.w,m.h)*0.7);
      vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,0.78)');
      ctx.fillStyle=vg;ctx.fillRect(camX,camY,cw,ch);
      ctx.fillStyle='rgba(100,0,0,0.1)';ctx.fillRect(camX,camY,cw,ch);
    }
    ctx.restore();
  };

  // ── joystick ──
  const joystickRef=useRef(null);
  const [joystickVis,setJoystickVis]=useState({baseX:80,baseY:60,knobX:80,knobY:60,active:false});
  const JOYSTICK_RADIUS=48;
  const onJoyStart=useCallback((e)=>{e.preventDefault();const t=e.touches?e.touches[0]:e;const rect=e.currentTarget.getBoundingClientRect();const bx=t.clientX-rect.left,by=t.clientY-rect.top;joystickRef.current={baseX:bx,baseY:by};setJoystickVis({baseX:bx,baseY:by,knobX:bx,knobY:by,active:true});keysRef.current.joystick={x:0,y:0};},[]);
  const onJoyMove=useCallback((e)=>{e.preventDefault();if(!joystickRef.current)return;const t=e.touches?e.touches[0]:e;const rect=e.currentTarget.getBoundingClientRect();const mx=t.clientX-rect.left,my=t.clientY-rect.top;const{baseX,baseY}=joystickRef.current;const rawDx=mx-baseX,rawDy=my-baseY;const dist=Math.hypot(rawDx,rawDy);const clamped=Math.min(dist,JOYSTICK_RADIUS);const angle=Math.atan2(rawDy,rawDx);const knobX=baseX+Math.cos(angle)*clamped,knobY=baseY+Math.sin(angle)*clamped;keysRef.current.joystick={x:dist>8?Math.cos(angle):0,y:dist>8?Math.sin(angle):0};setJoystickVis({baseX,baseY,knobX,knobY,active:true});},[]);
  const onJoyEnd=useCallback((e)=>{e.preventDefault();joystickRef.current=null;keysRef.current.joystick={x:0,y:0};setJoystickVis(v=>({...v,active:false}));},[]);

  const handleBuild=()=>{
    const st=stateRef.current;if(!st)return;
    if(phaseRef.current==='night'){setLog('⚠️ Build during the day!');return;}
    const m=mapRef.current;
    const ptx=Math.floor(st.player.x/TILE),pty=Math.floor(st.player.y/TILE);
    // never place on tile player stands on — only adjacent tiles
    for(const[ox,oy]of[[0,-1],[1,0],[0,1],[-1,0],[-1,-1],[1,-1],[1,1],[-1,1]]){
      const bx=ptx+ox,by=pty+oy,key=`${bx},${by}`;
      if(bx===ptx&&by===pty)continue; // skip own tile
      if(!isSolid(m.map,{},bx,by,m.cols,m.rows)&&!st.barriers[key]){
        st.barriers[key]=BARRIER_HP;setLog('🧱 Barrier placed!');return;
      }
    }
    setLog('⚠️ No space nearby!');
  };

  const handleRemove=()=>{
    const st=stateRef.current;if(!st)return;
    const m=mapRef.current;
    const tx=Math.floor(st.player.x/TILE),ty=Math.floor(st.player.y/TILE);
    for(const[ox,oy]of[[0,0],[0,-1],[1,0],[0,1],[-1,0],[1,-1],[-1,-1],[1,1],[-1,1]]){
      const bx=tx+ox,by=ty+oy,key=`${bx},${by}`;
      if(st.barriers[key]!==undefined){delete st.barriers[key];setLog('🗑️ Barrier removed!');return;}
    }
    setLog('⚠️ No barrier nearby!');
  };

  const handleAttack=()=>{
    const st=stateRef.current;if(!st)return;
    if(phaseRef.current==='day'){setLog('☀️ No zombies during the day!');return;}
    let hit=false;
    st.zombies.forEach(z=>{if(Math.hypot(z.x-st.player.x,z.y-st.player.y)<TILE*2.2){z.hp-=1;hit=true;}});
    st.zombies=st.zombies.filter(z=>z.hp>0);
    if(hit){setLog('⚔️ Hit!');setZombieCount(st.zombies.length);}
    else setLog('⚠️ No zombie in range!');
  };

  const isNight=phase==='night';
  const hpColor=hp>60?'#44dd44':hp>30?'#ffcc00':'#ff3333';
  const hungerColor=hunger>60?'#ff8800':hunger>30?'#ffcc00':'#ff3333';

  return(
    <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',background:'#000',fontFamily:"'Arial Black',Arial,sans-serif",overflow:'hidden'}}>

      {/* TOP HUD */}
      <div style={{background:isNight?'linear-gradient(90deg,#200000,#100010,#200000)':'linear-gradient(90deg,#003300,#001a00,#003300)',padding:'5px 8px',display:'flex',alignItems:'center',gap:6,borderBottom:`3px solid ${isNight?'#ff0000':'#44aa00'}`}}>
        <button onClick={onBack} style={{background:'#1a1a1a',border:'2px solid #444',borderRadius:8,padding:'3px 8px',color:'#aaa',fontSize:10,cursor:'pointer',fontWeight:900,textTransform:'uppercase',flexShrink:0}}>✕ EXIT</button>
        <div style={{background:isNight?'linear-gradient(180deg,#ff3300,#880000)':'linear-gradient(180deg,#ffcc00,#aa7700)',borderRadius:7,padding:'3px 7px',boxShadow:`0 2px 0 ${isNight?'#550000':'#665500'}`,border:`2px solid ${isNight?'#ff6600':'#ffee00'}`}}>
          <div style={{fontSize:10,fontWeight:900,color:'#fff',textShadow:'1px 1px 0 rgba(0,0,0,0.5)',lineHeight:1}}>{isNight?'🌙 NIGHT':'☀️ DAY'} {day}</div>
        </div>
        <div style={{background:'rgba(0,0,0,0.5)',borderRadius:7,padding:'3px 6px',border:'2px solid rgba(255,255,255,0.2)'}}>
          <span style={{fontSize:11,fontWeight:900,color:phaseTimer<10?'#ff4444':'#fff'}}>⏱{phaseTimer}s</span>
        </div>
        {isNight&&<div style={{background:'rgba(200,0,0,0.4)',borderRadius:7,padding:'3px 6px',border:'2px solid #ff4444'}}><span style={{fontSize:10,fontWeight:900,color:'#ff8888'}}>🧟{zombieCount}</span></div>}
        <div style={{marginLeft:'auto',background:'rgba(255,200,0,0.15)',borderRadius:7,padding:'3px 6px',border:'2px solid rgba(255,200,0,0.3)'}}>
          <span style={{fontSize:10,fontWeight:900,color:'#ffcc00'}}>⭐{score}</span>
        </div>
      </div>

      {/* HP + HUNGER BARS */}
      <div style={{background:'rgba(0,0,0,0.85)',padding:'3px 8px',display:'flex',gap:8,alignItems:'center'}}>
        <span style={{fontSize:10,fontWeight:900,color:hpColor,minWidth:22}}>❤️{hp}</span>
        <div style={{flex:1,height:8,background:'#330000',borderRadius:4,border:'1px solid #550000',overflow:'hidden'}}>
          <div style={{width:`${hp}%`,height:'100%',background:`linear-gradient(90deg,${hpColor},${hpColor}99)`,borderRadius:4,transition:'width 0.3s'}}/>
        </div>
        <span style={{fontSize:10,fontWeight:900,color:hungerColor,minWidth:22}}>🍽️{hunger}</span>
        <div style={{flex:1,height:8,background:'#332200',borderRadius:4,border:'1px solid #553300',overflow:'hidden'}}>
          <div style={{width:`${hunger}%`,height:'100%',background:`linear-gradient(90deg,${hungerColor},${hungerColor}99)`,borderRadius:4,transition:'width 0.3s'}}/>
        </div>
      </div>

      {/* CANVAS */}
      <div style={{flex:'1 1 auto',display:'flex',justifyContent:'center',background:'#000',overflow:'hidden',position:'relative'}}>
        <canvas ref={canvasRef} width={320} height={320} style={{display:'block',width:'100%',height:'100%',imageRendering:'pixelated'}}/>
      </div>

      {/* LOG */}
      <div style={{background:isNight?'rgba(80,0,0,0.9)':'rgba(0,40,0,0.9)',padding:'3px 10px',fontSize:10,color:isNight?'#ff8888':'#88ff88',fontWeight:'bold',textAlign:'center',minHeight:18,borderTop:`2px solid ${isNight?'#440000':'#224400'}`}}>
        {log}
      </div>

      {/* CONTROLS */}
      <div style={{flex:'0 0 130px',background:'linear-gradient(180deg,#111,#0a0a0a)',borderTop:'3px solid #222',position:'relative',overflow:'hidden'}}>
        {/* JOYSTICK ZONE */}
        <div style={{position:'absolute',left:0,top:0,width:'55%',height:'100%',touchAction:'none',userSelect:'none',WebkitUserSelect:'none'}}
          onTouchStart={onJoyStart} onTouchMove={onJoyMove} onTouchEnd={onJoyEnd}
          onPointerDown={onJoyStart} onPointerMove={e=>{if(e.buttons)onJoyMove(e);}} onPointerUp={onJoyEnd}>
          <svg style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none'}}>
            {joystickVis.active?<>
              <circle cx={joystickVis.baseX} cy={joystickVis.baseY} r={JOYSTICK_RADIUS} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.25)" strokeWidth={2}/>
              <circle cx={joystickVis.baseX} cy={joystickVis.baseY} r={JOYSTICK_RADIUS*0.25} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth={1}/>
              <circle cx={joystickVis.knobX} cy={joystickVis.knobY} r={26} fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.5)" strokeWidth={2.5}/>
              <circle cx={joystickVis.knobX} cy={joystickVis.knobY} r={11} fill="rgba(255,255,255,0.35)"/>
            </>:<>
              <circle cx={80} cy="50%" r={JOYSTICK_RADIUS} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth={1.5} strokeDasharray="6,4"/>
              <circle cx={80} cy="50%" r={22} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5}/>
              <text x={80} y="52%" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.2)" fontSize={10} fontWeight="bold">MOVE</text>
            </>}
          </svg>
        </div>

        {/* ACTION BUTTONS */}
        <div style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
          <button onClick={handleAttack} style={{background:isNight?'linear-gradient(180deg,#ff3333,#aa0000)':'rgba(60,60,60,0.5)',border:`2px solid ${isNight?'#ff6666':'#444'}`,borderRadius:10,width:62,height:50,color:'#fff',fontSize:11,fontWeight:900,cursor:'pointer',boxShadow:`0 3px 0 ${isNight?'#660000':'#111'}`,opacity:isNight?1:0.4,textTransform:'uppercase',lineHeight:1.2}}>⚔️<br/>ATCK</button>
          <button onClick={handleBuild} style={{background:!isNight?'linear-gradient(180deg,#886633,#553311)':'rgba(60,60,60,0.5)',border:`2px solid ${!isNight?'#ddaa55':'#444'}`,borderRadius:10,width:62,height:50,color:'#fff',fontSize:11,fontWeight:900,cursor:'pointer',boxShadow:`0 3px 0 ${!isNight?'#332200':'#111'}`,opacity:!isNight?1:0.4,textTransform:'uppercase',lineHeight:1.2}}>🧱<br/>BUILD</button>
          <button onClick={handleRemove} style={{background:'linear-gradient(180deg,#883333,#551111)',border:'2px solid #cc4444',borderRadius:10,width:62,height:50,color:'#fff',fontSize:11,fontWeight:900,cursor:'pointer',boxShadow:'0 3px 0 #330000',textTransform:'uppercase',lineHeight:1.2,gridColumn:'1/-1'}}>🗑️ REMOVE BRICK</button>
        </div>
      </div>

      {/* DEATH */}
      {dead&&(
        <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.88)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:50,fontFamily:"'Arial Black',Arial,sans-serif"}}>
          <div style={{fontSize:56,marginBottom:8}}>💀</div>
          <div style={{fontSize:26,fontWeight:900,color:'#ff3333',textShadow:'3px 3px 0 #880000',marginBottom:4,textTransform:'uppercase'}}>YOU DIED!</div>
          <div style={{color:'#aaa',marginBottom:4,fontSize:14}}>Survived <b style={{color:'#ffcc00'}}>{day}</b> day{day>1?'s':''}</div>
          <div style={{fontSize:20,fontWeight:900,color:'#ffcc00',textShadow:'2px 2px 0 #886600',marginBottom:24}}>⭐ {day*50} POINTS</div>
          <button onClick={onBack} style={{background:'linear-gradient(180deg,#44dd44,#22aa22)',border:'none',borderRadius:12,padding:'14px 32px',color:'#fff',fontSize:16,fontWeight:900,cursor:'pointer',boxShadow:'0 5px 0 #116611',textTransform:'uppercase',letterSpacing:1}}>PLAY AGAIN</button>
        </div>
      )}
    </div>
  );
}

// ─── LOBBY ────────────────────────────────────────────────────────────────────
function Lobby({roomCode,myName,myAvatar,roomData,isHost,onStart,onLeave}){
  const members=roomData?.members||[myName];
  return(
    <div style={{minHeight:'100%',background:'linear-gradient(180deg,#001a2e,#001a00)',fontFamily:"'Arial Black',Arial,sans-serif",overflowY:'auto'}}>
      <div style={{background:'linear-gradient(135deg,#004488,#0066cc)',padding:'16px',textAlign:'center',borderBottom:'4px solid #0088ff',boxShadow:'0 4px 0 #002255'}}>
        <div style={{fontSize:22,fontWeight:900,color:'#fff',textShadow:'2px 2px 0 #002255'}}>WAITING ROOM</div>
      </div>
      <div style={{padding:16,textAlign:'center'}}>
        <div style={{fontSize:12,color:'#88aacc',marginBottom:8,fontWeight:'bold',textTransform:'uppercase',letterSpacing:1}}>Room Code</div>
        <div style={{fontSize:40,fontWeight:900,color:'#44dd44',letterSpacing:8,background:'rgba(0,0,0,0.4)',padding:'12px 20px',borderRadius:14,border:'3px solid #44dd44',marginBottom:16,textShadow:'0 0 20px #44dd44',display:'inline-block'}}>{roomCode}</div>
        <div style={{background:'rgba(255,255,255,0.05)',border:'2px solid rgba(255,255,255,0.1)',borderRadius:14,padding:12,marginBottom:16,textAlign:'left'}}>
          <div style={{color:'#44dd44',fontWeight:900,fontSize:12,marginBottom:8,textTransform:'uppercase'}}>Players ({members.length})</div>
          {members.map((p,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
              <div style={{width:28,height:28,borderRadius:8,background:AVATARS.find(a=>a.id===(roomData?.avatars?.[p]||'blue'))?.bg||'#224499',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>🧑</div>
              <span style={{flex:1,color:p===myName?'#ffcc00':'#ddd',fontWeight:p===myName?900:400,fontSize:13}}>{p}{p===myName?' (you)':''}</span>
              {p===roomData?.host&&<span style={{background:'#ffcc00',color:'#000',fontSize:9,fontWeight:900,padding:'2px 6px',borderRadius:6,textTransform:'uppercase'}}>HOST</span>}
            </div>
          ))}
        </div>
        {isHost?<button onClick={onStart} style={{width:'100%',background:'linear-gradient(180deg,#44dd44,#22aa22)',border:'none',borderRadius:12,padding:14,color:'#fff',fontSize:16,fontWeight:900,cursor:'pointer',boxShadow:'0 5px 0 #116611',textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>▶ START GAME!</button>:<div style={{color:'#aaa',fontSize:13,marginBottom:10,padding:12,background:'rgba(255,255,255,0.05)',borderRadius:10,border:'2px solid #333'}}>Waiting for host...</div>}
        <button onClick={onLeave} style={{width:'100%',background:'#1a1a1a',border:'2px solid #333',borderRadius:10,padding:10,color:'#888',fontSize:12,cursor:'pointer',textTransform:'uppercase',fontWeight:900}}>← LEAVE</button>
      </div>
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function ZombieGame({playerName,username,onScore,onBack}){
  const [screen,setScreen]=useState('howtoplay');
  const [avatar,setAvatar]=useState(null);
  const [roomCode,setRoomCode]=useState('');
  const [joinCode,setJoinCode]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const [isHost,setIsHost]=useState(false);
  const [roomData,setRoomData]=useState(null);
  const unsubRef=useRef(null);
  const myName=playerName||username||'Guest';

  const subscribeRoom=useCallback((code)=>{
    if(unsubRef.current)unsubRef.current();
    unsubRef.current=onSnapshot(doc(db,'zombieRooms',code),snap=>{
      if(!snap.exists())return;const data=snap.data();setRoomData(data);if(data.status==='playing')setScreen('game');
    });
  },[]);

  useEffect(()=>()=>{if(unsubRef.current)unsubRef.current();},[]);

  const hostGame=async(av)=>{
    setLoading(true);const code=genCode();
    try{await setDoc(doc(db,'zombieRooms',code),{code,host:myName,members:[myName],players:{},avatars:{[myName]:av.id},barriers:{},status:'waiting',phase:'day',day:1,createdAt:serverTimestamp()});setRoomCode(code);setIsHost(true);subscribeRoom(code);setScreen('lobby');}
    catch(e){setError('Failed to create room');}setLoading(false);
  };

  const joinGame=async(av)=>{
    const code=joinCode.trim().toUpperCase();if(!code){setError('Enter a room code');return;}
    setLoading(true);
    try{const snap=await getDoc(doc(db,'zombieRooms',code));if(!snap.exists()){setError('Room not found!');setLoading(false);return;}const data=snap.data();if(data.status!=='waiting'){setError('Game already started!');setLoading(false);return;}await updateDoc(doc(db,'zombieRooms',code),{members:[...(data.members||[]),myName],[`avatars.${myName}`]:av.id});setRoomCode(code);setIsHost(false);subscribeRoom(code);setScreen('lobby');}
    catch(e){setError('Failed to join');}setLoading(false);
  };

  const startGame=async()=>{await updateDoc(doc(db,'zombieRooms',roomCode),{status:'playing'});};
  const leaveRoom=()=>{if(unsubRef.current)unsubRef.current();setScreen('menu');setRoomCode('');setRoomData(null);};

  if(screen==='howtoplay')return <HowToPlay onDone={()=>setScreen('avatarselect')}/>;
  if(screen==='avatarselect')return <AvatarSelect playerName={myName} onSelect={av=>{setAvatar(av);setScreen('menu');}}/>;
  if(screen==='game'&&avatar)return <GameEngine roomCode={roomCode||'SOLO'} myName={myName} myAvatar={avatar} isHost={isHost||!roomCode} roomData={roomData} onGameOver={s=>onScore(s)} onBack={()=>{leaveRoom();onBack();}}/>;
  if(screen==='lobby')return <div style={{width:'100%',height:'100%',overflow:'auto'}}><Lobby roomCode={roomCode} myName={myName} myAvatar={avatar||AVATARS[0]} roomData={roomData} isHost={isHost} onStart={startGame} onLeave={leaveRoom}/></div>;

  return(
    <div style={{minHeight:'100%',background:'linear-gradient(180deg,#0a0010 0%,#000a00 100%)',fontFamily:"'Arial Black',Arial,sans-serif",overflowY:'auto'}}>
      <div style={{background:'linear-gradient(135deg,#330000,#660000,#330000)',padding:'20px 16px',textAlign:'center',borderBottom:'4px solid #ff0000',boxShadow:'0 4px 0 #880000'}}>
        <div style={{fontSize:50,marginBottom:4}}>🧟</div>
        <div style={{fontSize:28,fontWeight:900,color:'#ff3333',textShadow:'3px 3px 0 #660000',letterSpacing:2,textTransform:'uppercase'}}>ZOMBIE BARISTA</div>
        <div style={{fontSize:12,color:'#ff9999',fontWeight:'bold',marginTop:2,textTransform:'uppercase',letterSpacing:1}}>BUILD • EAT • SURVIVE</div>
      </div>
      <div style={{padding:14}}>
        {avatar&&<div style={{display:'flex',alignItems:'center',gap:12,background:'rgba(255,255,255,0.05)',border:`2px solid ${avatar.color}44`,borderRadius:14,padding:'10px 14px',marginBottom:14}}>
          <div style={{width:34,height:34,borderRadius:10,background:avatar.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,border:`2px solid ${avatar.color}`}}>🧑</div>
          <div><div style={{color:avatar.color,fontWeight:900,fontSize:14,textTransform:'uppercase'}}>{myName}</div><div style={{color:'#666',fontSize:11,textTransform:'uppercase'}}>as {avatar.name}</div></div>
          <button onClick={()=>setScreen('avatarselect')} style={{marginLeft:'auto',background:'#1a1a1a',border:'1px solid #333',borderRadius:8,padding:'5px 10px',color:'#888',fontSize:10,cursor:'pointer',textTransform:'uppercase',fontWeight:900}}>CHANGE</button>
        </div>}
        <button onClick={()=>avatar?setScreen('game'):setScreen('avatarselect')} style={{width:'100%',background:'linear-gradient(180deg,#ff4444,#cc0000)',border:'none',borderRadius:12,padding:14,color:'#fff',fontSize:16,fontWeight:900,cursor:'pointer',boxShadow:'0 5px 0 #880000',textTransform:'uppercase',letterSpacing:1,marginBottom:10,textShadow:'1px 1px 0 rgba(0,0,0,0.4)'}}>⚔️ PLAY SOLO</button>
        <button onClick={()=>avatar?hostGame(avatar):setScreen('avatarselect')} disabled={loading} style={{width:'100%',background:'linear-gradient(180deg,#4488ff,#2255cc)',border:'none',borderRadius:12,padding:14,color:'#fff',fontSize:15,fontWeight:900,cursor:'pointer',boxShadow:'0 5px 0 #113388',textTransform:'uppercase',letterSpacing:1,marginBottom:10,textShadow:'1px 1px 0 rgba(0,0,0,0.4)'}}>{loading?'CREATING...':'🏠 HOST MULTIPLAYER'}</button>
        <div style={{display:'flex',gap:8,marginBottom:10}}>
          <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} maxLength={4} placeholder="CODE" style={{flex:1,background:'#111',border:'2px solid #333',borderRadius:10,padding:'12px',color:'#fff',fontSize:20,fontWeight:900,textAlign:'center',letterSpacing:6,fontFamily:"'Arial Black',Arial,sans-serif"}}/>
          <button onClick={()=>avatar?joinGame(avatar):setScreen('avatarselect')} disabled={loading} style={{background:'linear-gradient(180deg,#44cc44,#228822)',border:'none',borderRadius:10,padding:'0 16px',color:'#fff',fontSize:14,fontWeight:900,cursor:'pointer',boxShadow:'0 4px 0 #116611',textTransform:'uppercase'}}>JOIN</button>
        </div>
        <button onClick={()=>setScreen('howtoplay')} style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'2px solid rgba(255,255,255,0.12)',borderRadius:10,padding:10,color:'#aaa',fontSize:13,cursor:'pointer',textTransform:'uppercase',fontWeight:900,marginBottom:8,letterSpacing:1}}>📖 HOW TO PLAY</button>
        <button onClick={onBack} style={{width:'100%',background:'transparent',border:'1px solid #222',borderRadius:8,padding:8,color:'#444',fontSize:11,cursor:'pointer',textTransform:'uppercase'}}>← BACK TO GAMES</button>
        {error&&<div style={{color:'#ff4444',marginTop:10,textAlign:'center',fontSize:13,fontWeight:'bold'}}>{error}</div>}
      </div>
    </div>
  );
}
