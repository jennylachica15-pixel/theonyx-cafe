import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

function Stars({ value }) {
  return (
    <span style={{ letterSpacing: 1 }}>
      {[1,2,3,4,5].map(s => (
        <span key={s} style={{ color: s <= value ? '#d4a853' : '#ddd', fontSize: 13 }}>★</span>
      ))}
    </span>
  );
}

const s = {
  page: { padding: '16px 16px 80px' },
  title: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 4 },
  sub: { fontSize: 13, color: 'var(--brown-light)', marginBottom: 16 },
  statGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 },
  statBox: { background: 'white', borderRadius: 12, padding: '12px', textAlign: 'center', boxShadow: '0 1px 4px rgba(26,10,0,0.07)' },
  statNum: (color) => ({ fontSize: 22, fontWeight: 700, color: color || 'var(--brown-dark)' }),
  statLabel: { fontSize: 11, color: 'var(--brown-light)', marginTop: 2 },
  card: { background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 10, boxShadow: '0 1px 6px rgba(26,10,0,0.07)' },
  name: { fontSize: 14, fontWeight: 700, color: 'var(--brown-dark)' },
  date: { fontSize: 11, color: 'var(--brown-light)' },
  comment: { fontSize: 13, color: '#444', fontStyle: 'italic', margin: '8px 0 4px', lineHeight: 1.5, background: '#fffaf4', borderRadius: 8, padding: '8px 10px', borderLeft: '3px solid #d4a853' },
  drinkComment: { fontSize: 12, color: '#666', fontStyle: 'italic', margin: '4px 0', background: '#f5f5f5', borderRadius: 6, padding: '6px 10px' },
  orders: { fontSize: 11, color: 'var(--brown-light)', marginTop: 6 },
  ratingRow: { display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 },
  ratingItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  ratingLabel: { fontSize: 10, color: 'var(--brown-light)' },
  filterRow: { display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' },
  filterBtn: (active) => ({ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 400, border: `1px solid ${active ? 'var(--brown-dark)' : '#e0d0c0'}`, background: active ? 'var(--brown-dark)' : 'white', color: active ? 'var(--gold-light)' : 'var(--brown-light)', cursor: 'pointer' }),
  empty: { textAlign: 'center', padding: '40px 20px', color: 'var(--brown-light)', fontSize: 14 },
};

