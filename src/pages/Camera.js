import React, { useState, useRef, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy } from 'firebase/firestore';

const TAGS = ['Delivery', 'Stock Check', 'Equipment', 'Damaged Goods', 'Guest', 'Other'];

const GOOGLE_CLIENT_ID = '596322682185-n5hm66hvol3nnqqllnuop995kcnefbgu.apps.googleusercontent.com';
const DRIVE_FOLDER_ID = '1aEtFqN84f0jDG9SYb_hZhf2W-3TNDdkS';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

const s = {
  page: { padding: '16px 16px 0', animation: 'fadeIn 0.3s ease' },
  title: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 4 },
  sub: { fontSize: 13, color: 'var(--brown-light)', marginBottom: 20 },
  uploadBox: {
    background: 'white', borderRadius: 16, padding: 24, textAlign: 'center',
    border: '2px dashed #e8d8c8', marginBottom: 16, cursor: 'pointer',
  },
  previewImg: { width: '100%', borderRadius: 12, maxHeight: 220, objectFit: 'cover', marginBottom: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--brown-mid)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e8d8c8',
    fontSize: 14, background: 'var(--cream)', color: 'var(--brown-dark)', marginBottom: 14, outline: 'none',
  },
  driveBtn: {
    width: '100%', padding: '13px', borderRadius: 12,
    background: '#1a73e8', color: 'white', fontSize: 14, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20,
  },
  connectedBadge: {
    background: 'var(--green-bg)', color: 'var(--green-ok)', borderRadius: 10,
    padding: '10px 14px', fontSize: 13, fontWeight: 500, marginBottom: 14,
    display: 'flex', alignItems: 'center', gap: 8,
  },
  progressBar: { height: 6, borderRadius: 3, background: '#e8d8c8', marginBottom: 14, overflow: 'hidden' },
  progressFill: (pct) => ({ height: '100%', borderRadius: 3, background: '#1a73e8', width: `${pct}%`, transition: 'width 0.3s ease' }),
  tagChip: {
    display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11,
    background: 'var(--orange-bg)', color: 'var(--orange-warn)', fontWeight: 600, marginTop: 4,
  },
  // Album grid
  albumGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingBottom: 16 },
  albumCell: {
    background: 'white', borderRadius: 12, overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(26,10,0,0.07)', cursor: 'pointer',
  },
  albumThumb: { width: '100%', aspectRatio: '1', objectFit: 'cover', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 },
  albumInfo: { padding: '8px 10px' },
  albumTag: {
    display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 10,
    background: 'var(--orange-bg)', color: 'var(--orange-warn)', fontWeight: 600, marginBottom: 3,
  },
  albumDate: { fontSize: 10, color: 'var(--brown-light)' },
};

