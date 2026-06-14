import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase/config';
import { signOut } from 'firebase/auth';
import Chat from './Chat';
import { doc, getDoc, collection, addDoc, serverTimestamp, onSnapshot, query, where, getDocs, updateDoc, orderBy, limit, deleteDoc } from 'firebase/firestore';
import Attendance from './Attendance';
import Orders from './Orders';
import Inventory from './Inventory';
import Reports from './Reports';
import MenuManager from './MenuManager';
import Approvals from './Approvals';
import FeedbackPanel from './FeedbackPanel';
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
// ── Daily cleanliness reminder hook ──────────────────────────────────────────
// Fires a browser notification once per day per staff member.
// Automatically stops notifying after they submit their check for the day.
function useDailyCleanlinessReminder(userName) {
  useEffect(() => {
    if (!userName) return;
    // Ask for permission the first time
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    const checkAndNotify = async () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const today = new Date().toDateString();
      try {
        const snap = await getDocs(
          query(
            collection(db, 'cleanlinessChecks'),
            where('staff', '==', userName),
            where('date', '==', today)
          )
        );
        // Only notify when no submission exists for today
        if (snap.empty) {
          new Notification('🧹 Cleanliness Check Reminder', {
            body: `Hi ${userName}! Please don't forget to complete today's cleanliness check.`,
            icon: '/logo.jpg',
            tag: 'cleanliness-daily', // replaces any prior notification instead of stacking
          });
        }
      } catch (e) {
        // silently ignore — notification is non-critical
      }
    };
    // Fire once on mount / login
    checkAndNotify();
    // Re-check every hour so notification won't re-appear after they've submitted
    const interval = setInterval(checkAndNotify, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userName]);
}
// ─────────────────────────────────────────────────────────────────────────────
function CleanlinessCheck({ userName }) {
  const [checks, setChecks] = React.useState({});
  const [photos, setPhotos] = React.useState({});
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
  // Photos are stored as base64 directly in the Firestore doc, and one check can hold
  // up to 8 of them. Firestore caps a document at ~1 MB, so each image is kept under
  // ~115 KB (quality steps down only when needed) so all 8 fit safely.
  const compressImage = (file, maxDim = 1100, startQuality = 0.72) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          let w = img.width, h = img.height;
          if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
          else if (h >= w && h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          const MAX_LEN = 115000; // ~115 KB per image → 8 fit under Firestore's 1 MB limit
          let q = startQuality;
          let dataUrl = canvas.toDataURL('image/jpeg', q);
          while (dataUrl.length > MAX_LEN && q > 0.45) {
            q -= 0.08;
            dataUrl = canvas.toDataURL('image/jpeg', q);
          }
          resolve(dataUrl);
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
  const handleSubmit = async () => {
    const checked = CHECKLIST_ITEMS.filter(i => checks[i.id]);
    if (checked.length === 0) { setError('Please check at least one item.'); return; }
    setUploading(true); setError('');
    try {
      const photoUrls = {};
      for (const item of CHECKLIST_ITEMS) {
        if (photos[item.id]) {
          const dataUrl = await compressImage(photos[item.id].file);
          if (dataUrl) photoUrls[item.id] = dataUrl;
        }
      }
      const dateTimeStr = now.toLocaleDateString('en-PH', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
        + ' ' + now.toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' });
      await addDoc(collection(db, 'cleanlinessChecks'), {
        staff: userName, dateTime: dateTimeStr, date: now.toDateString(),
        checkedItems: checked.map(i => i.label),
        uncheckedItems: CHECKLIST_ITEMS.filter(i => !checks[i.id]).map(i => i.label),
        photoUrls, notes, submittedAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (e) { setError('Failed to submit. Please try again.'); }
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
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#2a1000' }}>Cleanliness Check</div>
        <div style={{ fontSize: 13, color: '#c8943a', marginTop: 2 }}>Welcome, <b>{userName}</b>! Let's check the cafe.</div>
      </div>
      <div style={{ fontSize: 11, color: '#a07850', marginBottom: 12 }}>{formatDate} · {formatTime} · {userName}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 5 }}>
        <span>{doneCount} of {CHECKLIST_ITEMS.length} checked</span>
        <span style={{ color: '#c8943a', fontWeight: 600 }}>{Math.round(doneCount / CHECKLIST_ITEMS.length * 100)}%</span>
      </div>
      <div style={{ height: 6, background: '#f0e8d8', borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ height: '100%', width: `${doneCount / CHECKLIST_ITEMS.length * 100}%`, background: '#c8943a', borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <div style={{ marginBottom: 18 }}>
        {CHECKLIST_ITEMS.map(item => {
          const isChecked = checks[item.id];
          const hasPhoto = photos[item.id];
          return (
            <div key={item.id} style={{ background: isChecked ? '#f0fce8' : '#fff', border: `1px solid ${isChecked ? '#8bc34a' : '#f0e8d8'}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8, transition: 'all 0.15s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div onClick={() => toggle(item.id)} style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${isChecked ? '#8bc34a' : '#c8943a'}`, background: isChecked ? '#8bc34a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', transition: 'all 0.15s' }}>
                  {isChecked && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <span onClick={() => toggle(item.id)} style={{ fontSize: 14, color: isChecked ? '#2a6000' : '#2a1000', fontWeight: isChecked ? 600 : 400, flex: 1, cursor: 'pointer' }}>{item.label}</span>
                {isChecked ? (
                  hasPhoto ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <img src={hasPhoto.url} alt={item.label} style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', border: '1px solid #8bc34a' }} />
                      <button onClick={() => fileRefs.current[item.id]?.click()} style={{ background: '#e8f5e9', border: '1px solid #8bc34a', borderRadius: 8, padding: '5px 9px', cursor: 'pointer', fontSize: 11, color: '#2d6a4f', fontWeight: 600 }}>Retake</button>
                    </div>
                  ) : (
                    <button onClick={() => fileRefs.current[item.id]?.click()} style={{ background: '#fff8f0', border: '1.5px dashed #c8943a', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 11, color: '#c8943a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c8943a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      Add Photo
                    </button>
                  )
                ) : (
                  <div style={{ width: 38, height: 38, borderRadius: 8, background: '#f5f0ea', border: '1px solid #e8dfd0', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a07850" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  </div>
                )}
                <input ref={el => fileRefs.current[item.id] = el} type="file" accept="image/*" capture="environment" onChange={e => handlePhotoCapture(item.id, e)} style={{ display: 'none' }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#2a1000', marginBottom: 6 }}>Notes (optional)</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any concerns or remarks..."
          style={{ width: '100%', minHeight: 72, border: '1px solid #e8dfd0', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#2a1000', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' }} />
      </div>
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
function CleanlinessReviews({ role, userName }) {
  const [list, setList] = React.useState([]);
  const [draft, setDraft] = React.useState({});
  const [savingId, setSavingId] = React.useState(null);
  const [lightbox, setLightbox] = React.useState(null);
  const [confirmDelId, setConfirmDelId] = React.useState(null);
  React.useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'cleanlinessChecks'), orderBy('submittedAt', 'desc'), limit(40)),
      snap => setList(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, []);
  React.useEffect(() => {
    if (role === 'manager') return;
    list.forEach(c => {
      if (c.staff === userName && c.reviewedAt && c.staffSeen !== true) {
        updateDoc(doc(db, 'cleanlinessChecks', c.id), { staffSeen: true }).catch(() => {});
      }
    });
  }, [list, role, userName]);
  const visible = role === 'manager' ? list : list.filter(c => c.staff === userName);
  const labelFor = (id) => (CHECKLIST_ITEMS.find(i => i.id === id) || {}).label || id;
  const draftFor = (c) => (draft[c.id] !== undefined ? draft[c.id] : { verdict: c.verdict || '', comment: c.managerComment || '' });
  const setDraftField = (c, patch) => setDraft(prev => ({ ...prev, [c.id]: { ...draftFor(c), ...patch } }));
  const saveReview = async (c) => {
    const d = draftFor(c);
    setSavingId(c.id);
    try {
      await updateDoc(doc(db, 'cleanlinessChecks', c.id), {
        verdict: d.verdict || null,
        managerComment: (d.comment || '').trim(),
        reviewedBy: userName,
        reviewedAt: new Date().toISOString(),
        staffSeen: false,
      });
    } catch (e) {}
    setSavingId(null);
  };
  const deleteCheck = async (id) => {
    try { await deleteDoc(doc(db, 'cleanlinessChecks', id)); } catch (e) {}
    setConfirmDelId(null);
  };
  const verdictPill = (v) => v === 'clean'
    ? { label: 'Clean', bg: '#f0fce8', bd: '#cfe0b0', fg: '#2a6000' }
    : { label: 'Needs work', bg: '#ffece9', bd: '#f0c8c0', fg: '#b5482e' };
  if (visible.length === 0) {
    return <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: '#a07850' }}>No cleanliness checks yet.</div>;
  }
  return (
    <div style={{ padding: '14px 16px 32px' }}>
      {visible.map(c => {
        const total = (c.checkedItems?.length || 0) + (c.uncheckedItems?.length || 0);
        const photoIds = Object.keys(c.photoUrls || {}).filter(k => c.photoUrls[k] && c.photoUrls[k] !== '(upload failed)');
        const reviewed = !!c.reviewedAt;
        const d = draftFor(c);
        return (
          <div key={c.id} style={{ background: '#fff', border: '1px solid #f0e8d8', borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#2a1000' }}>{c.staff || 'Staff'}</div>
                <div style={{ fontSize: 11, color: '#a07850', marginTop: 2 }}>{c.dateTime || c.date}</div>
              </div>
              <span style={{ fontSize: 11, color: '#2a6000', background: '#f0fce8', border: '1px solid #cfe0b0', borderRadius: 20, padding: '3px 9px', whiteSpace: 'nowrap' }}>{(c.checkedItems?.length || 0)} of {total || (c.checkedItems?.length || 0)}</span>
            </div>
            {c.checkedItems?.length > 0 && (
              <div style={{ fontSize: 11, color: '#a07850', marginTop: 8, lineHeight: 1.5 }}>{c.checkedItems.join(', ')}</div>
            )}
            {c.notes && <div style={{ fontSize: 11.5, color: '#5a3a1a', marginTop: 6, fontStyle: 'italic' }}>Staff note: {c.notes}</div>}
            {photoIds.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {photoIds.map(id => {
                  const v = c.photoUrls[id];
                  const isData = typeof v === 'string' && v.startsWith('data:');
                  return isData ? (
                    <div key={id} style={{ width: 76 }}>
                      <img src={v} alt={labelFor(id)} onClick={() => setLightbox(v)}
                        style={{ width: 76, height: 76, objectFit: 'cover', borderRadius: 8, border: '1px solid #f0e8d8', cursor: 'pointer', display: 'block' }} />
                      <div style={{ fontSize: 9.5, color: '#a07850', marginTop: 3, textAlign: 'center', lineHeight: 1.2 }}>{labelFor(id)}</div>
                    </div>
                  ) : (
                    <a key={id} href={v} target="_blank" rel="noreferrer"
                      style={{ fontSize: 11, color: '#c8943a', background: '#fff8f0', border: '1px solid #f0e8d8', borderRadius: 7, padding: '4px 9px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      {labelFor(id)}
                    </a>
                  );
                })}
              </div>
            )}
            {role === 'manager' ? (
              <div style={{ marginTop: 12, borderTop: '1px solid #f0e8d8', paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: '#a07850', marginBottom: 6 }}>Is the area really clean?</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <button onClick={() => setDraftField(c, { verdict: 'clean' })}
                    style={{ flex: 1, padding: '8px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      background: d.verdict === 'clean' ? '#f0fce8' : '#fff', border: `1px solid ${d.verdict === 'clean' ? '#8bc34a' : '#f0e8d8'}`, color: d.verdict === 'clean' ? '#2a6000' : '#a07850' }}>Clean</button>
                  <button onClick={() => setDraftField(c, { verdict: 'needs_work' })}
                    style={{ flex: 1, padding: '8px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      background: d.verdict === 'needs_work' ? '#ffece9' : '#fff', border: `1px solid ${d.verdict === 'needs_work' ? '#e0a89a' : '#f0e8d8'}`, color: d.verdict === 'needs_work' ? '#b5482e' : '#a07850' }}>Needs work</button>
                </div>
                <textarea value={d.comment} onChange={e => setDraftField(c, { comment: e.target.value })} placeholder="Comment to staff…"
                  style={{ width: '100%', boxSizing: 'border-box', minHeight: 50, border: '1px solid #e8dfd0', borderRadius: 9, padding: '8px 10px', fontSize: 12.5, color: '#2a1000', resize: 'vertical', outline: 'none', fontFamily: 'inherit', background: '#fff8f0' }} />
                <button onClick={() => saveReview(c)} disabled={savingId === c.id}
                  style={{ width: '100%', marginTop: 9, background: '#c8943a', color: '#fff', border: 'none', borderRadius: 9, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {savingId === c.id ? 'Saving…' : (reviewed ? `Update review & notify ${c.staff || 'staff'}` : `Save review & notify ${c.staff || 'staff'}`)}
                </button>
                {reviewed && <div style={{ fontSize: 10.5, color: '#a07850', marginTop: 6, textAlign: 'center' }}>Last reviewed by {c.reviewedBy || 'manager'}</div>}
                <div style={{ marginTop: 10, textAlign: 'center' }}>
                  {confirmDelId === c.id ? (
                    <span style={{ fontSize: 11.5, color: '#a07850' }}>
                      Delete this check permanently?{' '}
                      <button onClick={() => deleteCheck(c.id)} style={{ background: 'none', border: 'none', color: '#a3402d', fontWeight: 700, cursor: 'pointer', fontSize: 11.5, fontFamily: 'inherit', padding: 0 }}>Yes</button>
                      <span style={{ color: '#d9c3a6' }}> · </span>
                      <button onClick={() => setConfirmDelId(null)} style={{ background: 'none', border: 'none', color: '#a07850', cursor: 'pointer', fontSize: 11.5, fontFamily: 'inherit', padding: 0 }}>Cancel</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDelId(c.id)} style={{ background: 'none', border: 'none', color: '#b06a55', cursor: 'pointer', fontSize: 11.5, fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}>Delete check</button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 12, borderTop: '1px solid #f0e8d8', paddingTop: 12 }}>
                {reviewed ? (
                  <>
                    {c.verdict && (
                      <span style={{ fontSize: 11, color: verdictPill(c.verdict).fg, background: verdictPill(c.verdict).bg, border: `1px solid ${verdictPill(c.verdict).bd}`, borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>{verdictPill(c.verdict).label}</span>
                    )}
                    {c.managerComment && <div style={{ fontSize: 12.5, color: '#2a1000', background: '#fff8f0', border: '1px solid #f0e8d8', borderRadius: 9, padding: '9px 11px', marginTop: 8, lineHeight: 1.5 }}>{c.managerComment}</div>}
                    <div style={{ fontSize: 10.5, color: '#a07850', marginTop: 6 }}>From {c.reviewedBy || 'manager'}</div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: '#a07850' }}>Awaiting manager review…</div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.88)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <img src={lightbox} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}
function CleanlinessPanel({ role, userName }) {
  const [sub, setSub] = React.useState('new');
  const tabBtn = (on) => ({ flex: 1, border: 'none', background: on ? '#c8943a' : 'transparent', color: on ? '#fff' : '#a07850', fontSize: 12.5, fontWeight: on ? 700 : 600, padding: '9px 4px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' });
  return (
    <div>
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', background: '#f5ede2', borderRadius: 11, padding: 3, gap: 3, border: '1px solid #f0e8d8' }}>
          <button style={tabBtn(sub === 'new')} onClick={() => setSub('new')}>New check</button>
          <button style={tabBtn(sub === 'reviews')} onClick={() => setSub('reviews')}>Reviews</button>
        </div>
      </div>
      {sub === 'new' ? <CleanlinessCheck userName={userName} /> : <CleanlinessReviews role={role} userName={userName} />}
    </div>
  );
}
const VERSES = [
  { text: "I can do all this through him who gives me strength.", ref: "Philippians 4:13" },
  { text: "The Lord is my shepherd, I lack nothing.", ref: "Psalm 23:1" },
  { text: "Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.", ref: "Joshua 1:9" },
  { text: "And we know that in all things God works for the good of those who love him.", ref: "Romans 8:28" },
  { text: "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.", ref: "Jeremiah 29:11" },
  { text: "Trust in the Lord with all your heart and lean not on your own understanding.", ref: "Proverbs 3:5" },
  { text: "The Lord is my light and my salvation — whom shall I fear?", ref: "Psalm 27:1" },
  { text: "Do not be anxious about anything, but in every situation, by prayer and petition, present your requests to God.", ref: "Philippians 4:6" },
  { text: "Come to me, all you who are weary and burdened, and I will give you rest.", ref: "Matthew 11:28" },
  { text: "She is clothed with strength and dignity; she can laugh at the days to come.", ref: "Proverbs 31:25" },
  { text: "Even youths grow tired and weary, but those who hope in the Lord will renew their strength.", ref: "Isaiah 40:31" },
  { text: "The Lord himself goes before you and will be with you; he will never leave you nor forsake you.", ref: "Deuteronomy 31:8" },
  { text: "Cast all your anxiety on him because he cares for you.", ref: "1 Peter 5:7" },
  { text: "Whatever you do, work at it with all your heart, as working for the Lord.", ref: "Colossians 3:23" },
  { text: "Let your light shine before others, that they may see your good deeds and glorify your Father in heaven.", ref: "Matthew 5:16" },
  { text: "God is our refuge and strength, an ever-present help in trouble.", ref: "Psalm 46:1" },
  { text: "I praise you because I am fearfully and wonderfully made.", ref: "Psalm 139:14" },
  { text: "With God all things are possible.", ref: "Matthew 19:26" },
  { text: "The Lord bless you and keep you; the Lord make his face shine on you.", ref: "Numbers 6:24-25" },
  { text: "Peace I leave with you; my peace I give you.", ref: "John 14:27" },
  { text: "For the Spirit God gave us does not make us timid, but gives us power, love and self-discipline.", ref: "2 Timothy 1:7" },
  { text: "I have learned, in whatever state I am, to be content.", ref: "Philippians 4:11" },
  { text: "Your word is a lamp for my feet, a light on my path.", ref: "Psalm 119:105" },
  { text: "Delight yourself in the Lord, and he will give you the desires of your heart.", ref: "Psalm 37:4" },
  { text: "No eye has seen, no ear has heard what God has prepared for those who love him.", ref: "1 Corinthians 2:9" },
  { text: "The name of the Lord is a fortified tower; the righteous run to it and are safe.", ref: "Proverbs 18:10" },
  { text: "He gives strength to the weary and increases the power of the weak.", ref: "Isaiah 40:29" },
  { text: "Be joyful in hope, patient in affliction, faithful in prayer.", ref: "Romans 12:12" },
  { text: "Seek first his kingdom and his righteousness, and all these things will be given to you.", ref: "Matthew 6:33" },
  { text: "I sought the Lord, and he answered me; he delivered me from all my fears.", ref: "Psalm 34:4" },
  { text: "The joy of the Lord is your strength.", ref: "Nehemiah 8:10" },
];
function getDailyVerse() {
  const day = Math.floor(Date.now() / 86400000);
  return VERSES[day % VERSES.length];
}
export default function AdminApp({ user, onSignOut }) {
  const [activeTab, setActiveTab] = useState(null);
  const [role, setRole] = useState('staff');
  const [userName, setUserName] = useState('');
  const [time, setTime] = useState(new Date());
  const [pendingPhotos, setPendingPhotos] = useState(0);
  const [cleanlinessAlert, setCleanlinessAlert] = useState(false);
  const [cleanFeedback, setCleanFeedback] = useState(0);
  const verse = getDailyVerse();
  // ── Daily cleanliness notification ────────────────────────────────────────
  // Called once userName is known. Fires a browser push notification every day
  // until the staff member submits their cleanliness check. Re-checks every hour.
  useDailyCleanlinessReminder(userName);
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          setRole(snap.data().role || 'staff');
          // ── FIX: use name field, fallback to email prefix if name not set ──
          const name = snap.data().name || '';
          if (name) {
            setUserName(name);
          } else if (user.email) {
            // e.g. "kelly@theonyxcafe.com" → "kelly" → capitalise → "Kelly"
            const prefix = user.email.split('@')[0];
            setUserName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
          }
        }
      } catch { setRole('staff'); }
    };
    fetchUser();
  }, [user]);
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const unsubPhotos = onSnapshot(
      query(collection(db, 'guestPhotos'), where('public', '==', true)),
      snap => {
        const docs = snap.docs.map(d => d.data());
        setPendingPhotos(docs.filter(d => d.approved === undefined || d.approved === null).length);
      }
    );
    const checkCleanliness = async () => {
      const now = new Date();
      if (now.getHours() >= 15) {
        const today = now.toDateString();
        const snap = await getDocs(query(collection(db, 'cleanlinessChecks'), where('date', '==', today)));
        setCleanlinessAlert(snap.empty);
      } else { setCleanlinessAlert(false); }
    };
    checkCleanliness();
    const cleanTimer = setInterval(checkCleanliness, 60000);
    return () => { unsubPhotos(); clearInterval(cleanTimer); };
  }, []);
  useEffect(() => {
    if (!userName) return;
    const unsub = onSnapshot(
      query(collection(db, 'cleanlinessChecks'), where('staff', '==', userName)),
      snap => setCleanFeedback(snap.docs.map(d => d.data()).filter(d => d.reviewedAt && d.staffSeen !== true).length)
    );
    return () => unsub();
  }, [userName]);
  const handleSignOut = async () => { await signOut(auth); onSignOut(); };
  const formatTime = (d) => {
    const h = d.getHours() % 12 || 12;
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
  };
  const formatDate = (d) => d.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const S = {
    container: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#1a0e00', maxWidth: 480, margin: '0 auto' },
    topbar: { padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: '#2a1800', borderBottom: '1px solid #3d2200' },
    content: { flex: 1, overflowY: 'auto', background: 'rgba(253,246,238,0.97)', borderRadius: activeTab ? '0' : '16px 16px 0 0', marginTop: activeTab ? 0 : 4 },
  };
  const mainPanels = [
    { id: 'attendance', label: 'Clock In',  desc: 'Staff attendance', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8943a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    { id: 'orders',     label: 'Orders',    desc: 'Take & manage',    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8943a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
    { id: 'inventory',  label: 'Stocks',    desc: 'Inventory',        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8943a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> },
    // Reports is manager-only — staff won't see this card
    ...(role === 'manager' ? [{ id: 'reports', label: 'Reports', desc: 'Sales & analytics', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8943a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> }] : []),
  ];
  const morePanels = [
    { id: 'cleanliness', label: 'Cleanliness', desc: 'Daily check', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c8943a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
    { id: 'feedback',    label: 'Feedback',    desc: 'Customer reviews', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c8943a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
    ...(role === 'manager' ? [{ id: 'chat', label: 'Chat', desc: 'Message guests', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c8943a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/></svg> }] : []),
    ...(role === 'manager' ? [{ id: 'menu', label: 'Menu', desc: 'Edit items', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c8943a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> }] : []),
    { id: 'approvals',   label: 'Approvals',   desc: 'Guest photos', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c8943a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
  ];
  return (
    <div style={S.container}>
      <div style={S.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.jpg" alt="logo" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #c8943a' }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f5e6d0' }}>Theonyx Cafe</div>
            <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 10, background: '#c8943a22', color: '#c8943a', border: '1px solid #c8943a44' }}>
              {role === 'manager' ? 'Manager' : 'Staff'}
            </span>
          </div>
        </div>
        <button onClick={handleSignOut} style={{ background: '#2a1800', border: '1px solid #3d2200', borderRadius: 8, color: '#a07850', padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>
          Exit
        </button>
      </div>
      <div style={S.content}>
        {!activeTab ? (
          <div style={{ paddingBottom: 32 }}>
            <div style={{ padding: '14px 18px 16px', background: '#fff8f0', borderBottom: '1px solid #f0e8d8' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13, color: '#a07850' }}>
                  Good day, <span style={{ color: '#2a1000', fontWeight: 700 }}>{userName || 'Friend'}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#c8943a' }}>{formatTime(time)}</div>
                  <div style={{ fontSize: 10, color: '#a07850' }}>{formatDate(time)}</div>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, color: '#c8943a', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, fontWeight: 600 }}>
                  Here's to encourage you today
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#5a3a1a', fontStyle: 'italic', lineHeight: 1.65 }}>
                  "{verse.text}"
                </p>
                <div style={{ fontSize: 11, color: '#a07850', marginTop: 5 }}>{verse.ref} &middot; NIV</div>
              </div>
            </div>
            <div style={{ padding: '16px 16px 8px' }}>
              <div style={{ fontSize: 10, color: '#a07850', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Panels</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {mainPanels.map(p => (
                  <div key={p.id} onClick={() => setActiveTab(p.id)}
                    style={{ background: '#fff', border: '1px solid #f0e8d8', borderRadius: 14, padding: '16px 14px', cursor: 'pointer' }}
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
            <div style={{ padding: '4px 16px 8px' }}>
              <div style={{ fontSize: 10, color: '#a07850', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>More</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {morePanels.map(p => {
                  const badge = p.id === 'approvals' && pendingPhotos > 0 ? pendingPhotos
                    : p.id === 'cleanliness' && cleanFeedback > 0 ? cleanFeedback
                    : p.id === 'cleanliness' && cleanlinessAlert ? '!' : null;
                  return (
                    <div key={p.id} onClick={() => setActiveTab(p.id)}
                      style={{ background: '#fff8f0', border: `1px solid ${badge ? '#ffb74d' : '#f0e8d8'}`, borderRadius: 10, padding: '11px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}
                      onMouseOver={e => e.currentTarget.style.borderColor = '#c8943a'}
                      onMouseOut={e => e.currentTarget.style.borderColor = badge ? '#ffb74d' : '#f0e8d8'}>
                      <div style={{ width: 30, height: 30, background: '#fff', border: '1px solid #f0e8d8', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {p.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#2a1000' }}>{p.label}</div>
                        <div style={{ fontSize: 10, color: '#a07850' }}>{p.desc}</div>
                      </div>
                      {badge && (
                        <div style={{ color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0,
                          background: p.id === 'cleanliness' ? '#ff9800' : '#2196f3' }}>
                          {badge}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ padding: '8px 16px' }}>
              <button onClick={handleSignOut} style={{ width: '100%', background: 'transparent', border: '1px solid #f0e8d8', borderRadius: 10, color: '#a07850', padding: 12, fontSize: 13, cursor: 'pointer' }}>
                Log out
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fff8f0', borderBottom: '1px solid #f0e8d8', flexShrink: 0 }}>
              <button onClick={() => setActiveTab(null)} style={{ background: 'transparent', border: '1px solid #f0e8d8', borderRadius: 8, color: '#c8943a', padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                Back
              </button>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#2a1000' }}>
                {[...mainPanels, ...morePanels].find(p => p.id === activeTab)?.label}
              </span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {activeTab === 'attendance'  && <Attendance role={role} userName={userName} />}
              {activeTab === 'orders'      && <Orders userName={userName} />}
              {activeTab === 'inventory'   && <Inventory role={role} userName={userName} />}
              {activeTab === 'approvals'   && <Approvals role={role} />}
              {activeTab === 'reports'     && role === 'manager' && <Reports role={role} userName={userName} />}
              {activeTab === 'menu'        && role === 'manager' && <MenuManager />}
              {activeTab === 'chat'        && role === 'manager' && <Chat user={user} adminMode />}
              {activeTab === 'cleanliness' && <CleanlinessPanel role={role} userName={userName} />}
              {activeTab === 'feedback'    && <FeedbackPanel role={role} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
