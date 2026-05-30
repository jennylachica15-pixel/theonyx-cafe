import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, serverTimestamp, query, orderBy
} from 'firebase/firestore';

const CATEGORIES = ['Beans & Coffee', 'Milk & Cream', 'Syrups', 'Food & Pastries', 'Cups & Packaging', 'Equipment', 'Other'];
const UNITS = ['kg', 'g', 'liters', 'ml', 'pcs', 'bottles', 'boxes', 'bags'];

function getStatus(qty, threshold) {
  if (qty <= 0) return 'out';
  if (qty <= threshold) return 'low';
  if (qty <= threshold * 2) return 'warn';
  return 'ok';
}

const STATUS_CONFIG = {
  ok:   { label: 'OK',       bg: 'var(--green-bg)',  color: 'var(--green-ok)' },
  warn: { label: 'Low',      bg: 'var(--orange-bg)', color: 'var(--orange-warn)' },
  low:  { label: 'Critical', bg: 'var(--red-bg)',    color: 'var(--red-crit)' },
  out:  { label: 'Out',      bg: '#f0f0f0',          color: '#888' },
};

const s = {
  page: { padding: '16px 16px 0', animation: 'fadeIn 0.3s ease' },
  sectionTitle: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: 'var(--brown-light)', marginBottom: 16 },
  addBtn: {
    width: '100%', padding: '13px', borderRadius: 12, background: 'var(--brown-dark)',
    color: 'var(--gold-light)', fontSize: 14, fontWeight: 600, marginBottom: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  card: {
    background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 10,
    boxShadow: '0 1px 6px rgba(26,10,0,0.07)', display: 'flex', alignItems: 'center', gap: 12,
  },
  iconBox: (cat) => ({
    width: 44, height: 44, borderRadius: 10, background: 'var(--cream)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
  }),
  itemName: { fontSize: 15, fontWeight: 600, color: 'var(--brown-dark)', margin: 0 },
  itemSub: { fontSize: 12, color: 'var(--brown-light)', margin: '2px 0 0' },
  badge: (status) => ({
    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    background: STATUS_CONFIG[status].bg, color: STATUS_CONFIG[status].color,
    marginLeft: 'auto', flexShrink: 0,
  }),
  actions: { display: 'flex', gap: 6, marginTop: 8 },
  actionBtn: (color) => ({
    flex: 1, padding: '7px', borderRadius: 8, fontSize: 12, fontWeight: 500,
    background: color === 'danger' ? 'var(--red-bg)' : 'var(--cream)',
    color: color === 'danger' ? 'var(--red-crit)' : 'var(--brown-mid)',
  }),
  modal: {
    position: 'fixed', inset: 0, background: 'rgba(26,10,0,0.55)', zIndex: 200,
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  modalCard: {
    background: 'var(--cream)', borderRadius: '20px 20px 0 0', padding: '28px 24px 40px',
    width: '100%', maxWidth: 480, animation: 'slideUp 0.3s ease',
    maxHeight: '90vh', overflowY: 'auto',
  },
  modalTitle: { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 20, color: 'var(--brown-dark)' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--brown-mid)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e8d8c8',
    fontSize: 14, background: 'white', color: 'var(--brown-dark)', marginBottom: 14, outline: 'none',
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  saveBtn: {
    width: '100%', padding: '14px', borderRadius: 12, background: 'var(--brown-dark)',
    color: 'var(--gold-light)', fontSize: 15, fontWeight: 600, marginTop: 4,
  },
  cancelBtn: {
    width: '100%', padding: '13px', borderRadius: 12, background: 'var(--cream)',
    color: 'var(--brown-mid)', fontSize: 14, fontWeight: 500, marginTop: 8,
    border: '1.5px solid #e8d8c8',
  },
  catFilter: { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 8 },
  catChip: (active) => ({
    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, flexShrink: 0,
    background: active ? 'var(--brown-dark)' : 'white', color: active ? 'var(--gold-light)' : 'var(--brown-mid)',
    border: '1.5px solid', borderColor: active ? 'var(--brown-dark)' : '#e8d8c8',
    cursor: 'pointer',
  }),
  empty: { textAlign: 'center', padding: '40px 0', color: 'var(--brown-light)' },
  statsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 },
  statCard: (color) => ({
    background: 'white', borderRadius: 12, padding: '12px', textAlign: 'center',
    boxShadow: '0 1px 4px rgba(26,10,0,0.07)',
  }),
  statNum: (color) => ({ fontSize: 24, fontWeight: 700, color }),
  statLabel: { fontSize: 11, color: 'var(--brown-light)', marginTop: 2 },
};

const CAT_ICONS = {
  'Beans & Coffee': '☕', 'Milk & Cream': '🥛', 'Syrups': '🍯',
  'Food & Pastries': '🥐', 'Cups & Packaging': '🥤', 'Equipment': '⚙️', 'Other': '📦'
};

