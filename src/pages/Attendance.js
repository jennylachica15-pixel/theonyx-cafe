import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../firebase/config';

const SHEET_ID = '15o1OUhOO17s1ifKSlYonPrmtJEAP1qQRLoMCI7_N0DM';
const STAFF_TABS = ['Kelly', 'Maryz'];
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const GOOGLE_CLIENT_ID = '596322682185-n5hm66hvol3nnqqllnuop995kcnefbgu.apps.googleusercontent.com';

const s = {
  page: { padding: '16px 16px 0', animation: 'fadeIn 0.3s ease' },
  title: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 4 },
  sub: { fontSize: 13, color: 'var(--brown-light)', marginBottom: 20 },
  card: { background: 'white', borderRadius: 14, padding: '16px', marginBottom: 12, boxShadow: '0 1px 6px rgba(26,10,0,0.07)' },
  staffName: { fontSize: 17, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 4 },
  timeText: { fontSize: 12, color: 'var(--brown-light)', marginBottom: 12 },
  btnRow: { display: 'flex', gap: 10 },
  inBtn: { flex: 1, padding: '12px', borderRadius: 10, background: 'var(--green-bg)', color: 'var(--green-ok)', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer' },
  outBtn: { flex: 1, padding: '12px', borderRadius: 10, background: 'var(--red-bg)', color: 'var(--red-crit)', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer' },
  disabledBtn: { flex: 1, padding: '12px', borderRadius: 10, background: '#f0f0f0', color: '#aaa', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'not-allowed' },
  connectBtn: { width: '100%', padding: '13px', borderRadius: 12, background: '#1a73e8', color: 'white', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16, border: 'none', cursor: 'pointer' },
  connectedBadge: { background: 'var(--green-bg)', color: 'var(--green-ok)', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 500, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 },
  logRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f5ede4', fontSize: 13 },
  statusBadge: (type) => ({
    padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    background: type === 'IN' ? 'var(--green-bg)' : 'var(--red-bg)',
    color: type === 'IN' ? 'var(--green-ok)' : 'var(--red-crit)',
  }),
};

export default function Attendance() {
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState({});
  const [todayLogs, setTodayLogs] = useState({});
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const tokenClientRef = useRef(null);
  const user = auth.currentUser;

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      if (!window.google) return;
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (res) => { if (res.access_token) setAccessToken(res.access_token); },
      });
    };
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  const connect = () => tokenClientRef.current?.requestAccessToken();

  const formatTime = (date) => date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDate = (date) => date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });

  const recordTime = async (staffName, type) => {
    if (!accessToken) { setError('Connect Google Sheets first.'); return; }
    setLoading(prev => ({ ...prev, [`${staffName}_${type}`]: true }));
    setError('');

    const now = new Date();
    const values = [[formatDate(now), formatTime(now), type, user?.email || 'unknown']];

    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${staffName}!A:D:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values }),
        }
      );
      if (!res.ok) throw new Error('Failed to record');

      setTodayLogs(prev => ({
        ...prev,
        [staffName]: [...(prev[staffName] || []), { time: formatTime(now), type }],
      }));
      setSuccess(`${staffName} clocked ${type} at ${formatTime(now)}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError('Failed to save. Please try again.');
    }
    setLoading(prev => ({ ...prev, [`${staffName}_${type}`]: false }));
  };

  const getLastAction = (staffName) => {
    const logs = todayLogs[staffName];
    if (!logs || logs.length === 0) return null;
    return logs[logs.length - 1].type;
  };

  return (
    <div style={s.page}>
      <div style={s.title}>Attendance</div>
      <div style={s.sub}>Time In / Time Out — syncs to Google Sheets</div>

      {!accessToken ? (
        <button style={s.connectBtn} onClick={connect}>🔗 Connect Google Sheets</button>
      ) : (
        <div style={s.connectedBadge}>✅ Google Sheets connected</div>
      )}

      {error && <div style={{ background: 'var(--red-bg)', color: 'var(--red-crit)', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>⚠️ {error}</div>}
      {success && <div style={{ background: 'var(--green-bg)', color: 'var(--green-ok)', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>✅ {success}</div>}

      {STAFF_TABS.map(name => {
        const lastAction = getLastAction(name);
        const logs = todayLogs[name] || [];
        return (
          <div key={name} style={s.card}>
            <div style={s.staffName}>{name}</div>
            <div style={s.timeText}>
              {logs.length > 0 ? `Last: ${logs[logs.length - 1].type} at ${logs[logs.length - 1].time}` : 'No records today'}
            </div>
            <div style={s.btnRow}>
              <button
                style={lastAction === 'IN' ? s.disabledBtn : s.inBtn}
                disabled={lastAction === 'IN' || loading[`${name}_IN`]}
                onClick={() => recordTime(name, 'IN')}
              >
                {loading[`${name}_IN`] ? '...' : '🟢 Clock In'}
              </button>
              <button
                style={lastAction !== 'IN' ? s.disabledBtn : s.outBtn}
                disabled={lastAction !== 'IN' || loading[`${name}_OUT`]}
                onClick={() => recordTime(name, 'OUT')}
              >
                {loading[`${name}_OUT`] ? '...' : '🔴 Clock Out'}
              </button>
            </div>
            {logs.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--brown-light)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>Today</div>
                {logs.map((log, i) => (
                  <div key={i} style={s.logRow}>
                    <span style={{ color: 'var(--brown-dark)' }}>{log.time}</span>
                    <span style={s.statusBadge(log.type)}>{log.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
