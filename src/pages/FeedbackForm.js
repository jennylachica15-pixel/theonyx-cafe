import React, { useState } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// ── SVG ICONS ────────────────────────────────────────────────────────────────
const StarIcon = ({ filled, size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    fill={filled ? '#d4a853' : 'none'}
    stroke={filled ? '#d4a853' : '#ccc'}
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const IC = {
  send: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  heart: <svg width="40" height="40" viewBox="0 0 24 24" fill="#d4a853" stroke="#d4a853" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  coffee: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d4a853" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>,
};

// ── STAR RATING COMPONENT ─────────────────────────────────────────────────────
function StarRating({ value, onChange, label }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ marginBottom:18 }}>
      <div style={{ fontSize:13, fontWeight:600, color:'var(--brown-dark)', marginBottom:8 }}>{label}</div>
      <div style={{ display:'flex', gap:6 }}>
        {[1,2,3,4,5].map(n => (
          <button
            key={n}
            type="button"
            style={{ background:'none', border:'none', cursor:'pointer', padding:2, lineHeight:0 }}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(n)}
          >
            <StarIcon filled={n <= (hovered || value)} size={34}/>
          </button>
        ))}
      </div>
    </div>
  );
}

const DEFAULT = {
  customerName: '',
  staffRating: 0,
  placeRating: 0,
  drinkOverall: 0,
  drinkSweetness: 0,
  drinkBitterness: 0,
  drinkCreaminess: 0,
  overallComment: '',
  drinkComment: '',
};

