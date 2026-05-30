import React, { useState, useRef } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useEffect } from 'react';

const TAGS = ['Delivery', 'Stock Check', 'Equipment', 'Damaged Goods', 'Other'];

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
  infoBox: {
    background: '#e8f0fe', borderRadius: 12, padding: '14px 16px', marginBottom: 16,
    fontSize: 13, color: '#1a73e8', lineHeight: 1.5,
  },
};

export default function Camera() {
  const [photo, setPhoto] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [tag, setTag] = useState('Delivery');
  const [note, setNote] = useState('');
  const [logs, setLogs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    const q = query(collection(db, 'photoLogs'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhoto(ev.target.result);
    reader.readAsDataURL(file);
  };

  const openDrive = () => {
    window.open('https://drive.google.com/drive/my-drive', '_blank');
  };

  const logPhoto = async () => {
    if (!photoFile) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'photoLogs'), {
        fileName: photoFile.name,
        tag,
        note,
        size: photoFile.size,
        createdAt: serverTimestamp(),
        driveUploaded: false,
      });
      setSuccess(true);
      setPhoto(null);
      setPhotoFile(null);
      setNote('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  return (
    <div style={s.page}>
      <div style={s.title}>Photos</div>
      <div style={s.sub}>Take or upload photos and save to Google Drive</div>

      <div style={s.infoBox}>
        📁 <strong>How it works:</strong> Take or pick a photo below, then tap "Open Google Drive" to upload it manually. Log the photo here to keep a record.
      </div>

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

          <button style={s.driveBtn} onClick={openDrive}>
            <span>📂</span> Open Google Drive to Upload
          </button>

          <button style={s.logBtn} onClick={logPhoto} disabled={saving}>
            {saving ? 'Saving...' : '✅ Log this photo'}
          </button>
        </>
      )}

      {success && (
        <div style={{ background: 'var(--green-bg)', color: 'var(--green-ok)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontWeight: 500, fontSize: 14 }}>
          ✅ Photo logged successfully!
        </div>
      )}

      {/* Photo Log */}
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 12 }}>
        Photo Log
      </div>

      {logs.length === 0 && <div style={{ textAlign: 'center', color: 'var(--brown-light)', padding: '24px 0', fontSize: 13 }}>No photos logged yet.</div>}

      {logs.map(log => (
        <div key={log.id} style={s.logCard}>
          <div style={{ ...s.logThumb, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📷</div>
          <div>
            <p style={s.logName}>{log.fileName || 'photo.jpg'}</p>
            <p style={s.logMeta}>{log.createdAt?.toDate ? log.createdAt.toDate().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'}</p>
            <span style={s.tagChip}>{log.tag}</span>
            {log.note && <p style={{ fontSize: 12, color: 'var(--brown-light)', marginTop: 4 }}>{log.note}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
