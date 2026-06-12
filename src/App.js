import React, { useState, useEffect } from 'react';
import { auth } from './firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import PublicApp from './pages/PublicApp';
import AdminApp from './pages/AdminApp';
import './index.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u && u.email && !u.email.endsWith('@theonyxcafe.games')) setShowAdmin(true);
    });
    return unsub;
  }, []);

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #1a0a00 0%, #6b3a1f 60%, #c8956c 100%)' }}>
      <div style={{ textAlign: 'center' }}>
        <img src="/logo.jpg" alt="logo" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #d4a853', marginBottom: 16 }} />
        <div style={{ width: 32, height: 32, border: '3px solid #c8956c', borderTopColor: '#d4a853', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
      </div>
    </div>
  );

  return showAdmin && user
    ? <AdminApp user={user} onSignOut={() => setShowAdmin(false)} />
    : <PublicApp onAdminLogin={() => setShowAdmin(true)} user={user} />;
}
