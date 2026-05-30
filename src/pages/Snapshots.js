import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

const s = {
  page: { padding: '16px 16px 0', minHeight: '100vh', background: 'transparent' },
  title: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 4 },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 16 },
  albumGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingBottom: 80 },
  albumCell: { background: 'rgba(253,240,228,0.95)', borderRadius: 12, overflow: 'hidden', cursor: 'pointer' },
  tag: { display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 10, background: 'rgba(200,149,108,0.3)', color: '#6b3a1f', fontWeight: 600, marginBottom: 2 },
};

export default function Snapshots() {
  const [logs, setLogs] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'photoLogs'));
    return onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setLogs(docs);
    });
  }, []);

  return (
    <div style={s.page}>
      <div style={s.title}>Snapshots</div>
      <div style={s.sub}>Photos from Theonyx Cafe</div>

      {logs.length === 0 && <div style={{ textAlign: 'center', color: '#c8956c', padding: '30px 0', fontSize: 13 }}>No snapshots yet.</div>}

      <div style={s.albumGrid}>
        {logs.map(log => (
          <div key={log.id} style={s.albumCell} onClick={() => setSelected(selected?.id === log.id ? null : log)}>
            <div style={{ aspectRatio: '1', overflow: 'hidden', background: '#fdf6ee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {log.thumb ? <img src={log.thumb} alt={log.tag} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 24 }}>📷</span>}
            </div>
            <div style={{ padding: '6px 8px' }}>
              <span style={s.tag}>{log.tag}</span>
              <div style={{ fontSize: 10, color: '#c8956c' }}>{log.createdAt?.toDate ? log.createdAt.toDate().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : 'Just now'}</div>
              {log.note && <div style={{ fontSize: 10, color: '#6b3a1f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.note}</div>}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setSelected(null)}>
          <div style={{ maxWidth: 400, width: '100%' }}>
            {selected.thumb && <img src={selected.thumb} alt="full" style={{ width: '100%', borderRadius: 12 }} />}
            <div style={{ color: 'white', textAlign: 'center', marginTop: 10, fontSize: 13 }}>
              <span style={{ background: 'rgba(255,255,255,0.15)', padding: '3px 12px', borderRadius: 20 }}>{selected.tag}</span>
              {selected.note && <p style={{ marginTop: 6, opacity: 0.8 }}>{selected.note}</p>}
            </div>
          </div>
        </div>
      )}
      <div style={{ height: 80 }} />
    </div>
  );
}
