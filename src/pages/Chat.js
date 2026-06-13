import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase/config';
import {
  collection, doc, setDoc, addDoc, getDocs, deleteDoc, query, orderBy, limit,
  where, onSnapshot, serverTimestamp, updateDoc, increment,
} from 'firebase/firestore';
// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:          '#fff9f5',
  bgAlt:       '#fdf4ee',
  white:       '#ffffff',
  border:      '#f0e0d0',
  borderLight: '#faeade',
  myBubble:    '#a0522d',
  theirBubble: '#f0e6da',
  myText:      '#ffffff',
  theirText:   '#2c1300',
  primary:     '#a0522d',
  primaryDim:  '#c8956c',
  muted:       '#b07a50',
  mutedLight:  '#d4b090',
  gold:        '#c8943a',
  admin:       '#b8860b',
  adminBubble: '#fdf5e0',
  adminBorder: '#e8c840',
  danger:      '#e05050',
  shadow:      'rgba(100,50,0,0.08)',
};
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const S = {
  wrap:    { height: '100%', background: C.bg, color: C.theirText, fontFamily: FONT, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header:  { background: C.white, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${C.border}`, flexShrink: 0 },
  backBtn: { background: 'none', border: 'none', color: C.primary, padding: '6px 8px', borderRadius: 8, fontSize: 22, cursor: 'pointer', lineHeight: 1, fontFamily: FONT },
  title:   { color: '#1a0800', fontWeight: 700, fontSize: 16, flex: 1, letterSpacing: 0.2 },
  tabs: { display: 'flex', background: C.white, borderBottom: `1px solid ${C.border}`, flexShrink: 0 },
  tab:  (active) => ({
    flex: 1, padding: '13px 0', border: 'none', background: 'none',
    color: active ? C.primary : C.muted, fontSize: 13, fontWeight: active ? 700 : 400,
    cursor: 'pointer', fontFamily: FONT,
    borderBottom: `2px solid ${active ? C.primary : 'transparent'}`,
    transition: 'all 0.15s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
  }),
  // little red counter badge for unread messages on a tab
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, background: C.danger, color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' },
  msgList:  { flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 6, background: C.bg },
  dateChip: { alignSelf: 'center', background: C.border, color: C.muted, fontSize: 11, borderRadius: 20, padding: '3px 12px', margin: '6px 0', fontWeight: 500 },
  bubble: (mine) => ({
    maxWidth: '74%',
    alignSelf: mine ? 'flex-end' : 'flex-start',
    background: mine ? C.myBubble : C.theirBubble,
    borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
    padding: '9px 13px',
    boxShadow: `0 1px 3px ${C.shadow}`,
  }),
  adminBubble: {
    background: C.adminBubble,
    border: `1.5px solid ${C.adminBorder}`,
    borderRadius: '18px 18px 18px 4px',
    animation: 'adminGlow 2.2s ease-in-out infinite alternate',
  },
  msgName:    { fontSize: 11, color: C.primaryDim, fontWeight: 700, marginBottom: 3 },
  adminName:  { color: C.admin, fontSize: 11, fontWeight: 700, marginBottom: 3 },
  msgTextMine:   { fontSize: 14, lineHeight: 1.45, wordBreak: 'break-word', color: C.myText },
  msgTextTheirs: { fontSize: 14, lineHeight: 1.45, wordBreak: 'break-word', color: C.theirText },
  msgTime:    { fontSize: 10, marginTop: 5, opacity: 0.6, textAlign: 'right' },
  delBtn:     { background: 'none', border: 'none', color: C.danger, fontSize: 10, cursor: 'pointer', padding: '3px 0 0', fontFamily: FONT, textDecoration: 'underline', opacity: 0.75 },
  inputWrap: { background: C.white, borderTop: `1px solid ${C.border}`, position: 'sticky', bottom: 0, flexShrink: 0 },
  inputRow:  { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' },
  input:     { flex: 1, background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 24, padding: '10px 16px', color: '#1a0800', fontSize: 14, fontFamily: FONT, outline: 'none' },
  sendBtn:   { background: C.primary, color: '#fff', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontSize: 18, transition: 'background 0.15s' },
  mentionDropdown: { background: C.white, borderTop: `1px solid ${C.border}`, boxShadow: `0 -6px 20px ${C.shadow}`, borderRadius: '14px 14px 0 0', maxHeight: 180, overflowY: 'auto' },
  mentionItem:     { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderBottom: `1px solid ${C.borderLight}` },
  mentionAvatar:   { width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${C.primaryDim}, ${C.primary})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 },
  listScroll:    { flex: 1, overflowY: 'auto', background: C.bg },
  sectionLabel:  { fontSize: 11, color: C.muted, letterSpacing: 1.5, textTransform: 'uppercase', padding: '14px 16px 6px', background: C.bg, fontWeight: 700 },
  row:           { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: C.white, borderBottom: `1px solid ${C.borderLight}`, cursor: 'pointer' },
  rowDisabled:   { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: C.white, borderBottom: `1px solid ${C.borderLight}`, opacity: 0.4 },
  avatar:        { width: 46, height: 46, borderRadius: '50%', background: `linear-gradient(135deg, ${C.primaryDim}, ${C.primary})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0 },
  adminAvatar:   { background: `linear-gradient(135deg, #e8c840, #c8a000)`, border: `2px solid ${C.adminBorder}`, animation: 'adminGlow 2.2s ease-in-out infinite alternate' },
  rowName:       { fontSize: 14, fontWeight: 600, color: '#1a0800' },
  adminRowName:  { fontSize: 14, fontWeight: 700, color: C.admin },
  rowSub:        { fontSize: 12, color: C.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 },
  empty:         { textAlign: 'center', color: C.mutedLight, fontSize: 13, padding: 48, lineHeight: 1.6 },
  dmBadge:       { minWidth: 20, height: 20, borderRadius: 10, background: '#a0522d', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', flexShrink: 0 },
  dmDot:         { width: 10, height: 10, borderRadius: '50%', background: '#a0522d', flexShrink: 0 },
  // DM profile card (shown at top of a DM thread)
  dmCard:     { background: C.white, borderBottom: `1px solid ${C.border}`, padding: '18px 16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  dmCardAvatar: { width: 56, height: 56, borderRadius: '50%', background: `linear-gradient(135deg, ${C.primaryDim}, ${C.primary})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 24 },
  dmCardName:   { fontSize: 15, fontWeight: 700, color: '#1a0800' },
  dmCardSub:    { fontSize: 12, color: C.muted },
};
const GlowStyles = (
  <style>{`
    @keyframes adminGlow {
      from { box-shadow: 0 0 4px rgba(200,164,0,0.3) }
      to   { box-shadow: 0 0 14px rgba(200,164,0,0.7) }
    }
    .mention-row:active { background: ${C.bgAlt} !important; }
    .chat-row:active    { background: ${C.bgAlt} !important; }
  `}</style>
);
// ── helpers ───────────────────────────────────────────────────────────────────
const nameOf    = (u) => u?.displayName || (u?.email ? u.email.split('@')[0] : 'Guest');
const initialOf = (n) => (n || '?').charAt(0).toUpperCase();
const threadIdFor = (a, b) => [a, b].sort().join('_');
const fmtTime   = (ts) => {
  if (!ts?.toDate) return '';
  return ts.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

// ── notify @mentions ──────────────────────────────────────────────────────────
async function notifyMentions(text, fromUid, fromName, chatType, threadId, allUsers) {
  const matches = [...text.matchAll(/@(\S+)/g)];
  if (!matches.length) return;
  const mentioned = [...new Set(matches.map(m => m[1].toLowerCase()))];
  for (const name of mentioned) {
    const target = allUsers.find(u => u.name?.toLowerCase() === name && u.uid !== fromUid);
    if (!target) continue;
    try {
      await addDoc(collection(db, 'notifications'), {
        recipientUid: target.uid, fromUid, fromName,
        text: text.slice(0, 120), chatType,
        threadId: threadId || null, read: false,
        createdAt: serverTimestamp(),
      });
    } catch (_) {}
  }
}
// ── @mention text renderer ────────────────────────────────────────────────────
function MentionText({ text, myName, mine }) {
  const parts = (text || '').split(/(@\S+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          const isMe = myName && part.slice(1).toLowerCase() === myName.toLowerCase();
          return (
            <span key={i} style={{
              fontWeight: 700,
              color: mine ? 'rgba(255,230,180,0.95)' : C.primary,
              background: isMe ? (mine ? 'rgba(255,255,255,0.18)' : 'rgba(160,82,45,0.12)') : 'transparent',
              borderRadius: 4,
              padding: isMe ? '0 3px' : 0,
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
      {messages.length === 0 && (
        <div style={S.empty}>No messages yet ☕<br /><span style={{ fontSize: 12 }}>Say hello!</span></div>
      )}
      {messages.map((m) => {
        const mine  = m.uid === uid;
        const isAdm = !!m.admin;
        return (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
            {!mine && (
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 3, marginLeft: 4, fontWeight: 600 }}>
                {isAdm ? '⭐ ' : ''}{m.name}
              </div>
            )}
            <div style={{ ...S.bubble(mine), ...(isAdm && !mine ? S.adminBubble : {}) }}>
              <div style={mine ? S.msgTextMine : S.msgTextTheirs}>
                <MentionText text={m.text} myName={myName} mine={mine} />
              </div>
              <div style={{ ...S.msgTime, color: mine ? 'rgba(255,255,255,0.6)' : C.mutedLight }}>
                {fmtTime(m.createdAt)}
                {onDelete && (
                  <button style={{ ...S.delBtn, marginLeft: 8, color: 'rgba(200,80,80,0.7)' }} onClick={() => onDelete(m)}>
                    delete
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
// ── input bar with @mention autocomplete ─────────────────────────────────────
function InputBar({ onSend, chatUsers, myName }) {
  const [text, setText]               = useState('');
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionStart, setMentionStart] = useState(-1);
  const inputRef = useRef(null);
  const onChange = (e) => {
    const val = e.target.value;
    setText(val);
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const match  = before.match(/@(\w*)$/);
    if (match) { setMentionQuery(match[1].toLowerCase()); setMentionStart(before.lastIndexOf('@')); }
    else        { setMentionQuery(null); }
  };
  const selectMention = (name) => {
    const before  = text.slice(0, mentionStart);
    const after   = text.slice(mentionStart + 1 + (mentionQuery?.length || 0));
    setText(`${before}@${name} ${after}`);
    setMentionQuery(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  const filtered = mentionQuery !== null
    ? (chatUsers || []).filter(u => u.name?.toLowerCase().startsWith(mentionQuery) && u.name !== myName).slice(0, 5)
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
              className="mention-row"
              style={S.mentionItem}
              onMouseDown={e => { e.preventDefault(); selectMention(u.name); }}
              onTouchEnd={e => { e.preventDefault(); selectMention(u.name); }}
            >
              <div style={{ ...S.mentionAvatar, ...(u.isAdmin ? S.adminAvatar : {}) }}>
                {initialOf(u.name)}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: u.isAdmin ? C.admin : '#1a0800' }}>
                  @{u.name}{u.isAdmin && ' ⭐'}
                </div>
                {u.isAdmin && <div style={{ fontSize: 11, color: C.muted }}>Cafe staff</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={S.inputRow}>
        <input
          ref={inputRef}
          style={S.input}
          value={text}
          placeholder="Message… type @ to mention"
          maxLength={1000}
          onChange={onChange}
          onKeyDown={e => {
            if (e.key === 'Enter')  send();
            if (e.key === 'Escape') setMentionQuery(null);
          }}
        />
        <button style={S.sendBtn} onClick={send} aria-label="Send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
// ── main Chat component ───────────────────────────────────────────────────────
export default function Chat({ user, adminMode }) {
  const [tab, setTab]         = useState('global');
  const [globalMsgs, setGlobalMsgs] = useState([]);
  const [threads, setThreads] = useState([]);
  const [people, setPeople]   = useState([]);
  const [activeDM, setActiveDM] = useState(null);
  const [dmMsgs, setDmMsgs]   = useState([]);
  const [globalUnread, setGlobalUnread] = useState(0);   // unread count for Global tab
  const uid     = user.uid;
  const isAdmin = !!adminMode;
  const myName  = isAdmin ? 'THEONYX ADMIN' : nameOf(user);

  // Keep "current view" in refs so the live listeners below don't have to
  // re-subscribe every time you switch tabs / open a DM.
  const tabRef = useRef(tab);
  useEffect(() => { tabRef.current = tab; }, [tab]);
  const activeDMRef = useRef(activeDM);
  useEffect(() => { activeDMRef.current = activeDM; }, [activeDM]);

  // register in user directory
  useEffect(() => {
    setDoc(doc(db, 'chatUsers', uid), {
      name: myName, email: user.email || '', isAdmin, lastSeen: serverTimestamp(),
    }, { merge: true });
  }, [uid, myName, isAdmin, user.email]);
  // mark unread notifications as read when chat opens
  useEffect(() => {
    if (!uid) return;
    getDocs(query(collection(db, 'notifications'), where('recipientUid', '==', uid)))
      .then(snap => snap.docs.filter(d => !d.data().read).forEach(d =>
        updateDoc(doc(db, 'notifications', d.id), { read: true }).catch(() => {})
      ))
      .catch(() => {});
  }, [uid]);
  // global chat live (+ count unread when you're not on the Global tab)
  const globalInit = useRef(false);
  useEffect(() => {
    globalInit.current = false; // reset guard if uid changes
    const q = query(collection(db, 'globalChat'), orderBy('createdAt', 'desc'), limit(100));
    return onSnapshot(q, snap => {
      setGlobalMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse());
      // Skip the very first snapshot (initial load = not "new" messages).
      if (!globalInit.current) { globalInit.current = true; return; }
      snap.docChanges().forEach(ch => {
        if (ch.type !== 'added') return;
        const m = ch.doc.data();
        if (m.uid === uid) return;                       // ignore my own messages
        const viewing = tabRef.current === 'global'
          && !activeDMRef.current
          && document.visibilityState === 'visible';
        if (!viewing) {
          setGlobalUnread(c => c + 1);
        }
      });
    });
  }, [uid]);
  // clear the Global unread counter whenever you actually look at that tab
  useEffect(() => {
    if (tab === 'global' && !activeDM) setGlobalUnread(0);
  }, [tab, activeDM]);
  // DM threads (live)
  useEffect(() => {
    const q = query(collection(db, 'dms'), where('participants', 'array-contains', uid));
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // unread conversations float to the very top; within each group, newest first
      list.sort((a, b) => {
        const ua = (a.unreadFor?.[uid] || 0) > 0 ? 1 : 0;
        const ub = (b.unreadFor?.[uid] || 0) > 0 ? 1 : 0;
        if (ua !== ub) return ub - ua;
        return (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0);
      });
      setThreads(list);
    });
  }, [uid]);
  // user directory
  useEffect(() => {
    return onSnapshot(collection(db, 'chatUsers'), snap =>
      setPeople(
        snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(p => p.uid !== uid && ((p.email || '').endsWith('@theonyxcafe.games') || p.isAdmin === true))
      )
    );
  }, [uid]);
  // total unread DMs across all threads (used for the Messages tab badge + title)
  const dmUnreadTotal = threads.reduce((s, t) => s + (t.unreadFor?.[uid] || 0), 0);

  // unread count keyed by the *other* person's uid — lets the People list show
  // bold + a dot for anyone who has unread messages waiting for you.
  const unreadByUser = {};
  threads.forEach(t => {
    const other = (t.participants || []).find(p => p !== uid);
    if (other) unreadByUser[other] = t.unreadFor?.[uid] || 0;
  });
  // People with unread messages float to the top of the People list.
  const sortedPeople = [...people].sort(
    (a, b) => (unreadByUser[b.uid] || 0) - (unreadByUser[a.uid] || 0)
  );

  // tab title flash: prefix "(N)" while there are unread messages
  const baseTitle = useRef(typeof document !== 'undefined' ? document.title : '');
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const total = globalUnread + dmUnreadTotal;
    document.title = total > 0 ? `(${total}) ${baseTitle.current}` : baseTitle.current;
    return () => { document.title = baseTitle.current; };
  }, [globalUnread, dmUnreadTotal]);

  // DM messages
  useEffect(() => {
    if (!activeDM) return;
    const q = query(collection(db, 'dms', activeDM.id, 'messages'), orderBy('createdAt', 'asc'), limit(200));
    return onSnapshot(q, snap => setDmMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [activeDM]);
  const deleteGlobalMsg = useCallback((m) => {
    if (window.confirm(`Delete this message?\n\n"${(m.text || '').slice(0, 80)}"`))
      deleteDoc(doc(db, 'globalChat', m.id)).catch(() => {});
  }, []);
  const sendGlobal = useCallback(async (text) => {
    try {
      await addDoc(collection(db, 'globalChat'), { uid, name: myName, text, admin: isAdmin, createdAt: serverTimestamp() });
      await notifyMentions(text, uid, myName, 'global', null, people);
    } catch (e) {
      console.error('[Chat] sendGlobal failed:', e);
    }
  }, [uid, myName, isAdmin, people]);
  const sendDM = useCallback(async (text) => {
    if (!activeDM) return;
    const otherUid = activeDM.id.split('_').find(p => p !== uid);
    try {
      await addDoc(collection(db, 'dms', activeDM.id, 'messages'), { uid, name: myName, text, admin: isAdmin, createdAt: serverTimestamp() });
      // setDoc creates/updates thread metadata
      await setDoc(doc(db, 'dms', activeDM.id), {
        participants: activeDM.id.split('_'),
        names: { ...(activeDM.names || {}), [uid]: myName },
        lastMessage: text, lastSender: uid, updatedAt: serverTimestamp(),
      }, { merge: true });
      // updateDoc uses dotted key as a true nested field path (setDoc does not)
      await updateDoc(doc(db, 'dms', activeDM.id), { [`unreadFor.${otherUid}`]: increment(1) });
      await notifyMentions(text, uid, myName, 'dm', activeDM.id, people);
    } catch (e) {
      // Surface the real reason (very often Firestore security rules).
      console.error('[Chat] sendDM failed:', e);
    }
  }, [activeDM, uid, myName, isAdmin, people]);
  const openDM = (otherUid, otherName, names) => {
    setDmMsgs([]);
    const tId = threadIdFor(uid, otherUid);
    setActiveDM({ id: tId, otherName, names: names || { [uid]: myName, [otherUid]: otherName } });
    // clear unread count for this user (ignore "not-found" before any message exists)
    updateDoc(doc(db, 'dms', tId), { [`unreadFor.${uid}`]: 0 })
      .catch(e => { if (e?.code !== 'not-found') console.error('[Chat] clear unread failed:', e); });
  };
  // ── DM thread view ──────────────────────────────────────────────────────────
  if (activeDM) {
    return (
      <div style={S.wrap}>
        {GlowStyles}
        <div style={S.header}>
          <button style={S.backBtn} onClick={() => setActiveDM(null)}>‹</button>
          <div style={{ ...S.avatar, width: 34, height: 34, fontSize: 14 }}>{initialOf(activeDM.otherName)}</div>
          <div style={S.title}>{activeDM.otherName}</div>
        </div>
        {/* small profile card */}
        <div style={S.dmCard}>
          <div style={S.dmCardAvatar}>{initialOf(activeDM.otherName)}</div>
          <div style={S.dmCardName}>{activeDM.otherName}</div>
          <div style={S.dmCardSub}>Theonyx Cafe member</div>
        </div>
        <MessageThread messages={dmMsgs} uid={uid} myName={myName} />
        <InputBar onSend={sendDM} chatUsers={people} myName={myName} />
      </div>
    );
  }
  // ── main view ───────────────────────────────────────────────────────────────
  return (
    <div style={S.wrap}>
      {GlowStyles}
      {/* tabs */}
      <div style={S.tabs}>
        <button style={S.tab(tab === 'global')} onClick={() => setTab('global')}>
          Global Chat
          {globalUnread > 0 && <span style={S.tabBadge}>{globalUnread > 99 ? '99+' : globalUnread}</span>}
        </button>
        <button style={S.tab(tab === 'dms')}    onClick={() => setTab('dms')}>
          Messages
          {dmUnreadTotal > 0 && <span style={S.tabBadge}>{dmUnreadTotal > 99 ? '99+' : dmUnreadTotal}</span>}
        </button>
      </div>
      {/* global chat */}
      {tab === 'global' && (
        <>
          <MessageThread
            messages={globalMsgs}
            uid={uid}
            myName={myName}
            onDelete={isAdmin ? deleteGlobalMsg : undefined}
          />
          <InputBar onSend={sendGlobal} chatUsers={people} myName={myName} />
        </>
      )}
      {/* messages / people */}
      {tab === 'dms' && (
        <div style={S.listScroll}>
          {threads.length > 0 && <div style={S.sectionLabel}>Conversations</div>}
          {threads.map(t => {
            const otherUid  = (t.participants || []).find(p => p !== uid);
            const otherName = t.names?.[otherUid] || 'Guest';
            const unread    = t.unreadFor?.[uid] || 0;
            const hasUnread = unread > 0;
            return (
              <div key={t.id} className="chat-row" style={S.row} onClick={() => openDM(otherUid, otherName, t.names)}>
                <div style={S.avatar}>{initialOf(otherName)}</div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ ...S.rowName, fontWeight: hasUnread ? 700 : 600, color: hasUnread ? '#1a0800' : '#3a2010' }}>
                    {otherName}
                  </div>
                  <div style={{ ...S.rowSub, color: hasUnread ? '#1a0800' : C.muted, fontWeight: hasUnread ? 700 : 400 }}>
                    {t.lastSender === uid ? 'You: ' : ''}{t.lastMessage}
                  </div>
                </div>
                {hasUnread && (
                  unread === 1
                    ? <div style={S.dmDot} />
                    : <div style={S.dmBadge}>{unread > 99 ? '99+' : unread}</div>
                )}
              </div>
            );
          })}
          <div style={S.sectionLabel}>People</div>
          {people.length === 0 && <div style={S.empty}>No one else is here yet ☕</div>}
          {sortedPeople.map(p => {
            const unread    = unreadByUser[p.uid] || 0;
            const hasUnread = unread > 0;
            return (
              <div key={p.uid} className="chat-row" style={S.row} onClick={() => openDM(p.uid, p.name)}>
                <div style={{ ...S.avatar, ...(p.isAdmin ? S.adminAvatar : {}) }}>
                  {initialOf(p.name)}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{
                    ...(p.isAdmin ? S.adminRowName : S.rowName),
                    fontWeight: hasUnread ? 800 : (p.isAdmin ? 700 : 600),
                    color: hasUnread ? '#1a0800' : undefined,
                  }}>
                    {p.isAdmin ? '⭐ ' : ''}{p.name}
                  </div>
                  <div style={{ ...S.rowSub, color: hasUnread ? '#1a0800' : C.muted, fontWeight: hasUnread ? 700 : 400 }}>
                    {hasUnread
                      ? `${unread} new message${unread > 1 ? 's' : ''}`
                      : (p.isAdmin ? 'Cafe staff · tap to message' : 'Tap to message')}
                  </div>
                </div>
                {hasUnread && (
                  unread === 1
                    ? <div style={S.dmDot} />
                    : <div style={S.dmBadge}>{unread > 99 ? '99+' : unread}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
