// ============================================================
// GAMES.JS PATCH INSTRUCTIONS
// Apply these 4 changes to your Games.js file
// ============================================================

// ── PATCH 1: SNAKE — bigger canvas, bigger snake & beans ──
// FIND:
//   const W = 340, H = 580;
//   const CELL = 12;
// REPLACE WITH:
//   const W = 360, H = 640;
//   const CELL = 16;

// ── PATCH 2: TETRIS — move Rot+Drop buttons to TOP ──
// In the TetrisGame return(), FIND the entire bottom control row:
//   <div style={{display:'flex',gap:8,padding:'8px',background:'#08101e',borderTop:'1px solid #1e2a4a',flexShrink:0}}>
//     <button style={ctrlBtn} onPointerDown={e=>{e.preventDefault();move(-1);}}>&lt;</button>
//     <button style={ctrlBtn} onPointerDown={e=>{e.preventDefault();rot();}}>Rot</button>
//     <button style={ctrlBtn} onPointerDown={e=>{e.preventDefault();drop();}}>Drop</button>
//     <button style={ctrlBtn} onPointerDown={e=>{e.preventDefault();move(1);}}>&gt;</button>
//   </div>
// REPLACE WITH (splits into 2 rows — Rot+Drop on top, Left+Right on bottom):
//   <>
//     <div style={{display:'flex',gap:8,padding:'6px 8px 4px',background:'#08101e',borderTop:'1px solid #1e2a4a',flexShrink:0}}>
//       <button style={{...ctrlBtn,flex:1,padding:'10px 0',fontSize:18}} onPointerDown={e=>{e.preventDefault();rot();}}>↻ Rot</button>
//       <button style={{...ctrlBtn,flex:1,padding:'10px 0',fontSize:18}} onPointerDown={e=>{e.preventDefault();drop();}}>⬇ Drop</button>
//     </div>
//     <div style={{display:'flex',gap:8,padding:'4px 8px 8px',background:'#08101e',flexShrink:0}}>
//       <button style={ctrlBtn} onPointerDown={e=>{e.preventDefault();move(-1);}}>&lt;</button>
//       <div style={{flex:2}}/>
//       <button style={ctrlBtn} onPointerDown={e=>{e.preventDefault();move(1);}}>&gt;</button>
//     </div>
//   </>

// ── PATCH 3: RACING — wider button spacing ──
// FIND:
//   const btnStyle={background:'linear-gradient(180deg,#555,#333)',border:'2px solid #888',color:'#fff',padding:'18px 36px',borderRadius:14,fontSize:26,cursor:'pointer',userSelect:'none',WebkitUserSelect:'none',boxShadow:'0 4px 0 #111'};
// REPLACE WITH:
//   const btnStyle={background:'linear-gradient(180deg,#555,#333)',border:'2px solid #888',color:'#fff',padding:'20px 0',borderRadius:14,fontSize:26,cursor:'pointer',userSelect:'none',WebkitUserSelect:'none',boxShadow:'0 4px 0 #111',width:120,textAlign:'center'};

// AND FIND the button row:
//   <div style={{display:'flex',gap:20,padding:'8px 0',flexShrink:0}}>
// REPLACE WITH:
//   <div style={{display:'flex',gap:40,padding:'10px 24px',flexShrink:0,width:'100%',justifyContent:'center',boxSizing:'border-box'}}>

// ── PATCH 4: LEADERBOARD RESET ──
// The saveScore function already handles this — when a score entry is older
// than LEADERBOARD_RESET_DAYS (5 days), isExpired = true and it overwrites
// with the new score. The getLeaderboard function already filters out old scores.
// NO CODE CHANGE NEEDED — scores auto-reset after 5 days as designed.
// If you want IMMEDIATE manual reset, call this once from browser console:
//   getDocs(collection(db,'leaderboard')).then(s=>s.docs.forEach(d=>deleteDoc(d.ref)))
