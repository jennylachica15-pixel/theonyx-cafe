import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase/config';
import { doc, setDoc, onSnapshot, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const TILE = 20;
const BARRIER_HP = 5;
const DAY_DURATION = 40000;
const NIGHT_DURATION = 35000;
const PLAYER_SPEED = 2.8;
const ZOMBIE_BASE_SPEED = 0.9;
const FOOD_ITEMS = ['☕','🍰','🧁','🍩','🥐','🍫'];

const AVATARS = [
  { id:'red',    name:'Red',    color:'#ff4444', bg:'#cc0000' },
  { id:'blue',   name:'Blue',   color:'#4488ff', bg:'#2255cc' },
  { id:'green',  name:'Green',  color:'#44cc44', bg:'#228822' },
  { id:'yellow', name:'Yellow', color:'#ffcc00', bg:'#cc9900' },
  { id:'purple', name:'Purple', color:'#cc44ff', bg:'#9922cc' },
  { id:'orange', name:'Orange', color:'#ff8800', bg:'#cc5500' },
];
const AVATAR_BODIES = {
  red:    { body:'#ff3333', head:'#ffccaa', shirt:'#cc0000' },
  blue:   { body:'#3366ff', head:'#ffccaa', shirt:'#0033cc' },
  green:  { body:'#33cc33', head:'#ffccaa', shirt:'#009900' },
  yellow: { body:'#ffcc00', head:'#ffccaa', shirt:'#cc9900' },
  purple: { body:'#cc33ff', head:'#ffccaa', shirt:'#9900cc' },
  orange: { body:'#ff8800', head:'#ffccaa', shirt:'#cc5500' },
};

function genCode() {
  return Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
}

function buildMap(day) {
  const extraRows = Math.min((day - 1) * 2, 10);
  const rows = 20 + extraRows, cols = 16;
  const map = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) return 1;
      if ((r === 2 || r === 4) && (c >= 2 && c <= 4 || c >= 11 && c <= 13)) return 2;
      if (r >= rows - 6 && r <= rows - 5 && (c === 2 || c === 3 || c === 12 || c === 13)) return 2;
      if ((r === 6 || r === 8) && (c === 3 || c === 12)) return 3;
      if (r === 7 && (c >= 2 && c <= 4 || c >= 11 && c <= 13)) return 3;
      if (day >= 3 && r === Math.floor(rows / 2) && (c === 4 || c === 11)) return 2;
      return 0;
    })
  );
  return { map, cols, rows, w: cols * TILE, h: rows * TILE };
}

function isSolid(map, barriers, tx, ty, cols, rows) {
  if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return true;
  if (map[ty] && (map[ty][tx] === 1 || map[ty][tx] === 2)) return true;
  if (barriers && barriers[`${tx},${ty}`]) return true;
  return false;
}

function spawnFood(map, cols, rows, count) {
  const food = []; let tries = 0;
  while (food.length < count && tries < 300) {
    tries++;
    const tx = 1 + Math.floor(Math.random() * (cols - 2));
    const ty = 1 + Math.floor(Math.random() * (rows - 2));
    if (map[ty] && map[ty][tx] === 0)
      food.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, type: FOOD_ITEMS[Math.floor(Math.random() * FOOD_ITEMS.length)], id: Math.random() });
  }
  return food;
}

// ─── DRAW HELPERS ─────────────────────────────────────────────────────────────
function drawChar(ctx, x, y, colors, label, labelColor, isZombie) {
  const s = 14;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(x, y + s * 0.6, s * 0.65, s * 0.18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = isZombie ? '#1a5c1a' : '#2244aa';
  ctx.fillRect(x - s * 0.32, y + s * 0.04, s * 0.28, s * 0.5);
  ctx.fillRect(x + s * 0.04, y + s * 0.04, s * 0.28, s * 0.5);
  ctx.fillStyle = isZombie ? '#228822' : (colors?.body || '#3366ff');
  ctx.fillRect(x - s * 0.35, y - s * 0.6, s * 0.7, s * 0.65);
  ctx.fillStyle = isZombie ? '#116611' : (colors?.shirt || '#0033cc');
  ctx.fillRect(x - s * 0.35, y - s * 0.6, s * 0.7, s * 0.15);
  ctx.fillStyle = isZombie ? '#228822' : (colors?.body || '#3366ff');
  if (isZombie) {
    ctx.fillRect(x - s * 0.75, y - s * 0.5, s * 0.38, s * 0.16);
    ctx.fillRect(x + s * 0.36, y - s * 0.6, s * 0.38, s * 0.16);
  } else {
    ctx.fillRect(x - s * 0.65, y - s * 0.55, s * 0.28, s * 0.45);
    ctx.fillRect(x + s * 0.36, y - s * 0.55, s * 0.28, s * 0.45);
  }
  ctx.fillStyle = isZombie ? '#88cc44' : (colors?.head || '#ffccaa');
  ctx.fillRect(x - s * 0.3, y - s * 1.15, s * 0.6, s * 0.55);
  ctx.fillStyle = isZombie ? '#ff0000' : '#333';
  ctx.fillRect(x - s * 0.18, y - s * 0.96, s * 0.1, s * 0.12);
  ctx.fillRect(x + s * 0.08, y - s * 0.96, s * 0.1, s * 0.12);
  if (!isZombie) { ctx.fillStyle = '#ffaaaa'; ctx.fillRect(x - s * 0.1, y - s * 0.72, s * 0.2, s * 0.06); }
  if (label) {
    ctx.font = 'bold 8px Arial'; ctx.textAlign = 'center';
    const tw = ctx.measureText(label).width + 6;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - tw / 2, y - s * 1.38, tw, 11);
    ctx.fillStyle = labelColor || '#fff'; ctx.fillText(label, x, y - s * 1.28);
  }
}

