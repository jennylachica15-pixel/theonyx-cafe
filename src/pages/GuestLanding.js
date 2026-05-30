import React, { useState } from 'react';

const MENU_CATEGORIES = [
  {
    id: 'espresso', icon: '☕', label: 'Espresso Based',
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
    ]
  },
  {
    id: 'noncoffee', icon: '🍵', label: 'Non-Coffee',
    items: [
      { name: 'Dirty Matcha', classic: 120, upgrade: 150 },
      { name: 'Strawberry Latte', classic: 120, upgrade: 150 },
      { name: 'Strawberry Matcha', classic: 120, upgrade: 150 },
      { name: 'Matcha Latte', classic: 120, upgrade: 150 },
      { name: 'Milk Chocolate', classic: 89, upgrade: 120 },
      { name: 'Oreo Chocomilkshake', classic: 120, upgrade: 150 },
      { name: 'Frappe Strawberry', regular: 165 },
      { name: 'Frappe Ube Halaya', regular: 150 },
      { name: 'Frappe Caramel Macchiato', regular: 150 },
    ]
  },
  {
    id: 'milktea', icon: '🧋', label: 'Milk Tea',
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
  {
    id: 'soda', icon: '🥤', label: 'Soda & Tea',
    items: [
      { name: 'Soda - Passion', classic: 50 },
      { name: 'Soda - Strawberry', classic: 50 },
      { name: 'Soda - Blueberry', classic: 50 },
      { name: 'Soda - Mango', classic: 50 },
      { name: 'Tea - Breakfast in Paris', classic: 50 },
      { name: 'Tea - Chamomile', classic: 50 },
      { name: 'Tea - Hibiscus', classic: 50 },
    ]
  },
  {
    id: 'pasta', icon: '🍝', label: 'Pasta',
    items: [
      { name: 'Pasta - Carbonara', regular: 129 },
      { name: 'Pasta - Bolognese', regular: 129 },
    ]
  },
  {
    id: 'rice', icon: '🍚', label: 'Rice Meals',
    items: [
      { name: 'Tapsilog', regular: 129 },
      { name: 'Cornsilog', regular: 129 },
      { name: 'Pork Sisig Rice', regular: 190 },
      { name: 'Pork Embotido Rice', regular: 129 },
      { name: 'Chicken Inasal Rice', regular: 190 },
      { name: 'Lumpia Rice', regular: 129 },
      { name: 'Porkchop', regular: 150 },
      { name: 'Rice Meal - C. Tapa', regular: 180 },
      { name: 'Rice Meal - C. Hotdog', regular: 80 },
      { name: 'Rice Meal - C. Pepper Steak', regular: 180 },
      { name: 'Rice Meal - C. Korean', regular: 180 },
      { name: 'Rice Meal - C. Inasal', regular: 180 },
    ]
  },
  {
    id: 'pastries', icon: '🥐', label: 'Pastries & Sweets',
    items: [
      { name: 'Waffle - Mango', regular: 80 },
      { name: 'Waffle - Chocolate', regular: 80 },
      { name: 'Waffle - Other', regular: 80 },
      { name: 'Pastry - Cookies', regular: 50 },
      { name: 'Cookies V2', regular: 35 },
      { name: 'Sweet Bites', regular: 15 },
      { name: 'Grilled Cheese Sandwich', regular: 80 },
    ]
  },
  {
    id: 'snacks', icon: '🍟', label: 'Snacks',
    items: [
      { name: 'Cheese Burger', regular: 50 },
      { name: 'Onyx Burger', regular: 150 },
      { name: 'Nachos', regular: 130 },
      { name: 'Fries - BBQ', regular: 30 },
      { name: 'Fries - Sour Cream', regular: 30 },
      { name: 'Fries - Cheese', regular: 30 },
    ]
  },
  {
    id: 'addons', icon: '➕', label: 'Add-ons',
    items: [
      { name: 'Pearl', regular: 10 },
      { name: 'Espresso Shot', regular: 10 },
      { name: 'Rice', regular: 15 },
    ]
  },
];

const getPriceRange = (item) => {
  const prices = ['mini','classic','upgrade','regular'].map(s => item[s]).filter(Boolean);
  if (prices.length === 0) return '';
  if (prices.length === 1) return `₱${prices[0]}`;
  return `₱${Math.min(...prices)} – ₱${Math.max(...prices)}`;
};

