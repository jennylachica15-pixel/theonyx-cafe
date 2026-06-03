import React, { useState, useRef, useEffect } from 'react';
import { db } from '../firebase/config';
import {
  collection, addDoc, serverTimestamp, onSnapshot,
  query, where, doc, updateDoc, arrayUnion, arrayRemove,
  getDocs
} from 'firebase/firestore';

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

// Center-crop to a sharp square for the grid
const makeSquareThumb = (file, size, quality) => new Promise((resolve) => {
  const img = new Image(); const url = URL.createObjectURL(file);
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
    const crop = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - crop) / 2, (img.height - crop) / 2, crop, crop, 0, 0, size, size);
    URL.revokeObjectURL(url);
    resolve(c.toDataURL('image/jpeg', quality));
  };
  img.src = url;
});

// Resize to fit a max longest-edge, preserving aspect ratio (for the viewer)
const resizeImage = (file, maxDim, quality) => new Promise((resolve) => {
  const img = new Image(); const url = URL.createObjectURL(file);
  img.onload = () => {
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    resolve(c.toDataURL('image/jpeg', quality));
  };
  img.src = url;
});

const getGuestId = () => {
  try {
    let id = localStorage.getItem('theonyx_guest_id');
    if (!id) { id = Math.random().toString(36).slice(2); localStorage.setItem('theonyx_guest_id', id); }
    return id;
  } catch { return 'guest_' + Math.random().toString(36).slice(2); }
};