function drawBarrier(ctx, x, y, ratio) {
  const s = TILE;
  ctx.fillStyle = `rgba(139,90,43,${0.5 + ratio * 0.5})`;
  ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
  ctx.strokeStyle = `rgba(80,40,10,${ratio * 0.7})`; ctx.lineWidth = 1;
  for (let r = 0; r < 3; r++) {
    const ry = y + 2 + r * (s - 4) / 3;
    ctx.beginPath(); ctx.moveTo(x + 1, ry); ctx.lineTo(x + s - 1, ry); ctx.stroke();
  }
  if (ratio < 0.5) {
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + s * 0.3, y + s * 0.2); ctx.lineTo(x + s * 0.5, y + s * 0.6); ctx.stroke();
  }
  ctx.strokeStyle = `rgba(212,168,83,${ratio})`; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
}

// ─── HOW TO PLAY ──────────────────────────────────────────────────────────────
function HowToPlay({ onDone }) {
  const steps = [
    { icon: '🕹️', title: 'Move', desc: 'Drag the left joystick to walk. Works in both day and night!' },
    { icon: '☀️', title: 'Daytime — Build & Eat', desc: 'Tap BUILD to place barriers around you. Collect glowing food items for hunger.' },
    { icon: '🌙', title: 'Nighttime — Fight!', desc: 'Zombies spawn at the edges and hunt you. Tap ATTACK when close to hit them!' },
    { icon: '🧱', title: 'Barriers', desc: 'Zombies eat through walls. Use REMOVE to demolish your own barriers.' },
    { icon: '🍽️', title: 'Hunger', desc: 'Hunger drains constantly. Eat food or you lose HP slowly!' },
    { icon: '🗺️', title: 'Expanding Map', desc: 'Each day the map grows bigger and zombies get faster and more numerous!' },
    { icon: '👥', title: 'Multiplayer', desc: 'Host a room, share the 4-letter code. Friends join on their own phones!' },
  ];
  return (
    <div style={{ minHeight: '100%', background: 'linear-gradient(180deg,#1a0a2e,#0a1a0e)', color: '#fff', fontFamily: "'Arial Black',Arial,sans-serif", overflowY: 'auto' }}>
      <div style={{ background: 'linear-gradient(135deg,#ff6600,#ffcc00)', padding: '16px', textAlign: 'center', borderBottom: '4px solid #ff8800', boxShadow: '0 4px 0 #cc5500' }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', textShadow: '3px 3px 0 #cc4400' }}>HOW TO PLAY</div>
      </div>
      <div style={{ padding: '12px 14px 4px' }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'rgba(255,255,255,0.07)', border: '2px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 12px', marginBottom: 8 }}>
            <div style={{ fontSize: 22, minWidth: 30, textAlign: 'center' }}>{s.icon}</div>
            <div>
              <div style={{ fontWeight: 900, color: '#ffcc00', fontSize: 12, marginBottom: 2, textTransform: 'uppercase' }}>{s.title}</div>
              <div style={{ color: '#ccc', fontSize: 12, lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '0 14px 14px' }}>
        <button
          onPointerDown={e => { e.preventDefault(); e.stopPropagation(); onDone(); }}
          style={{ width: '100%', background: 'linear-gradient(180deg,#44dd44,#22aa22)', border: 'none', borderRadius: 12, padding: '14px', color: '#fff', fontSize: 16, fontWeight: 900, cursor: 'pointer', boxShadow: '0 5px 0 #116611', textTransform: 'uppercase', letterSpacing: 1, display: 'block' }}>
          LET'S GO! →
        </button>
      </div>
    </div>
  );
}

