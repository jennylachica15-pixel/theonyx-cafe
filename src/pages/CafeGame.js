import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase/config';
import { doc, setDoc, onSnapshot, updateDoc, getDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';

function genCode(){return Array.from({length:4},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');}

const ROLES_CONFIG = [
  {role:'badbarista', label:'Bad Barista ☕', color:'#ff4444', desc:'Secretly poison one player each night. Avoid being voted out!'},
  {role:'inspector',  label:'Health Inspector 👮', color:'#4488ff', desc:'Each night, inspect one player to learn if they are the Bad Barista.'},
  {role:'customer',   label:'Customer 🧑', color:'#44cc44', desc:'Survive and find the Bad Barista. Vote wisely each day!'},
];
const NPC_NAMES=['Chef-Bot','Latte-NPC','Espresso-NPC','Mocha-NPC','Barista-NPC'];
const MENU_NAMES=['Latte','Matcha','Americano','Espresso','Cappuccino','Frappe','Mocha','Macchiato'];

const S={
  wrap:{minHeight:'100%',background:'linear-gradient(180deg,#1a0800,#0a0400)',color:'#f5e6d0',fontFamily:"'Georgia',serif",overflowY:'auto'},
  banner:(c='#6b3a1f')=>({background:`linear-gradient(135deg,${c},${c}99)`,padding:'16px',textAlign:'center',borderBottom:`3px solid ${c}`,boxShadow:`0 3px 0 rgba(0,0,0,0.4)`}),
  title:{fontSize:26,fontWeight:'bold',color:'#d4a853',marginBottom:2},
  sub:{fontSize:12,color:'#a07850'},
  card:{background:'rgba(61,31,0,0.5)',border:'1px solid #6b3a1f',borderRadius:14,padding:14,marginBottom:10},
  btn:(c='#d4a853')=>({width:'100%',background:c,border:'none',borderRadius:10,padding:'12px',color:c==='#d4a853'?'#1a0800':'#f5e6d0',fontSize:15,fontWeight:'bold',cursor:'pointer',marginBottom:8,fontFamily:"'Georgia',serif"}),
  input:{width:'100%',background:'rgba(0,0,0,0.4)',border:'1px solid #6b3a1f',borderRadius:10,padding:'10px 14px',color:'#f5e6d0',fontSize:15,marginBottom:10,boxSizing:'border-box',fontFamily:"'Georgia',serif"},
  chip:{display:'inline-block',background:'#3d1f00',borderRadius:20,padding:'5px 12px',margin:3,cursor:'pointer',fontSize:13,color:'#d4a853',border:'1px solid #6b3a1f'},
  row:{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid rgba(107,58,31,0.3)'},
  phaseBadge:(p)=>({background:p==='night'?'#330000':'#332200',border:`2px solid ${p==='night'?'#ff4444':'#d4a853'}`,borderRadius:20,padding:'4px 14px',fontSize:12,fontWeight:'bold',color:p==='night'?'#ff8888':'#d4a853',display:'inline-block'}),
  voteBtn:{background:'#3d1f00',border:'2px solid #8b5a2b',borderRadius:10,padding:'8px 14px',color:'#d4a853',fontSize:13,fontWeight:'bold',cursor:'pointer'},
};

function assignRoles(players){
  const all=[...players].sort(()=>Math.random()-0.5);
  const roles={};
  all.forEach((p,i)=>{
    if(i===0)roles[p]='badbarista';
    else if(i===1&&all.length>=4)roles[p]='inspector';
    else roles[p]='customer';
  });
  return roles;
}

// ── NAME ENTRY ────────────────────────────────────────────────────────────────
function NameEntry({onDone}){
  const [name,setName]=useState('');
  return(
    <div style={{...S.wrap,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,textAlign:'center'}}>
      <div style={{fontSize:48,marginBottom:8}}>☕</div>
      <div style={S.title}>Café Mystery</div>
      <div style={{...S.sub,marginBottom:20}}>A social deduction game</div>
      <div style={{width:'100%',maxWidth:320}}>
        <input style={S.input} placeholder="Your name..." value={name} onChange={e=>setName(e.target.value)} autoCapitalize="words"/>
        <div style={{marginBottom:12,textAlign:'left'}}>
          {MENU_NAMES.map(n=><span key={n} style={S.chip} onClick={()=>setName(n)}>{n}</span>)}
        </div>
        <button style={S.btn()} onClick={()=>name.trim()&&onDone(name.trim())}>Continue →</button>
      </div>
    </div>
  );
}

// ── MENU ──────────────────────────────────────────────────────────────────────
function Menu({myName,onHost,onJoinScreen,onBack}){
  return(
    <div style={S.wrap}>
      <div style={S.banner()}>
        <div style={{fontSize:40,marginBottom:4}}>☕</div>
        <div style={S.title}>CAFÉ MYSTERY</div>
        <div style={S.sub}>Who poisoned the coffee?</div>
      </div>
      <div style={{padding:16}}>
        <div style={{...S.card,fontSize:13,color:'#a07850',lineHeight:1.6}}>
          <b style={{color:'#d4a853'}}>How to play:</b><br/>
          ☕ <b style={{color:'#ff8888'}}>Bad Barista</b> secretly eliminates a player each night<br/>
          👮 <b style={{color:'#88aaff'}}>Health Inspector</b> investigates one player each night<br/>
          🧑 <b style={{color:'#88cc88'}}>Customers</b> vote to kick out the Bad Barista each day<br/>
          🤖 NPCs fill empty spots (min 4 players)
        </div>
        <div style={{...S.sub,marginBottom:12,textAlign:'center'}}>Playing as: <b style={{color:'#d4a853'}}>{myName}</b></div>
        <button style={S.btn()} onClick={onHost}>🏠 Host a Room</button>
        <button style={S.btn('#6b3a1f')} onClick={onJoinScreen}>🔑 Join a Room</button>
        <button style={S.btn('#2a1000')} onClick={onBack}>← Back to Games</button>
      </div>
    </div>
  );
}

// ── LOBBY ─────────────────────────────────────────────────────────────────────
function Lobby({roomCode,myName,roomData,isHost,onStart,onLeave}){
  const members=roomData?.members||[myName];
  return(
    <div style={S.wrap}>
      <div style={S.banner('#1a3a5a')}>
        <div style={S.title}>Waiting Room</div>
        <div style={S.sub}>Share this code with friends</div>
        <div style={{fontSize:38,fontWeight:'bold',color:'#44dd44',letterSpacing:8,marginTop:10,textShadow:'0 0 15px #44dd44'}}>{roomCode}</div>
      </div>
      <div style={{padding:16}}>
        <div style={S.card}>
          <div style={{color:'#d4a853',fontWeight:'bold',marginBottom:8}}>Players ({members.length})</div>
          {members.map((p,i)=>(
            <div key={i} style={S.row}>
              <span style={{fontSize:20}}>🧑</span>
              <span style={{flex:1,color:p===myName?'#d4a853':'#f5e6d0',fontWeight:p===myName?'bold':'normal'}}>{p}{p===myName?' (you)':''}</span>
              {p===roomData?.host&&<span style={{background:'#d4a853',color:'#1a0800',fontSize:10,fontWeight:'bold',padding:'2px 8px',borderRadius:6}}>HOST</span>}
            </div>
          ))}
          <div style={{color:'#6b3a1f',fontSize:12,marginTop:8}}>
            {Math.max(0,4-members.length)>0?`${Math.max(0,4-members.length)} NPC(s) will fill empty spots`:'Ready to start!'}
          </div>
        </div>
        {isHost
          ?<button style={S.btn()} onClick={onStart}>▶ Start Game!</button>
          :<div style={{...S.card,textAlign:'center',color:'#a07850'}}>Waiting for host to start...</div>
        }
        <button style={S.btn('#2a1000')} onClick={onLeave}>← Leave Room</button>
      </div>
    </div>
  );
}

// ── ROLE REVEAL ───────────────────────────────────────────────────────────────
function RoleReveal({myRole,myName,onReady}){
  const rc=ROLES_CONFIG.find(r=>r.role===myRole)||ROLES_CONFIG[2];
  const [shown,setShown]=useState(false);
  return(
    <div style={{...S.wrap,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,textAlign:'center'}}>
      <div style={{fontSize:48,marginBottom:8}}>🎭</div>
      <div style={{...S.title,marginBottom:4}}>Your Secret Role</div>
      {!shown?(
        <button style={{...S.btn('#3d1f00'),maxWidth:280,marginTop:20}} onClick={()=>setShown(true)}>
          👁️ Reveal My Role (tap here alone!)
        </button>
      ):(
        <div style={{width:'100%',maxWidth:320}}>
          <div style={{background:`rgba(0,0,0,0.6)`,border:`3px solid ${rc.color}`,borderRadius:18,padding:24,marginBottom:20}}>
            <div style={{fontSize:36,marginBottom:8}}>{myRole==='badbarista'?'☕':myRole==='inspector'?'👮':'🧑'}</div>
            <div style={{fontSize:22,fontWeight:'bold',color:rc.color,marginBottom:8}}>{rc.label}</div>
            <div style={{color:'#c0a080',fontSize:13,lineHeight:1.6}}>{rc.desc}</div>
          </div>
          <div style={{...S.card,fontSize:13,color:'#a07850',marginBottom:16}}>
            Pass the phone to the next player so they can see their role privately.
          </div>
          <button style={S.btn()} onClick={onReady}>✅ I'm Ready</button>
        </div>
      )}
    </div>
  );
}

// ── GAME PHASE ────────────────────────────────────────────────────────────────
function GamePhase({roomCode,myName,myRole,roomData,onBack}){
  const [vote,setVote]=useState(null);
  const [nightTarget,setNightTarget]=useState(null);
  const [inspectTarget,setInspectTarget]=useState(null);
  const [inspectResult,setInspectResult]=useState(null);
  const [actionDone,setActionDone]=useState(false);

  const players=roomData?.players||[];
  const phase=roomData?.phase||'day';
  const round=roomData?.round||1;
  const eliminated=roomData?.eliminated||[];
  const votes=roomData?.votes||{};
  const log=roomData?.log||[];
  const alive=players.filter(p=>!eliminated.includes(p));
  const winner=roomData?.winner||'';

  const doNightKill=async()=>{
    if(!nightTarget||actionDone)return;
    setActionDone(true);
    await updateDoc(doc(db,'cafeRooms',roomCode),{
      nightKill:nightTarget,
      log:arrayUnion(`☕ Bad Barista chose their target...`)
    });
  };

  const doInspect=async()=>{
    if(!inspectTarget||actionDone)return;
    setActionDone(true);
    const role=roomData?.roles?.[inspectTarget]||'customer';
    const isBad=role==='badbarista';
    setInspectResult({name:inspectTarget,isBad});
    await updateDoc(doc(db,'cafeRooms',roomCode),{
      log:arrayUnion(`👮 Inspector investigated ${inspectTarget}`)
    });
  };

  const doVote=async(target)=>{
    setVote(target);
    await updateDoc(doc(db,'cafeRooms',roomCode),{
      [`votes.${myName}`]:target,
      log:arrayUnion(`🗳️ ${myName} voted for ${target}`)
    });
  };

  const endDay=async()=>{
    // tally votes
    const tally={};
    Object.values(votes).forEach(v=>{tally[v]=(tally[v]||0)+1;});
    const kicked=Object.entries(tally).sort((a,b)=>b[1]-a[1])[0]?.[0];
    const newElim=[...eliminated];
    let winner2='';
    if(kicked){
      newElim.push(kicked);
      if(roomData?.roles?.[kicked]==='badbarista')winner2='customers';
    }
    // check if bad barista outnumbers
    const aliveAfter=players.filter(p=>!newElim.includes(p));
    const badAlive=aliveAfter.filter(p=>roomData?.roles?.[p]==='badbarista');
    const goodAlive=aliveAfter.filter(p=>roomData?.roles?.[p]!=='badbarista');
    if(badAlive.length>=goodAlive.length&&!winner2)winner2='badbarista';
    await updateDoc(doc(db,'cafeRooms',roomCode),{
      eliminated:newElim,phase:'night',round:round+1,votes:{},nightKill:'',
      winner:winner2,
      log:arrayUnion(kicked?`🗳️ ${kicked} was voted out!`:'🗳️ No consensus, no one kicked!')
    });
  };

  const endNight=async()=>{
    const killed=roomData?.nightKill;
    const newElim=[...eliminated];
    let winner2='';
    if(killed&&!eliminated.includes(killed)){
      newElim.push(killed);
      const aliveAfter=players.filter(p=>!newElim.includes(p));
      const badAlive=aliveAfter.filter(p=>roomData?.roles?.[p]==='badbarista');
      const goodAlive=aliveAfter.filter(p=>roomData?.roles?.[p]!=='badbarista');
      if(badAlive.length>=goodAlive.length)winner2='badbarista';
    }
    await updateDoc(doc(db,'cafeRooms',roomCode),{
      eliminated:newElim,phase:'day',nightKill:'',
      winner:winner2,
      log:arrayUnion(killed?`☕ ${killed} was poisoned overnight!`:'🌙 A quiet night... no one was eliminated.')
    });
    setActionDone(false);setNightTarget(null);setInspectTarget(null);setInspectResult(null);
  };

  const isHost=roomData?.host===myName;
  const isAlive=!eliminated.includes(myName);
  const myIsNPC=myName.includes('-NPC')||myName.includes('-Bot');

  if(winner){
    const iWon=(winner==='customers'&&myRole!=='badbarista')||(winner==='badbarista'&&myRole==='badbarista');
    return(
      <div style={{...S.wrap,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,textAlign:'center'}}>
        <div style={{fontSize:56,marginBottom:8}}>{winner==='customers'?'🏆':'☕'}</div>
        <div style={{fontSize:24,fontWeight:'bold',color:winner==='customers'?'#44cc44':'#ff4444',marginBottom:4}}>
          {winner==='customers'?'CUSTOMERS WIN!':'BAD BARISTA WINS!'}
        </div>
        <div style={{fontSize:18,fontWeight:'bold',color:iWon?'#d4a853':'#888',marginBottom:20}}>
          {iWon?'🎉 You Won!':'💀 You Lost!'}
        </div>
        <div style={S.card}>
          <div style={{color:'#d4a853',fontWeight:'bold',marginBottom:8}}>Final Roles</div>
          {players.map((p,i)=>{
            const pr=ROLES_CONFIG.find(r=>r.role===(roomData?.roles?.[p]||'customer'))||ROLES_CONFIG[2];
            return(<div key={i} style={S.row}>
              <span style={{color:pr.color,fontSize:13,fontWeight:'bold'}}>{pr.label.split(' ')[1]||'🧑'}</span>
              <span style={{flex:1,color:eliminated.includes(p)?'#555':p===myName?'#d4a853':'#f5e6d0'}}>{p}{eliminated.includes(p)?' ☠️':''}</span>
              <span style={{color:pr.color,fontSize:11}}>{pr.label}</span>
            </div>);
          })}
        </div>
        <button style={{...S.btn(),maxWidth:280}} onClick={onBack}>← Back to Games</button>
      </div>
    );
  }

  return(
    <div style={S.wrap}>
      <div style={S.banner(phase==='night'?'#1a0000':'#1a1200')}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={S.phaseBadge(phase)}>{phase==='night'?'🌙 Night':'☀️ Day'} {round}</div>
          <div style={{color:'#d4a853',fontSize:13}}>☠️ {eliminated.length} eliminated</div>
        </div>
      </div>

      <div style={{padding:'12px 14px'}}>
        {/* my role reminder */}
        {isAlive&&<div style={{...S.card,display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
          <span style={{fontSize:22}}>{myRole==='badbarista'?'☕':myRole==='inspector'?'👮':'🧑'}</span>
          <div>
            <div style={{fontWeight:'bold',color:'#d4a853',fontSize:13}}>{myName}</div>
            <div style={{color:ROLES_CONFIG.find(r=>r.role===myRole)?.color||'#88cc88',fontSize:12}}>{ROLES_CONFIG.find(r=>r.role===myRole)?.label||'Customer 🧑'}</div>
          </div>
          {!isAlive&&<span style={{marginLeft:'auto',color:'#ff4444',fontWeight:'bold'}}>☠️ Eliminated</span>}
        </div>}

        {/* player list */}
        <div style={S.card}>
          <div style={{color:'#d4a853',fontWeight:'bold',marginBottom:8}}>Players</div>
          {players.map((p,i)=>(
            <div key={i} style={{...S.row,opacity:eliminated.includes(p)?0.4:1}}>
              <span style={{fontSize:16}}>{eliminated.includes(p)?'☠️':'🧑'}</span>
              <span style={{flex:1,color:p===myName?'#d4a853':'#f5e6d0',fontSize:13}}>{p}{p===myName?' (you)':''}</span>
              {votes[p]&&<span style={{color:'#888',fontSize:11}}>→{votes[p]}</span>}
              {/* vote button */}
              {phase==='day'&&isAlive&&p!==myName&&!eliminated.includes(p)&&!vote&&(
                <button style={S.voteBtn} onClick={()=>doVote(p)}>🗳️ Vote</button>
              )}
              {/* night kill button */}
              {phase==='night'&&myRole==='badbarista'&&isAlive&&p!==myName&&!eliminated.includes(p)&&!actionDone&&(
                <button style={{...S.voteBtn,border:'2px solid #ff4444',color:'#ff8888'}} onClick={()=>setNightTarget(p)}>☕ Pick</button>
              )}
              {/* inspect button */}
              {phase==='night'&&myRole==='inspector'&&isAlive&&p!==myName&&!eliminated.includes(p)&&!actionDone&&(
                <button style={{...S.voteBtn,border:'2px solid #4488ff',color:'#88aaff'}} onClick={()=>setInspectTarget(p)}>🔍 Check</button>
              )}
            </div>
          ))}
        </div>

        {/* night actions */}
        {phase==='night'&&isAlive&&(
          <div style={S.card}>
            {myRole==='badbarista'&&(
              <>
                <div style={{color:'#ff8888',fontWeight:'bold',marginBottom:8}}>Your Turn — Choose a target</div>
                {nightTarget&&!actionDone&&<div style={{color:'#f5e6d0',marginBottom:8}}>Selected: <b style={{color:'#ff4444'}}>{nightTarget}</b></div>}
                {nightTarget&&!actionDone&&<button style={S.btn('#8b0000')} onClick={doNightKill}>☕ Poison {nightTarget}</button>}
                {actionDone&&<div style={{color:'#888',fontSize:13}}>Action done. Wait for host to end night.</div>}
              </>
            )}
            {myRole==='inspector'&&(
              <>
                <div style={{color:'#88aaff',fontWeight:'bold',marginBottom:8}}>Your Turn — Inspect a player</div>
                {inspectTarget&&!actionDone&&<button style={S.btn('#001a55')} onClick={doInspect}>🔍 Inspect {inspectTarget}</button>}
                {inspectResult&&<div style={{marginTop:8,padding:10,background:inspectResult.isBad?'rgba(139,0,0,0.4)':'rgba(0,100,0,0.4)',borderRadius:10,color:inspectResult.isBad?'#ff8888':'#88cc88',fontWeight:'bold',textAlign:'center'}}>
                  {inspectResult.name} is {inspectResult.isBad?'☕ THE BAD BARISTA!':'✅ Innocent'}
                </div>}
                {actionDone&&<div style={{color:'#888',fontSize:13,marginTop:8}}>Investigation complete. Wait for host.</div>}
              </>
            )}
            {myRole==='customer'&&<div style={{color:'#888',fontSize:13}}>🌙 You are sleeping... wait for morning.</div>}
            {isHost&&<button style={{...S.btn('#3d1f00'),marginTop:8}} onClick={endNight}>🌅 End Night (Host)</button>}
          </div>
        )}

        {/* day vote summary */}
        {phase==='day'&&(
          <div style={S.card}>
            {vote?<div style={{color:'#88cc88',marginBottom:8}}>✅ You voted for <b style={{color:'#d4a853'}}>{vote}</b></div>:<div style={{color:'#a07850',marginBottom:8}}>Select a player above to vote them out.</div>}
            {isHost&&<button style={S.btn()} onClick={endDay}>⚖️ End Day & Count Votes (Host)</button>}
          </div>
        )}

        {/* log */}
        <div style={{...S.card,maxHeight:160,overflowY:'auto'}}>
          <div style={{color:'#d4a853',fontWeight:'bold',fontSize:12,marginBottom:6}}>📜 Event Log</div>
          {[...log].reverse().map((l,i)=>(
            <div key={i} style={{color:'#a07850',fontSize:12,padding:'2px 0',borderBottom:'1px solid rgba(107,58,31,0.2)'}}>{l}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export default function CafeGame({playerName,onBack}){
  const [screen,setScreen]=useState(playerName?'menu':'name');
  const [myName,setMyName]=useState(playerName||'');
  const [myRole,setMyRole]=useState(null);
  const [roomCode,setRoomCode]=useState('');
  const [joinCode,setJoinCode]=useState('');
  const [isHost,setIsHost]=useState(false);
  const [roomData,setRoomData]=useState(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const unsubRef=useRef(null);

  const subscribe=useCallback((code)=>{
    if(unsubRef.current)unsubRef.current();
    unsubRef.current=onSnapshot(doc(db,'cafeRooms',code),snap=>{
      if(!snap.exists())return;
      const data=snap.data();setRoomData(data);
      if(data.status==='reveal'&&screen!=='reveal'&&screen!=='game')setScreen('reveal');
      if(data.status==='playing'&&screen!=='game')setScreen('game');
    });
  },[screen]);

  useEffect(()=>()=>{if(unsubRef.current)unsubRef.current();},[]);

  const hostRoom=async()=>{
    setLoading(true);const code=genCode();
    try{
      await setDoc(doc(db,'cafeRooms',code),{code,host:myName,members:[myName],players:[],roles:{},eliminated:[],votes:{},nightKill:'',status:'waiting',phase:'day',round:1,log:[`${myName} created the room`],winner:'',createdAt:serverTimestamp()});
      setRoomCode(code);setIsHost(true);subscribe(code);setScreen('lobby');
    }catch(e){setError('Failed to create room');}
    setLoading(false);
  };

  const joinRoom=async()=>{
    const code=joinCode.trim().toUpperCase();
    if(!code){setError('Enter a code');return;}
    setLoading(true);
    try{
      const snap=await getDoc(doc(db,'cafeRooms',code));
      if(!snap.exists()){setError('Room not found!');setLoading(false);return;}
      const data=snap.data();
      if(data.status!=='waiting'){setError('Game already started!');setLoading(false);return;}
      if(data.members.includes(myName)){setError('Name taken in this room!');setLoading(false);return;}
      await updateDoc(doc(db,'cafeRooms',code),{members:arrayUnion(myName),log:arrayUnion(`${myName} joined`)});
      setRoomCode(code);setIsHost(false);subscribe(code);setScreen('lobby');
    }catch(e){setError('Failed to join');}
    setLoading(false);
  };

  const startGame=async()=>{
    let allPlayers=[...(roomData?.members||[myName])];
    let ni=0;
    while(allPlayers.length<4){allPlayers.push(NPC_NAMES[ni++]);}
    const roles=assignRoles(allPlayers);
    await updateDoc(doc(db,'cafeRooms',roomCode),{
      players:allPlayers,roles,status:'reveal',phase:'day',round:1,
      eliminated:[],votes:{},nightKill:'',winner:'',
      log:[`🎮 Game started with ${allPlayers.length} players!`]
    });
    setMyRole(roles[myName]||'customer');
  };

  const leaveRoom=()=>{if(unsubRef.current)unsubRef.current();setScreen('menu');setRoomCode('');setRoomData(null);setMyRole(null);};

  const handleRevealReady=()=>{
    if(myRole)setScreen('game');
    else{const r=roomData?.roles?.[myName]||'customer';setMyRole(r);setScreen('game');}
  };

  if(screen==='name')return <NameEntry onDone={n=>{setMyName(n);setScreen('menu');}}/>;
  if(screen==='menu')return <Menu myName={myName} onHost={hostRoom} onJoinScreen={()=>{setError('');setScreen('join');}} onBack={onBack}/>;
  if(screen==='join')return(
    <div style={{...S.wrap,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,textAlign:'center'}}>
      <div style={{fontSize:40,marginBottom:12}}>🔑</div>
      <div style={{...S.title,marginBottom:20}}>Join Room</div>
      <div style={{width:'100%',maxWidth:320}}>
        <input style={{...S.input,textAlign:'center',fontSize:26,letterSpacing:6,fontWeight:'bold'}}
          placeholder="CODE" value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} maxLength={4}/>
        <button style={S.btn()} onClick={joinRoom} disabled={loading}>{loading?'...':'Join'}</button>
        <button style={S.btn('#2a1000')} onClick={()=>setScreen('menu')}>← Back</button>
      </div>
      {error&&<div style={{color:'#ff6b6b',marginTop:8}}>{error}</div>}
    </div>
  );
  if(screen==='lobby')return <Lobby roomCode={roomCode} myName={myName} roomData={roomData} isHost={isHost} onStart={startGame} onLeave={leaveRoom}/>;
  if(screen==='reveal')return <RoleReveal myRole={myRole||roomData?.roles?.[myName]||'customer'} myName={myName} onReady={handleRevealReady}/>;
  if(screen==='game')return <GamePhase roomCode={roomCode} myName={myName} myRole={myRole||roomData?.roles?.[myName]||'customer'} roomData={roomData} onBack={()=>{leaveRoom();onBack();}}/>;
  return null;
}
