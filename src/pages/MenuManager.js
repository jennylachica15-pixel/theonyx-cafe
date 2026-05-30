import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore';

const SIZES = ['mini', 'classic', 'upgrade', 'regular'];
const SIZE_LABELS = { mini: 'Mini', classic: 'Classic', upgrade: 'Upgrade', regular: 'Regular' };
const BLANK = { name: '', mini: '', classic: '', upgrade: '', regular: '' };

const s = {
  page: { padding: '16px 16px 0', animation: 'fadeIn 0.3s ease' },
  title: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 4 },
  sub: { fontSize: 13, color: 'var(--brown-light)', marginBottom: 16 },
  addBtn: { width: '100%', padding: '13px', borderRadius: 12, background: 'var(--brown-dark)', color: 'var(--gold-light)', fontSize: 14, fontWeight: 600, marginBottom: 16, border: 'none', cursor: 'pointer' },
  card: { background: 'white', borderRadius: 12, padding: '12px 14px', marginBottom: 8, boxShadow: '0 1px 4px rgba(26,10,0,0.06)' },
  itemName: { fontSize: 14, fontWeight: 600, color: 'var(--brown-dark)', marginBottom: 6 },
  prices: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  priceChip: { background: 'var(--cream)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: 'var(--brown-mid)' },
  actionRow: { display: 'flex', gap: 8 },
  editBtn: { flex: 1, padding: '7px', borderRadius: 8, background: 'var(--cream)', color: 'var(--brown-mid)', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer' },
  deleteBtn: { flex: 1, padding: '7px', borderRadius: 8, background: 'var(--red-bg)', color: 'var(--red-crit)', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer' },
  modal: { position: 'fixed', inset: 0, background: 'rgba(26,10,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modalCard: { background: 'var(--cream)', borderRadius: '20px 20px 0 0', padding: '28px 24px 40px', width: '100%', maxWidth: 480, animation: 'slideUp 0.3s ease', maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 20, color: 'var(--brown-dark)' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--brown-mid)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e8d8c8', fontSize: 14, background: 'white', color: 'var(--brown-dark)', marginBottom: 12, outline: 'none', boxSizing: 'border-box' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  saveBtn: { width: '100%', padding: '14px', borderRadius: 12, background: 'var(--brown-dark)', color: 'var(--gold-light)', fontSize: 15, fontWeight: 600, marginTop: 4, border: 'none', cursor: 'pointer' },
  cancelBtn: { width: '100%', padding: '13px', borderRadius: 12, background: 'var(--cream)', color: 'var(--brown-mid)', fontSize: 14, fontWeight: 500, marginTop: 8, border: '1.5px solid #e8d8c8', cursor: 'pointer' },
};

export default function MenuManager() {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'menuItems'), snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const openAdd = () => { setForm(BLANK); setEditId(null); setShowModal(true); };
  const openEdit = (item) => { setForm({ name: item.name, mini: item.mini || '', classic: item.classic || '', upgrade: item.upgrade || '', regular: item.regular || '' }); setEditId(item.id); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name) return;
    const data = {
      name: form.name.toUpperCase(),
      mini: form.mini ? Number(form.mini) : null,
      classic: form.classic ? Number(form.classic) : null,
      upgrade: form.upgrade ? Number(form.upgrade) : null,
      regular: form.regular ? Number(form.regular) : null,
    };
    if (editId) await updateDoc(doc(db, 'menuItems', editId), data);
    else await addDoc(collection(db, 'menuItems'), data);
    setShowModal(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this menu item?')) await deleteDoc(doc(db, 'menuItems', id));
  };

  const filtered = items.filter(i => i.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={s.page}>
      <div style={s.title}>Menu Manager</div>
      <div style={s.sub}>Add, edit or remove menu items</div>

      <button style={s.addBtn} onClick={openAdd}>＋ Add Menu Item</button>

      <input style={{ ...s.input, marginBottom: 14 }} placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} />

      {filtered.length === 0 && <div style={{ textAlign: 'center', color: 'var(--brown-light)', padding: '24px 0', fontSize: 13 }}>No items yet. Tap "+ Add Menu Item" to start.</div>}

      {filtered.map(item => (
        <div key={item.id} style={s.card}>
          <div style={s.itemName}>{item.name}</div>
          <div style={s.prices}>
            {SIZES.filter(s => item[s]).map(size => (
              <span key={size} style={s.priceChip}>{SIZE_LABELS[size]}: ₱{item[size]}</span>
            ))}
          </div>
          <div style={s.actionRow}>
            <button style={s.editBtn} onClick={() => openEdit(item)}>✏️ Edit</button>
            <button style={s.deleteBtn} onClick={() => handleDelete(item.id)}>🗑 Delete</button>
          </div>
        </div>
      ))}

      {showModal && (
        <div style={s.modal} onClick={() => setShowModal(false)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>{editId ? 'Edit Item' : 'Add Menu Item'}</div>
            <label style={s.label}>Item Name</label>
            <input style={s.input} placeholder="e.g. COFFEE LATTE" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <label style={s.label}>Prices (leave blank if size not available)</label>
            <div style={s.grid2}>
              {SIZES.map(size => (
                <div key={size}>
                  <label style={{ ...s.label, marginBottom: 3 }}>{SIZE_LABELS[size]}</label>
                  <input style={s.input} type="number" placeholder="₱" value={form[size]} onChange={e => setForm({ ...form, [size]: e.target.value })} />
                </div>
              ))}
            </div>
            <button style={s.saveBtn} onClick={handleSave}>{editId ? 'Save Changes' : 'Add Item'}</button>
            <button style={s.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
          </div>
        </div>
      )}
      <div style={{ height: 80 }} />
    </div>
  );
}
