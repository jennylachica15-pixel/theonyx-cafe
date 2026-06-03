import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase/config';
import {
  collection, addDoc, deleteDoc, updateDoc, doc,
  onSnapshot, query, orderBy, where, serverTimestamp, getDocs
} from 'firebase/firestore';

const SHEET_ID = '15o1OUhOO17s1ifKSlYonPrmtJEAP1qQRLoMCI7_N0DM';
const ATTENDANCE_FOLDER_ID = '1xuC8werkmhShXi1qSjUPTuj_EtZzk9V3';
const GOOGLE_CLIENT_ID = '596322682185-n5hm66hvol3nnqqllnuop995kcnefbgu.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';
const STAFF_LIST = ['Kelly', 'Maryz'];
const DAILY_RATE = 400;

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
  connectedBadge: { flex: 1, padding: '9px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: C.greenBg, border: `1px solid ${C.greenBorder}`, color: C.green },
  summaryBtn: { background: C.white, color: C.ink, border: `1px solid ${C.border}` },
  banner: (kind) => ({ borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
    background: kind === 'err' ? C.errBg : C.greenBg, border: `1px solid ${kind === 'err' ? C.errBorder : C.greenBorder}`, color: kind === 'err' ? C.err : C.green }),
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
  restItem: (clash) => ({ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, marginBottom: 7,
    background: clash ? C.warnBg : C.cream, border: `1px solid ${clash ? C.warnBorder : C.border}` }),
  statStrip: { display: 'flex', gap: 8, marginBottom: 16 },
  statBox: { flex: 1, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 8px', textAlign: 'center' },
  statNum: { fontSize: 18, fontWeight: 700, color: C.ink },
  statLbl: { fontSize: 9.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 3 },
  restPill: { display: 'inline-block', fontSize: 11, fontWeight: 700, color: C.warn, background: C.warnBg, border: `1px solid ${C.warnBorder}`, borderRadius: 20, padding: '2px 10px' },
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
  syncBadge: { fontSize: 10, color: C.green, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 },
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
  sync: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
};

const localIso = (d = new Date()) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const prettyDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
};
const peso = (n) => '\u20B1' + Number(n).toLocaleString('en-PH');
const fmtMDY = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;

const displayDate = (val) => {
  if (val === '' || val === null || val === undefined) return '';
  const str = String(val).trim();
  if (/^\d+(\.\d+)?$/.test(str)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(parseFloat(str)) * 86400000);
    return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`;
  }
  return str;
};
const displayTime = (val) => {
  if (val === '' || val === null || val === undefined) return '—';
  const str = String(val).trim();
  if (str === '') return '—';
  if (/^\d*\.\d+$/.test(str)) {
    const frac = parseFloat(str) - Math.floor(parseFloat(str));
    const total = Math.round(frac * 86400);
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), sec = total % 60;
    return `${(h % 12) || 12}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  }
  return str;
};

async function appendRestRow(staffName, sheetDate, token) {
  const values = [[sheetDate, staffName, 'REST DAY', '', '', '']];
  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${staffName}!A:F:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values }) }
    );
    return res.ok;
  } catch { return false; }
}

