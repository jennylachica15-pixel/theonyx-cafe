import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase/config';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import AccountAuth from './AccountAuth';
import GuestLanding from './GuestLanding';
import Gallery from './Gallery';
import Snapshots from './Snapshots';
import GamesPage from './Games';
import Chat from './Chat';
const NAV_ICONS = {
  // Menu — fork & knife (cutlery)
  home: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>,
  // Snapshots — camera
  gallery: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  // Feedback — envelope
  snapshots: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>,
  // Games — game controller
  games: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="11" x2="10" y2="11"/><line x1="8" y1="9" x2="8" y2="13"/><line x1="15" y1="12" x2="15.01" y2="12"/><line x1="18" y1="10" x2="18.01" y2="10"/><rect x="2" y="6" width="20" height="12" rx="2"/></svg>,
  // Chat — single chat bubble
  chat: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/><circle cx="8.5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="12" r="1" fill="currentColor" stroke="none"/></svg>,
};
const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', background: 'linear-gradient(160deg, #140800 0%, #3d1f0a 50%, #6b3a1f 100%)', maxWidth: 480, margin: '0 auto' },
  topbar: { padding: '10px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'rgba(61,31,10,0.55)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(212,168,83,0.18)' },
  logoRow: { display: 'flex', alignItems: 'center', gap: 10 },
  topTitle: { fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#f0d080', letterSpacing: 1.5 },
  content: { flex: 1, overflowY: 'auto' },
  bottomNav: { display: 'flex', background: 'rgba(61,31,10,0.78)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderTop: '1px solid rgba(212,168,83,0.18)', flexShrink: 0 },
  navItem: (active) => ({ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 4px 12px', cursor: 'pointer', borderTop: active ? '2px solid #d4a853' : '2px solid transparent', color: active ? '#d4a853' : 'rgba(255,255,255,0.45)', position: 'relative' }),
  navLabel: (active) => ({ fontSize: 10, fontWeight: active ? 600 : 400, marginTop: 3 }),
  adminBtn: { background: 'rgba(212,168,83,0.15)', border: '1px solid rgba(212,168,83,0.4)', borderRadius: 8, color: '#d4a853', fontSize: 12, padding: '6px 14px', cursor: 'pointer', fontWeight: 500 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  loginCard: { background: '#1a0a00', border: '1px solid rgba(212,168,83,0.3)', borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 360, animation: 'slideUp 0.3s ease' },
  loginTitle: { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#f0d080', marginBottom: 4, textAlign: 'center' },
  loginSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 20, letterSpacing: 1 },
  label: { display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(212,168,83,0.3)', fontSize: 14, background: 'rgba(255,255,255,0.06)', color: 'white', marginBottom: 14, outline: 'none', boxSizing: 'border-box' },
  loginBtn: { width: '100%', padding: '13px', borderRadius: 12, background: '#d4a853', color: '#1a0a00', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', marginTop: 4 },
  cancelBtn: { width: '100%', padding: '11px', borderRadius: 12, background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 13, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', marginTop: 8 },
  errorBox: { background: 'rgba(193,18,31,0.2)', color: '#ff6b6b', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 12, border: '1px solid rgba(193,18,31,0.3)' },
  chatGate: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  switchLink: { background: 'none', border: 'none', color: '#d4a853', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', marginTop: 12, width: '100%' },
  badge: { position: 'absolute', top: 6, right: 8, minWidth: 16, height: 16, borderRadius: 8, background: '#ff4444', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', lineHeight: 1, border: '1.5px solid rgba(61,31,10,0.9)' },
};
const TABS = [
  { id: 'home',      label: 'Menu'      },
  { id: 'gallery',   label: 'Snapshots' },
  { id: 'snapshots', label: 'Feedback'  },
  { id: 'games',     label: 'Games'     },
  { id: 'chat',      label: 'Chat'      },
];
function ChatGate({ user }) {
  // Same single account as the Games tab — signing in here unlocks both.
  if (user) return <Chat user={user} />;
  return (
    <div style={styles.chatGate}>
      <div style={{ ...styles.loginCard, animation: 'none' }}>
        <AccountAuth heading="Sign in to chat" sub="One account for Games & Chat" />
      </div>
    </div>
  );
}
export default function PublicApp({ onAdminLogin, user }) {
  const [activeTab, setActiveTab] = useState('home');
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mentionBadge, setMentionBadge] = useState(0);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  // Listen for unread @mention notifications
  useEffect(() => {
    if (!user?.uid) { setMentionBadge(0); return; }
    const q = query(collection(db, 'notifications'), where('recipientUid', '==', user.uid));
    return onSnapshot(q, snap => {
      setMentionBadge(snap.docs.filter(d => !d.data().read).length);
    });
  }, [user?.uid]);
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setShowLogin(false);
      onAdminLogin();
    } catch {
      setError('Invalid email or password.');
    }
    setLoading(false);
  };
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    if (activeTab === 'chat' || activeTab === 'games') { touchStartX.current = null; touchStartY.current = null; return; }
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      const currentIndex = TABS.findIndex(t => t.id === activeTab);
      if (dx < 0 && currentIndex < TABS.length - 1) setActiveTab(TABS[currentIndex + 1].id);
      else if (dx > 0 && currentIndex > 0) setActiveTab(TABS[currentIndex - 1].id);
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };
  return (
    <div style={styles.container}>
      <div style={styles.topbar}>
        <div style={styles.logoRow}>
          <img src="/logo.jpg" alt="logo" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid #d4a853' }} />
          <div style={styles.topTitle}>THEONYX CAFE</div>
        </div>
        <button style={styles.adminBtn} onClick={() => setShowLogin(true)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 5, verticalAlign: 'middle' }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Admin
        </button>
      </div>
      <div style={styles.content} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {activeTab === 'home'      && <GuestLanding />}
        {activeTab === 'gallery'   && <Gallery />}
        {activeTab === 'snapshots' && <Snapshots />}
        {activeTab === 'games'     && <GamesPage user={user} />}
        {activeTab === 'chat'      && <ChatGate user={user} />}
      </div>
      <div style={styles.bottomNav}>
        {TABS.map(tab => (
          <div key={tab.id} style={styles.navItem(activeTab === tab.id)} onClick={() => setActiveTab(tab.id)}>
            {NAV_ICONS[tab.id]}
            <span style={styles.navLabel(activeTab === tab.id)}>{tab.label}</span>
            {tab.id === 'chat' && mentionBadge > 0 && (
              <div style={styles.badge}>{mentionBadge > 9 ? '9+' : mentionBadge}</div>
            )}
          </div>
        ))}
      </div>
      {showLogin && (
        <div style={styles.overlay} onClick={() => setShowLogin(false)}>
          <div style={styles.loginCard} onClick={e => e.stopPropagation()}>
            <img src="/logo.jpg" alt="logo" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid #d4a853', display: 'block', margin: '0 auto 14px' }} />
            <div style={styles.loginTitle}>Admin Login</div>
            <div style={styles.loginSub}>THEONYX CAFE STAFF</div>
            {error && <div style={styles.errorBox}>{error}</div>}
            <form onSubmit={handleLogin}>
              <label style={styles.label}>Email</label>
              <input style={styles.input} type="email" placeholder="staff@theonyxcafe.com" value={email} onChange={e => setEmail(e.target.value)} required />
              <label style={styles.label}>Password</label>
              <input style={styles.input} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="submit" style={{ ...styles.loginBtn, opacity: loading ? 0.7 : 1 }} disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
            </form>
            <button style={styles.cancelBtn} onClick={() => setShowLogin(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
