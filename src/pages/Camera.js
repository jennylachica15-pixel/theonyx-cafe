import React, { useState, useRef, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy } from 'firebase/firestore';

const TAGS = ['Delivery', 'Stock Check', 'Equipment', 'Damaged Goods', 'Other'];

// Google OAuth & Drive config
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
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10,
    opacity: 1,
  },
  logBtn: {
    width: '100%', padding: '13px', borderRadius: 12,
    background: 'var(--brown-dark)', color: 'var(--gold-light)', fontSize: 14, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20,
  },
  logCard: {
    background: 'white', borderRadius: 12, padding: '12px 14px', marginBottom: 10,
    boxShadow: '0 1px 4px rgba(26,10,0,0.07)', display: 'flex', gap: 12, alignItems: 'flex-start',
  },
  logThumb: { width: 54, height: 54, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: 'var(--cream)' },
  logName: { fontSize: 13, fontWeight: 600, color: 'var(--brown-dark)', margin: 0 },
  logMeta: { fontSize: 11, color: 'var(--brown-light)', marginTop: 3 },
  tagChip: {
    display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11,
    background: 'var(--orange-bg)', color: 'var(--orange-warn)', fontWeight: 600, marginTop: 4,
  },
  connectedBadge: {
    background: 'var(--green-bg)', color: 'var(--green-ok)', borderRadius: 10,
    padding: '10px 14px', fontSize: 13, fontWeight: 500, marginBottom: 14,
    display: 'flex', alignItems: 'center', gap: 8,
  },
  progressBar: {
    height: 6, borderRadius: 3, background: '#e8d8c8', marginBottom: 14, overflow: 'hidden',
  },
  progressFill: (pct) => ({
    height: '100%', borderRadius: 3, background: '#1a73e8',
    width: `${pct}%`, transition: 'width 0.3s ease',
  }),
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
  const [driveFileUrl, setDriveFileUrl] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef();
  const tokenClientRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'photoLogs'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  // Load Google Identity Services script
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
        if (response.access_token) {
          setAccessToken(response.access_token);
        }
      },
    });
  };

  const connectDrive = () => {
    if (tokenClientRef.current) {
      tokenClientRef.current.requestAccessToken();
    } else {
      setError('Google Sign-In not loaded yet. Please wait a moment and try again.');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setDriveFileUrl(null);
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
      // Generate filename with date and tag
      const date = new Date().toISOString().slice(0, 10);
      const fileName = `${tag}_${date}_${photoFile.name}`;

      // Step 1: Create file metadata with folder
      const metadata = {
        name: fileName,
        parents: [DRIVE_FOLDER_ID],
        mimeType: photoFile.type,
      };

      setUploadProgress(30);

      // Step 2: Upload using multipart
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', photoFile);

      setUploadProgress(60);

      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,name',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: form,
        }
      );

      setUploadProgress(90);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Upload failed');
      }

      const file = await response.json();
      setUploadProgress(100);
      setDriveFileUrl(file.webViewLink);

      // Log to Firestore
      await addDoc(collection(db, 'photoLogs'), {
        fileName,
        tag,
        note,
        size: photoFile.size,
        driveFileId: file.id,
        driveFileUrl: file.webViewLink,
        createdAt: serverTimestamp(),
        driveUploaded: true,
      });

      setSuccess(true);
      setPhoto(null);
      setPhotoFile(null);
      setNote('');
      setTimeout(() => { setSuccess(false); setUploadProgress(0); }, 4000);
    } catch (err) {
      setError('Upload failed: ' + err.message);
      setUploadProgress(0);
    }
    setUploading(false);
  };

  return (
    <div style={s.page}>
      <div style={s.title}>Photos</div>
      <div style={s.sub}>Upload photos directly to your Google Drive folder</div>

      {/* Connect Drive */}
      {!accessToken ? (
        <button style={s.driveBtn} onClick={connectDrive}>
          <span>🔗</span> Connect Google Drive
        </button>
      ) : (
        <div style={s.connectedBadge}>
          ✅ Google Drive connected — photos will save to <strong>Theonyx Cafe Photos</strong>
        </div>
      )}

      {error && (
        <div style={{ background: 'var(--red-bg)', color: 'var(--red-crit)', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Photo Picker */}
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
            <div style={s.progressBar}>
              <div style={s.progressFill(uploadProgress)} />
            </div>
          )}

          <button
            style={{ ...s.driveBtn, opacity: (!accessToken || uploading) ? 0.6 : 1 }}
            onClick={uploadToDrive}
            disabled={!accessToken || uploading}
          >
            {uploading ? `Uploading... ${uploadProgress}%` : '📤 Upload to Google Drive'}
          </button>

          {!accessToken && (
            <p style={{ fontSize: 12, color: 'var(--red-crit)', textAlign: 'center', marginTop: -10, marginBottom: 14 }}>
              Connect Google Drive first ↑
            </p>
          )}
        </>
      )}

      {success && (
        <div style={{ background: 'var(--green-bg)', color: 'var(--green-ok)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontWeight: 500, fontSize: 14 }}>
          ✅ Photo uploaded to your Drive folder!
          {driveFileUrl && <a href={driveFileUrl} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: 12, marginTop: 4, color: 'var(--green-ok)' }}>View in Drive →</a>}
        </div>
      )}

      {/* Photo Log */}
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 12 }}>
        Photo Log
      </div>

      {logs.length === 0 && <div style={{ textAlign: 'center', color: 'var(--brown-light)', padding: '24px 0', fontSize: 13 }}>No photos uploaded yet.</div>}

      {logs.map(log => (
        <div key={log.id} style={s.logCard}>
          <div style={{ ...s.logThumb, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
            {log.driveUploaded ? '☁️' : '📷'}
          </div>
          <div style={{ flex: 1 }}>
            <p style={s.logName}>{log.fileName || 'photo.jpg'}</p>
            <p style={s.logMeta}>{log.createdAt?.toDate ? log.createdAt.toDate().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'}</p>
            <span style={s.tagChip}>{log.tag}</span>
            {log.note && <p style={{ fontSize: 12, color: 'var(--brown-light)', marginTop: 4 }}>{log.note}</p>}
            {log.driveFileUrl && (
              <a href={log.driveFileUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#1a73e8', display: 'block', marginTop: 4 }}>
                View in Drive →
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