// ─── AVATAR SELECT ─────────────────────────────────────────────────────────────
function AvatarSelect({ playerName, onSelect }) {
  const [sel, setSel] = useState(AVATARS[0].id);
  const selAv = AVATARS.find(a => a.id === sel);
  return (
    <div style={{ minHeight: '100%', background: 'linear-gradient(180deg,#1a0a2e,#0a1a0e)', fontFamily: "'Arial Black',Arial,sans-serif", overflowY: 'auto' }}>
      <div style={{ background: 'linear-gradient(135deg,#9900cc,#ff44ff)', padding: '16px', textAlign: 'center', borderBottom: '4px solid #cc00ff', boxShadow: '0 4px 0 #660099' }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', textShadow: '3px 3px 0 #660099' }}>PICK YOUR CHARACTER</div>
        <div style={{ fontSize: 12, color: '#ffccff', marginTop: 2 }}>Playing as: <b style={{ color: '#ffff00' }}>{playerName}</b></div>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
          {AVATARS.map(av => {
            const isSel = sel === av.id;
            return (
              <div key={av.id}
                onPointerDown={e => { e.preventDefault(); e.stopPropagation(); setSel(av.id); }}
                style={{ background: isSel ? `${av.bg}44` : 'rgba(255,255,255,0.05)', border: `3px solid ${isSel ? av.color : 'rgba(255,255,255,0.1)'}`, borderRadius: 14, padding: '12px 6px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
                <svg width="40" height="48" viewBox="0 0 40 48" style={{ display: 'block', margin: '0 auto 6px' }}>
                  <ellipse cx="20" cy="45" rx="10" ry="3" fill="rgba(0,0,0,0.3)" />
                  <rect x="12" y="30" width="7" height="12" rx="2" fill="#224499" />
                  <rect x="21" y="30" width="7" height="12" rx="2" fill="#224499" />
                  <rect x="10" y="17" width="20" height="15" rx="2" fill={AVATAR_BODIES[av.id].body} />
                  <rect x="10" y="17" width="20" height="5" rx="2" fill={AVATAR_BODIES[av.id].shirt} />
                  <rect x="3" y="17" width="7" height="12" rx="2" fill={AVATAR_BODIES[av.id].body} />
                  <rect x="30" y="17" width="7" height="12" rx="2" fill={AVATAR_BODIES[av.id].body} />
                  <rect x="12" y="3" width="16" height="15" rx="3" fill="#ffccaa" />
                  <rect x="15" y="8" width="4" height="4" rx="1" fill="#333" />
                  <rect x="22" y="8" width="4" height="4" rx="1" fill="#333" />
                  {isSel && <><circle cx="33" cy="6" r="6" fill="#44dd44" /><text x="33" y="10" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold">✓</text></>}
                </svg>
                <div style={{ fontWeight: 900, fontSize: 11, color: isSel ? av.color : '#aaa', textTransform: 'uppercase' }}>{av.name}</div>
              </div>
            );
          })}
        </div>
        <button
          onPointerDown={e => { e.preventDefault(); e.stopPropagation(); onSelect(selAv); }}
          style={{ width: '100%', background: `linear-gradient(180deg,${selAv.color},${selAv.bg})`, border: 'none', borderRadius: 12, padding: '14px', color: '#fff', fontSize: 15, fontWeight: 900, cursor: 'pointer', boxShadow: `0 5px 0 ${selAv.bg}`, textTransform: 'uppercase' }}>
          PLAY AS {selAv.name} →
        </button>
      </div>
    </div>
  );
}

// ─── GAME ENGINE ──────────────────────────────────────────────────────────────
function GameEngine({ isSolo, roomCode, myName, myAvatar, isHost, roomData, onGameOver, onBack }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  const G = useRef({
    map: null, cols: 0, rows: 0, mapW: 0, mapH: 0,
    px: 8 * TILE, py: 10 * TILE, php: 100,
    hunger: 100,
    hungerDmgTimer: 0,
    phase: 'day',
    phaseStart: Date.now(),
    day: 1,
    barriers: {},
    food: [],
    zombies: [],
    others: {},
    dead: false,
    transitioning: false,
    score: 0,
  });

  const joyRef = useRef({ x: 0, y: 0 });
  const joyBaseRef = useRef(null);
  const [joyVis, setJoyVis] = useState({ active: false, bx: 80, by: 80, kx: 80, ky: 80 });
  const JR = 48;

  const [phase, setPhase] = useState('day');
  const [timer, setTimer] = useState(DAY_DURATION / 1000);
  const [day, setDay] = useState(1);
  const [hp, setHp] = useState(100);
  const [hunger, setHunger] = useState(100);
  const [zombieCount, setZombieCount] = useState(0);
  const [log, setLog] = useState('☀️ Day 1 — Build your fort & eat!');
  const [dead, setDead] = useState(false);
  const [score, setScore] = useState(0);
  const lastSyncRef = useRef(0);

  useEffect(() => {
    const m = buildMap(1);
    const g = G.current;
    g.map = m.map; g.cols = m.cols; g.rows = m.rows; g.mapW = m.w; g.mapH = m.h;
    g.food = spawnFood(m.map, m.cols, m.rows, 10);
    g.phase = 'day'; g.phaseStart = Date.now(); g.day = 1;
    g.px = 8 * TILE; g.py = 10 * TILE; g.php = 100; g.hunger = 100;
    g.barriers = {}; g.zombies = []; g.dead = false; g.score = 0; g.transitioning = false;

    const loop = () => { tick(); render(); rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  useEffect(() => {
    if (!roomData?.players) return;
    const others = {};
    Object.entries(roomData.players).forEach(([n, d]) => { if (n !== myName) others[n] = d; });
    G.current.others = others;
    if (roomData.barriers && !isHost) G.current.barriers = { ...roomData.barriers };
  }, [roomData]);

  const pushToFirestore = useCallback(async () => {
    if (isSolo) return;
    const now = Date.now();
    if (now - lastSyncRef.current < 300) return;
    lastSyncRef.current = now;
    const g = G.current;
    try {
      await updateDoc(doc(db, 'zombieRooms', roomCode), {
        [`players.${myName}`]: { x: Math.round(g.px), y: Math.round(g.py), hp: g.php, avatarId: myAvatar.id, color: myAvatar.color },
        ...(isHost ? { barriers: g.barriers, phase: g.phase, day: g.day } : {})
      });
    } catch (e) {}
  }, [isSolo, roomCode, myName, myAvatar, isHost]);

  const doSpawnZombies = () => {
    const g = G.current;
    const count = Math.min(2 + g.day * 2, 14);
    const spd = ZOMBIE_BASE_SPEED + g.day * 0.12;
    const zhp = 2 + Math.floor(g.day / 2);
    const pts = [
      [1, 1], [g.cols - 2, 1], [1, g.rows - 2], [g.cols - 2, g.rows - 2],
      [Math.floor(g.cols / 2), 1], [Math.floor(g.cols / 2), g.rows - 2],
      [1, Math.floor(g.rows / 2)], [g.cols - 2, Math.floor(g.rows / 2)]
    ];
    g.zombies = Array.from({ length: count }, (_, i) => {
      const p = pts[i % pts.length];
      return { id: Date.now() + i, x: p[0] * TILE + Math.random() * 6, y: p[1] * TILE + Math.random() * 6, hp: zhp, maxHp: zhp, spd, atkTimer: 0 };
    });
    setZombieCount(count);
    setLog(`🌙 Night ${g.day} — ${count} ZOMBIES INCOMING!`);
  };

  const tick = () => {
    const g = G.current;
    if (g.dead) return;

    const elapsed = Date.now() - g.phaseStart;
    const dur = g.phase === 'day' ? DAY_DURATION : NIGHT_DURATION;
    const remaining = Math.max(0, Math.floor((dur - elapsed) / 1000));
    setTimer(remaining);
    setScore(g.day * 50 + (g.phase === 'night' ? 25 : 0));

    g.hunger = Math.max(0, g.hunger - 0.007);
    setHunger(Math.floor(g.hunger));
    if (g.hunger <= 0) {
      g.hungerDmgTimer++;
      if (g.hungerDmgTimer >= 60) {
        g.hungerDmgTimer = 0;
        g.php = Math.max(0, g.php - 5);
        setHp(g.php);
        setLog('😵 Starving!');
        if (g.php <= 0) { g.dead = true; setDead(true); onGameOver(g.day * 50); return; }
      }
    }

    if (elapsed >= dur && !g.transitioning) {
      g.transitioning = true;
      const next = g.phase === 'day' ? 'night' : 'day';
      g.phase = next;
      g.phaseStart = Date.now();
      setPhase(next);
      if (next === 'night') {
        doSpawnZombies();
      } else {
        g.zombies = [];
        setZombieCount(0);
        g.day++;
        setDay(g.day);
        const nm = buildMap(g.day);
        g.map = nm.map; g.cols = nm.cols; g.rows = nm.rows; g.mapW = nm.w; g.mapH = nm.h;
        g.food = spawnFood(nm.map, nm.cols, nm.rows, 8 + g.day);
        setLog(`☀️ Day ${g.day} — Map expanded! Find food!`);
      }
      setTimeout(() => { g.transitioning = false; }, 1000);
    }

    const jv = joyRef.current;
    if (Math.abs(jv.x) > 0.05 || Math.abs(jv.y) > 0.05) {
      const spd = g.hunger < 15 ? 1.5 : PLAYER_SPEED;
      const dx = jv.x * spd, dy = jv.y * spd;
      const M = TILE * 0.32;
      const nx = g.px + dx;
      const xOk = ![[nx - M, g.py - M], [nx + M, g.py - M], [nx - M, g.py + M], [nx + M, g.py + M]]
        .some(([cx, cy]) => isSolid(g.map, g.barriers, Math.floor(cx / TILE), Math.floor(cy / TILE), g.cols, g.rows));
      if (xOk) g.px = Math.max(TILE, Math.min(g.mapW - TILE, nx));
      const ny = g.py + dy;
      const yOk = ![[g.px - M, ny - M], [g.px + M, ny - M], [g.px - M, ny + M], [g.px + M, ny + M]]
        .some(([cx, cy]) => isSolid(g.map, g.barriers, Math.floor(cx / TILE), Math.floor(cy / TILE), g.cols, g.rows));
      if (yOk) g.py = Math.max(TILE, Math.min(g.mapH - TILE, ny));
    }

    g.food = g.food.filter(f => {
      if (Math.hypot(f.x - g.px, f.y - g.py) < TILE * 1.1) {
        g.hunger = Math.min(100, g.hunger + 28);
        g.php = Math.min(100, g.php + 3);
        setHunger(Math.floor(g.hunger));
        setHp(g.php);
        setLog(`😋 Ate ${f.type}!`);
        return false;
      }
      return true;
    });

    if (g.phase === 'night') {
      g.zombies.forEach(z => {
        if (z.hp <= 0) return;
        const dx = g.px - z.x, dy = g.py - z.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 3) {
          const angle = Math.atan2(dy, dx);
          const nx = z.x + Math.cos(angle) * z.spd;
          const ny = z.y + Math.sin(angle) * z.spd;
          const ztx = Math.floor(nx / TILE), zty = Math.floor(ny / TILE);
          const bk = `${ztx},${zty}`;
          if (g.barriers[bk] !== undefined) {
            g.barriers[bk] -= 0.018;
            if (g.barriers[bk] <= 0) { delete g.barriers[bk]; setLog('🧱 Barrier broken!'); }
          } else if (!isSolid(g.map, {}, ztx, zty, g.cols, g.rows)) {
            z.x = nx; z.y = ny;
          }
        }
        if (dist < TILE * 1.2) {
          z.atkTimer++;
          if (z.atkTimer > 50) {
            z.atkTimer = 0;
            g.php = Math.max(0, g.php - 12);
            setHp(g.php);
            if (g.php <= 0) { g.dead = true; setDead(true); onGameOver(g.day * 50); }
          }
        }
      });
      g.zombies = g.zombies.filter(z => z.hp > 0);
      setZombieCount(g.zombies.filter(z => z.hp > 0).length);
    }

    setHp(g.php);
    pushToFirestore();
  };

  const render = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const g = G.current;
    if (!g.map) return;
    const cw = canvas.width, ch = canvas.height;
    const isNight = g.phase === 'night';

    const camX = Math.max(0, Math.min(g.mapW - cw, g.px - cw / 2));
    const camY = Math.max(0, Math.min(g.mapH - ch, g.py - ch / 2));
    ctx.save(); ctx.translate(-camX, -camY);

    ctx.fillStyle = isNight ? '#050510' : '#141a00';
    ctx.fillRect(camX, camY, cw, ch);

    for (let ty = 0; ty < g.rows; ty++) for (let tx = 0; tx < g.cols; tx++) {
      const tile = g.map[ty][tx];
      const x = tx * TILE, y = ty * TILE;
      if (x + TILE < camX || x > camX + cw || y + TILE < camY || y > camY + ch) continue;
      if (tile === 1) {
        ctx.fillStyle = isNight ? '#1a1a2e' : '#3a2200'; ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = isNight ? '#2a2a3e' : '#5a3a00'; ctx.lineWidth = 1; ctx.strokeRect(x, y, TILE, TILE);
      } else if (tile === 2) {
        ctx.fillStyle = isNight ? '#2a2a1e' : '#5d3a10'; ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = isNight ? '#1a1a10' : '#4a2a00'; ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      } else if (tile === 3) {
        ctx.fillStyle = isNight ? '#0e1e0e' : '#2a3a00'; ctx.fillRect(x, y, TILE, TILE);
      } else {
        ctx.fillStyle = isNight ? '#080810' : '#141a00'; ctx.fillRect(x, y, TILE, TILE);
      }
    }

    g.food.forEach(f => {
      ctx.save();
      ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 8;
      ctx.font = '13px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(f.type, f.x, f.y);
      ctx.restore();
    });

    Object.entries(g.barriers).forEach(([key, hp2]) => {
      const [bx, by] = key.split(',').map(Number);
      drawBarrier(ctx, bx * TILE, by * TILE, hp2 / BARRIER_HP);
    });

    Object.entries(g.others).forEach(([name, data]) => {
      const col = AVATAR_BODIES[data.avatarId] || AVATAR_BODIES.blue;
      drawChar(ctx, data.x, data.y, col, name.slice(0, 6), data.color, false);
    });

    g.zombies.forEach(z => {
      if (z.hp <= 0) return;
      drawChar(ctx, z.x, z.y, null, null, null, true);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(z.x - 11, z.y - 26, 22, 4);
      ctx.fillStyle = '#ff2222'; ctx.fillRect(z.x - 11, z.y - 26, 22 * (z.hp / z.maxHp), 4);
    });

    const pc = AVATAR_BODIES[myAvatar.id];
    drawChar(ctx, g.px, g.py, pc, myName.slice(0, 6), myAvatar.color, false);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(g.px - 13, g.py - 26, 26, 4);
    ctx.fillStyle = g.php > 50 ? '#44dd44' : g.php > 25 ? '#ff9800' : '#ff4444';
    ctx.fillRect(g.px - 13, g.py - 26, 26 * (g.php / 100), 4);

    if (isNight) {
      const vg = ctx.createRadialGradient(g.px, g.py, 55, g.px, g.py, Math.max(cw, ch) * 0.8);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.8)');
      ctx.fillStyle = vg; ctx.fillRect(camX, camY, cw, ch);
      ctx.fillStyle = 'rgba(80,0,0,0.1)'; ctx.fillRect(camX, camY, cw, ch);
    }

    ctx.restore();
  };

  // ── FIX: joystick handlers with preventDefault ─────────────────────────────
  const onJoyStart = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    const t = e.touches ? e.touches[0] : e;
    const rect = e.currentTarget.getBoundingClientRect();
    const bx = t.clientX - rect.left, by = t.clientY - rect.top;
    joyBaseRef.current = { bx, by };
    joyRef.current = { x: 0, y: 0 };
    setJoyVis({ active: true, bx, by, kx: bx, ky: by });
  }, []);

  const onJoyMove = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    if (!joyBaseRef.current) return;
    const t = e.touches ? e.touches[0] : e;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = t.clientX - rect.left, my = t.clientY - rect.top;
    const { bx, by } = joyBaseRef.current;
    const rdx = mx - bx, rdy = my - by;
    const dist = Math.hypot(rdx, rdy);
    const angle = Math.atan2(rdy, rdx);
    const clamped = Math.min(dist, JR);
    const kx = bx + Math.cos(angle) * clamped;
    const ky = by + Math.sin(angle) * clamped;
    joyRef.current = dist > 8 ? { x: Math.cos(angle), y: Math.sin(angle) } : { x: 0, y: 0 };
    setJoyVis({ active: true, bx, by, kx, ky });
  }, []);

  const onJoyEnd = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    joyBaseRef.current = null;
    joyRef.current = { x: 0, y: 0 };
    setJoyVis(v => ({ ...v, active: false }));
  }, []);

  // ── FIX: action handlers wrapped with stopPropagation ──────────────────────
  const handleAttack = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    const g = G.current;
    if (g.phase === 'day') { setLog('☀️ No zombies in daytime!'); return; }
    let hit = false;
    g.zombies.forEach(z => { if (Math.hypot(z.x - g.px, z.y - g.py) < TILE * 2.2) { z.hp--; hit = true; } });
    g.zombies = g.zombies.filter(z => z.hp > 0);
    setZombieCount(g.zombies.filter(z => z.hp > 0).length);
    setLog(hit ? '⚔️ Hit!' : '⚠️ No zombie in range!');
  }, []);

  const handleBuild = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    const g = G.current;
    if (g.phase === 'night') { setLog('⚠️ Build during the day!'); return; }
    const ptx = Math.floor(g.px / TILE), pty = Math.floor(g.py / TILE);
    for (const [ox, oy] of [[0, -1], [1, 0], [0, 1], [-1, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const bx = ptx + ox, by = pty + oy, key = `${bx},${by}`;
      if (!isSolid(g.map, {}, bx, by, g.cols, g.rows) && !g.barriers[key]) {
        g.barriers[key] = BARRIER_HP; setLog('🧱 Barrier placed!'); return;
      }
    }
    setLog('⚠️ No space nearby!');
  }, []);

  const handleRemove = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    const g = G.current;
    const ptx = Math.floor(g.px / TILE), pty = Math.floor(g.py / TILE);
    for (const [ox, oy] of [[0, 0], [0, -1], [1, 0], [0, 1], [-1, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const key = `${ptx + ox},${pty + oy}`;
      if (g.barriers[key] !== undefined) { delete g.barriers[key]; setLog('🗑️ Barrier removed!'); return; }
    }
    setLog('⚠️ No barrier nearby!');
  }, []);

  const handleExitBtn = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    onBack();
  }, [onBack]);

  const isNight = phase === 'night';
  const hpColor = hp > 60 ? '#44dd44' : hp > 30 ? '#ffcc00' : '#ff3333';
  const hungerColor = hunger > 60 ? '#ff8800' : hunger > 30 ? '#ffcc00' : '#ff3333';

  return (
    // ── FIX: touchAction:'none' + overscrollBehavior:'none' on root container
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#000', fontFamily: "'Arial Black',Arial,sans-serif", overflow: 'hidden', position: 'relative', touchAction: 'none', overscrollBehavior: 'none' }}>

      {/* HUD */}
      <div style={{ background: isNight ? 'linear-gradient(90deg,#200000,#100010)' : 'linear-gradient(90deg,#003300,#001a00)', padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: `3px solid ${isNight ? '#ff0000' : '#44aa00'}`, flexShrink: 0 }}>
        <button
          onPointerDown={handleExitBtn}
          style={{ background: '#1a1a1a', border: '2px solid #444', borderRadius: 7, padding: '3px 8px', color: '#aaa', fontSize: 10, cursor: 'pointer', fontWeight: 900, textTransform: 'uppercase' }}>
          ✕ EXIT
        </button>
        <div style={{ background: isNight ? 'linear-gradient(180deg,#ff3300,#880000)' : 'linear-gradient(180deg,#ffcc00,#aa7700)', borderRadius: 7, padding: '2px 7px', border: `2px solid ${isNight ? '#ff6600' : '#ffee00'}` }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: '#fff' }}>{isNight ? '🌙 NIGHT' : '☀️ DAY'} {day}</span>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: 7, padding: '2px 6px', border: '1px solid rgba(255,255,255,0.2)' }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: timer < 10 ? '#ff4444' : '#fff' }}>⏱{timer}s</span>
        </div>
        {isNight && <div style={{ background: 'rgba(200,0,0,0.4)', borderRadius: 7, padding: '2px 6px', border: '1px solid #ff4444' }}><span style={{ fontSize: 10, fontWeight: 900, color: '#ff8888' }}>🧟{zombieCount}</span></div>}
        <div style={{ marginLeft: 'auto', background: 'rgba(255,200,0,0.15)', borderRadius: 7, padding: '2px 6px', border: '1px solid rgba(255,200,0,0.3)' }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: '#ffcc00' }}>⭐{score}</span>
        </div>
      </div>

      {/* HP + HUNGER */}
      <div style={{ background: 'rgba(0,0,0,0.85)', padding: '3px 8px', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 900, color: hpColor, minWidth: 22 }}>❤️{hp}</span>
        <div style={{ flex: 1, height: 7, background: '#330000', borderRadius: 4, overflow: 'hidden', border: '1px solid #550000' }}>
          <div style={{ width: `${hp}%`, height: '100%', background: hpColor, transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 900, color: hungerColor, minWidth: 22 }}>🍽️{hunger}</span>
        <div style={{ flex: 1, height: 7, background: '#332200', borderRadius: 4, overflow: 'hidden', border: '1px solid #553300' }}>
          <div style={{ width: `${hunger}%`, height: '100%', background: hungerColor, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* CANVAS */}
      <canvas ref={canvasRef} width={320} height={340} style={{ display: 'block', width: '100%', flex: '1 1 auto', imageRendering: 'pixelated' }} />

      {/* LOG */}
      <div style={{ background: isNight ? 'rgba(80,0,0,0.9)' : 'rgba(0,40,0,0.9)', padding: '3px 10px', fontSize: 10, color: isNight ? '#ff8888' : '#88ff88', fontWeight: 'bold', textAlign: 'center', flexShrink: 0, borderTop: `2px solid ${isNight ? '#440000' : '#224400'}` }}>
        {log}
      </div>

      {/* CONTROLS — FIX: touchAction:'none' + onTouchStart preventDefault on container */}
      <div
        style={{ flex: '0 0 130px', background: 'linear-gradient(180deg,#111,#0a0a0a)', borderTop: '2px solid #222', position: 'relative', flexShrink: 0, touchAction: 'none', overscrollBehavior: 'none' }}
        onTouchStart={e => e.preventDefault()}
      >
        {/* JOYSTICK */}
        <div
          style={{ position: 'absolute', left: 0, top: 0, width: '55%', height: '100%', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
          onTouchStart={onJoyStart} onTouchMove={onJoyMove} onTouchEnd={onJoyEnd}
          onPointerDown={onJoyStart} onPointerMove={e => { if (e.buttons) onJoyMove(e); }} onPointerUp={onJoyEnd} onPointerLeave={onJoyEnd}
        >
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            {joyVis.active ? <>
              <circle cx={joyVis.bx} cy={joyVis.by} r={JR} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.25)" strokeWidth={2} />
              <circle cx={joyVis.bx} cy={joyVis.by} r={JR * 0.25} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
              <circle cx={joyVis.kx} cy={joyVis.ky} r={26} fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.5)" strokeWidth={2.5} />
              <circle cx={joyVis.kx} cy={joyVis.ky} r={11} fill="rgba(255,255,255,0.35)" />
            </> : <>
              <circle cx={80} cy="50%" r={JR} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth={1.5} strokeDasharray="6,4" />
              <circle cx={80} cy="50%" r={22} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} />
              <text x={80} y="52%" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.2)" fontSize={10} fontWeight="bold">MOVE</text>
            </>}
          </svg>
        </div>

        {/* ACTION BUTTONS — FIX: onPointerDown with preventDefault + stopPropagation */}
        <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button
            onPointerDown={handleAttack}
            style={{ background: isNight ? 'linear-gradient(180deg,#ff3333,#aa0000)' : 'rgba(50,50,50,0.6)', border: `2px solid ${isNight ? '#ff6666' : '#333'}`, borderRadius: 10, width: 62, height: 48, color: '#fff', fontSize: 11, fontWeight: 900, cursor: 'pointer', opacity: isNight ? 1 : 0.4, textTransform: 'uppercase', lineHeight: 1.2, touchAction: 'none' }}>
            ⚔️<br />ATTACK
          </button>
          <button
            onPointerDown={handleBuild}
            style={{ background: !isNight ? 'linear-gradient(180deg,#886633,#553311)' : 'rgba(50,50,50,0.6)', border: `2px solid ${!isNight ? '#ddaa55' : '#333'}`, borderRadius: 10, width: 62, height: 48, color: '#fff', fontSize: 11, fontWeight: 900, cursor: 'pointer', opacity: !isNight ? 1 : 0.4, textTransform: 'uppercase', lineHeight: 1.2, touchAction: 'none' }}>
            🧱<br />BUILD
          </button>
          <button
            onPointerDown={handleRemove}
            style={{ background: 'linear-gradient(180deg,#663333,#441111)', border: '2px solid #cc4444', borderRadius: 10, width: 62, height: 48, color: '#fff', fontSize: 10, fontWeight: 900, cursor: 'pointer', textTransform: 'uppercase', lineHeight: 1.2, gridColumn: '1/-1', touchAction: 'none' }}>
            🗑️ REMOVE
          </button>
        </div>
      </div>

      {/* DEATH SCREEN */}
      {dead && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 50, touchAction: 'none' }}>
          <div style={{ fontSize: 56 }}>💀</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#ff3333', textShadow: '3px 3px 0 #880000', textTransform: 'uppercase', marginBottom: 4 }}>YOU DIED!</div>
          <div style={{ color: '#aaa', fontSize: 14, marginBottom: 4 }}>Survived <b style={{ color: '#ffcc00' }}>{day}</b> day{day > 1 ? 's' : ''}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#ffcc00', marginBottom: 24 }}>⭐ {day * 50} POINTS</div>
          <button
            onPointerDown={e => { e.preventDefault(); e.stopPropagation(); onBack(); }}
            style={{ background: 'linear-gradient(180deg,#44dd44,#22aa22)', border: 'none', borderRadius: 12, padding: '14px 32px', color: '#fff', fontSize: 16, fontWeight: 900, cursor: 'pointer', boxShadow: '0 5px 0 #116611', textTransform: 'uppercase' }}>
            PLAY AGAIN
          </button>
        </div>
      )}
    </div>
  );
}

