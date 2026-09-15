import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase/config';
import {
  collection, addDoc, deleteDoc, updateDoc, doc,
  onSnapshot, query, orderBy, where, serverTimestamp
} from 'firebase/firestore';

const SHEET_ID = '15o1OUhOO17s1ifKSlYonPrmtJEAP1qQRLoMCI7_N0DM';
const GOOGLE_CLIENT_ID = '596322682185-n5hm66hvol3nnqqllnuop995kcnefbgu.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const STAFF_LIST = ['Kelly', 'Maryz', 'Ash'];
// Fixed weekly day off, 0 = Sunday. Staff not listed here have no automatic rest day.
const WEEKLY_REST = { Kelly: 2, Maryz: 4 };
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAILY_RATE = 400;
const POLL_MS = 60000;

// ── palette ──
const C = {
  ink: '#2a1000', gold: '#c8943a', muted: '#a07850', cream: '#fff8f0',
  border: '#f0e8d8', soft: '#f5ede2', white: '#fff', terra: '#8a5a2b',
  green: '#5a8a3a', greenBg: '#f1f7e9', greenBorder: '#d7e8c0',
  warnBg: '#fbeede', warnBorder: '#efd2a0', warn: '#a9651a',
  errBg: '#fbe9e7', errBorder: '#f0c8c0', err: '#b5482e',
};

const s = {
  page: { padding: '16px 16px 0', animation: 'fadeIn 0.3s ease' },
  title: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 4 },
  sub: { fontSize: 13, color: C.muted, marginBottom: 16 },
  actionRow: { display: 'flex', gap: 8, marginBottom: 16 },
  smallBtn: { flex: 1, padding: '9px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  connectBtn: { background: C.gold, color: C.white, border: 'none' },
  connectedBadge: { flex: 1, padding: '9px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: C.greenBg, border: `1px solid ${C.greenBorder}`, color: C.green, cursor: 'pointer' },
  summaryBtn: { background: C.white, color: C.ink, border: `1px solid ${C.border}` },
  banner: (kind) => ({
    borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 12,
    display: 'flex', alignItems: 'center', gap: 8,
    background: kind === 'err' ? C.errBg : C.greenBg,
    border: `1px solid ${kind === 'err' ? C.errBorder : C.greenBorder}`,
    color: kind === 'err' ? C.err : C.green
  }),
  tabRow: { display: 'flex', background: C.white, borderRadius: 12, padding: 4, marginBottom: 16, border: `1px solid ${C.border}` },
  tab: (active) => ({ flex: 1, padding: '9px', borderRadius: 9, fontSize: 13, fontWeight: active ? 700 : 500, background: active ? C.ink : 'transparent', color: active ? C.gold : C.muted, border: 'none', cursor: 'pointer' }),
  card: { background: C.white, borderRadius: 14, padding: '18px', marginBottom: 14, border: `1px solid ${C.border}` },
  staffName: { fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 4 },
  statusText: { fontSize: 12, color: C.muted, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 },
  dot: (on) => ({ width: 8, height: 8, borderRadius: '50%', background: on ? C.green : '#d8c8b4', flexShrink: 0 }),
  bigBtn: { width: '100%', padding: '13px', borderRadius: 11, fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  inBtn: { background: C.gold, color: C.white, border: 'none', marginBottom: 8 },
  outBtn: { background: C.white, color: C.terra, border: `1.5px solid ${C.terra}` },
  doneBtn: { background: C.cream, color: '#8a6d3b', border: `1px solid ${C.border}`, cursor: 'default' },
  lockBtn: { background: C.soft, color: '#bca684', border: `1px solid ${C.border}`, cursor: 'not-allowed' },
  restTodayBox: { background: C.warnBg, border: `1px solid ${C.warnBorder}`, borderRadius: 11, padding: '14px', display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: C.warn, fontWeight: 600 },
  restHead: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 },
  restTitle: { fontSize: 15, fontWeight: 700, color: C.ink },
  restSub: { fontSize: 11.5, color: C.muted, marginBottom: 14 },
  restInputRow: { display: 'flex', gap: 8, marginBottom: 12 },
  dateInput: { flex: 1, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 11px', fontSize: 13, color: C.ink, outline: 'none', background: C.cream, fontFamily: 'inherit' },
  setBtn: { padding: '10px 16px', borderRadius: 10, background: C.gold, color: C.white, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  restItem: (clash) => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, marginBottom: 7,
    background: clash ? C.warnBg : C.cream, border: `1px solid ${clash ? C.warnBorder : C.border}`
  }),
  statStrip: { display: 'flex', gap: 8, marginBottom: 16 },
  statBox: { flex: 1, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 8px', textAlign: 'center' },
  statNum: { fontSize: 18, fontWeight: 700, color: C.ink },
  statLbl: { fontSize: 9.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 3 },
  restPill: { display: 'inline-block', fontSize: 11, fontWeight: 700, color: C.warn, background: C.warnBg, border: `1px solid ${C.warnBorder}`, borderRadius: 20, padding: '2px 10px' },
  absentPill: { display: 'inline-block', fontSize: 11, fontWeight: 700, color: C.err, background: C.errBg, border: `1px solid ${C.errBorder}`, borderRadius: 20, padding: '2px 10px' },
  halfPill: { display: 'inline-block', fontSize: 11, fontWeight: 700, color: C.terra, background: C.soft, border: `1px solid ${C.border}`, borderRadius: 20, padding: '2px 10px' },
  activePill: { display: 'inline-block', fontSize: 11, fontWeight: 700, color: C.green, background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: 20, padding: '2px 10px' },
  salaryBar: { background: C.ink, borderRadius: 12, padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  salaryLabel: { fontSize: 11.5, color: '#d8b87a', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 },
  salaryNum: { fontSize: 23, fontWeight: 800, color: C.gold, lineHeight: 1 },
  salaryNote: { fontSize: 10.5, color: '#b89868', marginTop: 3 },
  modal: { position: 'fixed', inset: 0, background: 'rgba(26,10,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modalCard: { background: C.cream, borderRadius: '20px 20px 0 0', padding: '24px 22px 36px', width: '100%', maxWidth: 480, animation: 'slideUp 0.3s ease', maxHeight: '85vh', overflowY: 'auto' },
  cameraBox: { background: C.soft, borderRadius: 12, padding: 24, textAlign: 'center', border: `2px dashed ${C.border}`, cursor: 'pointer', marginBottom: 12 },
  confirmBtn: { width: '100%', padding: '13px', borderRadius: 11, background: C.gold, color: C.white, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', marginTop: 10 },
  cancelBtn: { width: '100%', padding: '12px', borderRadius: 11, background: 'transparent', color: C.muted, fontSize: 13, border: `1px solid ${C.border}`, cursor: 'pointer', marginTop: 8 },
  sumTable: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  sumTh: { textAlign: 'left', padding: '8px 6px', fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `1px solid ${C.border}` },
  sumTd: { padding: '9px 6px', color: C.ink, borderBottom: `1px solid ${C.border}` },
  monthRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  breakdown: { background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', marginBottom: 16 },
  breakRow: { display: 'flex', gap: 8, fontSize: 12, padding: '3px 0', alignItems: 'baseline' },
  breakLbl: { width: 74, flexShrink: 0, color: C.muted },
  breakVal: { flex: 1, color: C.ink },
  monthBtn: (off) => ({ background: C.white, border: `1px solid ${C.border}`, borderRadius: 9, width: 32, height: 32, fontSize: 17, color: C.ink, cursor: off ? 'not-allowed' : 'pointer', opacity: off ? 0.3 : 1, lineHeight: 1, flexShrink: 0 }),
  monthLbl: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: C.ink },
  monthNote: { fontSize: 10.5, color: C.muted, textAlign: 'center', marginBottom: 14 },
  syncRow: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: C.muted, marginBottom: 10 },
  refreshBtn: { background: 'transparent', border: 'none', color: C.gold, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', padding: 0, textDecoration: 'underline' },
};

const Ic = {
  link: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  list: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  login: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>,
  logout: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  lock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  camera: <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  cal: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  warn: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  close: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  sheet: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="9" x2="9" y2="21"/></svg>,
};

// ── Date/time helpers ──
const pad2 = (n) => String(n).padStart(2, '0');

const localIso = (d = new Date()) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const prettyDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
};

const peso = (n) => '\u20B1' + Number(n).toLocaleString('en-PH');

const formatDate = (d) => `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`;

const sheetDateFromIso = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return formatDate(new Date(y, m - 1, d));
};

const formatTime = (d) =>
  d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// Normalise whatever the sheet returns into a single canonical MM/DD/YYYY.
// Handles serial numbers, MM/DD/YYYY, M/D/YYYY and YYYY-MM-DD.
const normDate = (val) => {
  if (val === '' || val === null || val === undefined) return '';
  const str = String(val).trim();
  if (!str) return '';
  if (/^\d+(\.\d+)?$/.test(str)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(parseFloat(str)) * 86400000);
    return `${pad2(d.getUTCMonth() + 1)}/${pad2(d.getUTCDate())}/${d.getUTCFullYear()}`;
  }
  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${pad2(m[2])}/${pad2(m[3])}/${m[1]}`;
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${pad2(m[1])}/${pad2(m[2])}/${m[3]}`;
  const parsed = new Date(str);
  return isNaN(parsed) ? str : formatDate(parsed);
};

const displayTime = (val) => {
  if (val === '' || val === null || val === undefined) return '—';
  const str = String(val).trim();
  if (!str) return '—';
  if (/^\d*\.\d+$/.test(str)) {
    const total = Math.round((parseFloat(str) % 1) * 86400);
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), sec = total % 60;
    return `${(h % 12) || 12}:${pad2(m)}:${pad2(sec)} ${h >= 12 ? 'pm' : 'am'}`;
  }
  // 24-hour strings like 19:07:03 → 7:07:03 pm
  const hm = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hm) {
    const h = Number(hm[1]);
    return `${(h % 12) || 12}:${hm[2]}:${hm[3] || '00'} ${h >= 12 ? 'pm' : 'am'}`;
  }
  return str;
};

