import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Attendance from './Attendance';
import Orders from './Orders';
import Inventory from './Inventory';
import Reports from './Reports';
import MenuManager from './MenuManager';
import Approvals from './Approvals';

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', background: 'linear-gradient(160deg, #1a0a00 0%, #6b3a1f 70%, #c8956c 100%)', maxWidth: 480, margin: '0 auto' },
  topbar: { padding: '10px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'rgba(0,0,0,0.3)' },
  topTitle: { fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#f0d080' },
  roleBadge: { fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.12)', color: '#f0d080', marginTop: 2, display: 'inline-block' },
  logoutBtn: { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: 12, padding: '6px 12px', cursor: 'pointer' },
  content: { flex: 1, overflowY: 'auto', paddingBottom: 70, background: 'rgba(253,246,238,0.95)', borderRadius: '16px 16px 0 0', marginTop: 4 },
  bottomNav: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: 'rgba(26,10,0,0.97)', display: 'flex', borderTop: '1px solid rgba(255,255,255,0.1)', zIndex: 100, overflowX: 'auto' },
  navItem: (active) => ({ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '7px 2px 9px', cursor: 'pointer', borderTop: active ? '2px solid #d4a853' : '2px solid transparent', minWidth: 50 }),
  navIcon: { fontSize: 17, marginBottom: 2 },
  navLabel: (active) => ({ fontSize: 9, color: active ? '#f0d080' : 'rgba(255,255,255,0.4)', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap' }),
};

export default function AdminApp({ user, onSignOut }) {
  const [activeTab, setActiveTab] = useState('orders');
  const [role, setRole] = useState('staff');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) { setRole(snap.data().role || 'staff'); setUserName(snap.data().name || ''); }
      } catch { setRole('staff'); }
    };
    fetchUser();
  }, [user]);

  const handleSignOut = async () => { await signOut(auth); onSignOut(); };

  const tabs = [
    { id: 'attendance', label: 'Clock In', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    { id: 'orders', label: 'Orders', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
    { id: 'inventory', label: 'Stocks', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> },
    { id: 'approvals', label: 'Approvals', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
    { id: 'reports', label: 'Reports', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
    ...(role === 'manager' ? [{ id: 'menu', label: 'Menu', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> }] : []),
  ];

  return (
    <div style={styles.container}>
      <div style={styles.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.jpg" alt="logo" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', border: '2px solid #d4a853' }} />
          <div>
            <div style={styles.topTitle}>Admin Panel</div>
            <span style={styles.roleBadge}>{role === 'manager' ? '👑 Manager' : `👤 ${userName}`}</span>
          </div>
        </div>
        <button style={styles.logoutBtn} onClick={handleSignOut}>← Exit</button>
      </div>

      <div style={styles.content}>
        {activeTab === 'attendance' && <Attendance role={role} userName={userName} />}
        {activeTab === 'orders' && <Orders userName={userName} />}
        {activeTab === 'inventory' && <Inventory />}
        {activeTab === 'approvals' && <Approvals />}
        {activeTab === 'reports' && <Reports />}
        {activeTab === 'menu' && role === 'manager' && <MenuManager />}
      </div>

      <div style={styles.bottomNav}>
        {tabs.map(tab => (
          <div key={tab.id} style={styles.navItem(activeTab === tab.id)} onClick={() => setActiveTab(tab.id)}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{tab.icon}</span>
            <span style={styles.navLabel(activeTab === tab.id)}>{tab.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
