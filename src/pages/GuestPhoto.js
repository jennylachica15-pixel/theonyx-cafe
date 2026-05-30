import React, { useState, useRef, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp, onSnapshot, query, where, orderBy } from 'firebase/firestore';

const GOOGLE_CLIENT_ID = '596322682185-n5hm66hvol3nnqqllnuop995kcnefbgu.apps.googleusercontent.com';
const GUEST_FOLDER_ID = '1hOrGU9k3HKBWdaOenygW-4ORVXu6gYeM';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

const s = {
  page: { padding: '16px 16px 0', animation: 'fadeIn 0.3s ease' },
  title: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 4 },
  sub: { fontSize: 13, color: 'var(--brown-light)', marginBottom: 20 },
  uploadBox: { background: 'white', borderRadius: 16, padding: 24, textAlign: 'center', border: '2px dashed #e8d8c8', marginBottom: 16, cursor: 'pointer' },
  previewImg: { width: '100%', borderRadius: 12, maxHeight: 220, objectFit: 'cover', marginBottom: 8 },
  consentBox: { background: 'white', borderRadius: 14, padding: '20px', marginBottom: 16, boxShadow: '0 1px 6px rgba(26,10,0,0.07)' },
  consentTitle: { fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 10 },
  consentText: { fontSize: 13, color: 'var(--brown-mid)', lineHeight: 1.6, marginBottom: 16 },
  agreeBtn: { width: '100%', padding: '13px', borderRadius: 12, background: 'var(--brown-dark)', color: 'var(--gold-light)', fontSize: 14, fontWeight: 600, marginBottom: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  declineBtn: { width: '100%', padding: '12px', borderRadius: 12, background: 'var(--cream)', color: 'var(--brown-mid)', fontSize: 14, fontWeight: 500, border: '1.5px solid #e8d8c8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  connectBtn: { width: '100%', padding: '13px', borderRadius: 12, background: '#1a73e8', color: 'white', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16, border: 'none', cursor: 'pointer' },
  connectedBadge: { background: 'var(--green-bg)', color: 'var(--green-ok)', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 500, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 },
  progressBar: { height: 6, borderRadius: 3, background: '#e8d8c8', marginBottom: 14, overflow: 'hidden' },
  albumGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingBottom: 80 },
  albumCell: { background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(26,10,0,0.07)', cursor: 'pointer' },
  sectionTitle: { fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 12 },
};

const addWatermark = (file) => new Promise((resolve) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const baseFontSize = Math.max(img.width * 0.022, 18);
    const smallFontSize = Math.max(img.width * 0.018, 14);
    const padding = img.width * 0.025;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    const lineGap = baseFontSize * 1.3;
    const y = img.height - padding - smallFontSize;
    ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.font = `${smallFontSize}px "Times New Roman", Times, serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.80)';
    ctx.fillText(`${dateStr} · ${timeStr}`, img.width - padding, y);
    ctx.font = `bold ${baseFontSize}px "Times New Roman", Times, serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText('THEONYX CAFE', img.width - padding, y - lineGap);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.92);
  };
  img.src = url;
});

