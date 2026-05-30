import React, { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

function getStatus(qty, threshold) {
  if (qty <= 0) return 'out';
  if (qty <= threshold) return 'low';
  if (qty <= threshold * 2) return 'warn';
  return 'ok';
}

const STATUS_CONFIG = {
  ok:   { label: 'OK',       bg: 'var(--green-bg)',  color: 'var(--green-ok)' },
  warn: { label: 'Low',      bg: 'var(--orange-bg)', color: 'var(--orange-warn)' },
  low:  { label: 'Critical', bg: 'var(--red-bg)',    color: 'var(--red-crit)' },
  out:  { label: 'Out',      bg: '#f0f0f0',          color: '#888' },
};

const s = {
  page: { padding: '16px 16px 0', animation: 'fadeIn 0.3s ease' },
  title: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 4 },
  sub: { fontSize: 13, color: 'var(--brown-light)', marginBottom: 20 },
  bigCard: {
    background: 'white', borderRadius: 16, padding: '20px', marginBottom: 12,
    boxShadow: '0 1px 6px rgba(26,10,0,0.07)',
  },
  cardTitle: { fontSize: 12, fontWeight: 600, color: 'var(--brown-light)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 },
  statBox: (color) => ({
    background: 'var(--cream)', borderRadius: 12, padding: '14px', textAlign: 'center',
  }),
  statNum: (color) => ({ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }),
  statLabel: { fontSize: 12, color: 'var(--brown-light)', marginTop: 4 },
  alertRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
    borderBottom: '1px solid #f5ede4',
  },
  alertName: { fontSize: 14, fontWeight: 600, color: 'var(--brown-dark)', flex: 1 },
  alertQty: { fontSize: 12, color: 'var(--brown-light)' },
  badge: (status) => ({
    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    background: STATUS_CONFIG[status].bg, color: STATUS_CONFIG[status].color,
  }),
  catRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f5ede4', fontSize: 13 },
};

export default function Reports() {
  const [items, setItems] = useState([]);
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'inventory'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => setItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'photoLogs'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => setPhotos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  const alerts = items.filter(i => getStatus(i.quantity, i.threshold) !== 'ok');
  const okCount = items.filter(i => getStatus(i.quantity, i.threshold) === 'ok').length;
  const warnCount = items.filter(i => getStatus(i.quantity, i.threshold) === 'warn').length;
  const lowCount = items.filter(i => getStatus(i.quantity, i.threshold) === 'low').length;
  const outCount = items.filter(i => i.quantity <= 0).length;

  // Category breakdown
  const catMap = {};
  items.forEach(item => {
    if (!catMap[item.category]) catMap[item.category] = 0;
    catMap[item.category]++;
  });
  const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

  return (
    <div style={s.page}>
      <div style={s.title}>Reports</div>
      <div style={s.sub}>Stock summary for THEONYX CAFE</div>

      {/* Stock Overview */}
      <div style={s.bigCard}>
        <div style={s.cardTitle}>📊 Stock Overview</div>
        <div style={s.statsGrid}>
          <div style={s.statBox()}>
            <div style={s.statNum('var(--brown-dark)')}>{items.length}</div>
            <div style={s.statLabel}>Total Items</div>
          </div>
          <div style={s.statBox()}>
            <div style={s.statNum('var(--green-ok)')}>{okCount}</div>
            <div style={s.statLabel}>Well Stocked</div>
          </div>
          <div style={s.statBox()}>
            <div style={s.statNum('var(--orange-warn)')}>{warnCount + lowCount}</div>
            <div style={s.statLabel}>Need Restock</div>
          </div>
          <div style={s.statBox()}>
            <div style={s.statNum('var(--red-crit)')}>{outCount}</div>
            <div style={s.statLabel}>Out of Stock</div>
          </div>
        </div>
        <div style={s.statBox()}>
          <div style={s.statNum('var(--brown-mid)')}>{photos.length}</div>
          <div style={s.statLabel}>Total Photos Logged</div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={s.bigCard}>
          <div style={s.cardTitle}>🚨 Items Needing Attention</div>
          {alerts.map(item => {
            const status = getStatus(item.quantity, item.threshold);
            return (
              <div key={item.id} style={s.alertRow}>
                <div style={{ flex: 1 }}>
                  <div style={s.alertName}>{item.name}</div>
                  <div style={s.alertQty}>{item.quantity} {item.unit} remaining</div>
                </div>
                <span style={s.badge(status)}>{STATUS_CONFIG[status].label}</span>
              </div>
            );
          })}
        </div>
      )}

      {alerts.length === 0 && items.length > 0 && (
        <div style={{ ...s.bigCard, background: 'var(--green-bg)', textAlign: 'center', padding: '24px' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 600, color: 'var(--green-ok)' }}>All items are well stocked!</div>
        </div>
      )}

      {/* Category Breakdown */}
      {cats.length > 0 && (
        <div style={s.bigCard}>
          <div style={s.cardTitle}>📂 By Category</div>
          {cats.map(([cat, count]) => (
            <div key={cat} style={s.catRow}>
              <span style={{ color: 'var(--brown-dark)', fontWeight: 500 }}>{cat}</span>
              <span style={{ color: 'var(--brown-light)', fontWeight: 600 }}>{count} item{count !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
