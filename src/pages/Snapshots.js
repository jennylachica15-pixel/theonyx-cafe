import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const FEEDBACK_SHEET_ID = '1VW1FxwFRI2uR9Ud5hu-SmaDb5ti8kS0rRcludFnrlhM';
const GOOGLE_CLIENT_ID = '596322682185-n5hm66hvol3nnqqllnuop995kcnefbgu.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

const MENU_ITEMS = [
  'Coffee Latte','Caramel Macchiato','Americano','Capuccino','Spanish Latte','Mocha',
  'Sea Salt Caramel Latte','Coffee Mint','Rhumpuccino','Brewed',
  'Dirty Matcha','Strawberry Latte','Matcha Latte','Milk Chocolate','Oreo Chocomilkshake',
  'Frappe Strawberry','Frappe Ube Halaya','Frappe Caramel Macchiato',
  'M.T. - Hokkaido','M.T. - Okinawa','M.T. - Mango Cheesecake','M.T. - Red Velvet',
  'M.T. - Taro','M.T. - Black Forest','M.T. - Wintermelon',
  'Soda - Passion','Soda - Strawberry','Soda - Blueberry','Soda - Mango',
  'Tea - Chamomile','Tea - Hibiscus',
  'Pasta - Carbonara','Pasta - Bolognese',
  'Tapsilog','Cornsilog','Pork Sisig Rice','Chicken Inasal Rice','Porkchop',
  'Onyx Burger','Cheese Burger','Nachos','Fries',
  'Waffle - Mango','Waffle - Chocolate','Pastry - Cookies','Sweet Bites',
];

const DRINK_ITEMS = [
  'Coffee Latte','Caramel Macchiato','Americano','Capuccino','Spanish Latte','Mocha',
  'Sea Salt Caramel Latte','Coffee Mint','Rhumpuccino','Brewed',
  'Dirty Matcha','Strawberry Latte','Matcha Latte','Milk Chocolate','Oreo Chocomilkshake',
  'Frappe Strawberry','Frappe Ube Halaya','Frappe Caramel Macchiato',
  'M.T. - Hokkaido','M.T. - Okinawa','M.T. - Mango Cheesecake','M.T. - Red Velvet',
  'M.T. - Taro','M.T. - Black Forest','M.T. - Wintermelon',
  'Soda - Passion','Soda - Strawberry','Soda - Blueberry','Soda - Mango',
  'Tea - Chamomile','Tea - Hibiscus',
];

