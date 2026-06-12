import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase/config';
import {
  collection, doc, setDoc, addDoc, getDocs, deleteDoc, query, orderBy, limit,
  where, onSnapshot, serverTimestamp, updateDoc,
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
  delBtn: { background: 'none', border: 'none', color: '#ff6b6b', fontSize: 10, cursor: 'pointer', padding: '2px 0 0', fontFamily: 'inherit', textDecoration: 'underline' },
  adminBubble: { borderColor: '#ffd700', animation: 'adminGlow 2.2s ease-in-out infinite alternate' },
  adminAvatar: { borderColor: '#ffd700', animation: 'adminGlow 2.2s ease-in-out infinite alternate' },
  adminName: { color: '#ffd700', textShadow: '0 0 8px rgba(255,215,0,0.7)' },
  inputWrap: { background: '#140800', borderTop: '1px solid #2c1600', position: 'sticky', bottom: 0 },
  inputBar: { display: 'flex', gap: 8, padding: 12 },
  input: { flex: 1, background: '#0a0400', border: '1px solid #6b3a1f', borderRadius: 20, padding: '10px 16px', color: '#f5e6d0', fontSize: 14, fontFamily: 'inherit', outline: 'none' },
  sendBtn: { background: 'linear-gradient(180deg, #ffd98a 0%, #d4a853 100%)', color: '#1a0800', border: 'none', borderRadius: 20, padding: '0 20px', fontWeight: 'bold', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #1e0e00', cursor: 'pointer' },
  avatar: { width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(160deg, #6b3a1f, #3d1500)', border: '2px solid #d4a853', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffd98a', fontWeight: 'bold', fontSize: 16, flexShrink: 0 },
  rowName: { fontSize: 14, fontWeight: 'bold', color: '#f5e6d0' },
  rowSub: { fontSize: 12, color: '#a07850', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 },
  sectionLabel: { fontSize: 11, color: '#c87a30', letterSpacing: 2, textTransform: 'uppercase', padding: '14px 16px 6px' },
  empty: { textAlign: 'center', color: '#a07850', fontSize: 13, padding: 40 },
  // @mention dropdown
  mentionDropdown: { background: 'linear-gradient(180deg, #2c1200, #1e0800)', border: '1px solid #6b3a1f', borderBottom: 'none', borderRadius: '12px 12px 0 0', overflow: 'hidden', maxHeight: 200, overflowY: 'auto' },
  mentionItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid #1e0800' },
  mentionAvatar: { width: 28, height: 28, borderRadius: '50%', background: '#3d1500', border: '1.5px solid #6b3a1f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold', color: '#d4a853', flexShrink: 0 },
};

const GlowStyles = (
  <style>{`
    @keyframes adminGlow { from { box-shadow: 0 0 5px rgba(255,215,0,0.25) } to { box-shadow: 0 0 16px rgba(255,215,0,0.65) } }
    .mention-item:hover { background: rgba(107,58,31,0.4) !important; }
  `}</style>
);

// ── helpers ───────────────────────────────────────────────────────────────────
const nameOf = (u) => u?.displayName || (u?.email ? u.email.split('@')[0] : 'Guest');
const initialOf = (n) => (n || '?').charAt(0).toUpperCase();
const threadIdFor = (a, b) => [a, b].sort().join('_');
const fmtTime = (ts) => {
  if (!ts?.toDate) return '';
  return ts.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

// ── create notifications for @mentions ────────────────────────────────────────
async function notifyMentions(text, fromUid, fromName, chatType, threadId, allUsers) {
  const matches = [...text.matchAll(/@(\S+)/g)];
  if (!matches.length) return;
  const mentioned = [...new Set(matches.map(m => m[1].toLowerCase()))];
  for (const name of mentioned) {
    const target = allUsers.find(u => u.name?.toLowerCase() === name && u.uid !== fromUid);
    if (!target) continue;
    try {
      await addDoc(collection(db, 'notifications'), {
        recipientUid: target.uid,
        fromUid,
        fromName,
        text: text.slice(0, 120),
        chatType,
        threadId: threadId || null,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (_) {}
  }
}

// ── render text with @mention highlights ──────────────────────────────────────
function MentionText({ text, myName }) {
  const parts = (text || '').split(/(@\S+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          const isMe = myName && part.slice(1).toLowerCase() === myName.toLowerCase();
          return (
            <span key={i} style={{
              color: '#ffd700',
              fontWeight: 'bold',
              background: isMe ? 'rgba(255,215,0,0.18)' : 'transparent',
              borderRadius: 3,
              padding: isMe ? '1px 4px' : 0,
            }}>{part}</span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── message thread ────────────────────────────────────────────────────────────
function MessageThread({ messages, uid, myName, onDelete }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  return (
    <div style={S.msgList}>
      {messages.length === 0 && <div style={S.empty}>No messages yet — say hello! ☕</div>}
      {messages.map((m) => {
        const mine = m.uid === uid;
        return (
          <div key={m.id} style={{ ...S.bubble(mine), ...(m.admin ? S.adminBubble : {}) }}>
            {!mine && (
              <div style={{ ...S.msgName, ...(m.admin ? S.adminName : {}) }}>
                {m.admin ? '⭐ ' : ''}{m.name}
              </div>
            )}
            <div style={S.msgText}>
              <MentionText text={m.text} myName={myName} />
            </div>
            <div style={S.msgTime}>{fmtTime(m.createdAt)}</div>
            {onDelete && (
              <button style={S.delBtn} onClick={() => onDelete(m)}>Delete message</button>
            )}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

// ── input bar with @mention autocomplete ─────────────────────────────────────
function InputBar({ onSend, chatUsers, myName }) {
  const [text, setText] = useState('');
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionStart, setMentionStart] = useState(-1);
  const inputRef = useRef(null);

  const onChange = (e) => {
    const val = e.target.value;
    setText(val);
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const match = before.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1].toLowerCase());
      setMentionStart(before.lastIndexOf('@'));
    } else {
      setMentionQuery(null);
    }
  };

  const selectMention = (name) => {
    const before = text.slice(0, mentionStart);
    const after = text.slice(mentionStart + 1 + (mentionQuery?.length || 0));
    setText(`${before}@${name} ${after}`);
    setMentionQuery(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const filtered = mentionQuery !== null
    ? (chatUsers || []).filter(u =>
        u.name?.toLowerCase().startsWith(mentionQuery) &&
        u.name !== myName
      ).slice(0, 5)
    : [];

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
    setMentionQuery(null);
  };

  return (
    <div style={S.inputWrap}>
      {mentionQuery !== null && filtered.length > 0 && (
        <div style={S.mentionDropdown}>
          {filtered.map(u => (
            <div
              key={u.uid}
              className="mention-item"
              style={S.mentionItem}
              onMouseDown={e => { e.preventDefault(); selectMention(u.name); }}
              onTouchEnd={e => { e.preventDefault(); selectMention(u.name); }}
            >
              <div style={{ ...S.mentionAvatar, ...(u.isAdmin ? S.adminAvatar : {}) }}>
                {initialOf(u.name)}
              </div>
              <span style={{ color: '#ffd700', fontWeight: 'bold', fontSize: 13 }}>
                @{u.name}
              </span>
              {u.isAdmin && <span style={{ fontSize: 10, color: '#d4a853', marginLeft: 2 }}>⭐ Staff</span>}
            </div>
          ))}
        </div>
      )}
      <div style={S.inputBar}>
        <input
          ref={inputRef}
          style={S.input}
          value={text}
          placeholder="Message… type @ to mention"
          maxLength={1000}
          onChange={onChange}
          onKeyDown={e => {
            if (e.key === 'Enter') send();
            if (e.key === 'Escape') setMentionQuery(null);
          }}
        />
        <button style={S.sendBtn} onClick={send}>Send</button>
      </div>
    </div>
  );
}

// ── main chat component ───────────────────────────────────────────────────────
export default function Chat({ user, adminMode }) {
  const [tab, setTab] = useState('global');
  const [globalMsgs, setGlobalMsgs] = useState([]);
  const [threads, setThreads] = useState([]);
  const [people, setPeople] = useState([]);
  const [activeDM, setActiveDM] = useState(null);
  const [dmMsgs, setDmMsgs] = useState([]);
  const uid = user.uid;
  const isAdmin = !!adminMode;
  const myName = isAdmin ? 'THEONYX ADMIN' : nameOf(user);

  // register myself in user directory
  useEffect(() => {
    setDoc(doc(db, 'chatUsers', uid), {
      name: myName, email: user.email || '', isAdmin, lastSeen: serverTimestamp(),
    }, { merge: true });
  }, [uid, myName, isAdmin, user.email]);

  // mark all my unread notifications as read when chat opens
  useEffect(() => {
    if (!uid) return;
    getDocs(query(collection(db, 'notifications'), where('recipientUid', '==', uid)))
      .then(snap => {
        snap.docs
          .filter(d => !d.data().read)
          .forEach(d => updateDoc(doc(db, 'notifications', d.id), { read: true }).catch(() => {}));
      })
      .catch(() => {});
  }, [uid]);

  // global chat (last 100, live)
  useEffect(() => {
    const q = query(collection(db, 'globalChat'), orderBy('createdAt', 'desc'), limit(100));
    return onSnapshot(q, (snap) => {
      setGlobalMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse());
    });
  }, []);

  // my DM threads
  useEffect(() => {
    const q = query(collection(db, 'dms'), where('participants', 'array-contains', uid));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      setThreads(list);
    });
  }, [uid]);

  // user directory
  useEffect(() => {
    return onSnapshot(collection(db, 'chatUsers'), (snap) => {
      setPeople(
        snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(p => p.uid !== uid && ((p.email || '').endsWith('@theonyxcafe.games') || p.isAdmin === true))
      );
    });
  }, [uid]);

  // legacy game players not yet in chat
  const [legacyNames, setLegacyNames] = useState([]);
  useEffect(() => {
    getDocs(collection(db, 'gameUsers'))
      .then(snap => setLegacyNames(snap.docs.map(d => d.data().username).filter(Boolean)))
      .catch(() => {});
  }, []);
  const inChat = new Set(people.map(p => (p.name || '').toLowerCase()));
  const pendingPlayers = legacyNames.filter(
    n => !inChat.has(n.toLowerCase()) && n.toLowerCase() !== myName.toLowerCase()
  );

  // messages of the open DM
  useEffect(() => {
    if (!activeDM) return;
    const q = query(collection(db, 'dms', activeDM.id, 'messages'), orderBy('createdAt', 'asc'), limit(200));
    return onSnapshot(q, snap => {
      setDmMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [activeDM]);

  const deleteGlobalMsg = useCallback((m) => {
    if (window.confirm(`Delete this message for everyone?\n\n"${(m.text || '').slice(0, 80)}"`)) {
      deleteDoc(doc(db, 'globalChat', m.id)).catch(() => {});
    }
  }, []);

  // all users for mention lookup (people + self-entry for completeness)
  const allChatUsers = people;

  const sendGlobal = useCallback(async (text) => {
    await addDoc(collection(db, 'globalChat'), {
      uid, name: myName, text, admin: isAdmin, createdAt: serverTimestamp(),
    });
    await notifyMentions(text, uid, myName, 'global', null, allChatUsers);
  }, [uid, myName, isAdmin, allChatUsers]);

  const sendDM = useCallback(async (text) => {
    if (!activeDM) return;
    await addDoc(collection(db, 'dms', activeDM.id, 'messages'), {
      uid, name: myName, text, admin: isAdmin, createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'dms', activeDM.id), {
      participants: activeDM.id.split('_'),
      names: { ...(activeDM.names || {}), [uid]: myName },
      lastMessage: text, lastSender: uid, updatedAt: serverTimestamp(),
    }, { merge: true });
    await notifyMentions(text, uid, myName, 'dm', activeDM.id, allChatUsers);
  }, [activeDM, uid, myName, isAdmin, allChatUsers]);

  const openDM = (otherUid, otherName, names) => {
    setDmMsgs([]);
    setActiveDM({
      id: threadIdFor(uid, otherUid),
      otherName,
      names: names || { [uid]: myName, [otherUid]: otherName },
    });
  };

  // ── DM conversation view ──────────────────────────────────────────────────
  if (activeDM) {
    return (
      <div style={S.wrap}>
        {GlowStyles}
        <div style={S.header}>
          <button style={S.backBtn} onClick={() => setActiveDM(null)}>‹ Back</button>
          <div style={S.avatar}>{initialOf(activeDM.otherName)}</div>
          <div style={S.title}>{activeDM.otherName}</div>
        </div>
        <MessageThread messages={dmMsgs} uid={uid} myName={myName} />
        <InputBar onSend={sendDM} chatUsers={allChatUsers} myName={myName} />
      </div>
    );
  }

  // ── main view (tabs) ──────────────────────────────────────────────────────
  return (
    <div style={S.wrap}>
      {GlowStyles}
      <div style={S.tabs}>
        <button style={S.tab(tab === 'global')} onClick={() => setTab('global')}>Global Chat</button>
        <button style={S.tab(tab === 'dms')} onClick={() => setTab('dms')}>Messages</button>
      </div>

      {tab === 'global' && (
        <>
          <MessageThread
            messages={globalMsgs}
            uid={uid}
            myName={myName}
            onDelete={isAdmin ? deleteGlobalMsg : undefined}
          />
          <InputBar onSend={sendGlobal} chatUsers={allChatUsers} myName={myName} />
        </>
      )}

      {tab === 'dms' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {threads.length > 0 && <div style={S.sectionLabel}>Conversations</div>}
          {threads.map(t => {
            const otherUid = (t.participants || []).find(p => p !== uid);
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
          {people.map(p => (
            <div key={p.uid} style={S.row} onClick={() => openDM(p.uid, p.name)}>
              <div style={{ ...S.avatar, ...(p.isAdmin ? S.adminAvatar : {}) }}>
                {initialOf(p.name)}
              </div>
              <div>
                <div style={{ ...S.rowName, ...(p.isAdmin ? S.adminName : {}) }}>
                  {p.isAdmin ? '⭐ ' : ''}{p.name}
                </div>
                <div style={S.rowSub}>{p.isAdmin ? 'Cafe staff — tap to message' : 'Tap to message'}</div>
              </div>
            </div>
          ))}

          {pendingPlayers.length > 0 && (
            <div style={S.sectionLabel}>Game players — not in chat yet</div>
          )}
          {pendingPlayers.map(n => (
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
