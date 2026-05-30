import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';

const DEFAULT_MENU = [
  { name: 'COFFEE LATTE', mini: 75, classic: 85, upgrade: 95, regular: null },
  { name: 'CARAMEL MACCHIATO', mini: 99, classic: 120, upgrade: 150, regular: null },
  { name: 'AMERICANO', mini: 50, classic: 75, upgrade: 99, regular: null },
  { name: 'CAPUCCINO', mini: 50, classic: 85, upgrade: 120, regular: null },
  { name: 'SPANISH LATTE', mini: 99, classic: 120, upgrade: 150, regular: null },
  { name: 'MOCHA', mini: 99, classic: 120, upgrade: 150, regular: null },
  { name: 'SEA SALT CARAMEL LATTE', mini: 99, classic: 120, upgrade: 150, regular: null },
  { name: 'COFFEE MINT', mini: 99, classic: 120, upgrade: 150, regular: null },
  { name: 'RHUMPUCCINO', mini: 99, classic: 135, upgrade: 150, regular: null },
  { name: 'DIRTY MATCHA', mini: null, classic: 120, upgrade: 150, regular: null },
  { name: 'STRAWBERRY LATTE', mini: null, classic: 120, upgrade: 150, regular: null },
  { name: 'STRAWBERRY MATCHA', mini: null, classic: 120, upgrade: 150, regular: null },
  { name: 'MATCHA LATTE', mini: null, classic: 120, upgrade: 150, regular: null },
  { name: 'MILK CHOCOLATE', mini: null, classic: 89, upgrade: 120, regular: null },
  { name: 'OREO CHOCOMILKSHAKE', mini: null, classic: 120, upgrade: 150, regular: null },
  { name: 'SODA - PASSION', mini: null, classic: 50, upgrade: null, regular: null },
  { name: 'SODA - STRAWBERRY', mini: null, classic: 50, upgrade: null, regular: null },
  { name: 'SODA - BLUEBERRY', mini: null, classic: 50, upgrade: null, regular: null },
  { name: 'SODA - MANGO', mini: null, classic: 50, upgrade: null, regular: null },
  { name: 'TEA - BREAKFAST IN PARIS', mini: null, classic: 50, upgrade: null, regular: null },
  { name: 'TEA - CHAMOMILE', mini: null, classic: 50, upgrade: null, regular: null },
  { name: 'TEA - HIBISCUS', mini: null, classic: 50, upgrade: null, regular: null },
  { name: 'BREWED', mini: 25, classic: 50, upgrade: 85, regular: null },
  { name: 'WAFFLE - MANGO', mini: null, classic: null, upgrade: null, regular: 80 },
  { name: 'WAFFLE - CHOCOLATE', mini: null, classic: null, upgrade: null, regular: 80 },
  { name: 'WAFFLE - OTHER', mini: null, classic: null, upgrade: null, regular: 80 },
  { name: 'CHEESE BURGER', mini: null, classic: null, upgrade: null, regular: 50 },
  { name: 'ONYX BURGER', mini: null, classic: null, upgrade: null, regular: 150 },
  { name: 'PASTA - CARBONARA', mini: null, classic: null, upgrade: null, regular: 129 },
  { name: 'PASTA - BOLOGNESE', mini: null, classic: null, upgrade: null, regular: 129 },
  { name: 'M.T. - HOKKAIDO', mini: null, classic: null, upgrade: null, regular: 55 },
  { name: 'M.T. - OKINAWA', mini: null, classic: null, upgrade: null, regular: 55 },
  { name: 'M.T. - MANGO CHEESECAKE', mini: null, classic: null, upgrade: null, regular: 60 },
  { name: 'M.T. - RED VELVET', mini: null, classic: null, upgrade: null, regular: 60 },
  { name: 'M.T. - TARO', mini: null, classic: null, upgrade: null, regular: 55 },
  { name: 'M.T. - BLACK FOREST', mini: null, classic: null, upgrade: null, regular: 60 },
  { name: 'M.T. - DARK CHOCOLATE', mini: null, classic: null, upgrade: null, regular: 60 },
  { name: 'M.T. -COOKIES AND CREAM', mini: null, classic: null, upgrade: null, regular: 55 },
  { name: 'M.T. - WHITE BUNNY', mini: null, classic: null, upgrade: null, regular: 60 },
  { name: 'M.T. - WINTERMELON', mini: null, classic: null, upgrade: null, regular: 60 },
  { name: 'PASTRY - COOKIES', mini: null, classic: null, upgrade: null, regular: 50 },
  { name: 'COOKIES V2', mini: null, classic: null, upgrade: null, regular: 35 },
  { name: 'FRIES - BBQ', mini: null, classic: null, upgrade: null, regular: 30 },
  { name: 'FRIES - SOUR CREAM', mini: null, classic: null, upgrade: null, regular: 30 },
  { name: 'FRIES - CHEESE', mini: null, classic: null, upgrade: null, regular: 30 },
  { name: 'NACHOS', mini: null, classic: null, upgrade: null, regular: 130 },
  { name: 'SWEET BITES', mini: null, classic: null, upgrade: null, regular: 15 },
  { name: 'FRAPPE STRAWBERRY', mini: null, classic: null, upgrade: null, regular: 165 },
  { name: 'FRAPPE UBE HALAYA', mini: null, classic: null, upgrade: null, regular: 150 },
  { name: 'FRAPPE CARAMEL MACCHIATO', mini: null, classic: null, upgrade: null, regular: 150 },
  { name: 'ESPRESSO SHOT', mini: null, classic: null, upgrade: null, regular: 10 },
  { name: 'PEARL', mini: null, classic: null, upgrade: null, regular: 10 },
  { name: 'RICE', mini: null, classic: null, upgrade: null, regular: 15 },
  { name: 'TAPSILOG', mini: null, classic: null, upgrade: null, regular: 129 },
  { name: 'CORNSILOG', mini: null, classic: null, upgrade: null, regular: 129 },
  { name: 'PORK SISIG RICE', mini: null, classic: null, upgrade: null, regular: 190 },
  { name: 'GRILLED CHEESE SANDWICH', mini: null, classic: null, upgrade: null, regular: 80 },
  { name: 'PORK EMBOTIDO RICE', mini: null, classic: null, upgrade: null, regular: 129 },
  { name: 'CHICKEN INASAL RICE', mini: null, classic: null, upgrade: null, regular: 190 },
  { name: 'LUMPIA RICE', mini: null, classic: null, upgrade: null, regular: 129 },
  { name: 'PORKCHOP', mini: null, classic: null, upgrade: null, regular: 150 },
  { name: 'RICE MEAL - C. TAPA', mini: null, classic: null, upgrade: null, regular: 180 },
  { name: 'RICE MEAL - C. HOTDOG', mini: null, classic: null, upgrade: null, regular: 80 },
  { name: 'RICE MEAL - C. PEPPER STEAK', mini: null, classic: null, upgrade: null, regular: 180 },
  { name: 'RICE MEAL - C. KOREAN', mini: null, classic: null, upgrade: null, regular: 180 },
  { name: 'RICE MEAL - C. INASAL', mini: null, classic: null, upgrade: null, regular: 180 },
];

