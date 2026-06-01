import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, onSnapshot, query, where, updateDoc, deleteDoc, doc } from 'firebase/firestore';

const s = {
  page: { padding: '16px 16px 0', animation: 'fadeIn 0.3s ease' },
  title: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#1a0a00', marginBottom: 4 },
  sub: { fontSize: 13, color: '#c8956c', marginBottom: 16 },
  tabRow: { display: 'flex', background: 'white', borderRadius: 12, padding: 4, marginBottom: 16, boxShadow: '0 1px 4px rgba(26,10,0,0.06)' },
  tab: (active) => ({ flex: 1, padding: '9px', borderRadius: 9, fontSize: 12, fontWeight: active ? 700 : 400, background: active ? '#1a0a00' : 'transparent', color: active ? '#f0d080' : '#c8956c', border: 'none', cursor: 'pointer', textAlign: 'center' }),
  card: { background: 'white', borderRadius: 14, marginBottom: 12, boxShadow: '0 1px 6px rgba(26,10,0,0.07)', overflow: 'hidden' },
  thumb: { width: '100%', height: 200, objectFit: 'cover' },
  thumbPlaceholder: { width: '100%', height: 180, background: '#f5ede4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 },
  cardBody: { padding: '12px 14px' },
  cardDate: { fontSize: 11, color: '#c8956c', marginBottom: 4 },
  cardFeedback: { fontSize: 13, color: '#1a0a00', fontStyle: 'italic', marginBottom: 10 },
  btnRow: { display: 'flex', gap: 8 },
  approveBtn: { flex: 1, padding: '10px', borderRadius: 10, background: '#d8f3dc', color: '#2d6a4f', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' },
  rejectBtn: { flex: 1, padding: '10px', borderRadius: 10, background: '#ffe0e0', color: '#c1121f', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' },
  deleteBtn: { padding: '10px 14px', borderRadius: 10, background: '#1a0a00', color: '#ff6b6b', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' },
  badge: (status) => ({
    display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    background: status === 'approved' ? '#d8f3dc' : status === 'rejected' ? '#ffe0e0' : '#faeeda',
    color: status === 'approved' ? '#2d6a4f' : status === 'rejected' ? '#c1121f' : '#854f0b',
  }),
  empty: { textAlign: 'center', padding: '40px 0', color: '#c8956c', fontSize: 13 },
  confirmOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  confirmBox: { background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 320, textAlign: 'center' },
};

export default function Approvals({ role }) {
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [rejected, setRejected] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, type }

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'guestPhotos'), where('public', '==', true)), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPending(docs.filter(d => d.approved === undefined || d.approved === null));
      setApproved(docs.filter(d => d.approved === true));
      setRejected(docs.filter(d => d.approved === false));
    });
    return unsub;
  }, []);

  const handleApprove = async (id) => {
    setLoading(prev => ({ ...prev, [id]: true }));
    await updateDoc(doc(db, 'guestPhotos', id), { approved: true });
    setLoading(prev => ({ ...prev, [id]: false }));
  };

  const handleReject = async (id) => {
    setLoading(prev => ({ ...prev, [id]: true }));
    await updateDoc(doc(db, 'guestPhotos', id), { approved: false });
    setLoading(prev => ({ ...prev, [id]: false }));
  };

  const handleUndo = async (id) => {
    setLoading(prev => ({ ...prev, [id]: true }));
    await updateDoc(doc(db, 'guestPhotos', id), { approved: null });
    setLoading(prev => ({ ...prev, [id]: false }));
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { id } = confirmDelete;
    setLoading(prev => ({ ...prev, [id]: true }));
    await deleteDoc(doc(db, 'guestPhotos', id));
    setLoading(prev => ({ ...prev, [id]: false }));
    setConfirmDelete(null);
  };

  const renderCards = (list, showActions, showUndo) => {
    if (list.length === 0) return (
      <div style={s.empty}>
        {activeTab === 'pending' ? 'No photos pending approval.' : activeTab === 'approved' ? 'No approved photos yet.' : 'No rejected photos.'}
      </div>
    );
    return list.map(photo => (
      <div key={photo.id} style={s.card}>
        {photo.thumb
          ? <img src={photo.thumb} alt="guest" style={s.thumb} />
          : <div style={s.thumbPlaceholder}>📷</div>
        }
        <div style={s.cardBody}>
          <div style={s.cardDate}>
            {photo.createdAt?.toDate ? photo.createdAt.toDate().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'}
          </div>
          {photo.feedback && <div style={s.cardFeedback}>"{photo.feedback}"</div>}

          {showActions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={s.btnRow}>
                <button style={s.approveBtn} onClick={() => handleApprove(photo.id)} disabled={loading[photo.id]}>Approve</button>
                <button style={s.rejectBtn} onClick={() => handleReject(photo.id)} disabled={loading[photo.id]}>Reject</button>
              </div>
              {role === 'manager' && <button style={s.deleteBtn} onClick={() => setConfirmDelete({ id: photo.id })}>Delete Photo</button>}
            </div>
          )}

          {showUndo && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={s.badge(activeTab === 'approved' ? 'approved' : 'rejected')}>
                {activeTab === 'approved' ? 'Approved' : 'Rejected'}
              </span>
              <div style={s.btnRow}>
                <button style={{ ...s.rejectBtn, background: '#f5ede4', color: '#6b3a1f' }} onClick={() => handleUndo(photo.id)} disabled={loading[photo.id]}>
                  Move to Pending
                </button>
                {role === 'manager' && <button style={s.deleteBtn} onClick={() => setConfirmDelete({ id: photo.id })}>Delete</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    ));
  };

  return (
    <div style={s.page}>
      <div style={s.title}>Photo Approvals</div>
      <div style={s.sub}>Review guest photos before they appear in Guest Snapshots</div>

      <div style={s.tabRow}>
        <button style={s.tab(activeTab === 'pending')} onClick={() => setActiveTab('pending')}>
          Pending {pending.length > 0 && `(${pending.length})`}
        </button>
        <button style={s.tab(activeTab === 'approved')} onClick={() => setActiveTab('approved')}>
          Approved {approved.length > 0 && `(${approved.length})`}
        </button>
        <button style={s.tab(activeTab === 'rejected')} onClick={() => setActiveTab('rejected')}>
          Rejected {rejected.length > 0 && `(${rejected.length})`}
        </button>
      </div>

      {activeTab === 'pending'  && renderCards(pending, true, false)}
      {activeTab === 'approved' && renderCards(approved, false, true)}
      {activeTab === 'rejected' && renderCards(rejected, false, true)}

      {/* Delete confirm dialog */}
      {confirmDelete && (
        <div style={s.confirmOverlay}>
          <div style={s.confirmBox}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🗑️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1a0a00', marginBottom: 6 }}>Delete Photo?</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>This cannot be undone.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)}
                style={{ flex: 1, padding: '11px', borderRadius: 10, background: '#f5ede4', border: 'none', color: '#6b3a1f', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleDelete}
                style={{ flex: 1, padding: '11px', borderRadius: 10, background: '#c1121f', border: 'none', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: 80 }} />
    </div>
  );
}
