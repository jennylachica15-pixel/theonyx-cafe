import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase/config';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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
  sub: { fontSize: 13, color: 'var(--brown-light)', marginBottom: 16 },
  tabRow: { display: 'flex', gap: 0, background: 'white', borderRadius: 12, padding: 4, marginBottom: 16, boxShadow: '0 1px 4px rgba(26,10,0,0.06)' },
  tab: (active) => ({ flex: 1, padding: '9px 4px', borderRadius: 9, fontSize: 12, fontWeight: active ? 700 : 400, background: active ? 'var(--brown-dark)' : 'transparent', color: active ? 'var(--gold-light)' : 'var(--brown-light)', border: 'none', cursor: 'pointer', textAlign: 'center' }),
  card: { background: 'white', borderRadius: 14, padding: '16px', marginBottom: 12, boxShadow: '0 1px 6px rgba(26,10,0,0.07)' },
  cardTitle: { fontSize: 12, fontWeight: 600, color: 'var(--brown-light)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  statGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 },
  statBox: { background: 'var(--cream)', borderRadius: 10, padding: '12px', textAlign: 'center' },
  statNum: (color) => ({ fontSize: 24, fontWeight: 700, color: color || 'var(--brown-dark)' }),
  statLabel: { fontSize: 11, color: 'var(--brown-light)', marginTop: 2 },
  barWrap: { display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, marginBottom: 6 },
  bar: (h, color) => ({ flex: 1, background: color || 'var(--brown-mid)', borderRadius: '4px 4px 0 0', height: `${Math.max(h, 2)}%`, minHeight: 2, transition: 'height 0.4s ease' }),
  barLabel: { fontSize: 9, color: 'var(--brown-light)', textAlign: 'center', marginTop: 2 },
  barValue: { fontSize: 9, color: 'var(--brown-mid)', textAlign: 'center', marginBottom: 2 },
  productRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #f5ede4' },
  rank: { width: 22, height: 22, borderRadius: '50%', background: 'var(--brown-dark)', color: 'var(--gold-light)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  alertRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #f5ede4' },
  badge: (status) => ({ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: STATUS_CONFIG[status].bg, color: STATUS_CONFIG[status].color }),
};

