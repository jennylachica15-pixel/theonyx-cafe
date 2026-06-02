import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, serverTimestamp, query, orderBy
} from 'firebase/firestore';

// ── CONFIG ───────────────────────────────────────────────────────────────────
const SHEET_ID        = '1Gnr_6SBcUBY4GcDqvGpTUZgE8NI3OIZAzlusG5YPfQg';
const SHEET_NAME      = 'Sheet1';
const SCOPES          = 'https://www.googleapis.com/auth/spreadsheets';
const GOOGLE_CLIENT_ID = '596322682185-n5hm66hvol3nnqqllnuop995kcnefbgu.apps.googleusercontent.com';

const CATEGORIES = ['Beans & Coffee','Milk & Cream','Syrups','Food & Pastries','Cups & Packaging','Equipment','Other'];
const UNITS      = ['kg','g','liters','ml','pcs','bottles','boxes','bags'];

function getStatus(qty, threshold) {
  if (qty <= 0)             return 'out';
  if (qty <= threshold)     return 'low';
  if (qty <= threshold * 2) return 'warn';
  return 'ok';
}

const STATUS_CONFIG = {
  ok:   { label: 'OK',       bg: '#f0faf4', color: '#2d7a4f' },
  warn: { label: 'Low',      bg: '#fff8ee', color: '#c97c2a' },
  low:  { label: 'Critical', bg: '#fff0ee', color: '#c94030' },
  out:  { label: 'Out',      bg: '#f5f5f5', color: '#999'    },
};

const DEFAULT_FORM = { name:'', category:'Beans & Coffee', quantity:'', unit:'kg', threshold:'', notes:'' };

// ── SVG ICONS ────────────────────────────────────────────────────────────────
const IC = {
  check:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  plus:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  link:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  edit:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>,
  trash:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>,
  upload:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  alert:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  box:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3"/><path d="M21 8H3l1 12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2Z"/></svg>,
  restockLg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
};

