import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── THEME ───────────────────────────────────────────────────────────────────
const T = {
  bg: '#1a0f00',
  card: '#2c1a00',
  cardLight: '#3d2500',
  gold: '#c8943a',
  goldLight: '#e8b85a',
  cream: '#f5e6c8',
  brown: '#6b3d11',
  text: '#f0d9b5',
  dim: '#8a6a3a',
  danger: '#e05c2a',
  success: '#5a9a3a',
};

const styles = {
  container: {
    minHeight: '100vh',
    background: `linear-gradient(160deg, #1a0f00 0%, #2c1400 50%, #1a0a00 100%)`,
    color: T.text,
    fontFamily: "'Georgia', serif",
    paddingBottom: 80,
  },
  header: {
    textAlign: 'center',
    padding: '24px 16px 8px',
    background: `linear-gradient(180deg, #0d0700 0%, transparent 100%)`,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: T.gold,
    letterSpacing: 3,
    textTransform: 'uppercase',
    margin: 0,
  },
  subtitle: {
    fontSize: 12,
    color: T.dim,
    letterSpacing: 2,
    marginTop: 4,
  },
  gameGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    padding: '16px',
  },
  gameCard: (active) => ({
    background: active ? T.cardLight : T.card,
    border: `2px solid ${active ? T.gold : T.brown}`,
    borderRadius: 16,
    padding: '20px 12px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    transform: active ? 'scale(1.03)' : 'scale(1)',
  }),
  gameIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  gameName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: T.gold,
    letterSpacing: 1,
  },
  gameDesc: {
    fontSize: 10,
    color: T.dim,
    marginTop: 4,
  },
  gameArea: {
    margin: '0 16px',
    background: T.card,
    borderRadius: 20,
    border: `2px solid ${T.brown}`,
    overflow: 'hidden',
  },
  gameHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: T.cardLight,
    borderBottom: `1px solid ${T.brown}`,
  },
  score: {
    fontSize: 13,
    color: T.gold,
    fontWeight: 'bold',
  },
  btn: (color = T.gold) => ({
    background: color,
    color: '#1a0f00',
    border: 'none',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 'bold',
    cursor: 'pointer',
    letterSpacing: 1,
  }),
  canvas: {
    display: 'block',
    margin: '0 auto',
  },
};

