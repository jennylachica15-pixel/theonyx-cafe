import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase/config';
import {
  doc, setDoc, onSnapshot, collection,
  serverTimestamp, getDoc, updateDoc, arrayUnion, arrayRemove
} from 'firebase/firestore';

// ─── THEME ───────────────────────────────────────────────────────────────────
const Z = {
  wrap: { minHeight: '100%', background: '#0a0a0a', color: '#e0e0e0', fontFamily: "'Georgia', serif", display: 'flex', flexDirection: 'column' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 20, textAlign: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#8bc34a', marginBottom: 4, textShadow: '0 0 10px rgba(139,195,74,0.5)' },
  sub: { fontSize: 13, color: '#a07850', marginBottom: 20 },
  input: { width: '100%', background: '#1a1a1a', border: '1px solid #3d3d3d', borderRadius: 10, padding: '10px 14px', color: '#e0e0e0', fontSize: 15, marginBottom: 10, boxSizing: 'border-box' },
  btn: (c='#8bc34a') => ({ width: '100%', background: c, border: 'none', borderRadius: 10, padding: 12, color: c==='#8bc34a'?'#000':'#e0e0e0', fontSize: 15, fontWeight: 'bold', cursor: 'pointer', marginBottom: 8 }),
  card: { background: '#1a1a1a', border: '1px solid #333', borderRadius: 14, padding: 16, marginBottom: 12, width: '100%', maxWidth: 360 },
  code: { fontSize: 36, fontWeight: 'bold', color: '#8bc34a', letterSpacing: 6, background: '#0a1a0a', padding: '12px 24px', borderRadius: 12, border: '2px solid #4a8a2a', marginBottom: 12 },
  pRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #222' },
  roleTag: (r) => ({ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 'bold', background: r==='zombie'?'#8b0000':r==='survivor'?'#1a5a1a':'#1a1a5a', color: r==='zombie'?'#ff6b6b':r==='survivor'?'#8bc34a':'#64b5f6' }),
  hpBar: { height: 8, borderRadius: 4, background: '#333', overflow: 'hidden', marginTop: 4 },
  attackBtn: { background: '#8b0000', border: '2px solid #ff6b6b', color: '#ff6b6b', padding: '10px 18px', borderRadius: 10, fontSize: 14, fontWeight: 'bold', cursor: 'pointer', margin: 4 },
  healBtn: { background: '#0a2a0a', border: '2px solid #8bc34a', color: '#8bc34a', padding: '10px 18px', borderRadius: 10, fontSize: 14, fontWeight: 'bold', cursor: 'pointer', margin: 4 },
};

const ROLES = ['zombie','survivor','survivor','survivor','medic','survivor','survivor','survivor','survivor','survivor'];
const ROLE_EMOJI = { zombie: '🧟', survivor: '🧑', medic: '💉' };

function genCode() {
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:4},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
}

function assignRoles(players) {
  const roles = {};
  const shuffled = [...players].sort(()=>Math.random()-0.5);
  shuffled.forEach((p, i) => {
    roles[p] = i === 0 ? 'zombie' : (i === Math.floor(shuffled.length/2) ? 'medic' : 'survivor');
  });
  return roles;
}