const addWatermark = (file) => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Watermark settings — scale font to image size
      const baseFontSize = Math.max(img.width * 0.022, 18);
      const smallFontSize = Math.max(img.width * 0.018, 14);
      const padding = img.width * 0.025;

      // THEONYX CAFE
      ctx.font = `bold ${baseFontSize}px "Times New Roman", Times, serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';

      const now = new Date();
      const dateStr = now.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
      const dateTimeStr = `${dateStr} · ${timeStr}`;

      const lineGap = baseFontSize * 1.3;
      const y = img.height - padding - smallFontSize;

      // Draw date/time first (bottom line)
      ctx.font = `${smallFontSize}px "Times New Roman", Times, serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.80)';
      ctx.fillText(dateTimeStr, img.width - padding, y);

      // Draw THEONYX CAFE above
      ctx.font = `bold ${baseFontSize}px "Times New Roman", Times, serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.fillText('THEONYX CAFE', img.width - padding, y - lineGap);

      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.92);
    };
    img.src = url;
  });
};

export default function Camera() {
  const [photo, setPhoto] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [tag, setTag] = useState('Delivery');
  const [note, setNote] = useState('');
  const [logs, setLogs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const fileRef = useRef();
  const tokenClientRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'photoLogs'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => initTokenClient();
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  const initTokenClient = () => {
    if (!window.google) return;
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.access_token) setAccessToken(response.access_token);
      },
    });
  };

  const connectDrive = () => {
    if (tokenClientRef.current) tokenClientRef.current.requestAccessToken();
    else setError('Google Sign-In not loaded yet. Please wait a moment and try again.');
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhoto(ev.target.result);
    reader.readAsDataURL(file);
  };

  const uploadToDrive = async () => {
    if (!photoFile || !accessToken) return;
    setUploading(true);
    setUploadProgress(10);
    setError('');

    try {
      // Apply watermark
      const watermarkedFile = await addWatermark(photoFile);
      setUploadProgress(30);

      const date = new Date().toISOString().slice(0, 10);
      const fileName = `${tag}_${date}_${photoFile.name}`;
      const metadata = { name: fileName, parents: [DRIVE_FOLDER_ID], mimeType: 'image/jpeg' };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', watermarkedFile);

      setUploadProgress(60);

      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
        { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form }
      );

      setUploadProgress(90);
      if (!response.ok) throw new Error('Upload failed');

      const file = await response.json();
      setUploadProgress(100);

      // Save thumbnail as base64 for album view
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 200;
      thumbCanvas.height = 200;
      const thumbCtx = thumbCanvas.getContext('2d');
      const img = new Image();
      img.onload = async () => {
        const size = Math.min(img.width, img.height);
        const x = (img.width - size) / 2;
        const y = (img.height - size) / 2;
        thumbCtx.drawImage(img, x, y, size, size, 0, 0, 200, 200);
        const thumbData = thumbCanvas.toDataURL('image/jpeg', 0.6);

        await addDoc(collection(db, 'photoLogs'), {
          fileName,
          tag,
          note,
          size: watermarkedFile.size,
          driveFileId: file.id,
          thumb: thumbData,
          createdAt: serverTimestamp(),
          driveUploaded: true,
        });

        setSuccess(true);
        setPhoto(null);
        setPhotoFile(null);
        setNote('');
        setTimeout(() => { setSuccess(false); setUploadProgress(0); }, 3000);
      };
      const objUrl = URL.createObjectURL(watermarkedFile);
      img.src = objUrl;

    } catch (err) {
      setError('Upload failed: ' + err.message);
      setUploadProgress(0);
    }
    setUploading(false);
  };

  return (
    <div style={s.page}>
      <div style={s.title}>Photos</div>
      <div style={s.sub}>Upload photos to Google Drive with watermark</div>

      {!accessToken ? (
        <button style={s.driveBtn} onClick={connectDrive}>🔗 Connect Google Drive</button>
      ) : (
        <div style={s.connectedBadge}>✅ Google Drive connected</div>
      )}

      {error && (
        <div style={{ background: 'var(--red-bg)', color: 'var(--red-crit)', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
          ⚠️ {error}
        </div>
      )}

      <div style={s.uploadBox} onClick={() => fileRef.current.click()}>
        {photo
          ? <img src={photo} alt="preview" style={s.previewImg} />
          : <>
              <div style={{ fontSize: 48, marginBottom: 8 }}>📷</div>
              <div style={{ fontSize: 14, color: 'var(--brown-mid)', fontWeight: 500 }}>Tap to take or choose a photo</div>
              <div style={{ fontSize: 12, color: 'var(--brown-light)', marginTop: 4 }}>Camera or gallery</div>
            </>
        }
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileChange} />

      {photo && (
        <>
          <label style={s.label}>Tag this photo</label>
          <select style={s.input} value={tag} onChange={e => setTag(e.target.value)}>
            {TAGS.map(t => <option key={t}>{t}</option>)}
          </select>

          <label style={s.label}>Note (optional)</label>
          <input style={s.input} placeholder="e.g. Arabica delivery from supplier" value={note} onChange={e => setNote(e.target.value)} />

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div style={s.progressBar}><div style={s.progressFill(uploadProgress)} /></div>
          )}

          <button
            style={{ ...s.driveBtn, opacity: (!accessToken || uploading) ? 0.6 : 1 }}
            onClick={uploadToDrive}
            disabled={!accessToken || uploading}
          >
            {uploading ? `Uploading... ${uploadProgress}%` : '📤 Upload to Google Drive'}
          </button>

          {!accessToken && (
            <p style={{ fontSize: 12, color: 'var(--red-crit)', textAlign: 'center', marginTop: -14, marginBottom: 14 }}>
              Connect Google Drive first ↑
            </p>
          )}
        </>
      )}

      {success && (
        <div style={{ background: 'var(--green-bg)', color: 'var(--green-ok)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontWeight: 500, fontSize: 14 }}>
          ✅ Photo uploaded with watermark!
        </div>
      )}

      {/* Album grid */}
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 12 }}>
        Photo Log
      </div>

      {logs.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--brown-light)', padding: '24px 0', fontSize: 13 }}>No photos yet.</div>
      )}

      <div style={s.albumGrid}>
        {logs.map(log => (
          <div key={log.id} style={s.albumCell} onClick={() => setSelectedPhoto(selectedPhoto?.id === log.id ? null : log)}>
            <div style={{ ...s.albumThumb }}>
              {log.thumb
                ? <img src={log.thumb} alt={log.tag} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span>📷</span>
              }
            </div>
            <div style={s.albumInfo}>
              <div style={s.albumTag}>{log.tag}</div>
              <div style={s.albumDate}>
                {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : 'Just now'}
              </div>
              {log.note && <div style={{ fontSize: 10, color: 'var(--brown-light)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.note}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Full photo modal */}
      {selectedPhoto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setSelectedPhoto(null)}>
          <div style={{ maxWidth: 400, width: '100%' }}>
            {selectedPhoto.thumb && <img src={selectedPhoto.thumb} alt="full" style={{ width: '100%', borderRadius: 12 }} />}
            <div style={{ color: 'white', textAlign: 'center', marginTop: 12, fontSize: 13 }}>
              <span style={{ background: 'rgba(255,255,255,0.15)', padding: '4px 12px', borderRadius: 20 }}>{selectedPhoto.tag}</span>
              {selectedPhoto.note && <p style={{ marginTop: 8, opacity: 0.8 }}>{selectedPhoto.note}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
