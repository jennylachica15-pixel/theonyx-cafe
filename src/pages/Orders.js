import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase/config';
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

const GOOGLE_CLIENT_ID = '596322682185-n5hm66hvol3nnqqllnuop995kcnefbgu.apps.googleusercontent.com';
const SALES_SHEET_ID = '1UvI6I6aZkaPzcIf3qwcrENWaiPR3ibKMxjWwLRYSFfY';
const RECEIPT_FOLDER_ID = '16FGEhlHtHObYC0pBg0jfphsNxksdWF1m';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';

const PAYMENT_METHODS = ['Cash', 'GCash', 'Maya', 'Card'];
const SIZES = ['mini', 'classic', 'upgrade', 'regular'];
const SIZE_LABELS = { mini: 'Mini', classic: 'Classic', upgrade: 'Upgrade', regular: 'Regular' };

const MENU_GROUPS = [
  { id: 'espresso', icon: '☕', label: 'Espresso Based', items: [
    { name: 'COFFEE LATTE', mini: 75, classic: 85, upgrade: 95 },
    { name: 'CARAMEL MACCHIATO', mini: 99, classic: 120, upgrade: 150 },
    { name: 'AMERICANO', mini: 50, classic: 75, upgrade: 99 },
    { name: 'CAPUCCINO', mini: 50, classic: 85, upgrade: 120 },
    { name: 'SPANISH LATTE', mini: 99, classic: 120, upgrade: 150 },
    { name: 'MOCHA', mini: 99, classic: 120, upgrade: 150 },
    { name: 'SEA SALT CARAMEL LATTE', mini: 99, classic: 120, upgrade: 150 },
    { name: 'COFFEE MINT', mini: 99, classic: 120, upgrade: 150 },
    { name: 'RHUMPUCCINO', mini: 99, classic: 135, upgrade: 150 },
    { name: 'BREWED', mini: 25, classic: 50, upgrade: 85 },
  ]},
  { id: 'noncoffee', icon: '🍵', label: 'Non-Coffee', items: [
    { name: 'DIRTY MATCHA', classic: 120, upgrade: 150 },
    { name: 'STRAWBERRY LATTE', classic: 120, upgrade: 150 },
    { name: 'STRAWBERRY MATCHA', classic: 120, upgrade: 150 },
    { name: 'MATCHA LATTE', classic: 120, upgrade: 150 },
    { name: 'MILK CHOCOLATE', classic: 89, upgrade: 120 },
    { name: 'OREO CHOCOMILKSHAKE', classic: 120, upgrade: 150 },
    { name: 'FRAPPE STRAWBERRY', regular: 165 },
    { name: 'FRAPPE UBE HALAYA', regular: 150 },
    { name: 'FRAPPE CARAMEL MACCHIATO', regular: 150 },
  ]},
  { id: 'milktea', icon: '🧋', label: 'Milk Tea', items: [
    { name: 'M.T. - HOKKAIDO', regular: 55 },
    { name: 'M.T. - OKINAWA', regular: 55 },
    { name: 'M.T. - MANGO CHEESECAKE', regular: 60 },
    { name: 'M.T. - RED VELVET', regular: 60 },
    { name: 'M.T. - TARO', regular: 55 },
    { name: 'M.T. - BLACK FOREST', regular: 60 },
    { name: 'M.T. - DARK CHOCOLATE', regular: 60 },
    { name: 'M.T. -COOKIES AND CREAM', regular: 55 },
    { name: 'M.T. - WHITE BUNNY', regular: 60 },
    { name: 'M.T. - WINTERMELON', regular: 60 },
  ]},
  { id: 'soda', icon: '🥤', label: 'Soda & Tea', items: [
    { name: 'SODA - PASSION', classic: 50 },
    { name: 'SODA - STRAWBERRY', classic: 50 },
    { name: 'SODA - BLUEBERRY', classic: 50 },
    { name: 'SODA - MANGO', classic: 50 },
    { name: 'TEA - BREAKFAST IN PARIS', classic: 50 },
    { name: 'TEA - CHAMOMILE', classic: 50 },
    { name: 'TEA - HIBISCUS', classic: 50 },
  ]},
  { id: 'pasta', icon: '🍝', label: 'Pasta', items: [
    { name: 'PASTA - CARBONARA', regular: 129 },
    { name: 'PASTA - BOLOGNESE', regular: 129 },
  ]},
  { id: 'rice', icon: '🍚', label: 'Rice Meals', items: [
    { name: 'TAPSILOG', regular: 129 },
    { name: 'CORNSILOG', regular: 129 },
    { name: 'PORK SISIG RICE', regular: 190 },
    { name: 'PORK EMBOTIDO RICE', regular: 129 },
    { name: 'CHICKEN INASAL RICE', regular: 190 },
    { name: 'LUMPIA RICE', regular: 129 },
    { name: 'PORKCHOP', regular: 150 },
    { name: 'RICE MEAL - C. TAPA', regular: 180 },
    { name: 'RICE MEAL - C. HOTDOG', regular: 80 },
    { name: 'RICE MEAL - C. PEPPER STEAK', regular: 180 },
    { name: 'RICE MEAL - C. KOREAN', regular: 180 },
    { name: 'RICE MEAL - C. INASAL', regular: 180 },
  ]},
  { id: 'pastries', icon: '🥐', label: 'Pastries & Sweets', items: [
    { name: 'WAFFLE - MANGO', regular: 80 },
    { name: 'WAFFLE - CHOCOLATE', regular: 80 },
    { name: 'WAFFLE - OTHER', regular: 80 },
    { name: 'PASTRY - COOKIES', regular: 50 },
    { name: 'COOKIES V2', regular: 35 },
    { name: 'SWEET BITES', regular: 15 },
    { name: 'GRILLED CHEESE SANDWICH', regular: 80 },
  ]},
  { id: 'snacks', icon: '🍟', label: 'Snacks', items: [
    { name: 'CHEESE BURGER', regular: 50 },
    { name: 'ONYX BURGER', regular: 150 },
    { name: 'NACHOS', regular: 130 },
    { name: 'FRIES - BBQ', regular: 30 },
    { name: 'FRIES - SOUR CREAM', regular: 30 },
    { name: 'FRIES - CHEESE', regular: 30 },
  ]},
  { id: 'addons', icon: '➕', label: 'Add-ons', items: [
    { name: 'PEARL', regular: 10 },
    { name: 'ESPRESSO SHOT', regular: 10 },
    { name: 'RICE', regular: 15 },
  ]},
];