export default function ZombieGame({ playerName, username, onScore, onBack }) {
  const [screen, setScreen] = useState('menu'); // menu | host | join | lobby | game | over
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [myName] = useState(playerName || username || 'Guest');
  const [loading, setLoading] = useState(false);
  const [actionLog, setActionLog] = useState([]);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef(null);
  const unsubRef = useRef(null);

  const subscribeRoom = useCallback((code) => {
    if (unsubRef.current) unsubRef.current();
    unsubRef.current = onSnapshot(doc(db, 'zombieRooms', code), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setRoomData(data);
      if (data.roles && data.roles[myName]) setMyRole(data.roles[myName]);
      if (data.status === 'over') setScreen('over');
      else if (data.status === 'playing') setScreen('game');
    });
  }, [myName]);

  useEffect(() => () => { if (unsubRef.current) unsubRef.current(); if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  const hostGame = async () => {
    setLoading(true);
    const code = genCode();
    try {
      await setDoc(doc(db, 'zombieRooms', code), {
        code, host: myName,
        players: [myName],
        hp: { [myName]: 100 },
        status: 'waiting',
        roles: {},
        log: [`${myName} created the room`],
        createdAt: serverTimestamp(),
      });
      setRoomCode(code);
      subscribeRoom(code);
      setScreen('lobby');
    } catch(e) { setError('Failed to create room'); }
    setLoading(false);
  };

  const joinGame = async () => {
    if (!joinCode.trim()) { setError('Enter a room code'); return; }
    const code = joinCode.trim().toUpperCase();
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'zombieRooms', code));
      if (!snap.exists()) { setError('Room not found!'); setLoading(false); return; }
      const data = snap.data();
      if (data.status !== 'waiting') { setError('Game already started!'); setLoading(false); return; }
      if (data.players.includes(myName)) { setError('Name already taken in this room!'); setLoading(false); return; }
      const newPlayers = [...data.players, myName];
      const newHp = { ...data.hp, [myName]: 100 };
      await updateDoc(doc(db, 'zombieRooms', code), {
        players: newPlayers, hp: newHp,
        log: arrayUnion(`${myName} joined`)
      });
      setRoomCode(code);
      subscribeRoom(code);
      setScreen('lobby');
    } catch(e) { setError('Failed to join room'); }
    setLoading(false);
  };

  const startGame = async () => {
    const players = roomData.players;
    // fill with NPCs if less than 4
    let allPlayers = [...players];
    const NPC_NAMES = ['Chef-Barista','Latte-NPC','Espresso-NPC','Mocha-NPC'];
    while (allPlayers.length < 4) allPlayers.push(NPC_NAMES[allPlayers.length - players.length]);
    const roles = assignRoles(allPlayers);
    const hp = {};
    allPlayers.forEach(p => hp[p] = 100);
    await updateDoc(doc(db, 'zombieRooms', roomCode), {
      players: allPlayers, roles, hp, status: 'playing',
      log: [`🎮 Game started! ${allPlayers.length} players`]
    });
  };

  const doAction = async (action, target) => {
    if (cooldown > 0) return;
    const data = roomData;
    if (!data) return;
    const newHp = { ...data.hp };
    let logMsg = '';

    if (action === 'attack') {
      const dmg = myRole === 'zombie' ? 35 : 20;
      newHp[target] = Math.max(0, (newHp[target] || 100) - dmg);
      logMsg = myRole === 'zombie'
        ? `🧟 ${myName} bit ${target} for ${dmg} damage!`
        : `⚔️ ${myName} hit zombie ${target} for ${dmg} damage!`;
    } else if (action === 'heal') {
      newHp[target] = Math.min(100, (newHp[target] || 0) + 30);
      logMsg = `💉 ${myName} healed ${target} for 30 HP!`;
    }

    // check win conditions
    const zombies = data.players.filter(p => data.roles[p] === 'zombie');
    const survivors = data.players.filter(p => data.roles[p] !== 'zombie');
    const zombiesDead = zombies.every(z => newHp[z] <= 0);
    const survivorsDead = survivors.every(s => newHp[s] <= 0);

    let status = 'playing', winner = '';
    if (zombiesDead) { status = 'over'; winner = 'survivors'; }
    else if (survivorsDead) { status = 'over'; winner = 'zombies'; }

    await updateDoc(doc(db, 'zombieRooms', roomCode), {
      hp: newHp, log: arrayUnion(logMsg), status, winner: winner || data.winner || ''
    });

    // cooldown 3s
    setCooldown(3);
    cooldownRef.current = setInterval(() => {
      setCooldown(c => { if (c <= 1) { clearInterval(cooldownRef.current); return 0; } return c - 1; });
    }, 1000);

    if (status === 'over') {
      const myScore = myRole === 'zombie'
        ? (winner === 'zombies' ? 200 : 50)
        : (winner === 'survivors' ? 200 : 50);
      onScore(myScore);
    }
  };

  // ── screens ──

  if (screen === 'menu') return (
    <div style={Z.wrap}>
      <div style={Z.center}>
        <div style={{fontSize:56,marginBottom:8}}>🧟</div>
        <div style={Z.title}>ZOMBIE BARISTA</div>
        <div style={Z.sub}>Survive the infected café — or spread the bite!</div>
        <div style={{...Z.card, textAlign:'left'}}>
          <div style={{color:'#8bc34a',fontWeight:'bold',marginBottom:8}}>How to play:</div>
          <div style={{color:'#a0a0a0',fontSize:13,lineHeight:1.6}}>
            🧟 <b style={{color:'#ff6b6b'}}>Zombie Barista</b> — bite survivors to infect them<br/>
            🧑 <b style={{color:'#8bc34a'}}>Survivors</b> — work together to kill all zombies<br/>
            💉 <b style={{color:'#64b5f6'}}>Medic</b> — heal teammates before they turn<br/>
            🤖 NPCs fill in if you have under 4 players
          </div>
        </div>
        <div style={{width:'100%',maxWidth:320}}>
          <button style={Z.btn()} onClick={hostGame} disabled={loading}>
            {loading ? '...' : '🏠 Host a Room'}
          </button>
          <button style={Z.btn('#1a3a1a')} onClick={()=>setScreen('joining')}>
            🔑 Join a Room
          </button>
          <button style={Z.btn('#1a1a1a')} onClick={onBack}>← Back to Games</button>
        </div>
        {error && <div style={{color:'#ff6b6b',marginTop:8}}>{error}</div>}
      </div>
    </div>
  );

  if (screen === 'joining') return (
    <div style={Z.wrap}>
      <div style={Z.center}>
        <div style={{fontSize:48,marginBottom:12}}>🔑</div>
        <div style={Z.title}>Join Room</div>
        <div style={{width:'100%',maxWidth:320}}>
          <input style={Z.input} placeholder="Enter 4-letter code" value={joinCode}
            onChange={e=>setJoinCode(e.target.value.toUpperCase())} maxLength={4}
            style={{...Z.input, textAlign:'center', fontSize:24, letterSpacing:4, fontWeight:'bold'}} />
          <button style={Z.btn()} onClick={joinGame} disabled={loading}>{loading?'...':'Join'}</button>
          <button style={Z.btn('#1a1a1a')} onClick={()=>setScreen('menu')}>← Back</button>
        </div>
        {error && <div style={{color:'#ff6b6b'}}>{error}</div>}
      </div>
    </div>
  );

  if (screen === 'lobby' && roomData) return (
    <div style={Z.wrap}>
      <div style={Z.center}>
        <div style={{fontSize:40,marginBottom:8}}>🏠</div>
        <div style={Z.title}>Waiting Room</div>
        <div style={Z.sub}>Share this code with friends:</div>
        <div style={Z.code}>{roomCode}</div>
        <div style={{...Z.card, width:'100%', maxWidth:320}}>
          <div style={{color:'#8bc34a',marginBottom:8,fontWeight:'bold'}}>Players ({roomData.players.length}):</div>
          {roomData.players.map((p,i) => (
            <div key={i} style={Z.pRow}>
              <span style={{fontSize:20}}>🧑</span>
              <span style={{flex:1,color: p===myName ? '#d4a853':'#e0e0e0', fontWeight: p===myName?'bold':'normal'}}>{p} {p===myName?'(you)':''}</span>
              {p === roomData.host && <span style={{fontSize:11,color:'#d4a853'}}>HOST</span>}
            </div>
          ))}
          <div style={{color:'#555',fontSize:12,marginTop:8}}>
            {4-roomData.players.length > 0 ? `NPCs will fill ${4-roomData.players.length} empty spot(s)` : 'Full house!'}
          </div>
        </div>
        {roomData.host === myName && (
          <button style={{...Z.btn(), maxWidth:320}} onClick={startGame}>▶ Start Game!</button>
        )}
        {roomData.host !== myName && (
          <div style={{color:'#a07850',fontSize:14}}>Waiting for host to start...</div>
        )}
        <button style={{...Z.btn('#1a1a1a'), maxWidth:320, marginTop:8}} onClick={()=>{if(unsubRef.current)unsubRef.current();setScreen('menu');}}>Leave Room</button>
      </div>
    </div>
  );

  if (screen === 'game' && roomData) {
    const myHp = roomData.hp?.[myName] || 0;
    const isDead = myHp <= 0;
    const players = roomData.players || [];
    const zombies = players.filter(p => roomData.roles?.[p] === 'zombie');
    const survivors = players.filter(p => roomData.roles?.[p] !== 'zombie');
    const isZombie = myRole === 'zombie';

    return (
      <div style={Z.wrap}>
        {/* status bar */}
        <div style={{background:'#0a1a0a',padding:'12px 16px',borderBottom:'2px solid #1a3a1a'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <span style={{fontSize:20}}>{ROLE_EMOJI[myRole]}</span>
              <span style={{marginLeft:8,fontWeight:'bold',color: isZombie?'#ff6b6b':'#8bc34a'}}>{myName}</span>
              <span style={{marginLeft:8,...Z.roleTag(myRole),display:'inline-block'}}>{myRole}</span>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{color: myHp>50?'#8bc34a':myHp>25?'#ff9800':'#ff6b6b', fontWeight:'bold'}}>{myHp} HP</div>
            </div>
          </div>
          <div style={Z.hpBar}><div style={{height:'100%',width:`${myHp}%`,background: myHp>50?'#8bc34a':myHp>25?'#ff9800':'#ff6b6b',transition:'width 0.3s'}}/></div>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'12px 16px'}}>
          {isDead && <div style={{background:'rgba(139,0,0,0.3)',border:'2px solid #8b0000',borderRadius:12,padding:16,textAlign:'center',marginBottom:12}}>
            <div style={{fontSize:28}}>💀</div>
            <div style={{color:'#ff6b6b',fontWeight:'bold'}}>You have fallen!</div>
            <div style={{color:'#a07850',fontSize:13}}>Watch the battle unfold...</div>
          </div>}

          {/* zombie team */}
          <div style={{marginBottom:12}}>
            <div style={{color:'#ff6b6b',fontWeight:'bold',fontSize:13,marginBottom:6}}>🧟 ZOMBIES</div>
            {zombies.map(p=>(
              <div key={p} style={{...Z.card,padding:'10px 14px',marginBottom:6}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span>🧟</span>
                  <span style={{flex:1,color: p===myName?'#d4a853':'#e0e0e0'}}>{p}{p===myName?' (you)':''}</span>
                  <span style={{color:(roomData.hp?.[p]||0)>0?'#ff6b6b':'#555'}}>{roomData.hp?.[p]||0} HP</span>
                </div>
                <div style={Z.hpBar}><div style={{height:'100%',width:`${roomData.hp?.[p]||0}%`,background:'#ff6b6b',transition:'width 0.3s'}}/></div>
                {/* survivors attack zombies */}
                {!isZombie && !isDead && (roomData.hp?.[p]||0) > 0 && p !== myName && (
                  <button style={Z.attackBtn} onClick={()=>doAction('attack',p)} disabled={cooldown>0}>
                    {cooldown>0 ? `⏱ ${cooldown}s` : `⚔️ Attack`}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* survivor team */}
          <div style={{marginBottom:12}}>
            <div style={{color:'#8bc34a',fontWeight:'bold',fontSize:13,marginBottom:6}}>🧑 SURVIVORS</div>
            {survivors.map(p=>(
              <div key={p} style={{...Z.card,padding:'10px 14px',marginBottom:6}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span>{ROLE_EMOJI[roomData.roles?.[p]||'survivor']}</span>
                  <span style={{flex:1,color: p===myName?'#d4a853':'#e0e0e0'}}>{p}{p===myName?' (you)':''}</span>
                  <span style={{color:(roomData.hp?.[p]||0)>50?'#8bc34a':(roomData.hp?.[p]||0)>0?'#ff9800':'#555'}}>{roomData.hp?.[p]||0} HP</span>
                </div>
                <div style={Z.hpBar}><div style={{height:'100%',width:`${roomData.hp?.[p]||0}%`,background:(roomData.hp?.[p]||0)>50?'#8bc34a':'#ff9800',transition:'width 0.3s'}}/></div>
                <div style={{display:'flex',flexWrap:'wrap',marginTop:4}}>
                  {/* zombie bites survivors */}
                  {isZombie && !isDead && (roomData.hp?.[p]||0) > 0 && (
                    <button style={Z.attackBtn} onClick={()=>doAction('attack',p)} disabled={cooldown>0}>
                      {cooldown>0 ? `⏱ ${cooldown}s` : `🦷 Bite`}
                    </button>
                  )}
                  {/* medic heals survivors */}
                  {myRole === 'medic' && !isDead && p !== myName && (roomData.hp?.[p]||0) > 0 && (roomData.hp?.[p]||0) < 100 && (
                    <button style={Z.healBtn} onClick={()=>doAction('heal',p)} disabled={cooldown>0}>
                      {cooldown>0 ? `⏱ ${cooldown}s` : `💉 Heal`}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* action log */}
          <div style={{background:'#0a0a0a',border:'1px solid #222',borderRadius:10,padding:12,maxHeight:140,overflowY:'auto'}}>
            <div style={{color:'#555',fontSize:12,marginBottom:6}}>📜 Battle Log</div>
            {(roomData.log||[]).slice(-8).reverse().map((l,i)=>(
              <div key={i} style={{color:'#a0a0a0',fontSize:12,padding:'2px 0',borderBottom:'1px solid #111'}}>{l}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'over' && roomData) {
    const iWon = (roomData.winner === 'zombies' && myRole === 'zombie') ||
                 (roomData.winner === 'survivors' && myRole !== 'zombie');
    return (
      <div style={Z.wrap}>
        <div style={Z.center}>
          <div style={{fontSize:64,marginBottom:8}}>{roomData.winner === 'zombies' ? '🧟' : '🏆'}</div>
          <div style={{...Z.title, color: roomData.winner === 'zombies' ? '#ff6b6b' : '#8bc34a'}}>
            {roomData.winner === 'zombies' ? 'ZOMBIES WIN!' : 'SURVIVORS WIN!'}
          </div>
          <div style={{color: iWon ? '#8bc34a' : '#ff6b6b', fontSize:20, fontWeight:'bold', marginBottom:20}}>
            {iWon ? '🎉 You Won!' : '💀 You Lost!'}
          </div>
          {/* final scoreboard */}
          <div style={{...Z.card, width:'100%', maxWidth:320}}>
            {(roomData.players||[]).map((p,i)=>(
              <div key={i} style={Z.pRow}>
                <span>{ROLE_EMOJI[roomData.roles?.[p]||'survivor']}</span>
                <span style={{flex:1,color:p===myName?'#d4a853':'#e0e0e0'}}>{p}</span>
                <span style={Z.roleTag(roomData.roles?.[p]||'survivor')}>{roomData.roles?.[p]||'survivor'}</span>
                <span style={{marginLeft:8,color:(roomData.hp?.[p]||0)>0?'#8bc34a':'#ff6b6b'}}>{roomData.hp?.[p]||0}HP</span>
              </div>
            ))}
          </div>
          <button style={{...Z.btn(), maxWidth:320}} onClick={()=>setScreen('menu')}>▶ Play Again</button>
          <button style={{...Z.btn('#1a1a1a'), maxWidth:320}} onClick={onBack}>← Back to Games</button>
        </div>
      </div>
    );
  }

  return <div style={Z.center}><div style={{color:'#a07850'}}>Loading...</div></div>;
}
