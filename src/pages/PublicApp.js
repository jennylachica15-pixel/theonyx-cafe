import React, { useState } from 'react';
import { auth } from '../firebase/config';
import { signInWithEmailAndPassword } from 'firebase/auth';
import GuestLanding from './GuestLanding';
import Gallery from './Gallery';
import Snapshots from './Snapshots';

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', background: 'linear-gradient(160deg, #1a0a00 0%, #6b3a1f 70%, #c8956c 100%)', maxWidth: 480, margin: '0 auto' },
  topbar: { padding: '12px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  logoRow: { display: 'flex', alignItems: 'center', gap: 10 },
  topTitle: { fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#f0d080' },
  content: { flex: 1, overflowY: 'auto', background: 'linear-gradient(160deg, #1a0a00 0%, #6b3a1f 70%, #c8956c 100%)' },
  mainTabRow: { display: 'flex', padding: '0 16px 0', gap: 8, marginBottom: 0 },
  mainTab: (active) => ({ padding: '8px 18px', borderRadius: '10px 10px 0 0', fontSize: 13, fontWeight: active ? 700 : 400, background: active ? 'rgba(255,255,255,0.12)' : 'transparent', color: active ? '#f0d080' : 'rgba(255,255,255,0.5)', border: 'none', cursor: 'pointer' }),
  bottomNav: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: 'rgba(26,10,0,0.95)', display: 'flex', borderTop: '1px solid rgba(255,255,255,0.1)', zIndex: 100 },
  navItem: (active) => ({ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 4px 10px', cursor: 'pointer', borderTop: active ? '2px solid #d4a853' : '2px solid transparent' }),
  navIcon: { fontSize: 18, marginBottom: 2 },
  navLabel: (active) => ({ fontSize: 10, color: active ? '#f0d080' : 'rgba(255,255,255,0.4)', fontWeight: active ? 600 : 400 }),
  adminBtn: { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#f0d080', fontSize: 12, padding: '6px 12px', cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  loginCard: { background: '#fdf6ee', borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 360, animation: 'slideUp 0.3s ease' },
  loginTitle: { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#1a0a00', marginBottom: 4, textAlign: 'center' },
  loginSub: { fontSize: 12, color: '#c8956c', textAlign: 'center', marginBottom: 20, letterSpacing: 1, textTransform: 'uppercase' },
  label: { display: 'block', fontSize: 11, fontWeight: 600, color: '#6b3a1f', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e8d8c8', fontSize: 14, background: 'white', color: '#1a0a00', marginBottom: 14, outline: 'none', boxSizing: 'border-box' },
  loginBtn: { width: '100%', padding: '13px', borderRadius: 12, background: '#1a0a00', color: '#f0d080', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer', marginTop: 4 },
  cancelBtn: { width: '100%', padding: '11px', borderRadius: 12, background: 'transparent', color: '#c8956c', fontSize: 13, border: '1.5px solid #e8d8c8', cursor: 'pointer', marginTop: 8 },
  errorBox: { background: '#ffe0e0', color: '#c1121f', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 12 },
};

const GUEST_TABS = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'gallery', label: 'Gallery', icon: '🖼️' },
  { id: 'snapshots', label: 'Snapshots', icon: '📸' },
];

export default function PublicApp({ onAdminLogin, user }) {
  const [activeTab, setActiveTab] = useState('home');
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <div style={styles.container}>
      {/* Topbar */}
      <div style={styles.topbar}>
        <div style={styles.logoRow}>
          <img src="/logo.jpg" alt="logo" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '2px solid #d4a853' }} />
          <div style={styles.topTitle}>Theonyx Cafe</div>
        </div>
        <button style={styles.adminBtn} onClick={() => setShowLogin(true)}>🔐 Admin</button>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {activeTab === 'home' && <GuestLanding onTakePhoto={() => setActiveTab('gallery')} />}
        {activeTab === 'gallery' && <Gallery />}
        {activeTab === 'snapshots' && <Snapshots />}
      </div>

      {/* Bottom Nav */}
      <div style={styles.bottomNav}>
        {GUEST_TABS.map(tab => (
          <div key={tab.id} style={styles.navItem(activeTab === tab.id)} onClick={() => setActiveTab(tab.id)}>
            <span style={styles.navIcon}>{tab.icon}</span>
            <span style={styles.navLabel(activeTab === tab.id)}>{tab.label}</span>
          </div>
        ))}
      </div>

      {/* Admin Login Modal */}
      {showLogin && (
        <div style={styles.overlay} onClick={() => setShowLogin(false)}>
          <div style={styles.loginCard} onClick={e => e.stopPropagation()}>
            <img src="/logo.jpg" alt="logo" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', border: '2px solid #d4a853', display: 'block', margin: '0 auto 12px' }} />
            <div style={styles.loginTitle}>Admin Login</div>
            <div style={styles.loginSub}>Theonyx Cafe Staff</div>
            {error && <div style={styles.errorBox}>{error}</div>}
            <form onSubmit={handleLogin}>
              <label style={styles.label}>Email</label>
              <input style={styles.input} type="email" placeholder="you@theonyxcafe.com" value={email} onChange={e => setEmail(e.target.value)} required />
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
