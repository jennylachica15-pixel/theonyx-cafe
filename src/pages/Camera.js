import React, { useState, useRef, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp, onSnapshot, query, where, orderBy } from 'firebase/firestore';

const GOOGLE_CLIENT_ID = '596322682185-n5hm66hvol3nnqqllnuop995kcnefbgu.apps.googleusercontent.com';
const STAFF_FOLDER_ID = '1aEtFqN84f0jDG9SYb_hZhf2W-3TNDdkS';
const GUEST_FOLDER_ID = '1hOrGU9k3HKBWdaOenygW-4ORVXu6gYeM';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

const STAFF_TAGS = ['Delivery', 'Stock Check', 'Equipment', 'Damaged Goods'];

const s = {
  page: { padding: '16px 16px 0', animation: 'fadeIn 0.3s ease' },
  title: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 4 },
  sub: { fontSize: 13, color: 'var(--brown-light)', marginBottom: 16 },
  tabRow: { display: 'flex', background: 'white', borderRadius: 12, padding: 4, marginBottom: 16, boxShadow: '0 1px 4px rgba(26,10,0,0.06)' },
  tab: (active) => ({ flex: 1, padding: '9px', borderRadius: 9, fontSize: 13, fontWeight: active ? 700 : 400, background: active ? 'var(--brown-dark)' : 'transparent', color: active ? 'var(--gold-light)' : 'var(--brown-light)', border: 'none', cursor: 'pointer' }),
  uploadBox: { background: 'white', borderRadius: 16, padding: 24, textAlign: 'center', border: '2px dashed #e8d8c8', marginBottom: 14, cursor: 'pointer' },
  previewImg: { width: '100%', borderRadius: 12, maxHeight: 220, objectFit: 'cover', marginBottom: 14 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--brown-mid)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e8d8c8', fontSize: 14, background: 'var(--cream)', color: 'var(--brown-dark)', marginBottom: 14, outline: 'none', boxSizing: 'border-box' },
  uploadBtn: { width: '100%', padding: '13px', borderRadius: 12, background: '#1a73e8', color: 'white', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10, border: 'none', cursor: 'pointer' },
  connectBtn: { width: '100%', padding: '13px', borderRadius: 12, background: '#1a73e8', color: 'white', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14, border: 'none', cursor: 'pointer' },
  connectedBadge: { background: 'var(--green-bg)', color: 'var(--green-ok)', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 500, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 },
  albumGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingBottom: 16 },
  albumCell: { background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(26,10,0,0.07)', cursor: 'pointer' },
  albumTag: { display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 10, background: 'var(--orange-bg)', color: 'var(--orange-warn)', fontWeight: 600, marginBottom: 2 },
  consentModal: { position: 'fixed', inset: 0, background: 'rgba(26,10,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  consentCard: { background: 'var(--cream)', borderRadius: '20px 20px 0 0', padding: '28px 24px 40px', width: '100%', maxWidth: 480, animation: 'slideUp 0.3s ease' },
  agreeBtn: { width: '100%', padding: '13px', borderRadius: 12, background: 'var(--brown-dark)', color: 'var(--gold-light)', fontSize: 14, fontWeight: 600, marginBottom: 8, border: 'none', cursor: 'pointer' },
  declineBtn: { width: '100%', padding: '12px', borderRadius: 12, background: 'var(--cream)', color: 'var(--brown-mid)', fontSize: 14, border: '1.5px solid #e8d8c8', cursor: 'pointer', marginBottom: 8 },
  progressBar: { height: 6, borderRadius: 3, background: '#e8d8c8', marginBottom: 14, overflow: 'hidden' },
  sectionTitle: { fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 10 },
};

const addWatermark = (file) => new Promise((resolve) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const base = Math.max(img.width * 0.022, 18);
    const small = Math.max(img.width * 0.018, 14);
    const pad = img.width * 0.025;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    const y = img.height - pad - small;
    ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.font = `${small}px "Times New Roman", serif`; ctx.fillStyle = 'rgba(255,255,255,0.80)';
    ctx.fillText(`${dateStr} · ${timeStr}`, img.width - pad, y);
    ctx.font = `bold ${base}px "Times New Roman", serif`; ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText('THEONYX CAFE', img.width - pad, y - base * 1.3);
    URL.revokeObjectURL(url);
    canvas.toBlob(blob => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.92);
  };
  img.src = url;
});

const makeThumb = (file) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = 200; c.height = 200;
    const ctx = c.getContext('2d');
    const size = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width-size)/2, (img.height-size)/2, size, size, 0, 0, 200, 200);
    resolve(c.toDataURL('image/jpeg', 0.6));
  };
  img.src = URL.createObjectURL(file);
});

