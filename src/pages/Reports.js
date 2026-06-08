import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const REPORT_START = new Date('2026-06-04T00:00:00');
const DAY_COLORS = ['#e07b39','#c8956c','#d4a853','#6b3a1f','#1a0a00','#888','#c8956c'];
const PRODUCT_COLORS = ['#e07b39','#6b3a1f','#d4a853','#c8956c','#1a0a00','#a0522d','#888','#b8860b','#cd853f','#8b4513'];

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
  productRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #f5ede4' },
  rank: { width: 22, height: 22, borderRadius: '50%', background: 'var(--brown-dark)', color: 'var(--gold-light)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
};

function formatAmount(val) {
  return val >= 1000 ? `P${(val / 1000).toFixed(1)}k` : `P${val.toLocaleString()}`;
}

function formatDateShort(date) {
  return `${date.toLocaleString('default', { month: 'short' })} ${date.getDate()}`;
}

function isAfterReportStart(date) {
  return date >= REPORT_START;
}

const productColorMap = {};
function getProductColor(name) {
  if (!productColorMap[name]) {
    const idx = Object.keys(productColorMap).length % PRODUCT_COLORS.length;
    productColorMap[name] = PRODUCT_COLORS[idx];
  }
  return productColorMap[name];
}

export default function Reports() {
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('daily');
  const [dailyTooltip, setDailyTooltip] = useState(null);
  const [weeklyTooltip, setWeeklyTooltip] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), snap => {
      const allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = allOrders.filter(o => {
        if (!o.createdAt?.toDate) return false;
        return isAfterReportStart(o.createdAt.toDate());
      });
      setOrders(filtered);
    });
    return () => unsub();
  }, []);

  const now = new Date();

  // Daily with per-product breakdown
  const dailyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (6 - i));
    if (d < REPORT_START) return { label: DAYS[d.getDay()], total: 0, disabled: true, products: [] };
    const dayKey = d.toDateString();
    const dayOrders = orders.filter(o => o.createdAt?.toDate && o.createdAt.toDate().toDateString() === dayKey);
    const pMap = {};
    dayOrders.forEach(order => {
      (order.items || []).forEach(item => {
        if (!pMap[item.name]) pMap[item.name] = 0;
        pMap[item.name] += (item.price || 0) * (item.qty || 1);
      });
    });
    const products = Object.entries(pMap).sort((a, b) => b[1] - a[1]).map(([name, sales]) => ({ name, sales }));
    const total = dayOrders.reduce((s, o) => s + (o.total || 0), 0);
    return { label: DAYS[d.getDay()], total, disabled: false, products };
  });
  const maxDaily = Math.max(...dailyData.map(d => d.total), 1);

  // Weekly with date ranges
  const weeklyData = Array.from({ length: 4 }, (_, i) => {
    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - weekStart.getDay() - (3 - i) * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekDays = Array.from({ length: 7 }, (_, d) => { const day = new Date(weekStart); day.setDate(day.getDate() + d); return day; });
    const totals = weekDays.map(day => {
      if (day < REPORT_START) return 0;
      const ds = day.toDateString();
      return orders.filter(o => o.createdAt?.toDate && o.createdAt.toDate().toDateString() === ds).reduce((s, o) => s + (o.total || 0), 0);
    });
    const effectiveStart = weekDays[0] < REPORT_START ? REPORT_START : weekDays[0];
    const effectiveEnd = weekDays[6] > now ? now : weekDays[6];
    const dateRange = effectiveStart > effectiveEnd ? '—' : `${formatDateShort(effectiveStart)}–${formatDateShort(effectiveEnd)}`;
    return { label: `W${i + 1}`, days: totals, total: totals.reduce((a, b) => a + b, 0), dateRange };
  });
  const maxWeekly = Math.max(...weeklyData.map(w => w.total), 1);

  // Monthly
  const monthlyData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (29 - i));
    if (d < REPORT_START) return { label: d.getDate(), total: 0, disabled: true };
    const dayKey = d.toDateString();
    const total = orders.filter(o => o.createdAt?.toDate && o.createdAt.toDate().toDateString() === dayKey).reduce((s, o) => s + (o.total || 0), 0);
    return { label: d.getDate(), total, disabled: false };
  });
  const maxMonthly = Math.max(...monthlyData.map(d => d.total), 1);

  // Top 10
  const productMap = {};
  orders.forEach(order => {
    (order.items || []).forEach(item => {
      if (!productMap[item.name]) productMap[item.name] = 0;
      productMap[item.name] += (item.price || 0) * (item.qty || 1);
    });
  });
  const totalSales = Object.values(productMap).reduce((a, b) => a + b, 0);
  const top10 = Object.entries(productMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Summary stats
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayTotal = orders.filter(o => { if (!o.createdAt?.toDate) return false; return o.createdAt.toDate() >= todayStart; }).reduce((s, o) => s + (o.total || 0), 0);
  const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0,0,0,0);
  const effectiveWeekStart = weekStart < REPORT_START ? REPORT_START : weekStart;
  const weekTotal = orders.filter(o => { if (!o.createdAt?.toDate) return false; return o.createdAt.toDate() >= effectiveWeekStart; }).reduce((s, o) => s + (o.total || 0), 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const effectiveMonthStart = monthStart < REPORT_START ? REPORT_START : monthStart;
  const monthTotal = orders.filter(o => { if (!o.createdAt?.toDate) return false; return o.createdAt.toDate() >= effectiveMonthStart; }).reduce((s, o) => s + (o.total || 0), 0);

  return (
    <div style={s.page}>
      <div style={s.title}>Reports</div>
      <div style={s.sub}>Sales overview · From Jun 4</div>

      {/* Summary Stats */}
      <div style={s.statGrid}>
        <div style={s.statBox}><div style={s.statNum('var(--brown-dark)')}>P{todayTotal.toLocaleString()}</div><div style={s.statLabel}>Today</div></div>
        <div style={s.statBox}><div style={s.statNum('var(--brown-mid)')}>P{weekTotal.toLocaleString()}</div><div style={s.statLabel}>This Week</div></div>
        <div style={s.statBox}><div style={s.statNum('var(--gold)')}>P{monthTotal.toLocaleString()}</div><div style={s.statLabel}>This Month</div></div>
        <div style={s.statBox}><div style={s.statNum('var(--green-ok)')}>{orders.length}</div><div style={s.statLabel}>Total Orders</div></div>
      </div>

      {/* Tabs */}
      <div style={s.tabRow}>
        {['daily','weekly','monthly'].map(t => (
          <button key={t} style={s.tab(activeTab === t)} onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Daily Chart */}
      {activeTab === 'daily' && (
        <div style={s.card}>
          <div style={s.cardTitle}>Daily Sales - Last 7 Days</div>
          <div style={{ position: 'relative' }}>
            {dailyTooltip && (
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', background: 'var(--brown-dark)', color: 'var(--gold-light)', borderRadius: 10, padding: '6px 14px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.18)', pointerEvents: 'none', textAlign: 'center' }}>
                <div>{dailyTooltip.label} · {formatAmount(dailyTooltip.total)}</div>
                {dailyTooltip.products.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, marginTop: 2 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: getProductColor(p.name), flexShrink: 0 }} />
                    <span>{p.name}: {formatAmount(p.sales)}</span>
                  </div>
                ))}
              </div>
            )}
            <div
              style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100, marginBottom: 4, marginTop: dailyTooltip ? Math.max(48, 28 + dailyTooltip.products.length * 18) : 32 }}
              onClick={() => setDailyTooltip(null)}
            >
              {dailyData.map((d, i) => {
                const barHeight = d.disabled || d.total === 0 ? 0 : Math.max((d.total / maxDaily) * 100, 4);
                const isActive = dailyTooltip?.label === d.label;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <div style={{ fontSize: 9, color: 'var(--brown-mid)', marginBottom: 2, textAlign: 'center' }}>
                      {!d.disabled && d.total > 0 ? (d.total >= 1000 ? `${(d.total/1000).toFixed(1)}k` : d.total) : ''}
                    </div>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!d.disabled && d.total > 0) setDailyTooltip(isActive ? null : { label: d.label, total: d.total, products: d.products });
                      }}
                      style={{ width: '70%', height: `${barHeight}px`, borderRadius: '4px 4px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse', cursor: d.total > 0 ? 'pointer' : 'default', outline: isActive ? '2px solid var(--gold)' : 'none' }}
                    >
                      {d.products.map((p, pi) => (
                        <div key={pi} style={{ background: getProductColor(p.name), flex: p.sales, minHeight: 2 }} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {dailyData.map((d, i) => (
                <div key={i} style={{ flex: 1, fontSize: 9, color: d.disabled ? '#ccc' : 'var(--brown-light)', textAlign: 'center' }}>{d.label}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Weekly Chart */}
      {activeTab === 'weekly' && (
        <div style={s.card}>
          <div style={s.cardTitle}>Weekly Sales - Last 4 Weeks</div>
          <div style={{ position: 'relative' }}>
            {weeklyTooltip && (
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', background: 'var(--brown-dark)', color: 'var(--gold-light)', borderRadius: 10, padding: '6px 14px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.18)', pointerEvents: 'none', textAlign: 'center' }}>
                <div>{weeklyTooltip.label} · {formatAmount(weeklyTooltip.total)}</div>
                <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2 }}>{weeklyTooltip.dateRange}</div>
              </div>
            )}
            <div
              style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100, marginBottom: 4, marginTop: 48 }}
              onClick={() => setWeeklyTooltip(null)}
            >
              {weeklyData.map((w, i) => {
                const barHeight = w.total === 0 ? 0 : Math.max((w.total / maxWeekly) * 100, 4);
                const isActive = weeklyTooltip?.label === w.label;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <div style={{ fontSize: 9, color: 'var(--brown-mid)', marginBottom: 2, textAlign: 'center' }}>
                      {w.total > 0 ? (w.total >= 1000 ? `${(w.total/1000).toFixed(1)}k` : w.total) : ''}
                    </div>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if (w.total > 0) setWeeklyTooltip(isActive ? null : { label: w.label, total: w.total, dateRange: w.dateRange });
                      }}
                      style={{ width: '70%', height: `${barHeight}px`, borderRadius: '4px 4px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse', cursor: w.total > 0 ? 'pointer' : 'default', outline: isActive ? '2px solid var(--gold)' : 'none' }}
                    >
                      {w.days.map((dayVal, di) => dayVal > 0 ? (
                        <div key={di} style={{ background: DAY_COLORS[di], flex: dayVal, minHeight: 2 }} />
                      ) : null)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {weeklyData.map((w, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--brown-light)' }}>{w.label}</div>
                  <div style={{ fontSize: 8, color: '#bbb', marginTop: 1, lineHeight: 1.3 }}>{w.dateRange}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Monthly Chart */}
      {activeTab === 'monthly' && (
        <div style={s.card}>
          <div style={s.cardTitle}>Monthly Sales - Last 30 Days</div>
          <svg width="100%" height="130" viewBox={`0 0 ${monthlyData.length * 10} 100`} preserveAspectRatio="none">
            <polyline fill="none" stroke="var(--brown-dark)" strokeWidth="1.5"
              points={monthlyData.map((d, i) => `${i * 10 + 5},${100 - (d.total / maxMonthly) * 90}`).join(' ')} />
            {monthlyData.map((d, i) => (!d.disabled && d.total > 0) ? (
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
          <div style={s.cardTitle}>Top 10 Products</div>
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
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brown-dark)' }}>P{sales.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: 'var(--brown-light)' }}>{totalSales > 0 ? ((sales / totalSales) * 100).toFixed(1) : 0}%</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 80 }} />
    </div>
  );
}
