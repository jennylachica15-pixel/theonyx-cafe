import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';

const SHEET_ID = '15o1OUhOO17s1ifKSlYonPrmtJEAP1qQRLoMCI7_N0DM';
const ATTENDANCE_FOLDER_ID = '1xuC8werkmhShXi1qSjUPTuj_EtZzk9V3';
const GOOGLE_CLIENT_ID = '596322682185-n5hm66hvol3nnqqllnuop995kcnefbgu.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';
const STAFF_LIST = ['Kelly', 'Maryz'];

const s = {
  page: { padding: '16px 16px 0', animation: 'fadeIn 0.3s ease' },
  title: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#1a0a00', marginBottom: 4 },
  sub: { fontSize: 13, color: '#c8956c', marginBottom: 16 },
  tabRow: { display: 'flex', background: 'white', borderRadius: 12, padding: 4, marginBottom: 16, boxShadow: '0 1px 4px rgba(26,10,0,0.06)' },
  tab: (active) => ({ flex: 1, padding: '9px', borderRadius: 9, fontSize: 13, fontWeight: active ? 700 : 400, background: active ? '#1a0a00' : 'transparent', color: active ? '#f0d080' : '#c8956c', border: 'none', cursor: 'pointer' }),
  card: { background: 'white', borderRadius: 14, padding: '18px', marginBottom: 12, boxShadow: '0 1px 6px rgba(26,10,0,0.07)' },
  staffName: { fontSize: 18, fontWeight: 700, color: '#1a0a00', marginBottom: 4 },
  statusText: { fontSize: 12, color: '#c8956c', marginBottom: 14 },
  connectBtn: { width: '100%', padding: '13px', borderRadius: 12, background: '#1a73e8', color: 'white', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16, border: 'none', cursor: 'pointer' },
  connectedBadge: { background: '#d8f3dc', color: '#2d6a4f', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 500, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 },
  inBtn: { width: '100%', padding: '13px', borderRadius: 10, background: '#d8f3dc', color: '#2d6a4f', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', marginBottom: 8 },
  outBtn: { width: '100%', padding: '13px', borderRadius: 10, background: '#ffe0e0', color: '#c1121f', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer' },
  disabledBtn: { width: '100%', padding: '13px', borderRadius: 10, background: '#f0f0f0', color: '#bbb', fontWeight: 600, fontSize: 15, border: 'none', cursor: 'not-allowed', marginBottom: 8 },
  modal: { position: 'fixed', inset: 0, background: 'rgba(26,10,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modalCard: { background: '#fdf6ee', borderRadius: '20px 20px 0 0', padding: '28px 24px 40px', width: '100%', maxWidth: 480, animation: 'slideUp 0.3s ease' },
  cameraBox: { background: '#f5ede4', borderRadius: 12, padding: 24, textAlign: 'center', border: '2px dashed #e8d8c8', cursor: 'pointer', marginBottom: 12 },
  confirmBtn: (type) => ({ width: '100%', padding: '13px', borderRadius: 12, background: type === 'IN' ? '#2d6a4f' : '#c1121f', color: 'white', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', marginTop: 10 }),
  cancelBtn: { width: '100%', padding: '12px', borderRadius: 12, background: '#fdf6ee', color: '#6b3a1f', fontSize: 13, border: '1.5px solid #e8d8c8', cursor: 'pointer', marginTop: 8 },
};

export default function Attendance({ role, userName }) {
  const [accessToken, setAccessToken] = useState(null);
  const [activeStaff, setActiveStaff] = useState(null);
  const [records, setRecords] = useState({}); // { Kelly: { timeIn, timeOut, rowIndex }, Maryz: {...} }
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const fileRef = useRef();
  const tokenClientRef = useRef(null);

  // Determine which staff tabs to show
  const visibleStaff = role === 'manager' ? STAFF_LIST : (userName ? [userName] : []);

  useEffect(() => {
    if (visibleStaff.length > 0) setActiveStaff(visibleStaff[0]);
  }, [userName, role]);

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

  const formatTime = d => d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDate = d => d.toLocaleDateString('en-PH', { month: '2-digit', day: '2-digit', year: 'numeric' });

  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPhoto(ev.target.result);
    reader.readAsDataURL(file);
  };

  const startAction = (staffName, type) => {
    if (!accessToken) { setError('Connect Google Sheets first.'); return; }
    setPendingAction({ staffName, type });
    setPhoto(null); setPhotoFile(null);
  };

  const uploadSelfie = async (staffName, type) => {
    if (!photoFile || !accessToken) return '';
    const now = new Date();
    const fileName = `${staffName}_${type}_${formatDate(now).replace(/\//g,'-')}.jpg`;
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name: fileName, parents: [ATTENDANCE_FOLDER_ID], mimeType: 'image/jpeg' })], { type: 'application/json' }));
    form.append('file', photoFile);
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form });
    if (!res.ok) return '';
    const data = await res.json();
    return data.id || '';
  };

  const confirmAction = async () => {
    if (!photoFile) { setError('Please take a selfie first.'); return; }
    const { staffName, type } = pendingAction;
    setLoading(true); setError('');
    const now = new Date();
    const timeNow = formatTime(now);
    const today = formatDate(now);
    try {
      const photoId = await uploadSelfie(staffName, type);
      if (type === 'IN') {
        const values = [[today, staffName, timeNow, photoId, '', '']];
        const res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${staffName}!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
          { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values }) }
        );
        const data = await res.json();
        const range = data.updates?.updatedRange || '';
        const rowMatch = range.match(/(\d+)$/);
        const rowIndex = rowMatch ? parseInt(rowMatch[1]) : null;
        setRecords(prev => ({ ...prev, [staffName]: { timeIn: timeNow, timeOut: null, rowIndex } }));
      } else {
        const rowIndex = records[staffName]?.rowIndex;
        if (rowIndex) {
          await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${staffName}!E${rowIndex}:F${rowIndex}?valueInputOption=USER_ENTERED`,
            { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [[timeNow, photoId]] }) }
          );
        }
        setRecords(prev => ({ ...prev, [staffName]: { ...prev[staffName], timeOut: timeNow } }));
      }
      setSuccess(`✅ ${staffName} clocked ${type} at ${timeNow}`);
      setPendingAction(null); setPhoto(null); setPhotoFile(null);
      setTimeout(() => setSuccess(''), 4000);
    } catch (e) { setError('Failed to save. Please try again.'); }
    setLoading(false);
  };

  const rec = (name) => records[name] || {};

  return (
    <div style={s.page}>
      <div style={s.title}>Attendance</div>
      <div style={s.sub}>Time In / Time Out</div>

      {!accessToken
        ? <button style={s.connectBtn} onClick={() => tokenClientRef.current?.requestAccessToken()}>🔗 Connect Google Sheets</button>
        : <div style={s.connectedBadge}>✅ Google Sheets connected</div>
      }

      {error && <div style={{ background: '#ffe0e0', color: '#c1121f', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}
      {success && <div style={{ background: '#d8f3dc', color: '#2d6a4f', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>{success}</div>}

      {/* Staff tabs — manager sees both, staff sees own */}
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
            {rec(activeStaff).timeIn ? `⏰ In: ${rec(activeStaff).timeIn}` : 'Not clocked in today'}
            {rec(activeStaff).timeOut ? ` · Out: ${rec(activeStaff).timeOut}` : ''}
          </div>
          {!rec(activeStaff).timeIn
            ? <button style={s.inBtn} onClick={() => startAction(activeStaff, 'IN')}>🟢 Clock In</button>
            : <button style={{ ...s.disabledBtn, background: '#d8f3dc', color: '#2d6a4f', opacity: 0.5 }} disabled>✅ Clocked In at {rec(activeStaff).timeIn}</button>
          }
          {rec(activeStaff).timeIn && !rec(activeStaff).timeOut
            ? <button style={s.outBtn} onClick={() => startAction(activeStaff, 'OUT')}>🔴 Clock Out</button>
            : rec(activeStaff).timeOut
              ? <button style={{ ...s.disabledBtn, marginBottom: 0 }} disabled>✅ Clocked Out at {rec(activeStaff).timeOut}</button>
              : <button style={{ ...s.disabledBtn, marginBottom: 0 }} disabled>🔒 Clock Out</button>
          }
        </div>
      )}

      {/* Photo modal */}
      {pendingAction && (
        <div style={s.modal}>
          <div style={s.modalCard}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#1a0a00', marginBottom: 14, textAlign: 'center' }}>
              📷 Selfie to Clock {pendingAction.type} — {pendingAction.staffName}
            </div>
            {photo
              ? <img src={photo} alt="selfie" style={{ width: '100%', borderRadius: 12, maxHeight: 200, objectFit: 'cover', marginBottom: 12 }} />
              : <div style={s.cameraBox} onClick={() => fileRef.current.click()}>
                  <div style={{ fontSize: 40, marginBottom: 6 }}>🤳</div>
                  <div style={{ fontSize: 13, color: '#6b3a1f' }}>Tap to take selfie</div>
                </div>
            }
            <input ref={fileRef} type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={handleFile} />
            {photo && (
              <>
                <button style={s.confirmBtn(pendingAction.type)} onClick={confirmAction} disabled={loading}>
                  {loading ? 'Saving...' : `Confirm Clock ${pendingAction.type}`}
                </button>
                <button style={{ background: 'none', border: 'none', color: '#c8956c', fontSize: 12, cursor: 'pointer', width: '100%', marginTop: 8, textAlign: 'center' }} onClick={() => { setPhoto(null); setPhotoFile(null); }}>Retake</button>
              </>
            )}
            <button style={s.cancelBtn} onClick={() => { setPendingAction(null); setPhoto(null); setPhotoFile(null); }}>Cancel</button>
          </div>
        </div>
      )}
      <div style={{ height: 80 }} />
    </div>
  );
}
