import React, { useState, useRef, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp, onSnapshot, query, where, orderBy } from 'firebase/firestore';

const GOOGLE_CLIENT_ID = '596322682185-n5hm66hvol3nnqqllnuop995kcnefbgu.apps.googleusercontent.com';
const GUEST_FOLDER_ID = '1hOrGU9k3HKBWdaOenygW-4ORVXu6gYeM';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

const addWatermark = (file) => new Promise((resolve) => {
  const img = new Image(); const url = URL.createObjectURL(file);
  img.onload = () => {
    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
    const base = Math.max(img.width * 0.022, 18); const small = Math.max(img.width * 0.018, 14);
    const pad = img.width * 0.025; const now = new Date();
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
    const ctx = c.getContext('2d'); const size = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width-size)/2, (img.height-size)/2, size, size, 0, 0, 200, 200);
    resolve(c.toDataURL('image/jpeg', 0.6));
  };
  img.src = URL.createObjectURL(file);
});

const s = {
  page: { padding: '16px 16px 0', minHeight: '100vh', background: 'transparent' },
  title: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 4 },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 16 },
  uploadBox: { background: 'rgba(253,240,228,0.95)', borderRadius: 14, padding: '14px 16px', textAlign: 'center', border: '1.5px dashed rgba(200,149,108,0.5)', marginBottom: 14, cursor: 'pointer' },
  previewImg: { width: '100%', borderRadius: 12, maxHeight: 220, objectFit: 'cover', marginBottom: 14 },
  connectBtn: { padding: '8px 16px', borderRadius: 10, background: '#6b3a1f', color: '#f0d080', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 14, border: '1px solid rgba(212,168,83,0.3)', cursor: 'pointer' },
  connectedBadge: { background: 'rgba(216,243,220,0.9)', color: '#2d6a4f', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 500, marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 6 },
  progressBar: { height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.2)', marginBottom: 14, overflow: 'hidden' },
  albumGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingBottom: 80 },
  albumCell: { background: 'rgba(253,240,228,0.95)', borderRadius: 12, overflow: 'hidden', cursor: 'pointer' },
  consentModal: { position: 'fixed', inset: 0, background: 'rgba(26,10,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  consentCard: { background: '#fdf6ee', borderRadius: '20px 20px 0 0', padding: '28px 24px 40px', width: '100%', maxWidth: 480, animation: 'slideUp 0.3s ease' },
  agreeBtn: { width: '100%', padding: '13px', borderRadius: 12, background: '#1a0a00', color: '#f0d080', fontSize: 14, fontWeight: 600, marginBottom: 8, border: 'none', cursor: 'pointer' },
  declineBtn: { width: '100%', padding: '12px', borderRadius: 12, background: '#fdf6ee', color: '#6b3a1f', fontSize: 14, border: '1.5px solid #e8d8c8', cursor: 'pointer', marginBottom: 8 },
  input: { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e8d8c8', fontSize: 14, background: 'white', color: '#1a0a00', marginBottom: 14, outline: 'none', boxSizing: 'border-box' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#6b3a1f', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 },
  galleryTitle: { fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 10, marginTop: 4 },
};

export default function Gallery() {
  const [photo, setPhoto] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [showConsent, setShowConsent] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [accessToken, setAccessToken] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState('');
  const [selected, setSelected] = useState(null);
  const fileRef = useRef();
  const tokenClientRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'guestPhotos'), where('public', '==', true));
    return onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPhotos(docs);
    });
  }, []);

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

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = ev => { setPhoto(ev.target.result); setShowConsent(true); };
    reader.readAsDataURL(file);
  };

  const uploadPhoto = async (isPublic) => {
    if (!photoFile || !accessToken) { setSuccess('⚠️ Please connect Drive first.'); return; }
    setUploading(true); setShowConsent(false); setProgress(10);
    try {
      const wm = await addWatermark(photoFile); setProgress(30);
      const date = new Date().toISOString().slice(0,10);
      const fileName = `Guest_${date}_${photoFile.name}`;
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify({ name: fileName, parents: [GUEST_FOLDER_ID], mimeType: 'image/jpeg' })], { type: 'application/json' }));
      form.append('file', wm);
      setProgress(60);
      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json(); setProgress(90);
      const thumb = await makeThumb(wm);
      await addDoc(collection(db, 'guestPhotos'), { fileName, driveFileId: data.id, thumb, feedback, public: isPublic, createdAt: serverTimestamp() });
      setSuccess(isPublic ? '✅ Photo published to gallery!' : '✅ Photo saved privately.');
      setPhoto(null); setPhotoFile(null); setFeedback('');
      setProgress(100); setTimeout(() => { setSuccess(''); setProgress(0); }, 3000);
    } catch (e) { setSuccess('⚠️ Upload failed. Try again.'); setProgress(0); }
    setUploading(false);
  };

  return (
    <div style={s.page}>
      <div style={s.title}>Snapshots</div>
      <div style={s.sub}>Share your experience at Theonyx Cafe</div>

      {!accessToken
        ? <button style={s.connectBtn} onClick={() => tokenClientRef.current?.requestAccessToken()}>🔗 Connect to Upload</button>
        : <div style={s.connectedBadge}>✅ Ready to upload</div>
      }

      {success && <div style={{ background: success.includes('⚠️') ? '#ffe0e0' : '#d8f3dc', color: success.includes('⚠️') ? '#c1121f' : '#2d6a4f', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>{success}</div>}

      {!photo && !uploading && (
        <div style={s.uploadBox} onClick={() => fileRef.current.click()}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>📷</div>
              <div style={{ fontSize: 13, color: '#6b3a1f', fontWeight: 500 }}>Capture the moment here!</div>
              <div style={{ fontSize: 11, color: '#c8956c', marginTop: 3 }}>Camera or gallery</div>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />

      {uploading && <div style={s.progressBar}><div style={{ height: '100%', borderRadius: 3, background: '#1a73e8', width: `${progress}%`, transition: 'width 0.3s' }} /></div>}

      {/* Public gallery grid */}
      <div style={s.galleryTitle}>Public Gallery</div>
      {photos.length === 0 && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', padding: '20px 0', fontSize: 13 }}>No public photos yet. Be the first!</div>}
      <div style={s.albumGrid}>
        {photos.map(p => (
          <div key={p.id} style={s.albumCell} onClick={() => setSelected(selected?.id === p.id ? null : p)}>
            <div style={{ aspectRatio: '1', overflow: 'hidden', background: '#fdf6ee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {p.thumb ? <img src={p.thumb} alt="guest" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 24 }}>📷</span>}
            </div>
            <div style={{ padding: '6px 8px' }}>
              <div style={{ fontSize: 10, color: '#c8956c' }}>{p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : 'Just now'}</div>
              {p.feedback && <div style={{ fontSize: 10, color: '#6b3a1f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>"{p.feedback}"</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Consent Modal */}
      {showConsent && photo && (
        <div style={s.consentModal}>
          <div style={s.consentCard}>
            <img src={photo} alt="preview" style={{ width: '100%', borderRadius: 12, maxHeight: 180, objectFit: 'cover', marginBottom: 14 }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#1a0a00', marginBottom: 10 }}>📸 Photo Consent</div>
            <div style={{ fontSize: 13, color: '#6b3a1f', lineHeight: 1.6, marginBottom: 14 }}>
              By tapping <strong>"I Agree"</strong>, you allow <strong>THEONYX CAFE</strong> to display your photo in our public gallery and social media. If you decline, your photo will be saved privately.
            </div>
            <label style={s.label}>Feedback (optional)</label>
            <input style={s.input} placeholder="Share your experience at Theonyx..." value={feedback} onChange={e => setFeedback(e.target.value)} />
            <button style={s.agreeBtn} onClick={() => uploadPhoto(true)}>✅ I Agree — Publish my photo</button>
            <button style={s.declineBtn} onClick={() => uploadPhoto(false)}>🔒 No thanks — Keep it private</button>
            <button style={{ ...s.declineBtn, color: '#c1121f', borderColor: '#ffcdd2' }} onClick={() => { setShowConsent(false); setPhoto(null); setPhotoFile(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Full photo viewer */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setSelected(null)}>
          <div style={{ maxWidth: 400, width: '100%' }}>
            {selected.thumb && <img src={selected.thumb} alt="full" style={{ width: '100%', borderRadius: 12 }} />}
            {selected.feedback && <div style={{ color: 'white', textAlign: 'center', marginTop: 10, fontSize: 13, fontStyle: 'italic' }}>"{selected.feedback}"</div>}
          </div>
        </div>
      )}
      <div style={{ height: 80 }} />
    </div>
  );
}