const s = {
  page: { minHeight: '100vh', background: 'transparent', paddingBottom: 40 },
  hero: { background: 'var(--brown-dark)', padding: '32px 20px 24px', textAlign: 'center' },
  logo: { width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--gold)', marginBottom: 12 },
  heroTitle: { fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--gold-light)', marginBottom: 4 },
  heroSub: { fontSize: 13, color: 'var(--brown-light)', marginBottom: 16 },
  socialRow: { display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 4 },
  socialBtn: { width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', textDecoration: 'none' },
  body: { padding: '20px 16px 0' },
  welcome: { background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px', marginBottom: 16, border: '1px solid rgba(255,255,255,0.1)' },
  welcomeTitle: { fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#f0d080', marginBottom: 6 },
  welcomeText: { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, marginBottom: 0 },
  sectionTitle: { fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#f0d080', marginBottom: 12 },
  catCard: { background: 'rgba(253,240,228,0.95)', borderRadius: 14, marginBottom: 8, overflow: 'hidden' },
  catHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer' },
  catLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  catIcon: { fontSize: 22 },
  catLabel: { fontSize: 15, fontWeight: 600, color: '#1a0a00' },
  catCount: { fontSize: 11, color: '#c8956c', marginTop: 1 },
  chevron: (open) => ({ fontSize: 14, color: '#c8956c', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }),
  itemRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid rgba(200,149,108,0.2)' },
  itemName: { fontSize: 13, fontWeight: 500, color: '#1a0a00' },
  itemPrice: { fontSize: 12, color: '#6b3a1f', fontWeight: 600 },
  photoBtn: { width: '100%', padding: '15px', borderRadius: 14, background: 'var(--brown-dark)', color: 'var(--gold-light)', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: 'var(--font-display)' },
};

export default function GuestLanding({ onTakePhoto }) {
  const [openCat, setOpenCat] = useState(null);

  const toggle = (id) => setOpenCat(openCat === id ? null : id);

  return (
    <div style={s.page}>
      {/* Hero */}
      <div style={s.hero}>
        <img src="/logo.jpg" alt="Theonyx Cafe" style={s.logo} />
        <div style={s.heroTitle}>THEONYX CAFE</div>
        <div style={s.heroSub}>Where every sip tells a story ☕</div>
        <div style={s.socialRow}>
          <a href="https://www.facebook.com/theonyxs" target="_blank" rel="noreferrer" style={s.socialBtn} aria-label="Facebook">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
            </svg>
          </a>
          <a href="https://www.instagram.com/theonyx.cafe" target="_blank" rel="noreferrer" style={s.socialBtn} aria-label="Instagram">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
            </svg>
          </a>
          <a href="https://www.tiktok.com/@theonyx.cafe" target="_blank" rel="noreferrer" style={s.socialBtn} aria-label="TikTok">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V9.05a8.16 8.16 0 0 0 4.78 1.52V7.12a4.85 4.85 0 0 1-1.01-.43z"/>
            </svg>
          </a>
        </div>
      </div>

      <div style={s.body}>
        {/* Welcome */}
        <div style={s.welcome}>
          <div style={s.welcomeTitle}>Welcome to Theonyx Cafe! 🖤</div>
          <div style={s.welcomeText}>
            We're glad you're here. Browse our menu below, take a photo of your visit, and follow us on social media for updates and promos!
          </div>
        </div>

        {/* Menu */}
        <div style={s.sectionTitle}>Our Menu</div>
        {MENU_CATEGORIES.map(cat => (
          <div key={cat.id} style={s.catCard}>
            <div style={s.catHeader} onClick={() => toggle(cat.id)}>
              <div style={s.catLeft}>
                <span style={s.catIcon}>{cat.icon}</span>
                <div>
                  <div style={s.catLabel}>{cat.label}</div>
                  <div style={s.catCount}>{cat.items.length} items</div>
                </div>
              </div>
              <span style={s.chevron(openCat === cat.id)}>▼</span>
            </div>
            {openCat === cat.id && cat.items.map((item, i) => (
              <div key={i} style={s.itemRow}>
                <span style={s.itemName}>{item.name}</span>
                <span style={s.itemPrice}>{getPriceRange(item)}</span>
              </div>
            ))}
          </div>
        ))}

        {/* Photo CTA */}

      </div>
    </div>
  );
}
