import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase/config';
import {
  doc, setDoc, getDoc, onSnapshot,
  updateDoc, arrayUnion, serverTimestamp, deleteDoc
} from 'firebase/firestore';

// ─── THEME ────────────────────────────────────────────────────────
const T = {
  bg: '#140800',
  card: '#2c1400',
  cardLight: '#3d2500',
  gold: '#d4a853',
  cream: '#f5e6c8',
  brown: '#6b3d11',
  text: '#f0d9b5',
  dim: '#8a6a3a',
  danger: '#c0392b',
  success: '#27ae60',
  purple: '#8e44ad',
};

const S = {
  page: { position: 'fixed', inset: 0, zIndex: 500, background: `linear-gradient(160deg,#140800,#2c1400,#1a0800)`, color: T.text, fontFamily: 'Georgia,serif', display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto', padding: '20px 16px 40px' },
  card: { background: T.card, border: `1.5px solid ${T.brown}88`, borderRadius: 20, padding: '24px 20px', width: '100%', maxWidth: 400 },
  title: { fontSize: 24, fontWeight: 'bold', color: T.gold, letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center', margin: '0 0 4px' },
  sub: { fontSize: 11, color: T.dim, letterSpacing: 2, textAlign: 'center', marginBottom: 20 },
  label: { fontSize: 11, color: T.dim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5, display: 'block' },
  input: { width: '100%', padding: '12px 14px', borderRadius: 10, border: `1px solid ${T.gold}44`, fontSize: 15, background: 'rgba(255,255,255,0.06)', color: T.cream, outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia,serif', textAlign: 'center', marginBottom: 12 },
  btn: (bg = T.gold, full = true) => ({ background: bg, color: bg === T.gold ? '#1a0800' : T.gold, border: `1px solid ${T.gold}44`, borderRadius: 12, padding: '13px 20px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', width: full ? '100%' : 'auto', marginTop: 4, letterSpacing: 0.5, fontFamily: 'Georgia,serif' }),
  row: { display: 'flex', gap: 8, marginTop: 4 },
  badge: (color) => ({ display: 'inline-block', padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 'bold', background: color + '22', color, border: `1px solid ${color}55` }),
  divider: { borderColor: T.brown + '44', margin: '16px 0' },
  phase: (color) => ({ textAlign: 'center', padding: '10px 16px', borderRadius: 12, background: color + '18', border: `1px solid ${color}44`, color, fontSize: 14, fontWeight: 'bold', marginBottom: 16, letterSpacing: 1 }),
};

// ─── ROLES ────────────────────────────────────────────────────────
const ROLES = {
  barista:   { name: 'Barista',         emoji: '☕', color: T.danger,  desc: 'You are the Bad Barista! Each night, secretly eliminate one customer. Avoid getting voted out!', team: 'evil' },
  inspector: { name: 'Health Inspector',emoji: '👮', color: T.purple,  desc: 'You are the Health Inspector! Each night, investigate one player to learn their role.', team: 'good' },
  customer:  { name: 'Customer',        emoji: '🧑', color: T.success, desc: 'You are a Customer! Work with others to find and vote out the Bad Barista.', team: 'good' },
  npc:       { name: 'NPC',             emoji: '🤖', color: T.dim,     desc: 'NPC — auto-controlled.', team: 'good' },
};

const NPC_NAMES = ['Latte Bot', 'Espresso AI', 'Mocha NPC', 'Frappe Bot', 'Matcha AI', 'Brew Bot'];

// ─── HELPERS ──────────────────────────────────────────────────────
const makeCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const assignRoles = (players) => {
  const n = players.length;
  const roles = [];
  roles.push('barista');
  if (n >= 5) roles.push('inspector');
  while (roles.length < n) roles.push('customer');
  // Shuffle
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  return Object.fromEntries(players.map((p, i) => [p, roles[i]]));
};

const npcAction = (game) => {
  // NPC barista picks random alive non-npc or npc player
  const alive = game.players.filter(p => !game.eliminated?.includes(p));
  const npcs = game.players.filter(p => p.startsWith('__npc'));
  const baristaPlayer = Object.entries(game.roles).find(([, r]) => r === 'barista')?.[0];
  if (!baristaPlayer?.startsWith('__npc')) return null;
  const targets = alive.filter(p => p !== baristaPlayer);
  return targets[Math.floor(Math.random() * targets.length)];
};

// ═══════════════════════════════════════════════════════════════════
// LOBBY / HOST SCREEN
// ═══════════════════════════════════════════════════════════════════
function HostLobby({ room, game, onStart }) {
  const realPlayers = game.players?.filter(p => !p.startsWith('__npc')) || [];
  const allPlayers = game.players || [];
  const canStart = realPlayers.length >= 3;

  const addNPC = async () => {
    if (allPlayers.length >= 10) return;
    const npcId = `__npc_${Date.now()}`;
    const npcName = NPC_NAMES[allPlayers.filter(p => p.startsWith('__npc')).length % NPC_NAMES.length];
    await updateDoc(doc(db, 'cafegames', room), {
      players: arrayUnion(npcId),
      [`names.${npcId}`]: npcName,
    });
  };

  return (
    <div style={S.card}>
      <div style={S.title}>☕ Café Mystery</div>
      <div style={S.sub}>WAITING FOR PLAYERS</div>

      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: T.dim, marginBottom: 6 }}>Share this room code:</div>
        <div style={{ fontSize: 48, fontWeight: 'bold', color: T.gold, letterSpacing: 12, fontVariantNumeric: 'tabular-nums' }}>{room}</div>
        <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>Players open the app → Games → Café Mystery → Join Room</div>
      </div>

      <hr style={S.divider} />
      <div style={{ fontSize: 12, color: T.gold, fontWeight: 'bold', marginBottom: 10 }}>
        Players ({allPlayers.length}/10)
      </div>
      {allPlayers.map(p => (
        <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: T.cardLight, borderRadius: 8, marginBottom: 6 }}>
          <span>{p.startsWith('__npc') ? '🤖' : '👤'}</span>
          <span style={{ flex: 1, fontSize: 13, color: T.cream }}>{game.names?.[p] || p}</span>
          {p.startsWith('__npc') && <span style={S.badge(T.dim)}>NPC</span>}
        </div>
      ))}

      {allPlayers.length < 10 && (
        <button style={{ ...S.btn(T.card), border: `1px solid ${T.brown}`, marginTop: 8 }} onClick={addNPC}>
          + Add NPC Player
        </button>
      )}

      <button
        style={{ ...S.btn(), marginTop: 16, opacity: canStart ? 1 : 0.4 }}
        disabled={!canStart}
        onClick={onStart}
      >
        {canStart ? `Start Game (${allPlayers.length} players)` : `Need at least 3 players (${realPlayers.length}/3)`}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ROLE REVEAL (each player sees their own card, then hides it)
// ═══════════════════════════════════════════════════════════════════
function RoleReveal({ myRole, myName, onReady }) {
  const [revealed, setRevealed] = useState(false);
  const role = ROLES[myRole] || ROLES.customer;

  return (
    <div style={{ ...S.card, textAlign: 'center' }}>
      <div style={{ fontSize: 13, color: T.dim, marginBottom: 16 }}>📱 Pass the phone to <strong style={{ color: T.gold }}>{myName}</strong></div>

      {!revealed ? (
        <>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🫣</div>
          <div style={{ fontSize: 15, color: T.cream, marginBottom: 20 }}>Tap to reveal your secret role</div>
          <button style={S.btn()} onClick={() => setRevealed(true)}>Reveal My Role</button>
        </>
      ) : (
        <>
          <div style={{ fontSize: 60, marginBottom: 8 }}>{role.emoji}</div>
          <div style={{ fontSize: 22, fontWeight: 'bold', color: role.color, marginBottom: 8 }}>{role.name}</div>
          <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6, marginBottom: 20, padding: '0 8px' }}>{role.desc}</div>
          {myRole === 'barista' && (
            <div style={{ ...S.phase(T.danger), fontSize: 12 }}>
              ⚠️ Do NOT reveal your role to others!
            </div>
          )}
          {myRole === 'inspector' && (
            <div style={{ ...S.phase(T.purple), fontSize: 12 }}>
              🔍 You can investigate 1 player each night.
            </div>
          )}
          <button style={S.btn(T.cardLight)} onClick={() => { setRevealed(false); onReady(); }}>
            ✓ I've read my role — Hide it
          </button>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// NIGHT PHASE — Barista picks victim, Inspector investigates
// ═══════════════════════════════════════════════════════════════════
function NightPhase({ room, game, myId, myRole, onDone }) {
  const [picked, setPicked] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [inspectResult, setInspectResult] = useState(null);
  const alive = game.players.filter(p => !game.eliminated?.includes(p));

  const submit = async () => {
    if (!picked) return;
    const update = {};
    if (myRole === 'barista') update[`nightKill`] = picked;
    if (myRole === 'inspector') {
      const result = game.roles[picked];
      setInspectResult({ name: game.names[picked], role: result });
      update[`nightInspect.${myId}`] = picked;
    }
    await updateDoc(doc(db, 'cafegames', room), update);
    setSubmitted(true);
    if (myRole === 'customer') onDone();
  };

  if (myRole === 'customer') {
    return (
      <div style={{ ...S.card, textAlign: 'center' }}>
        <div style={S.phase('#555')}>🌙 NIGHT PHASE</div>
        <div style={{ fontSize: 36, marginBottom: 12 }}>😴</div>
        <div style={{ fontSize: 14, color: T.dim }}>The café is closed...</div>
        <div style={{ fontSize: 12, color: T.dim, marginTop: 8 }}>Waiting for night actions to complete.</div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ ...S.card, textAlign: 'center' }}>
        <div style={S.phase(myRole === 'barista' ? T.danger : T.purple)}>🌙 NIGHT PHASE</div>
        {inspectResult && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: T.dim, marginBottom: 6 }}>Investigation result:</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: T.cream }}>{inspectResult.name}</div>
            <div style={{ marginTop: 8 }}>
              <span style={S.badge(ROLES[inspectResult.role]?.color || T.dim)}>
                {ROLES[inspectResult.role]?.emoji} {ROLES[inspectResult.role]?.name}
              </span>
            </div>
          </div>
        )}
        <div style={{ fontSize: 14, color: T.dim }}>✓ Action submitted. Waiting for others...</div>
        <button style={{ ...S.btn(), marginTop: 16 }} onClick={onDone}>Continue →</button>
      </div>
    );
  }

  return (
    <div style={S.card}>
      <div style={S.phase(myRole === 'barista' ? T.danger : T.purple)}>🌙 NIGHT PHASE</div>
      <div style={{ fontSize: 13, color: T.cream, marginBottom: 16, textAlign: 'center' }}>
        {myRole === 'barista' ? '☕ Choose a customer to poison tonight:' : '🔍 Choose a player to investigate:'}
      </div>
      {alive.filter(p => p !== myId).map(p => (
        <div key={p} onClick={() => setPicked(p)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: picked === p ? (myRole === 'barista' ? T.danger + '33' : T.purple + '33') : T.cardLight, border: `1.5px solid ${picked === p ? (myRole === 'barista' ? T.danger : T.purple) : T.brown + '44'}`, borderRadius: 12, marginBottom: 8, cursor: 'pointer' }}>
          <span style={{ fontSize: 20 }}>{game.names[p]?.slice(0, 1) || '?'}</span>
          <span style={{ flex: 1, fontSize: 14, color: T.cream }}>{game.names[p] || p}</span>
          {picked === p && <span style={{ color: myRole === 'barista' ? T.danger : T.purple }}>✓</span>}
        </div>
      ))}
      <button style={{ ...S.btn(picked ? T.gold : T.card), opacity: picked ? 1 : 0.4, marginTop: 8 }} disabled={!picked} onClick={submit}>
        Confirm →
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DAY PHASE — Discussion & Voting
// ═══════════════════════════════════════════════════════════════════
function DayPhase({ room, game, myId, onVoted }) {
  const [vote, setVote] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const alive = game.players.filter(p => !game.eliminated?.includes(p));
  const eliminated = game.lastEliminated;

  const submitVote = async () => {
    if (!vote) return;
    await updateDoc(doc(db, 'cafegames', room), {
      [`votes.${myId}`]: vote,
    });
    setSubmitted(true);
    onVoted();
  };

  return (
    <div style={S.card}>
      <div style={S.phase(T.gold)}>☀️ DAY PHASE — VOTE</div>

      {eliminated && (
        <div style={{ textAlign: 'center', padding: '12px', background: T.danger + '18', border: `1px solid ${T.danger}44`, borderRadius: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 22 }}>☠️</div>
          <div style={{ fontSize: 13, color: T.danger }}>
            <strong>{game.names[eliminated]}</strong> was found unconscious this morning!
          </div>
        </div>
      )}

      <div style={{ fontSize: 13, color: T.cream, marginBottom: 14, textAlign: 'center' }}>
        💬 Discuss with the group, then vote who to kick out.
      </div>

      {submitted ? (
        <div style={{ textAlign: 'center', padding: '16px', color: T.dim, fontSize: 13 }}>
          ✓ Vote submitted. Waiting for others...
        </div>
      ) : (
        <>
          {alive.filter(p => p !== myId).map(p => (
            <div key={p} onClick={() => setVote(p)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: vote === p ? T.danger + '33' : T.cardLight, border: `1.5px solid ${vote === p ? T.danger : T.brown + '44'}`, borderRadius: 12, marginBottom: 8, cursor: 'pointer' }}>
              <span style={{ fontSize: 18 }}>👤</span>
              <span style={{ flex: 1, fontSize: 14, color: T.cream }}>{game.names[p] || p}</span>
              {vote === p && <span style={{ color: T.danger }}>☠️</span>}
            </div>
          ))}
          <button style={{ ...S.btn(vote ? T.danger : T.card), border: `1px solid ${T.danger}44`, opacity: vote ? 1 : 0.4, marginTop: 8 }} disabled={!vote} onClick={submitVote}>
            Cast Vote ☠️
          </button>
        </>
      )}

      {/* Votes so far */}
      {game.votes && Object.keys(game.votes).length > 0 && (
        <div style={{ marginTop: 16, fontSize: 11, color: T.dim, textAlign: 'center' }}>
          {Object.keys(game.votes).length} / {alive.length} voted
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// GAME OVER
// ═══════════════════════════════════════════════════════════════════
function GameOver({ game, myId, onExit }) {
  const winner = game.winner;
  const myRole = game.roles?.[myId];
  const isWinner = (winner === 'good' && myRole !== 'barista') || (winner === 'evil' && myRole === 'barista');

  return (
    <div style={{ ...S.card, textAlign: 'center' }}>
      <div style={{ fontSize: 52, marginBottom: 8 }}>{isWinner ? '🏆' : '😔'}</div>
      <div style={{ fontSize: 24, fontWeight: 'bold', color: isWinner ? T.gold : T.dim, marginBottom: 4 }}>
        {isWinner ? 'You Win!' : 'You Lost!'}
      </div>
      <div style={{ fontSize: 14, color: T.cream, marginBottom: 20 }}>
        {winner === 'good' ? '✅ The Bad Barista was caught!' : '☕ The Bad Barista poisoned everyone!'}
      </div>

      <hr style={S.divider} />
      <div style={{ fontSize: 12, color: T.gold, fontWeight: 'bold', marginBottom: 10 }}>All Roles Revealed</div>
      {game.players?.map(p => {
        const role = game.roles?.[p];
        const r = ROLES[role] || ROLES.customer;
        const elim = game.eliminated?.includes(p);
        return (
          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: T.cardLight, borderRadius: 10, marginBottom: 6, opacity: elim ? 0.5 : 1 }}>
            <span style={{ fontSize: 18 }}>{r.emoji}</span>
            <span style={{ flex: 1, fontSize: 13, color: T.cream }}>{game.names?.[p] || p} {elim ? '☠️' : ''}</span>
            <span style={S.badge(r.color)}>{r.name}</span>
          </div>
        );
      })}

      <button style={{ ...S.btn(), marginTop: 20 }} onClick={onExit}>Back to Games</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN CAFÉ MYSTERY GAME
// ═══════════════════════════════════════════════════════════════════
export default function CafeGame({ onExit }) {
  const [screen, setScreen] = useState('menu'); // menu, host, join, lobby, reveal, night, day, gameover
  const [room, setRoom] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [myId, setMyId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [game, setGame] = useState(null);
  const [roleRevealed, setRoleRevealed] = useState(false);
  const [roundReady, setRoundReady] = useState(false);
  const [error, setError] = useState('');
  const gameRef = useRef(null);

  // ── Listen to game state ─────────────────────────────
  useEffect(() => {
    if (!room) return;
    const unsub = onSnapshot(doc(db, 'cafegames', room), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGame(data);
        gameRef.current = data;
      }
    });
    return () => unsub();
  }, [room]);

  // ── Host: auto-process NPC night actions + vote tallying ──────
  useEffect(() => {
    if (!isHost || !game || !room) return;
    processGameLogic(game);
  }, [game?.phase, game?.votes, game?.nightKill]);

  const processGameLogic = async (g) => {
    if (!g) return;

    // Night phase: check if all real players submitted
    if (g.phase === 'night') {
      const alive = g.players.filter(p => !g.eliminated?.includes(p));
      const baristaId = Object.entries(g.roles).find(([, r]) => r === 'barista')?.[0];
      const inspectorId = Object.entries(g.roles).find(([, r]) => r === 'inspector')?.[0];
      const baristaAlive = alive.includes(baristaId);
      const inspectorAlive = inspectorId && alive.includes(inspectorId);

      // NPC barista auto-kill
      if (baristaId?.startsWith('__npc') && baristaAlive && !g.nightKill) {
        const targets = alive.filter(p => p !== baristaId);
        const target = targets[Math.floor(Math.random() * targets.length)];
        await updateDoc(doc(db, 'cafegames', room), { nightKill: target });
        return;
      }

      // Move to day if barista has killed (inspector optional)
      if (g.nightKill && (baristaId?.startsWith('__npc') || g.nightKill)) {
        const newElim = [...(g.eliminated || []), g.nightKill];
        await updateDoc(doc(db, 'cafegames', room), {
          phase: 'day',
          eliminated: newElim,
          lastEliminated: g.nightKill,
          nightKill: null,
          votes: {},
        });
      }
    }

    // Day phase: check if all alive real players voted
    if (g.phase === 'day' && g.votes) {
      const alive = g.players.filter(p => !g.eliminated?.includes(p));
      const realAlive = alive.filter(p => !p.startsWith('__npc'));
      const voteCount = Object.keys(g.votes).length;

      // NPC votes — random
      const npcAlive = alive.filter(p => p.startsWith('__npc'));
      const npcVoted = npcAlive.filter(p => g.votes[p]);
      if (npcAlive.length > npcVoted.length) {
        const npcUpdates = {};
        npcAlive.filter(p => !g.votes[p]).forEach(npc => {
          const targets = alive.filter(p => p !== npc);
          npcUpdates[`votes.${npc}`] = targets[Math.floor(Math.random() * targets.length)];
        });
        if (Object.keys(npcUpdates).length > 0) {
          await updateDoc(doc(db, 'cafegames', room), npcUpdates);
          return;
        }
      }

      // All voted — tally
      if (voteCount >= alive.length) {
        const tally = {};
        Object.values(g.votes).forEach(v => { tally[v] = (tally[v] || 0) + 1; });
        const votedOut = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
        const newElim = [...(g.eliminated || []), votedOut];

        // Check win conditions
        const baristaId = Object.entries(g.roles).find(([, r]) => r === 'barista')?.[0];
        const baristaElim = newElim.includes(baristaId);
        const aliveAfter = g.players.filter(p => !newElim.includes(p));
        const evilAlive = aliveAfter.filter(p => g.roles[p] === 'barista').length;
        const goodAlive = aliveAfter.filter(p => g.roles[p] !== 'barista').length;

        if (baristaElim) {
          await updateDoc(doc(db, 'cafegames', room), { phase: 'gameover', winner: 'good', eliminated: newElim, lastVotedOut: votedOut });
        } else if (evilAlive >= goodAlive) {
          await updateDoc(doc(db, 'cafegames', room), { phase: 'gameover', winner: 'evil', eliminated: newElim, lastVotedOut: votedOut });
        } else {
          await updateDoc(doc(db, 'cafegames', room), {
            phase: 'night',
            eliminated: newElim,
            lastEliminated: null,
            lastVotedOut: votedOut,
            votes: {},
            nightKill: null,
            round: (g.round || 1) + 1,
          });
        }
      }
    }
  };

  // ── HOST GAME ──────────────────────────────────────────
  const hostGame = async () => {
    if (!nameInput.trim()) return;
    const code = makeCode();
    const uid = 'host_' + Date.now();
    await setDoc(doc(db, 'cafegames', code), {
      host: uid,
      players: [uid],
      names: { [uid]: nameInput.trim() },
      phase: 'lobby',
      round: 1,
      created: serverTimestamp(),
    });
    setRoom(code);
    setMyId(uid);
    setIsHost(true);
    setScreen('lobby');
  };

  // ── JOIN GAME ──────────────────────────────────────────
  const joinGame = async () => {
    if (!nameInput.trim() || !roomInput.trim()) return;
    const code = roomInput.trim().toUpperCase();
    const snap = await getDoc(doc(db, 'cafegames', code));
    if (!snap.exists()) { setError('Room not found! Check the code.'); return; }
    const data = snap.data();
    if (data.phase !== 'lobby') { setError('Game already started!'); return; }
    if (data.players?.length >= 10) { setError('Room is full (10/10)!'); return; }
    const uid = 'player_' + Date.now();
    await updateDoc(doc(db, 'cafegames', code), {
      players: arrayUnion(uid),
      [`names.${uid}`]: nameInput.trim(),
    });
    setRoom(code);
    setMyId(uid);
    setIsHost(false);
    setScreen('lobby');
  };

  // ── START GAME ─────────────────────────────────────────
  const startGame = async () => {
    const players = game.players;
    const roles = assignRoles(players);
    await updateDoc(doc(db, 'cafegames', room), {
      roles,
      phase: 'reveal',
      eliminated: [],
      votes: {},
      round: 1,
    });
  };

  // ── ROLE READY ─────────────────────────────────────────
  const onRoleReady = async () => {
    await updateDoc(doc(db, 'cafegames', room), {
      [`ready.${myId}`]: true,
    });
    setRoleRevealed(true);
  };

  // Check if all players ready to move to night
  useEffect(() => {
    if (!game || game.phase !== 'reveal' || !isHost) return;
    const realPlayers = game.players.filter(p => !p.startsWith('__npc'));
    const readyCount = realPlayers.filter(p => game.ready?.[p]).length;
    if (readyCount >= realPlayers.length && realPlayers.length > 0) {
      updateDoc(doc(db, 'cafegames', room), { phase: 'night', ready: {} });
    }
  }, [game?.ready]);

  // ── SCREENS ────────────────────────────────────────────

  // Menu
  if (screen === 'menu') return (
    <div style={S.page}>
      <div style={{ ...S.card, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>☕</div>
        <div style={S.title}>Café Mystery</div>
        <div style={S.sub}>MULTIPLAYER · 3–10 PLAYERS</div>

        <div style={{ background: T.cardLight, borderRadius: 12, padding: '12px 14px', marginBottom: 20, fontSize: 12, color: T.dim, textAlign: 'left', lineHeight: 1.7 }}>
          <div>☕ <strong style={{ color: T.gold }}>Bad Barista</strong> — poisons customers each night</div>
          <div>👮 <strong style={{ color: '#8e44ad' }}>Health Inspector</strong> — investigates one player per night</div>
          <div>🧑 <strong style={{ color: T.success }}>Customers</strong> — vote out the bad barista each day</div>
          <div>🤖 <strong style={{ color: T.dim }}>NPC</strong> — fills empty slots automatically</div>
        </div>

        <label style={S.label}>Your Name</label>
        <input style={S.input} placeholder="e.g. Latte, Espresso..." value={nameInput} onChange={e => setNameInput(e.target.value)} maxLength={20} />

        {error && <div style={{ color: T.danger, fontSize: 12, marginBottom: 10 }}>{error}</div>}

        <div style={S.row}>
          <button style={{ ...S.btn(T.gold, false), flex: 1 }} onClick={() => { setError(''); setScreen('host'); }}>
            🏠 Host Game
          </button>
          <button style={{ ...S.btn(T.card, false), flex: 1, border: `1px solid ${T.gold}44` }} onClick={() => { setError(''); setScreen('join'); }}>
            🚪 Join Game
          </button>
        </div>

        <button style={{ ...S.btn(T.card), border: `1px solid ${T.brown}`, marginTop: 8, fontSize: 12 }} onClick={onExit}>
          ← Back to Games
        </button>
      </div>
    </div>
  );

  // Host setup
  if (screen === 'host') return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.title}>Host a Game</div>
        <div style={S.sub}>CREATE ROOM</div>
        <label style={S.label}>Your Name</label>
        <input style={S.input} placeholder="Your name..." value={nameInput} onChange={e => setNameInput(e.target.value)} maxLength={20} />
        <button style={{ ...S.btn(), opacity: nameInput.trim() ? 1 : 0.4 }} disabled={!nameInput.trim()} onClick={hostGame}>
          Create Room →
        </button>
        <button style={{ ...S.btn(T.card), border: `1px solid ${T.brown}`, marginTop: 6 }} onClick={() => setScreen('menu')}>← Back</button>
      </div>
    </div>
  );

  // Join setup
  if (screen === 'join') return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.title}>Join a Game</div>
        <div style={S.sub}>ENTER ROOM CODE</div>
        <label style={S.label}>Room Code</label>
        <input style={{ ...S.input, fontSize: 24, letterSpacing: 8, textTransform: 'uppercase' }} placeholder="XXXX" value={roomInput} onChange={e => setRoomInput(e.target.value.toUpperCase())} maxLength={4} />
        <label style={S.label}>Your Name</label>
        <input style={S.input} placeholder="Your name..." value={nameInput} onChange={e => setNameInput(e.target.value)} maxLength={20} />
        {error && <div style={{ color: T.danger, fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <button style={{ ...S.btn(), opacity: nameInput.trim() && roomInput.length === 4 ? 1 : 0.4 }} disabled={!nameInput.trim() || roomInput.length !== 4} onClick={joinGame}>
          Join Room →
        </button>
        <button style={{ ...S.btn(T.card), border: `1px solid ${T.brown}`, marginTop: 6 }} onClick={() => setScreen('menu')}>← Back</button>
      </div>
    </div>
  );

  if (!game) return <div style={{ ...S.page, justifyContent: 'center' }}><div style={{ color: T.dim }}>Connecting...</div></div>;

  // Lobby
  if (game.phase === 'lobby') return (
    <div style={S.page}>
      {isHost
        ? <HostLobby room={room} game={game} onStart={startGame} />
        : (
          <div style={{ ...S.card, textAlign: 'center' }}>
            <div style={S.title}>☕ Café Mystery</div>
            <div style={S.sub}>WAITING FOR HOST TO START</div>
            <div style={{ fontSize: 40, margin: '16px 0' }}>⏳</div>
            <div style={{ fontSize: 13, color: T.dim }}>Room: <strong style={{ color: T.gold, letterSpacing: 4 }}>{room}</strong></div>
            <div style={{ fontSize: 13, color: T.cream, marginTop: 8 }}>
              Players: {game.players?.length || 0}
            </div>
            {game.players?.map(p => (
              <div key={p} style={{ fontSize: 12, color: T.dim, marginTop: 4 }}>
                {p.startsWith('__npc') ? '🤖' : '👤'} {game.names?.[p]}
              </div>
            ))}
          </div>
        )
      }
    </div>
  );

  // Role reveal phase
  if (game.phase === 'reveal') {
    if (roleRevealed) return (
      <div style={{ ...S.page, justifyContent: 'center' }}>
        <div style={{ ...S.card, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
          <div style={{ fontSize: 14, color: T.dim }}>Waiting for all players to read their roles...</div>
          <div style={{ fontSize: 12, color: T.dim, marginTop: 8 }}>
            Ready: {Object.keys(game.ready || {}).length} / {game.players?.filter(p => !p.startsWith('__npc')).length}
          </div>
        </div>
      </div>
    );
    const myRole = game.roles?.[myId];
    if (!myRole) return <div style={{ ...S.page, justifyContent: 'center' }}><div style={{ color: T.dim }}>Loading roles...</div></div>;
    return (
      <div style={S.page}>
        <RoleReveal myRole={myRole} myName={game.names?.[myId]} onReady={onRoleReady} />
      </div>
    );
  }

  // Game over
  if (game.phase === 'gameover') return (
    <div style={S.page}>
      <GameOver game={game} myId={myId} onExit={() => { setScreen('menu'); setRoom(''); setMyId(''); setGame(null); setRoleRevealed(false); }} />
    </div>
  );

  const myRole = game.roles?.[myId];

  // Night phase
  if (game.phase === 'night') return (
    <div style={S.page}>
      <div style={{ fontSize: 11, color: T.dim, marginBottom: 8 }}>Round {game.round || 1}</div>
      <NightPhase room={room} game={game} myId={myId} myRole={myRole} onDone={() => setRoundReady(true)} />
    </div>
  );

  // Day phase
  if (game.phase === 'day') return (
    <div style={S.page}>
      <div style={{ fontSize: 11, color: T.dim, marginBottom: 8 }}>Round {game.round || 1}</div>
      <DayPhase room={room} game={game} myId={myId} onVoted={() => setRoundReady(true)} />
    </div>
  );

  return <div style={{ ...S.page, justifyContent: 'center' }}><div style={{ color: T.dim }}>Loading game...</div></div>;
}