// Grid size icons

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
  const [cols, setCols] = useState(2); // 1, 2, or 3
  const [expandedComments, setExpandedComments] = useState({});
  const [commentText, setCommentText] = useState({});
  const [commenterName, setCommenterName] = useState({});
  const [comments, setComments] = useState({});
  const [submittingComment, setSubmittingComment] = useState({});
  const fileRef = useRef();
  const tokenClientRef = useRef(null);
  const guestId = getGuestId();

  useEffect(() => {
    const q = query(collection(db, 'guestPhotos'), where('public', '==', true), where('approved', '==', true));
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
      const thumb = await makeSquareThumb(wm, 512, 0.82);
      const full = await resizeImage(wm, 1280, 0.85);
      await addDoc(collection(db, 'guestPhotos'), { fileName, driveFileId: data.id, thumb, full, feedback, public: isPublic, hearts: [], createdAt: serverTimestamp() });
      setSuccess(isPublic ? '✅ Photo submitted for approval!' : '✅ Photo saved privately.');
      setPhoto(null); setPhotoFile(null); setFeedback('');
      setProgress(100); setTimeout(() => { setSuccess(''); setProgress(0); }, 4000);
    } catch { setSuccess('⚠️ Upload failed. Try again.'); setProgress(0); }
    setUploading(false);
  };

  const toggleHeart = async (e, photoId, currentHearts) => {
    e.stopPropagation();
    const hearts = currentHearts || [];
    const hasLiked = hearts.includes(guestId);
    await updateDoc(doc(db, 'guestPhotos', photoId), {
      hearts: hasLiked ? arrayRemove(guestId) : arrayUnion(guestId)
    });
  };

  const toggleComments = async (e, photoId) => {
    e.stopPropagation();
    const isOpen = expandedComments[photoId];
    if (!isOpen && !comments[photoId]) {
      const snap = await getDocs(collection(db, 'guestPhotos', photoId, 'comments'));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setComments(prev => ({ ...prev, [photoId]: data }));
    }
    setExpandedComments(prev => ({ ...prev, [photoId]: !isOpen }));
  };

  const submitComment = async (photoId) => {
    const text = (commentText[photoId] || '').trim();
    if (!text) return;
    setSubmittingComment(prev => ({ ...prev, [photoId]: true }));
    const name = (commenterName[photoId] || '').trim() || 'Guest';
    await addDoc(collection(db, 'guestPhotos', photoId, 'comments'), { text, name, createdAt: serverTimestamp() });
    setComments(prev => ({ ...prev, [photoId]: [...(prev[photoId] || []), { text, name, createdAt: { seconds: Date.now()/1000 } }] }));
    setCommentText(prev => ({ ...prev, [photoId]: '' }));
    setCommenterName(prev => ({ ...prev, [photoId]: '' }));
    setSubmittingComment(prev => ({ ...prev, [photoId]: false }));
  };

  

  return (
    <div style={{ padding: '16px 16px 0', minHeight: '100vh', background: 'transparent' }}>
      {/* Header */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'white' }}>Snapshots</div>
      </div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 14 }}>Share your experience at Theonyx Cafe</div>

      {/* Connect + Capture row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        {!accessToken
          ? <button style={{ padding: '8px 14px', borderRadius: 10, background: '#6b3a1f', color: '#f0d080', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(212,168,83,0.3)', cursor: 'pointer', flexShrink: 0 }} onClick={() => tokenClientRef.current?.requestAccessToken()}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Connect
            </button>
          : <div style={{ padding: '7px 12px', borderRadius: 10, background: 'rgba(45,106,79,0.25)', color: '#6fcf97', fontSize: 11, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid rgba(45,106,79,0.25)', flexShrink: 0 }}>✅ Ready</div>
        }
        <div style={{ flex: 1, background: 'rgba(107,58,31,0.35)', borderRadius: 10, padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', border: '1px solid rgba(212,168,83,0.2)' }} onClick={() => fileRef.current.click()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d4a853" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#f0d080' }}>Capture the moment here!</span>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />

      {photo && !uploading && <img src={photo} alt="preview" style={{ width: '100%', borderRadius: 10, maxHeight: 180, objectFit: 'cover', marginBottom: 12 }} />}
      {uploading && <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.1)', marginBottom: 12, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 2, background: '#d4a853', width: `${progress}%`, transition: 'width 0.3s' }} /></div>}
      {success && <div style={{ fontSize: 12, color: success.includes('⚠️') ? '#ff6b6b' : '#6fcf97', marginBottom: 10, padding: '7px 12px', background: 'rgba(0,0,0,0.25)', borderRadius: 8 }}>{success}</div>}

      {/* Guest Snapshots title + grid toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'white' }}>Guest Snapshots</div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginRight: 2 }}>View:</span>
          {[1,2,3,4,5].map(n => (
            <button key={n} onClick={() => setCols(n)} style={{ width: 24, height: 24, borderRadius: 5, background: cols === n ? '#d4a853' : 'rgba(107,58,31,0.4)', color: cols === n ? '#1a0a00' : 'rgba(255,255,255,0.6)', border: cols === n ? 'none' : '1px solid rgba(212,168,83,0.2)', cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
              {n}
            </button>
          ))}
        </div>
      </div>
      {photos.length === 0 && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', padding: '30px 0', fontSize: 13 }}>No photos yet. Be the first to share!</div>}

      {/* Photo grid */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: cols === 1 ? 12 : cols === 2 ? 8 : 5, paddingBottom: 80 }}>
        {photos.map(p => {
          const hearts = p.hearts || [];
          const hasLiked = hearts.includes(guestId);
          const isExpanded = expandedComments[p.id];
          const photoComments = comments[p.id] || [];

          return (
            <div key={p.id} style={{ borderRadius: cols >= 3 ? 6 : 12, overflow: 'hidden', background: 'rgba(20,8,0,0.5)', border: '1px solid rgba(212,168,83,0.1)' }}>
              {/* Photo with overlay */}
              <div style={{ position: 'relative', cursor: 'pointer', aspectRatio: '1', overflow: 'hidden' }} onClick={() => cols > 1 ? setSelected(p) : null}>
                {p.thumb
                  ? <img src={cols === 1 ? (p.full || p.thumb) : p.thumb} alt="guest" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : <div style={{ width: '100%', height: '100%', background: 'rgba(107,58,31,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📷</div>
                }
                {/* Overlay — hearts & comments inside photo */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(20,8,0,0.65) 0%, transparent 100%)', padding: cols >= 3 ? '10px 4px 4px' : '18px 10px 7px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: cols === 3 ? 6 : 10, alignItems: 'center' }}>
                    {/* Heart */}
                    <button onClick={e => toggleHeart(e, p.id, p.hearts)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, padding: 0 }}>
                      <svg width={cols === 3 ? 13 : 16} height={cols === 3 ? 13 : 16} viewBox="0 0 24 24" fill={hasLiked ? '#e05a5a' : 'none'} stroke={hasLiked ? '#e05a5a' : 'rgba(255,255,255,0.8)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.2s' }}>
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                      {hearts.length > 0 && <span style={{ fontSize: cols === 3 ? 9 : 11, color: hasLiked ? '#e05a5a' : 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{hearts.length}</span>}
                    </button>
                    {/* Comment */}
                    <button onClick={e => { if (cols === 1) toggleComments(e, p.id); else setSelected(p); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, padding: 0 }}>
                      <svg width={cols === 3 ? 12 : 15} height={cols === 3 ? 12 : 15} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      {photoComments.length > 0 && <span style={{ fontSize: cols === 3 ? 9 : 11, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{photoComments.length}</span>}
                    </button>
                  </div>
                  {cols === 1 && p.createdAt?.toDate && (
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{p.createdAt.toDate().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
                  )}
                </div>
              </div>

              {/* Single column: show caption + comments below */}
              {cols === 1 && (
                <div style={{ padding: '8px 12px 10px' }}>
                  {p.feedback && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontStyle: 'italic', marginBottom: 6 }}>"{p.feedback}"</div>}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                      {photoComments.length === 0
                        ? <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>No comments yet.</div>
                        : photoComments.map((c, i) => (
                            <div key={i} style={{ marginBottom: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#d4a853' }}>{c.name} </span>
                              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{c.text}</span>
                            </div>
                          ))
                      }
                      <input style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid rgba(212,168,83,0.2)', background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: 11, outline: 'none', boxSizing: 'border-box', marginBottom: 5 }}
                        placeholder="Your name (optional)" value={commenterName[p.id] || ''} onChange={e => setCommenterName(prev => ({ ...prev, [p.id]: e.target.value }))} />
                      <div style={{ display: 'flex', gap: 5 }}>
                        <input style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1px solid rgba(212,168,83,0.2)', background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: 11, outline: 'none' }}
                          placeholder="Write a comment..." value={commentText[p.id] || ''} onChange={e => setCommentText(prev => ({ ...prev, [p.id]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && submitComment(p.id)} />
                        <button onClick={() => submitComment(p.id)} style={{ padding: '7px 12px', borderRadius: 7, background: '#d4a853', color: '#1a0a00', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer' }}>Post</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Consent Modal */}
      {showConsent && photo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,10,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#fdf6ee', borderRadius: '20px 20px 0 0', padding: '22px 20px 34px', width: '100%', maxWidth: 480, animation: 'slideUp 0.3s ease' }}>
            <img src={photo} alt="preview" style={{ width: '100%', borderRadius: 10, maxHeight: 150, objectFit: 'cover', marginBottom: 12 }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#1a0a00', marginBottom: 8 }}>Photo Consent</div>
            <div style={{ fontSize: 12, color: '#6b3a1f', lineHeight: 1.7, marginBottom: 12 }}>
              By tapping <strong>"I Agree"</strong>, you allow <strong>THEONYX CAFE</strong> to display your photo in our public gallery and social media after manager review.
            </div>
            <input style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid #e8d8c8', fontSize: 13, background: 'white', color: '#1a0a00', marginBottom: 10, outline: 'none', boxSizing: 'border-box' }}
              placeholder="Caption or feedback (optional)" value={feedback} onChange={e => setFeedback(e.target.value)} />
            <button style={{ width: '100%', padding: '12px', borderRadius: 10, background: '#1a0a00', color: '#f0d080', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', marginBottom: 7 }} onClick={() => uploadPhoto(true)}>I Agree — Submit for Approval</button>
            <button style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'transparent', color: '#6b3a1f', fontSize: 12, border: '1px solid #e8d8c8', cursor: 'pointer', marginBottom: 5 }} onClick={() => uploadPhoto(false)}>Keep it private</button>
            <button style={{ width: '100%', padding: '9px', borderRadius: 10, background: 'transparent', color: '#c8956c', fontSize: 11, border: 'none', cursor: 'pointer' }} onClick={() => { setShowConsent(false); setPhoto(null); setPhotoFile(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Full photo viewer (for 2-3 col mode) — includes comments */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 16px' }} onClick={() => setSelected(null)}>
          <div style={{ maxWidth: 400, width: '100%' }} onClick={e => e.stopPropagation()}>
            {(selected.full || selected.thumb) && <img src={selected.full || selected.thumb} alt="full" style={{ width: '100%', borderRadius: 12, marginBottom: 10 }} />}
            {selected.feedback && <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, fontStyle: 'italic', marginBottom: 10, textAlign: 'center' }}>"{selected.feedback}"</div>}
            {/* Hearts + comments in viewer */}
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 12 }}>
              <button onClick={e => toggleHeart(e, selected.id, selected.hearts)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill={(selected.hearts||[]).includes(guestId) ? '#e05a5a' : 'none'} stroke={(selected.hearts||[]).includes(guestId) ? '#e05a5a' : 'rgba(255,255,255,0.6)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{(selected.hearts||[]).length}</span>
              </button>
            </div>
            {/* Comments in viewer */}
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px', maxHeight: 180, overflowY: 'auto' }}>
              {(comments[selected.id] || []).length === 0 && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '6px 0' }}>No comments yet.</div>}
              {(comments[selected.id] || []).map((c, i) => (
                <div key={i} style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#d4a853' }}>{c.name} </span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{c.text}</span>
                </div>
              ))}
              <input style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid rgba(212,168,83,0.2)', background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: 11, outline: 'none', boxSizing: 'border-box', marginTop: 8, marginBottom: 5 }}
                placeholder="Your name (optional)" value={commenterName[selected.id] || ''} onChange={e => setCommenterName(prev => ({ ...prev, [selected.id]: e.target.value }))} />
              <div style={{ display: 'flex', gap: 5 }}>
                <input style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1px solid rgba(212,168,83,0.2)', background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: 11, outline: 'none' }}
                  placeholder="Write a comment..." value={commentText[selected.id] || ''} onChange={e => setCommentText(prev => ({ ...prev, [selected.id]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && submitComment(selected.id)} />
                <button onClick={() => submitComment(selected.id)} style={{ padding: '7px 12px', borderRadius: 7, background: '#d4a853', color: '#1a0a00', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer' }}>Post</button>
              </div>
            </div>
            <button onClick={() => setSelected(null)} style={{ width: '100%', marginTop: 10, padding: '9px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', fontSize: 12, border: 'none', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
