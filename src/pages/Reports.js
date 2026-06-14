import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const REPORT_START = new Date('2026-06-04T00:00:00');
const DAY_COLORS = ['#e07b39','#c8956c','#d4a853','#6b3a1f','#1a0a00','#888','#c8956c'];
const PRODUCT_COLORS = ['#e07b39','#6b3a1f','#d4a853','#c8956c','#1a0a00','#a0522d','#888','#b8860b','#cd853f','#8b4513'];

// ── Google Sheets (live sync) ──
const SHEET_ID_STOCK   = '1Gnr_6SBcUBY4GcDqvGpTUZgE8NI3OIZAzlusG5YPfQg';   // Stock Checks (has "Capital Cost" tab)
const TAB_CAPITAL      = 'Capital Cost';
const SHEET_ID_ORDERS  = '1yadv9UgY8mFQzSwLsw3Qk3EepZeLL8dNl3YRtYsGZQU';   // Order Summary (sales)
const TAB_ORDERS       = 'Sheet1';                                          // same tab the Orders app writes to
const GOOGLE_CLIENT_ID = '596322682185-n5hm66hvol3nnqqllnuop995kcnefbgu.apps.googleusercontent.com';
const SCOPES           = 'https://www.googleapis.com/auth/spreadsheets.readonly';

const productColorMap = {};
function getProductColor(name) {
  if (!productColorMap[name]) {
    const idx = Object.keys(productColorMap).length % PRODUCT_COLORS.length;
    productColorMap[name] = PRODUCT_COLORS[idx];
  }
  return productColorMap[name];
}
function formatAmount(val) {
  return val >= 1000 ? `P${(val / 1000).toFixed(1)}k` : `P${val.toLocaleString()}`;
}
function formatDateShort(date) {
  return `${date.toLocaleString('default', { month: 'short' })} ${date.getDate()}`;
}
function isAfterReportStart(date) {
  return date >= REPORT_START;
}

// ─────────────────────────────────────────────────────────────
// CAPITAL COST per menu item — DEFAULT/fallback values.
// When connected to Google, the live "Capital Cost" tab is merged
// over these (sheet wins). Items not found anywhere appear under
// "No capital cost yet" so you can add them in the sheet.
// ─────────────────────────────────────────────────────────────
const CAPITAL_COST = {
  'COFFEE LATTE': 30, 'AMERICANO': 14.28, 'BREWED': 14.28, 'ESPRESSO SHOT': 11.55,
  'CARAMEL MACCHIATO': 27.82, 'MOCHA': 49.81, 'CAPUCCINO': 30, 'SPANISH LATTE': 31,
  'SEA SALT CARAMEL LATTE': 41, 'COFFEE MINT': 30, 'RHUMPUCCINO': 41, 'DIRTY MATCHA': 74,
  'STRAWBERRY LATTE': 20, 'STRAWBERRY MATCHA': 66, 'MILK CHOCOLATE': 38.12,
  'MATCHA LATTE': 48, 'OREO CHOCOMILKSHAKE': 51,
  'FRAPPE CARAMEL MACHIATTO': 61, 'FRAPPE STRAWBERRY': 49, 'FRAPPE UBE HALAYA': 53, 'FRAPPE CHOCOLATE': 49,
  'M.T. - HOKKAIDO': 33, 'M.T. - OKINAWA': 32, 'M.T. - MANGO CHEESECAKE': 34,
  'M.T. - RED VELVET': 31, 'M.T. - TARO': 31, 'M.T. - BLACK FOREST': 35,
  'M.T. - DARK CHOCOLATE': 38, 'M.T. - COOKIES AND CREAM': 32, 'M.T. - WHITE BUNNY': 32, 'M.T. - WINTERMELON': 32,
  'SODA - PASSION': 18, 'SODA - STRAWBERRY': 18, 'SODA - BLUEBERRY': 18, 'SODA - MANGO': 18,
  'TEA - BREAKFAST IN PARIS': 10, 'TEA - CHAMOMILE': 10, 'TEA - HIBISCUS': 10,
  'PASSION-LEMON REFRESHER': 28.52,
  'CHEESE BURGER': 20.34, 'PASTA - BOLOGNESE': 54.9, 'PASTA - CARBONARA': 57.1,
  'NACHOS': 46.21, 'RICE': 4, 'RICE MEAL - C. TAPA': 44,
};
function normalizeMenu(name) {
  return String(name || '')
    .replace(/\[[^\]]*\]/g, '')   // strip tags like [EDITED] / [ORDER REMOVED]
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}
function getCostFrom(map, name) {
  const c = map[normalizeMenu(name)];
  return (c === undefined || c === null) ? null : Number(c);
}
function computeProfit(list, map) {
  let sales = 0, cost = 0, matched = 0;
  const uncosted = {};
  (list || []).forEach(o => {
    (o.items || []).forEach(it => {
      const qty = it.qty || 1;
      const line = (it.price || 0) * qty;
      sales += line;
      const c = getCostFrom(map, it.name);
      if (c != null) { cost += c * qty; matched += line; }
      else { uncosted[it.name] = (uncosted[it.name] || 0) + line; }
    });
  });
  return { sales, cost, matched, net: matched - cost, uncosted };
}