// ═══════════════════════════════════════════════════════════════════
// SNAKE GAME
// ═══════════════════════════════════════════════════════════════════
function SnakeGame() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState('idle'); // idle, playing, dead
  const [highScore, setHighScore] = useState(0);

  const CELL = 20;
  const COLS = 16;
  const ROWS = 22;
  const W = CELL * COLS;
  const H = CELL * ROWS;

  const initGame = useCallback(() => {
    return {
      snake: [{ x: 8, y: 11 }, { x: 7, y: 11 }, { x: 6, y: 11 }],
      dir: { x: 1, y: 0 },
      nextDir: { x: 1, y: 0 },
      food: { x: 12, y: 11 },
      score: 0,
      running: true,
    };
  }, []);

  const placeFood = (snake) => {
    let pos;
    do {
      pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (snake.some(s => s.x === pos.x && s.y === pos.y));
    return pos;
  };

  const draw = useCallback((g) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#0d0700';
    ctx.fillRect(0, 0, W, H);

    // Grid dots
    ctx.fillStyle = '#2c1a0088';
    for (let x = 0; x < COLS; x++)
      for (let y = 0; y < ROWS; y++)
        ctx.fillRect(x * CELL + CELL / 2 - 1, y * CELL + CELL / 2 - 1, 2, 2);

    // Food (coffee bean)
    ctx.fillStyle = T.gold;
    ctx.beginPath();
    ctx.arc(g.food.x * CELL + CELL / 2, g.food.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a0f00';
    ctx.beginPath();
    ctx.ellipse(g.food.x * CELL + CELL / 2, g.food.y * CELL + CELL / 2, 2, CELL / 2 - 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Snake
    g.snake.forEach((seg, i) => {
      const ratio = 1 - i / g.snake.length;
      const r = Math.round(200 * ratio + 60);
      const gb = Math.round(80 * ratio + 20);
      ctx.fillStyle = `rgb(${r},${gb},${gb})`;
      const pad = i === 0 ? 1 : 3;
      ctx.beginPath();
      ctx.roundRect(seg.x * CELL + pad, seg.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, 4);
      ctx.fill();
    });

    // Eyes on head
    const head = g.snake[0];
    ctx.fillStyle = '#fff';
    const ex = head.x * CELL + CELL / 2 + g.dir.y * 3;
    const ey = head.y * CELL + CELL / 2 + g.dir.x * 3;
    ctx.beginPath();
    ctx.arc(ex - g.dir.x * 4, ey - g.dir.y * 4, 2.5, 0, Math.PI * 2);
    ctx.arc(ex + g.dir.x * 4, ey + g.dir.y * 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }, [W, H, CELL, COLS, ROWS]);

  const startGame = () => {
    const g = initGame();
    gameRef.current = g;
    setScore(0);
    setGameState('playing');
  };

  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = setInterval(() => {
      const g = gameRef.current;
      if (!g || !g.running) return;

      g.dir = { ...g.nextDir };
      const head = { x: g.snake[0].x + g.dir.x, y: g.snake[0].y + g.dir.y };

      // Wall collision
      if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
        g.running = false;
        setGameState('dead');
        setHighScore(h => Math.max(h, g.score));
        return;
      }
      // Self collision
      if (g.snake.some(s => s.x === head.x && s.y === head.y)) {
        g.running = false;
        setGameState('dead');
        setHighScore(h => Math.max(h, g.score));
        return;
      }

      g.snake.unshift(head);
      if (head.x === g.food.x && head.y === g.food.y) {
        g.score += 10;
        setScore(g.score);
        g.food = placeFood(g.snake);
      } else {
        g.snake.pop();
      }

      draw(g);
    }, 140);
    return () => clearInterval(interval);
  }, [gameState, draw, COLS, ROWS]);

  useEffect(() => {
    if (gameState === 'playing') draw(gameRef.current);
    if (gameState === 'idle' || gameState === 'dead') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0d0700';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = T.gold;
      ctx.font = 'bold 28px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText(gameState === 'dead' ? '☠ GAME OVER' : '🐍 SNAKE', W / 2, H / 2 - 20);
      ctx.font = '14px Georgia';
      ctx.fillStyle = T.dim;
      ctx.fillText(gameState === 'dead' ? `Score: ${score}` : 'Collect the coffee beans!', W / 2, H / 2 + 16);
    }
  }, [gameState, score, W, H]);

  const handleTouch = (dir) => {
    const g = gameRef.current;
    if (!g) return;
    const d = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[dir];
    if (d.x !== -g.dir.x && d.y !== -g.dir.y) g.nextDir = d;
  };

  useEffect(() => {
    const onKey = (e) => {
      const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
      if (map[e.key]) { e.preventDefault(); handleTouch(map[e.key]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div>
      <div style={styles.gameHeader}>
        <span style={styles.score}>Score: {score}</span>
        <span style={{ ...styles.score, color: T.dim }}>Best: {highScore}</span>
        <button style={styles.btn()} onClick={startGame}>
          {gameState === 'idle' ? 'START' : 'RESTART'}
        </button>
      </div>
      <canvas ref={canvasRef} width={W} height={H} style={{ ...styles.canvas, maxWidth: '100%' }} />
      {gameState === 'playing' && (
        <div style={{ padding: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, maxWidth: 200, margin: '0 auto' }}>
            <div />
            <button style={{ ...styles.btn(T.cardLight), border: `1px solid ${T.brown}`, color: T.gold, padding: '14px 0', fontSize: 18 }} onClick={() => handleTouch('up')}>▲</button>
            <div />
            <button style={{ ...styles.btn(T.cardLight), border: `1px solid ${T.brown}`, color: T.gold, padding: '14px 0', fontSize: 18 }} onClick={() => handleTouch('left')}>◀</button>
            <button style={{ ...styles.btn(T.cardLight), border: `1px solid ${T.brown}`, color: T.gold, padding: '14px 0', fontSize: 18 }} onClick={() => handleTouch('down')}>▼</button>
            <button style={{ ...styles.btn(T.cardLight), border: `1px solid ${T.brown}`, color: T.gold, padding: '14px 0', fontSize: 18 }} onClick={() => handleTouch('right')}>▶</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MARIO RUNNER
// ═══════════════════════════════════════════════════════════════════
function MarioGame() {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState('idle');
  const [highScore, setHighScore] = useState(0);

  const W = 320, H = 280;
  const GROUND = H - 50;

  const initState = () => ({
    player: { x: 60, y: GROUND - 40, vy: 0, w: 28, h: 40, onGround: true, frame: 0 },
    obstacles: [],
    clouds: [{ x: 50, y: 40, w: 60 }, { x: 180, y: 25, w: 80 }, { x: 270, y: 55, w: 50 }],
    speed: 3,
    score: 0,
    frame: 0,
    spawnTimer: 80,
    running: true,
  });

  const jump = () => {
    const s = stateRef.current;
    if (!s || !s.running) return;
    if (s.player.onGround) {
      s.player.vy = -14;
      s.player.onGround = false;
    }
  };

  const startGame = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    stateRef.current = initState();
    setScore(0);
    setGameState('playing');
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    const loop = () => {
      const s = stateRef.current;
      if (!s || !s.running) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      s.frame++;
      s.score += 0.05;
      s.speed = 3 + s.score * 0.015;
      setScore(Math.floor(s.score));

      // Physics
      s.player.vy += 0.7;
      s.player.y += s.player.vy;
      if (s.player.y >= GROUND - s.player.h) {
        s.player.y = GROUND - s.player.h;
        s.player.vy = 0;
        s.player.onGround = true;
      }
      if (s.frame % 8 === 0 && s.player.onGround) s.player.frame = (s.player.frame + 1) % 2;

      // Obstacles
      s.spawnTimer--;
      if (s.spawnTimer <= 0) {
        const h = 30 + Math.random() * 30;
        s.obstacles.push({ x: W, y: GROUND - h, w: 20 + Math.random() * 15, h });
        s.spawnTimer = 60 + Math.random() * 60;
      }
      s.obstacles.forEach(o => o.x -= s.speed);
      s.obstacles = s.obstacles.filter(o => o.x > -50);

      // Clouds
      s.clouds.forEach(c => { c.x -= 0.5; if (c.x < -100) c.x = W + 50; });

      // Collision
      const p = s.player;
      for (const o of s.obstacles) {
        if (p.x + p.w - 6 > o.x + 4 && p.x + 4 < o.x + o.w - 4 && p.y + p.h - 4 > o.y + 4 && p.y + 4 < o.y + o.h) {
          s.running = false;
          setGameState('dead');
          setHighScore(h => Math.max(h, Math.floor(s.score)));
          return;
        }
      }

      // Draw
      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
      sky.addColorStop(0, '#1a0f30');
      sky.addColorStop(1, '#2c1a10');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // Stars
      ctx.fillStyle = '#ffffff44';
      for (let i = 0; i < 20; i++) {
        const sx = (i * 137 + s.frame * 0.1) % W;
        const sy = (i * 53) % (GROUND - 20);
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      // Clouds
      s.clouds.forEach(c => {
        ctx.fillStyle = '#3d2500aa';
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.w / 2, 14, 0, 0, Math.PI * 2);
        ctx.ellipse(c.x - 15, c.y + 6, c.w / 3, 10, 0, 0, Math.PI * 2);
        ctx.ellipse(c.x + 15, c.y + 6, c.w / 3, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      });

      // Ground
      ctx.fillStyle = '#3d1f00';
      ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = T.gold;
      ctx.fillRect(0, GROUND, W, 3);
      // Ground pattern
      ctx.fillStyle = '#4a2800';
      for (let gx = (s.frame * s.speed * 0.3) % 40; gx < W; gx += 40)
        ctx.fillRect(gx, GROUND + 6, 20, 2);

      // Obstacles (coffee cups)
      s.obstacles.forEach(o => {
        ctx.fillStyle = T.brown;
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = T.gold;
        ctx.fillRect(o.x + 2, o.y + 2, o.w - 4, 6);
        ctx.fillStyle = T.cardLight;
        ctx.fillRect(o.x + 2, o.y + 10, o.w - 4, o.h - 12);
        // Cup handle
        ctx.strokeStyle = T.brown;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(o.x + o.w + 4, o.y + o.h / 2, 6, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
      });

      // Player (barista character)
      const px = p.x, py = p.y;
      // Body
      ctx.fillStyle = '#c8943a';
      ctx.fillRect(px + 4, py + 14, 20, 20);
      // Head
      ctx.fillStyle = '#e8b85a';
      ctx.beginPath();
      ctx.ellipse(px + 14, py + 10, 12, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#1a0f00';
      ctx.beginPath();
      ctx.arc(px + 10, py + 9, 2, 0, Math.PI * 2);
      ctx.arc(px + 18, py + 9, 2, 0, Math.PI * 2);
      ctx.fill();
      // Apron
      ctx.fillStyle = '#f5e6c8';
      ctx.fillRect(px + 6, py + 16, 16, 14);
      // Legs (animated)
      ctx.fillStyle = '#6b3d11';
      if (p.onGround) {
        if (p.frame === 0) {
          ctx.fillRect(px + 5, py + 34, 8, 10);
          ctx.fillRect(px + 15, py + 34, 8, 10);
        } else {
          ctx.fillRect(px + 3, py + 33, 8, 11);
          ctx.fillRect(px + 17, py + 35, 8, 9);
        }
      } else {
        ctx.fillRect(px + 4, py + 34, 8, 10);
        ctx.fillRect(px + 16, py + 34, 8, 10);
      }
      // Hat
      ctx.fillStyle = '#1a0f00';
      ctx.fillRect(px + 5, py + 1, 18, 5);
      ctx.fillRect(px + 8, py - 8, 12, 10);

      // Score
      ctx.fillStyle = T.gold;
      ctx.font = 'bold 14px Georgia';
      ctx.textAlign = 'left';
      ctx.fillText(`☕ ${Math.floor(s.score)}`, 10, 24);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [gameState, GROUND]);

  useEffect(() => {
    if (gameState !== 'idle' && gameState !== 'dead') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1a0f30');
    sky.addColorStop(1, '#2c1a10');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#3d1f00';
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = T.gold;
    ctx.font = 'bold 24px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText(gameState === 'dead' ? '☠ GAME OVER' : '🍄 CAFÉ RUNNER', W / 2, H / 2 - 15);
    ctx.font = '13px Georgia';
    ctx.fillStyle = T.dim;
    ctx.fillText(gameState === 'dead' ? `Score: ${score}` : 'Jump over the coffee cups!', W / 2, H / 2 + 14);
  }, [gameState, score, GROUND]);

  useEffect(() => {
    const onKey = (e) => { if (e.code === 'Space' || e.key === 'ArrowUp') { e.preventDefault(); jump(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div>
      <div style={styles.gameHeader}>
        <span style={styles.score}>Score: {score}</span>
        <span style={{ ...styles.score, color: T.dim }}>Best: {highScore}</span>
        <button style={styles.btn()} onClick={startGame}>{gameState === 'idle' ? 'START' : 'RESTART'}</button>
      </div>
      <canvas ref={canvasRef} width={W} height={H} style={{ ...styles.canvas, maxWidth: '100%', cursor: 'pointer' }}
        onClick={gameState === 'playing' ? jump : startGame} />
      {gameState === 'playing' && (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <button style={{ ...styles.btn(T.brown), border: `1px solid ${T.gold}`, fontSize: 22, padding: '12px 48px' }} onClick={jump}>JUMP ↑</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TETRIS
// ═══════════════════════════════════════════════════════════════════
function TetrisGame() {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const timerRef = useRef(null);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [gameState, setGameState] = useState('idle');
  const [highScore, setHighScore] = useState(0);

  const COLS = 10, ROWS = 20, CELL = 22;
  const W = COLS * CELL, H = ROWS * CELL;

  const PIECES = [
    { shape: [[1,1,1,1]], color: T.gold },
    { shape: [[1,1],[1,1]], color: '#c8501a' },
    { shape: [[1,1,1],[0,1,0]], color: '#8a3a9a' },
    { shape: [[1,1,1],[1,0,0]], color: T.danger },
    { shape: [[1,1,1],[0,0,1]], color: '#3a7ac8' },
    { shape: [[1,1,0],[0,1,1]], color: T.success },
    { shape: [[0,1,1],[1,1,0]], color: '#c83a6a' },
  ];

  const emptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  const randomPiece = () => {
    const p = PIECES[Math.floor(Math.random() * PIECES.length)];
    return { shape: p.shape, color: p.color, x: Math.floor(COLS / 2) - Math.floor(p.shape[0].length / 2), y: 0 };
  };

  const rotate = (shape) => shape[0].map((_, i) => shape.map(row => row[i]).reverse());

  const valid = (board, piece, dx = 0, dy = 0, shape = null) => {
    const s = shape || piece.shape;
    for (let r = 0; r < s.length; r++)
      for (let c = 0; c < s[r].length; c++)
        if (s[r][c]) {
          const nx = piece.x + c + dx, ny = piece.y + r + dy;
          if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
          if (ny >= 0 && board[ny][nx]) return false;
        }
    return true;
  };

  const drawBoard = (ctx, board, piece, ghost) => {
    ctx.fillStyle = '#0d0700';
    ctx.fillRect(0, 0, W, H);
    // Grid
    ctx.strokeStyle = '#2c1a0033';
    ctx.lineWidth = 0.5;
    for (let r = 0; r < ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL); ctx.stroke(); }
    for (let c = 0; c < COLS; c++) { ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, H); ctx.stroke(); }

    const drawCell = (x, y, color, alpha = 1) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x * CELL + 1, y * CELL + CELL - 5, CELL - 2, 4);
      ctx.globalAlpha = 1;
    };

    board.forEach((row, r) => row.forEach((cell, c) => { if (cell) drawCell(c, r, cell); }));

    // Ghost
    if (ghost && piece) {
      piece.shape.forEach((row, r) => row.forEach((cell, c) => {
        if (cell && ghost.y + r >= 0) drawCell(piece.x + c, ghost.y + r, piece.color, 0.2);
      }));
    }

    // Active piece
    if (piece) {
      piece.shape.forEach((row, r) => row.forEach((cell, c) => {
        if (cell && piece.y + r >= 0) drawCell(piece.x + c, piece.y + r, piece.color);
      }));
    }
  };

  const startGame = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const s = { board: emptyBoard(), piece: randomPiece(), next: randomPiece(), score: 0, lines: 0, speed: 500, running: true };
    stateRef.current = s;
    setScore(0); setLines(0); setGameState('playing');
  };

  const moveDown = useCallback(() => {
    const s = stateRef.current;
    if (!s || !s.running) return;
    if (valid(s.board, s.piece, 0, 1)) {
      s.piece.y++;
    } else {
      // Lock
      s.piece.shape.forEach((row, r) => row.forEach((cell, c) => {
        if (cell && s.piece.y + r >= 0) s.board[s.piece.y + r][s.piece.x + c] = s.piece.color;
      }));
      // Clear lines
      let cleared = 0;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (s.board[r].every(c => c)) { s.board.splice(r, 1); s.board.unshift(Array(COLS).fill(null)); cleared++; r++; }
      }
      s.lines += cleared;
      s.score += [0, 100, 300, 500, 800][cleared] || 0;
      s.score += 10;
      setScore(s.score); setLines(s.lines);
      s.speed = Math.max(100, 500 - Math.floor(s.lines / 5) * 40);
      s.piece = s.next;
      s.next = randomPiece();
      if (!valid(s.board, s.piece)) {
        s.running = false;
        setGameState('dead');
        setHighScore(h => Math.max(h, s.score));
      }
    }
    // Ghost
    let gy = s.piece.y;
    while (valid(s.board, { ...s.piece, y: gy + 1 })) gy++;
    const ghost = { y: gy };
    const canvas = canvasRef.current;
    if (canvas) drawBoard(canvas.getContext('2d'), s.board, s.piece, ghost);
  }, [ROWS, COLS]);

  useEffect(() => {
    if (gameState !== 'playing') return;
    const s = stateRef.current;
    timerRef.current = setInterval(moveDown, s?.speed || 500);
    return () => clearInterval(timerRef.current);
  }, [gameState, moveDown, score]);

  const move = (dx) => {
    const s = stateRef.current;
    if (!s || !s.running) return;
    if (valid(s.board, s.piece, dx, 0)) s.piece.x += dx;
    moveDown(); // redraw
  };

  const rotatePiece = () => {
    const s = stateRef.current;
    if (!s || !s.running) return;
    const rotated = rotate(s.piece.shape);
    if (valid(s.board, s.piece, 0, 0, rotated)) s.piece.shape = rotated;
    moveDown();
  };

  const hardDrop = () => {
    const s = stateRef.current;
    if (!s || !s.running) return;
    while (valid(s.board, s.piece, 0, 1)) s.piece.y++;
    moveDown();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (gameState !== 'playing') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
      if (e.key === 'ArrowDown') { e.preventDefault(); moveDown(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); rotatePiece(); }
      if (e.key === ' ') { e.preventDefault(); hardDrop(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameState, moveDown]);

  useEffect(() => {
    if (gameState !== 'idle' && gameState !== 'dead') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0d0700';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = T.gold;
    ctx.font = 'bold 22px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText(gameState === 'dead' ? '☠ GAME OVER' : '🟦 TETRIS', W / 2, H / 2 - 15);
    ctx.font = '12px Georgia';
    ctx.fillStyle = T.dim;
    ctx.fillText(gameState === 'dead' ? `Score: ${score}` : 'Stack the blocks!', W / 2, H / 2 + 14);
  }, [gameState, score, W, H]);

  return (
    <div>
      <div style={styles.gameHeader}>
        <div>
          <div style={styles.score}>Score: {score}</div>
          <div style={{ fontSize: 11, color: T.dim }}>Lines: {lines}</div>
        </div>
        <div style={{ ...styles.score, color: T.dim, fontSize: 11 }}>Best: {highScore}</div>
        <button style={styles.btn()} onClick={startGame}>{gameState === 'idle' ? 'START' : 'RESTART'}</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <canvas ref={canvasRef} width={W} height={H} style={styles.canvas} />
      </div>
      {gameState === 'playing' && (
        <div style={{ padding: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, maxWidth: 240, margin: '0 auto' }}>
            <button style={{ ...styles.btn(T.cardLight), border: `1px solid ${T.brown}`, color: T.gold, padding: '14px 0', fontSize: 16 }} onClick={() => move(-1)}>◀</button>
            <button style={{ ...styles.btn(T.cardLight), border: `1px solid ${T.brown}`, color: T.gold, padding: '14px 0', fontSize: 16 }} onClick={rotatePiece}>↻</button>
            <button style={{ ...styles.btn(T.cardLight), border: `1px solid ${T.brown}`, color: T.gold, padding: '14px 0', fontSize: 16 }} onClick={moveDown}>▼</button>
            <button style={{ ...styles.btn(T.cardLight), border: `1px solid ${T.brown}`, color: T.gold, padding: '14px 0', fontSize: 16 }} onClick={() => move(1)}>▶</button>
          </div>
          <div style={{ textAlign: 'center', marginTop: 6 }}>
            <button style={{ ...styles.btn(T.brown), border: `1px solid ${T.gold}`, padding: '10px 40px', fontSize: 13 }} onClick={hardDrop}>DROP ↓↓</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SPOT THE DIFFERENCE
// ═══════════════════════════════════════════════════════════════════
function SpotDiffGame() {
  const [found, setFound] = useState([]);
  const [wrong, setWrong] = useState(null);
  const [gameState, setGameState] = useState('playing');
  const [timeLeft, setTimeLeft] = useState(90);
  const [flash, setFlash] = useState(null);

  // Café scene differences (drawn as canvas art)
  const canvasA = useRef(null);
  const canvasB = useRef(null);

  const W = 300, H = 220;

  // Define 5 differences as regions in image B that differ
  const DIFFERENCES = [
    { id: 0, x: 220, y: 30, r: 18, label: 'Extra star' },
    { id: 1, x: 60, y: 100, r: 16, label: 'Missing cup' },
    { id: 2, x: 155, y: 145, r: 15, label: 'Different color' },
    { id: 3, x: 250, y: 140, r: 14, label: 'Extra plant' },
    { id: 4, x: 110, y: 55, r: 14, label: 'Clock time' },
  ];

  const drawScene = (ctx, isB, foundIds, flashId) => {
    // Background wall
    const wall = ctx.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, '#2c1a00');
    wall.addColorStop(1, '#1a0f00');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, H);

    // Floor
    ctx.fillStyle = '#3d2200';
    ctx.fillRect(0, H - 50, W, 50);
    ctx.fillStyle = '#4a2a00';
    for (let fx = 0; fx < W; fx += 40) {
      ctx.fillRect(fx, H - 50, 20, 50);
    }

    // Window
    ctx.fillStyle = '#1a3060';
    ctx.fillRect(30, 20, 80, 70);
    ctx.fillStyle = '#2a5090';
    ctx.fillRect(32, 22, 36, 66);
    ctx.fillStyle = '#3a70b0';
    ctx.fillRect(70, 22, 38, 66);
    ctx.strokeStyle = '#6b3d11';
    ctx.lineWidth = 4;
    ctx.strokeRect(30, 20, 80, 70);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(70, 20); ctx.lineTo(70, 90); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(30, 55); ctx.lineTo(110, 55); ctx.stroke();

    // Stars in window (difference 0: extra star in B)
    ctx.fillStyle = '#ffe080';
    [[45, 35], [80, 28], [95, 45], [55, 60], [85, 65]].forEach(([sx, sy]) => {
      ctx.beginPath(); ctx.arc(sx, sy, 2.5, 0, Math.PI * 2); ctx.fill();
    });
    if (isB) { // extra star
      ctx.fillStyle = '#ffe080';
      ctx.beginPath(); ctx.arc(220, 30, 5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#2c1a0088';
      ctx.beginPath(); ctx.arc(220, 30, 5, 0, Math.PI * 2); ctx.fill();
    }

    // Counter
    ctx.fillStyle = '#5c3010';
    ctx.fillRect(0, H - 85, W, 35);
    ctx.fillStyle = '#7a4020';
    ctx.fillRect(0, H - 88, W, 6);

    // Coffee machine
    ctx.fillStyle = '#8a5530';
    ctx.fillRect(170, H - 140, 50, 55);
    ctx.fillStyle = '#c8943a';
    ctx.fillRect(175, H - 135, 40, 20);
    ctx.fillStyle = '#1a0f00';
    ctx.beginPath(); ctx.arc(195, H - 125, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a6030';
    ctx.beginPath(); ctx.arc(195, H - 125, 5, 0, Math.PI * 2); ctx.fill();

    // Cup on counter (difference 1: missing in B)
    if (!isB) {
      ctx.fillStyle = '#f5e6c8';
      ctx.fillRect(52, H - 88, 16, 20);
      ctx.fillStyle = '#c8943a';
      ctx.fillRect(50, H - 90, 20, 4);
      ctx.strokeStyle = '#6b3d11'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(68, H - 80, 4, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    }

    // Menu board
    ctx.fillStyle = '#3d1f00';
    ctx.fillRect(130, 25, 60, 55);
    ctx.fillStyle = '#5a3010';
    ctx.fillRect(133, 28, 54, 49);
    ctx.fillStyle = T.gold;
    ctx.font = 'bold 8px Georgia';
    ctx.textAlign = 'left';
    ctx.fillText('MENU', 140, 40);
    ctx.fillStyle = T.cream;
    ctx.font = '6px Georgia';
    ctx.fillText('Latte   ₱150', 136, 52);
    ctx.fillText('Espresso ₱120', 136, 62);
    ctx.fillText('Matcha  ₱160', 136, 72);

    // Clock (difference 4: different time in B)
    ctx.fillStyle = '#f5e6c8';
    ctx.beginPath(); ctx.arc(110, 55, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3d1f00';
    ctx.beginPath(); ctx.arc(110, 55, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c8943a';
    ctx.beginPath(); ctx.arc(110, 55, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a0f00';
    ctx.beginPath(); ctx.arc(110, 55, 2, 0, Math.PI * 2); ctx.fill();
    // Hour hand
    ctx.strokeStyle = '#1a0f00'; ctx.lineWidth = 2;
    const hourAngle = isB ? -Math.PI / 6 : Math.PI / 3;
    ctx.beginPath(); ctx.moveTo(110, 55); ctx.lineTo(110 + Math.cos(hourAngle) * 8, 55 + Math.sin(hourAngle) * 8); ctx.stroke();
    // Minute hand
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(110, 55); ctx.lineTo(110 + Math.cos(-Math.PI / 2) * 12, 55 + Math.sin(-Math.PI / 2) * 12); ctx.stroke();

    // Table
    ctx.fillStyle = '#6b3d11';
    ctx.fillRect(20, H - 55, 90, 8);
    ctx.fillRect(30, H - 52, 10, 8);
    ctx.fillRect(90, H - 52, 10, 8);

    // Flower pot on table (difference 3: extra plant in B)
    ctx.fillStyle = '#8a3010';
    ctx.fillRect(240, H - 95, 20, 12);
    ctx.fillStyle = '#5a8030';
    ctx.beginPath(); ctx.arc(250, H - 100, 12, 0, Math.PI * 2); ctx.fill();
    if (isB) { // extra leaf
      ctx.fillStyle = '#4a7025';
      ctx.beginPath(); ctx.ellipse(268, H - 102, 10, 5, Math.PI / 4, 0, Math.PI * 2); ctx.fill();
    }

    // Chalkboard sign (difference 2: color in B)
    ctx.fillStyle = isB ? '#8a3030' : '#2a5020';
    ctx.fillRect(145, H - 80, 30, 22);
    ctx.strokeStyle = '#6b3d11'; ctx.lineWidth = 2;
    ctx.strokeRect(145, H - 80, 30, 22);
    ctx.fillStyle = '#f5e6c8';
    ctx.font = 'bold 7px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText('OPEN', 160, H - 68);
    ctx.fillText('10-11', 160, H - 60);

    // Highlight found differences
    if (foundIds && foundIds.length > 0) {
      foundIds.forEach(id => {
        const d = DIFFERENCES[id];
        ctx.strokeStyle = T.success;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 2]);
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 4, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // Flash wrong tap
    if (flash && flash.canvas === (isB ? 'b' : 'a')) {
      ctx.strokeStyle = T.danger;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(flash.x, flash.y, 14, 0, Math.PI * 2); ctx.stroke();
    }
  };

  const redraw = useCallback(() => {
    const a = canvasA.current, b = canvasB.current;
    if (a && b) {
      drawScene(a.getContext('2d'), false, found, flash);
      drawScene(b.getContext('2d'), true, found, flash);
    }
  }, [found, flash]);

  useEffect(() => { redraw(); }, [redraw]);

  useEffect(() => {
    if (gameState !== 'playing') return;
    const t = setInterval(() => {
      setTimeLeft(tl => {
        if (tl <= 1) { setGameState('timeout'); return 0; }
        return tl - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [gameState]);

  const handleClick = (e, isB) => {
    if (gameState !== 'playing') return;
    const canvas = isB ? canvasB.current : canvasA.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Check if clicked near a difference
    for (const d of DIFFERENCES) {
      if (found.includes(d.id)) continue;
      const dist = Math.sqrt((x - d.x) ** 2 + (y - d.y) ** 2);
      if (dist < d.r + 8) {
        const newFound = [...found, d.id];
        setFound(newFound);
        if (newFound.length === DIFFERENCES.length) setGameState('won');
        return;
      }
    }
    // Wrong click
    setFlash({ x, y, canvas: isB ? 'b' : 'a' });
    setTimeout(() => setFlash(null), 600);
  };

  const restart = () => { setFound([]); setTimeLeft(90); setGameState('playing'); setFlash(null); };

  return (
    <div>
      <div style={styles.gameHeader}>
        <span style={styles.score}>Found: {found.length}/{DIFFERENCES.length}</span>
        <span style={{ ...styles.score, color: timeLeft < 20 ? T.danger : T.dim }}>⏱ {timeLeft}s</span>
        <button style={styles.btn()} onClick={restart}>RESTART</button>
      </div>
      {(gameState === 'won' || gameState === 'timeout') && (
        <div style={{ textAlign: 'center', padding: '12px', background: gameState === 'won' ? '#1a3010' : '#3a1000', borderBottom: `1px solid ${T.brown}` }}>
          <span style={{ color: gameState === 'won' ? T.success : T.danger, fontWeight: 'bold' }}>
            {gameState === 'won' ? '🎉 You found all differences!' : `⏰ Time up! Found ${found.length}/5`}
          </span>
        </div>
      )}
      <div style={{ padding: '8px 12px' }}>
        <p style={{ textAlign: 'center', fontSize: 11, color: T.dim, margin: '0 0 8px' }}>Find 5 differences between the two café scenes!</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <div>
            <p style={{ textAlign: 'center', fontSize: 10, color: T.dim, margin: '0 0 4px' }}>Original</p>
            <canvas ref={canvasA} width={W} height={H} style={{ maxWidth: '100%', borderRadius: 8, border: `1px solid ${T.brown}`, cursor: 'crosshair' }} onClick={e => handleClick(e, false)} />
          </div>
          <div>
            <p style={{ textAlign: 'center', fontSize: 10, color: T.dim, margin: '0 0 4px' }}>Find the differences →</p>
            <canvas ref={canvasB} width={W} height={H} style={{ maxWidth: '100%', borderRadius: 8, border: `1px solid ${T.brown}`, cursor: 'crosshair' }} onClick={e => handleClick(e, true)} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {DIFFERENCES.map(d => (
            <span key={d.id} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: found.includes(d.id) ? T.success + '44' : T.cardLight, color: found.includes(d.id) ? T.success : T.dim, border: `1px solid ${found.includes(d.id) ? T.success : T.brown}` }}>
              {found.includes(d.id) ? '✓' : '?'} #{d.id + 1}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN GAMES PAGE
// ═══════════════════════════════════════════════════════════════════
const GAMES = [
  { id: 'snake', icon: '🐍', name: 'Snake', desc: 'Eat coffee beans!' },
  { id: 'mario', icon: '🏃', name: 'Café Runner', desc: 'Jump over cups!' },
  { id: 'tetris', icon: '🟦', name: 'Tetris', desc: 'Stack the blocks!' },
  { id: 'spot', icon: '🔍', name: 'Spot the Diff', desc: 'Find 5 differences!' },
];

export default function GamesPage() {
  const [active, setActive] = useState(null);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🎮 Arcade</h1>
        <p style={styles.subtitle}>THEONYX CAFE · GAMES CORNER</p>
      </div>

      <div style={styles.gameGrid}>
        {GAMES.map(g => (
          <div key={g.id} style={styles.gameCard(active === g.id)} onClick={() => setActive(active === g.id ? null : g.id)}>
            <div style={styles.gameIcon}>{g.icon}</div>
            <div style={styles.gameName}>{g.name}</div>
            <div style={styles.gameDesc}>{g.desc}</div>
          </div>
        ))}
      </div>

      {active && (
        <div style={styles.gameArea}>
          {active === 'snake' && <SnakeGame />}
          {active === 'mario' && <MarioGame />}
          {active === 'tetris' && <TetrisGame />}
          {active === 'spot' && <SpotDiffGame />}
        </div>
      )}

      {!active && (
        <div style={{ textAlign: 'center', padding: '24px 16px', color: T.dim, fontSize: 13 }}>
          Tap a game above to start playing ☕
        </div>
      )}
    </div>
  );
}