// MM/DD/YYYY → YYYY-MM, used to bucket the summary by month
const monthKey = (mmddyyyy) => {
  const m = String(mmddyyyy).match(/^(\d{2})\/\d{2}\/(\d{4})$/);
  return m ? `${m[2]}-${m[1]}` : '';
};

const monthLabel = (key) => {
  if (!key) return '';
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
};

// YYYY-MM-DD → does this land on the staff member's fixed day off?
const isWeeklyRest = (staff, iso) => {
  const day = WEEKLY_REST[staff];
  if (day === undefined || !iso) return false;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay() === day;
};

// MM/DD/YYYY → sortable YYYYMMDD
const sortKey = (d) => (d ? d.slice(6) + d.slice(0, 2) + d.slice(3, 5) : '');

const daysInMonth = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

const dateInMonth = (key, day) => {
  const [y, m] = key.split('-').map(Number);
  return formatDate(new Date(y, m - 1, day));
};

const isHeaderRow = (r) =>
  String(r[1] || '').trim().toLowerCase() === 'name' ||
  String(r[0] || '').trim().toLowerCase() === 'date';

export default function Attendance({ role, userName }) {
  const [accessToken, setAccessToken] = useState(null);

  // Sheet is the source of truth for what gets displayed.
  const [sheetToday, setSheetToday] = useState({});   // { staff: { rowIndex, timeIn, timeOut, isRest } }
  const [sheetRows, setSheetRows] = useState({});     // { staff: rawRows[] }
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  // Firestore holds the selfies + drives manager notifications only.
  const [firestoreRecords, setFirestoreRecords] = useState({});

  const [activeStaff, setActiveStaff] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const fileRef = useRef();
  const tokenClientRef = useRef(null);
  const tokenRef = useRef({ token: null, expiresAt: 0 });
  const pendingTokenResolve = useRef(null);

  // summary modal
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryAll, setSummaryAll] = useState([]);
  const [summaryMonth, setSummaryMonth] = useState(localIso().slice(0, 7));

  // notifications (manager only)
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [photoViewer, setPhotoViewer] = useState(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const prevRecordsRef = useRef({});

  // rest days
  const [restDays, setRestDays] = useState([]);
  const [restDate, setRestDate] = useState('');
  const [restWarning, setRestWarning] = useState('');
  const [restSaving, setRestSaving] = useState(false);
  const [restOverride, setRestOverride] = useState(false);

  const visibleStaff = role === 'manager' ? STAFF_LIST : (userName ? [userName] : []);
  const today = localIso();
  const todaySheet = formatDate(new Date());

  // ── Google sign-in with a promise-based token getter ──
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      if (!window.google) return;
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (res) => {
          const resolve = pendingTokenResolve.current;
          pendingTokenResolve.current = null;
          if (res && res.access_token) {
            // renew two minutes early so a write never lands on a dead token
            const expiresAt = Date.now() + (Number(res.expires_in || 3600) - 120) * 1000;
            tokenRef.current = { token: res.access_token, expiresAt };
            setAccessToken(res.access_token);
            if (resolve) resolve(res.access_token);
          } else if (resolve) {
            resolve(null);
          }
        },
      });
    };
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  // Returns a live token. interactive:false is used by the background poll
  // so it never pops a Google dialog on its own.
  const getToken = ({ interactive = true } = {}) => new Promise((resolve) => {
    const { token, expiresAt } = tokenRef.current;
    if (token && Date.now() < expiresAt) return resolve(token);
    if (!interactive || !tokenClientRef.current) {
      if (token) { tokenRef.current = { token: null, expiresAt: 0 }; setAccessToken(null); }
      return resolve(null);
    }
    pendingTokenResolve.current = resolve;
    tokenClientRef.current.requestAccessToken({ prompt: '' });
  });

  useEffect(() => {
    if (visibleStaff.length > 0) setActiveStaff(visibleStaff[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName, role]);

  useEffect(() => { setRestOverride(false); }, [activeStaff, today]);

  // ── Read the sheet: this is what the UI renders ──
  const loadSheet = async (tok, list = visibleStaff, { silent = false } = {}) => {
    if (!tok || list.length === 0) return null;
    if (!silent) setSyncing(true);
    try {
      const params = list.map(n => `ranges=${encodeURIComponent(`${n}!A:E`)}`).join('&');
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchGet?${params}`,
        { headers: { Authorization: `Bearer ${tok}` } }
      );

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          tokenRef.current = { token: null, expiresAt: 0 };
          setAccessToken(null);
          setError('The sheet connection expired. Tap Connect to record log again.');
        } else if (res.status === 400) {
          setError(`Could not read the sheet. Check that a tab exists named exactly: ${list.join(', ')}.`);
        } else {
          setError(`Could not read the sheet (error ${res.status}).`);
        }
        setSyncing(false);
        return null;
      }

      const data = await res.json();
      const recs = {}, rowsByStaff = {};

      (data.valueRanges || []).forEach((vr, i) => {
        const staff = list[i];
        const values = vr.values || [];
        rowsByStaff[staff] = values;

        let found = null;
        values.forEach((r, idx) => {
          if (!r || !r[0] || isHeaderRow(r)) return;
          if (normDate(r[0]) !== todaySheet) return;
          const colC = String(r[2] || '').trim().toUpperCase();
          const isRest = colC === 'REST DAY';
          const isAbsent = colC === 'ABSENT' || colC === 'A';
          const isMarker = isRest || isAbsent;
          // last matching row wins
          found = {
            rowIndex: idx + 1,                                  // real 1-based sheet row
            isRest,
            isAbsent,
            timeIn: isMarker ? null : (r[2] ? displayTime(r[2]) : null),
            timeOut: isMarker ? null : (r[4] ? displayTime(r[4]) : null),
          };
        });

        recs[staff] = found || { rowIndex: null, isRest: false, isAbsent: false, timeIn: null, timeOut: null };
      });

      setSheetToday(prev => ({ ...prev, ...recs }));
      setSheetRows(prev => ({ ...prev, ...rowsByStaff }));
      setLastSync(new Date());
      setSyncing(false);
      return { recs, rowsByStaff };
    } catch (e) {
      console.error(e);
      setError('Network error while reading the sheet.');
      setSyncing(false);
      return null;
    }
  };

  // Pull as soon as we have a token, and whenever the staff list changes.
  useEffect(() => {
    if (accessToken) loadSheet(accessToken, visibleStaff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, role, userName]);

  // Background refresh: on focus and on a timer, silently.
  const syncRef = useRef(() => {});
  syncRef.current = async () => {
    const tok = await getToken({ interactive: false });
    if (tok) loadSheet(tok, visibleStaff, { silent: true });
  };

  useEffect(() => {
    const id = setInterval(() => syncRef.current(), POLL_MS);
    const onFocus = () => syncRef.current();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus); };
  }, []);

  // ── Firestore: selfies + notification feed only ──
  useEffect(() => {
    const q = query(collection(db, 'attendance'), where('date', '==', today));
    const unsub = onSnapshot(q, (snap) => {
      const recs = {};
      snap.docs.forEach(d => {
        const data = d.data();
        recs[data.staff] = {
          timeIn: data.timeIn || null,
          timeOut: data.timeOut || null,
          docId: d.id,
          photoInData: data.photoInData || null,
          photoOutData: data.photoOutData || null,
        };
      });
      setFirestoreRecords(recs);
    });
    return () => unsub();
  }, [today]);

  useEffect(() => {
    if (role !== 'manager') return;
    const prev = prevRecordsRef.current;
    Object.entries(firestoreRecords).forEach(([staff, r]) => {
      const p = prev[staff] || {};
      if (r.timeIn && !p.timeIn) {
        setNotifications(n => [{ id: Date.now() + staff + 'IN', staff, type: 'IN', time: r.timeIn, photoData: r.photoInData, read: false }, ...n]);
        setNotifOpen(true);
      }
      if (r.timeOut && !p.timeOut) {
        setNotifications(n => [{ id: Date.now() + staff + 'OUT', staff, type: 'OUT', time: r.timeOut, photoData: r.photoOutData, read: false }, ...n]);
        setNotifOpen(true);
      }
    });
    prevRecordsRef.current = firestoreRecords;
  }, [firestoreRecords, role]);

  // ── Rest days listener ──
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'restDays'), orderBy('date', 'asc')),
      snap => setRestDays(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, []);

  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPhoto(ev.target.result);
    reader.readAsDataURL(file);
  };

  const rec = (name) => sheetToday[name] || {};
  const photosOf = (name) => firestoreRecords[name] || {};

  const startAction = (staffName, type) => {
    if (!accessToken) { setError('Connect to record log first.'); return; }
    const r = rec(staffName);
    if (type === 'IN' && r.timeIn) { setError('The sheet already shows a clock in for today.'); return; }
    if (type === 'OUT' && (r.timeOut || !r.timeIn)) {
      setError(r.timeOut ? 'The sheet already shows a clock out for today.' : 'Clock in first.');
      return;
    }
    setError('');
    setPendingAction({ staffName, type });
    setPhoto(null); setPhotoFile(null);
  };

  const compressSelfie = (file) => new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 200;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });

  const sheetError = (res) => {
    if (res.status === 401 || res.status === 403) {
      tokenRef.current = { token: null, expiresAt: 0 };
      setAccessToken(null);
      return 'The sheet connection expired. Nothing was saved — reconnect and try again.';
    }
    return `The sheet rejected the write (error ${res.status}). Nothing was saved.`;
  };

  // ── CLOCK IN / OUT — the sheet write must succeed before anything else ──
  const confirmAction = async () => {
    if (!photoFile) { setError('Take a selfie first.'); return; }
    const { staffName, type } = pendingAction;
    setLoading(true); setError('');

    const now = new Date();
    const timeNow = formatTime(now);
    const sheetDate = formatDate(now);

    try {
      const tok = await getToken();
      if (!tok) {
        setError('Could not refresh the sheet connection. Nothing was saved.');
        setLoading(false);
        return;
      }

      const photoData = await compressSelfie(photoFile);

      if (type === 'IN') {
        // If the sheet already has a row for today — a pre-filled template row,
        // or one marked ABSENT — write the time into its column C. Appending
        // would create a second row for the same date. Only column C is touched,
        // so a formula or manual entry in the date and name columns survives.
        // A REST DAY row is left alone and gets its own row instead.
        const cur = rec(staffName);
        const reuseRow = cur.rowIndex && !cur.isRest ? cur.rowIndex : null;

        const res = reuseRow
          ? await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(`${staffName}!C${reuseRow}`)}?valueInputOption=USER_ENTERED`,
              {
                method: 'PUT',
                headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: [[timeNow]] }),
              }
            )
          // A=Date  B=Name  C=TimeIn  D=empty  E=TimeOut (filled on clock out)
          : await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(`${staffName}!A:E`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
              {
                method: 'POST',
                headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: [[sheetDate, staffName, timeNow, '', '']] }),
              }
            );
        if (!res.ok) { setError(sheetError(res)); setLoading(false); return; }

        // Sheet is written. Firestore only carries the selfie from here.
        try {
          await addDoc(collection(db, 'attendance'), {
            staff: staffName,
            date: today,
            timeIn: timeNow,
            timeOut: null,
            sheetDate,
            photoInData: photoData || null,
            createdAt: serverTimestamp(),
          });
        } catch (e) {
          console.error(e);
          setError('Saved to the sheet, but the selfie did not upload.');
        }

      } else {
        // Re-read so we target the row that actually exists right now.
        const fresh = await loadSheet(tok, [staffName], { silent: true });
        const rowIndex = fresh?.recs?.[staffName]?.rowIndex;
        if (!rowIndex) {
          setError('Could not find today\'s row in the sheet. Refresh and try again.');
          setLoading(false);
          return;
        }

        // Write column E only — date, name and time in stay exactly as they are.
        const res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(`${staffName}!E${rowIndex}`)}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [[timeNow]] }),
          }
        );
        if (!res.ok) { setError(sheetError(res)); setLoading(false); return; }

        const existingDoc = photosOf(staffName);
        if (existingDoc.docId) {
          try {
            await updateDoc(doc(db, 'attendance', existingDoc.docId), {
              timeOut: timeNow,
              photoOutData: photoData || null,
            });
          } catch (e) {
            console.error(e);
            setError('Saved to the sheet, but the selfie did not upload.');
          }
        }
      }

      // Read back so the card shows what the sheet now holds, not what we hoped.
      await loadSheet(tok, visibleStaff);

      setSuccess(`${staffName} clocked ${type} at ${timeNow}`);
      setPendingAction(null); setPhoto(null); setPhotoFile(null);
      setTimeout(() => setSuccess(''), 4000);
    } catch (e) {
      console.error(e);
      setError('Could not reach the sheet. Nothing was saved — try again.');
    }
    setLoading(false);
  };

  const deletePhoto = async (docId, field) => {
    if (!docId) return;
    setDeletingPhoto(true);
    try {
      await updateDoc(doc(db, 'attendance', docId), { [field]: null });
      setPhotoViewer(null);
    } catch (e) { console.error(e); }
    setDeletingPhoto(false);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // ── Rest day → sheet, with a duplicate check against what's already there ──
  const appendRestRow = async (staffName, sheetDate, tok, existingRows) => {
    const already = (existingRows || []).some(r =>
      r && r[0] && normDate(r[0]) === sheetDate && String(r[2] || '').trim().toUpperCase() === 'REST DAY'
    );
    if (already) return true;
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(`${staffName}!A:E`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [[sheetDate, staffName, 'REST DAY', '', '']] }),
        }
      );
      return res.ok;
    } catch { return false; }
  };

  const syncRestDays = async (tok, staff, rows) => {
    const pending = restDays.filter(r => r.staff === staff && r.inSheet !== true);
    for (const r of pending) {
      const ok = await appendRestRow(staff, sheetDateFromIso(r.date), tok, rows);
      if (ok) {
        try { await updateDoc(doc(db, 'restDays', r.id), { inSheet: true }); } catch (e) { console.error(e); }
      }
    }
    return pending.length > 0;
  };

  // ── Summary: built from the same sheet read as the card ──
  const openSummary = async () => {
    if (!activeStaff) return;
    setSummaryOpen(true); setSummaryLoading(true);
    setSummaryAll([]); setSummaryMonth(localIso().slice(0, 7)); setError('');

    const tok = await getToken();
    if (!tok) { setError('Connect to record log to load the summary.'); setSummaryLoading(false); return; }

    let loaded = await loadSheet(tok, visibleStaff, { silent: true });
    if (loaded) {
      const pushed = await syncRestDays(tok, activeStaff, loaded.rowsByStaff[activeStaff]);
      if (pushed) loaded = await loadSheet(tok, visibleStaff, { silent: true });
    }
    if (!loaded) { setSummaryLoading(false); return; }

    const rows = (loaded.rowsByStaff[activeStaff] || [])
      .filter(r => r && r[0] && !isHeaderRow(r))
      .map(r => {
        const colC = String(r[2] || '').trim().toUpperCase();
        const isRest = colC === 'REST DAY';
        const isAbsent = colC === 'ABSENT' || colC === 'A';
        const isMarker = isRest || isAbsent;
        const date = normDate(r[0]);
        return {
          isRest,
          isAbsent,
          date,
          month: monthKey(date),
          hasIn: !isMarker && !!colC,
          hasOut: !isMarker && !!String(r[4] || '').trim(),
          timeIn: isMarker ? '' : displayTime(r[2] || ''),
          timeOut: isMarker ? '' : displayTime(r[4] || ''),
        };
      });

    setSummaryAll(rows);
    setSummaryLoading(false);
  };

  // ── Rest day helpers ──
  const dateCounts = {};
  restDays.forEach(r => { dateCounts[r.date] = (dateCounts[r.date] || 0) + 1; });
  const upcoming = restDays.filter(r => r.date >= today);
  const autoRestToday = activeStaff ? isWeeklyRest(activeStaff, today) : false;
  const scheduledRestToday = activeStaff
    ? (rec(activeStaff).isRest || autoRestToday || restDays.some(r => r.staff === activeStaff && r.date === today))
    : false;
  // A clock-in already on the sheet always wins — someone covering a shift isn't resting.
  const onRestToday = scheduledRestToday && !restOverride && !rec(activeStaff).timeIn;

  const addRestDay = async () => {
    if (!activeStaff) { setRestWarning('No staff selected.'); return; }
    if (!restDate) { setRestWarning('Pick a date first.'); return; }
    if (restDays.find(r => r.date === restDate && r.staff === activeStaff)) {
      setRestWarning(`${activeStaff} already has this rest day.`); return;
    }
    const clash = restDays.find(r => r.date === restDate && r.staff !== activeStaff);
    setRestSaving(true);
    try {
      let inSheet = false;
      const tok = await getToken({ interactive: false });
      if (tok) inSheet = await appendRestRow(activeStaff, sheetDateFromIso(restDate), tok, sheetRows[activeStaff]);
      await addDoc(collection(db, 'restDays'), {
        staff: activeStaff, date: restDate, inSheet, createdAt: serverTimestamp()
      });
      setRestWarning(
        !inSheet
          ? 'Saved. It will be written to the sheet the next time you open the summary.'
          : clash ? `Heads up — ${clash.staff} also has a rest day on ${prettyDate(restDate)}.` : ''
      );
      setRestDate('');
      if (tok) loadSheet(tok, visibleStaff, { silent: true });
    } catch { setRestWarning('Could not save. Try again.'); }
    setRestSaving(false);
  };

  const removeRestDay = async (entry) => {
    if (role !== 'manager' && entry.staff !== userName) return;
    try { await deleteDoc(doc(db, 'restDays', entry.id)); } catch (e) { console.error(e); }
  };

  const isActive = !!rec(activeStaff).timeIn && !rec(activeStaff).timeOut && !onRestToday;

  // The summary shows one month at a time, so it starts clean on the 1st.
  // The current month is always listed even before it has any entries.
  const summaryMonths = [...new Set([summaryMonth, ...summaryAll.map(r => r.month).filter(Boolean)])]
    .sort().reverse();
  const monthIdx = summaryMonths.indexOf(summaryMonth);
  const isCurrentMonth = summaryMonth === localIso().slice(0, 7);

  // The sheet can hold more than one row per date. Rank them so a complete
  // shift always beats a partial one, and a marker never overwrites real times.
  const rank = (r) => (r.hasIn && r.hasOut ? 4 : r.hasIn ? 3 : r.isRest ? 2 : 1);
  const byDate = {};
  const seen = {};
  summaryAll.filter(r => r.month === summaryMonth).forEach(r => {
    (seen[r.date] = seen[r.date] || []).push(r);
    const cur = byDate[r.date];
    if (!cur || rank(r) > rank(cur)) byDate[r.date] = r;
  });

  // A date is in conflict when one row says worked and another says absent or rest.
  const conflicts = Object.keys(seen).filter(date => {
    const rows = seen[date];
    return rows.some(r => r.hasIn) && rows.some(r => r.isAbsent || r.isRest);
  }).sort((a, b) => (sortKey(a) < sortKey(b) ? 1 : -1));

  // Absent only counts from the staff's first entry onward, so the days before
  // someone started don't get flagged.
  const firstEntry = summaryAll.map(r => r.date).filter(Boolean).sort((a, b) =>
    sortKey(a) < sortKey(b) ? -1 : 1)[0];
  const lastDay = isCurrentMonth ? new Date().getDate() : daysInMonth(summaryMonth);

  const summaryDays = [];
  if (firstEntry) {
    for (let d = 1; d <= lastDay; d++) {
      const date = dateInMonth(summaryMonth, d);
      if (sortKey(date) < sortKey(firstEntry)) continue;
      const row = byDate[date];
      const iso = `${summaryMonth}-${pad2(d)}`;
      const restPlanned = restDays.some(r => r.staff === activeStaff && r.date === iso);

      // Today is still in progress: it isn't absent just because nobody has
      // clocked in yet, and it isn't a half day until the shift is over.
      const isToday = date === todaySheet;

      let status;
      if (row && row.hasIn) status = row.hasOut ? 'present' : (isToday ? 'active' : 'half');
      else if (row && row.isAbsent) status = 'absent';
      else if ((row && row.isRest) || restPlanned || isWeeklyRest(activeStaff, iso)) status = 'rest';
      else status = isToday ? 'pending' : 'absent';

      summaryDays.push({
        date,
        status,
        timeIn: row && row.hasIn ? row.timeIn : '',
        timeOut: row && row.hasOut ? row.timeOut : '',
      });
    }
  }

  const countBy = (st) => summaryDays.filter(d => d.status === st).length;
  const datesFor = (st) => summaryDays.filter(d => d.status === st).map(d => d.date.slice(0, 5));
  const summaryStats = {
    worked: countBy('present'),
    half: countBy('half'),
    rest: countBy('rest'),
    absent: countBy('absent'),
    salary: Math.round((countBy('present') + countBy('half') * 0.5) * DAILY_RATE),
  };
  const summaryRows = [...summaryDays].reverse();

  return (
    <div style={s.page}>
      <div style={s.title}>Attendance</div>
      <div style={s.sub}>Time In / Time Out</div>

      <div style={s.actionRow}>
        {!accessToken
          ? <button style={{ ...s.smallBtn, ...s.connectBtn }} onClick={() => getToken()}>{Ic.link} Connect to record log</button>
          : <div style={s.connectedBadge} onClick={() => loadSheet(accessToken, visibleStaff)}>{Ic.check} Log connected</div>
        }
        <button style={{ ...s.smallBtn, ...s.summaryBtn }} onClick={openSummary}>{Ic.list} Summary</button>
        {role === 'manager' && (
          <button
            onClick={() => { setNotifOpen(true); setNotifications(n => n.map(x => ({ ...x, read: true }))); }}
            style={{ position: 'relative', padding: '9px 13px', borderRadius: 10, fontSize: 18, background: unreadCount > 0 ? C.gold : C.white, color: unreadCount > 0 ? C.white : C.muted, border: `1px solid ${C.border}`, cursor: 'pointer', lineHeight: 1 }}>
            🔔
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, background: C.err, color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadCount}</span>
            )}
          </button>
        )}
      </div>

      {/* What the sheet holds is what you see below */}
      <div style={s.syncRow}>
        {Ic.sheet}
        <span>
          {syncing ? 'Reading the sheet…'
            : lastSync ? `Showing the sheet as of ${formatTime(lastSync).toLowerCase()}`
              : 'Connect to load the sheet'}
        </span>
        {accessToken && !syncing && (
          <button style={s.refreshBtn} onClick={() => loadSheet(accessToken, visibleStaff)}>Refresh</button>
        )}
      </div>

      {error && <div style={s.banner('err')}>{Ic.warn} {error}</div>}
      {success && <div style={s.banner('ok')}>{Ic.check} {success}</div>}

      {visibleStaff.length > 1 && (
        <div style={s.tabRow}>
          {visibleStaff.map(name => (
            <button key={name} style={s.tab(activeStaff === name)} onClick={() => setActiveStaff(name)}>{name}</button>
          ))}
        </div>
      )}

      {activeStaff && (
        <div style={s.card}>
          <div style={s.staffName}>{activeStaff}</div>
          <div style={s.statusText}>
            <span style={s.dot(isActive)} />
            {onRestToday
              ? 'Rest day today'
              : rec(activeStaff).timeIn
                ? `In: ${rec(activeStaff).timeIn}`
                : accessToken ? 'No clock in on the sheet today' : 'Sheet not loaded'}
            {!onRestToday && rec(activeStaff).timeOut ? `  ·  Out: ${rec(activeStaff).timeOut}` : ''}
          </div>

          {onRestToday ? (
            <>
              <div style={s.restTodayBox}>
                {Ic.cal}
                {autoRestToday
                  ? `${WEEKDAY[WEEKLY_REST[activeStaff]]} is ${activeStaff}'s rest day — clock in is off.`
                  : `It's ${activeStaff}'s rest day today — clock in is off.`}
              </div>
              <button
                onClick={() => setRestOverride(true)}
                style={{ background: 'none', border: 'none', color: C.terra, fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: 10, textDecoration: 'underline' }}>
                {activeStaff} is covering a shift today — turn clock in back on
              </button>
            </>
          ) : !accessToken ? (
            <div style={{ ...s.restTodayBox, background: C.errBg, border: `1px solid ${C.errBorder}`, color: C.err }}>
              {Ic.lock} Connect to record log above to enable Clock In / Out.
            </div>
          ) : (
            <>
              {!rec(activeStaff).timeIn
                ? <button style={{ ...s.bigBtn, ...s.inBtn }} onClick={() => startAction(activeStaff, 'IN')}>{Ic.login} Clock In</button>
                : <button style={{ ...s.bigBtn, ...s.doneBtn, marginBottom: 8 }} disabled>{Ic.check} Clocked In at {rec(activeStaff).timeIn}</button>
              }
              {rec(activeStaff).timeIn && !rec(activeStaff).timeOut
                ? <button style={{ ...s.bigBtn, ...s.outBtn }} onClick={() => startAction(activeStaff, 'OUT')}>{Ic.logout} Clock Out</button>
                : rec(activeStaff).timeOut
                  ? <button style={{ ...s.bigBtn, ...s.doneBtn }} disabled>{Ic.check} Clocked Out at {rec(activeStaff).timeOut}</button>
                  : <button style={{ ...s.bigBtn, ...s.lockBtn }} disabled>{Ic.lock} Clock Out</button>
              }
            </>
          )}
        </div>
      )}

      {/* Manager: today's selfies — times from the sheet, photos from Firestore */}
      {role === 'manager' && STAFF_LIST.some(n => rec(n).timeIn) && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 8 }}>Today's Selfies</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {STAFF_LIST.map(name => {
              const r = rec(name);
              const p = photosOf(name);
              if (!r.timeIn) return null;
              const noPhoto = { width: '100%', aspectRatio: '1/1', borderRadius: 8, background: C.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 };
              return (
                <div key={name} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px', flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{name}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      {p.photoInData
                        ? <div style={{ cursor: 'pointer' }} onClick={() => setPhotoViewer({ url: p.photoInData, docId: p.docId, field: 'photoInData', staff: name, label: 'Clock In' })}>
                            <img src={p.photoInData} alt="clock-in" style={{ width: '100%', borderRadius: 8, objectFit: 'cover', aspectRatio: '1/1' }} />
                          </div>
                        : <div style={noPhoto}>👤</div>
                      }
                      <div style={{ fontSize: 9.5, color: C.green, fontWeight: 700, textAlign: 'center', marginTop: 3 }}>IN {r.timeIn.slice(0, 8)}</div>
                    </div>
                    {r.timeOut && (
                      <div style={{ flex: 1 }}>
                        {p.photoOutData
                          ? <div style={{ cursor: 'pointer' }} onClick={() => setPhotoViewer({ url: p.photoOutData, docId: p.docId, field: 'photoOutData', staff: name, label: 'Clock Out' })}>
                              <img src={p.photoOutData} alt="clock-out" style={{ width: '100%', borderRadius: 8, objectFit: 'cover', aspectRatio: '1/1' }} />
                            </div>
                          : <div style={noPhoto}>👤</div>
                        }
                        <div style={{ fontSize: 9.5, color: C.terra, fontWeight: 700, textAlign: 'center', marginTop: 3 }}>OUT {r.timeOut.slice(0, 8)}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rest days */}
      <div style={s.card}>
        <div style={s.restHead}>{Ic.cal}<span style={s.restTitle}>Rest Days</span></div>
        <div style={s.restSub}>Pick an extra day off. On a rest day, clock in is disabled — and it shows in the summary and record sheet.</div>

        {Object.keys(WEEKLY_REST).length > 0 && (
          <div style={{ background: C.cream, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 5 }}>Every week, automatically</div>
            {STAFF_LIST.filter(n => WEEKLY_REST[n] !== undefined).map(n => (
              <div key={n} style={{ fontSize: 13, color: C.ink, display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span>{n}</span>
                <span style={{ fontWeight: 700 }}>{WEEKDAY[WEEKLY_REST[n]]}</span>
              </div>
            ))}
          </div>
        )}

        {activeStaff && (
          <>
            <div style={s.restInputRow}>
              <input type="date" min={today} value={restDate} onChange={e => { setRestDate(e.target.value); setRestWarning(''); }} style={s.dateInput} />
              <button style={s.setBtn} onClick={addRestDay} disabled={restSaving}>{restSaving ? 'Saving…' : `Set for ${activeStaff}`}</button>
            </div>
            {restWarning && (
              <div style={{ ...s.banner('err'), background: C.warnBg, border: `1px solid ${C.warnBorder}`, color: C.warn, marginBottom: 12 }}>
                {Ic.warn} {restWarning}
              </div>
            )}
          </>
        )}

        {upcoming.length === 0
          ? <div style={{ fontSize: 12.5, color: C.muted, textAlign: 'center', padding: '10px 0' }}>No rest days set yet.</div>
          : upcoming.map(entry => {
              const clash = dateCounts[entry.date] > 1;
              const canDelete = role === 'manager' || entry.staff === userName;
              return (
                <div key={entry.id} style={s.restItem(clash)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{entry.staff}</div>
                    <div style={{ fontSize: 11.5, color: clash ? C.warn : C.muted, display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
                      {prettyDate(entry.date)}
                      {entry.inSheet !== true && <span style={{ color: C.warn }}>· not in sheet yet</span>}
                      {clash && <><span style={{ display: 'inline-flex', color: C.warn }}>{Ic.warn}</span> overlap</>}
                    </div>
                  </div>
                  {canDelete && (
                    <button onClick={() => removeRestDay(entry)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 }}>{Ic.close}</button>
                  )}
                </div>
              );
            })
        }
      </div>

      {/* Selfie modal */}
      {pendingAction && (
        <div style={s.modal}>
          <div style={s.modalCard}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 14, textAlign: 'center' }}>
              Selfie to clock {pendingAction.type} — {pendingAction.staffName}
            </div>
            {photo
              ? <img src={photo} alt="selfie" style={{ width: '100%', borderRadius: 12, maxHeight: 200, objectFit: 'cover', marginBottom: 12 }} />
              : <div style={s.cameraBox} onClick={() => fileRef.current.click()}>
                  <div style={{ marginBottom: 6 }}>{Ic.camera}</div>
                  <div style={{ fontSize: 13, color: C.terra }}>Tap to take selfie</div>
                </div>
            }
            <input ref={fileRef} type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={handleFile} />
            {photo && (
              <>
                <button style={s.confirmBtn} onClick={confirmAction} disabled={loading}>
                  {loading ? 'Saving to the sheet…' : `Confirm Clock ${pendingAction.type}`}
                </button>
                <button style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer', width: '100%', marginTop: 8 }} onClick={() => { setPhoto(null); setPhotoFile(null); }}>Retake</button>
              </>
            )}
            <button style={s.cancelBtn} onClick={() => { setPendingAction(null); setPhoto(null); setPhotoFile(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Summary modal */}
      {summaryOpen && (
        <div style={s.modal} onClick={() => setSummaryOpen(false)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: C.ink }}>Attendance Summary</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{activeStaff}</div>
              </div>
              <button onClick={() => setSummaryOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 }}>{Ic.close}</button>
            </div>

            {!summaryLoading && (
              <>
                <div style={s.monthRow}>
                  <button
                    style={s.monthBtn(monthIdx >= summaryMonths.length - 1)}
                    disabled={monthIdx >= summaryMonths.length - 1}
                    onClick={() => setSummaryMonth(summaryMonths[monthIdx + 1])}
                    aria-label="Previous month">‹</button>
                  <div style={s.monthLbl}>{monthLabel(summaryMonth)}</div>
                  <button
                    style={s.monthBtn(monthIdx <= 0)}
                    disabled={monthIdx <= 0}
                    onClick={() => setSummaryMonth(summaryMonths[monthIdx - 1])}
                    aria-label="Next month">›</button>
                </div>
                <div style={s.monthNote}>
                  {isCurrentMonth ? 'This month · resets on the 1st' : 'Past month · kept for reference'}
                </div>

                {conflicts.length > 0 && (
                  <div style={{ ...s.banner('err'), background: C.warnBg, border: `1px solid ${C.warnBorder}`, color: C.warn, alignItems: 'flex-start' }}>
                    {Ic.warn}
                    <span>
                      {conflicts.length} date{conflicts.length === 1 ? ' has' : 's have'} more than one row in the sheet, with the extra row marked absent or rest: {conflicts.join(', ')}. The worked row is being used. Clean these up in the sheet.
                    </span>
                  </div>
                )}

                <div style={{ ...s.statStrip, flexWrap: 'wrap' }}>
                  <div style={{ ...s.statBox, minWidth: 68 }}><div style={s.statNum}>{summaryStats.worked}</div><div style={s.statLbl}>Full days</div></div>
                  <div style={{ ...s.statBox, minWidth: 68 }}><div style={s.statNum}>{summaryStats.half}</div><div style={s.statLbl}>Half days</div></div>
                  <div style={{ ...s.statBox, minWidth: 68 }}><div style={s.statNum}>{summaryStats.rest}</div><div style={s.statLbl}>Rest days</div></div>
                  <div style={{ ...s.statBox, minWidth: 68 }}><div style={{ ...s.statNum, color: summaryStats.absent > 0 ? C.err : C.ink }}>{summaryStats.absent}</div><div style={s.statLbl}>Absent</div></div>
                </div>
                {(summaryStats.half > 0 || summaryStats.rest > 0 || summaryStats.absent > 0) && (
                  <div style={s.breakdown}>
                    {summaryStats.half > 0 && (
                      <div style={s.breakRow}>
                        <span style={s.breakLbl}>Half days</span>
                        <span style={s.breakVal}>{datesFor('half').join(', ')} — clocked in, no clock out</span>
                      </div>
                    )}
                    {summaryStats.rest > 0 && (
                      <div style={s.breakRow}>
                        <span style={s.breakLbl}>Rest days</span>
                        <span style={s.breakVal}>{datesFor('rest').join(', ')}</span>
                      </div>
                    )}
                    {summaryStats.absent > 0 && (
                      <div style={s.breakRow}>
                        <span style={s.breakLbl}>Absent</span>
                        <span style={{ ...s.breakVal, color: C.err }}>{datesFor('absent').join(', ')} — no record on the sheet</span>
                      </div>
                    )}
                  </div>
                )}

                <div style={s.salaryBar}>
                  <div>
                    <div style={s.salaryLabel}>Salary</div>
                    <div style={s.salaryNote}>{summaryStats.worked} full + {summaryStats.half} half × {peso(DAILY_RATE)}</div>
                  </div>
                  <div style={s.salaryNum}>{peso(summaryStats.salary)}</div>
                </div>
              </>
            )}

            {summaryLoading
              ? <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '20px 0' }}>Loading…</div>
              : summaryRows.length === 0
                ? <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '20px 0' }}>No entries for {monthLabel(summaryMonth)} yet.</div>
                : (
                  <table style={s.sumTable}>
                    <thead>
                      <tr>
                        <th style={s.sumTh}>Date</th>
                        <th style={s.sumTh}>Clock In</th>
                        <th style={s.sumTh}>Clock Out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryRows.map((r, i) => {
                        if (r.status === 'rest') return (
                          <tr key={i}>
                            <td style={s.sumTd}>{r.date}</td>
                            <td style={s.sumTd} colSpan={2}><span style={s.restPill}>Rest day</span></td>
                          </tr>
                        );
                        if (r.status === 'absent') return (
                          <tr key={i}>
                            <td style={s.sumTd}>{r.date}</td>
                            <td style={s.sumTd} colSpan={2}><span style={s.absentPill}>Absent</span></td>
                          </tr>
                        );
                        if (r.status === 'pending') return (
                          <tr key={i}>
                            <td style={s.sumTd}>{r.date}</td>
                            <td style={{ ...s.sumTd, color: C.muted }} colSpan={2}>Not clocked in yet</td>
                          </tr>
                        );
                        return (
                          <tr key={i}>
                            <td style={s.sumTd}>{r.date}</td>
                            <td style={s.sumTd}>{r.timeIn || '—'}</td>
                            <td style={s.sumTd}>
                              {r.status === 'half'
                                ? <span style={s.halfPill}>Half day</span>
                                : r.status === 'active'
                                  ? <span style={s.activePill}>On shift</span>
                                  : (r.timeOut || '—')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
            }
          </div>
        </div>
      )}

      {/* Notification modal (manager) */}
      {notifOpen && role === 'manager' && (
        <div style={s.modal} onClick={() => setNotifOpen(false)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: C.ink }}>🔔 Notifications</div>
              <button onClick={() => setNotifOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 }}>{Ic.close}</button>
            </div>
            {notifications.length === 0 ? (
              <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '20px 0' }}>No notifications yet.</div>
            ) : (
              notifications.map(n => (
                <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: 12, marginBottom: 8, background: n.read ? C.cream : '#fff8e8', border: `1px solid ${n.read ? C.border : '#f0d090'}` }}>
                  {n.photoData
                    ? (
                      <img src={n.photoData} alt="selfie"
                        style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0, cursor: 'pointer', border: `2px solid ${C.gold}` }}
                        onClick={() => { setPhotoViewer({ url: n.photoData, docId: photosOf(n.staff).docId, field: n.type === 'IN' ? 'photoInData' : 'photoOutData', staff: n.staff, label: `Clock ${n.type}` }); setNotifOpen(false); }}
                      />
                    ) : (
                      <div style={{ width: 52, height: 52, borderRadius: 10, background: C.soft, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👤</div>
                    )
                  }
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{n.staff}</div>
                    <div style={{ fontSize: 12, color: n.type === 'IN' ? C.green : C.terra, fontWeight: 600 }}>
                      Clocked {n.type === 'IN' ? 'In' : 'Out'} at {n.time}
                    </div>
                  </div>
                  {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.gold, flexShrink: 0 }} />}
                </div>
              ))
            )}
            {notifications.length > 0 && (
              <button onClick={() => setNotifications([])} style={{ width: '100%', marginTop: 8, padding: '10px', borderRadius: 10, background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, fontSize: 12, cursor: 'pointer' }}>
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* Photo viewer modal (manager) */}
      {photoViewer && role === 'manager' && (
        <div style={s.modal} onClick={() => setPhotoViewer(null)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: C.ink }}>{photoViewer.staff} — {photoViewer.label}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Manager only</div>
              </div>
              <button onClick={() => setPhotoViewer(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 }}>{Ic.close}</button>
            </div>
            <img
              src={photoViewer.url} alt="selfie"
              style={{ width: '100%', borderRadius: 14, objectFit: 'cover', maxHeight: 340, marginBottom: 14 }}
              onError={e => { e.target.src = ''; e.target.alt = 'Image unavailable'; }}
            />
            <button
              onClick={() => deletePhoto(photoViewer.docId, photoViewer.field)}
              disabled={deletingPhoto || !photoViewer.docId}
              style={{ width: '100%', padding: '13px', borderRadius: 11, background: deletingPhoto ? C.soft : C.errBg, color: C.err, border: `1.5px solid ${C.errBorder}`, fontSize: 14, fontWeight: 700, cursor: deletingPhoto ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {Ic.warn} {deletingPhoto ? 'Deleting…' : 'Delete this photo'}
            </button>
            <button onClick={() => setPhotoViewer(null)} style={s.cancelBtn}>Close</button>
          </div>
        </div>
      )}

      <div style={{ height: 80 }} />
    </div>
  );
}