// ── Sheet fetch + parse helpers ──
async function sheetValues(token, sheetId, range) {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) throw new Error('Sheets ' + r.status);
  return (await r.json()).values || [];
}
// Capital Cost tab → { NORMALIZED MENU: cost }
function parseCapitalCost(rows) {
  const map = {};
  for (let i = 0; i < rows.length; i++) {
    const menu = String((rows[i] || [])[0] || '').trim();
    const costRaw = (rows[i] || [])[2];
    if (!menu || costRaw == null || costRaw === '') continue;
    const cost = parseFloat(String(costRaw).replace(/[^0-9.]/g, ''));
    if (isNaN(cost)) continue;
    map[normalizeMenu(menu)] = cost;
  }
  return map;
}
function parseDateTime(dateStr, timeStr) {
  const dm = String(dateStr).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!dm) return null;
  let yr = Number(dm[3]); if (yr < 100) yr += 2000;
  let h = 0, mi = 0;
  const tm = String(timeStr).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (tm) { h = Number(tm[1]) % 12; if (tm[4] && /pm/i.test(tm[4])) h += 12; mi = Number(tm[2]); }
  return new Date(yr, Number(dm[1]) - 1, Number(dm[2]), h, mi);
}
// Order Summary sheet → orders [{ createdAt:{toDate}, total, items:[{name,price,qty}] }]
// Rows are per line-item; grouped into orders by date+time+customer+cashier.
// Rows tagged [ORDER REMOVED] are skipped; [EDITED] tags are stripped and kept.
function parseOrders(rows) {
  let start = 0;
  for (let i = 0; i < rows.length; i++) {
    const low = (rows[i] || []).map(x => String(x || '').trim().toLowerCase());
    if (low.includes('date') && low.includes('item')) { start = i + 1; break; }
  }
  const groups = {};
  for (let i = start; i < rows.length; i++) {
    const r = rows[i] || [];
    const date = String(r[0] || '').trim();
    const time = String(r[1] || '').trim();
    const cust = String(r[2] || '').trim();
    const itemRaw = String(r[3] || '').trim();
    if (!date || !itemRaw) continue;
    if (/\[order removed\]/i.test(itemRaw)) continue;
    const qty = Number(String(r[5] || '').replace(/[^0-9.]/g, '')) || 0;
    const price = Number(String(r[6] || '').replace(/[^0-9.]/g, '')) || 0;
    const paid = Number(String(r[7] || '').replace(/[^0-9.]/g, ''));
    const cashier = String(r[9] || '').trim();
    const name = itemRaw.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
    const js = parseDateTime(date, time);
    if (!js || isNaN(js.getTime())) continue;
    const line = !isNaN(paid) ? paid : price * qty;
    const key = `${date}|${time}|${cust}|${cashier}`;
    if (!groups[key]) groups[key] = { id: key, _date: js, total: 0, items: [] };
    groups[key].items.push({ name, price, qty: qty || 1 });
    groups[key].total += line;
  }
  return Object.values(groups).map(g => ({
    id: g.id, createdAt: { toDate: () => g._date }, total: g.total, items: g.items,
  }));
}

