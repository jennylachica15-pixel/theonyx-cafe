import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

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

// Soda & Tea — no bitterness or creaminess
const SODA_TEA_ITEMS = [
  'Soda - Passion','Soda - Strawberry','Soda - Blueberry','Soda - Mango',
  'Tea - Chamomile','Tea - Hibiscus',
];

// ── Submit (paper plane) icon ────────────────────────────────────────────────
const IC_SEND = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a0a00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

function StarRating({ value, onChange, label, color = '#d4a853', disabled = false }) {
  return (
    <div style={{ marginBottom: 16, opacity: disabled ? 0.35 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{label}</div>
        {disabled && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: 10 }}>N/A for this drink</span>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[1,2,3,4,5].map(star => (
          <div key={star} onClick={() => !disabled && onChange(star)} style={{ cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 28, color: star <= value ? color : 'rgba(255,255,255,0.2)', transition: 'color 0.15s' }}>★</div>
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
  submitBtn: { width: '100%', padding: '14px', borderRadius: 12, background: '#d4a853', color: '#1a0a00', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tag: (active) => ({ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid', borderColor: active ? '#d4a853' : 'rgba(255,255,255,0.15)', background: active ? 'rgba(212,168,83,0.2)' : 'transparent', color: active ? '#d4a853' : 'rgba(255,255,255,0.5)' }),
};

// ── Thank-you popup styles ────────────────────────────────────────────────────
const pop = {
  overlay: { position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(26,10,0,0.62)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'ty-fade 0.25s ease' },
  card: { position: 'relative', width: '100%', maxWidth: 360, boxSizing: 'border-box', background: 'var(--cream, #fffaf4)', borderRadius: 24, padding: '40px 28px 28px', textAlign: 'center', boxShadow: '0 24px 60px rgba(26,10,0,0.4)', animation: 'ty-pop 0.45s cubic-bezier(0.18,0.89,0.32,1.28)', overflow: 'hidden' },
  glow: { position: 'absolute', top: -70, left: '50%', transform: 'translateX(-50%)', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,168,83,0.30), transparent 70%)', pointerEvents: 'none' },
  badge: { width: 84, height: 84, borderRadius: '50%', margin: '0 auto 18px', background: 'linear-gradient(135deg, #d4a853, #b8862f)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px rgba(184,134,47,0.45)', animation: 'ty-badge 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.1s both' },
  title: { fontSize: 25, fontWeight: 700, color: 'var(--brown-dark, #2a1206)', fontFamily: 'var(--font-display, Georgia, serif)', letterSpacing: '-0.3px', margin: '0 0 10px', animation: 'ty-rise 0.5s ease 0.25s both' },
  msg: { fontSize: 14.5, color: 'var(--brown-light, #8a6a52)', lineHeight: 1.6, margin: '0 4px 24px', animation: 'ty-rise 0.5s ease 0.35s both' },
  btn: { width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: 'pointer', background: 'var(--brown-dark, #2a1206)', color: 'var(--gold-light, #f5e6c8)', fontSize: 15, fontWeight: 700, letterSpacing: '0.2px', fontFamily: 'inherit', animation: 'ty-rise 0.5s ease 0.45s both' },
};

const Sparkle = ({ top, left, right, size, delay }) => (
  <svg style={{ position: 'absolute', top, left, right, width: size, height: size, color: '#d4a853', animation: `ty-twinkle 1.9s ease ${delay}s infinite`, pointerEvents: 'none' }} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0l2.2 7.8L22 10l-7.8 2.2L12 20l-2.2-7.8L2 10l7.8-2.2z" />
  </svg>
);

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
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedName, setSubmittedName] = useState('');

  const now = new Date();
  const dateTimeStr = now.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) + ' · ' + now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  const hasDrink = form.orders.some(o => DRINK_ITEMS.includes(o));
  // Bitterness & creaminess disabled if ALL selected drinks are soda/tea
  const selectedDrinks = form.orders.filter(o => DRINK_ITEMS.includes(o));
  const isSodaTeaOnly = selectedDrinks.length > 0 && selectedDrinks.every(o => SODA_TEA_ITEMS.includes(o));

  // Lock background scroll while the thank-you popup is open
  useEffect(() => {
    if (!submitted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [submitted]);

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
    try {
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
      setSubmittedName(form.customerName);  // keep the name before clearing the form
      setForm(BLANK);
      setSubmitted(true);                   // show the big thank-you popup
    } catch (e) { alert('Failed to submit. Please try again.'); }
    setSaving(false);
  };

  return (
    <div style={s.page}>
      <div style={s.title}>Share Your Experience</div>
      <div style={s.sub}>We'd love to hear your feedback!</div>

      {/* Privacy notice */}
      <div style={{ background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d4a853" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
          Your privacy is important to us. <strong style={{ color: '#d4a853' }}>No personal email addresses are collected or stored</strong> in this form. Only your name and feedback responses are recorded.
        </div>
      </div>

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
          <StarRating label="Bitterness" value={form.drinkRatings.bitterness} onChange={v => setDrinkRating('bitterness', v)} color="#6b3a1f" disabled={isSodaTeaOnly} />
          <StarRating label="Creaminess" value={form.drinkRatings.creaminess} onChange={v => setDrinkRating('creaminess', v)} color="#c8956c" disabled={isSodaTeaOnly} />
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
        {saving ? 'Submitting...' : <>{IC_SEND} Submit Feedback</>}
      </button>

      {/* ── BIG THANK-YOU POPUP ── */}
      {submitted && (
        <div style={pop.overlay} onClick={() => setSubmitted(false)}>
          <style>{`
            @keyframes ty-fade    { from { opacity:0 } to { opacity:1 } }
            @keyframes ty-pop     { 0% { transform:scale(0.82); opacity:0 } 100% { transform:scale(1); opacity:1 } }
            @keyframes ty-badge   { 0% { transform:scale(0) rotate(-25deg) } 100% { transform:scale(1) rotate(0) } }
            @keyframes ty-rise    { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
            @keyframes ty-twinkle { 0%,100% { opacity:0.2; transform:scale(0.7) } 50% { opacity:1; transform:scale(1) } }
          `}</style>

          <div style={pop.card} onClick={e => e.stopPropagation()}>
            <div style={pop.glow} />
            <Sparkle top={20} left={34}  size={15} delay={0} />
            <Sparkle top={34} right={34} size={11} delay={0.5} />
            <Sparkle top={72} left={26}  size={9}  delay={1} />

            <div style={pop.badge}>
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#fffaf0" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <div style={pop.title}>
              Thank You{submittedName ? `, ${submittedName}` : ''}!
            </div>

            <div style={pop.msg}>
              Thank you for taking the time to share your feedback with us.
              Your thoughts mean a lot and help make Theonyx Cafe even better.
            </div>

            <button style={pop.btn} onClick={() => setSubmitted(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