export default function Attendance({ role, userName }) {
  const [accessToken, setAccessToken] = useState(null);
  const [activeStaff, setActiveStaff] = useState(null);

  // ── KEY CHANGE: records now come from Firestore (real-time), not localStorage ──
  const [firestoreRecords, setFirestoreRecords] = useState({});

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const fileRef = useRef();
  const tokenClientRef = useRef(null);

  // summary modal
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryRows, setSummaryRows] = useState([]);
  const [summaryStats, setSummaryStats] = useState({ worked: 0, rest: 0, salary: 0 });

  // rest days
  const [restDays, setRestDays] = useState([]);
  const [restDate, setRestDate] = useState('');
  const [restWarning, setRestWarning] = useState('');
  const [restSaving, setRestSaving] = useState(false);

  const visibleStaff = role === 'manager' ? STAFF_LIST : (userName ? [userName] : []);
  const today = localIso();

  // ── Google Sign-in ──
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
    script.onload = () => {
      if (!window.google) return;
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID, scope: SCOPES,
        callback: res => { if (res.access_token) setAccessToken(res.access_token); },
      });
    };
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  useEffect(() => {
    if (visibleStaff.length > 0) setActiveStaff(visibleStaff[0]);
  }, [userName, role]);

  // ── REAL-TIME: listen to today's attendance from Firestore ──
  // This fires on ALL devices the moment any device writes a clock-in/out
  useEffect(() => {
    const q = query(
      collection(db, 'attendance'),
      where('date', '==', today)
    );
    const unsub = onSnapshot(q, (snap) => {
      const recs = {};
      snap.docs.forEach(d => {
        const data = d.data();
        recs[data.staff] = {
          timeIn: data.timeIn || null,
          timeOut: data.timeOut || null,
          docId: d.id,
          rowIndex: data.rowIndex || null,
        };
      });
      setFirestoreRecords(recs);
    });
    return () => unsub();
  }, [today]);

  // ── Rest days listener ──
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'restDays'), orderBy('date', 'asc')), snap => {
      setRestDays(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const formatTime = d => d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDate = d => fmtMDY(d);
  const sheetDateFromIso = iso => { const [y, m, d] = iso.split('-').map(Number); return formatDate(new Date(y, m - 1, d)); };

  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPhoto(ev.target.result);
    reader.readAsDataURL(file);
  };

  const startAction = (staffName, type) => {
    if (!accessToken) { setError('Connect to record log first.'); return; }
    const r = firestoreRecords[staffName] || {};
    if (type === 'IN' && r.timeIn) { setError('Already clocked in today.'); return; }
    if (type === 'OUT' && (r.timeOut || !r.timeIn)) {
      setError(r.timeOut ? 'Already clocked out today.' : 'Clock in first.');
      return;
    }
    setPendingAction({ staffName, type });
    setPhoto(null); setPhotoFile(null);
  };

  const uploadSelfie = async (staffName, type) => {
    if (!photoFile || !accessToken) return '';
    const now = new Date();
    const fileName = `${staffName}_${type}_${formatDate(now).replace(/\//g, '-')}.jpg`;
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name: fileName, parents: [ATTENDANCE_FOLDER_ID], mimeType: 'image/jpeg' })], { type: 'application/json' }));
    form.append('file', photoFile);
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form
    });
    if (!res.ok) return '';
    const data = await res.json();
    return data.id || '';
  };

  // ── CLOCK IN/OUT: writes to BOTH Google Sheets AND Firestore ──
  const confirmAction = async () => {
    if (!photoFile) { setError('Please take a selfie first.'); return; }
    const { staffName, type } = pendingAction;
    setLoading(true); setError('');
    const now = new Date();
    const timeNow = formatTime(now);
    const sheetDate = formatDate(now);

    try {
      const photoId = await uploadSelfie(staffName, type);
      const existingDoc = firestoreRecords[staffName];

      if (type === 'IN') {
        // 1. Write to Google Sheets
        const values = [[sheetDate, staffName, timeNow, photoId, '', '']];
        const res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${staffName}!A:F:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
          { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values }) }
        );
        const data = await res.json();
        const range = data.updates?.updatedRange || '';
        const rowMatch = range.match(/(\d+)$/);
        const rowIndex = rowMatch ? parseInt(rowMatch[1]) : null;

        // 2. Write to Firestore — this triggers real-time sync on all devices
        await addDoc(collection(db, 'attendance'), {
          staff: staffName,
          date: today,
          timeIn: timeNow,
          timeOut: null,
          rowIndex,
          photoInId: photoId,
          createdAt: serverTimestamp(),
        });

      } else {
        // Clock OUT
        const rowIndex = existingDoc?.rowIndex;

        // 1. Update Google Sheets
        if (rowIndex) {
          await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${staffName}!E${rowIndex}:F${rowIndex}?valueInputOption=RAW`,
            { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [[timeNow, photoId]] }) }
          );
        }

        // 2. Update Firestore — triggers real-time sync on all devices
        if (existingDoc?.docId) {
          await updateDoc(doc(db, 'attendance', existingDoc.docId), {
            timeOut: timeNow,
            photoOutId: photoId,
          });
        }
      }

      setSuccess(`${staffName} clocked ${type} at ${timeNow}`);
      setPendingAction(null); setPhoto(null); setPhotoFile(null);
      setTimeout(() => setSuccess(''), 4000);
    } catch (e) {
      console.error(e);
      setError('Failed to save. Please try again.');
    }
    setLoading(false);
  };

  // ── Summary: reads from Firestore for speed, falls back to Sheets ──
  const openSummary = async () => {
    if (!accessToken) { setError('Connect to record log first to view the summary.'); return; }
    if (!activeStaff) return;
    setSummaryOpen(true); setSummaryLoading(true);
    setSummaryRows([]); setSummaryStats({ worked: 0, rest: 0, salary: 0 }); setError('');

    try {
      // Sync any un-synced rest days to sheet
      const toSync = restDays.filter(r => r.staff === activeStaff && r.inSheet !== true);
      for (const r of toSync) {
        const ok = await appendRestRow(activeStaff, sheetDateFromIso(r.date), accessToken);
        if (ok) { try { await updateDoc(doc(db, 'restDays', r.id), { inSheet: true }); } catch {} }
      }

      // Read from Google Sheets (the master record)
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${activeStaff}!A:F`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) { setSummaryLoading(false); return; }
      const data = await res.json();
      const rows = (data.values || [])
        .filter(r => r && r[1] && String(r[1]).toLowerCase() !== 'name')
        .map(r => ({ isRest: String(r[2]).toUpperCase() === 'REST DAY', date: displayDate(r[0]), timeIn: displayTime(r[2]), timeOut: displayTime(r[4]) }));
      const workedDates = new Set(rows.filter(r => !r.isRest && r.date).map(r => r.date));
      const restDateSet = new Set(rows.filter(r => r.isRest).map(r => r.date));
      setSummaryStats({ worked: workedDates.size, rest: restDateSet.size, salary: workedDates.size * DAILY_RATE });
      setSummaryRows(rows.reverse());
    } catch { setError('Could not load summary. Try reconnecting.'); }
    setSummaryLoading(false);
  };

  // ── Rest days ──
  const dateCounts = {};
  restDays.forEach(r => { dateCounts[r.date] = (dateCounts[r.date] || 0) + 1; });
  const upcoming = restDays.filter(r => r.date >= today);
  const onRestToday = activeStaff ? restDays.some(r => r.staff === activeStaff && r.date === today) : false;

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
      if (accessToken) inSheet = await appendRestRow(activeStaff, sheetDateFromIso(restDate), accessToken);
      await addDoc(collection(db, 'restDays'), { staff: activeStaff, date: restDate, inSheet, createdAt: serverTimestamp() });
      setRestWarning(clash ? `Heads up — ${clash.staff} also has a rest day on ${prettyDate(restDate)}.` : '');
      setRestDate('');
    } catch { setRestWarning('Could not save. Try again.'); }
    setRestSaving(false);
  };

  const removeRestDay = async (entry) => {
    if (role !== 'manager' && entry.staff !== userName) return;
    try { await deleteDoc(doc(db, 'restDays', entry.id)); } catch {}
  };

  const rec = (name) => firestoreRecords[name] || {};
  const isActive = !!rec(activeStaff)?.timeIn && !rec(activeStaff)?.timeOut && !onRestToday;

  return (
    <div style={s.page}>
      <div style={s.title}>Attendance</div>
      <div style={s.sub}>Time In / Time Out</div>

      {/* connect + summary row */}
      <div style={s.actionRow}>
        {!accessToken
          ? <button style={{ ...s.smallBtn, ...s.connectBtn }} onClick={() => tokenClientRef.current?.requestAccessToken()}>{Ic.link} Connect to record log</button>
          : <div style={s.connectedBadge}>{Ic.check} Log connected</div>
        }
        <button style={{ ...s.smallBtn, ...s.summaryBtn }} onClick={openSummary}>{Ic.list} Summary</button>
      </div>

      {/* Real-time sync indicator */}
      <div style={s.syncBadge}>{Ic.sync} Live sync — updates instantly on all devices</div>

      {error && <div style={s.banner('err')}>{Ic.warn} {error}</div>}
      {success && <div style={s.banner('ok')}>{Ic.check} {success}</div>}

      {/* staff tabs */}
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
            {onRestToday ? 'Rest day today'
              : rec(activeStaff).timeIn ? `In: ${rec(activeStaff).timeIn}` : 'Not clocked in today'}
            {!onRestToday && rec(activeStaff).timeOut ? `  ·  Out: ${rec(activeStaff).timeOut}` : ''}
          </div>

          {onRestToday ? (
            <div style={s.restTodayBox}>{Ic.cal} It's {activeStaff}'s rest day today — Clock In / Out is off.</div>
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

      {/* rest days */}
      <div style={s.card}>
        <div style={s.restHead}>{Ic.cal}<span style={s.restTitle}>Rest Days</span></div>
        <div style={s.restSub}>Pick your day off. On a rest day, clock in/out is disabled — and it shows in the summary and record sheet.</div>

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
                      {prettyDate(entry.date)}{clash && <><span style={{ display: 'inline-flex', color: C.warn }}>{Ic.warn}</span> overlap</>}
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

      {/* selfie modal */}
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
                  {loading ? 'Saving…' : `Confirm Clock ${pendingAction.type}`}
                </button>
                <button style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer', width: '100%', marginTop: 8 }} onClick={() => { setPhoto(null); setPhotoFile(null); }}>Retake</button>
              </>
            )}
            <button style={s.cancelBtn} onClick={() => { setPendingAction(null); setPhoto(null); setPhotoFile(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* summary modal */}
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
                <div style={s.statStrip}>
                  <div style={s.statBox}><div style={s.statNum}>{summaryStats.worked}</div><div style={s.statLbl}>Days Worked</div></div>
                  <div style={s.statBox}><div style={s.statNum}>{summaryStats.rest}</div><div style={s.statLbl}>Rest Days</div></div>
                </div>
                <div style={s.salaryBar}>
                  <div>
                    <div style={s.salaryLabel}>Salary</div>
                    <div style={s.salaryNote}>{summaryStats.worked} day{summaryStats.worked === 1 ? '' : 's'} × {peso(DAILY_RATE)}</div>
                  </div>
                  <div style={s.salaryNum}>{peso(summaryStats.salary)}</div>
                </div>
              </>
            )}

            {summaryLoading
              ? <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '20px 0' }}>Loading…</div>
              : summaryRows.length === 0
                ? <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '20px 0' }}>No records yet.</div>
                : (
                  <table style={s.sumTable}>
                    <thead>
                      <tr>
                        <th style={s.sumTh}>Date</th>
                        <th style={s.sumTh}>Time In</th>
                        <th style={s.sumTh}>Time Out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryRows.map((r, i) => (
                        r.isRest
                          ? <tr key={i}><td style={s.sumTd}>{r.date}</td><td style={s.sumTd} colSpan={2}><span style={s.restPill}>Rest Day</span></td></tr>
                          : <tr key={i}><td style={s.sumTd}>{r.date}</td><td style={s.sumTd}>{r.timeIn}</td><td style={s.sumTd}>{r.timeOut}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )
            }
          </div>
        </div>
      )}

      <div style={{ height: 80 }} />
    </div>
  );
}
