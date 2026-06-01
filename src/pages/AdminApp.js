import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase/config';
import { signOut } from 'firebase/auth';
import { doc, getDoc, collection, addDoc, serverTimestamp, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import Attendance from './Attendance';
import Orders from './Orders';
import Inventory from './Inventory';
import Reports from './Reports';
import MenuManager from './MenuManager';
import Approvals from './Approvals';
import FeedbackPanel from './FeedbackPanel';

// ─── CLEANLINESS CHECK ───────────────────────────────────────────────────────
const CHECKLIST_ITEMS = [
  { id: 'tables',   label: 'Tables & Chairs' },
  { id: 'counter',  label: 'Counter Area' },
  { id: 'kitchen',  label: 'Kitchen / Bar' },
  { id: 'cr',       label: 'Comfort Room' },
  { id: 'floor',    label: 'Floor' },
  { id: 'windows',  label: 'Windows & Glass' },
  { id: 'trash',    label: 'Trash Bins' },
  { id: 'entrance', label: 'Entrance / Exit' },
];

const CLEANLINESS_FOLDER = '1U3nFpZ14aeprxCmFtNshpYFUUemQioM5';

function CleanlinessCheck({ userName }) {
  const [checks, setChecks] = React.useState({});
  const [photos, setPhotos] = React.useState({}); // { itemId: { file, url } }
  const [notes, setNotes] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState('');
  const fileRefs = React.useRef({});
  const now = new Date();

  const toggle = (id) => setChecks(prev => ({ ...prev, [id]: !prev[id] }));

  const handlePhotoCapture = (itemId, e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotos(prev => ({ ...prev, [itemId]: { file, url: URL.createObjectURL(file) } }));
  };

  const removePhoto = (itemId) => {
    setPhotos(prev => { const n = {...prev}; delete n[itemId]; return n; });
  };

  const uploadToGoogleDrive = async (file, itemLabel) => {
    const token = await new Promise((resolve, reject) => {
      const client = window.google?.accounts?.oauth2?.initTokenClient({
        client_id: '596322682185-n5hm66hvol3nnqqllnuop995kcnefbgu.apps.googleusercontent.com',
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (res) => res.error ? reject(res.error) : resolve(res.access_token),
      });
      client?.requestAccessToken();
    });
    const dateStr = now.toISOString().split('T')[0];
    const metadata = {
      name: `clean_${dateStr}_${userName}_${itemLabel.replace(/\s/g,'_')}_${Date.now()}.jpg`,
      parents: [CLEANLINESS_FOLDER],
    };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
    });
    const data = await res.json();
    return `https://drive.google.com/file/d/${data.id}/view`;
  };

  const handleSubmit = async () => {
    const checked = CHECKLIST_ITEMS.filter(i => checks[i.id]);
    if (checked.length === 0) { setError('Please check at least one item.'); return; }
    setUploading(true); setError('');
    try {
      const photoUrls = {};
      for (const item of CHECKLIST_ITEMS) {
        if (photos[item.id]) {
          try {
            const url = await uploadToGoogleDrive(photos[item.id].file, item.label);
            photoUrls[item.id] = url;
          } catch { photoUrls[item.id] = '(upload failed)'; }
        }
      }
      const dateTimeStr = now.toLocaleDateString('en-PH', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
        + ' ' + now.toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' });

      await addDoc(collection(db, 'cleanlinessChecks'), {
        staff: userName,
        dateTime: dateTimeStr,
        date: now.toDateString(),
        checkedItems: checked.map(i => i.label),
        uncheckedItems: CHECKLIST_ITEMS.filter(i => !checks[i.id]).map(i => i.label),
        photoUrls,
        notes,
        submittedAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (e) {
      setError('Failed to submit. Please try again.');
    }
    setUploading(false);
  };

  const formatDate = now.toLocaleDateString('en-PH', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const formatTime = now.toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' });
  const doneCount = Object.values(checks).filter(Boolean).length;

  if (submitted) {
    return (
      <div style={{ padding: 28, textAlign: 'center' }}>
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#8bc34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#2a6000', marginBottom: 6 }}>Submitted!</div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>Cleanliness check saved.</div>
        <div style={{ fontSize: 12, color: '#a07850', marginBottom: 24 }}>{formatDate} · {formatTime} · {userName}</div>
        <button onClick={() => { setSubmitted(false); setChecks({}); setNotes(''); setPhotos({}); }}
          style={{ background: '#c8943a', border: 'none', borderRadius: 10, padding: '10px 28px', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          New Check
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 16px 32px' }}>
      {/* Header */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#2a1000' }}>Cleanliness Check</div>
        <div style={{ fontSize: 13, color: '#c8943a', marginTop: 2 }}>
          Welcome, <b>{userName}</b>! Let's check the cafe.
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#a07850', marginBottom: 12 }}>
        {formatDate} · {formatTime} · {userName}
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 5 }}>
        <span>{doneCount} of {CHECKLIST_ITEMS.length} checked</span>
        <span style={{ color: '#c8943a', fontWeight: 600 }}>{Math.round(doneCount / CHECKLIST_ITEMS.length * 100)}%</span>
      </div>
      <div style={{ height: 6, background: '#f0e8d8', borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ height: '100%', width: `${doneCount / CHECKLIST_ITEMS.length * 100}%`, background: '#c8943a', borderRadius: 3, transition: 'width 0.3s' }} />
      </div>

      {/* Checklist with per-item photos */}
      <div style={{ marginBottom: 18 }}>
        {CHECKLIST_ITEMS.map(item => {
          const isChecked = checks[item.id];
          const hasPhoto = photos[item.id];
          return (
            <div key={item.id}
              style={{ background: isChecked ? '#f0fce8' : '#fff', border: `1px solid ${isChecked ? '#8bc34a' : '#f0e8d8'}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8, transition: 'all 0.15s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Checkbox */}
                <div onClick={() => toggle(item.id)}
                  style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${isChecked ? '#8bc34a' : '#c8943a'}`, background: isChecked ? '#8bc34a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', transition: 'all 0.15s' }}>
                  {isChecked && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>

                {/* Label */}
                <span onClick={() => toggle(item.id)} style={{ fontSize: 14, color: isChecked ? '#2a6000' : '#2a1000', fontWeight: isChecked ? 600 : 400, flex: 1, cursor: 'pointer' }}>
                  {item.label}
                </span>

                {/* Camera — only active when checked */}
                {isChecked ? (
                  hasPhoto ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <img src={hasPhoto.url} alt={item.label}
                        style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', border: '1px solid #8bc34a' }} />
                      <button onClick={() => fileRefs.current[item.id]?.click()}
                        style={{ background: '#e8f5e9', border: '1px solid #8bc34a', borderRadius: 8, padding: '5px 9px', cursor: 'pointer', fontSize: 11, color: '#2d6a4f', fontWeight: 600 }}>
                        Retake
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => fileRefs.current[item.id]?.click()}
                      style={{ background: '#fff8f0', border: '1.5px dashed #c8943a', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 11, color: '#c8943a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c8943a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      Add Photo
                    </button>
                  )
                ) : (
                  <div style={{ width: 38, height: 38, borderRadius: 8, background: '#f5f0ea', border: '1px solid #e8dfd0', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a07850" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  </div>
                )}

                {/* Hidden file input per item */}
                <input ref={el => fileRefs.current[item.id] = el} type="file" accept="image/*" capture="environment"
                  onChange={e => handlePhotoCapture(item.id, e)} style={{ display: 'none' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#2a1000', marginBottom: 6 }}>Notes (optional)</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any concerns or remarks..."
          style={{ width: '100%', minHeight: 72, border: '1px solid #e8dfd0', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#2a1000', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' }} />
      </div>

      {/* Submit info */}
      <div style={{ background: '#fff8f0', border: '1px solid #f0e8d8', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#a07850' }}>
        Will be saved as: <b style={{ color: '#2a1000' }}>{formatDate} · {formatTime} · {userName}</b>
      </div>

      {error && <div style={{ color: '#cc3333', fontSize: 13, marginBottom: 10 }}>{error}</div>}

      <button onClick={handleSubmit} disabled={uploading}
        style={{ width: '100%', background: uploading ? '#ccc' : '#c8943a', border: 'none', borderRadius: 12, padding: '13px', color: '#fff', fontWeight: 700, fontSize: 15, cursor: uploading ? 'not-allowed' : 'pointer' }}>
        {uploading ? 'Submitting...' : 'Submit Check'}
      </button>
    </div>
  );
}

// ─── MAIN ADMIN APP ──────────────────────────────────────────────────────────
export default function AdminApp({ user, onSignOut }) {
  const [activeTab, setActiveTab] = useState(null);
  const [role, setRole] = useState('staff');
  const [userName, setUserName] = useState('');
  const [time, setTime] = useState(new Date());
  const [pendingPhotos, setPendingPhotos] = useState(0);
  const [cleanlinessAlert, setCleanlinessAlert] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) { setRole(snap.data().role || 'staff'); setUserName(snap.data().name || ''); }
      } catch { setRole('staff'); }
    };
    fetchUser();
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Notifications: pending photos + cleanliness check
  useEffect(() => {
    // Watch pending photo approvals
    const unsubPhotos = onSnapshot(
      query(collection(db, 'guestPhotos'), where('public', '==', true)),
      snap => {
        const docs = snap.docs.map(d => d.data());
        setPendingPhotos(docs.filter(d => d.approved === undefined || d.approved === null).length);
      }
    );

    // Check if cleanliness submitted today (only alert after 3PM)
    const checkCleanliness = async () => {
      const now = new Date();
      if (now.getHours() >= 15) {
        const today = now.toDateString();
        const snap = await getDocs(query(collection(db, 'cleanlinessChecks'), where('date', '==', today)));
        setCleanlinessAlert(snap.empty);
      } else {
        setCleanlinessAlert(false);
      }
    };
    checkCleanliness();
    const cleanTimer = setInterval(checkCleanliness, 60000); // check every minute

    return () => { unsubPhotos(); clearInterval(cleanTimer); };
  }, []);

  const handleSignOut = async () => { await signOut(auth); onSignOut(); };

  const formatTime = (d) => {
    const h = d.getHours() % 12 || 12;
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
    return `${h}:${m} ${ampm}`;
  };

  const formatDate = (d) => d.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const S = {
    container: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#1a0e00', maxWidth: 480, margin: '0 auto' },
    topbar: { padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: '#2a1800', borderBottom: '1px solid #3d2200' },
    content: { flex: 1, overflowY: 'auto', background: 'rgba(253,246,238,0.97)', borderRadius: activeTab ? '0' : '16px 16px 0 0', marginTop: activeTab ? 0 : 4 },
  };

  // Dashboard cards config
  const mainPanels = [
    { id: 'attendance', label: 'Clock In',   desc: 'Staff attendance', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8943a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    { id: 'orders',     label: 'Orders',     desc: 'Take & manage',    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8943a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
    { id: 'inventory',  label: 'Stocks',     desc: 'Inventory',        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8943a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> },
    { id: 'reports',    label: 'Reports',    desc: 'Sales & analytics', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8943a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  ];

  const morePanels = [
    { id: 'cleanliness', label: 'Cleanliness', desc: 'Daily check', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c8943a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
    { id: 'feedback', label: 'Feedback', desc: 'Customer reviews', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c8943a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
    ...(role === 'manager' ? [{ id: 'menu', label: 'Menu', desc: 'Edit items', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c8943a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> }] : []),
    { id: 'approvals', label: 'Approvals', desc: 'Guest photos', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c8943a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
  ];

  return (
    <div style={S.container}>
      {/* Top bar */}
      <div style={S.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.jpg" alt="logo" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #c8943a' }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f5e6d0' }}>Theonyx Cafe</div>
            <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 10, background: '#c8943a22', color: '#c8943a', border: '1px solid #c8943a44' }}>
              {role === 'manager' ? 'Manager' : userName}
            </span>
          </div>
        </div>
        <button onClick={handleSignOut}
          style={{ background: '#2a1800', border: '1px solid #3d2200', borderRadius: 8, color: '#a07850', padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>
          Exit
        </button>
      </div>

      <div style={S.content}>
        {!activeTab ? (
          // ── DASHBOARD ──
          <div style={{ paddingBottom: 32 }}>
            {/* Date & time row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: '#fff8f0', borderBottom: '1px solid #f0e8d8' }}>
              <div style={{ fontSize: 13, color: '#a07850' }}>
                Good day, <span style={{ color: '#2a1000', fontWeight: 600 }}>{userName || (role === 'manager' ? 'Manager' : 'Staff')}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#c8943a' }}>{formatTime(time)}</div>
                <div style={{ fontSize: 10, color: '#a07850' }}>{formatDate(time)}</div>
              </div>
            </div>

            {/* Notification alerts */}
            {(cleanlinessAlert || pendingPhotos > 0) && (
              <div style={{ padding: '12px 16px 0' }}>
                {cleanlinessAlert && (
                  <div onClick={() => setActiveTab('cleanliness')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: 10, padding: '10px 14px', marginBottom: 8, cursor: 'pointer' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff9800', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#e65100' }}>Cleanliness Check Pending</div>
                      <div style={{ fontSize: 11, color: '#bf360c' }}>No cleanliness check submitted today. Tap to complete.</div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e65100" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                )}
                {pendingPhotos > 0 && (
                  <div onClick={() => setActiveTab('approvals')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#e8f4fd', border: '1px solid #64b5f6', borderRadius: 10, padding: '10px 14px', marginBottom: 8, cursor: 'pointer' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2196f3', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0d47a1' }}>Photos Pending Approval</div>
                      <div style={{ fontSize: 11, color: '#1565c0' }}>{pendingPhotos} guest photo{pendingPhotos > 1 ? 's' : ''} waiting for review. Tap to approve.</div>
                    </div>
                    <div style={{ background: '#2196f3', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{pendingPhotos}</div>
                  </div>
                )}
              </div>
            )}

            {/* Main panels */}
            <div style={{ padding: '16px 16px 8px' }}>
              <div style={{ fontSize: 10, color: '#a07850', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Panels</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {mainPanels.map(p => (
                  <div key={p.id} onClick={() => setActiveTab(p.id)}
                    style={{ background: '#fff', border: '1px solid #f0e8d8', borderRadius: 14, padding: '16px 14px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                    onMouseOver={e => e.currentTarget.style.borderColor = '#c8943a'}
                    onMouseOut={e => e.currentTarget.style.borderColor = '#f0e8d8'}>
                    <div style={{ width: 36, height: 36, background: '#fff8f0', border: '1px solid #f0e8d8', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                      {p.icon}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#2a1000' }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: '#a07850', marginTop: 2 }}>{p.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* More panels */}
            <div style={{ padding: '4px 16px 8px' }}>
              <div style={{ fontSize: 10, color: '#a07850', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>More</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {morePanels.map(p => (
                  <div key={p.id} onClick={() => setActiveTab(p.id)}
                    style={{ background: '#fff8f0', border: '1px solid #f0e8d8', borderRadius: 10, padding: '11px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'border-color 0.15s' }}
                    onMouseOver={e => e.currentTarget.style.borderColor = '#c8943a'}
                    onMouseOut={e => e.currentTarget.style.borderColor = '#f0e8d8'}>
                    <div style={{ width: 30, height: 30, background: '#fff', border: '1px solid #f0e8d8', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {p.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#2a1000' }}>{p.label}</div>
                      <div style={{ fontSize: 10, color: '#a07850' }}>{p.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Logout */}
            <div style={{ padding: '8px 16px' }}>
              <button onClick={handleSignOut}
                style={{ width: '100%', background: 'transparent', border: '1px solid #f0e8d8', borderRadius: 10, color: '#a07850', padding: 12, fontSize: 13, cursor: 'pointer' }}>
                Log out
              </button>
            </div>
          </div>
        ) : (
          // ── ACTIVE PANEL ──
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Back bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fff8f0', borderBottom: '1px solid #f0e8d8', flexShrink: 0 }}>
              <button onClick={() => setActiveTab(null)}
                style={{ background: 'transparent', border: '1px solid #f0e8d8', borderRadius: 8, color: '#c8943a', padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                Back
              </button>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#2a1000' }}>
                {[...mainPanels, ...morePanels].find(p => p.id === activeTab)?.label}
              </span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {activeTab === 'attendance'  && <Attendance role={role} userName={userName} />}
              {activeTab === 'orders'      && <Orders userName={userName} />}
              {activeTab === 'inventory'   && <Inventory />}
              {activeTab === 'approvals'   && <Approvals role={role} />}
              {activeTab === 'reports'     && <Reports />}
              {activeTab === 'menu'        && role === 'manager' && <MenuManager />}
              {activeTab === 'cleanliness' && <CleanlinessCheck userName={userName} />}
              {activeTab === 'feedback'    && <FeedbackPanel role={role} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