export default function GuestPhoto() {
  const [photo, setPhoto] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [showConsent, setShowConsent] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [publicPhotos, setPublicPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const fileRef = useRef();
  const tokenClientRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'guestPhotos'), where('public', '==', true), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => setPublicPhotos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => { setPhoto(ev.target.result); setShowConsent(true); };
    reader.readAsDataURL(file);
  };

  const uploadPhoto = async (isPublic) => {
    if (!photoFile || !accessToken) { setError('Connect Google Drive first.'); return; }
    setUploading(true); setUploadProgress(10); setShowConsent(false);

    try {
      const watermarked = await addWatermark(photoFile);
      setUploadProgress(30);
      const date = new Date().toISOString().slice(0, 10);
      const fileName = `Guest_${date}_${photoFile.name}`;
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify({ name: fileName, parents: [GUEST_FOLDER_ID], mimeType: 'image/jpeg' })], { type: 'application/json' }));
      form.append('file', watermarked);
      setUploadProgress(60);
      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form });
      if (!res.ok) throw new Error('Upload failed');
      const file = await res.json();
      setUploadProgress(90);

      // Save thumbnail
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 200; thumbCanvas.height = 200;
      const ctx = thumbCanvas.getContext('2d');
      const img = new Image();
      img.onload = async () => {
        const size = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 200, 200);
        const thumb = thumbCanvas.toDataURL('image/jpeg', 0.6);
        await addDoc(collection(db, 'guestPhotos'), { fileName, driveFileId: file.id, thumb, public: isPublic, createdAt: serverTimestamp() });
        setSuccess(isPublic ? '✅ Photo published to public gallery!' : '✅ Photo saved privately to Drive.');
        setPhoto(null); setPhotoFile(null);
        setUploadProgress(100);
        setTimeout(() => { setSuccess(''); setUploadProgress(0); }, 4000);
      };
      img.src = URL.createObjectURL(watermarked);
    } catch (e) { setError('Upload failed: ' + e.message); setUploadProgress(0); }
    setUploading(false);
  };

  return (
    <div style={s.page}>
      <div style={s.title}>Guest Photos</div>
      <div style={s.sub}>Take a photo at Theonyx Cafe</div>

      {!accessToken ? (
        <button style={s.connectBtn} onClick={() => tokenClientRef.current?.requestAccessToken()}>🔗 Connect to Upload</button>
      ) : (
        <div style={s.connectedBadge}>✅ Ready to upload</div>
      )}

      {error && <div style={{ background: 'var(--red-bg)', color: 'var(--red-crit)', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>⚠️ {error}</div>}
      {success && <div style={{ background: 'var(--green-bg)', color: 'var(--green-ok)', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{success}</div>}

      {!photo && !uploading && (
        <div style={s.uploadBox} onClick={() => fileRef.current.click()}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>📷</div>
          <div style={{ fontSize: 14, color: 'var(--brown-mid)', fontWeight: 500 }}>Tap to take your photo</div>
          <div style={{ fontSize: 12, color: 'var(--brown-light)', marginTop: 4 }}>Camera or gallery</div>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileChange} />

      {photo && !showConsent && (
        <img src={photo} alt="preview" style={s.previewImg} />
      )}

      {uploading && (
        <div style={{ marginBottom: 16 }}>
          <div style={s.progressBar}><div style={{ height: '100%', borderRadius: 3, background: '#1a73e8', width: `${uploadProgress}%`, transition: 'width 0.3s ease' }} /></div>
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--brown-light)' }}>Uploading... {uploadProgress}%</div>
        </div>
      )}

      {/* Consent Modal */}
      {showConsent && photo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,10,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'var(--cream)', borderRadius: '20px 20px 0 0', padding: '28px 24px 40px', width: '100%', maxWidth: 480, animation: 'slideUp 0.3s ease' }}>
            <img src={photo} alt="preview" style={{ width: '100%', borderRadius: 12, maxHeight: 180, objectFit: 'cover', marginBottom: 16 }} />
            <div style={s.consentTitle}>📸 Photo Consent</div>
            <div style={s.consentText}>
              By tapping <strong>"Agree"</strong>, you allow <strong>THEONYX CAFE</strong> to display your photo in our public gallery and social media. If you decline, your photo will be saved privately.
            </div>
            <button style={s.agreeBtn} onClick={() => uploadPhoto(true)}>✅ I Agree — Publish my photo</button>
            <button style={s.declineBtn} onClick={() => uploadPhoto(false)}>🔒 No thanks — Keep it private</button>
            <button style={{ ...s.declineBtn, marginTop: 8, color: 'var(--red-crit)', borderColor: 'var(--red-crit)' }} onClick={() => { setShowConsent(false); setPhoto(null); setPhotoFile(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Public Gallery */}
      <div style={s.sectionTitle}>Public Gallery</div>
      {publicPhotos.length === 0 && <div style={{ textAlign: 'center', color: 'var(--brown-light)', padding: '20px 0', fontSize: 13 }}>No public photos yet.</div>}
      <div style={s.albumGrid}>
        {publicPhotos.map(p => (
          <div key={p.id} style={s.albumCell} onClick={() => setSelectedPhoto(selectedPhoto?.id === p.id ? null : p)}>
            <div style={{ aspectRatio: '1', overflow: 'hidden' }}>
              {p.thumb ? <img src={p.thumb} alt="guest" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📷</div>}
            </div>
            <div style={{ padding: '6px 8px', fontSize: 10, color: 'var(--brown-light)' }}>
              {p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : 'Just now'}
            </div>
          </div>
        ))}
      </div>

      {selectedPhoto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setSelectedPhoto(null)}>
          {selectedPhoto.thumb && <img src={selectedPhoto.thumb} alt="full" style={{ maxWidth: 400, width: '100%', borderRadius: 12 }} />}
        </div>
      )}
      <div style={{ height: 80 }} />
    </div>
  );
}