export default function Camera({ userRole }) {
  const [activeTab, setActiveTab] = useState('staff');
  const [photo, setPhoto] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [tag, setTag] = useState('Delivery');
  const [note, setNote] = useState('');
  const [feedback, setFeedback] = useState('');
  const [staffLogs, setStaffLogs] = useState([]);
  const [guestLogs, setGuestLogs] = useState([]);
  const [accessToken, setAccessToken] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState('');
  const [showConsent, setShowConsent] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const fileRef = useRef();
  const tokenClientRef = useRef(null);

  useEffect(() => {
    // Staff logs — hidden from public
    const q1 = query(collection(db, 'photoLogs'), orderBy('createdAt', 'desc'));
    const unsub1 = onSnapshot(q1, snap => setStaffLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    // Guest logs — public only
    const q2 = query(collection(db, 'guestPhotos'), where('public', '==', true), orderBy('createdAt', 'desc'));
    const unsub2 = onSnapshot(q2, snap => setGuestLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsub1(); unsub2(); };
  }, []);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
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

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = ev => { setPhoto(ev.target.result); if (activeTab === 'guest') setShowConsent(true); };
    reader.readAsDataURL(file);
  };

  const uploadFile = async (file, folderId, fileName) => {
    const wm = await addWatermark(file);
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name: fileName, parents: [folderId], mimeType: 'image/jpeg' })], { type: 'application/json' }));
    form.append('file', wm);
    setProgress(60);
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    setProgress(90);
    const thumb = await makeThumb(wm);
    return { fileId: data.id, thumb };
  };

  const uploadStaff = async () => {
    if (!photoFile || !accessToken) return;
    setUploading(true); setProgress(10);
    const date = new Date().toISOString().slice(0,10);
    const fileName = `${tag}_${date}_${photoFile.name}`;
    try {
      const { fileId, thumb } = await uploadFile(photoFile, STAFF_FOLDER_ID, fileName);
      await addDoc(collection(db, 'photoLogs'), { fileName, tag, note, thumb, driveFileId: fileId, createdAt: serverTimestamp(), driveUploaded: true });
      setSuccess('✅ Photo saved!'); setPhoto(null); setPhotoFile(null); setNote('');
      setProgress(100); setTimeout(() => { setSuccess(''); setProgress(0); }, 3000);
    } catch (e) { console.error(e); }
    setUploading(false);
  };

  const uploadGuest = async (isPublic) => {
    if (!photoFile || !accessToken) return;
    setUploading(true); setShowConsent(false); setProgress(10);
    const date = new Date().toISOString().slice(0,10);
    const fileName = `Guest_${date}_${photoFile.name}`;
    try {
      const { fileId, thumb } = await uploadFile(photoFile, GUEST_FOLDER_ID, fileName);
      await addDoc(collection(db, 'guestPhotos'), { fileName, feedback, thumb, driveFileId: fileId, public: isPublic, createdAt: serverTimestamp() });
      setSuccess(isPublic ? '✅ Photo published to gallery!' : '✅ Photo saved privately.');
      setPhoto(null); setPhotoFile(null); setFeedback('');
      setProgress(100); setTimeout(() => { setSuccess(''); setProgress(0); }, 3000);
    } catch (e) { console.error(e); }
    setUploading(false);
  };

  return (
    <div style={s.page}>
      <div style={s.title}>Photos</div>
      <div style={s.sub}>Staff photos & guest gallery</div>

      {/* Tab selector — staff tab only for staff/manager */}
      <div style={s.tabRow}>
        {(userRole === 'staff' || userRole === 'manager') && (
          <button style={s.tab(activeTab === 'staff')} onClick={() => setActiveTab('staff')}>📦 Staff</button>
        )}
        <button style={s.tab(activeTab === 'guest')} onClick={() => setActiveTab('guest')}>🌐 Guest Gallery</button>
      </div>

      {!accessToken
        ? <button style={s.connectBtn} onClick={() => tokenClientRef.current?.requestAccessToken()}>🔗 Connect Google Drive</button>
        : <div style={s.connectedBadge}>✅ Drive connected</div>
      }

      {success && <div style={{ background: 'var(--green-bg)', color: 'var(--green-ok)', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>{success}</div>}

      {/* STAFF TAB */}
      {activeTab === 'staff' && (
        <>
          <div style={s.uploadBox} onClick={() => fileRef.current.click()}>
            {photo ? <img src={photo} alt="preview" style={s.previewImg} /> : <>
              <div style={{ fontSize: 42, marginBottom: 8 }}>📷</div>
              <div style={{ fontSize: 14, color: 'var(--brown-mid)', fontWeight: 500 }}>Tap to take or choose a photo</div>
            </>}
          </div>
          {photo && (
            <>
              <label style={s.label}>Tag</label>
              <select style={s.input} value={tag} onChange={e => setTag(e.target.value)}>
                {STAFF_TAGS.map(t => <option key={t}>{t}</option>)}
              </select>
              <label style={s.label}>Note (optional)</label>
              <input style={s.input} placeholder="e.g. Arabica delivery" value={note} onChange={e => setNote(e.target.value)} />
              {progress > 0 && progress < 100 && <div style={s.progressBar}><div style={{ height: '100%', borderRadius: 3, background: '#1a73e8', width: `${progress}%`, transition: 'width 0.3s' }} /></div>}
              <button style={{ ...s.uploadBtn, opacity: (!accessToken || uploading) ? 0.6 : 1 }} onClick={uploadStaff} disabled={!accessToken || uploading}>
                {uploading ? `Uploading... ${progress}%` : '📤 Upload to Drive'}
              </button>
            </>
          )}
          {/* Staff photo log — hidden tags, grid view */}
          <div style={s.sectionTitle}>Photo Log</div>
          {staffLogs.length === 0 && <div style={{ textAlign: 'center', color: 'var(--brown-light)', padding: '20px 0', fontSize: 13 }}>No photos yet.</div>}
          <div style={s.albumGrid}>
            {staffLogs.map(log => (
              <div key={log.id} style={s.albumCell} onClick={() => setSelectedPhoto(selectedPhoto?.id === log.id ? null : log)}>
                <div style={{ aspectRatio: '1', overflow: 'hidden', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {log.thumb ? <img src={log.thumb} alt={log.tag} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 24 }}>📷</span>}
                </div>
                <div style={{ padding: '6px 8px' }}>
                  <span style={s.albumTag}>{log.tag}</span>
                  <div style={{ fontSize: 10, color: 'var(--brown-light)' }}>{log.createdAt?.toDate ? log.createdAt.toDate().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : 'Just now'}</div>
                  {log.note && <div style={{ fontSize: 10, color: 'var(--brown-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.note}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* GUEST TAB */}
      {activeTab === 'guest' && (
        <>
          <div style={s.uploadBox} onClick={() => fileRef.current.click()}>
            {photo && !showConsent ? <img src={photo} alt="preview" style={s.previewImg} /> : <>
              <div style={{ fontSize: 42, marginBottom: 8 }}>📷</div>
              <div style={{ fontSize: 14, color: 'var(--brown-mid)', fontWeight: 500 }}>Tap to take your photo</div>
              <div style={{ fontSize: 12, color: 'var(--brown-light)', marginTop: 4 }}>Camera or gallery</div>
            </>}
          </div>
          {progress > 0 && progress < 100 && <div style={s.progressBar}><div style={{ height: '100%', borderRadius: 3, background: '#1a73e8', width: `${progress}%`, transition: 'width 0.3s' }} /></div>}

          {/* Public gallery */}
          <div style={s.sectionTitle}>Public Gallery</div>
          {guestLogs.length === 0 && <div style={{ textAlign: 'center', color: 'var(--brown-light)', padding: '20px 0', fontSize: 13 }}>No public photos yet.</div>}
          <div style={s.albumGrid}>
            {guestLogs.map(p => (
              <div key={p.id} style={s.albumCell} onClick={() => setSelectedPhoto(selectedPhoto?.id === p.id ? null : p)}>
                <div style={{ aspectRatio: '1', overflow: 'hidden', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {p.thumb ? <img src={p.thumb} alt="guest" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 24 }}>📷</span>}
                </div>
                <div style={{ padding: '6px 8px' }}>
                  <div style={{ fontSize: 10, color: 'var(--brown-light)' }}>{p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : 'Just now'}</div>
                  {p.feedback && <div style={{ fontSize: 10, color: 'var(--brown-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{p.feedback}"</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />

      {/* Consent Modal */}
      {showConsent && photo && (
        <div style={s.consentModal}>
          <div style={s.consentCard}>
            <img src={photo} alt="preview" style={{ width: '100%', borderRadius: 12, maxHeight: 180, objectFit: 'cover', marginBottom: 14 }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 10 }}>📸 Photo Consent</div>
            <div style={{ fontSize: 13, color: 'var(--brown-mid)', lineHeight: 1.6, marginBottom: 14 }}>
              By tapping <strong>"I Agree"</strong>, you allow <strong>THEONYX CAFE</strong> to display your photo in our public gallery and social media. If you decline, your photo will be saved privately.
            </div>
            <label style={s.label}>Feedback (optional)</label>
            <input style={s.input} placeholder="Share your experience..." value={feedback} onChange={e => setFeedback(e.target.value)} />
            <button style={s.agreeBtn} onClick={() => uploadGuest(true)}>✅ I Agree — Publish my photo</button>
            <button style={s.declineBtn} onClick={() => uploadGuest(false)}>🔒 No thanks — Keep it private</button>
            <button style={{ ...s.declineBtn, color: 'var(--red-crit)', borderColor: 'var(--red-bg)', marginBottom: 0 }} onClick={() => { setShowConsent(false); setPhoto(null); setPhotoFile(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Full photo viewer */}
      {selectedPhoto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setSelectedPhoto(null)}>
          <div style={{ maxWidth: 400, width: '100%' }}>
            {selectedPhoto.thumb && <img src={selectedPhoto.thumb} alt="full" style={{ width: '100%', borderRadius: 12 }} />}
            {selectedPhoto.feedback && <div style={{ color: 'white', textAlign: 'center', marginTop: 10, fontSize: 13, fontStyle: 'italic' }}>"{selectedPhoto.feedback}"</div>}
          </div>
        </div>
      )}
      <div style={{ height: 80 }} />
    </div>
  );
}
