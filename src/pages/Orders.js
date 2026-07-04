import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase/config';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, updateDoc, doc } from 'firebase/firestore';
const GOOGLE_CLIENT_ID = '596322682185-n5hm66hvol3nnqqllnuop995kcnefbgu.apps.googleusercontent.com';
const SALES_SHEET_ID = '1yadv9UgY8mFQzSwLsw3Qk3EepZeLL8dNl3YRtYsGZQU';
const SALES_SHEET_TAB = 'Sheet1';
const RECEIPT_FOLDER_ID = '16FGEhlHtHObYC0pBg0jfphsNxksdWF1m';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';
const TOKEN_KEY = 'theonyx_gtoken_rw'; // shared with Inventory (same read/write scope)
const PAYMENT_METHODS = ['Cash', 'GCash', 'Maya', 'Card'];
const SIZES = ['mini', 'classic', 'upgrade', 'regular'];
const SIZE_LABELS = { mini: 'Mini', classic: 'Classic', upgrade: 'Upgrade', regular: 'Regular' };
const MENU_GROUPS = [
  { id: 'espresso', label: 'Espresso based', items: [
    { name: 'COFFEE LATTE',          mini: 75,  classic: 85,  upgrade: 95  },
    { name: 'CARAMEL MACCHIATO',     mini: 99,  classic: 120, upgrade: 150 },
    { name: 'AMERICANO',             mini: 50,  classic: 75,  upgrade: 99  },
    { name: 'CAPUCCINO',             mini: 50,  classic: 85,  upgrade: 120 },
    { name: 'SPANISH LATTE',         mini: 99,  classic: 120, upgrade: 150 },
    { name: 'MOCHA',                 mini: 99,  classic: 120, upgrade: 150 },
    { name: 'SEA SALT CARAMEL LATTE',mini: 99,  classic: 120, upgrade: 150 },
    { name: 'COFFEE MINT',           mini: 99,  classic: 120, upgrade: 150 },
    { name: 'RHUMPUCCINO',           mini: 99,  classic: 135, upgrade: 150 },
    { name: 'BREWED',                mini: 25,  classic: 50,  upgrade: 85  },
    { name: 'DIRTY MATCHA',            classic: 120, upgrade: 150 },
    { name: 'FRAPPE CARAMEL MACCHIATO',regular: 150 },
  ]},
  { id: 'noncoffee', label: 'Non-coffee', items: [
    { name: 'STRAWBERRY LATTE',        classic: 120, upgrade: 150 },
    { name: 'STRAWBERRY MATCHA',       classic: 120, upgrade: 150 },
    { name: 'MATCHA LATTE',            classic: 120, upgrade: 150 },
    { name: 'MILK CHOCOLATE',          classic: 89,  upgrade: 120 },
    { name: 'OREO CHOCOMILKSHAKE',     classic: 120, upgrade: 150 },
    { name: 'FRAPPE STRAWBERRY',       regular: 165 },
    { name: 'FRAPPE UBE HALAYA',       regular: 150 },
    { name: 'FRAPPE CHOCOLATE',        regular: 150 },
  ]},
  { id: 'milktea', label: 'Milk tea', items: [
    { name: 'M.T. - HOKKAIDO',       regular: 55 },
    { name: 'M.T. - OKINAWA',        regular: 55 },
    { name: 'M.T. - MANGO CHEESECAKE',regular: 60 },
    { name: 'M.T. - RED VELVET',     regular: 60 },
    { name: 'M.T. - TARO',           regular: 55 },
    { name: 'M.T. - BLACK FOREST',   regular: 60 },
    { name: 'M.T. - DARK CHOCOLATE', regular: 60 },
    { name: 'M.T. - COOKIES AND CREAM',regular: 55 },
    { name: 'M.T. - WHITE BUNNY',    regular: 60 },
    { name: 'M.T. - WINTERMELON',    regular: 60 },
  ]},
  { id: 'soda', label: 'Soda & tea', items: [
    { name: 'SODA - PASSION',          classic: 50 },
    { name: 'SODA - STRAWBERRY',       classic: 50 },
    { name: 'SODA - BLUEBERRY',        classic: 50 },
    { name: 'SODA - MANGO',            classic: 50 },
    { name: 'TEA - BREAKFAST IN PARIS',classic: 50 },
    { name: 'TEA - CHAMOMILE',         classic: 50 },
    { name: 'TEA - HIBISCUS',          classic: 80 },
  ]},
  { id: 'pasta', label: 'Pasta', items: [
    { name: 'PASTA - CARBONARA', regular: 130 },
    { name: 'PASTA - BOLOGNESE', regular: 130 },
  ]},
  { id: 'rice', label: 'Rice meals', items: [
    { name: 'TAPSILOG',               regular: 90  },
    { name: 'CORNSILOG',              regular: 90  },
    { name: 'SPAMSILOG',              regular: 80  },
    { name: 'PORK SISIG RICE',        regular: 180 },
    { name: 'PORK EMBOTIDO RICE',     regular: 129 },
    { name: 'LUMPIA RICE',            regular: 80  },
    { name: 'PORKCHOP',               regular: 150 },
    { name: 'RICE MEAL - C. TAPA',    regular: 180 },
    { name: 'RICE MEAL - C. HOTDOG',  regular: 90  },
    { name: 'RICE MEAL - C. PEPPER STEAK', regular: 180 },
    { name: 'RICE MEAL - C. KOREAN',  regular: 180 },
    { name: 'RICE MEAL - C. INASAL',  regular: 180 },
  ]},
  { id: 'pastries', label: 'Pastries & sweets', items: [
    { name: 'WAFFLE - MANGO',       regular: 80 },
    { name: 'WAFFLE - CHOCOLATE',   regular: 80 },
    { name: 'WAFFLE - BLUEBERRY',   regular: 80 },
    { name: 'WAFFLE - OTHER',       regular: 80 },
    { name: 'PASTRY - COOKIES',     regular: 50 },
    { name: 'COOKIES SMALL',        regular: 35 },
    { name: 'SWEET BITES',          regular: 15 },
    { name: 'GRILLED CHEESE SANDWICH', regular: 80 },
  ]},
  { id: 'snacks', label: 'Snacks', items: [
    { name: 'CHEESE BURGER',   regular: 50  },
    { name: 'SIOMAI',   regular: 50  },
    { name: 'ONYX BURGER',     regular: 150 },
    { name: 'NACHOS',          regular: 130 },
    { name: 'FRIES OVERLOAD',     regular: 90  },
  ]},
  { id: 'addons', label: 'Add-ons', items: [
    { name: 'PEARL',        regular: 10 },
    { name: 'ESPRESSO SHOT',regular: 10 },
    { name: 'RICE',         regular: 15 },
    { name: 'Fries - BBQ', regular: 30 },
    { name: 'Fries - Sour Cream', regular: 30 },
    { name: 'Fries - Cheese', regular: 30 },
    { name: 'Onyx Bracelet Small Beads', regular: 25 },
    { name: 'Onyx Bracelet Medium Beads', regular: 35 },
    { name: 'Onyx Bracelet Large Beads', regular: 50 },
  ]},
];
const C = {
  ink: '#3a2613', gold: '#b07d35', goldDeep: '#8a6320', muted: '#9c7f5e',
  cream: '#fbf6ef', card: '#f4e9d8', cardBorder: '#e6d6c0',
  row: '#f7f0e6', rowBorder: '#ead9c2', dark: '#3a2613', darker: '#281607',
  goldBright: '#c8943a', pill: '#f0e2cd', pillBorder: '#e3d0b4',
  red: '#a3402d', redBg: '#fbeeea', redBorder: '#eccfc7', muteDash: '#d9c3a6',
  green: '#5a8a3a', greenBg: '#f1f7e9', greenBorder: '#d7e8c0',
  white: '#fff', input: '#fbf6ef', inputBorder: '#e3d0b4',
  selectedBg: '#edf7e4', selectedBorder: '#8bc34a',
};
const s = {
  page: { padding: '16px 16px 0', animation: 'fadeIn 0.3s ease' },
  title: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 4 },
  sub: { fontSize: 13, color: C.muted, marginBottom: 14 },
  tabBar: { display: 'flex', background: C.pill, borderRadius: 11, padding: 3, gap: 3, marginBottom: 16 },
  tab: (on) => ({ flex: 1, border: 'none', background: on ? C.gold : 'transparent', color: on ? '#fff' : C.muted, fontSize: 12.5, fontWeight: on ? 700 : 600, padding: '9px 4px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }),
  groupCard: { background: C.card, borderRadius: 12, marginBottom: 8, border: `0.5px solid ${C.cardBorder}`, overflow: 'hidden' },
  groupHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px', cursor: 'pointer' },
  groupLabel: { fontSize: 14, fontWeight: 600, color: C.ink },
  itemRow: (selected) => ({
    display: 'flex', alignItems: 'center', padding: '10px 14px',
    borderTop: `0.5px solid ${C.rowBorder}`,
    background: selected ? C.selectedBg : 'transparent',
    transition: 'background 0.15s',
  }),
  itemName: { fontSize: 12, fontWeight: 600, color: C.ink, flex: 1 },
  sizeBtn: (selected) => ({
    padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
    border: selected ? `2px solid ${C.green}` : `1px solid ${C.pillBorder}`,
    background: selected ? C.selectedBg : C.cream,
    color: selected ? C.green : C.goldDeep,
    position: 'relative',
    display: 'inline-flex', alignItems: 'center', gap: 4,
  }),
  minusInPill: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: C.green, color: '#fff',
    borderRadius: 4, width: 16, height: 16,
    fontSize: 14, fontWeight: 700, lineHeight: 1,
    flexShrink: 0,
  },
  input: { width: '100%', padding: '11px 13px', borderRadius: 10, border: `0.5px solid ${C.inputBorder}`, fontSize: 14, background: C.input, color: C.ink, outline: 'none', boxSizing: 'border-box', marginBottom: 10, fontFamily: 'inherit' },
  label: { display: 'block', fontSize: 11.5, fontWeight: 600, color: C.muted, marginBottom: 5 },
  orderPanel: { background: C.card, borderRadius: 14, padding: '14px', marginTop: 12, border: `0.5px solid ${C.cardBorder}` },
  orderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `0.5px solid ${C.rowBorder}`, fontSize: 12 },
  total: { display: 'flex', justifyContent: 'space-between', padding: '11px 0 4px', fontWeight: 700, fontSize: 17, color: C.ink },
  primaryBtn: { width: '100%', padding: '13px', borderRadius: 11, background: C.gold, color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', marginTop: 10 },
  darkBtn: { width: '100%', padding: '13px', borderRadius: 11, background: C.darker, color: C.goldBright, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', marginTop: 8 },
  syncMissingBtn: { width: '100%', padding: '10px', borderRadius: 10, background: C.pill, color: C.goldDeep, fontSize: 12.5, fontWeight: 700, border: `0.5px solid ${C.pillBorder}`, cursor: 'pointer', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 },
  modal: { position: 'fixed', inset: 0, background: 'rgba(26,10,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modalCard: { background: C.cream, borderRadius: '20px 20px 0 0', padding: '26px 22px 38px', width: '100%', maxWidth: 480, animation: 'slideUp 0.3s ease', maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: C.ink, marginBottom: 16, textAlign: 'center' },
  receiptHeader: { textAlign: 'center', marginBottom: 16, borderBottom: `1px dashed ${C.pillBorder}`, paddingBottom: 12 },
  receiptRow: { display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', color: C.ink },
  receiptTotal: { display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, padding: '10px 0 0', borderTop: `2px solid ${C.ink}`, marginTop: 6, color: C.ink },
  cancelBtn: { width: '100%', padding: '12px', borderRadius: 11, background: 'transparent', color: C.muted, fontSize: 13, border: `0.5px solid ${C.inputBorder}`, cursor: 'pointer', marginTop: 8 },
  connectBtn: { width: '100%', padding: '12px', borderRadius: 11, background: C.darker, color: C.goldBright, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 },
  connectedBadge: { background: C.greenBg, color: C.green, borderRadius: 10, padding: '9px 12px', fontSize: 12, fontWeight: 500, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7, border: `0.5px solid ${C.greenBorder}` },
  pill: { fontSize: 11, color: C.goldDeep, background: C.pill, border: `0.5px solid ${C.pillBorder}`, borderRadius: 20, padding: '3px 10px' },
  dateHdr: { fontSize: 11, color: C.muted, margin: '4px 0 8px', display: 'flex', alignItems: 'center', gap: 6 },
  recCard: { background: C.card, border: `0.5px solid ${C.cardBorder}`, borderRadius: 11, marginBottom: 8, overflow: 'hidden' },
  ohead: { padding: '10px 12px', cursor: 'pointer' },
  custName: { fontSize: 13.5, fontWeight: 600, color: C.ink, display: 'flex', alignItems: 'center', gap: 6 },
  metaLine: { fontSize: 10.5, color: C.muted, marginTop: 2 },
  totalTop: { fontSize: 15, fontWeight: 700, color: C.ink },
  detItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' },
  smallEdit: { background: C.pill, border: `0.5px solid ${C.pillBorder}`, borderRadius: 7, color: C.gold, padding: '4px 7px', cursor: 'pointer', lineHeight: 0 },
  editTag: { marginTop: 4, fontSize: 10, color: C.goldDeep, background: C.pill, borderRadius: 6, padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: 4 },
  totalPaid: { display: 'flex', justifyContent: 'space-between', borderTop: `2px solid ${C.ink}`, marginTop: 7, paddingTop: 7 },
  removeBtn: { width: '100%', marginTop: 9, background: 'transparent', border: `0.5px solid ${C.redBorder}`, borderRadius: 9, color: C.red, padding: '8px', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  metricCard: { flex: 1, background: C.card, border: `0.5px solid ${C.cardBorder}`, borderRadius: 12, padding: '13px', textAlign: 'center' },
  metricDark: { flex: 1, background: C.darker, borderRadius: 12, padding: '13px', textAlign: 'center' },
  disabledOverlay: { background: 'rgba(251,246,239,0.85)', borderRadius: 12, border: `1px dashed ${C.pillBorder}`, padding: '28px 20px', textAlign: 'center', marginTop: 8 },
  // ── Order complete popup ──
  completeOverlay: { position: 'fixed', inset: 0, background: 'rgba(26,10,0,0.65)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  completeCard: { background: C.cream, borderRadius: 24, padding: '36px 28px 28px', textAlign: 'center', width: 280, animation: 'popIn 0.4s cubic-bezier(.34,1.56,.64,1)' },
};
const Chev = ({ open }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9" /></svg>
);
const CheckIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);
const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
);
const CalIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
);
const UserIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
);
const LinkIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.goldBright} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
);
const tsToDate = (ts) => (ts && ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : null));
const fmtTime12 = (d) => (d ? d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : '—');
const fmtDateLabel = (d) => (d ? d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Today');
// Parse a sheet row's date + time back into a JS Date (for the backfill "last synced" check)
const parseSheetDateTime = (dateStr, timeStr) => {
  const dm = String(dateStr || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!dm) return null;
  let yr = Number(dm[3]); if (yr < 100) yr += 2000;
  let h = 0, mi = 0;
  const tm = String(timeStr || '').match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (tm) { h = Number(tm[1]) % 12; if (tm[4] && /pm/i.test(tm[4])) h += 12; mi = Number(tm[2]); }
  return new Date(yr, Number(dm[1]) - 1, Number(dm[2]), h, mi);
};
export default function Orders({ userName, role }) {
  const isManager = String(role || '').trim().toLowerCase() === 'manager';
  const [tab, setTab] = useState(1);
  const [openGroup, setOpenGroup] = useState(null);
  const [order, setOrder] = useState([]);
  const [buyerName, setBuyerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  // ── replaced old `saved` boolean with a richer object ──
  const [completedOrder, setCompletedOrder] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const tokenClientRef = React.useRef(null);
  const accessTokenRef = React.useRef(null); // always-current token for async fetches
  const [allOrders, setAllOrders] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [editingKey, setEditingKey] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editErr, setEditErr] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [removeReason, setRemoveReason] = useState('');
  const [removeSaving, setRemoveSaving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  // keep a ref copy of the token so async fetches always read the latest value
  useEffect(() => { accessTokenRef.current = accessToken; }, [accessToken]);
  // inject keyframe animation once
  useEffect(() => {
    const id = 'order-complete-keyframes';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `
        @keyframes popIn {
          0%   { transform: scale(0.7); opacity: 0; }
          70%  { transform: scale(1.06); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);
  // Load Google Identity Services — reuse a saved token, and re-auth silently (no button click)
  useEffect(() => {
    const saveToken = (res) => {
      if (!res || !res.access_token) return;
      setAccessToken(res.access_token);
      accessTokenRef.current = res.access_token;
      try {
        const exp = Date.now() + (Number(res.expires_in || 3600) - 60) * 1000; // refresh 1 min early
        localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: res.access_token, exp }));
      } catch (e) {}
    };
    // 1) Reuse a still-valid token from a previous visit (no prompt at all)
    try {
      const saved = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
      if (saved && saved.token && saved.exp > Date.now()) {
        setAccessToken(saved.token);
        accessTokenRef.current = saved.token;
      }
    } catch (e) {}
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
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
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), snap => {
      setAllOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);
  const isSelected = (itemName, size) => order.some(o => o.key === `${itemName}_${size}`);
  const getQty = (itemName, size) => {
    const found = order.find(o => o.key === `${itemName}_${size}`);
    return found ? found.qty : 0;
  };
  const addToOrder = (item, size) => {
    const price = item[size];
    if (!price) return;
    const key = `${item.name}_${size}`;
    setOrder(prev => {
      const existing = prev.find(o => o.key === key);
      if (existing) return prev.map(o => o.key === key ? { ...o, qty: o.qty + 1 } : o);
      return [...prev, { key, name: item.name, size: SIZE_LABELS[size], price, qty: 1 }];
    });
  };
  const handlePillTap = (item, size) => {
    addToOrder(item, size);
  };
  // (-) inside pill: decrement, removes from order panel too when hits 0
  const handlePillMinus = (e, item, size) => {
    e.stopPropagation();
    const key = `${item.name}_${size}`;
    setOrder(prev => {
      const updated = prev.map(o => o.key === key ? { ...o, qty: o.qty - 1 } : o);
      return updated.filter(o => o.qty > 0);
    });
  };
  const updateQty = (key, delta) => {
    setOrder(prev => {
      const updated = prev.map(o => o.key === key ? { ...o, qty: Math.max(0, o.qty + delta) } : o);
      return updated.filter(o => o.qty > 0);
    });
  };
  const removeItem = (key) => setOrder(prev => prev.filter(o => o.key !== key));
  const total = order.reduce((sum, o) => sum + o.price * o.qty, 0);
  const now = new Date();
  const cashier = userName || auth.currentUser?.email?.split('@')[0] || 'Staff';
  const dateStr = now.toLocaleDateString('en-PH', { month: '2-digit', day: '2-digit', year: '2-digit' });
  const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  const pdfName = `${dateStr.replace(/\//g, '-')}-${timeStr.replace(/:/g, '-')}-${cashier}`;
  const generateReceiptHTML = () => `
    <html><head><style>
      body { font-family: 'Times New Roman', serif; max-width: 320px; margin: 0 auto; padding: 20px; }
      .cafe-name { font-size: 20px; font-weight: bold; letter-spacing: 2px; text-align: center; }
      .sub { font-size: 11px; text-align: center; color: #555; margin-bottom: 12px; }
      .divider { border-top: 1px dashed #333; margin: 8px 0; }
      .row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; }
      .total-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; padding: 6px 0; border-top: 2px solid #333; margin-top: 4px; }
      .footer { text-align: center; font-size: 10px; color: #777; margin-top: 12px; }
    </style></head><body>
      <div class="cafe-name">THEONYX CAFE</div>
      <div class="sub">Receipt</div>
      <div class="divider"></div>
      <div class="row"><span>Date:</span><span>${dateStr}</span></div>
      <div class="row"><span>Time:</span><span>${timeStr}</span></div>
      <div class="row"><span>Cashier:</span><span>${cashier}</span></div>
      ${buyerName ? `<div class="row"><span>Buyer:</span><span>${buyerName}</span></div>` : ''}
      <div class="row"><span>Payment:</span><span>${paymentMethod}</span></div>
      <div class="divider"></div>
      ${order.map(o => `<div class="row"><span>${o.name} (${o.size}) x${o.qty}</span><span>P${(o.price * o.qty).toLocaleString()}</span></div>`).join('')}
      <div class="total-row"><span>TOTAL</span><span>P${total.toLocaleString()}</span></div>
      <div class="divider"></div>
      ${notes ? `<div class="row"><span>Notes:</span><span>${notes}</span></div>` : ''}
      <div class="footer">Thank you for visiting Theonyx Cafe!<br/>Follow us @theonyx.cafe</div>
    </body></html>
  `;
  // Ask Google for a fresh token silently (no popup if already granted before).
  // Returns the new token string, or null if it couldn't get one.
  const getFreshToken = () => new Promise((resolve) => {
    if (!tokenClientRef.current) { resolve(null); return; }
    let settled = false;
    const finish = (val) => { if (!settled) { settled = true; resolve(val); } };
    tokenClientRef.current.callback = (res) => {
      if (res && res.access_token) {
        setAccessToken(res.access_token);
        accessTokenRef.current = res.access_token;
        try {
          const exp = Date.now() + (Number(res.expires_in || 3600) - 60) * 1000;
          localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: res.access_token, exp }));
        } catch (e) {}
        finish(res.access_token);
      } else {
        finish(null);
      }
    };
    try { tokenClientRef.current.requestAccessToken({ prompt: '' }); } catch (e) { finish(null); }
    // safety timeout so we never hang forever
    setTimeout(() => finish(null), 8000);
  });
  // Append rows to the sheet. Returns true only when the sheet actually accepted them.
  // If the token has expired (401), it silently refreshes and retries once.
  const appendToSheet = async (rows, allowRetry = true) => {
    const token = accessTokenRef.current;
    if (!token) { console.warn('appendToSheet: no access token'); return false; }
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SALES_SHEET_ID}/values/${encodeURIComponent(SALES_SHEET_TAB)}!A:J:append?valueInputOption=USER_ENTERED`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: rows }) }
      );
      // Token expired/invalid — get a new one and try again once.
      if ((res.status === 401 || res.status === 403) && allowRetry) {
        const fresh = await getFreshToken();
        if (fresh) return appendToSheet(rows, false);
      }
      if (!res.ok) {
        let detail = '';
        try { detail = await res.text(); } catch (e) {}
        console.error('Sheet append failed:', res.status, detail);
      }
      return res.ok;
    } catch (e) { console.error('Sheet append error:', e); return false; }
  };
  const saveOrder = async () => {
    setSaving(true);
    // snapshot before clearing
    const savedTotal = total;
    const savedPayment = paymentMethod;
    const savedItemCount = order.reduce((sum, o) => sum + o.qty, 0);
    const savedCashier = cashier;
    try {
      // Always save to Firestore first (source of truth) with a sheet-sync flag
      const ref = await addDoc(collection(db, 'orders'), {
        items: order, total, buyerName, paymentMethod, notes,
        cashier, hidden: false, syncedToSheet: false, createdAt: serverTimestamp(),
      });
      let sheetOk = false;
      if (accessTokenRef.current) {
        const rows = order.map(o => [dateStr, timeStr, buyerName || 'Walk-in', o.name, o.size, o.qty, o.price, o.price * o.qty, paymentMethod, cashier]);
        sheetOk = await appendToSheet(rows);
        try {
          const blob = new Blob([generateReceiptHTML()], { type: 'text/html' });
          const form = new FormData();
          form.append('metadata', new Blob([JSON.stringify({ name: `${pdfName}.html`, parents: [RECEIPT_FOLDER_ID], mimeType: 'text/html' })], { type: 'application/json' }));
          form.append('file', blob);
          await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { Authorization: `Bearer ${accessTokenRef.current}` }, body: form });
        } catch (e) { console.error('Receipt upload error:', e); }
      }
      // Record whether the sheet actually got it; if not, the backfill button can recover it
      try { await updateDoc(doc(db, 'orders', ref.id), { syncedToSheet: sheetOk }); } catch (e) {}
      if (!sheetOk) {
        // Let the cashier know it's safe in the app but not yet in the sheet
        alert('Order saved in the app, but it did NOT reach the Google Sheet (connection/token issue). Use "Sync missing orders to Sheet" to recover it.');
      }
      // clear order first, then show the big popup
      setOrder([]); setBuyerName(''); setNotes(''); setShowPreview(false);
      setCompletedOrder({ total: savedTotal, payment: savedPayment, itemCount: savedItemCount, cashier: savedCashier });
    } catch (e) { console.error(e); }
    setSaving(false);
  };
  // ── Recover orders not confirmed in the sheet ──
  // Catches BOTH syncedToSheet === false AND older orders where the flag was
  // never set (undefined) — those are the ones a previous app version missed.
  // A confirm dialog shows the count + date range so you can avoid re-adding
  // anything that's already in the sheet.
  const backfillMissing = async () => {
    if (!isManager) { alert('Only a manager can sync missing orders.'); return; }
    if (!accessTokenRef.current) { alert('Connect Google first, then try again.'); return; }
    const missing = allOrders
      .filter(o => !o.hidden && o.syncedToSheet !== true)
      .sort((a, b) => (a.createdAt?.toDate ? a.createdAt.toDate() : 0) - (b.createdAt?.toDate ? b.createdAt.toDate() : 0));
    if (missing.length === 0) {
      alert('No missing orders — everything is already marked as synced.');
      return;
    }
    // Show the date range so you can sanity-check before writing.
    const firstD = missing[0].createdAt?.toDate ? missing[0].createdAt.toDate() : null;
    const lastD = missing[missing.length - 1].createdAt?.toDate ? missing[missing.length - 1].createdAt.toDate() : null;
    const rangeTxt = (firstD && lastD)
      ? `\n\nOldest: ${firstD.toLocaleString('en-PH')}\nNewest: ${lastD.toLocaleString('en-PH')}`
      : '';
    const proceed = window.confirm(
      `Found ${missing.length} order(s) not yet confirmed in the sheet.${rangeTxt}\n\nAdd them to the sheet now?`
    );
    if (!proceed) return;
    setBackfilling(true);
    try {
      const out = [];
      missing.forEach(o => {
        const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
        const ds = d.toLocaleDateString('en-PH', { month: '2-digit', day: '2-digit', year: '2-digit' });
        const ts = d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
        (o.items || []).forEach(it => out.push([
          ds, ts, o.buyerName || 'Walk-in', it.name, it.size || '',
          it.qty, it.price, (it.price || 0) * (it.qty || 0), o.paymentMethod || '', o.cashier || ''
        ]));
      });
      const ok = await appendToSheet(out);
      if (ok) {
        // Mark each as synced so they're never re-added (prevents double entries)
        for (const o of missing) { try { await updateDoc(doc(db, 'orders', o.id), { syncedToSheet: true }); } catch (e) {} }
        alert(`Recovered ${missing.length} order(s) → ${out.length} row(s) added to the sheet.`);
      } else {
        alert('Could not write to the sheet. Please reconnect Google and try again.');
      }
    } catch (e) {
      console.error('Backfill error:', e);
      alert('Backfill failed. Please reconnect Google and try again.');
    }
    setBackfilling(false);
  };
  const dismissComplete = () => setCompletedOrder(null);
  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
  const startYesterday = new Date(startToday); startYesterday.setDate(startToday.getDate() - 1);
  const inWindow = (o, start) => { const d = tsToDate(o.createdAt); return d ? d >= start : true; };
  const todayList = allOrders.filter(o => !o.hidden && inWindow(o, startYesterday));
  const summaryList = allOrders.filter(o => !o.hidden && inWindow(o, startToday));
  // Count of orders saved in the app but not yet confirmed in the sheet
  // (matches the backfill filter: anything not explicitly marked synced)
  const unsyncedCount = allOrders.filter(o => !o.hidden && o.syncedToSheet !== true).length;
  const groups = [];
  todayList.forEach(o => {
    const d = tsToDate(o.createdAt);
    const label = fmtDateLabel(d);
    let g = groups.find(x => x.label === label);
    if (!g) { g = { label, orders: [] }; groups.push(g); }
    g.orders.push({ ...o, _date: d });
  });
  const tally = {}; let totalSales = 0;
  summaryList.forEach(o => (o.items || []).forEach(it => {
    const q = Number(it.qty) || 0, p = Number(it.price) || 0;
    tally[it.name] = (tally[it.name] || 0) + q; totalSales += p * q;
  }));
  const tallyArr = Object.entries(tally).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);
  const maxQty = tallyArr.length ? tallyArr[0].qty : 1;
  const totalOrders = summaryList.length;
  const startEdit = (orderId, idx, qty) => { setRemovingId(null); setEditingKey(`${orderId}_${idx}`); setEditQty(String(qty)); setEditReason(''); setEditErr(false); };
  const saveEdit = async (orderId, idx) => {
    if (!editReason.trim()) { setEditErr(true); return; }
    setEditSaving(true);
    try {
      const ord = allOrders.find(o => o.id === orderId);
      if (ord) {
        const it = (ord.items || [])[idx];
        const parsedQty = parseInt(editQty, 10);
        const newQty = Number.isNaN(parsedQty) ? it.qty : Math.max(0, parsedQty);
        const newPrice = Number(it.price) || 0;
        const editedAt = new Date();
        const editDateStr = editedAt.toLocaleDateString('en-PH', { month: '2-digit', day: '2-digit', year: '2-digit' });
        const editTimeStr = editedAt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
        let items = (ord.items || []).map((x, i) => i === idx ? { ...x, qty: newQty, price: newPrice, edited: true, editReason: editReason.trim(), editedBy: cashier, editedAt: editedAt.toISOString(), prevQty: x.qty, prevPrice: x.price } : x);
        const itemRemoved = newQty === 0;
        items = items.filter(x => (Number(x.qty) || 0) > 0);
        const newTotal = items.reduce((sm, x) => sm + (Number(x.price) || 0) * (Number(x.qty) || 0), 0);
        if (items.length === 0) {
          await updateDoc(doc(db, 'orders', orderId), { hidden: true, removeReason: editReason.trim(), removedBy: cashier, removedAt: editedAt.toISOString() });
          await appendToSheet([[editDateStr, editTimeStr, ord.buyerName || 'Walk-in', `[ORDER REMOVED] ${it.name}`, it.size || '', 0, newPrice, 0, ord.paymentMethod || '', cashier, `Reason: ${editReason.trim()}`]]);
        } else {
          await updateDoc(doc(db, 'orders', orderId), { items, total: newTotal });
          const action = itemRemoved ? '[ITEM REMOVED]' : '[EDITED]';
          await appendToSheet([[editDateStr, editTimeStr, ord.buyerName || 'Walk-in', `${action} ${it.name}`, it.size || '', newQty, newPrice, newPrice * newQty, ord.paymentMethod || '', cashier, `Reason: ${editReason.trim()} | Was: qty=${it.qty}`]]);
        }
      }
      setEditingKey(null); setEditErr(false);
    } catch (e) { console.error('Edit error:', e); }
    setEditSaving(false);
  };
  const removeOrder = async (orderId) => {
    setRemoveSaving(true);
    try {
      const ord = allOrders.find(o => o.id === orderId);
      const removedAt = new Date();
      const removeDateStr = removedAt.toLocaleDateString('en-PH', { month: '2-digit', day: '2-digit', year: '2-digit' });
      const removeTimeStr = removedAt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
      await updateDoc(doc(db, 'orders', orderId), { hidden: true, removeReason: removeReason.trim(), removedBy: cashier, removedAt: removedAt.toISOString() });
      if (ord && accessTokenRef.current) {
        const rows = (ord.items || []).map(it => ([removeDateStr, removeTimeStr, ord.buyerName || 'Walk-in', `[ORDER REMOVED] ${it.name}`, it.size || '', it.qty, it.price, it.price * it.qty, ord.paymentMethod || '', cashier, removeReason.trim() ? `Reason: ${removeReason.trim()}` : 'No reason given']));
        await appendToSheet(rows);
      }
      setRemovingId(null); setRemoveReason(''); setExpandedId(null);
    } catch (e) { console.error('Remove error:', e); }
    setRemoveSaving(false);
  };
  return (
    <div style={s.page}>
      <div style={s.title}>Orders</div>
      <div style={s.sub}>
        {tab === 1 ? `Tap a size to add · ${order.length} item${order.length !== 1 ? 's' : ''} in order`
          : tab === 2 ? 'One card per customer · tap to view, edit or remove'
          : 'Totals and items sold today'}
      </div>
      <div style={s.tabBar}>
        <button style={s.tab(tab === 1)} onClick={() => setTab(1)}>Order taker</button>
        <button style={s.tab(tab === 2)} onClick={() => setTab(2)}>Today's orders</button>
        <button style={s.tab(tab === 3)} onClick={() => setTab(3)}>Summary</button>
      </div>
      {tab === 1 && (
        <>
          {!accessToken ? (
            <>
              <button style={s.connectBtn} onClick={() => tokenClientRef.current?.requestAccessToken()}>
                <LinkIcon /> Connect Google (Sheets + Drive)
              </button>
              <div style={s.disabledOverlay}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Connect Google first</div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
                  Tap <b style={{ color: C.goldDeep }}>Connect Google</b> above to enable the order taker.
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={s.connectedBadge}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Connected — orders sync to Sheets & Drive
              </div>
              {/* Recover orders saved in the app but missing from the sheet — managers only */}
              {isManager && (
                <button style={s.syncMissingBtn} onClick={backfillMissing} disabled={backfilling}>
                  <LinkIcon /> {backfilling ? 'Syncing missing orders…' : `Sync missing orders to Sheet${unsyncedCount > 0 ? ` (${unsyncedCount})` : ''}`}
                </button>
              )}
              <label style={s.label}>Buyer name (optional)</label>
              <input style={s.input} placeholder="Customer name..." value={buyerName} onChange={e => setBuyerName(e.target.value)} />
              <label style={s.label}>Payment method</label>
              <select style={s.input} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
              {MENU_GROUPS.map(group => (
                <div key={group.id} style={s.groupCard}>
                  <div style={s.groupHeader} onClick={() => setOpenGroup(openGroup === group.id ? null : group.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={s.groupLabel}>{group.label}</span>
                      {group.items.some(item => SIZES.some(sz => isSelected(item.name, sz))) && (
                        <span style={{ background: C.green, color: '#fff', borderRadius: 20, fontSize: 10, fontWeight: 700, padding: '2px 7px' }}>
                          {group.items.reduce((count, item) => count + SIZES.filter(sz => isSelected(item.name, sz)).length, 0)}
                        </span>
                      )}
                    </div>
                    <Chev open={openGroup === group.id} />
                  </div>
                  {openGroup === group.id && group.items.map((item, i) => {
                    const anySelected = SIZES.some(sz => isSelected(item.name, sz));
                    return (
                      <div key={i} style={s.itemRow(anySelected)}>
                        <div style={{ flex: 1 }}>
                          <span style={{ ...s.itemName, color: anySelected ? C.green : C.ink }}>{item.name}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {SIZES.filter(sz => item[sz]).map(size => {
                            const selected = isSelected(item.name, size);
                            const qty = getQty(item.name, size);
                            return (
                              <button
                                key={size}
                                style={s.sizeBtn(selected)}
                                onClick={() => handlePillTap(item, size)}
                              >
                                {selected && (
                                  <span style={s.minusInPill} onClick={(e) => handlePillMinus(e, item, size)}>
                                    −
                                  </span>
                                )}
                                {SIZE_LABELS[size]} P{item[size]}
                                {selected && qty > 1 && (
                                  <span style={{ background: C.green, color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 700, padding: '1px 5px' }}>
                                    x{qty}
                                  </span>
                                )}
                                {selected && (
                                  <span style={{ position: 'absolute', top: -5, right: -5, background: C.green, borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <CheckIcon />
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              {order.length > 0 && (
                <div style={s.orderPanel}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Order summary</span>
                    <button style={{ background: 'none', border: 'none', color: C.red, fontSize: 12, cursor: 'pointer' }} onClick={() => setOrder([])}>Clear all</button>
                  </div>
                  {order.map(o => (
                    <div key={o.key} style={s.orderRow}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{o.name}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{o.size} · P{o.price}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gold, fontSize: 16, padding: '0 4px' }} onClick={() => updateQty(o.key, -1)}>-</button>
                        <span style={{ fontSize: 13, fontWeight: 600, minWidth: 16, textAlign: 'center', color: C.ink }}>{o.qty}</span>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gold, fontSize: 16, padding: '0 4px' }} onClick={() => updateQty(o.key, 1)}>+</button>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, fontSize: 14, padding: '0 4px' }} onClick={() => removeItem(o.key)}>x</button>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, minWidth: 50, textAlign: 'right' }}>P{(o.price * o.qty).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                  <div style={s.total}><span>TOTAL</span><span>P{total.toLocaleString()}</span></div>
                  <label style={{ ...s.label, marginTop: 10 }}>Notes (optional)</label>
                  <input style={s.input} placeholder="Special instructions..." value={notes} onChange={e => setNotes(e.target.value)} />
                  <button style={s.primaryBtn} onClick={() => setShowPreview(true)}>Preview & save order</button>
                </div>
              )}
            </>
          )}
        </>
      )}
      {tab === 2 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <span style={s.pill}>Resets every 2 days</span>
          </div>
          {groups.length === 0
            ? <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '24px 0' }}>No orders yet.</div>
            : groups.map(g => (
              <div key={g.label}>
                <div style={s.dateHdr}><CalIcon /> {g.label}</div>
                {g.orders.map(o => {
                  const items = o.items || [];
                  const expanded = expandedId === o.id;
                  const summary = items.map(x => x.name).slice(0, 3).join(', ') + (items.length > 3 ? ` +${items.length - 3}` : '');
                  return (
                    <div key={o.id} style={s.recCard}>
                      <div style={s.ohead} onClick={() => { setExpandedId(expanded ? null : o.id); setEditingKey(null); setRemovingId(null); }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                          <div style={{ flex: 1 }}>
                            <div style={s.custName}><UserIcon /> {o.buyerName || 'Walk-in'}{o.syncedToSheet === false && <span style={{ fontSize: 9, color: C.red, background: C.redBg, border: `0.5px solid ${C.redBorder}`, borderRadius: 6, padding: '1px 6px', marginLeft: 4 }}>not in sheet</span>}</div>
                            <div style={s.metaLine}>{fmtDateLabel(o._date)} · {fmtTime12(o._date)} · Cashier: {o.cashier}</div>
                            <div style={s.metaLine}>{items.length} item{items.length !== 1 ? 's' : ''} · {summary}</div>
                          </div>
                          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                            <div style={s.totalTop}>P{(o.total || 0).toLocaleString()}</div>
                            <Chev open={expanded} />
                          </div>
                        </div>
                      </div>
                      {expanded && (
                        <div style={{ padding: '0 12px 12px' }}>
                          <div style={{ borderTop: `1px dashed ${C.muteDash}`, paddingTop: 9 }}>
                            {items.map((it, idx) => {
                              const k = `${o.id}_${idx}`;
                              const editing = editingKey === k;
                              return (
                                <div key={idx}>
                                  <div style={s.detItem}>
                                    <div style={{ fontSize: 12, color: C.ink }}>{it.name} <span style={{ color: C.muted }}>{it.size ? `(${it.size}) ` : ''}x{it.qty}</span></div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span style={{ fontSize: 12, color: C.ink }}>P{(it.price * it.qty).toLocaleString()}</span>
                                      <button style={s.smallEdit} onClick={() => editing ? setEditingKey(null) : startEdit(o.id, idx, it.qty)}><EditIcon /></button>
                                    </div>
                                  </div>
                                  {it.edited && <div style={s.editTag}><EditIcon /> Edited{it.editedBy ? ` by ${it.editedBy}` : ''} — {it.editReason}</div>}
                                  {editing && (
                                    <div style={{ background: C.input, border: `0.5px solid ${C.rowBorder}`, borderRadius: 9, padding: 10, margin: '6px 0' }}>
                                      <div style={{ marginBottom: 8 }}>
                                        <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>Quantity <span style={{ opacity: 0.75 }}>(set to 0 to remove item)</span></div>
                                        <input type="number" min="0" value={editQty} onChange={e => setEditQty(e.target.value)} style={{ ...s.input, marginBottom: 0, padding: '7px 9px', background: '#fff' }} />
                                      </div>
                                      <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>Reason for edit (required)</div>
                                      <textarea value={editReason} onChange={e => { setEditReason(e.target.value); setEditErr(false); }} placeholder="Why was this changed?" style={{ width: '100%', boxSizing: 'border-box', minHeight: 42, background: '#fff', border: `0.5px solid ${C.inputBorder}`, borderRadius: 8, padding: '7px 9px', fontSize: 12, color: C.ink, fontFamily: 'inherit', resize: 'vertical' }} />
                                      {editErr && <div style={{ color: C.red, fontSize: 11, marginTop: 5 }}>Please add a reason before saving.</div>}
                                      <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
                                        <button style={{ flex: 1, background: C.gold, color: '#fff', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => saveEdit(o.id, idx)} disabled={editSaving}>{editSaving ? 'Saving...' : 'Save'}</button>
                                        <button style={{ flex: 1, background: 'transparent', color: C.muted, border: `0.5px solid ${C.inputBorder}`, borderRadius: 8, padding: '8px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setEditingKey(null)}>Cancel</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            <div style={s.totalPaid}><span style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>Total paid</span><span style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>P{(o.total || 0).toLocaleString()}</span></div>
                            <button style={s.removeBtn} onClick={() => setRemovingId(removingId === o.id ? null : o.id)}><TrashIcon /> Remove order</button>
                            {removingId === o.id && (
                              <div style={{ background: C.redBg, border: `0.5px solid ${C.redBorder}`, borderRadius: 9, padding: 10, marginTop: 8 }}>
                                <div style={{ fontSize: 11, color: C.red, marginBottom: 6 }}>This hides the order from the list (kept in records, logged to sheet).</div>
                                <input placeholder="Reason (optional)" value={removeReason} onChange={e => setRemoveReason(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: '#fff', border: `0.5px solid ${C.inputBorder}`, borderRadius: 8, padding: '7px 9px', fontSize: 12, color: C.ink, fontFamily: 'inherit', marginBottom: 8 }} />
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button style={{ flex: 1, background: C.red, color: '#fff', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => removeOrder(o.id)} disabled={removeSaving}>{removeSaving ? 'Removing...' : 'Hide order'}</button>
                                  <button style={{ flex: 1, background: 'transparent', color: C.muted, border: `0.5px solid ${C.inputBorder}`, borderRadius: 8, padding: '8px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => { setRemovingId(null); setRemoveReason(''); }}>Cancel</button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          }
        </>
      )}
      {tab === 3 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <span style={s.pill}>Resets every day</span>
          </div>
          <div style={s.dateHdr}><CalIcon /> {fmtDateLabel(new Date())}</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <div style={s.metricCard}><div style={{ fontSize: 22, fontWeight: 700, color: C.ink }}>{totalOrders}</div><div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>Total orders</div></div>
            <div style={s.metricDark}><div style={{ fontSize: 20, fontWeight: 700, color: C.goldBright }}>P{totalSales.toLocaleString()}</div><div style={{ fontSize: 11, color: '#b08a5a', marginTop: 3 }}>Total sales</div></div>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>Items ordered</div>
          {tallyArr.length === 0
            ? <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '16px 0' }}>No items sold yet today.</div>
            : tallyArr.map(t => (
              <div key={t.name} style={{ marginBottom: 11 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: C.ink }}>{t.name}</span>
                  <span style={{ fontSize: 12, color: C.goldDeep, fontWeight: 600 }}>x{t.qty}</span>
                </div>
                <div style={{ height: 5, background: C.pill, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round(t.qty / maxQty * 100)}%`, background: C.gold }} />
                </div>
              </div>
            ))
          }
        </>
      )}
      {showPreview && (
        <div style={s.modal} onClick={() => setShowPreview(false)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Order receipt</div>
            <div style={s.receiptHeader}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: C.ink, letterSpacing: 1 }}>THEONYX CAFE</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{dateStr} · {timeStr}</div>
              <div style={{ fontSize: 12, color: C.muted }}>Cashier: {cashier}</div>
              {buyerName && <div style={{ fontSize: 12, color: C.muted }}>Buyer: {buyerName}</div>}
              <div style={{ fontSize: 12, color: C.muted }}>Payment: {paymentMethod}</div>
            </div>
            {order.map(o => (
              <div key={o.key} style={s.receiptRow}>
                <span>{o.name} ({o.size}) x{o.qty}</span>
                <span>P{(o.price * o.qty).toLocaleString()}</span>
              </div>
            ))}
            <div style={s.receiptTotal}><span>TOTAL</span><span>P{total.toLocaleString()}</span></div>
            {notes && <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Notes: {notes}</div>}
            <button style={s.primaryBtn} onClick={saveOrder} disabled={saving}>{saving ? 'Saving...' : 'Confirm & save'}</button>
            <button style={s.darkBtn} onClick={() => {
              const w = window.open('', '_blank');
              w.document.write(generateReceiptHTML());
              w.document.close(); w.focus();
              setTimeout(() => { w.print(); }, 500);
            }}>Print / save as PDF</button>
            <button style={s.cancelBtn} onClick={() => setShowPreview(false)}>Back to edit</button>
          </div>
        </div>
      )}
      {/* ── ORDER COMPLETE POPUP ── */}
      {completedOrder && (
        <div style={s.completeOverlay} onClick={dismissComplete}>
          <div style={s.completeCard} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 26, fontWeight: 800, color: C.ink, marginBottom: 6, lineHeight: 1.2 }}>
              Order Complete!
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.green, marginBottom: 8 }}>
              Good job, {completedOrder.cashier}!
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>
              P{completedOrder.total.toLocaleString()} · {completedOrder.payment} · {completedOrder.itemCount} item{completedOrder.itemCount !== 1 ? 's' : ''}
            </div>
            <button
              style={{ ...s.primaryBtn, marginTop: 0 }}
              onClick={dismissComplete}
            >
              New order
            </button>
          </div>
        </div>
      )}
      <div style={{ height: 100 }} />
    </div>
  );
}
