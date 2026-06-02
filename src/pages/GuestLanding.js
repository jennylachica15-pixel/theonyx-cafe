import React, { useState, useEffect } from 'react';

const SLIDES = [
  '/1.jpg','/2.jpg','/3.jpg','/4.jpg','/5.jpg','/6.jpg',
  '/7.jpg','/8.jpg','/9.jpg','/10.jpg','/11.jpg','/12.jpg','/13.jpg',
];

const MENU_CATEGORIES = [
  { id: 'espresso', label: 'Espresso Based', count: 12,
    items: [
      { name: 'Coffee Latte', mini: 75, classic: 85, upgrade: 95 },
      { name: 'Caramel Macchiato', mini: 99, classic: 120, upgrade: 150 },
      { name: 'Americano', mini: 50, classic: 75, upgrade: 99 },
      { name: 'Capuccino', mini: 50, classic: 85, upgrade: 120 },
      { name: 'Spanish Latte', mini: 99, classic: 120, upgrade: 150 },
      { name: 'Mocha', mini: 99, classic: 120, upgrade: 150 },
      { name: 'Sea Salt Caramel Latte', mini: 99, classic: 120, upgrade: 150 },
      { name: 'Coffee Mint', mini: 99, classic: 120, upgrade: 150 },
      { name: 'Rhumpuccino', mini: 99, classic: 135, upgrade: 150 },
      { name: 'Brewed', mini: 25, classic: 50, upgrade: 85 },
      { name: 'Dirty Matcha', classic: 120, upgrade: 150 },
       { name: 'Frappe Caramel Macchiato', regular: 150 },
    ]
  },
  { id: 'noncoffee', label: 'Non-Coffee',
    items: [
      { name: 'Strawberry Latte', classic: 120, upgrade: 150 },
      { name: 'Strawberry Matcha', classic: 120, upgrade: 150 },
      { name: 'Matcha Latte', classic: 120, upgrade: 150 },
      { name: 'Milk Chocolate', classic: 89, upgrade: 120 },
      { name: 'Oreo Chocomilkshake', classic: 120, upgrade: 150 },
      { name: 'Frappe Strawberry', regular: 165 },
      { name: 'Frappe Ube Halaya', regular: 150 },
    ]
  },
  { id: 'milktea', label: 'Milk Tea',
    items: [
      { name: 'M.T. - Hokkaido', regular: 55 },
      { name: 'M.T. - Okinawa', regular: 55 },
      { name: 'M.T. - Mango Cheesecake', regular: 60 },
      { name: 'M.T. - Red Velvet', regular: 60 },
      { name: 'M.T. - Taro', regular: 55 },
      { name: 'M.T. - Black Forest', regular: 60 },
      { name: 'M.T. - Dark Chocolate', regular: 60 },
      { name: 'M.T. - Cookies and Cream', regular: 55 },
      { name: 'M.T. - White Bunny', regular: 60 },
      { name: 'M.T. - Wintermelon', regular: 60 },
    ]
  },
  { id: 'soda', label: 'Soda & Tea',
    items: [
      { name: 'Soda - Passion', classic: 50 },
      { name: 'Soda - Strawberry', classic: 50 },
      { name: 'Soda - Blueberry', classic: 50 },
      { name: 'Soda - Mango', classic: 50 },
      { name: 'Tea - Breakfast in Paris', classic: 50 },
      { name: 'Tea - Chamomile', classic: 50 },
      { name: 'Tea - Hibiscus', classic: 80 },
    ]
  },
  { id: 'pasta', label: 'Pasta',
    items: [
      { name: 'Pasta - Carbonara', regular: 130 },
      { name: 'Pasta - Bolognese', regular: 130 },
    ]
  },
  { id: 'rice', label: 'Rice Meals',
    items: [
      { name: 'Tapsilog', regular: 90 },
      { name: 'Cornsilog', regular: 90 },
      { name: 'Spamsilog', regular: 90 },
      { name: 'Pork Sisig Rice', regular: 180 },
      { name: 'Pork Embotido Rice', regular: 129 },
      { name: 'Lumpia Rice', regular: 80 },
      { name: 'Porkchop', regular: 150 },
      { name: 'Rice Meal - C. Tapa', regular: 180 },
      { name: 'Rice Meal - C. Hotdog', regular: 90 },
      { name: 'Rice Meal - C. Pepper Steak', regular: 180 },
      { name: 'Rice Meal - C. Korean', regular: 180 },
      { name: 'Rice Meal - C. Inasal', regular: 180 },
    ]
  },
  { id: 'pastries', label: 'Pastries & Sweets',
    items: [
      { name: 'Waffle - Mango', regular: 80 },
      { name: 'Waffle - Chocolate', regular: 80 },
      { name: 'Waffle - Blueberry', regular: 80 },
      { name: 'Pastry - Cookies', regular: 50 },
      { name: 'Cookies Small', regular: 35 },
      { name: 'Sweet Bites', regular: 15 },
      { name: 'Grilled Cheese Sandwich', regular: 80 },
    ]
  },
  { id: 'snacks', label: 'Snacks',
    items: [
      { name: 'Cheese Burger', regular: 50 },
      { name: 'Onyx Burger', regular: 150 },
      { name: 'Nachos', regular: 130 },
      { name: 'Fries - BBQ', regular: 30 },
      { name: 'Fries - Sour Cream', regular: 30 },
      { name: 'Fries - Cheese', regular: 30 },
    ]
  },
  { id: 'addons', label: 'Add-ons',
    items: [
      { name: 'Pearl', regular: 10 },
      { name: 'Espresso Shot', regular: 10 },
      { name: 'Rice', regular: 15 },
    ]
  },
];

