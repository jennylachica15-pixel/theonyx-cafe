import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import GuestLanding from './GuestLanding';
import Inventory from './Inventory';
import Camera from './Camera';
import Reports from './Reports';
import Attendance from './Attendance';
import Orders from './Orders';
import MenuManager from './MenuManager';

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--cream)', maxWidth: 480, margin: '0 auto', position: 'relative' },
  topbar: { padding: '10px 16px 8px', background: 'var(--brown-dark)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  topTitle: { fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--gold-light)' },
  roleBadge: { fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.12)', color: 'var(--gold-light)', marginTop: 2, display: 'inline-block' },
  logoutBtn: { background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, color: 'var(--brown-light)', fontSize: 12, padding: '6px 12px', cursor: 'pointer' },
  content: { flex: 1, overflowY: 'auto', paddingBottom: 70 },
  bottomNav: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: 'var(--brown-dark)', display: 'flex', borderTop: '1px solid rgba(255,255,255,0.08)', zIndex: 100, overflowX: 'auto' },
  navItem: (active) => ({ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '7px 2px 9px', cursor: 'pointer', borderTop: active ? '2px solid var(--gold)' : '2px solid transparent', minWidth: 50 }),
  navIcon: { fontSize: 17, marginBottom: 2 },
  navLabel: (active) => ({ fontSize: 9, color: active ? 'var(--gold-light)' : 'var(--brown-light)', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap' }),
};

export default function Dashboard({ user }) {
  const [activeTab, setActiveTab] = useState('guest');
  const [role, setRole] = useState('staff');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          setRole(snap.data().role || 'staff');
          setUserName(snap.data().name || '');
        }
      } catch (e) { setRole('staff'); }
    };
    fetchUser();
  }, [user]);

  const staffTabs = [
    { id: 'guest', label: 'Home', icon: '🏠' },
    { id: 'orders', label: 'Orders', icon: '🧾' },
    { id: 'photos', label: 'Photos', icon: '📷' },
    { id: 'attendance', label: 'Time', icon: '🕐' },
    { id: 'inventory', label: 'Stock', icon: '📦' },
    { id: 'reports', label: 'Reports', icon: '📊' },
  ];

  const managerTabs = [
    ...staffTabs,
    { id: 'menu', label: 'Menu', icon: '📋' },
  ];

  const tabs = role === 'manager' ? managerTabs : staffTabs;

  return (
    <div style={styles.container}>
      <div style={styles.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.jpg" alt="logo" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--gold)' }} />
          <div>
            <div style={styles.topTitle}>Theonyx Cafe</div>
            <span style={styles.roleBadge}>{role === 'manager' ? '👑 Manager' : `👤 ${userName || 'Staff'}`}</span>
          </div>
        </div>
        <button style={styles.logoutBtn} onClick={() => signOut(auth)}>Sign out</button>
      </div>

      <div style={styles.content}>
        {activeTab === 'guest' && <GuestLanding onTakePhoto={() => setActiveTab('photos')} />}
        {activeTab === 'orders' && <Orders userName={userName} />}
        {activeTab === 'photos' && <Camera userRole={role} />}
        {activeTab === 'attendance' && <Attendance />}
        {activeTab === 'inventory' && <Inventory />}
        {activeTab === 'reports' && <Reports />}
        {activeTab === 'menu' && role === 'manager' && <MenuManager />}
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