function StarRating({ value, onChange, label, color = '#d4a853' }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[1,2,3,4,5].map(star => (
          <div key={star} onClick={() => onChange(star)} style={{ cursor: 'pointer', fontSize: 28, color: star <= value ? color : 'rgba(255,255,255,0.2)', transition: 'color 0.15s' }}>★</div>
        ))}
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: 'transparent', padding: '16px 16px 100px' },
  title: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 4 },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 20 },
  section: { background: 'rgba(20,8,0,0.55)', borderRadius: 14, padding: '16px', marginBottom: 12, border: '1px solid rgba(212,168,83,0.2)' },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#d4a853', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  label: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 6, display: 'block' },
  input: { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(212,168,83,0.25)', background: 'rgba(255,255,255,0.06)', color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 12 },
  textarea: { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(212,168,83,0.25)', background: 'rgba(255,255,255,0.06)', color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box', minHeight: 80, resize: 'none' },
  select: { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(212,168,83,0.25)', background: 'rgba(30,12,0,0.8)', color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 12 },
  submitBtn: { width: '100%', padding: '14px', borderRadius: 12, background: '#d4a853', color: '#1a0a00', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', marginTop: 8 },
  connectBtn: { padding: '8px 14px', borderRadius: 10, background: '#6b3a1f', color: '#f0d080', fontSize: 12, fontWeight: 600, border: '1px solid rgba(212,168,83,0.3)', cursor: 'pointer', marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 6 },
  connectedBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(45,106,79,0.3)', color: '#6fcf97', borderRadius: 10, padding: '6px 12px', fontSize: 12, fontWeight: 500, marginBottom: 14, border: '1px solid rgba(45,106,79,0.3)' },
  successBox: { background: 'rgba(45,106,79,0.25)', color: '#6fcf97', borderRadius: 12, padding: '20px', textAlign: 'center', border: '1px solid rgba(45,106,79,0.3)', marginBottom: 16 },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tag: (active) => ({ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid', borderColor: active ? '#d4a853' : 'rgba(255,255,255,0.15)', background: active ? 'rgba(212,168,83,0.2)' : 'transparent', color: active ? '#d4a853' : 'rgba(255,255,255,0.5)' }),
};

const BLANK = {
  customerName: '',
  orders: [],
  drinkRatings: { overall: 0, sweetness: 0, bitterness: 0, creaminess: 0 },
  drinkComment: '',
  staffRating: 0,
  placeRating: 0,
  overallComment: '',
};

export default function Snapshots() {
  const [form, setForm] = useState(BLANK);
  const [accessToken, setAccessToken] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const tokenClientRef = useRef(null);

  const now = new Date();
  const dateTimeStr = now.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) + ' · ' + now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  const hasDrink = form.orders.some(o => DRINK_ITEMS.includes(o));

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
    script.onload = () => {
      if (!window.google) return;
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID, scope: SCOPES,
        callback: res => { if (res.access_token) setAccessToken(res.access_token); },
      });
    };
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  const toggleOrder = (item) => {
    setForm(prev => ({
      ...prev,
      orders: prev.orders.includes(item) ? prev.orders.filter(o => o !== item) : [...prev.orders, item],
    }));
  };

  const setDrinkRating = (key, val) => setForm(prev => ({ ...prev, drinkRatings: { ...prev.drinkRatings, [key]: val } }));

  const handleSubmit = async () => {
    if (!form.customerName) { alert('Please enter your name.'); return; }
    if (form.orders.length === 0) { alert('Please select at least one item you ordered.'); return; }
    setSaving(true);
    const row = [
      dateTimeStr,
      form.customerName,
      form.orders.join(', '),
      hasDrink ? form.drinkRatings.overall : 'N/A',
      hasDrink ? form.drinkRatings.sweetness : 'N/A',
      hasDrink ? form.drinkRatings.bitterness : 'N/A',
      hasDrink ? form.drinkRatings.creaminess : 'N/A',
      hasDrink ? form.drinkComment : 'N/A',
      form.staffRating,
      form.placeRating,
      form.overallComment,
    ];
    try {
      if (accessToken) {
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${FEEDBACK_SHEET_ID}/values/Sheet1!A:K:append?valueInputOption=USER_ENTERED`,
          { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [row] }) }
        );
      }
      // Also save to Firestore for Reports summary
      await addDoc(collection(db, 'feedbacks'), {
        customerName: form.customerName,
        orders: form.orders,
        drinkOverall: hasDrink ? form.drinkRatings.overall : null,
        drinkSweetness: hasDrink ? form.drinkRatings.sweetness : null,
        drinkBitterness: hasDrink ? form.drinkRatings.bitterness : null,
        drinkCreaminess: hasDrink ? form.drinkRatings.creaminess : null,
        drinkComment: form.drinkComment,
        staffRating: form.staffRating,
        placeRating: form.placeRating,
        overallComment: form.overallComment,
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
      setForm(BLANK);
      setTimeout(() => setSubmitted(false), 5000);
    } catch (e) { alert('Failed to submit. Please try again.'); }
    setSaving(false);
  };

  return (
    <div style={s.page}>
      <div style={s.title}>Share Your Experience</div>
      <div style={s.sub}>We'd love to hear your feedback!</div>

      {!accessToken
        ? <button style={s.connectBtn} onClick={() => tokenClientRef.current?.requestAccessToken()}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            Connect to Submit Feedback
          </button>
        : <div style={s.connectedBadge}>✅ Connected — feedback saves to spreadsheet</div>
      }

      {submitted && (
        <div style={s.successBox}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🙏</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Thank you!</div>
          <div style={{ fontSize: 13, opacity: 0.8 }}>Your feedback means a lot to us at Theonyx Cafe.</div>
        </div>
      )}

      {/* Customer Info */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Customer Information</div>
        <label style={s.label}>Your Name</label>
        <input style={s.input} placeholder="Enter your name" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} />
        <label style={s.label}>Date & Time</label>
        <input style={{ ...s.input, opacity: 0.6 }} value={dateTimeStr} readOnly />
      </div>

      {/* What did you order */}
      <div style={s.section}>
        <div style={s.sectionTitle}>What did you order?</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>Tap all that apply</div>
        <div style={s.tagRow}>
          {MENU_ITEMS.map(item => (
            <div key={item} style={s.tag(form.orders.includes(item))} onClick={() => toggleOrder(item)}>{item}</div>
          ))}
        </div>
      </div>

      {/* Drink ratings — only show if they ordered a drink */}
      {hasDrink && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Rate Your Drink</div>
          <StarRating label="Overall" value={form.drinkRatings.overall} onChange={v => setDrinkRating('overall', v)} />
          <StarRating label="Sweetness" value={form.drinkRatings.sweetness} onChange={v => setDrinkRating('sweetness', v)} color="#e07b39" />
          <StarRating label="Bitterness" value={form.drinkRatings.bitterness} onChange={v => setDrinkRating('bitterness', v)} color="#6b3a1f" />
          <StarRating label="Creaminess" value={form.drinkRatings.creaminess} onChange={v => setDrinkRating('creaminess', v)} color="#c8956c" />
          <label style={s.label}>Comment about your drink</label>
          <textarea style={s.textarea} placeholder="Tell us more about your drink..." value={form.drinkComment} onChange={e => setForm({ ...form, drinkComment: e.target.value })} />
        </div>
      )}

      {/* Staff & Place ratings */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Rate Our Service</div>
        <StarRating label="Staff Rating" value={form.staffRating} onChange={v => setForm({ ...form, staffRating: v })} color="#d4a853" />
        <StarRating label="Place / Ambiance" value={form.placeRating} onChange={v => setForm({ ...form, placeRating: v })} color="#d4a853" />
        <label style={s.label}>Overall Comment</label>
        <textarea style={s.textarea} placeholder="Any other thoughts or suggestions..." value={form.overallComment} onChange={e => setForm({ ...form, overallComment: e.target.value })} />
      </div>

      <button style={{ ...s.submitBtn, opacity: saving ? 0.7 : 1 }} onClick={handleSubmit} disabled={saving}>
        {saving ? 'Submitting...' : '📩 Submit Feedback'}
      </button>
    </div>
  );
}
