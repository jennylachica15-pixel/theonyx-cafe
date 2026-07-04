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
const OVERHEAD_GID     = 695906692;                                         // tab in Stock Checks that holds the monthly operating cost (summed live, no fallback)
const GOOGLE_CLIENT_ID = '596322682185-n5hm66hvol3nnqqllnuop995kcnefbgu.apps.googleusercontent.com';
const SCOPES           = 'https://www.googleapis.com/auth/spreadsheets.readonly';

// Menu with sizes & prices (same as the Orders app) — for the "Suggested prices" card
const SIZES = ['mini', 'classic', 'upgrade', 'regular'];
const SIZE_LABELS = { mini: 'Mini', classic: 'Classic', upgrade: 'Upgrade', regular: 'Regular' };
const MENU_PRICING = [
  { id: 'espresso', label: 'Espresso based', items: [
    { name: 'COFFEE LATTE', mini: 75, classic: 85, upgrade: 95 },
    { name: 'CARAMEL MACCHIATO', mini: 99, classic: 120, upgrade: 150 },
    { name: 'AMERICANO', mini: 50, classic: 75, upgrade: 99 },
    { name: 'CAPUCCINO', mini: 50, classic: 85, upgrade: 120 },
    { name: 'SPANISH LATTE', mini: 99, classic: 120, upgrade: 150 },
    { name: 'MOCHA', mini: 99, classic: 120, upgrade: 150 },
    { name: 'SEA SALT CARAMEL LATTE', mini: 99, classic: 120, upgrade: 150 },
    { name: 'COFFEE MINT', mini: 99, classic: 120, upgrade: 150 },
    { name: 'RHUMPUCCINO', mini: 99, classic: 135, upgrade: 150 },
    { name: 'BREWED', mini: 25, classic: 50, upgrade: 85 },
    { name: 'DIRTY MATCHA', classic: 120, upgrade: 150 },
    { name: 'FRAPPE CARAMEL MACCHIATO', regular: 150 },
  ]},
  { id: 'noncoffee', label: 'Non-coffee', items: [
    { name: 'STRAWBERRY LATTE', classic: 120, upgrade: 150 },
    { name: 'STRAWBERRY MATCHA', classic: 120, upgrade: 150 },
    { name: 'MATCHA LATTE', classic: 120, upgrade: 150 },
    { name: 'MILK CHOCOLATE', classic: 89, upgrade: 120 },
    { name: 'OREO CHOCOMILKSHAKE', classic: 120, upgrade: 150 },
    { name: 'FRAPPE STRAWBERRY', regular: 165 },
    { name: 'FRAPPE UBE HALAYA', regular: 150 },
    { name: 'FRAPPE CHOCOLATE', regular: 150 },
  ]},
  { id: 'milktea', label: 'Milk tea', items: [
    { name: 'M.T. - HOKKAIDO', regular: 55 },
    { name: 'M.T. - OKINAWA', regular: 55 },
    { name: 'M.T. - MANGO CHEESECAKE', regular: 60 },
    { name: 'M.T. - RED VELVET', regular: 60 },
    { name: 'M.T. - TARO', regular: 55 },
    { name: 'M.T. - BLACK FOREST', regular: 60 },
    { name: 'M.T. - DARK CHOCOLATE', regular: 60 },
    { name: 'M.T. - COOKIES AND CREAM', regular: 55 },
    { name: 'M.T. - WHITE BUNNY', regular: 60 },
    { name: 'M.T. - WINTERMELON', regular: 60 },
  ]},
  { id: 'soda', label: 'Soda & tea', items: [
    { name: 'SODA - PASSION', classic: 50 },
    { name: 'SODA - STRAWBERRY', classic: 50 },
    { name: 'SODA - BLUEBERRY', classic: 50 },
    { name: 'SODA - MANGO', classic: 50 },
    { name: 'TEA - BREAKFAST IN PARIS', classic: 50 },
    { name: 'TEA - CHAMOMILE', classic: 50 },
    { name: 'TEA - HIBISCUS', classic: 80 },
  ]},
  { id: 'pasta', label: 'Pasta', items: [
    { name: 'PASTA - CARBONARA', regular: 130 },
    { name: 'PASTA - BOLOGNESE', regular: 130 },
  ]},
  { id: 'rice', label: 'Rice meals', items: [
    { name: 'TAPSILOG', regular: 90 },
    { name: 'CORNSILOG', regular: 90 },
    { name: 'SPAMSILOG', regular: 80 },
    { name: 'PORK SISIG RICE', regular: 180 },
    { name: 'PORK EMBOTIDO RICE', regular: 129 },
    { name: 'LUMPIA RICE', regular: 80 },
    { name: 'PORKCHOP', regular: 150 },
    { name: 'RICE MEAL - C. TAPA', regular: 180 },
    { name: 'RICE MEAL - C. HOTDOG', regular: 90 },
    { name: 'RICE MEAL - C. PEPPER STEAK', regular: 180 },
    { name: 'RICE MEAL - C. KOREAN', regular: 180 },
    { name: 'RICE MEAL - C. INASAL', regular: 180 },
  ]},
  { id: 'pastries', label: 'Pastries & sweets', items: [
    { name: 'WAFFLE - MANGO', regular: 80 },
    { name: 'WAFFLE - CHOCOLATE', regular: 80 },
    { name: 'WAFFLE - BLUEBERRY', regular: 80 },
    { name: 'WAFFLE - OTHER', regular: 80 },
    { name: 'PASTRY - COOKIES', regular: 50 },
    { name: 'COOKIES SMALL', regular: 35 },
    { name: 'SWEET BITES', regular: 15 },
    { name: 'GRILLED CHEESE SANDWICH', regular: 80 },
  ]},
  { id: 'snacks', label: 'Snacks', items: [
    { name: 'CHEESE BURGER', regular: 50 },
    { name: 'SIOMAI', regular: 50 },
    { name: 'ONYX BURGER', regular: 150 },
    { name: 'NACHOS', regular: 130 },
    { name: 'FRIES OVERLOAD', regular: 90 },
  ]},
  { id: 'addons', label: 'Add-ons', items: [
    { name: 'PEARL', regular: 10 },
    { name: 'ESPRESSO SHOT', regular: 10 },
    { name: 'RICE', regular: 15 },
    { name: 'FRIES - SOUR CREAM', regular: 30 },
    { name: 'FRIES - CHEESE', regular: 30 },
    { name: 'FRIES - BBQ', regular: 30 },
    { name: 'Onyx Bracelet Small Beads',         regular: 25 },
    { name: 'Onyx Bracelet Medium Beads',         regular: 35 },
    { name: 'Onyx Bracelet Large Beads',         regular: 50 },
  ]},
];
const productColorMap = {};
function getProductColor(name) {
  if (!productColorMap[name]) {
    const idx = Object.keys(productColorMap).length % PRODUCT_COLORS.length;
    productColorMap[name] = PRODUCT_COLORS[idx];
  }
  return productColorMap[name];
}
function formatAmount(val) {
  return val >= 1000 ? `₱${(val / 1000).toFixed(1)}k` : `₱${val.toLocaleString()}`;
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
// Group a sold product into a reporting category (Drinks combines all beverages)
function catOf(name) {
  const n = normalizeMenu(name);
  if (n === 'RICE' || n === 'PEARL' || n === 'ESPRESSO SHOT') return 'Add-ons';
  if (n.startsWith('M.T.') || n.startsWith('SODA') || n.startsWith('TEA') || n.startsWith('FRAPPE')) return 'Drinks';
  if (/LATTE|AMERICANO|BREWED|MOCHA|CAPUCCINO|MACCHIATO|MATCHA|MILK CHOCOLATE|CHOCOMILK|RHUMPUCCINO|DIRTY|SPANISH|SEA SALT|COFFEE MINT/.test(n)) return 'Drinks';
  if (n.startsWith('PASTA')) return 'Pasta';
  if (/FRIES|BURGER|NACHOS|SIOMAI/.test(n)) return 'Snacks';
  if (/SILOG|RICE MEAL|PORK|LUMPIA|PORKCHOP|CHICKEN|INASAL|TAPA|EMBOTIDO|SISIG/.test(n)) return 'Rice meals';
  if (/WAFFLE|COOKIE|SWEET BITES|GRILLED CHEESE|PASTRY/.test(n)) return 'Pastries';
  return 'Other';
}
const REPORT_CAT_ORDER = ['Drinks', 'Pasta', 'Rice meals', 'Snacks', 'Pastries', 'Add-ons', 'Other'];
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
// List a spreadsheet's tabs (to find a tab by its gid / sheetId)
async function sheetMeta(token, sheetId) {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties(sheetId,title)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) throw new Error('Meta ' + r.status);
  return (await r.json()).sheets || [];
}
// Find the monthly overhead from a tab's rows.
// Handles a "Monthly Cost | Amount" breakdown (sums the Amount column),
// or a single "Operating cost / Overhead" labelled cell.
function parseOverhead(rows) {
  if (!rows || !rows.length) return null;
  // Case A — a breakdown table: header has "Amount" (+ a cost label) → sum that column
  let amtCol = -1, headerRow = -1;
  for (let i = 0; i < rows.length; i++) {
    const cells = (rows[i] || []).map(c => String(c || '').toLowerCase().trim());
    const ai = cells.findIndex(c => c === 'amount' || c.includes('amount'));
    const hasCostLabel = cells.some(c => c.includes('cost') || c.includes('monthly'));
    if (ai !== -1 && hasCostLabel) { amtCol = ai; headerRow = i; break; }
  }
  if (amtCol !== -1) {
    let sum = 0, found = false;
    for (let i = headerRow + 1; i < rows.length; i++) {
      const v = (rows[i] || [])[amtCol];
      const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.]/g, ''));
      if (!isNaN(n)) { sum += n; found = true; }
    }
    if (found) return sum;
  }
  // Case B — a single labelled cell
  for (const row of rows) {
    const cells = (row || []).map(x => String(x || ''));
    const labelIdx = cells.findIndex(c => /operating cost|overhead|op cost/i.test(c));
    if (labelIdx !== -1) {
      for (let j = 0; j < cells.length; j++) {
        if (j === labelIdx) continue;
        const n = parseFloat(cells[j].replace(/[^0-9.]/g, ''));
        if (!isNaN(n) && n > 0) return n;
      }
    }
  }
  return null;
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
  const [overhead, setOverhead] = useState(null);       // live: monthly operating cost
  const [accessToken, setAccessToken] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('daily');
  const [dailyTooltip, setDailyTooltip] = useState(null);
  const [weeklyTooltip, setWeeklyTooltip] = useState(null);
  const [openCat, setOpenCat] = useState('Drinks');   // which best-seller category is expanded
  const [showDailyRev, setShowDailyRev] = useState(false);   // collapse "Net revenue by day"
  const [showWeeklyRev, setShowWeeklyRev] = useState(false); // collapse "Net revenue by week"
  const [showUncosted, setShowUncosted] = useState(false);   // collapse "No capital cost yet"
  const [showComputation, setShowComputation] = useState(false); // collapse the profit breakdown
  const [openPriceGroup, setOpenPriceGroup] = useState(null);    // which suggested-prices group is open
  const [pricePct, setPricePct] = useState('');                  // extra % increase on top of overhead add
  const [marginPct, setMarginPct] = useState('80');              // target gross margin % (ignores overhead)
  const [openMarginGroup, setOpenMarginGroup] = useState(null);  // which margin-pricing group is open
  const [showBestSellers, setShowBestSellers] = useState(false); // collapse the whole Best sellers card
  const [showSuggested, setShowSuggested] = useState(false);     // collapse the whole Suggested prices card
  const [showMargin, setShowMargin] = useState(false);           // collapse the whole margin-pricing card
  const tokenClientRef = React.useRef(null);
  const syncedRef = React.useRef(false);
  // Firestore fallback (used until connected to Google)
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), snap => {
      const allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = allOrders.filter(o => {
        if (o.hidden) return false;                 // skip removed/hidden orders
        if (!o.createdAt?.toDate) return false;
        return isAfterReportStart(o.createdAt.toDate());
      });
      setFsOrders(filtered);
    });
    return () => unsub();
  }, []);
  // Load Google Identity Services — reuse a saved token, and re-auth silently (no button click)
  useEffect(() => {
    const TOKEN_KEY = 'theonyx_gtoken_reports';
    const saveToken = (res) => {
      if (!res || !res.access_token) return;
      setAccessToken(res.access_token);
      try {
        const exp = Date.now() + (Number(res.expires_in || 3600) - 60) * 1000; // refresh 1 min early
        localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: res.access_token, exp }));
      } catch (e) {}
    };
    // 1) Reuse a still-valid token from a previous visit (no prompt at all)
    try {
      const saved = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
      if (saved && saved.token && saved.exp > Date.now()) setAccessToken(saved.token);
    } catch (e) {}
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
    script.onload = () => {
      if (!window.google) return;
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID, scope: SCOPES,
        callback: saveToken,
      });
      // 2) If no valid saved token, try a SILENT grant (works once you've connected before — no click)
      let hasValid = false;
      try {
        const saved = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
        hasValid = !!(saved && saved.token && saved.exp > Date.now());
      } catch (e) {}
      if (!hasValid) {
        try { tokenClientRef.current.requestAccessToken({ prompt: '' }); } catch (e) {}
      }
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
    // Monthly overhead / operating cost (independent; found by gid)
    try {
      const sheets = await sheetMeta(accessToken, SHEET_ID_STOCK);
      const target = sheets.find(sh => sh.properties && sh.properties.sheetId === OVERHEAD_GID);
      if (target) {
        const ohRows = await sheetValues(accessToken, SHEET_ID_STOCK, `${target.properties.title}!A:Z`);
        const oh = parseOverhead(ohRows);
        if (oh != null) setOverhead(oh);
      }
    } catch (e) { console.error('Reports overhead sync:', e); }
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
  // Orders come from Firestore — real timestamps, always complete, and immune to
  // the sheet's Date-column formatting. Capital cost + overhead still sync from the sheet.
  const orders = fsOrders;
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
  // ── Revenue (Sales − Capital Cost) per period, for the Daily/Weekly/Monthly tabs ──
  const profitInRange = (start, end) => computeProfit(
    orders.filter(o => { const d = o.createdAt?.toDate && o.createdAt.toDate(); return d && d >= start && (!end || d < end); }),
    costMap
  );
  const dailyRev = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (6 - i));
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(start); end.setDate(start.getDate() + 1);
    const disabled = d < REPORT_START;
    const p = disabled ? { sales: 0, cost: 0, net: 0, matched: 0 } : profitInRange(start, end);
    return { label: DAYS[d.getDay()], disabled, ...p };
  });
  const weeklyRev = Array.from({ length: 4 }, (_, i) => {
    const mon = new Date(now); const dow = mon.getDay(); const diff = dow === 0 ? 6 : dow - 1;
    mon.setDate(mon.getDate() - diff - (3 - i) * 7); mon.setHours(0, 0, 0, 0);
    const end = new Date(mon); end.setDate(mon.getDate() + 7);
    return { label: `W${i + 1}`, ...profitInRange(mon, end) };
  });
  const m30start = new Date(now); m30start.setDate(now.getDate() - 29); m30start.setHours(0, 0, 0, 0);
  const monthlyRev = profitInRange(m30start, null);
  const marginOf = (p) => (p.matched > 0 ? Math.round((p.net / p.matched) * 100) : 0);
  // ── Overhead, break-even & month-end projection (calendar month to date) ──
  // No fallback — overhead is null until it's actually read from the sheet (so you know if it synced).
  const overheadKnown = overhead != null;
  const overheadVal = overhead || 0;
  const monthStartCal = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthCalRev = profitInRange(monthStartCal, null);
  const daysElapsed = Math.max(1, now.getDate());
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const netAfterOverhead = monthCalRev.net - overheadVal;       // gross profit so far minus full month's overhead
  const marginRatio = monthCalRev.sales > 0 ? monthCalRev.net / monthCalRev.sales : 0;
  const breakEvenSales = marginRatio > 0 ? overheadVal / marginRatio : 0;
  const dailyTargetSales = breakEvenSales / daysInMonth;
  const projSales = monthCalRev.sales / daysElapsed * daysInMonth;
  const projNet = monthCalRev.net / daysElapsed * daysInMonth;  // projected gross profit
  const projProfit = projNet - overheadVal;                     // projected profit after overhead
  // How much to add per item (price tweak) to cover overhead
  const monthOrders = orders.filter(o => { const d = o.createdAt?.toDate && o.createdAt.toDate(); return d && d >= monthStartCal; });
  const itemsMTD = monthOrders.reduce((sm, o) => sm + (o.items || []).reduce((q, it) => q + (Number(it.qty) || 0), 0), 0);
  const projItems = daysElapsed > 0 ? Math.round(itemsMTD / daysElapsed * daysInMonth) : 0;
  const addPerItemShortfall = (projProfit < 0 && projItems > 0) ? (-projProfit) / projItems : 0;
  const addPerItemOverhead = projItems > 0 ? overheadVal / projItems : 0;
  // Overhead share to add per item (full overhead ÷ projected items) — changes whenever overhead changes.
  // 0 only when overhead isn't synced yet.
  const flatAddPerItem = overheadKnown ? addPerItemOverhead : 0;
  // Top 10 products
  const productMap = {};
  const productQty = {};
  orders.forEach(order => {
    (order.items || []).forEach(item => {
      if (!productMap[item.name]) productMap[item.name] = 0;
      if (!productQty[item.name]) productQty[item.name] = 0;
      productMap[item.name] += (item.price || 0) * (item.qty || 1);
      productQty[item.name] += (item.qty || 1);
    });
  });
  const totalSales = Object.values(productMap).reduce((a, b) => a + b, 0);
  const top10 = Object.entries(productMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
  // Best sellers per category — Drinks top 10, every other category top 5
  const catProducts = {};
  Object.entries(productMap).forEach(([name, sales]) => {
    const c = catOf(name);
    (catProducts[c] = catProducts[c] || []).push([name, sales]);
  });
  Object.keys(catProducts).forEach(c => catProducts[c].sort((a, b) => b[1] - a[1]));
  const catSections = REPORT_CAT_ORDER
    .filter(c => catProducts[c] && catProducts[c].length)
    .map(c => ({
      cat: c,
      total: catProducts[c].reduce((sm, [, v]) => sm + v, 0),
      items: catProducts[c].slice(0, c === 'Drinks' ? 10 : 5),
    }));
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
  const peso = (v) => (v < 0 ? '-₱' : '₱') + Math.round(Math.abs(v)).toLocaleString();
  const tooltipTopOffset = dailyTooltip
    ? Math.max(52, 36 + dailyTooltip.products.length * 20)
    : 32;
  return (
    <div style={s.page}>
      <div style={s.title}>Reports</div>
      <div style={s.sub}>Sales overview · From Jun 4 · From app data</div>
      {/* Google connect / sync */}
      {!accessToken ? (
        <button style={s.connBtn} onClick={() => tokenClientRef.current?.requestAccessToken()}>
          Connect Google to sync sheets
        </button>
      ) : (
        <div style={s.syncBar}>
          <span style={s.syncBadge}>
            {sheetCost
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
          <div style={s.statNum('var(--brown-dark)')}>₱{todayTotal.toLocaleString()}</div>
          <div style={s.statLabel}>Today</div>
        </div>
        <div style={s.statBox}>
          <div style={s.statNum('var(--brown-mid)')}>₱{weekTotal.toLocaleString()}</div>
          <div style={s.statLabel}>This Week</div>
        </div>
        <div style={s.statBox}>
          <div style={s.statNum('var(--gold)')}>₱{monthTotal.toLocaleString()}</div>
          <div style={s.statLabel}>This Month</div>
        </div>
        <div style={s.statBox}>
          <div style={s.statNum('var(--green-ok)')}>{orders.length}</div>
          <div style={s.statLabel}>Total Orders</div>
        </div>
      </div>
      {/* Profit this month — after overhead (hero) */}
      <div style={s.card}>
        <div style={s.cardTitle}>Profit this month · after overhead{overheadKnown ? '' : ' · not synced'}</div>
        {/* Big net-after-overhead number */}
        <div style={{ fontSize: 11, color: 'var(--brown-light)' }}>Net profit this month</div>
        <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', color: !overheadKnown ? 'var(--brown-light)' : (netAfterOverhead >= 0 ? 'var(--green-ok)' : '#a3402d'), margin: '2px 0 12px' }}>{overheadKnown ? peso(netAfterOverhead) : '—'}</div>
        {!overheadKnown && (
          <div style={{ fontSize: 12, color: 'var(--brown-light)', background: 'var(--cream)', border: '0.5px solid #e6d6c0', borderRadius: 10, padding: '10px 12px', marginBottom: 12, lineHeight: 1.5 }}>
            Overhead not loaded yet. Connect Google and tap <b style={{ color: 'var(--gold)' }}>Sync</b> to read it from the sheet.
          </div>
        )}
        {/* Computation (collapsible) */}
        <div onClick={() => setShowComputation(v => !v)} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: showComputation ? 8 : 12 }}>
          <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: 'var(--brown-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Breakdown</div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showComputation ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9" /></svg>
        </div>
        {showComputation && (
          <div style={{ background: 'var(--cream)', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--brown-dark)', padding: '4px 0' }}><span>Sales (this month)</span><span style={{ fontWeight: 600 }}>{peso(monthCalRev.sales)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--brown-mid)', padding: '4px 0' }}><span>− Capital cost</span><span style={{ fontWeight: 600 }}>{peso(monthCalRev.cost)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--brown-mid)', padding: '4px 0 8px', borderBottom: '1px dashed #e3d0b4' }}><span>− Overhead (monthly)</span><span style={{ fontWeight: 600 }}>{overheadKnown ? peso(overheadVal) : '— not synced'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, color: !overheadKnown ? 'var(--brown-light)' : (netAfterOverhead >= 0 ? 'var(--green-ok)' : '#a3402d'), padding: '8px 0 2px' }}><span>= Net profit</span><span>{overheadKnown ? peso(netAfterOverhead) : '—'}</span></div>
          </div>
        )}
        {/* Projection — only when overhead is synced */}
        {overheadKnown && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: projProfit >= 0 ? 'var(--cream)' : '#fbeeea', border: `0.5px solid ${projProfit >= 0 ? '#e6d6c0' : '#eccfc7'}`, borderRadius: 10, padding: '9px 12px', marginBottom: 14 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={projProfit >= 0 ? 'var(--green-ok)' : '#a3402d'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
            <div style={{ flex: 1, fontSize: 12, color: 'var(--brown-dark)', lineHeight: 1.4 }}>
              Projected month-end: <b>{peso(projProfit)}</b>
              <div style={{ fontSize: 11, color: 'var(--brown-light)' }}>{projProfit >= 0 ? 'On track to cover overhead' : `Short by ${peso(-projProfit)} · projected sales ${peso(projSales)}`}</div>
            </div>
          </div>
        )}
        {/* Key metrics */}
        <div style={s.statGrid}>
          <div style={s.statBox}>
            <div style={s.statNum('var(--green-ok)')}>{peso(monthCalRev.net)}</div>
            <div style={s.statLabel}>Gross profit</div>
            <div style={{ fontSize: 10, color: 'var(--brown-light)', marginTop: 1 }}>Sales − capital cost</div>
          </div>
          <div style={s.statBox}>
            <div style={s.statNum('var(--gold)')}>{marginOf(monthCalRev)}%</div>
            <div style={s.statLabel}>Gross margin</div>
            <div style={{ fontSize: 10, color: 'var(--brown-light)', marginTop: 1 }}>Profit per ₱1 of sales</div>
          </div>
        </div>
        {/* Break-even (card with target icon) — only when overhead is synced */}
        {overheadKnown && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--cream)', border: '0.5px solid #e6d6c0', borderRadius: 12, padding: '12px 14px', marginTop: 12 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brown-dark)' }}>Break-even sales</div>
              <div style={{ fontSize: 10.5, color: 'var(--brown-light)' }}>to cover {peso(overheadVal)} overhead</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--brown-dark)' }}>{peso(breakEvenSales)}<span style={{ fontSize: 10, color: 'var(--brown-light)' }}>/mo</span></div>
              <div style={{ fontSize: 10.5, color: 'var(--brown-light)' }}>Daily target {peso(dailyTargetSales)}</div>
            </div>
          </div>
        )}
        {/* Coverage + uncosted */}
        <div style={{ fontSize: 11, color: 'var(--brown-light)', lineHeight: 1.5, marginTop: 12 }}>
          {coverageAll}% of sales has a capital cost set — profit is approximate while {uncostedAll.length} item{uncostedAll.length !== 1 ? 's have' : ' has'} no cost yet. {overheadKnown ? `Overhead read live from the sheet (${peso(overheadVal)}).` : 'Overhead not synced yet — tap Sync.'}
        </div>
        {uncostedAll.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div onClick={() => setShowUncosted(v => !v)} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: showUncosted ? 6 : 0 }}>
              <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: 'var(--brown-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                No capital cost yet ({uncostedAll.length})
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showUncosted ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9" /></svg>
            </div>
            {showUncosted && (
              <>
                {uncostedAll.slice(0, 8).map(([name, sales]) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--brown-light)', padding: '3px 0' }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    <span style={{ flexShrink: 0, marginLeft: 8 }}>{peso(sales)} sales</span>
                  </div>
                ))}
                <div style={{ fontSize: 10, color: 'var(--brown-light)', marginTop: 6, fontStyle: 'italic' }}>
                  Add their cost in the "Capital Cost" tab — updates automatically when you Sync.
                </div>
              </>
            )}
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
          {/* Net revenue by day (collapsible) */}
          <div style={{ marginTop: 14, borderTop: '1px solid #f0e4d8', paddingTop: 10 }}>
            <div onClick={() => setShowDailyRev(v => !v)} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: showDailyRev ? 10 : 0 }}>
              <div style={{ ...s.cardTitle, marginBottom: 0, flex: 1 }}>Net revenue by day</div>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showDailyRev ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9" /></svg>
            </div>
            {showDailyRev && dailyRev.filter(d => !d.disabled).map(d => (
              <div key={d.label} style={s.productRow}>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--brown-dark)' }}>{d.label}</div>
                <div style={{ fontSize: 10.5, color: 'var(--brown-light)', textAlign: 'right', marginRight: 10, lineHeight: 1.4 }}>S {peso(d.sales)}<br />C {peso(d.cost)}</div>
                <div style={{ textAlign: 'right', minWidth: 66 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--green-ok)' }}>{peso(d.net)}</div>
                  <div style={{ fontSize: 10, color: 'var(--gold)' }}>{marginOf(d)}%</div>
                </div>
              </div>
            ))}
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
          {/* Net revenue by week (collapsible) */}
          <div style={{ marginTop: 14, borderTop: '1px solid #f0e4d8', paddingTop: 10 }}>
            <div onClick={() => setShowWeeklyRev(v => !v)} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: showWeeklyRev ? 10 : 0 }}>
              <div style={{ ...s.cardTitle, marginBottom: 0, flex: 1 }}>Net revenue by week</div>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showWeeklyRev ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9" /></svg>
            </div>
            {showWeeklyRev && weeklyRev.map((w, i) => (
              <div key={w.label} style={s.productRow}>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--brown-dark)' }}>{w.label}<span style={{ fontSize: 9, color: 'var(--brown-light)', fontWeight: 400, marginLeft: 6 }}>{weeklyData[i]?.dateRange}</span></div>
                <div style={{ fontSize: 10.5, color: 'var(--brown-light)', textAlign: 'right', marginRight: 10, lineHeight: 1.4 }}>S {peso(w.sales)}<br />C {peso(w.cost)}</div>
                <div style={{ textAlign: 'right', minWidth: 66 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--green-ok)' }}>{peso(w.net)}</div>
                  <div style={{ fontSize: 10, color: 'var(--gold)' }}>{marginOf(w)}%</div>
                </div>
              </div>
            ))}
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
          {/* Net revenue — last 30 days */}
          <div style={{ marginTop: 14, borderTop: '1px solid #f0e4d8', paddingTop: 10 }}>
            <div style={s.cardTitle}>Net revenue — last 30 days</div>
            <div style={s.statGrid}>
              <div style={s.statBox}><div style={s.statNum('var(--brown-dark)')}>{peso(monthlyRev.sales)}</div><div style={s.statLabel}>Total Sales</div></div>
              <div style={s.statBox}><div style={s.statNum('var(--brown-mid)')}>{peso(monthlyRev.cost)}</div><div style={s.statLabel}>Capital Cost</div></div>
              <div style={s.statBox}><div style={s.statNum('var(--green-ok)')}>{peso(monthlyRev.net)}</div><div style={s.statLabel}>Net Revenue</div></div>
              <div style={s.statBox}><div style={s.statNum('var(--gold)')}>{marginOf(monthlyRev)}%</div><div style={s.statLabel}>Gross Margin</div></div>
            </div>
          </div>
        </div>
      )}
      {/* Best sellers — one card, tap a category to expand (Drinks top 10, others top 5) */}
      {catSections.length > 0 && (
        <div style={s.card}>
          <div onClick={() => setShowBestSellers(v => !v)} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: showBestSellers ? 12 : 0 }}>
            <div style={{ ...s.cardTitle, marginBottom: 0, flex: 1 }}>Best sellers</div>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showBestSellers ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9" /></svg>
          </div>
          {showBestSellers && catSections.map((sec, si) => {
            const limit = sec.cat === 'Drinks' ? 10 : 5;
            const open = openCat === sec.cat;
            const maxVal = sec.items[0] ? sec.items[0][1] : 1;
            return (
              <div key={sec.cat} style={{ borderTop: si === 0 ? 'none' : '1px solid #f0e4d8' }}>
                <div onClick={() => setOpenCat(open ? null : sec.cat)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 0', cursor: 'pointer' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brown-dark)' }}>{sec.cat}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--brown-light)' }}>Top {limit} · {sec.items.length} item{sec.items.length !== 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brown-dark)', marginRight: 8 }}>₱{Math.round(sec.total).toLocaleString()}</div>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>
                </div>
                {open && (
                  <div style={{ paddingBottom: 8 }}>
                    {sec.items.map(([name, sales], i) => (
                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0' }}>
                        <div style={s.rank}>{i + 1}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brown-dark)' }}>{name}</div>
                          <div style={{ height: 4, background: '#f0e4d8', borderRadius: 2, marginTop: 4 }}>
                            <div style={{ height: '100%', background: 'var(--brown-mid)', borderRadius: 2, width: `${(sales / maxVal) * 100}%` }} />
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
              </div>
            );
          })}
        </div>
      )}
      {/* Suggested prices per size — overhead add (default) + your % increase */}
      <div style={s.card}>
        <div onClick={() => setShowSuggested(v => !v)} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: showSuggested ? 12 : 0 }}>
          <div style={{ ...s.cardTitle, marginBottom: 0, flex: 1 }}>Suggested prices</div>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showSuggested ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9" /></svg>
        </div>
        {showSuggested && (<>
        {/* % increase input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brown-dark)' }}>Extra increase</span>
          <input
            type="number" min="0" inputMode="decimal" value={pricePct}
            onChange={e => setPricePct(e.target.value)} placeholder="0"
            style={{ width: 64, padding: '7px 9px', borderRadius: 9, border: '0.5px solid #e3d0b4', fontSize: 13, background: '#fff', color: '#3a2613', textAlign: 'right', fontFamily: 'inherit', outline: 'none' }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brown-dark)' }}>%</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--brown-light)', marginBottom: 10, lineHeight: 1.5 }}>
          New price = current{overheadKnown ? <> + <b>{peso(flatAddPerItem)}</b> (covers overhead)</> : ''}{(Number(pricePct) || 0) > 0 ? <> + {pricePct}% on top</> : ''}{!overheadKnown && (Number(pricePct) || 0) === 0 ? <> · <span style={{ color: 'var(--gold)' }}>Sync overhead or type a %</span></> : ''}.
        </div>
        {MENU_PRICING.map((group, gi) => {
          const open = openPriceGroup === group.id;
          const pct = Number(pricePct) || 0;
          const newPriceOf = (p) => p * (1 + pct / 100) + flatAddPerItem;
          return (
            <div key={group.id} style={{ borderTop: '1px solid #f0e4d8' }}>
              <div onClick={() => setOpenPriceGroup(open ? null : group.id)} style={{ display: 'flex', alignItems: 'center', padding: '11px 0', cursor: 'pointer' }}>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--brown-dark)' }}>{group.label}</div>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>
              </div>
              {open && (
                <div style={{ paddingBottom: 8 }}>
                  {group.items.map(item => (
                    <div key={item.name} style={{ padding: '7px 0', borderTop: '1px solid #f7f0e6' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brown-dark)', marginBottom: 5 }}>{item.name}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {SIZES.filter(sz => item[sz]).map(sz => (
                          <span key={sz} style={{ fontSize: 10.5, color: 'var(--brown-dark)', background: 'var(--cream)', border: '0.5px solid #e6d6c0', borderRadius: 8, padding: '4px 8px' }}>
                            {SIZE_LABELS[sz]} <span style={{ color: 'var(--brown-light)' }}>{peso(item[sz])}</span> → <b style={{ color: 'var(--green-ok)' }}>{peso(newPriceOf(item[sz]))}</b>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div style={{ fontSize: 10, color: 'var(--brown-light)', marginTop: 8, fontStyle: 'italic', lineHeight: 1.5 }}>
          {overheadKnown ? `Default adds ${peso(flatAddPerItem)} per item — the overhead (${peso(overheadVal)}) shared across ~${projItems.toLocaleString()} projected items. Changes when overhead changes. ` : 'Overhead not synced — tap Sync to include the overhead add. '}Type a % to raise prices further. Round to your preferred price.
        </div>
        </>)}
      </div>
      {/* Price by gross margin — ignores overhead, based on capital cost */}
      <div style={s.card}>
        <div onClick={() => setShowMargin(v => !v)} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: showMargin ? 12 : 0 }}>
          <div style={{ ...s.cardTitle, marginBottom: 0, flex: 1 }}>Price by gross margin · ignores overhead</div>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showMargin ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9" /></svg>
        </div>
        {showMargin && (<>
        {/* margin input + list */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brown-dark)' }}>Target margin</span>
          <input
            type="number" min="0" max="95" inputMode="decimal" value={marginPct}
            onChange={e => setMarginPct(e.target.value)} placeholder="80"
            style={{ width: 64, padding: '7px 9px', borderRadius: 9, border: '0.5px solid #e3d0b4', fontSize: 13, background: '#fff', color: '#3a2613', textAlign: 'right', fontFamily: 'inherit', outline: 'none' }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brown-dark)' }}>%</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--brown-light)', marginBottom: 10, lineHeight: 1.5 }}>
          Target price = capital cost ÷ (1 − margin). Shown only for items with a capital cost set.
        </div>
        {(() => {
          const m = Math.min(0.95, Math.max(0, (Number(marginPct) || 0) / 100));
          return MENU_PRICING.map(group => {
            const open = openMarginGroup === group.id;
            const priced = group.items.filter(it => getCostFrom(costMap, it.name) != null).length;
            return (
              <div key={group.id} style={{ borderTop: '1px solid #f0e4d8' }}>
                <div onClick={() => setOpenMarginGroup(open ? null : group.id)} style={{ display: 'flex', alignItems: 'center', padding: '11px 0', cursor: 'pointer' }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--brown-dark)' }}>{group.label}<span style={{ fontSize: 10, color: 'var(--brown-light)', fontWeight: 400, marginLeft: 6 }}>{priced}/{group.items.length} priced</span></div>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>
                </div>
                {open && (
                  <div style={{ paddingBottom: 8 }}>
                    {group.items.map(item => {
                      const cost = getCostFrom(costMap, item.name);
                      return (
                        <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderTop: '1px solid #f7f0e6' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brown-dark)' }}>{item.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--brown-light)' }}>{cost != null ? `cost ${peso(cost)}` : 'no cost set'}</div>
                          </div>
                          {cost != null
                            ? <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-ok)' }}>{peso(cost / (1 - m))}</div>
                            : <div style={{ fontSize: 11, color: 'var(--brown-light)' }}>—</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          });
        })()}
        <div style={{ fontSize: 10, color: 'var(--brown-light)', marginTop: 8, fontStyle: 'italic', lineHeight: 1.5 }}>
          Pure product margin (price vs. capital cost) — does not include overhead. Add capital costs in the "Capital Cost" tab to price more items.
        </div>
        </>)}
      </div>
      <div style={{ height: 80 }} />
    </div>
  );
}