export default function FeedbackForm() {
  const [form,       setForm]       = useState(DEFAULT);
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    if (!form.staffRating && !form.placeRating && !form.drinkOverall) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'feedbacks'), {
        ...form,
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (e) {
      console.error('Feedback submit error:', e);
    }
    setSubmitting(false);
  };

  const handleReset = () => {
    setForm(DEFAULT);
    setSubmitted(false);
  };

  // ── THANK YOU SCREEN ──────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'linear-gradient(160deg, #2c1200 0%, #1a0800 100%)',
        zIndex: 500,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 28px',
        animation: 'fadeInTY 0.5s ease',
      }}>
        <style>{`
          @keyframes fadeInTY { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
          @keyframes floatHeart { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-8px) scale(1.08); } }
          @keyframes shimmerGold { 0%,100% { opacity: 1; } 50% { opacity: 0.7; } }
        `}</style>

        {/* Animated heart icon */}
        <div style={{ animation: 'floatHeart 2s ease-in-out infinite', marginBottom: 20 }}>
          {IC.heart}
        </div>

        {/* Coffee icon */}
        <div style={{ marginBottom: 16, animation: 'shimmerGold 2.5s ease-in-out infinite' }}>
          {IC.coffee}
        </div>

        {/* Thank you text */}
        <div style={{
          fontSize: 28, fontWeight: 800,
          color: '#d4a853',
          fontFamily: 'var(--font-display)',
          textAlign: 'center',
          marginBottom: 12,
          letterSpacing: '-0.5px',
          lineHeight: 1.2,
        }}>
          Thank You!
        </div>

        <div style={{
          fontSize: 16, color: '#f5e6d0',
          textAlign: 'center',
          lineHeight: 1.7,
          marginBottom: 8,
          fontWeight: 500,
        }}>
          Thank you for taking the time to share your feedback with us.
        </div>

        <div style={{
          fontSize: 13, color: '#c8943a',
          textAlign: 'center',
          lineHeight: 1.6,
          marginBottom: 32,
        }}>
          Your thoughts help us make Theonyx Cafe<br/>
          an even better experience for everyone.
        </div>

        {/* Divider */}
        <div style={{
          width: 48, height: 2,
          background: 'linear-gradient(90deg, transparent, #d4a853, transparent)',
          marginBottom: 32,
        }}/>

        {/* Submit another button */}
        <button
          onClick={handleReset}
          style={{
            padding: '14px 36px',
            borderRadius: 14,
            background: '#d4a853',
            color: '#1a0800',
            fontSize: 15, fontWeight: 700,
            border: 'none', cursor: 'pointer',
            letterSpacing: '-0.2px',
          }}>
          Submit Another
        </button>
      </div>
    );
  }

  // ── FEEDBACK FORM ─────────────────────────────────────────────────────────
  return (
    <div style={{ padding:'16px 16px 80px', fontFamily:"-apple-system,'Helvetica Neue',sans-serif" }}>

      <div style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:700, color:'var(--brown-dark)', marginBottom:4 }}>
        Share Your Experience
      </div>
      <div style={{ fontSize:13, color:'var(--brown-light)', marginBottom:20 }}>
        We'd love to hear from you!
      </div>

      {/* Name */}
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'var(--brown-dark)', marginBottom:8 }}>Your Name (optional)</div>
        <input
          style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:'1.5px solid #e8d8c8', fontSize:14, background:'white', color:'var(--brown-dark)', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}
          placeholder="e.g. Maria"
          value={form.customerName}
          onChange={e => set('customerName', e.target.value)}
        />
      </div>

      {/* Section: Rate Our Service */}
      <div style={{ background:'white', borderRadius:14, padding:'16px', marginBottom:14, boxShadow:'0 1px 6px rgba(26,10,0,0.07)' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--brown-light)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:14 }}>Rate Our Service</div>
        <StarRating label="Staff" value={form.staffRating} onChange={v => set('staffRating', v)}/>
        <StarRating label="Place / Ambiance" value={form.placeRating} onChange={v => set('placeRating', v)}/>
      </div>

      {/* Section: Rate Your Drink */}
      <div style={{ background:'white', borderRadius:14, padding:'16px', marginBottom:14, boxShadow:'0 1px 6px rgba(26,10,0,0.07)' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--brown-light)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:14 }}>Rate Your Drink</div>
        <StarRating label="Overall" value={form.drinkOverall} onChange={v => set('drinkOverall', v)}/>
        <StarRating label="Sweetness" value={form.drinkSweetness} onChange={v => set('drinkSweetness', v)}/>
        <StarRating label="Bitterness" value={form.drinkBitterness} onChange={v => set('drinkBitterness', v)}/>
        <StarRating label="Creaminess" value={form.drinkCreaminess} onChange={v => set('drinkCreaminess', v)}/>

        <div style={{ fontSize:13, fontWeight:600, color:'var(--brown-dark)', marginBottom:8, marginTop:4 }}>Comment about your drink</div>
        <textarea
          style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:'1.5px solid #e8d8c8', fontSize:13, background:'white', color:'var(--brown-dark)', outline:'none', resize:'none', minHeight:72, boxSizing:'border-box', fontFamily:'inherit' }}
          placeholder="How was your drink?"
          value={form.drinkComment}
          onChange={e => set('drinkComment', e.target.value)}
        />
      </div>

      {/* Overall Comment */}
      <div style={{ background:'white', borderRadius:14, padding:'16px', marginBottom:20, boxShadow:'0 1px 6px rgba(26,10,0,0.07)' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--brown-light)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:12 }}>Overall Comment</div>
        <textarea
          style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:'1.5px solid #e8d8c8', fontSize:13, background:'white', color:'var(--brown-dark)', outline:'none', resize:'none', minHeight:90, boxSizing:'border-box', fontFamily:'inherit' }}
          placeholder="Any other thoughts or suggestions..."
          value={form.overallComment}
          onChange={e => set('overallComment', e.target.value)}
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting || (!form.staffRating && !form.placeRating && !form.drinkOverall)}
        style={{
          width:'100%', padding:'15px',
          borderRadius:14,
          background: (!form.staffRating && !form.placeRating && !form.drinkOverall) ? '#ccc' : 'var(--brown-dark)',
          color: (!form.staffRating && !form.placeRating && !form.drinkOverall) ? '#fff' : 'var(--gold-light)',
          fontSize:15, fontWeight:700,
          border:'none', cursor: (!form.staffRating && !form.placeRating && !form.drinkOverall) ? 'not-allowed' : 'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          letterSpacing:'-0.2px', opacity: submitting ? 0.7 : 1,
        }}>
        {IC.send}
        {submitting ? 'Submitting…' : 'Submit Feedback'}
      </button>

      <div style={{ fontSize:11, color:'#bbb', textAlign:'center', marginTop:10 }}>
        Rate at least one category to submit
      </div>
    </div>
  );
}
