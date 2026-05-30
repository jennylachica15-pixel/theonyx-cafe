import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Inventory from './Inventory';
import Camera from './Camera';
import Reports from './Reports';
import Attendance from './Attendance';
import Orders from './Orders';
import MenuManager from './MenuManager';
import GuestPhoto from './GuestPhoto';

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--cream)', maxWidth: 480, margin: '0 auto', position: 'relative' },
  topbar: { padding: '12px 16px 10px', background: 'var(--brown-dark)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  topTitle: { fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--gold-light)' },
  topSub: { fontSize: 11, color: 'var(--brown-light)', marginTop: 1 },
  roleBadge: { fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.12)', color: 'var(--gold-light)', marginTop: 2 },
  logoutBtn: { background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, color: 'var(--brown-light)', fontSize: 12, padding: '6px 12px', cursor: 'pointer' },
  content: { flex: 1, overflowY: 'auto', paddingBottom: 70 },
  bottomNav: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: 'var(--brown-dark)', display: 'flex', borderTop: '1px solid rgba(255,255,255,0.08)', zIndex: 100, overflowX: 'auto' },
  navItem: (active) => ({ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 4px 10px', cursor: 'pointer', borderTop: active ? '2px solid var(--gold)' : '2px solid transparent', transition: 'all 0.2s', minWidth: 56 }),
  navIcon: { fontSize: 18, marginBottom: 2 },
  navLabel: (active) => ({ fontSize: 10, color: active ? 'var(--gold-light)' : 'var(--brown-light)', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap' }),
};

export default function Dashboard({ user }) {
  const [activeTab, setActiveTab] = useState('inventory');
  const [role, setRole] = useState('staff');

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) setRole(snap.data().role || 'staff');
      } catch (e) { setRole('staff'); }
    };
    fetchRole();
  }, [user]);

  // Tabs visible to all logged-in users
  const staffTabs = [
    { id: 'inventory', label: 'Inventory', icon: '📦' },
    { id: 'orders', label: 'Orders', icon: '🧾' },
    { id: 'attendance', label: 'Attendance', icon: '🕐' },
    { id: 'photos', label: 'Photos', icon: '📷' },
    { id: 'reports', label: 'Reports', icon: '📊' },
  ];

  // Extra tabs for manager only
  const managerTabs = [
    { id: 'menu', label: 'Menu', icon: '📋' },
    { id: 'guest', label: 'Guest', icon: '🌐' },
  ];

  const tabs = role === 'manager' ? [...staffTabs, ...managerTabs] : staffTabs;

  return (
    <div style={styles.container}>
      <div style={styles.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.jpg" alt="logo" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--gold)' }} />
          <div>
            <div style={styles.topTitle}>Theonyx Cafe</div>
            <div style={styles.roleBadge}>{role === 'manager' ? '👑 Manager' : '👤 Staff'}</div>
          </div>
        </div>
        <button style={styles.logoutBtn} onClick={() => signOut(auth)}>Sign out</button>
      </div>

      <div style={styles.content}>
        {activeTab === 'inventory' && <Inventory />}
        {activeTab === 'orders' && <Orders userRole={role} />}
        {activeTab === 'attendance' && <Attendance />}
        {activeTab === 'photos' && <Camera />}
        {activeTab === 'reports' && <Reports />}
        {activeTab === 'menu' && role === 'manager' && <MenuManager />}
        {activeTab === 'guest' && role === 'manager' && <GuestPhoto />}
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