// Category SVG icons
const CAT_SVG = {
  'Beans & Coffee': { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>, bg:'#fff8ee', color:'#c97c2a' },
  'Milk & Cream':   { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2h8l2 6H6L8 2z"/><path d="M6 8c0 8 2 12 6 12s6-4 6-12"/></svg>, bg:'#f0f7ff', color:'#3a7acc' },
  'Syrups':         { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6l1 7H8L9 3z"/><path d="M8 10c0 6 1.5 9 4 9s4-3 4-9"/><path d="M7 14h10"/></svg>, bg:'#fdf0ff', color:'#9b4ac7' },
  'Food & Pastries':{ icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>, bg:'#fff5f0', color:'#c96040' },
  'Cups & Packaging':{ icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3"/><path d="M21 8H3l1 12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2Z"/></svg>, bg:'#f0f7ff', color:'#3a7acc' },
  'Equipment':      { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>, bg:'#f5f5f5', color:'#777' },
  'Other':          { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>, bg:'#f5f5f5', color:'#888' },
};

// ── STYLES ───────────────────────────────────────────────────────────────────
const s = {
  page:      { padding:'16px 16px 0', fontFamily:"-apple-system,'SF Pro Display','Helvetica Neue',sans-serif" },
  title:     { fontSize:24, fontWeight:700, color:'#1a1a1a', letterSpacing:'-0.5px', marginBottom:2 },
  sub:       { fontSize:13, color:'#999', marginBottom:16, fontWeight:400 },
  statsRow:  { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 },
  statCard:  { background:'white', borderRadius:14, padding:'14px 10px', textAlign:'center', border:'1px solid #efefef' },
  statNum:   (c) => ({ fontSize:24, fontWeight:700, letterSpacing:'-1px', color:c }),
  statLabel: { fontSize:11, color:'#aaa', marginTop:2, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.5px' },
  connBtn:   { width:'100%', padding:'12px', borderRadius:13, background:'#1a1a1a', color:'white', fontSize:13, fontWeight:600, marginBottom:10, display:'flex', alignItems:'center', justifyContent:'center', gap:7, border:'none', cursor:'pointer', letterSpacing:'-0.2px' },
  connBadge: { background:'#f0faf4', color:'#2d7a4f', borderRadius:10, padding:'9px 14px', fontSize:12, fontWeight:600, marginBottom:12, display:'flex', alignItems:'center', gap:7, border:'1px solid #c3e8d0' },
  addBtn:    { width:'100%', padding:'14px', borderRadius:14, background:'#1a1a1a', color:'white', fontSize:14, fontWeight:600, marginBottom:14, display:'flex', alignItems:'center', justifyContent:'center', gap:8, border:'none', cursor:'pointer', letterSpacing:'-0.2px' },
  catFilter: { display:'flex', gap:7, overflowX:'auto', paddingBottom:10, marginBottom:12, scrollbarWidth:'none' },
  catChip:   (a) => ({ padding:'7px 14px', borderRadius:20, fontSize:12, fontWeight:600, flexShrink:0, background:a?'#1a1a1a':'white', color:a?'white':'#666', border:'1.5px solid', borderColor:a?'#1a1a1a':'#e8e8e8', cursor:'pointer', letterSpacing:'-0.1px' }),
  card:      { background:'white', borderRadius:16, padding:'14px 16px', marginBottom:9, border:'1px solid #efefef' },
  itemName:  { fontSize:15, fontWeight:600, color:'#1a1a1a', margin:0, letterSpacing:'-0.3px' },
  itemSub:   { fontSize:12, color:'#aaa', margin:'2px 0 0', fontWeight:400 },
  badge:     (st) => ({ padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:STATUS_CONFIG[st].bg, color:STATUS_CONFIG[st].color, flexShrink:0, textTransform:'uppercase', letterSpacing:'0.2px' }),
  actions:   { display:'flex', gap:7, marginTop:4 },
  actionBtn: (v) => ({ flex:1, padding:'8px 6px', borderRadius:10, fontSize:12, fontWeight:600, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5, letterSpacing:'-0.1px',
    background: v==='danger'?'#fff0ee' : v==='restock'?'#f0faf4' : '#f7f7f7',
    color:       v==='danger'?'#c94030' : v==='restock'?'#2d7a4f' : '#555',
  }),
  modal:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' },
  modalCard: { background:'#fafaf9', borderRadius:'20px 20px 0 0', padding:'28px 22px 42px', width:'100%', maxWidth:480, animation:'slideUp 0.3s ease', maxHeight:'90vh', overflowY:'auto' },
  modalTitle:{ fontSize:20, fontWeight:700, marginBottom:20, color:'#1a1a1a', letterSpacing:'-0.4px', display:'flex', alignItems:'center', gap:8 },
  label:     { display:'block', fontSize:11, fontWeight:700, color:'#aaa', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.6px' },
  input:     { width:'100%', padding:'12px 14px', borderRadius:11, border:'1.5px solid #efefef', fontSize:14, background:'white', color:'#1a1a1a', marginBottom:14, outline:'none', boxSizing:'border-box', fontFamily:'inherit' },
  row2:      { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  saveBtn:   { width:'100%', padding:'14px', borderRadius:13, background:'#1a1a1a', color:'white', fontSize:15, fontWeight:700, marginTop:4, border:'none', cursor:'pointer', letterSpacing:'-0.2px' },
  cancelBtn: { width:'100%', padding:'13px', borderRadius:13, background:'white', color:'#888', fontSize:14, fontWeight:500, marginTop:8, border:'1.5px solid #efefef', cursor:'pointer' },
  restockBtn:{ width:'100%', padding:'14px', borderRadius:13, background:'#1a1a1a', color:'white', fontSize:15, fontWeight:700, marginTop:4, border:'none', cursor:'pointer', letterSpacing:'-0.2px' },
  infoBox:   { background:'#f9f9f9', borderRadius:12, padding:'12px 14px', marginBottom:14, border:'1px solid #f0f0f0' },
  prevBox:   { background:'#f0faf4', borderRadius:11, padding:'11px 14px', marginBottom:14, fontSize:13, display:'flex', alignItems:'center', gap:6 },
  progressLbl:{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#bbb', marginBottom:5, fontWeight:500 },
  progressBg: { height:5, background:'#f5f5f5', borderRadius:3, overflow:'hidden', marginBottom:12 },
  syncTag:   { fontSize:10, color:'#ccc', marginTop:8, fontWeight:400 },
  empty:     { textAlign:'center', padding:'40px 0', color:'#bbb', fontSize:14 },
};

// ── SHEET HELPERS ─────────────────────────────────────────────────────────────
function fmtDate() {
  const n = new Date();
  return n.toLocaleDateString('en-PH',{month:'2-digit',day:'2-digit',year:'2-digit'})
    + ' ' + n.toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'});
}

async function sheetAppend(accessToken, rows) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}!A:G:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  return fetch(url, {
    method:'POST',
    headers:{ Authorization:`Bearer ${accessToken}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ values: rows }),
  });
}

function buildRow(item, status, action='') {
  return [
    fmtDate(),
    item.name,
    item.category,
    item.quantity,
    STATUS_CONFIG[status]?.label || status,
    item.threshold,
    action ? `[${action}] ${item.notes||''}`.trim() : (item.notes||''),
  ];
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function Inventory() {
  const [items,       setItems]       = useState([]);
  const [showModal,   setShowModal]   = useState(false);
  const [showRestock, setShowRestock] = useState(false);
  const [restockItem, setRestockItem] = useState(null);
  const [restockQty,  setRestockQty]  = useState('');
  const [restockNote, setRestockNote] = useState('');
  const [form,        setForm]        = useState(DEFAULT_FORM);
  const [editId,      setEditId]      = useState(null);
  const [expandedId,  setExpandedId]  = useState(null);
  const [filterCat,   setFilterCat]   = useState('All');
  const [loading,     setLoading]     = useState(true);
  const [accessToken, setAccessToken] = useState(null);
  const [syncing,     setSyncing]     = useState(false);
  const tokenClientRef = React.useRef(null);

  // Google Auth
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

  // Firestore
  useEffect(() => {
    const q = query(collection(db, 'inventory'), orderBy('createdAt','desc'));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id:d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const syncRow = async (item, status, action='') => {
    if (!accessToken) return;
    try { await sheetAppend(accessToken, [buildRow(item, status, action)]); }
    catch (e) { console.error('Sheet sync:', e); }
  };

  // Add / Edit
  const openAdd  = () => { setForm(DEFAULT_FORM); setEditId(null); setShowModal(true); };
  const openEdit = (item) => {
    setForm({ name:item.name, category:item.category, quantity:item.quantity, unit:item.unit, threshold:item.threshold, notes:item.notes||'' });
    setEditId(item.id); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || form.quantity==='') return;
    setSyncing(true);
    const qty    = Number(form.quantity);
    const thresh = Number(form.threshold) || 5;
    const data   = { name:form.name, category:form.category, quantity:qty, unit:form.unit, threshold:thresh, notes:form.notes, updatedAt:serverTimestamp() };
    const status = getStatus(qty, thresh);
    try {
      if (editId) {
        await updateDoc(doc(db,'inventory',editId), data);
        await syncRow({ ...data }, status, 'UPDATED');
      } else {
        await addDoc(collection(db,'inventory'), { ...data, createdAt:serverTimestamp() });
        await syncRow({ ...data }, status, 'ADDED');
      }
    } catch(e) { console.error(e); }
    setSyncing(false); setShowModal(false);
  };

  // Delete
  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    setSyncing(true);
    try {
      await deleteDoc(doc(db,'inventory',item.id));
      await syncRow(item, getStatus(item.quantity, item.threshold), 'DELETED');
    } catch(e) { console.error(e); }
    setSyncing(false);
  };

  // Restock
  const openRestock = (item, e) => {
    e.stopPropagation();
    setRestockItem(item); setRestockQty(''); setRestockNote(''); setShowRestock(true);
  };

  const handleRestock = async () => {
    if (!restockItem || !restockQty || Number(restockQty)<=0) return;
    setSyncing(true);
    const added    = Number(restockQty);
    const newQty   = (restockItem.quantity||0) + added;
    const newStatus = getStatus(newQty, restockItem.threshold);
    try {
      await updateDoc(doc(db,'inventory',restockItem.id), { quantity:newQty, updatedAt:serverTimestamp() });
      const row = [
        fmtDate(), restockItem.name, restockItem.category, newQty,
        STATUS_CONFIG[newStatus]?.label || newStatus, restockItem.threshold,
        `[RESTOCKED +${added}${restockItem.unit}] ${restockNote||''}`.trim(),
      ];
      if (accessToken) await sheetAppend(accessToken, [row]);
    } catch(e) { console.error(e); }
    setSyncing(false); setShowRestock(false); setExpandedId(null);
  };

  const filtered = filterCat==='All' ? items : items.filter(i=>i.category===filterCat);
  const lowCount = items.filter(i=>getStatus(i.quantity,i.threshold)!=='ok').length;
  const outCount = items.filter(i=>i.quantity<=0).length;

  return (
    <div style={s.page}>
      <div style={s.title}>Inventory</div>
      <div style={s.sub}>Theonyx Cafe · {items.length} items{syncing?' · syncing…':''}</div>

      {/* Stats */}
      <div style={s.statsRow}>
        <div style={s.statCard}><div style={s.statNum('#1a1a1a')}>{items.length}</div><div style={s.statLabel}>Total</div></div>
        <div style={s.statCard}><div style={s.statNum('#c97c2a')}>{lowCount}</div><div style={s.statLabel}>Low</div></div>
        <div style={s.statCard}><div style={s.statNum('#c94030')}>{outCount}</div><div style={s.statLabel}>Out</div></div>
      </div>

      {/* Google connect */}
      {!accessToken ? (
        <button style={s.connBtn} onClick={()=>tokenClientRef.current?.requestAccessToken()}>
          {IC.link} Connect Google Sheets
        </button>
      ) : (
        <div style={s.connBadge}>{IC.check} Connected to Google Sheets</div>
      )}

      <button style={s.addBtn} onClick={openAdd}>{IC.plus} Add Item</button>

      {/* Category filter */}
      <div style={s.catFilter}>
        {['All',...CATEGORIES].map(c=>(
          <div key={c} style={s.catChip(filterCat===c)} onClick={()=>setFilterCat(c)}>{c}</div>
        ))}
      </div>

      {loading && <div style={s.empty}>Loading inventory…</div>}
      {!loading && filtered.length===0 && <div style={s.empty}>No items yet. Tap "Add Item" to start.</div>}

      {/* Item cards */}
      {filtered.map(item => {
        const status   = getStatus(item.quantity, item.threshold);
        const expanded = expandedId===item.id;
        const catCfg   = CAT_SVG[item.category] || CAT_SVG['Other'];
        const pct      = Math.min(100, (item.quantity/(item.threshold*2))*100);
        const barColor = status==='ok'?'#2d7a4f':status==='warn'?'#c97c2a':'#c94030';
        return (
          <div key={item.id} style={s.card} onClick={()=>setExpandedId(expanded?null:item.id)}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:44,height:44,borderRadius:12,background:catCfg.bg,display:'flex',alignItems:'center',justifyContent:'center',color:catCfg.color,flexShrink:0}}>
                {catCfg.icon}
              </div>
              <div style={{flex:1}}>
                <p style={s.itemName}>{item.name}</p>
                <p style={s.itemSub}>{item.quantity} {item.unit} · {item.category}</p>
              </div>
              <span style={s.badge(status)}>{STATUS_CONFIG[status].label}</span>
            </div>

            {expanded && (
              <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid #f5f5f5'}}>
                {item.notes && <p style={{fontSize:12,color:'#aaa',marginBottom:8}}>{item.notes}</p>}
                <p style={{fontSize:11,color:'#ccc',marginBottom:10}}>Alert threshold: {item.threshold} {item.unit}</p>

                {/* Stock bar */}
                <div style={s.progressLbl}>
                  <span>Stock level</span>
                  <span>{item.quantity} / {item.threshold*2} {item.unit}</span>
                </div>
                <div style={s.progressBg}>
                  <div style={{height:'100%',width:`${pct}%`,background:barColor,borderRadius:3,transition:'width 0.4s'}}/>
                </div>

                <div style={s.actions}>
                  <button style={s.actionBtn('restock')} onClick={(e)=>openRestock(item,e)}>
                    {IC.upload} Restock
                  </button>
                  <button style={s.actionBtn('edit')} onClick={(e)=>{e.stopPropagation();openEdit(item);}}>
                    {IC.edit} Edit
                  </button>
                  <button style={s.actionBtn('danger')} onClick={(e)=>{e.stopPropagation();handleDelete(item);}}>
                    {IC.trash} Delete
                  </button>
                </div>

                {item.updatedAt?.toDate && (
                  <div style={s.syncTag}>Updated: {item.updatedAt.toDate().toLocaleString('en-PH')}</div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── ADD / EDIT MODAL ── */}
      {showModal && (
        <div style={s.modal} onClick={()=>setShowModal(false)}>
          <div style={s.modalCard} onClick={e=>e.stopPropagation()}>
            <div style={s.modalTitle}>
              {editId ? IC.edit : IC.plus}
              {editId ? 'Edit Item' : 'Add New Item'}
            </div>

            <label style={s.label}>Item Name</label>
            <input style={s.input} placeholder="e.g. Arabica Beans" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>

            <label style={s.label}>Category</label>
            <select style={s.input} value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
              {CATEGORIES.map(c=><option key={c}>{c}</option>)}
            </select>

            <div style={s.row2}>
              <div>
                <label style={s.label}>Quantity</label>
                <input style={s.input} type="number" placeholder="0" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})}/>
              </div>
              <div>
                <label style={s.label}>Unit</label>
                <select style={s.input} value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}>
                  {UNITS.map(u=><option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <label style={s.label}>Low Stock Alert Threshold</label>
            <input style={s.input} type="number" placeholder="e.g. 5" value={form.threshold} onChange={e=>setForm({...form,threshold:e.target.value})}/>

            <label style={s.label}>Notes (optional)</label>
            <input style={s.input} placeholder="e.g. Supplier: ABC Trading" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>

            <button style={s.saveBtn} onClick={handleSave} disabled={syncing}>
              {syncing?'Saving…':editId?'Save Changes':'Add Item'}
            </button>
            <button style={s.cancelBtn} onClick={()=>setShowModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── RESTOCK MODAL ── */}
      {showRestock && restockItem && (
        <div style={s.modal} onClick={()=>setShowRestock(false)}>
          <div style={s.modalCard} onClick={e=>e.stopPropagation()}>
            <div style={s.modalTitle}>{IC.restockLg} Restock Item</div>

            <div style={s.infoBox}>
              <div style={{fontSize:14,fontWeight:600,color:'#1a1a1a',marginBottom:6,letterSpacing:'-0.2px'}}>{restockItem.name}</div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:12,color:'#aaa'}}>Current: <b style={{color:'#1a1a1a'}}>{restockItem.quantity} {restockItem.unit}</b></span>
                <span style={s.badge(getStatus(restockItem.quantity,restockItem.threshold))}>
                  {STATUS_CONFIG[getStatus(restockItem.quantity,restockItem.threshold)].label}
                </span>
              </div>
            </div>

            <label style={s.label}>Add Quantity ({restockItem.unit})</label>
            <input
              style={s.input} type="number"
              placeholder={`Amount to add in ${restockItem.unit}`}
              value={restockQty} onChange={e=>setRestockQty(e.target.value)} autoFocus
            />

            {restockQty && Number(restockQty)>0 && (
              <div style={s.prevBox}>
                {IC.check}
                <span style={{color:'#888'}}>New total:</span>
                <b style={{color:'#2d7a4f',fontSize:15,letterSpacing:'-0.3px'}}>
                  {(restockItem.quantity||0)+Number(restockQty)} {restockItem.unit}
                </b>
                <span style={{color:'#bbb',fontSize:11}}>(+{restockQty})</span>
              </div>
            )}

            <label style={s.label}>Restock Note (optional)</label>
            <input
              style={s.input} placeholder="e.g. New delivery from supplier"
              value={restockNote} onChange={e=>setRestockNote(e.target.value)}
            />

            <button style={s.restockBtn} onClick={handleRestock} disabled={syncing||!restockQty||Number(restockQty)<=0}>
              {syncing?'Saving…':'Confirm Restock'}
            </button>
            <button style={s.cancelBtn} onClick={()=>setShowRestock(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{height:80}}/>
    </div>
  );
}
