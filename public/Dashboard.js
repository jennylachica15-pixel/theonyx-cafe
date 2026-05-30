import React, { useState } from 'react';
import { auth } from '../firebase/config';
import { signOut } from 'firebase/auth';
import Inventory from './Inventory';
import Camera from './Camera';
import Reports from './Reports';

const tabs = [
  { id: 'inventory', label: 'Inventory', icon: '📦' },
  { id: 'camera', label: 'Photos', icon: '📷' },
  { id: 'reports', label: 'Reports', icon: '📊' },
];

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--cream)', maxWidth: 480, margin: '0 auto', position: 'relative' },
  topbar: {
    padding: '16px 20px 12px',
    background: 'var(--brown-dark)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  },
  topTitle: { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--gold-light)' },
  topSub: { fontSize: 11, color: 'var(--brown-light)', marginTop: 1 },
  logoutBtn: {
    background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8,
    color: 'var(--brown-light)', fontSize: 12, padding: '6px 12px', cursor: 'pointer',
  },
  content: { flex: 1, overflowY: 'auto', paddingBottom: 70 },
  bottomNav: {
    position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
    width: '100%', maxWidth: 480,
    background: 'var(--brown-dark)', display: 'flex',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    zIndex: 100,
  },
  navItem: (active) => ({
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '10px 0 12px', cursor: 'pointer',
    borderTop: active ? '2px solid var(--gold)' : '2px solid transparent',
    transition: 'all 0.2s',
  }),
  navIcon: { fontSize: 20, marginBottom: 3 },
  navLabel: (active) => ({
    fontSize: 11, color: active ? 'var(--gold-light)' : 'var(--brown-light)',
    fontWeight: active ? 600 : 400,
  }),
};

export default function Dashboard({ user }) {
  const [activeTab, setActiveTab] = useState('inventory');

  return (
    <div style={styles.container}>
      <div style={styles.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.jpg" alt="logo" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--gold)' }} />
          <div>
            <div style={styles.topTitle}>Theonyx Cafe</div>
            <div style={styles.topSub}>{user.email}</div>
          </div>
        </div>
        <button style={styles.logoutBtn} onClick={() => signOut(auth)}>Sign out</button>
      </div>

      <div style={styles.content}>
        {activeTab === 'inventory' && <Inventory />}
        {activeTab === 'camera' && <Camera />}
        {activeTab === 'reports' && <Reports />}
      </div>

      <div style={styles.bottomNav}>
        {tabs.map(tab => (
          <div key={tab.id} style={styles.navItem(activeTab === tab.id)} onClick={() => setActiveTab(tab.id)}>
            <span style={styles.navIcon}>{tab.icon}</span>
            <span style={styles.navLabel(activeTab === tab.id)}>{tab.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
