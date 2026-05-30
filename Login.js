import React, { useState } from 'react';
import { auth } from '../firebase/config';
import { signInWithEmailAndPassword } from 'firebase/auth';

const styles = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(160deg, #1a0a00 0%, #6b3a1f 60%, #c8956c 100%)',
    padding: 20,
  },
  card: {
    background: 'var(--cream)', borderRadius: 24, padding: '48px 40px', width: '100%',
    maxWidth: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.35)', animation: 'slideUp 0.5s ease',
  },
  logo: { textAlign: 'center', marginBottom: 36 },
  logoIcon: { width: 120, height: 120, objectFit: 'cover', marginBottom: 10, borderRadius: '50%' },
  logoTitle: { fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--brown-dark)', letterSpacing: '-0.5px' },
  logoSub: { fontSize: 13, color: 'var(--brown-light)', marginTop: 4, letterSpacing: 2, textTransform: 'uppercase' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--brown-mid)', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' },
  input: {
    width: '100%', padding: '13px 16px', borderRadius: 10, border: '1.5px solid #e8d8c8',
    fontSize: 15, background: 'white', color: 'var(--brown-dark)', outline: 'none',
    transition: 'border-color 0.2s', marginBottom: 18,
  },
  btn: {
    width: '100%', padding: '14px', borderRadius: 12, background: 'var(--brown-dark)',
    color: 'var(--gold-light)', fontSize: 15, fontWeight: 600, letterSpacing: 0.5,
    cursor: 'pointer', transition: 'all 0.2s', marginTop: 8,
  },
  error: { background: 'var(--red-bg)', color: 'var(--red-crit)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 },
  fieldGroup: { marginBottom: 4 },
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError('Invalid email or password. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <img src="/logo.jpg" alt="Theonyx Cafe" style={styles.logoIcon} />
          <div style={styles.logoSub}>Inventory System</div>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleLogin}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--brown-light)', marginTop: 24 }}>
          Staff? Ask your manager for login credentials.
        </p>
      </div>
    </div>
  );
}