// ─── LOBBY ────────────────────────────────────────────────────────────────────
function Lobby({ roomCode, myName, myAvatar, roomData, isHost, onStart, onLeave }) {
  const members = roomData?.members || [myName];
  return (
    <div style={{ minHeight: '100%', background: 'linear-gradient(180deg,#001a2e,#001a00)', fontFamily: "'Arial Black',Arial,sans-serif", overflowY: 'auto' }}>
      <div style={{ background: 'linear-gradient(135deg,#004488,#0066cc)', padding: '16px', textAlign: 'center', borderBottom: '4px solid #0088ff', boxShadow: '0 4px 0 #002255' }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', textShadow: '2px 2px 0 #002255' }}>WAITING ROOM</div>
      </div>
      <div style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: '#88aacc', marginBottom: 6, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>Room Code</div>
        <div style={{ fontSize: 40, fontWeight: 900, color: '#44dd44', letterSpacing: 8, background: 'rgba(0,0,0,0.4)', padding: '10px 20px', borderRadius: 14, border: '3px solid #44dd44', marginBottom: 14, textShadow: '0 0 20px #44dd44', display: 'inline-block' }}>{roomCode}</div>
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 12, marginBottom: 14, textAlign: 'left' }}>
          <div style={{ color: '#44dd44', fontWeight: 900, fontSize: 12, marginBottom: 8, textTransform: 'uppercase' }}>Players ({members.length})</div>
          {members.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: AVATARS.find(a => a.id === (roomData?.avatars?.[p] || 'blue'))?.bg || '#224499', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🧑</div>
              <span style={{ flex: 1, color: p === myName ? '#ffcc00' : '#ddd', fontWeight: p === myName ? 900 : 400, fontSize: 13 }}>{p}{p === myName ? ' (you)' : ''}</span>
              {p === roomData?.host && <span style={{ background: '#ffcc00', color: '#000', fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 6, textTransform: 'uppercase' }}>HOST</span>}
            </div>
          ))}
        </div>
        {isHost
          ? <button onPointerDown={e => { e.preventDefault(); e.stopPropagation(); onStart(); }} style={{ width: '100%', background: 'linear-gradient(180deg,#44dd44,#22aa22)', border: 'none', borderRadius: 12, padding: 14, color: '#fff', fontSize: 15, fontWeight: 900, cursor: 'pointer', boxShadow: '0 5px 0 #116611', textTransform: 'uppercase', marginBottom: 10 }}>▶ START GAME!</button>
          : <div style={{ color: '#aaa', fontSize: 13, marginBottom: 10, padding: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}>Waiting for host to start...</div>
        }
        <button onPointerDown={e => { e.preventDefault(); e.stopPropagation(); onLeave(); }} style={{ width: '100%', background: '#1a1a1a', border: '2px solid #333', borderRadius: 10, padding: 10, color: '#888', fontSize: 12, cursor: 'pointer', textTransform: 'uppercase', fontWeight: 900 }}>← LEAVE</button>
      </div>
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
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
    unsubRef.current = onSnapshot(doc(db, 'zombieRooms', code), snap => {
      if (!snap.exists()) return;
      const data = snap.data(); setRoomData(data);
      if (data.status === 'playing') setScreen('game');
    });
  }, []);

  useEffect(() => () => { if (unsubRef.current) unsubRef.current(); }, []);

  const hostGame = async (av) => {
    setLoading(true); const code = genCode();
    try {
      await setDoc(doc(db, 'zombieRooms', code), { code, host: myName, members: [myName], players: {}, avatars: { [myName]: av.id }, barriers: {}, status: 'waiting', phase: 'day', day: 1, createdAt: serverTimestamp() });
      setRoomCode(code); setIsHost(true); subscribeRoom(code); setScreen('lobby');
    } catch (e) { setError('Failed to create room'); }
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
      await updateDoc(doc(db, 'zombieRooms', code), { members: [...(data.members || []), myName], [`avatars.${myName}`]: av.id });
      setRoomCode(code); setIsHost(false); subscribeRoom(code); setScreen('lobby');
    } catch (e) { setError('Failed to join'); }
    setLoading(false);
  };

  const startGame = async () => { await updateDoc(doc(db, 'zombieRooms', roomCode), { status: 'playing' }); };
  const leaveRoom = () => { if (unsubRef.current) unsubRef.current(); setScreen('menu'); setRoomCode(''); setRoomData(null); };

  if (screen === 'howtoplay') return <HowToPlay onDone={() => setScreen('avatarselect')} />;
  if (screen === 'avatarselect') return <AvatarSelect playerName={myName} onSelect={av => { setAvatar(av); setScreen('menu'); }} />;

  if (screen === 'game' && avatar) return (
    <GameEngine
      isSolo={!roomCode || roomCode === 'SOLO'}
      roomCode={roomCode || 'SOLO'}
      myName={myName} myAvatar={avatar}
      isHost={isHost || !roomCode}
      roomData={roomData}
      onGameOver={s => { onScore(s); }}
      onBack={() => { leaveRoom(); onBack(); }}
    />
  );

  if (screen === 'lobby') return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <Lobby roomCode={roomCode} myName={myName} myAvatar={avatar || AVATARS[0]} roomData={roomData} isHost={isHost} onStart={startGame} onLeave={leaveRoom} />
    </div>
  );

  // ── MENU SCREEN ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100%', background: 'linear-gradient(180deg,#0a0010,#000a00)', fontFamily: "'Arial Black',Arial,sans-serif", overflowY: 'auto' }}>
      <div style={{ background: 'linear-gradient(135deg,#330000,#660000)', padding: '20px 16px', textAlign: 'center', borderBottom: '4px solid #ff0000', boxShadow: '0 4px 0 #880000' }}>
        <div style={{ fontSize: 50, marginBottom: 4 }}>🧟</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#ff3333', textShadow: '3px 3px 0 #660000', letterSpacing: 2, textTransform: 'uppercase' }}>ZOMBIE BARISTA</div>
        <div style={{ fontSize: 12, color: '#ff9999', fontWeight: 'bold', marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 }}>BUILD • EAT • SURVIVE</div>
      </div>
      <div style={{ padding: 14 }}>
        {avatar && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.05)', border: `2px solid ${avatar.color}44`, borderRadius: 14, padding: '10px 14px', marginBottom: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: avatar.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: `2px solid ${avatar.color}` }}>🧑</div>
            <div>
              <div style={{ color: avatar.color, fontWeight: 900, fontSize: 14, textTransform: 'uppercase' }}>{myName}</div>
              <div style={{ color: '#666', fontSize: 11, textTransform: 'uppercase' }}>as {avatar.name}</div>
            </div>
            <button
              onPointerDown={e => { e.preventDefault(); e.stopPropagation(); setScreen('avatarselect'); }}
              style={{ marginLeft: 'auto', background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '5px 10px', color: '#888', fontSize: 10, cursor: 'pointer', textTransform: 'uppercase', fontWeight: 900 }}>
              CHANGE
            </button>
          </div>
        )}
        <button
          onPointerDown={e => { e.preventDefault(); e.stopPropagation(); avatar ? setScreen('game') : setScreen('avatarselect'); }}
          style={{ width: '100%', background: 'linear-gradient(180deg,#ff4444,#cc0000)', border: 'none', borderRadius: 12, padding: 14, color: '#fff', fontSize: 16, fontWeight: 900, cursor: 'pointer', boxShadow: '0 5px 0 #880000', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
          ⚔️ PLAY SOLO
        </button>
        <button
          onPointerDown={e => { e.preventDefault(); e.stopPropagation(); avatar ? hostGame(avatar) : setScreen('avatarselect'); }}
          disabled={loading}
          style={{ width: '100%', background: 'linear-gradient(180deg,#4488ff,#2255cc)', border: 'none', borderRadius: 12, padding: 14, color: '#fff', fontSize: 15, fontWeight: 900, cursor: 'pointer', boxShadow: '0 5px 0 #113388', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
          {loading ? 'CREATING...' : '🏠 HOST MULTIPLAYER'}
        </button>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            maxLength={4}
            placeholder="CODE"
            style={{ flex: 1, background: '#111', border: '2px solid #333', borderRadius: 10, padding: '12px', color: '#fff', fontSize: 20, fontWeight: 900, textAlign: 'center', letterSpacing: 6, fontFamily: "'Arial Black',Arial,sans-serif" }}
          />
          <button
            onPointerDown={e => { e.preventDefault(); e.stopPropagation(); avatar ? joinGame(avatar) : setScreen('avatarselect'); }}
            disabled={loading}
            style={{ background: 'linear-gradient(180deg,#44cc44,#228822)', border: 'none', borderRadius: 10, padding: '0 16px', color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer', boxShadow: '0 4px 0 #116611', textTransform: 'uppercase' }}>
            JOIN
          </button>
        </div>
        <button
          onPointerDown={e => { e.preventDefault(); e.stopPropagation(); setScreen('howtoplay'); }}
          style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '2px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: 10, color: '#aaa', fontSize: 13, cursor: 'pointer', textTransform: 'uppercase', fontWeight: 900, marginBottom: 8 }}>
          📖 HOW TO PLAY
        </button>
        <button
          onPointerDown={e => { e.preventDefault(); e.stopPropagation(); onBack(); }}
          style={{ width: '100%', background: 'transparent', border: '1px solid #222', borderRadius: 8, padding: 8, color: '#444', fontSize: 11, cursor: 'pointer', textTransform: 'uppercase' }}>
          ← BACK TO GAMES
        </button>
        {error && <div style={{ color: '#ff4444', marginTop: 10, textAlign: 'center', fontSize: 13, fontWeight: 'bold' }}>{error}</div>}
      </div>
    </div>
  );
}
