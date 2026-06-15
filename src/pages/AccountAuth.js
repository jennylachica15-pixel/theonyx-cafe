import React, { useState } from 'react';
import { registerUser, loginUser } from './authHelpers';
// One shared sign-in form for BOTH Games and Chat (same account).
// Renders just the fields/buttons — the parent provides the card/modal wrapper.
// Props:
//   onDone(name)  — called after a successful sign in / register
//   onGuest()     — optional; shows a "Play as Guest" link when provided
//   heading, sub  — optional text
export default function AccountAuth({ onDone, onGuest, heading = 'Sign in', sub = 'One account for Games & Chat' }) {
  const [mode, setMode] = useState('signin');
  const [username, setUsername] = useState(() => { try { return localStorage.getItem('cafeGameUser') || ''; } catch { return ''; } });
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!username.trim() || !password.trim()) { setError('Fill in both fields'); return; }
    setError(''); setLoading(true);
    try {
      const name = mode === 'register'
        ? await registerUser(username.trim(), password)
        : await loginUser(username.trim(), password);
      if (onDone) onDone(name);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    }
    setLoading(false);
  };
  const s = {
    title: { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#f0d080', marginBottom: 4, textAlign: 'center' },
    sub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 18, letterSpacing: 1 },
    label: { display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(212,168,83,0.3)', fontSize: 14, background: 'rgba(255,255,255,0.06)', color: 'white', marginBottom: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
    btn: { width: '100%', padding: '13px', borderRadius: 12, background: '#d4a853', color: '#1a0a00', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', marginTop: 4 },
    switch: { background: 'none', border: 'none', color: '#d4a853', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', marginTop: 12, width: '100%', fontFamily: 'inherit' },
    guest: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 13, cursor: 'pointer', marginTop: 10, width: '100%', fontFamily: 'inherit' },
    error: { background: 'rgba(193,18,31,0.2)', color: '#ff6b6b', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 12, border: '1px solid rgba(193,18,31,0.3)' },
  };
  return (
    <div>
      <div style={s.title}>{mode === 'register' ? 'Create your account' : heading}</div>
      <div style={s.sub}>{sub}</div>
      {error && <div style={s.error}>{error}</div>}
      <form onSubmit={submit}>
        <label style={s.label}>Username</label>
        <input style={s.input} type="text" placeholder="e.g. Latte" value={username} onChange={e => setUsername(e.target.value)} autoCapitalize="none" required maxLength={20} />
        <label style={s.label}>Password</label>
        <input style={s.input} type="password" placeholder={mode === 'register' ? '6+ characters' : '••••••••'} value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit" style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
          {loading ? 'Please wait…' : (mode === 'register' ? 'Create Account' : 'Sign In')}
        </button>
      </form>
      <button style={s.switch} onClick={() => { setError(''); setMode(mode === 'register' ? 'signin' : 'register'); }}>
        {mode === 'register' ? 'Already have an account? Sign in' : 'New here? Create an account'}
      </button>
      {onGuest && (
        <button style={s.guest} onClick={onGuest}>Play as Guest</button>
      )}
    </div>
  );
}