export default function Reports() {
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState('daily');

  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), snap => setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsub2 = onSnapshot(query(collection(db, 'inventory'), orderBy('createdAt', 'desc')), snap => setItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsub1(); unsub2(); };
  }, []);

  const now = new Date();

  // Daily — last 7 days
  const dailyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (6 - i));
    const dayKey = d.toDateString();
    const total = orders.filter(o => o.createdAt?.toDate && o.createdAt.toDate().toDateString() === dayKey).reduce((s, o) => s + (o.total || 0), 0);
    return { label: DAYS[d.getDay()], total };
  });
  const maxDaily = Math.max(...dailyData.map(d => d.total), 1);

  // Weekly — last 4 weeks
  const weeklyData = Array.from({ length: 4 }, (_, i) => {
    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - weekStart.getDay() - (3 - i) * 7);
    const weekDays = Array.from({ length: 7 }, (_, d) => { const day = new Date(weekStart); day.setDate(day.getDate() + d); return day.toDateString(); });
    const totals = weekDays.map(ds => orders.filter(o => o.createdAt?.toDate && o.createdAt.toDate().toDateString() === ds).reduce((s, o) => s + (o.total || 0), 0));
    return { label: `W${i + 1}`, days: totals, total: totals.reduce((a, b) => a + b, 0) };
  });
  const maxWeekly = Math.max(...weeklyData.map(w => w.total), 1);

  // Monthly — last 30 days line
  const monthlyData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (29 - i));
    const dayKey = d.toDateString();
    const total = orders.filter(o => o.createdAt?.toDate && o.createdAt.toDate().toDateString() === dayKey).reduce((s, o) => s + (o.total || 0), 0);
    return { label: d.getDate(), total };
  });
  const maxMonthly = Math.max(...monthlyData.map(d => d.total), 1);

  // Top 10 products
  const productMap = {};
  orders.forEach(order => {
    (order.items || []).forEach(item => {
      const key = item.name;
      if (!productMap[key]) productMap[key] = 0;
      productMap[key] += (item.price || 0) * (item.qty || 1);
    });
  });
  const totalSales = Object.values(productMap).reduce((a, b) => a + b, 0);
  const top10 = Object.entries(productMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Summary stats
  const todayTotal = orders.filter(o => o.createdAt?.toDate && o.createdAt.toDate().toDateString() === now.toDateString()).reduce((s, o) => s + (o.total || 0), 0);
  const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekTotal = orders.filter(o => { if (!o.createdAt?.toDate) return false; const d = o.createdAt.toDate(); return d >= weekStart; }).reduce((s, o) => s + (o.total || 0), 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTotal = orders.filter(o => { if (!o.createdAt?.toDate) return false; const d = o.createdAt.toDate(); return d >= monthStart; }).reduce((s, o) => s + (o.total || 0), 0);

  const alerts = items.filter(i => getStatus(i.quantity, i.threshold) !== 'ok');

  const DAY_COLORS = ['#e07b39','#c8956c','#d4a853','#6b3a1f','#1a0a00','#888','#c8956c'];

  return (
    <div style={s.page}>
      <div style={s.title}>Reports</div>
      <div style={s.sub}>Sales & inventory overview</div>

      {/* Summary stats */}
      <div style={s.statGrid}>
        <div style={s.statBox}><div style={s.statNum('var(--brown-dark)')}>₱{todayTotal.toLocaleString()}</div><div style={s.statLabel}>Today</div></div>
        <div style={s.statBox}><div style={s.statNum('var(--brown-mid)')}>₱{weekTotal.toLocaleString()}</div><div style={s.statLabel}>This Week</div></div>
        <div style={s.statBox}><div style={s.statNum('var(--gold)')}>₱{monthTotal.toLocaleString()}</div><div style={s.statLabel}>This Month</div></div>
        <div style={s.statBox}><div style={s.statNum('var(--green-ok)')}>{orders.length}</div><div style={s.statLabel}>Total Orders</div></div>
      </div>

      {/* Tab selector */}
      <div style={s.tabRow}>
        {['daily','weekly','monthly'].map(t => <button key={t} style={s.tab(activeTab === t)} onClick={() => setActiveTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>)}
      </div>

      {/* Daily Bar */}
      {activeTab === 'daily' && (
        <div style={s.card}>
          <div style={s.cardTitle}>📊 Daily Sales — Last 7 Days</div>
          <div style={s.barWrap}>
            {dailyData.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={s.barValue}>₱{d.total > 0 ? (d.total >= 1000 ? `${(d.total/1000).toFixed(1)}k` : d.total) : ''}</div>
                <div style={s.bar((d.total / maxDaily) * 100, 'var(--brown-dark)')} />
                <div style={s.barLabel}>{d.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Stacked Bar */}
      {activeTab === 'weekly' && (
        <div style={s.card}>
          <div style={s.cardTitle}>📊 Weekly Sales — Last 4 Weeks</div>
          <div style={s.barWrap}>
            {weeklyData.map((w, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={s.barValue}>₱{w.total > 0 ? (w.total >= 1000 ? `${(w.total/1000).toFixed(1)}k` : w.total) : ''}</div>
                <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column-reverse', borderRadius: '4px 4px 0 0', overflow: 'hidden', height: `${(w.total/maxWeekly)*100}%`, minHeight: w.total > 0 ? 4 : 0 }}>
                  {w.days.map((dayVal, di) => dayVal > 0 ? (
                    <div key={di} style={{ background: DAY_COLORS[di], flex: dayVal, minHeight: 2 }} title={`${DAYS[di]}: ₱${dayVal}`} />
                  ) : null)}
                </div>
                <div style={s.barLabel}>{w.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {DAYS.map((d, i) => <span key={i} style={{ fontSize: 10, color: 'var(--brown-light)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: DAY_COLORS[i], display: 'inline-block' }} />{d}</span>)}
          </div>
        </div>
      )}

      {/* Monthly Line Graph */}
      {activeTab === 'monthly' && (
        <div style={s.card}>
          <div style={s.cardTitle}>📈 Monthly Sales — Last 30 Days</div>
          <svg width="100%" height="130" viewBox={`0 0 ${monthlyData.length * 10} 100`} preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke="var(--brown-dark)"
              strokeWidth="1.5"
              points={monthlyData.map((d, i) => `${i * 10 + 5},${100 - (d.total / maxMonthly) * 90}`).join(' ')}
            />
            {monthlyData.map((d, i) => d.total > 0 ? (
              <circle key={i} cx={i * 10 + 5} cy={100 - (d.total / maxMonthly) * 90} r="2" fill="var(--gold)" />
            ) : null)}
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--brown-light)', marginTop: 4 }}>
            <span>{monthlyData[0]?.label}</span>
            <span>{monthlyData[14]?.label}</span>
            <span>{monthlyData[29]?.label}</span>
          </div>
        </div>
      )}

      {/* Top 10 Products */}
      {top10.length > 0 && (
        <div style={s.card}>
          <div style={s.cardTitle}>🏆 Top 10 Products</div>
          {top10.map(([name, sales], i) => (
            <div key={name} style={s.productRow}>
              <div style={s.rank}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brown-dark)' }}>{name}</div>
                <div style={{ height: 4, background: '#f0e4d8', borderRadius: 2, marginTop: 4 }}>
                  <div style={{ height: '100%', background: 'var(--brown-mid)', borderRadius: 2, width: `${(sales / top10[0][1]) * 100}%` }} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brown-dark)' }}>₱{sales.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: 'var(--brown-light)' }}>{totalSales > 0 ? ((sales / totalSales) * 100).toFixed(1) : 0}%</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inventory alerts */}
      {alerts.length > 0 && (
        <div style={s.card}>
          <div style={s.cardTitle}>🚨 Inventory Alerts</div>
          {alerts.map(item => {
            const status = getStatus(item.quantity, item.threshold);
            return (
              <div key={item.id} style={s.alertRow}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brown-dark)' }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--brown-light)' }}>{item.quantity} {item.unit} left</div>
                </div>
                <span style={s.badge(status)}>{STATUS_CONFIG[status].label}</span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ height: 80 }} />
    </div>
  );
}