// SVG Icons for menu categories
const CAT_ICONS = {
  espresso: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>,
  noncoffee: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0 1 10 10"/><path d="M12 2v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M2 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M12 22v-4"/><circle cx="12" cy="12" r="4"/></svg>,
  milktea: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2h8l1 8H7L8 2z"/><path d="M7 10c0 5 1 10 5 10s5-5 5-10"/><line x1="12" y1="2" x2="12" y2="10"/></svg>,
  soda: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="15" rx="2"/><path d="M6 10h12"/><path d="M9 2v4"/><path d="M15 2v4"/></svg>,
  pasta: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11h18"/><path d="M12 11V3"/><path d="M8 11c0 4 2 7 4 8 2-1 4-4 4-8"/><path d="M5 21h14"/></svg>,
  rice: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11h18v2a9 9 0 0 1-18 0v-2z"/><path d="M12 11V3"/><path d="M8 7l4-4 4 4"/></svg>,
  pastries: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11h18v2a9 9 0 0 1-18 0v-2z"/><path d="M12 3c-3 0-6 2-6 8h12c0-6-3-8-6-8z"/></svg>,
  snacks: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M3 11l3-7h12l3 7"/><line x1="12" y1="11" x2="12" y2="21"/><line x1="7" y1="11" x2="7" y2="21"/><line x1="17" y1="11" x2="17" y2="21"/></svg>,
  addons: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
};

const getPriceRange = (item) => {
  const prices = ['mini','classic','upgrade','regular'].map(s => item[s]).filter(Boolean);
  if (prices.length === 0) return '';
  if (prices.length === 1) return `₱${prices[0]}`;
  return `₱${Math.min(...prices)} – ₱${Math.max(...prices)}`;
};

