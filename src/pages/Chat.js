import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase/config';
import {
  collection, doc, setDoc, addDoc, getDocs, query, orderBy, limit,
  where, onSnapshot, serverTimestamp,
} from 'firebase/firestore';

const S = {
  wrap: { height: '100%', background: '#0a0400', color: '#f5e6d0', fontFamily: "'Georgia', serif", display: 'flex', flexDirection: 'column' },
  header: { position: 'sticky', top: 0, zIndex: 5, background: 'linear-gradient(180deg, #3d1500 0%, #1a0800 100%)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #6b3a1f' },
  backBtn: { background: '#6b3a1f', border: 'none', color: '#d4a853', padding: '8px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  title: { color: '#d4a853', fontWeight: 'bold', fontSize: 16, letterSpacing: 1, flex: 1 },
  tabs: { display: 'flex', gap: 8, padding: '10px 16px', background: '#140800', borderBottom: '1px solid #2c1600' },
  tab: (active) => ({ flex: 1, padding: '10px 0', borderRadius: 20, border: active ? '1px solid #d4a853' : '1px solid #6b3a1f', background: active ? 'linear-gradient(180deg, #6b3a1f 0%, #3d1500 100%)' : 'transparent', color: active ? '#ffd98a' : '#c8956c', fontSize: 13, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit' }),
  msgList: { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 },
  bubble: (mine) => ({ maxWidth: '78%', alignSelf: mine ? 'flex-end' : 'flex-start', background: mine ? 'linear-gradient(160deg, #6b3a1f, #4a2410)' : 'linear-gradient(160deg, #2c1600, #1e0e00)', border: '1px solid ' + (mine ? '#a07850' : '#3d2410'), borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px', padding: '8px 12px' }),
  msgName: { fontSize: 11, color: '#d4a853', fontWeight: 'bold', marginBottom: 2 },
  msgText: { fontSize: 14, lineHeight: 1.4, wordBreak: 'break-word' },
  msgTime: { fontSize: 10, color: '#a07850', marginTop: 4, textAlign: 'right' },
  inputBar: { display: 'flex', gap: 8, padding: 12, background: '#140800', borderTop: '1px solid #2c1600', position: 'sticky', bottom: 0 },
  input: { flex: 1, background: '#0a0400', border: '1px solid #6b3a1f', borderRadius: 20, padding: '10px 16px', color: '#f5e6d0', fontSize: 14, fontFamily: 'inherit', outline: 'none' },
  sendBtn: { background: 'linear-gradient(180deg, #ffd98a 0%, #d4a853 100%)', color: '#1a0800', border: 'none', borderRadius: 20, padding: '0 20px', fontWeight: 'bold', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #1e0e00', cursor: 'pointer' },
  avatar: { width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(160deg, #6b3a1f, #3d1500)', border: '2px solid #d4a853', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffd98a', fontWeight: 'bold', fontSize: 16, flexShrink: 0 },
  rowName: { fontSize: 14, fontWeight: 'bold', color: '#f5e6d0' },
  rowSub: { fontSize: 12, color: '#a07850', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 },
  sectionLabel: { fontSize: 11, color: '#c87a30', letterSpacing: 2, textTransform: 'uppercase', padding: '14px 16px 6px' },
  empty: { textAlign: 'center', color: '#a07850', fontSize: 13, padding: 40 },
};

const nameOf = (u) => u?.displayName || (u?.email ? u.email.split('@')[0] : 'Guest');
const initialOf = (n) => (n || '?').charAt(0).toUpperCase();
const threadIdFor = (a, b) => [a, b].sort().join('_');
const fmtTime = (ts) => {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

// ---------- message thread (shared by global + DM) ----------
function MessageThread({ messages, uid }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  return (
    <div style={S.msgList}>
      {messages.length === 0 && <div style={S.empty}>No messages yet — say hello! ☕</div>}
      {messages.map((m) => {
        const mine = m.uid === uid;
        return (
          <div key={m.id} style={S.bubble(mine)}>
            {!mine && <div style={S.msgName}>{m.name}</div>}
            <div style={S.msgText}>{m.text}</div>
            <div style={S.msgTime}>{fmtTime(m.createdAt)}</div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

function InputBar({ onSend }) {
  const [text, setText] = useState('');
  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };
  return (
    <div style={S.inputBar}>
      <input
        style={S.input}
        value={text}
        placeholder="Write a message…"
        maxLength={1000}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
      />
      <button style={S.sendBtn} onClick={send}>Send</button>
    </div>
  );
}

// ---------- main chat page ----------
export default function Chat({ user }) {
  const [tab, setTab] = useState('global');          // 'global' | 'dms'
  const [globalMsgs, setGlobalMsgs] = useState([]);
  const [threads, setThreads] = useState([]);
  const [people, setPeople] = useState([]);
  const [activeDM, setActiveDM] = useState(null);    // { id, otherName }
  const [dmMsgs, setDmMsgs] = useState([]);
  const uid = user.uid;
  const myName = nameOf(user);

  // register myself in the user directory
  useEffect(() => {
    setDoc(doc(db, 'chatUsers', uid), {
      name: myName, email: user.email || '', lastSeen: serverTimestamp(),
    }, { merge: true });
  }, [uid, myName, user.email]);

  // global chat (last 100, live)
  useEffect(() => {
    const q = query(collection(db, 'globalChat'), orderBy('createdAt', 'desc'), limit(100));
    return onSnapshot(q, (snap) => {
      setGlobalMsgs(snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse());
    });
  }, []);

  // my DM threads (sorted client-side to avoid a composite index)
  useEffect(() => {
    const q = query(collection(db, 'dms'), where('participants', 'array-contains', uid));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      setThreads(list);
    });
  }, [uid]);

  // user directory
  useEffect(() => {
    return onSnapshot(collection(db, 'chatUsers'), (snap) => {
      setPeople(snap.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((p) => p.uid !== uid && (p.email || '').endsWith('@theonyxcafe.games')));
    });
  }, [uid]);

  // legacy game players (old gameUsers system) who haven't signed in
  // under the new system yet — shown as "not yet in chat"
  const [legacyNames, setLegacyNames] = useState([]);
  useEffect(() => {
    getDocs(collection(db, 'gameUsers'))
      .then((snap) => setLegacyNames(snap.docs.map((d) => d.data().username).filter(Boolean)))
      .catch(() => {});
  }, []);
  const inChat = new Set(people.map((p) => (p.name || '').toLowerCase()));
  const pendingPlayers = legacyNames.filter(
    (n) => !inChat.has(n.toLowerCase()) && n.toLowerCase() !== myName.toLowerCase()
  );

  // messages of the open DM
  useEffect(() => {
    if (!activeDM) return;
    const q = query(collection(db, 'dms', activeDM.id, 'messages'), orderBy('createdAt', 'asc'), limit(200));
    return onSnapshot(q, (snap) => {
      setDmMsgs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [activeDM]);

  const sendGlobal = useCallback((text) => {
    addDoc(collection(db, 'globalChat'), { uid, name: myName, text, createdAt: serverTimestamp() });
  }, [uid, myName]);

  const sendDM = useCallback((text) => {
    if (!activeDM) return;
    addDoc(collection(db, 'dms', activeDM.id, 'messages'),
      { uid, name: myName, text, createdAt: serverTimestamp() });
    setDoc(doc(db, 'dms', activeDM.id), {
      participants: activeDM.id.split('_'),
      names: { ...(activeDM.names || {}), [uid]: myName },
      lastMessage: text, lastSender: uid, updatedAt: serverTimestamp(),
    }, { merge: true });
  }, [activeDM, uid, myName]);

  const openDM = (otherUid, otherName, names) => {
    setDmMsgs([]);
    setActiveDM({ id: threadIdFor(uid, otherUid), otherName, names: names || { [uid]: myName, [otherUid]: otherName } });
  };

  // ---------- DM conversation view ----------
  if (activeDM) {
    return (
      <div style={S.wrap}>
        <div style={S.header}>
          <button style={S.backBtn} onClick={() => setActiveDM(null)}>‹ Back</button>
          <div style={S.avatar}>{initialOf(activeDM.otherName)}</div>
          <div style={S.title}>{activeDM.otherName}</div>
        </div>
        <MessageThread messages={dmMsgs} uid={uid} />
        <InputBar onSend={sendDM} />
      </div>
    );
  }

  // ---------- main view (tabs) ----------
  return (
    <div style={S.wrap}>
      <div style={S.tabs}>
        <button style={S.tab(tab === 'global')} onClick={() => setTab('global')}>Global Chat</button>
        <button style={S.tab(tab === 'dms')} onClick={() => setTab('dms')}>Messages</button>
      </div>

      {tab === 'global' && (
        <>
          <MessageThread messages={globalMsgs} uid={uid} />
          <InputBar onSend={sendGlobal} />
        </>
      )}

      {tab === 'dms' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {threads.length > 0 && <div style={S.sectionLabel}>Conversations</div>}
          {threads.map((t) => {
            const otherUid = (t.participants || []).find((p) => p !== uid);
            const otherName = t.names?.[otherUid] || 'Guest';
            return (
              <div key={t.id} style={S.row} onClick={() => openDM(otherUid, otherName, t.names)}>
                <div style={S.avatar}>{initialOf(otherName)}</div>
                <div>
                  <div style={S.rowName}>{otherName}</div>
                  <div style={S.rowSub}>{t.lastSender === uid ? 'You: ' : ''}{t.lastMessage}</div>
                </div>
              </div>
            );
          })}
          <div style={S.sectionLabel}>People</div>
          {people.length === 0 && <div style={S.empty}>No one else has signed in yet.</div>}
          {people.map((p) => (
            <div key={p.uid} style={S.row} onClick={() => openDM(p.uid, p.name)}>
              <div style={S.avatar}>{initialOf(p.name)}</div>
              <div>
                <div style={S.rowName}>{p.name}</div>
                <div style={S.rowSub}>Tap to message</div>
              </div>
            </div>
          ))}
          {pendingPlayers.length > 0 && <div style={S.sectionLabel}>Game players — not in chat yet</div>}
          {pendingPlayers.map((n) => (
            <div key={n} style={{ ...S.row, cursor: 'default', opacity: 0.45 }}>
              <div style={{ ...S.avatar, borderColor: '#6b3a1f', color: '#a07850' }}>{initialOf(n)}</div>
              <div>
                <div style={S.rowName}>{n}</div>
                <div style={S.rowSub}>Will appear here after their next sign-in</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