export default function FeedbackPanel() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'feedbacks'), orderBy('createdAt', 'desc')),
      snap => setFeedbacks(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, []);

  const avg = (key) => {
    const vals = feedbacks.map(f => Number(f[key])).filter(v => v > 0);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 'N/A';
  };

  const withComments = feedbacks.filter(f => f.overallComment || f.drinkComment);
  const withoutComments = feedbacks.filter(f => !f.overallComment && !f.drinkComment);

  const filtered = feedbacks.filter(f => {
    if (filter === 'comments' && !f.overallComment && !f.drinkComment) return false;
    if (filter === 'no-comments' && (f.overallComment || f.drinkComment)) return false;
    if (search && !f.customerName?.toLowerCase().includes(search.toLowerCase()) &&
        !f.overallComment?.toLowerCase().includes(search.toLowerCase()) &&
        !f.drinkComment?.toLowerCase().includes(search.toLowerCase()) &&
        !(f.orders || []).join(' ').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const formatDate = (ts) => {
    if (!ts?.toDate) return '';
    return ts.toDate().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={s.page}>
      <div style={s.title}>Customer Feedback</div>
      <div style={s.sub}>All responses & comments</div>

      {/* Summary stats */}
      <div style={s.statGrid}>
        <div style={s.statBox}><div style={s.statNum('var(--gold)')}>{feedbacks.length}</div><div style={s.statLabel}>Total Responses</div></div>
        <div style={s.statBox}><div style={s.statNum('var(--brown-dark)')}>{withComments.length}</div><div style={s.statLabel}>With Comments</div></div>
        <div style={s.statBox}><div style={s.statNum('var(--brown-dark)')}>{avg('staffRating')} ★</div><div style={s.statLabel}>Avg Staff</div></div>
        <div style={s.statBox}><div style={s.statNum('var(--brown-dark)')}>{avg('placeRating')} ★</div><div style={s.statLabel}>Avg Place</div></div>
        <div style={s.statBox}><div style={s.statNum('var(--brown-dark)')}>{avg('drinkOverall')} ★</div><div style={s.statLabel}>Avg Drink</div></div>
        <div style={s.statBox}><div style={s.statNum('var(--brown-mid)')}>{feedbacks.length > 0 ? ((withComments.length/feedbacks.length)*100).toFixed(0) : 0}%</div><div style={s.statLabel}>Comment Rate</div></div>
      </div>

      {/* Search */}
      <input
        placeholder="Search by name, comment, or order..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e0d0c0', fontSize: 13, marginBottom: 10, boxSizing: 'border-box', outline: 'none', background: 'white', color: '#333' }}
      />

      {/* Filters */}
      <div style={s.filterRow}>
        {[['all','All'], ['comments','With Comments'], ['no-comments','Ratings Only']].map(([val, label]) => (
          <button key={val} style={s.filterBtn(filter === val)} onClick={() => setFilter(val)}>{label}</button>
        ))}
      </div>

      <div style={{ fontSize: 12, color: 'var(--brown-light)', marginBottom: 10 }}>
        Showing {filtered.length} of {feedbacks.length} responses
      </div>

      {filtered.length === 0 && (
        <div style={s.empty}>
          {feedbacks.length === 0 ? 'No feedback yet.' : 'No results match your filter.'}
        </div>
      )}

      {filtered.map(f => (
        <div key={f.id} style={s.card}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div style={s.name}>{f.customerName || 'Anonymous'}</div>
            <div style={s.date}>{formatDate(f.createdAt)}</div>
          </div>

          {/* Ratings row */}
          <div style={s.ratingRow}>
            {f.staffRating > 0 && (
              <div style={s.ratingItem}>
                <Stars value={f.staffRating} />
                <span style={s.ratingLabel}>Staff</span>
              </div>
            )}
            {f.placeRating > 0 && (
              <div style={s.ratingItem}>
                <Stars value={f.placeRating} />
                <span style={s.ratingLabel}>Place</span>
              </div>
            )}
            {f.drinkOverall > 0 && (
              <div style={s.ratingItem}>
                <Stars value={f.drinkOverall} />
                <span style={s.ratingLabel}>Drink</span>
              </div>
            )}
          </div>

          {/* Overall comment */}
          {f.overallComment ? (
            <div style={s.comment}>"{f.overallComment}"</div>
          ) : null}

          {/* Drink comment */}
          {f.drinkComment ? (
            <div style={s.drinkComment}>Re drink: "{f.drinkComment}"</div>
          ) : null}

          {/* Orders */}
          {f.orders?.length > 0 && (
            <div style={s.orders}>Ordered: {f.orders.slice(0, 4).join(', ')}{f.orders.length > 4 ? ` +${f.orders.length - 4} more` : ''}</div>
          )}

          {/* Drink sub-ratings */}
          {(f.drinkSweetness > 0 || f.drinkBitterness > 0 || f.drinkCreaminess > 0) && (
            <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
              {f.drinkSweetness > 0 && <span style={{ fontSize: 11, color: 'var(--brown-light)' }}>Sweet {f.drinkSweetness}/5</span>}
              {f.drinkBitterness > 0 && <span style={{ fontSize: 11, color: 'var(--brown-light)' }}>Bitter {f.drinkBitterness}/5</span>}
              {f.drinkCreaminess > 0 && <span style={{ fontSize: 11, color: 'var(--brown-light)' }}>Cream {f.drinkCreaminess}/5</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