export default function GuestLanding() {
  const [openCat, setOpenCat] = useState(null);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSlide(s => (s + 1) % SLIDES.length), 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', paddingBottom: 40 }}>
      {/* Hero with slideshow */}
      <div style={{ position: 'relative', height: 280, overflow: 'hidden' }}>
        {SLIDES.map((src, i) => (
          <div key={i} style={{
            position: 'absolute', inset: 0, backgroundImage: `url(${src})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            opacity: slide === i ? 1 : 0, transition: 'opacity 1.2s ease',
          }} />
        ))}
        {/* Dark overlay — less transparent so text is readable */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(20,8,0,0.55) 0%, rgba(20,8,0,0.70) 60%, rgba(20,8,0,0.88) 100%)' }} />
        {/* Hero content */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 20px' }}>
          <img src="/logo.jpg" alt="Theonyx Cafe" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2.5px solid #d4a853', marginBottom: 10 }} />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: '#f0d080', letterSpacing: 2, textAlign: 'center', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>THEONYX CAFE</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4, letterSpacing: 1.5, textAlign: 'center', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>COFFEE · PASTRY · STEAK · WINE</div>
          {/* Social + Map icons */}
          <div style={{ display: 'flex', gap: 14, marginTop: 16 }}>
            {[
              { href: 'https://www.facebook.com/theonyxs', label: 'Facebook', svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg> },
              { href: 'https://www.instagram.com/theonyx.cafe', label: 'Instagram', svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg> },
              { href: 'https://www.tiktok.com/@theonyx.cafe', label: 'TikTok', svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-6.33 6.34 6.34 6.34 0 0 0 6.33 6.34 6.34 6.34 0 0 0 6.33-6.34V9.05a8.16 8.16 0 0 0 4.78 1.52V7.12a4.85 4.85 0 0 1-1.01-.43z"/></svg> },
              { href: 'https://maps.app.goo.gl/wZTLY5BWJavdjoni6', label: 'Location', svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
            ].map(({ href, label, svg }) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}
                style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.25)', textDecoration: 'none', backdropFilter: 'blur(4px)' }}>
                {svg}
              </a>
            ))}
          </div>
          {/* Slide dots */}
          <div style={{ display: 'flex', gap: 5, marginTop: 12 }}>
            {SLIDES.map((_, i) => (
              <div key={i} onClick={() => setSlide(i)} style={{ width: slide === i ? 16 : 5, height: 5, borderRadius: 3, background: slide === i ? '#d4a853' : 'rgba(255,255,255,0.4)', cursor: 'pointer', transition: 'all 0.3s' }} />
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '18px 16px 0' }}>
        {/* Welcome card */}
        <div style={{ background: 'rgba(20,8,0,0.55)', borderRadius: 14, padding: '16px 18px', marginBottom: 16, border: '1px solid rgba(212,168,83,0.25)', backdropFilter: 'blur(8px)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#f0d080', marginBottom: 6 }}>Welcome to Theonyx Cafe</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }}>
            We are glad to have you here. Browse our menu below and follow us on social media for updates and promos.
          </div>
          <div style={{ fontSize: 12, color: '#d4a853', marginTop: 8, fontWeight: 500 }}>Open everyday · 10:00 AM – 11:00 PM</div>
        </div>

        {/* Menu */}
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#f0d080', marginBottom: 12 }}>Our Menu</div>

        {MENU_CATEGORIES.map(cat => (
          <div key={cat.id} style={{ background: 'rgba(20,8,0,0.55)', borderRadius: 14, marginBottom: 8, overflow: 'hidden', border: '1px solid rgba(212,168,83,0.2)', backdropFilter: 'blur(8px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', cursor: 'pointer' }} onClick={() => setOpenCat(openCat === cat.id ? null : cat.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ color: '#d4a853', display: 'flex', alignItems: 'center' }}>{CAT_ICONS[cat.id]}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>{cat.label}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>{cat.items.length} items</div>
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4a853" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: openCat === cat.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
            {openCat === cat.id && cat.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', borderTop: '1px solid rgba(212,168,83,0.1)' }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{item.name}</span>
                <span style={{ fontSize: 12, color: '#d4a853', fontWeight: 600 }}>{getPriceRange(item)}</span>
              </div>
            ))}
          </div>
        ))}

        {/* Footer CTA */}
        <div style={{ padding: '20px 4px 0', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#f0d080', marginBottom: 6 }}>
            Come Visit Us!
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, marginBottom: 12 }}>
            Whether you're looking for a quiet place to unwind, catch up with friends, or enjoy a great meal — Theonyx Cafe is the perfect spot. We warmly welcome you.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginBottom: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d4a853" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>52 Carillo St., Brgy. San Nicolas, Bay, Laguna</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginBottom: 14 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d4a853" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Open everyday · 10:00 AM – 11:00 PM</span>
          </div>
          <a href="https://maps.app.goo.gl/wZTLY5BWJavdjoni6" target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: '#d4a853', textDecoration: 'underline', fontWeight: 600 }}>
            Get Directions →
          </a>
        </div>

      </div>
      <div style={{ height: 80 }} />
    </div>
  );
}
