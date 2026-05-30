import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';

const SHEET_ID = '15o1OUhOO17s1ifKSlYonPrmtJEAP1qQRLoMCI7_N0DM';
const ATTENDANCE_FOLDER_ID = '1xuC8werkmhShXi1qSjUPTuj_EtZzk9V3';
const GOOGLE_CLIENT_ID = '596322682185-n5hm66hvol3nnqqllnuop995kcnefbgu.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';

const s = {
  page: { padding: '16px 16px 0', animation: 'fadeIn 0.3s ease' },
  title: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 4 },
  sub: { fontSize: 13, color: 'var(--brown-light)', marginBottom: 16 },
  card: { background: 'white', borderRadius: 14, padding: '18px', marginBottom: 12, boxShadow: '0 1px 6px rgba(26,10,0,0.07)' },
  staffName: { fontSize: 18, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 4 },
  statusText: { fontSize: 12, color: 'var(--brown-light)', marginBottom: 14 },
  connectBtn: { width: '100%', padding: '13px', borderRadius: 12, background: '#1a73e8', color: 'white', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16, border: 'none', cursor: 'pointer' },
  connectedBadge: { background: 'var(--green-bg)', color: 'var(--green-ok)', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 500, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 },
  inBtn: { width: '100%', padding: '13px', borderRadius: 10, background: 'var(--green-bg)', color: 'var(--green-ok)', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', marginBottom: 8 },
  outBtn: { width: '100%', padding: '13px', borderRadius: 10, background: 'var(--red-bg)', color: 'var(--red-crit)', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer' },
  disabledBtn: { width: '100%', padding: '13px', borderRadius: 10, background: '#f0f0f0', color: '#bbb', fontWeight: 600, fontSize: 15, border: 'none', cursor: 'not-allowed', marginBottom: 8 },
  logRow: { display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f5ede4', fontSize: 12 },
  modal: { position: 'fixed', inset: 0, background: 'rgba(26,10,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modalCard: { background: 'var(--cream)', borderRadius: '20px 20px 0 0', padding: '28px 24px 40px', width: '100%', maxWidth: 480, animation: 'slideUp 0.3s ease' },
  modalTitle: { fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 14, textAlign: 'center' },
  previewImg: { width: '100%', borderRadius: 12, maxHeight: 200, objectFit: 'cover', marginBottom: 14 },
  confirmBtn: { width: '100%', padding: '13px', borderRadius: 12, background: 'var(--brown-dark)', color: 'var(--gold-light)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', marginTop: 10 },
  cancelBtn: { width: '100%', padding: '12px', borderRadius: 12, background: 'var(--cream)', color: 'var(--brown-mid)', fontSize: 13, border: '1.5px solid #e8d8c8', cursor: 'pointer', marginTop: 8 },
  cameraBox: { background: '#f5ede4', borderRadius: 12, padding: 24, textAlign: 'center', border: '2px dashed #e8d8c8', cursor: 'pointer', marginBottom: 12 },
};

export default function Attendance() {
  const [accessToken, setAccessToken] = useState(null);
  const [userName, setUserName] = useState('');
  const [todayRecord, setTodayRecord] = useState({ timeIn: null, timeOut: null, rowIndex: null });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState(null); // 'IN' or 'OUT'
  const [photo, setPhoto] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const fileRef = useRef();
  const tokenClientRef = useRef(null);
  const user = auth.currentUser;

  useEffect(() => {
    const fetchName = async () => {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) setUserName(snap.data().name || '');
      } catch (e) {}
    };
    fetchName();
  }, [user]);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
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

  const formatTime = (d) => d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDate = (d) => d.toLocaleDateString('en-PH', { month: '2-digit', day: '2-digit', year: 'numeric' });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPhoto(ev.target.result);
    reader.readAsDataURL(file);
  };

  const startAction = (type) => {
    if (!accessToken) { setError('Connect Google Sheets first.'); return; }
    setPendingAction(type);
    setPhoto(null);
    setPhotoFile(null);
  };

  const uploadAttendancePhoto = async (type) => {
    if (!photoFile || !accessToken) return null;
    const now = new Date();
    const fileName = `${userName}_${type}_${formatDate(now).replace(/\//g,'-')}_${formatTime(now).replace(/:/g,'-')}.jpg`;
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name: fileName, parents: [ATTENDANCE_FOLDER_ID], mimeType: 'image/jpeg' })], { type: 'application/json' }));
    form.append('file', photoFile);
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form });
    if (!res.ok) return null;
    const data = await res.json();
    return data.webViewLink || '';
  };

  const confirmAction = async () => {
    if (!photoFile) { setError('Please take a photo first.'); return; }
    setLoading(true); setError('');
    const now = new Date();
    const today = formatDate(now);
    const timeNow = formatTime(now);
    try {
      const photoUrl = await uploadAttendancePhoto(pendingAction);

      if (pendingAction === 'IN') {
        // Append new row: Date | Name | TimeIn | PhotoIn | TimeOut | PhotoOut
        const values = [[today, userName, timeNow, photoUrl || '', '', '']];
        const res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${userName}!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
          { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values }) }
        );
        const data = await res.json();
        // Store updated row index for Time Out
        const range = data.updates?.updatedRange || '';
        const rowMatch = range.match(/(\d+)$/);
        if (rowMatch) setTodayRecord({ timeIn: timeNow, timeOut: null, rowIndex: parseInt(rowMatch[1]) });
        setSuccess(`✅ ${userName} clocked IN at ${timeNow}`);
      } else {
        // Update existing row's TimeOut column (E and F)
        if (todayRecord.rowIndex) {
          await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${userName}!E${todayRecord.rowIndex}:F${todayRecord.rowIndex}?valueInputOption=USER_ENTERED`,
            { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [[timeNow, photoUrl || '']] }) }
          );
        }
        setTodayRecord(prev => ({ ...prev, timeOut: timeNow }));
        setSuccess(`✅ ${userName} clocked OUT at ${timeNow}`);
      }
      setPendingAction(null); setPhoto(null); setPhotoFile(null);
      setTimeout(() => setSuccess(''), 4000);
    } catch (e) { setError('Failed to save. Please try again.'); }
    setLoading(false);
  };

  // Only show if user has a name (Kelly or Maryz)
  if (!userName) return (
    <div style={s.page}>
      <div style={s.title}>Attendance</div>
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--brown-light)' }}>Loading your profile...</div>
    </div>
  );

  const canClockIn = !todayRecord.timeIn;
  const canClockOut = !!todayRecord.timeIn && !todayRecord.timeOut;

  return (
    <div style={s.page}>
      <div style={s.title}>Attendance</div>
      <div style={s.sub}>Hello, {userName} 👋</div>

      {!accessToken
        ? <button style={s.connectBtn} onClick={() => tokenClientRef.current?.requestAccessToken()}>🔗 Connect Google Sheets</button>
        : <div style={s.connectedBadge}>✅ Google Sheets connected</div>
      }

      {error && <div style={{ background: 'var(--red-bg)', color: 'var(--red-crit)', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}
      {success && <div style={{ background: 'var(--green-bg)', color: 'var(--green-ok)', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>{success}</div>}

      <div style={s.card}>
        <div style={s.staffName}>{userName}</div>
        <div style={s.statusText}>
          {todayRecord.timeIn ? `⏰ Clocked in at ${todayRecord.timeIn}` : 'Not clocked in today'}
          {todayRecord.timeOut ? ` · Out at ${todayRecord.timeOut}` : ''}
        </div>

        {canClockIn
          ? <button style={s.inBtn} onClick={() => startAction('IN')}>🟢 Clock In</button>
          : <button style={{ ...s.disabledBtn, background: 'var(--green-bg)', color: 'var(--green-ok)', opacity: 0.5 }} disabled>✅ Clocked In</button>
        }
        {canClockOut
          ? <button style={s.outBtn} onClick={() => startAction('OUT')}>🔴 Clock Out</button>
          : <button style={{ ...s.disabledBtn, marginBottom: 0 }} disabled>{todayRecord.timeOut ? '✅ Clocked Out' : '🔒 Clock Out'}</button>
        }
      </div>

      {/* Photo modal */}
      {pendingAction && (
        <div style={s.modal}>
          <div style={s.modalCard}>
            <div style={s.modalTitle}>📷 Take a photo to Clock {pendingAction}</div>
            {photo
              ? <img src={photo} alt="selfie" style={s.previewImg} />
              : <div style={s.cameraBox} onClick={() => fileRef.current.click()}>
                  <div style={{ fontSize: 40, marginBottom: 6 }}>📷</div>
                  <div style={{ fontSize: 13, color: 'var(--brown-mid)' }}>Tap to take selfie</div>
                </div>
            }
            <input ref={fileRef} type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={handleFileChange} />
            {photo && (
              <>
                <button style={{ ...s.confirmBtn, background: pendingAction === 'IN' ? 'var(--green-ok)' : 'var(--red-crit)' }} onClick={confirmAction} disabled={loading}>
                  {loading ? 'Saving...' : `Confirm Clock ${pendingAction}`}
                </button>
                <button style={{ background: 'none', border: 'none', color: 'var(--brown-light)', fontSize: 12, cursor: 'pointer', width: '100%', marginTop: 8, textAlign: 'center' }} onClick={() => { setPhoto(null); setPhotoFile(null); }}>Retake photo</button>
              </>
            )}
            <button style={s.cancelBtn} onClick={() => { setPendingAction(null); setPhoto(null); setPhotoFile(null); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