const DEFAULT_FORM = { name: '', category: 'Beans & Coffee', quantity: '', unit: 'kg', threshold: '', notes: '' };

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editId, setEditId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [filterCat, setFilterCat] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'inventory'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const openAdd = () => { setForm(DEFAULT_FORM); setEditId(null); setShowModal(true); };
  const openEdit = (item) => {
    setForm({ name: item.name, category: item.category, quantity: item.quantity, unit: item.unit, threshold: item.threshold, notes: item.notes || '' });
    setEditId(item.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || form.quantity === '') return;
    const data = { name: form.name, category: form.category, quantity: Number(form.quantity), unit: form.unit, threshold: Number(form.threshold) || 5, notes: form.notes, updatedAt: serverTimestamp() };
    if (editId) {
      await updateDoc(doc(db, 'inventory', editId), data);
    } else {
      await addDoc(collection(db, 'inventory'), { ...data, createdAt: serverTimestamp() });
    }
    setShowModal(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this item?')) await deleteDoc(doc(db, 'inventory', id));
  };

  const filtered = filterCat === 'All' ? items : items.filter(i => i.category === filterCat);
  const lowCount = items.filter(i => getStatus(i.quantity, i.threshold) !== 'ok').length;
  const outCount = items.filter(i => i.quantity <= 0).length;

  return (
    <div style={s.page}>
      <div style={s.sectionTitle}>Inventory</div>
      <div style={s.sectionSub}>THEONYX CAFE · {items.length} items</div>

      <div style={s.statsRow}>
        <div style={s.statCard()}>
          <div style={s.statNum('var(--brown-dark)')}>{items.length}</div>
          <div style={s.statLabel}>Total</div>
        </div>
        <div style={s.statCard()}>
          <div style={s.statNum('var(--orange-warn)')}>{lowCount}</div>
          <div style={s.statLabel}>Low Stock</div>
        </div>
        <div style={s.statCard()}>
          <div style={s.statNum('var(--red-crit)')}>{outCount}</div>
          <div style={s.statLabel}>Out</div>
        </div>
      </div>

      <button style={s.addBtn} onClick={openAdd}>＋ Add Item</button>

      <div style={s.catFilter}>
        {['All', ...CATEGORIES].map(c => (
          <div key={c} style={s.catChip(filterCat === c)} onClick={() => setFilterCat(c)}>{c}</div>
        ))}
      </div>

      {loading && <div style={s.empty}>Loading inventory...</div>}
      {!loading && filtered.length === 0 && <div style={s.empty}>No items yet. Tap "+ Add Item" to start!</div>}

      {filtered.map(item => {
        const status = getStatus(item.quantity, item.threshold);
        const expanded = expandedId === item.id;
        return (
          <div key={item.id} style={s.card} onClick={() => setExpandedId(expanded ? null : item.id)}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={s.iconBox()}>{CAT_ICONS[item.category] || '📦'}</div>
                <div style={{ flex: 1 }}>
                  <p style={s.itemName}>{item.name}</p>
                  <p style={s.itemSub}>{item.quantity} {item.unit} · {item.category}</p>
                </div>
                <span style={s.badge(status)}>{STATUS_CONFIG[status].label}</span>
              </div>
              {expanded && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f0e4d8' }}>
                  {item.notes && <p style={{ fontSize: 12, color: 'var(--brown-light)', marginBottom: 8 }}>{item.notes}</p>}
                  <p style={{ fontSize: 11, color: '#bbb', marginBottom: 8 }}>Alert threshold: {item.threshold} {item.unit}</p>
                  <div style={s.actions}>
                    <button style={s.actionBtn()} onClick={(e) => { e.stopPropagation(); openEdit(item); }}>✏️ Edit</button>
                    <button style={s.actionBtn('danger')} onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}>🗑 Delete</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {showModal && (
        <div style={s.modal} onClick={() => setShowModal(false)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>{editId ? 'Edit Item' : 'Add New Item'}</div>

            <label style={s.label}>Item Name</label>
            <input style={s.input} placeholder="e.g. Arabica Beans" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />

            <label style={s.label}>Category</label>
            <select style={s.input} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>

            <div style={s.row2}>
              <div>
                <label style={s.label}>Quantity</label>
                <input style={s.input} type="number" placeholder="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
              </div>
              <div>
                <label style={s.label}>Unit</label>
                <select style={s.input} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <label style={s.label}>Low Stock Alert (threshold)</label>
            <input style={s.input} type="number" placeholder="e.g. 5" value={form.threshold} onChange={e => setForm({ ...form, threshold: e.target.value })} />

            <label style={s.label}>Notes (optional)</label>
            <input style={s.input} placeholder="e.g. Supplier: ABC Trading" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />

            <button style={s.saveBtn} onClick={handleSave}>{editId ? 'Save Changes' : 'Add Item'}</button>
            <button style={s.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
