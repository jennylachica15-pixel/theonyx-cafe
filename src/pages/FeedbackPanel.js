import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';

// ── SVG ICONS ────────────────────────────────────────────────────────────────
const IC = {
  trash: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>,
  trashLg: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c1121f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  star: (filled) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? '#d4a853' : 'none'} stroke={filled ? '#d4a853' : '#ddd'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  search: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  comment: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  coffee: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/></svg>,
  user: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};

function Stars({ value }) {
  return (
    <span style={{ display:'flex', gap:2 }}>
      {[1,2,3,4,5].map(s => (
        <span key={s}>{IC.star(s <= value)}</span>
      ))}
    </span>
  );
}

const s = {
  page:       { padding:'16px 16px 80px', fontFamily:"-apple-system,'Helvetica Neue',sans-serif" },
  title:      { fontSize:22, fontWeight:700, color:'var(--brown-dark)', marginBottom:4, fontFamily:'var(--font-display)' },
  sub:        { fontSize:13, color:'var(--brown-light)', marginBottom:16 },
  statGrid:   { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 },
  statBox:    { background:'white', borderRadius:12, padding:'12px', textAlign:'center', boxShadow:'0 1px 4px rgba(26,10,0,0.07)' },
  statNum:    (c) => ({ fontSize:22, fontWeight:700, color:c||'var(--brown-dark)', letterSpacing:'-0.5px' }),
  statLabel:  { fontSize:11, color:'var(--brown-light)', marginTop:2, textTransform:'uppercase', letterSpacing:'0.4px' },
  searchWrap: { position:'relative', marginBottom:10 },
  searchIcon: { position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' },
  searchInput:{ width:'100%', padding:'10px 14px 10px 36px', borderRadius:10, border:'1px solid #e0d0c0', fontSize:13, boxSizing:'border-box', outline:'none', background:'white', color:'#333', fontFamily:'inherit' },
  filterRow:  { display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' },
  filterBtn:  (a) => ({ padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:a?700:400, border:`1px solid ${a?'var(--brown-dark)':'#e0d0c0'}`, background:a?'var(--brown-dark)':'white', color:a?'var(--gold-light)':'var(--brown-light)', cursor:'pointer' }),
  card:       { background:'white', borderRadius:14, padding:'14px 16px', marginBottom:10, boxShadow:'0 1px 6px rgba(26,10,0,0.07)' },
  cardHeader: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 },
  name:       { fontSize:14, fontWeight:700, color:'var(--brown-dark)', display:'flex', alignItems:'center', gap:5 },
  date:       { fontSize:11, color:'var(--brown-light)' },
  ratingRow:  { display:'flex', gap:14, flexWrap:'wrap', marginBottom:6 },
  ratingItem: { display:'flex', flexDirection:'column', alignItems:'center', gap:2 },
  ratingLabel:{ fontSize:10, color:'var(--brown-light)', marginTop:1 },
  comment:    { fontSize:13, color:'#444', fontStyle:'italic', margin:'8px 0 4px', lineHeight:1.5, background:'#fffaf4', borderRadius:8, padding:'8px 10px', borderLeft:'3px solid #d4a853', display:'flex', gap:7 },
  drinkCmt:   { fontSize:12, color:'#666', fontStyle:'italic', margin:'4px 0', background:'#f5f5f5', borderRadius:6, padding:'6px 10px', display:'flex', gap:6, alignItems:'flex-start' },
  orders:     { fontSize:11, color:'var(--brown-light)', marginTop:6 },
  subRatings: { display:'flex', gap:10, marginTop:6, flexWrap:'wrap' },
  subRating:  { fontSize:11, color:'var(--brown-light)', background:'#faf5ef', padding:'2px 8px', borderRadius:10 },
  delBtn:     { padding:'6px 12px', borderRadius:8, background:'#fff0f0', border:'1px solid #ffcccc', color:'#c1121f', fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:5 },
  empty:      { textAlign:'center', padding:'40px 20px', color:'var(--brown-light)', fontSize:14 },
  overlay:    { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:24 },
  dialog:     { background:'white', borderRadius:16, padding:24, width:'100%', maxWidth:320, textAlign:'center' },
};

export default function FeedbackPanel({ role }) {
  const [feedbacks,      setFeedbacks]      = useState([]);
  const [filter,         setFilter]         = useState('all');
  const [search,         setSearch]         = useState('');
  const [confirmDelete,  setConfirmDelete]  = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db,'feedbacks'), orderBy('createdAt','desc')),
      snap => setFeedbacks(snap.docs.map(d => ({ id:d.id, ...d.data() })))
    );
    return () => unsub();
  }, []);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteDoc(doc(db,'feedbacks',confirmDelete));
    setConfirmDelete(null);
  };

  const avg = (key) => {
    const vals = feedbacks.map(f => Number(f[key])).filter(v => v > 0);
    return vals.length ? (vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(1) : 'N/A';
  };

  const withComments = feedbacks.filter(f => f.overallComment || f.drinkComment);

  const filtered = feedbacks.filter(f => {
    if (filter==='comments'    && !f.overallComment && !f.drinkComment) return false;
    if (filter==='no-comments' &&  (f.overallComment || f.drinkComment)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!f.customerName?.toLowerCase().includes(q) &&
          !f.overallComment?.toLowerCase().includes(q) &&
          !f.drinkComment?.toLowerCase().includes(q) &&
          !(f.orders||[]).join(' ').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const formatDate = (ts) => {
    if (!ts?.toDate) return '';
    return ts.toDate().toLocaleDateString('en-PH',{ month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' });
  };

  return (
    <div style={s.page}>
      <div style={s.title}>Customer Feedback</div>
      <div style={s.sub}>All responses & comments</div>

      {/* Stats */}
      <div style={s.statGrid}>
        <div style={s.statBox}><div style={s.statNum('var(--gold)')}>{feedbacks.length}</div><div style={s.statLabel}>Total Responses</div></div>
        <div style={s.statBox}><div style={s.statNum()}>{withComments.length}</div><div style={s.statLabel}>With Comments</div></div>
        <div style={s.statBox}>
          <div style={{ ...s.statNum(), display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
            {avg('staffRating')}
            {IC.star(true)}
          </div>
          <div style={s.statLabel}>Avg Staff</div>
        </div>
        <div style={s.statBox}>
          <div style={{ ...s.statNum(), display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
            {avg('placeRating')}
            {IC.star(true)}
          </div>
          <div style={s.statLabel}>Avg Place</div>
        </div>
        <div style={s.statBox}>
          <div style={{ ...s.statNum(), display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
            {avg('drinkOverall')}
            {IC.star(true)}
          </div>
          <div style={s.statLabel}>Avg Drink</div>
        </div>
        <div style={s.statBox}>
          <div style={s.statNum('var(--brown-mid)')}>
            {feedbacks.length > 0 ? ((withComments.length/feedbacks.length)*100).toFixed(0) : 0}%
          </div>
          <div style={s.statLabel}>Comment Rate</div>
        </div>
      </div>

      {/* Search */}
      <div style={s.searchWrap}>
        <span style={s.searchIcon}>{IC.search}</span>
        <input
          style={s.searchInput}
          placeholder="Search by name, comment, or order..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filters */}
      <div style={s.filterRow}>
        {[['all','All'],['comments','With Comments'],['no-comments','Ratings Only']].map(([val,label]) => (
          <button key={val} style={s.filterBtn(filter===val)} onClick={() => setFilter(val)}>{label}</button>
        ))}
      </div>

      <div style={{ fontSize:12, color:'var(--brown-light)', marginBottom:10 }}>
        Showing {filtered.length} of {feedbacks.length} responses
      </div>

      {filtered.length === 0 && (
        <div style={s.empty}>
          {feedbacks.length === 0 ? 'No feedback yet.' : 'No results match your filter.'}
        </div>
      )}

      {/* Feedback cards */}
      {filtered.map(f => (
        <div key={f.id} style={s.card}>
          <div style={s.cardHeader}>
            <div style={s.name}>
              {IC.user}
              {f.customerName || 'Anonymous'}
            </div>
            <div style={s.date}>{formatDate(f.createdAt)}</div>
          </div>

          {/* Ratings */}
          <div style={s.ratingRow}>
            {f.staffRating > 0 && (
              <div style={s.ratingItem}>
                <Stars value={f.staffRating}/>
                <span style={s.ratingLabel}>Staff</span>
              </div>
            )}
            {f.placeRating > 0 && (
              <div style={s.ratingItem}>
                <Stars value={f.placeRating}/>
                <span style={s.ratingLabel}>Place</span>
              </div>
            )}
            {f.drinkOverall > 0 && (
              <div style={s.ratingItem}>
                <Stars value={f.drinkOverall}/>
                <span style={s.ratingLabel}>Drink</span>
              </div>
            )}
          </div>

          {/* Overall comment */}
          {f.overallComment && (
            <div style={s.comment}>
              {IC.comment}
              <span>"{f.overallComment}"</span>
            </div>
          )}

          {/* Drink comment */}
          {f.drinkComment && (
            <div style={s.drinkCmt}>
              {IC.coffee}
              <span>Re drink: "{f.drinkComment}"</span>
            </div>
          )}

          {/* Orders */}
          {f.orders?.length > 0 && (
            <div style={s.orders}>
              Ordered: {f.orders.slice(0,4).join(', ')}{f.orders.length > 4 ? ` +${f.orders.length-4} more` : ''}
            </div>
          )}

          {/* Drink sub-ratings */}
          {(f.drinkSweetness > 0 || f.drinkBitterness > 0 || f.drinkCreaminess > 0) && (
            <div style={s.subRatings}>
              {f.drinkSweetness  > 0 && <span style={s.subRating}>Sweet {f.drinkSweetness}/5</span>}
              {f.drinkBitterness > 0 && <span style={s.subRating}>Bitter {f.drinkBitterness}/5</span>}
              {f.drinkCreaminess > 0 && <span style={s.subRating}>Cream {f.drinkCreaminess}/5</span>}
            </div>
          )}

          {/* Delete — manager only */}
          {role === 'manager' && (
            <div style={{ marginTop:10, display:'flex', justifyContent:'flex-end' }}>
              <button style={s.delBtn} onClick={() => setConfirmDelete(f.id)}>
                {IC.trash} Delete
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Delete confirm dialog */}
      {confirmDelete && (
        <div style={s.overlay}>
          <div style={s.dialog}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}>
              {IC.trashLg}
            </div>
            <div style={{ fontSize:16, fontWeight:700, color:'#1a0a00', marginBottom:6 }}>Delete Feedback?</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:20 }}>This cannot be undone.</div>
            <div style={{ display:'flex', gap:10 }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ flex:1, padding:'11px', borderRadius:10, background:'#f5ede4', border:'none', color:'#6b3a1f', fontWeight:700, fontSize:14, cursor:'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleDelete}
                style={{ flex:1, padding:'11px', borderRadius:10, background:'#c1121f', border:'none', color:'white', fontWeight:700, fontSize:14, cursor:'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
