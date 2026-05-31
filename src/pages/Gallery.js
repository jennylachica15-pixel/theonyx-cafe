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

// Get or create a guest session ID stored in localStorage
const getGuestId = () => {
  try {
    let id = localStorage.getItem('theonyx_guest_id');
    if (!id) { id = Math.random().toString(36).slice(2); localStorage.setItem('theonyx_guest_id', id); }
    return id;
  } catch { return 'guest_' + Math.random().toString(36).slice(2); }
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
  const [expandedComments, setExpandedComments] = useState({});
  const [commentText, setCommentText] = useState({});
  const [commenterName, setCommenterName] = useState({});
  const [comments, setComments] = useState({}); // { photoId: [...] }
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
      const thumb = await makeThumb(wm);
      await addDoc(collection(db, 'guestPhotos'), {
        fileName, driveFileId: data.id, thumb, feedback,
        public: isPublic, hearts: [], createdAt: serverTimestamp()
      });
      setSuccess(isPublic ? '✅ Photo submitted for approval!' : '✅ Photo saved privately.');
      setPhoto(null); setPhotoFile(null); setFeedback('');
      setProgress(100); setTimeout(() => { setSuccess(''); setProgress(0); }, 4000);
    } catch (e) { setSuccess('⚠️ Upload failed. Try again.'); setProgress(0); }
    setUploading(false);
  };

  const toggleHeart = async (photoId, currentHearts) => {
    const hearts = currentHearts || [];
    const hasLiked = hearts.includes(guestId);
    await updateDoc(doc(db, 'guestPhotos', photoId), {
      hearts: hasLiked ? arrayRemove(guestId) : arrayUnion(guestId)
    });
  };

  const toggleComments = async (photoId) => {
    const isOpen = expandedComments[photoId];
    if (!isOpen && !comments[photoId]) {
      // Load comments
      const snap = await getDocs(query(collection(db, 'guestPhotos', photoId, 'comments')));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setComments(prev => ({ ...prev, [photoId]: data }));
    }
    setExpandedComments(prev => ({ ...prev, [photoId]: !isOpen }));
  };

  const submitComment = async (photoId) => {
    const text = (commentText[photoId] || '').trim();
    const name = (commenterName[photoId] || '').trim();
    if (!text) return;
    setSubmittingComment(prev => ({ ...prev, [photoId]: true }));
    const newComment = { text, name: name || 'Guest', createdAt: serverTimestamp() };
    await addDoc(collection(db, 'guestPhotos', photoId, 'comments'), newComment);
    // Update local state
    setComments(prev => ({
      ...prev,
      [photoId]: [...(prev[photoId] || []), { ...newComment, createdAt: { seconds: Date.now()/1000 } }]
    }));
    setCommentText(prev => ({ ...prev, [photoId]: '' }));
    setCommenterName(prev => ({ ...prev, [photoId]: '' }));
    setSubmittingComment(prev => ({ ...prev, [photoId]: false }));
  };

  return (
    <div style={{ padding: '16px 16px 0', minHeight: '100vh', background: 'transparent' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 4 }}>Snapshots</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 16 }}>Share your experience at Theonyx Cafe</div>

      {/* Connect + Capture row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'stretch' }}>
        {!accessToken
          ? <button style={{ padding: '8px 14px', borderRadius: 10, background: '#6b3a1f', color: '#f0d080', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(212,168,83,0.3)', cursor: 'pointer', flexShrink: 0 }} onClick={() => tokenClientRef.current?.requestAccessToken()}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Connect
            </button>
          : <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(45,106,79,0.3)', color: '#6fcf97', fontSize: 11, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid rgba(45,106,79,0.3)', flexShrink: 0 }}>✅ Ready</div>
        }
        <div style={{ flex: 1, background: 'rgba(107,58,31,0.35)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', border: '1px solid rgba(212,168,83,0.25)' }} onClick={() => fileRef.current.click()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d4a853" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#f0d080' }}>Capture the moment here!</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>Camera or gallery</div>
          </div>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />

      {photo && !uploading && <img src={photo} alt="preview" style={{ width: '100%', borderRadius: 12, maxHeight: 200, objectFit: 'cover', marginBottom: 14 }} />}
      {uploading && <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', marginBottom: 14, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 2, background: '#d4a853', width: `${progress}%`, transition: 'width 0.3s' }} /></div>}
      {success && <div style={{ fontSize: 12, color: success.includes('⚠️') ? '#ff6b6b' : '#6fcf97', marginBottom: 12, padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>{success}</div>}

      {/* Guest Snapshots */}
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 12 }}>Guest Snapshots</div>
      {photos.length === 0 && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '30px 0', fontSize: 13 }}>No photos yet. Be the first to share!</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 80 }}>
        {photos.map(p => {
          const hearts = p.hearts || [];
          const hasLiked = hearts.includes(guestId);
          const isExpanded = expandedComments[p.id];
          const photoComments = comments[p.id] || [];

          return (
            <div key={p.id} style={{ background: 'rgba(20,8,0,0.6)', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(212,168,83,0.15)' }}>
              {/* Photo */}
              <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setSelected(p)}>
                {p.thumb
                  ? <img src={p.thumb} alt="guest" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
                  : <div style={{ width: '100%', aspectRatio: '4/3', background: 'rgba(107,58,31,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>📷</div>
                }
              </div>

              {/* Actions row */}
              <div style={{ padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: p.feedback ? 8 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {/* Heart button */}
                    <button
                      onClick={() => toggleHeart(p.id, p.hearts)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: 0 }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill={hasLiked ? '#e05a5a' : 'none'} stroke={hasLiked ? '#e05a5a' : 'rgba(255,255,255,0.5)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.2s' }}>
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                      <span style={{ fontSize: 12, color: hasLiked ? '#e05a5a' : 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{hearts.length || 0}</span>
                    </button>
                    {/* Comment toggle */}
                    <button
                      onClick={() => toggleComments(p.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: 0 }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                        {isExpanded ? 'Hide' : photoComments.length > 0 ? `${photoComments.length} comment${photoComments.length !== 1 ? 's' : ''}` : 'Comment'}
                      </span>
                    </button>
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                    {p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : 'Just now'}
                  </div>
                </div>

                {/* Feedback caption */}
                {p.feedback && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', marginTop: 4 }}>"{p.feedback}"</div>}

                {/* Comments section */}
                {isExpanded && (
                  <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
                    {/* Comments list */}
                    {photoComments.length === 0
                      ? <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>No comments yet. Be the first!</div>
                      : photoComments.map((c, i) => (
                          <div key={i} style={{ marginBottom: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#d4a853' }}>{c.name} </span>
                            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{c.text}</span>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                              {c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                            </div>
                          </div>
                        ))
                    }
                    {/* Add comment */}
                    <div style={{ marginTop: 8 }}>
                      <input
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(212,168,83,0.2)', background: 'rgba(255,255,255,0.06)', color: 'white', fontSize: 12, outline: 'none', boxSizing: 'border-box', marginBottom: 6 }}
                        placeholder="Your name (optional)"
                        value={commenterName[p.id] || ''}
                        onChange={e => setCommenterName(prev => ({ ...prev, [p.id]: e.target.value }))}
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(212,168,83,0.2)', background: 'rgba(255,255,255,0.06)', color: 'white', fontSize: 12, outline: 'none' }}
                          placeholder="Write a comment..."
                          value={commentText[p.id] || ''}
                          onChange={e => setCommentText(prev => ({ ...prev, [p.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && submitComment(p.id)}
                        />
                        <button
                          onClick={() => submitComment(p.id)}
                          disabled={submittingComment[p.id]}
                          style={{ padding: '8px 14px', borderRadius: 8, background: '#d4a853', color: '#1a0a00', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', flexShrink: 0 }}
                        >
                          Post
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Consent Modal */}
      {showConsent && photo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,10,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#fdf6ee', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px', width: '100%', maxWidth: 480, animation: 'slideUp 0.3s ease' }}>
            <img src={photo} alt="preview" style={{ width: '100%', borderRadius: 10, maxHeight: 160, objectFit: 'cover', marginBottom: 14 }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#1a0a00', marginBottom: 8 }}>Photo Consent</div>
            <div style={{ fontSize: 12, color: '#6b3a1f', lineHeight: 1.7, marginBottom: 14 }}>
              By tapping <strong>"I Agree"</strong>, you allow <strong>THEONYX CAFE</strong> to display your photo in our public gallery and social media after review. If you decline, your photo will be saved privately.
            </div>
            <input style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #e8d8c8', fontSize: 13, background: 'white', color: '#1a0a00', marginBottom: 12, outline: 'none', boxSizing: 'border-box' }}
              placeholder="Caption or feedback (optional)" value={feedback} onChange={e => setFeedback(e.target.value)} />
            <button style={{ width: '100%', padding: '12px', borderRadius: 10, background: '#1a0a00', color: '#f0d080', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', marginBottom: 8 }} onClick={() => uploadPhoto(true)}>I Agree — Submit for Approval</button>
            <button style={{ width: '100%', padding: '11px', borderRadius: 10, background: 'transparent', color: '#6b3a1f', fontSize: 13, border: '1px solid #e8d8c8', cursor: 'pointer', marginBottom: 6 }} onClick={() => uploadPhoto(false)}>Keep it private</button>
            <button style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'transparent', color: '#c8956c', fontSize: 12, border: 'none', cursor: 'pointer' }} onClick={() => { setShowConsent(false); setPhoto(null); setPhotoFile(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Full photo viewer */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setSelected(null)}>
          <div style={{ maxWidth: 400, width: '100%' }}>
            {selected.thumb && <img src={selected.thumb} alt="full" style={{ width: '100%', borderRadius: 12 }} />}
            {selected.feedback && <div style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 10, fontSize: 13, fontStyle: 'italic' }}>"{selected.feedback}"</div>}
            <div style={{ color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 6, fontSize: 11 }}>Tap anywhere to close</div>
          </div>
        </div>
      )}
    </div>
  );
}