const SIZES = ['mini', 'classic', 'upgrade', 'regular'];
const SIZE_LABELS = { mini: 'Mini', classic: 'Classic', upgrade: 'Upgrade', regular: 'Regular' };

const s = {
  page: { padding: '16px 16px 0', animation: 'fadeIn 0.3s ease' },
  title: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 4 },
  sub: { fontSize: 13, color: 'var(--brown-light)', marginBottom: 16 },
  search: { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e8d8c8', fontSize: 14, background: 'white', color: 'var(--brown-dark)', marginBottom: 14, outline: 'none', boxSizing: 'border-box' },
  menuItem: { background: 'white', borderRadius: 12, padding: '12px 14px', marginBottom: 8, boxShadow: '0 1px 4px rgba(26,10,0,0.06)' },
  itemName: { fontSize: 13, fontWeight: 600, color: 'var(--brown-dark)', marginBottom: 8 },
  sizeRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  sizeBtn: (active) => ({
    padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
    background: active ? 'var(--brown-dark)' : 'var(--cream)',
    color: active ? 'var(--gold-light)' : 'var(--brown-mid)',
  }),
  orderPanel: {
    position: 'sticky', bottom: 70, background: 'white', borderRadius: '14px 14px 0 0',
    padding: '14px 16px', boxShadow: '0 -4px 20px rgba(26,10,0,0.12)', marginTop: 16,
  },
  orderTitle: { fontSize: 14, fontWeight: 600, color: 'var(--brown-dark)', marginBottom: 10 },
  orderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f5ede4', fontSize: 13 },
  total: { display: 'flex', justifyContent: 'space-between', padding: '10px 0 4px', fontWeight: 700, fontSize: 16, color: 'var(--brown-dark)' },
  clearBtn: { background: 'var(--red-bg)', color: 'var(--red-crit)', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' },
  saveBtn: { background: 'var(--brown-dark)', color: 'var(--gold-light)', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, width: '100%', marginTop: 10, border: 'none', cursor: 'pointer' },
  removeBtn: { background: 'none', border: 'none', color: 'var(--red-crit)', fontSize: 16, cursor: 'pointer', padding: '0 4px' },
};

export default function Orders({ userRole }) {
  const [menuItems, setMenuItems] = useState(DEFAULT_MENU);
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'menuItems'), snap => {
      if (!snap.empty) setMenuItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
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

  const removeFromOrder = (key) => setOrder(prev => prev.filter(o => o.key !== key));
  const updateQty = (key, delta) => {
    setOrder(prev => prev.map(o => o.key === key ? { ...o, qty: Math.max(1, o.qty + delta) } : o).filter(o => o.qty > 0));
  };

  const total = order.reduce((sum, o) => sum + o.price * o.qty, 0);

  const saveOrder = async () => {
    if (order.length === 0) return;
    await addDoc(collection(db, 'orders'), {
      items: order,
      total,
      createdAt: serverTimestamp(),
    });
    setSaved(true);
    setOrder([]);
    setTimeout(() => setSaved(false), 3000);
  };

  const filtered = menuItems.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={s.page}>
      <div style={s.title}>Orders</div>
      <div style={s.sub}>Tap a size to add to order</div>

      <input style={s.search} placeholder="🔍 Search menu..." value={search} onChange={e => setSearch(e.target.value)} />

      {saved && <div style={{ background: 'var(--green-bg)', color: 'var(--green-ok)', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>✅ Order saved!</div>}

      {filtered.map((item, i) => {
        const availSizes = SIZES.filter(s => item[s]);
        if (availSizes.length === 0) return null;
        return (
          <div key={i} style={s.menuItem}>
            <div style={s.itemName}>{item.name}</div>
            <div style={s.sizeRow}>
              {availSizes.map(size => (
                <button key={size} style={s.sizeBtn(false)} onClick={() => addToOrder(item, size)}>
                  {SIZE_LABELS[size]} ₱{item[size]}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {order.length > 0 && (
        <div style={s.orderPanel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={s.orderTitle}>Current Order</div>
            <button style={s.clearBtn} onClick={() => setOrder([])}>Clear</button>
          </div>
          {order.map(o => (
            <div key={o.key} style={s.orderRow}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brown-dark)' }}>{o.name}</div>
                <div style={{ fontSize: 11, color: 'var(--brown-light)' }}>{o.size} · ₱{o.price}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button style={{ ...s.removeBtn, fontSize: 14 }} onClick={() => updateQty(o.key, -1)}>−</button>
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 16, textAlign: 'center' }}>{o.qty}</span>
                <button style={{ ...s.removeBtn, fontSize: 14, color: 'var(--green-ok)' }} onClick={() => updateQty(o.key, 1)}>+</button>
                <button style={s.removeBtn} onClick={() => removeFromOrder(o.key)}>✕</button>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brown-dark)', minWidth: 48, textAlign: 'right' }}>₱{o.price * o.qty}</span>
              </div>
            </div>
          ))}
          <div style={s.total}>
            <span>TOTAL</span>
            <span>₱{total.toLocaleString()}</span>
          </div>
          <button style={s.saveBtn} onClick={saveOrder}>💾 Save Order</button>
        </div>
      )}
      <div style={{ height: 80 }} />
    </div>
  );
}