const s = {
  page: { padding: '16px 16px 0', animation: 'fadeIn 0.3s ease' },
  title: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 4 },
  sub: { fontSize: 13, color: 'var(--brown-light)', marginBottom: 16 },
  connBtn: { width: '100%', padding: '11px', borderRadius: 12, background: 'var(--brown-dark)', color: 'var(--gold-light)', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', marginBottom: 12 },
  syncBar: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 },
  syncBadge: { flex: 1, fontSize: 12, color: 'var(--brown-light)', background: 'var(--cream)', borderRadius: 10, padding: '8px 12px' },
  syncBtn: (busy) => ({ padding: '8px 14px', borderRadius: 10, background: busy ? '#bbab97' : 'var(--brown-dark)', color: 'var(--gold-light)', fontSize: 12, fontWeight: 700, border: 'none', cursor: busy ? 'wait' : 'pointer', flexShrink: 0 }),
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
  closeBtn: { width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', fontSize: 16, fontWeight: 700, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
};
export default function Reports({ role = 'staff', userName = '' }) {
  // Managers only — staff cannot see sales/revenue
  const isManager = String(role || '').trim().toLowerCase() === 'manager';
  if (!isManager) {
    return (
      <div style={s.page}>
        <div style={s.title}>Reports</div>
        <div style={s.sub}>Sales overview</div>
        <div style={s.card}>
          <div style={{ textAlign: 'center', padding: '28px 8px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 6 }}>Managers only</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--brown-light)' }}>
              This report (sales and revenue) is available to managers only. Please ask a manager for access.
            </div>
          </div>
        </div>
      </div>
    );
  }
  const [fsOrders, setFsOrders] = useState([]);       // fallback: Firestore orders
  const [sheetOrders, setSheetOrders] = useState(null); // live: Order Summary sheet
  const [sheetCost, setSheetCost] = useState(null);     // live: Capital Cost tab
  const [accessToken, setAccessToken] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('daily');
  const [dailyTooltip, setDailyTooltip] = useState(null);
  const [weeklyTooltip, setWeeklyTooltip] = useState(null);
  const tokenClientRef = React.useRef(null);
  const syncedRef = React.useRef(false);
  // Firestore fallback (used until connected to Google)
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), snap => {
      const allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = allOrders.filter(o => {
        if (!o.createdAt?.toDate) return false;
        return isAfterReportStart(o.createdAt.toDate());
      });
      setFsOrders(filtered);
    });
    return () => unsub();
  }, []);
  // Load Google Identity Services
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
    script.onload = () => {
      if (!window.google) return;
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID, scope: SCOPES,
        callback: (res) => { if (res.access_token) setAccessToken(res.access_token); },
      });
    };
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);
  // Pull both sheets (Capital Cost + Sales). Called on connect/open and via Sync button.
  const doSync = async () => {
    if (!accessToken) return;
    setSyncing(true);
    let okCost = false, okOrders = false;
    // Capital Cost (independent — a failure here must not block sales)
    try {
      const capRows = await sheetValues(accessToken, SHEET_ID_STOCK, `${TAB_CAPITAL}!A:G`);
      setSheetCost(parseCapitalCost(capRows));
      okCost = true;
    } catch (e) { console.error('Reports capital-cost sync:', e); }
    // Sales from Order Summary (independent)
    try {
      const ordRows = await sheetValues(accessToken, SHEET_ID_ORDERS, `${TAB_ORDERS}!A:J`);
      const parsed = parseOrders(ordRows).filter(o => o.createdAt.toDate() >= REPORT_START);
      setSheetOrders(parsed);
      okOrders = true;
    } catch (e) { console.error('Reports sales sync:', e); }
    if (!okOrders && !okCost) {
      alert('Could not sync the sheets. Make sure you are connected to Google, then try again.');
    } else if (!okOrders) {
      alert('Capital Cost synced, but could not read the Order Summary (sales) sheet. Check access to that sheet, then Sync again.');
    } else if (!okCost) {
      alert('Sales synced, but could not read the Capital Cost tab. Check the "Capital Cost" tab, then Sync again.');
    }
    setSyncing(false);
  };
  // Auto-sync once on app open after Google connect
  useEffect(() => {
    if (!accessToken || syncedRef.current) return;
    syncedRef.current = true;
    doSync();
  }, [accessToken]);

  const now = new Date();
  // Effective data: prefer live sheet data, fall back to Firestore + default costs
  const orders = sheetOrders ?? fsOrders;
  const costMap = { ...CAPITAL_COST, ...(sheetCost || {}) };
  // Daily with per-product breakdown
  const dailyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
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
  // Weekly — Monday to Sunday
  const weeklyData = Array.from({ length: 4 }, (_, i) => {
    const mostRecentMonday = new Date(now);
    const dayOfWeek = mostRecentMonday.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    mostRecentMonday.setDate(mostRecentMonday.getDate() - diffToMonday - (3 - i) * 7);
    mostRecentMonday.setHours(0, 0, 0, 0);
    const weekDays = Array.from({ length: 7 }, (_, d) => {
      const day = new Date(mostRecentMonday);
      day.setDate(day.getDate() + d);
      return day;
    });
    const totals = weekDays.map(day => {
      if (day < REPORT_START) return 0;
      const ds = day.toDateString();
      return orders
        .filter(o => o.createdAt?.toDate && o.createdAt.toDate().toDateString() === ds)
        .reduce((s, o) => s + (o.total || 0), 0);
    });
    const effectiveStart = weekDays[0] < REPORT_START ? REPORT_START : weekDays[0];
    const effectiveEnd = weekDays[6] > now ? now : weekDays[6];
    const dateRange = effectiveStart > effectiveEnd
      ? '—'
      : `${formatDateShort(effectiveStart)}–${formatDateShort(effectiveEnd)}`;
    return {
      label: `W${i + 1}`,
      days: totals,
      total: totals.reduce((a, b) => a + b, 0),
      dateRange,
    };
  });
  const maxWeekly = Math.max(...weeklyData.map(w => w.total), 1);
  // Monthly — last 30 days
  const monthlyData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (29 - i));
    if (d < REPORT_START) return { label: d.getDate(), total: 0, disabled: true };
    const dayKey = d.toDateString();
    const total = orders
      .filter(o => o.createdAt?.toDate && o.createdAt.toDate().toDateString() === dayKey)
      .reduce((s, o) => s + (o.total || 0), 0);
    return { label: d.getDate(), total, disabled: false };
  });
  const maxMonthly = Math.max(...monthlyData.map(d => d.total), 1);
  // Top 10 products
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
  const todayTotal = orders
    .filter(o => { if (!o.createdAt?.toDate) return false; return o.createdAt.toDate() >= todayStart; })
    .reduce((s, o) => s + (o.total || 0), 0);
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - diffToMonday);
  thisMonday.setHours(0, 0, 0, 0);
  const effectiveWeekStart = thisMonday < REPORT_START ? REPORT_START : thisMonday;
  const weekTotal = orders
    .filter(o => { if (!o.createdAt?.toDate) return false; return o.createdAt.toDate() >= effectiveWeekStart; })
    .reduce((s, o) => s + (o.total || 0), 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const effectiveMonthStart = monthStart < REPORT_START ? REPORT_START : monthStart;
  const monthTotal = orders
    .filter(o => { if (!o.createdAt?.toDate) return false; return o.createdAt.toDate() >= effectiveMonthStart; })
    .reduce((s, o) => s + (o.total || 0), 0);
  // ── Revenue (Sales − Capital Cost) ──
  const ordersToday = orders.filter(o => o.createdAt?.toDate && o.createdAt.toDate() >= todayStart);
  const ordersWeek = orders.filter(o => o.createdAt?.toDate && o.createdAt.toDate() >= effectiveWeekStart);
  const ordersMonth = orders.filter(o => o.createdAt?.toDate && o.createdAt.toDate() >= effectiveMonthStart);
  const profitAll = computeProfit(orders, costMap);
  const profitToday = computeProfit(ordersToday, costMap);
  const profitWeek = computeProfit(ordersWeek, costMap);
  const profitMonth = computeProfit(ordersMonth, costMap);
  const marginAll = profitAll.matched > 0 ? Math.round((profitAll.net / profitAll.matched) * 100) : 0;
  const coverageAll = profitAll.sales > 0 ? Math.round((profitAll.matched / profitAll.sales) * 100) : 0;
  const uncostedAll = Object.entries(profitAll.uncosted).sort((a, b) => b[1] - a[1]);
  const peso = (v) => `P${Math.round(v).toLocaleString()}`;
  const tooltipTopOffset = dailyTooltip
    ? Math.max(52, 36 + dailyTooltip.products.length * 20)
    : 32;
  return (
    <div style={s.page}>
      <div style={s.title}>Reports</div>
      <div style={s.sub}>Sales overview · From Jun 4 · {sheetOrders ? 'Live from Sheets' : 'From app data'}</div>
      {/* Google connect / sync */}
      {!accessToken ? (
        <button style={s.connBtn} onClick={() => tokenClientRef.current?.requestAccessToken()}>
          Connect Google to sync sheets
        </button>
      ) : (
        <div style={s.syncBar}>
          <span style={s.syncBadge}>
            {sheetOrders
              ? `Synced · ${orders.length} orders · ${Object.keys(sheetCost || {}).length} costs`
              : 'Connected — tap Sync'}
          </span>
          <button style={s.syncBtn(syncing)} onClick={doSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
        </div>
      )}
      {/* Summary Stats */}
      <div style={s.statGrid}>
        <div style={s.statBox}>
          <div style={s.statNum('var(--brown-dark)')}>P{todayTotal.toLocaleString()}</div>
          <div style={s.statLabel}>Today</div>
        </div>
        <div style={s.statBox}>
          <div style={s.statNum('var(--brown-mid)')}>P{weekTotal.toLocaleString()}</div>
          <div style={s.statLabel}>This Week</div>
        </div>
        <div style={s.statBox}>
          <div style={s.statNum('var(--gold)')}>P{monthTotal.toLocaleString()}</div>
          <div style={s.statLabel}>This Month</div>
        </div>
        <div style={s.statBox}>
          <div style={s.statNum('var(--green-ok)')}>{orders.length}</div>
          <div style={s.statLabel}>Total Orders</div>
        </div>
      </div>
      {/* Revenue (Sales − Capital Cost) */}
      <div style={s.card}>
        <div style={s.cardTitle}>Revenue · Sales − Capital Cost</div>
        <div style={s.statGrid}>
          <div style={s.statBox}>
            <div style={s.statNum('var(--brown-dark)')}>{peso(profitAll.sales)}</div>
            <div style={s.statLabel}>Total Sales</div>
          </div>
          <div style={s.statBox}>
            <div style={s.statNum('var(--brown-mid)')}>{peso(profitAll.cost)}</div>
            <div style={s.statLabel}>Capital Cost</div>
          </div>
          <div style={s.statBox}>
            <div style={s.statNum('var(--green-ok)')}>{peso(profitAll.net)}</div>
            <div style={s.statLabel}>Net Revenue</div>
          </div>
          <div style={s.statBox}>
            <div style={s.statNum('var(--gold)')}>{marginAll}%</div>
            <div style={s.statLabel}>Gross Margin</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--brown-light)', lineHeight: 1.5, marginBottom: 8 }}>
          Net Revenue = sales of items that have a capital cost ({peso(profitAll.matched)}) minus their capital cost.
          {' '}{coverageAll}% of total sales currently has a cost set.
        </div>
        {/* Per-period net revenue */}
        {[['Today', profitToday], ['This Week', profitWeek], ['This Month', profitMonth]].map(([lbl, p]) => (
          <div key={lbl} style={s.productRow}>
            <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--brown-dark)' }}>{lbl}</div>
            <div style={{ fontSize: 11, color: 'var(--brown-light)', marginRight: 10 }}>Sales {peso(p.sales)}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-ok)' }}>Net {peso(p.net)}</div>
          </div>
        ))}
        {/* Items without a capital cost yet */}
        {uncostedAll.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brown-light)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              No capital cost yet ({uncostedAll.length})
            </div>
            {uncostedAll.slice(0, 8).map(([name, sales]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--brown-light)', padding: '3px 0' }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                <span style={{ flexShrink: 0, marginLeft: 8 }}>{peso(sales)} sales</span>
              </div>
            ))}
            <div style={{ fontSize: 10, color: 'var(--brown-light)', marginTop: 6, fontStyle: 'italic' }}>
              Add their cost in the "Capital Cost" tab — it updates automatically when you Sync.
            </div>
          </div>
        )}
      </div>
      {/* Tabs */}
      <div style={s.tabRow}>
        {['daily', 'weekly', 'monthly'].map(t => (
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
            {/* Daily Tooltip */}
            {dailyTooltip && (
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', background: 'var(--brown-dark)', color: 'var(--gold-light)', borderRadius: 12, padding: '10px 14px', zIndex: 10, boxShadow: '0 2px 12px rgba(0,0,0,0.25)', width: '90%', maxHeight: 260, overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold-light)' }}>
                    {dailyTooltip.label} · {formatAmount(dailyTooltip.total)}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDailyTooltip(null); }}
                    style={s.closeBtn}
                  >✕</button>
                </div>
                {dailyTooltip.products.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: getProductColor(p.name), flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 11, color: 'white' }}>{p.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--gold-light)', fontWeight: 700 }}>{formatAmount(p.sales)}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Daily Bars */}
            <div
              style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100, marginBottom: 4, marginTop: tooltipTopOffset }}
              onClick={() => setDailyTooltip(null)}
            >
              {dailyData.map((d, i) => {
                const barHeight = d.disabled || d.total === 0 ? 0 : Math.max((d.total / maxDaily) * 100, 4);
                const isActive = dailyTooltip?.label === d.label;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <div style={{ fontSize: 9, color: 'var(--brown-mid)', marginBottom: 2, textAlign: 'center' }}>
                      {!d.disabled && d.total > 0 ? (d.total >= 1000 ? `${(d.total / 1000).toFixed(1)}k` : d.total) : ''}
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
            {/* Day Labels */}
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
            {/* Weekly Tooltip */}
            {weeklyTooltip && (
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', background: 'var(--brown-dark)', color: 'var(--gold-light)', borderRadius: 12, padding: '10px 14px', zIndex: 10, boxShadow: '0 2px 12px rgba(0,0,0,0.25)', width: '90%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{weeklyTooltip.label} · {formatAmount(weeklyTooltip.total)}</div>
                    <div style={{ fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{weeklyTooltip.dateRange}</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setWeeklyTooltip(null); }}
                    style={s.closeBtn}
                  >✕</button>
                </div>
              </div>
            )}
            {/* Weekly Bars */}
            <div
              style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100, marginBottom: 4, marginTop: 56 }}
              onClick={() => setWeeklyTooltip(null)}
            >
              {weeklyData.map((w, i) => {
                const barHeight = w.total === 0 ? 0 : Math.max((w.total / maxWeekly) * 100, 4);
                const isActive = weeklyTooltip?.label === w.label;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <div style={{ fontSize: 9, color: 'var(--brown-mid)', marginBottom: 2, textAlign: 'center' }}>
                      {w.total > 0 ? (w.total >= 1000 ? `${(w.total / 1000).toFixed(1)}k` : w.total) : ''}
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
            {/* Week Labels with Date Range */}
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
            <polyline
              fill="none"
              stroke="var(--brown-dark)"
              strokeWidth="1.5"
              points={monthlyData.map((d, i) => `${i * 10 + 5},${100 - (d.total / maxMonthly) * 90}`).join(' ')}
            />
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
