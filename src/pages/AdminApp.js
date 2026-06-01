import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase/config';
import { signOut } from 'firebase/auth';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
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
  const [checks, setChecks] = useState({});
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const toggle = (id) => setChecks(prev => ({ ...prev, [id]: !prev[id] }));

  const handlePhotos = (e) => {
    const files = Array.from(e.target.files);
    const previews = files.map(f => ({ file: f, url: URL.createObjectURL(f), name: f.name }));
    setPhotos(prev => [...prev, ...previews]);
  };

  const removePhoto = (idx) => setPhotos(prev => prev.filter((_, i) => i !== idx));

  const uploadToGoogleDrive = async (file) => {
    const token = await new Promise((resolve, reject) => {
      const client = window.google?.accounts?.oauth2?.initTokenClient({
        client_id: '596322682185-n5hm66hvol3nnqqllnuop995kcnefbgu.apps.googleusercontent.com',
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (res) => res.error ? reject(res.error) : resolve(res.access_token),
      });
      client?.requestAccessToken();
    });

    const metadata = {
      name: `cleanliness_${Date.now()}_${file.name}`,
      parents: [CLEANLINESS_FOLDER],
    };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await res.json();
    return `https://drive.google.com/file/d/${data.id}/view`;
  };

  const handleSubmit = async () => {
    const checked = CHECKLIST_ITEMS.filter(i => checks[i.id]);
    if (checked.length === 0) { setError('Please check at least one item.'); return; }
    setUploading(true); setError('');
    try {
      let photoUrls = [];
      for (const p of photos) {
        try {
          const url = await uploadToGoogleDrive(p.file);
          photoUrls.push(url);
        } catch {
          photoUrls.push('(upload failed)');
        }
      }
      await addDoc(collection(db, 'cleanlinessChecks'), {
        staff: userName,
        checkedItems: checked.map(i => i.label),
        uncheckedItems: CHECKLIST_ITEMS.filter(i => !checks[i.id]).map(i => i.label),
        notes,
        photoUrls,
        submittedAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (e) {
      setError('Failed to submit. Please try again.');
    }
    setUploading(false);
  };

  if (submitted) {
    return (
      <div style={{ padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#2a6000', marginBottom: 6 }}>Submitted!</div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>Cleanliness check saved.</div>
        <button onClick={() => { setSubmitted(false); setChecks({}); setNotes(''); setPhotos([]); }}
          style={{ background: '#c8943a', border: 'none', borderRadius: 10, padding: '10px 28px', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          New Check
        </button>
      </div>
    );
  }

  const doneCount = Object.values(checks).filter(Boolean).length;

  return (
    <div style={{ padding: '16px 16px 32px' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#2a1000', marginBottom: 4 }}>Cleanliness Check</div>
      <div style={{ fontSize: 12, color: '#a07850', marginBottom: 16 }}>{new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>

      {/* Progress */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 5 }}>
          <span>{doneCount} of {CHECKLIST_ITEMS.length} checked</span>
          <span style={{ color: doneCount === CHECKLIST_ITEMS.length ? '#2a6000' : '#888' }}>{Math.round(doneCount / CHECKLIST_ITEMS.length * 100)}%</span>
        </div>
        <div style={{ height: 6, background: '#f0e8d8', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${doneCount / CHECKLIST_ITEMS.length * 100}%`, background: '#c8943a', borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Checklist */}
      <div style={{ marginBottom: 18 }}>
        {CHECKLIST_ITEMS.map(item => (
          <div key={item.id} onClick={() => toggle(item.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: checks[item.id] ? '#f0fce8' : '#fff', border: `1px solid ${checks[item.id] ? '#8bc34a' : '#e8dfd0'}`, borderRadius: 10, marginBottom: 8, cursor: 'pointer', transition: 'all 0.15s' }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${checks[item.id] ? '#8bc34a' : '#c8943a'}`, background: checks[item.id] ? '#8bc34a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
              {checks[item.id] && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
            <span style={{ fontSize: 14, color: checks[item.id] ? '#2a6000' : '#2a1000', fontWeight: checks[item.id] ? 600 : 400 }}>{item.label}</span>
            {checks[item.id] && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8bc34a', fontWeight: 600 }}>Clean</span>}
          </div>
        ))}
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#2a1000', marginBottom: 6 }}>Notes (optional)</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any concerns or remarks..."
          style={{ width: '100%', minHeight: 72, border: '1px solid #e8dfd0', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#2a1000', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' }} />
      </div>

      {/* Photos */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#2a1000', marginBottom: 8 }}>Photos</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {photos.map((p, i) => (
            <div key={i} style={{ position: 'relative', width: 80, height: 80, borderRadius: 10, overflow: 'hidden', border: '1px solid #e8dfd0' }}>
              <img src={p.url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button onClick={() => removePhoto(i)}
                style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                x
              </button>
            </div>
          ))}
          <div onClick={() => fileRef.current?.click()}
            style={{ width: 80, height: 80, border: '1.5px dashed #c8943a', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#fffaf4', gap: 4 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c8943a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span style={{ fontSize: 9, color: '#c8943a', fontWeight: 600 }}>Add Photo</span>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handlePhotos} style={{ display: 'none' }} />
        <div style={{ fontSize: 11, color: '#a07850' }}>Photos will be saved to Google Drive.</div>
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