const s = {
  page: { padding: '16px 16px 0', animation: 'fadeIn 0.3s ease' },
  title: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 4 },
  sub: { fontSize: 13, color: 'var(--brown-light)', marginBottom: 14 },
  groupCard: { background: 'white', borderRadius: 12, marginBottom: 8, boxShadow: '0 1px 4px rgba(26,10,0,0.06)', overflow: 'hidden' },
  groupHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', cursor: 'pointer' },
  groupLabel: { fontSize: 14, fontWeight: 600, color: 'var(--brown-dark)' },
  itemRow: { display: 'flex', alignItems: 'center', padding: '10px 14px', borderTop: '1px solid #f5ede4' },
  itemName: { fontSize: 12, fontWeight: 600, color: 'var(--brown-dark)', flex: 1 },
  sizeRow: { display: 'flex', gap: 5, flexWrap: 'wrap' },
  sizeBtn: { padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'var(--cream)', color: 'var(--brown-mid)' },
  input: { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e8d8c8', fontSize: 14, background: 'var(--cream)', color: 'var(--brown-dark)', outline: 'none', boxSizing: 'border-box', marginBottom: 10 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--brown-mid)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 },
  orderPanel: { background: 'white', borderRadius: 14, padding: '14px', marginTop: 12, boxShadow: '0 2px 12px rgba(26,10,0,0.10)' },
  orderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f5ede4', fontSize: 12 },
  total: { display: 'flex', justifyContent: 'space-between', padding: '10px 0 4px', fontWeight: 700, fontSize: 17, color: 'var(--brown-dark)' },
  previewBtn: { width: '100%', padding: '13px', borderRadius: 12, background: 'var(--brown-dark)', color: 'var(--gold-light)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', marginTop: 10 },
  modal: { position: 'fixed', inset: 0, background: 'rgba(26,10,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modalCard: { background: 'var(--cream)', borderRadius: '20px 20px 0 0', padding: '28px 24px 40px', width: '100%', maxWidth: 480, animation: 'slideUp 0.3s ease', maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 16, textAlign: 'center' },
  receiptHeader: { textAlign: 'center', marginBottom: 16, borderBottom: '1px dashed #e8d8c8', paddingBottom: 12 },
  receiptRow: { display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', color: 'var(--brown-dark)' },
  receiptTotal: { display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, padding: '10px 0 0', borderTop: '2px solid var(--brown-dark)', marginTop: 6, color: 'var(--brown-dark)' },
  confirmBtn: { width: '100%', padding: '13px', borderRadius: 12, background: 'var(--brown-dark)', color: 'var(--gold-light)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', marginTop: 14 },
  cancelBtn: { width: '100%', padding: '12px', borderRadius: 12, background: 'var(--cream)', color: 'var(--brown-mid)', fontSize: 13, border: '1.5px solid #e8d8c8', cursor: 'pointer', marginTop: 8 },
  connectBtn: { width: '100%', padding: '11px', borderRadius: 10, background: '#1a73e8', color: 'white', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  connectedBadge: { background: 'var(--green-bg)', color: 'var(--green-ok)', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 500, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 },
};

export default function Orders({ userName }) {
  const [openGroup, setOpenGroup] = useState(null);
  const [order, setOrder] = useState([]);
  const [buyerName, setBuyerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const tokenClientRef = React.useRef(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      if (!window.google) return;
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID, scope: SCOPES,
        callback: (res) => { if (res.access_token) setAccessToken(res.access_token); },
      });
    };
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  const addToOrder = (item, size) => {
    const price = item[size];
    if (!price) return;
    const key = `${item.name}_${size}`;
    setOrder(prev => {
      const existing = prev.find(o => o.key === key);
      if (existing) return prev.map(o => o.key === key ? { ...o, qty: o.qty + 1 } : o);
      return [...prev, { key, name: item.name, size: SIZE_LABELS[size], price, qty: 1 }];
    });
  };

  const updateQty = (key, delta) => setOrder(prev => prev.map(o => o.key === key ? { ...o, qty: Math.max(1, o.qty + delta) } : o));
  const removeItem = (key) => setOrder(prev => prev.filter(o => o.key !== key));
  const total = order.reduce((sum, o) => sum + o.price * o.qty, 0);

  const now = new Date();
  const cashier = userName || auth.currentUser?.email?.split('@')[0] || 'Staff';
  const dateStr = now.toLocaleDateString('en-PH', { month: '2-digit', day: '2-digit', year: '2-digit' });
  const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  const pdfName = `${dateStr.replace(/\//g,'-')}-${timeStr.replace(/:/g,'-')}-${cashier}`;

  const generateReceiptHTML = () => `
    <html><head><style>
      body { font-family: 'Times New Roman', serif; max-width: 320px; margin: 0 auto; padding: 20px; }
      .logo { text-align: center; margin-bottom: 8px; }
      .cafe-name { font-size: 20px; font-weight: bold; letter-spacing: 2px; text-align: center; }
      .sub { font-size: 11px; text-align: center; color: #555; margin-bottom: 12px; }
      .divider { border-top: 1px dashed #333; margin: 8px 0; }
      .row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; }
      .total-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; padding: 6px 0; border-top: 2px solid #333; margin-top: 4px; }
      .footer { text-align: center; font-size: 10px; color: #777; margin-top: 12px; }
    </style></head><body>
      <div class="cafe-name">THEONYX CAFE</div>
      <div class="sub">Receipt</div>
      <div class="divider"></div>
      <div class="row"><span>Date:</span><span>${dateStr}</span></div>
      <div class="row"><span>Time:</span><span>${timeStr}</span></div>
      <div class="row"><span>Cashier:</span><span>${cashier}</span></div>
      ${buyerName ? `<div class="row"><span>Buyer:</span><span>${buyerName}</span></div>` : ''}
      <div class="row"><span>Payment:</span><span>${paymentMethod}</span></div>
      <div class="divider"></div>
      ${order.map(o => `<div class="row"><span>${o.name} (${o.size}) x${o.qty}</span><span>₱${(o.price * o.qty).toLocaleString()}</span></div>`).join('')}
      <div class="total-row"><span>TOTAL</span><span>₱${total.toLocaleString()}</span></div>
      <div class="divider"></div>
      ${notes ? `<div class="row"><span>Notes:</span><span>${notes}</span></div>` : ''}
      <div class="footer">Thank you for visiting Theonyx Cafe!<br/>Follow us @theonyx.cafe</div>
    </body></html>
  `;

  const saveOrder = async () => {
    setSaving(true);
    const now = new Date();
    try {
      // Save to Firebase
      await addDoc(collection(db, 'orders'), {
        items: order, total, buyerName, paymentMethod, notes,
        cashier, createdAt: serverTimestamp(),
      });

      // Save to Google Sheets (one row per item)
      if (accessToken) {
        const rows = order.map(o => [
          dateStr, o.name, o.size, o.qty, paymentMethod, cashier, o.price * o.qty, notes || ''
        ]);
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SALES_SHEET_ID}/values/Sheet1!A:H:append?valueInputOption=USER_ENTERED`,
          { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: rows }) }
        );

        // Generate and upload PDF receipt to Drive
        const htmlContent = generateReceiptHTML();
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify({ name: `${pdfName}.html`, parents: [RECEIPT_FOLDER_ID], mimeType: 'text/html' })], { type: 'application/json' }));
        form.append('file', blob);
        await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form });
      }

      setSaved(true);
      setOrder([]);
      setBuyerName('');
      setNotes('');
      setShowPreview(false);
      setTimeout(() => setSaved(false), 4000);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <div style={s.page}>
      <div style={s.title}>Orders</div>
      <div style={s.sub}>Tap a size to add · {order.length} item{order.length !== 1 ? 's' : ''} in order</div>

      {!accessToken
        ? <button style={s.connectBtn} onClick={() => tokenClientRef.current?.requestAccessToken()}>🔗 Connect Google (Sheets + Drive)</button>
        : <div style={s.connectedBadge}>✅ Connected — orders will sync to Sheets</div>
      }

      {saved && <div style={{ background: 'var(--green-bg)', color: 'var(--green-ok)', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>✅ Order saved successfully!</div>}

      {/* Buyer name + payment */}
      <label style={s.label}>Buyer Name (optional)</label>
      <input style={s.input} placeholder="Customer name..." value={buyerName} onChange={e => setBuyerName(e.target.value)} />
      <label style={s.label}>Payment Method</label>
      <select style={s.input} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
        {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
      </select>

      {/* Menu groups */}
      {MENU_GROUPS.map(group => (
        <div key={group.id} style={s.groupCard}>
          <div style={s.groupHeader} onClick={() => setOpenGroup(openGroup === group.id ? null : group.id)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>{group.icon}</span>
              <span style={s.groupLabel}>{group.label}</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--brown-light)', transition: 'transform 0.2s', transform: openGroup === group.id ? 'rotate(180deg)' : 'none' }}>▼</span>
          </div>
          {openGroup === group.id && group.items.map((item, i) => (
            <div key={i} style={s.itemRow}>
              <span style={s.itemName}>{item.name}</span>
              <div style={s.sizeRow}>
                {SIZES.filter(s => item[s]).map(size => (
                  <button key={size} style={s.sizeBtn} onClick={() => addToOrder(item, size)}>
                    {SIZE_LABELS[size]} ₱{item[size]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Current order summary */}
      {order.length > 0 && (
        <div style={s.orderPanel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--brown-dark)' }}>Order Summary</span>
            <button style={{ background: 'none', border: 'none', color: 'var(--red-crit)', fontSize: 12, cursor: 'pointer' }} onClick={() => setOrder([])}>Clear all</button>
          </div>
          {order.map(o => (
            <div key={o.key} style={s.orderRow}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brown-dark)' }}>{o.name}</div>
                <div style={{ fontSize: 11, color: 'var(--brown-light)' }}>{o.size} · ₱{o.price}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brown-mid)', fontSize: 14, padding: '0 4px' }} onClick={() => updateQty(o.key, -1)}>−</button>
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 16, textAlign: 'center' }}>{o.qty}</span>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brown-mid)', fontSize: 14, padding: '0 4px' }} onClick={() => updateQty(o.key, 1)}>+</button>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red-crit)', fontSize: 14, padding: '0 4px' }} onClick={() => removeItem(o.key)}>✕</button>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brown-dark)', minWidth: 50, textAlign: 'right' }}>₱{(o.price * o.qty).toLocaleString()}</span>
              </div>
            </div>
          ))}
          <div style={s.total}><span>TOTAL</span><span>₱{total.toLocaleString()}</span></div>
          <label style={{ ...s.label, marginTop: 10 }}>Notes (optional)</label>
          <input style={s.input} placeholder="Special instructions..." value={notes} onChange={e => setNotes(e.target.value)} />
          <button style={s.previewBtn} onClick={() => setShowPreview(true)}>🧾 Preview & Save Order</button>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div style={s.modal} onClick={() => setShowPreview(false)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Order Receipt</div>
            <div style={s.receiptHeader}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--brown-dark)', letterSpacing: 1 }}>THEONYX CAFE</div>
              <div style={{ fontSize: 12, color: 'var(--brown-light)', marginTop: 4 }}>{dateStr} · {timeStr}</div>
              <div style={{ fontSize: 12, color: 'var(--brown-light)' }}>Cashier: {cashier}</div>
              {buyerName && <div style={{ fontSize: 12, color: 'var(--brown-light)' }}>Buyer: {buyerName}</div>}
              <div style={{ fontSize: 12, color: 'var(--brown-light)' }}>Payment: {paymentMethod}</div>
            </div>
            {order.map(o => (
              <div key={o.key} style={s.receiptRow}>
                <span>{o.name} ({o.size}) x{o.qty}</span>
                <span>₱{(o.price * o.qty).toLocaleString()}</span>
              </div>
            ))}
            <div style={s.receiptTotal}><span>TOTAL</span><span>₱{total.toLocaleString()}</span></div>
            {notes && <div style={{ fontSize: 12, color: 'var(--brown-light)', marginTop: 8 }}>Notes: {notes}</div>}
            <button style={s.confirmBtn} onClick={saveOrder} disabled={saving}>
              {saving ? 'Saving...' : '✅ Confirm & Save'}
            </button>
            <button style={{ ...s.confirmBtn, background: '#1a73e8', marginTop: 8 }} onClick={() => {
              const w = window.open('', '_blank');
              w.document.write(generateReceiptHTML());
              w.document.close();
              w.focus();
              setTimeout(() => { w.print(); }, 500);
            }}>🖨️ Print / Save as PDF</button>
            <button style={s.cancelBtn} onClick={() => setShowPreview(false)}>Back to Edit</button>
          </div>
        </div>
      )}
      <div style={{ height: 100 }} />
    </div>
  );
}
