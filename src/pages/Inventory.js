import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, serverTimestamp, query, orderBy
} from 'firebase/firestore';

const SHEET_ID        = '1Gnr_6SBcUBY4GcDqvGpTUZgE8NI3OIZAzlusG5YPfQg';
const SHEET_NAME      = 'Sheet1';
const DRIVE_FOLDER_ID = '1kzXqUPvyDxZ1fH9quEevh2EwAH3VOIm_';
const GOOGLE_CLIENT_ID= '596322682185-n5hm66hvol3nnqqllnuop995kcnefbgu.apps.googleusercontent.com';
const SCOPES =
  'https://www.googleapis.com/auth/spreadsheets ' +
  'https://www.googleapis.com/auth/drive.file';

const CATEGORIES = ['Beans & Coffee','Milk & Cream','Syrups','Food & Pastries','Cups & Packaging','Equipment','Other'];
const UNITS      = ['kg','g','liters','ml','pcs','bottles','boxes','bags'];
const STAFF_NAMES= ['Kelly','Maryz','Jenny','Aaron'];
const SHEET_HEADERS = ['Code','Item','Category','Quantity','Unit','Status','Threshold','Last Restocked','Updated','Notes'];

// ── Brown palette ──
const C = {
  ink:      '#2a1000',
  gold:     '#c8943a',
  goldDark: '#a07020',
  muted:    '#a07850',
  cream:    '#fff8f0',
  soft:     '#f5ede2',
  border:   '#f0e8d8',
  white:    '#ffffff',
  terra:    '#8a5a2b',
  green:    '#5a8a3a',
  greenBg:  '#f1f7e9',
  greenBd:  '#d7e8c0',
  warn:     '#a9651a',
  warnBg:   '#fbeede',
  warnBd:   '#efd2a0',
  err:      '#b5482e',
  errBg:    '#fbe9e7',
  errBd:    '#f0c8c0',
  disabled: '#d4c4b0',
};

function getStatus(qty, threshold) {
  if (qty <= 0)             return 'out';
  if (qty <= threshold)     return 'low';
  if (qty <= threshold * 2) return 'warn';
  return 'ok';
}
const STATUS_CONFIG = {
  ok:   { label: 'OK',       bg: C.greenBg,  color: C.green },
  warn: { label: 'Low',      bg: C.warnBg,   color: C.warn  },
  low:  { label: 'Critical', bg: C.errBg,    color: C.err   },
  out:  { label: 'Out',      bg: '#f5f0ec',  color: '#999'  },
};
const CRITICAL_STATUSES = ['low','out'];
const RECEIPT_STATUS = {
  pending:  { label:'Pending',  bg:C.warnBg, color:C.warn  },
  approved: { label:'Approved', bg:C.greenBg,color:C.green },
  rejected: { label:'Rejected', bg:C.errBg,  color:C.err   },
};
const DEFAULT_FORM = { name:'', category:'Beans & Coffee', quantity:'', unit:'kg', threshold:'', notes:'' };

// ── Icons ──
const IC = {
  check:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  plus:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  link:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  edit:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>,
  trash:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>,
  upload:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  restockLg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  camera:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  cameraLg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  search:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.7" y2="16.7"/></svg>,
  receipt: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 2v20l2.5-1.5L10 22l2-1.5L14 22l2.5-1.5L19 22V2l-2.5 1.5L14 2l-2 1.5L10 2 7.5 3.5 5 2Z"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/></svg>,
  x:       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  lock:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
};

const CAT_SVG = {
  'Beans & Coffee':  { icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>, bg:'#fbeede', color:C.warn },
  'Milk & Cream':    { icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2h8l2 6H6L8 2z"/><path d="M6 8c0 8 2 12 6 12s6-4 6-12"/></svg>, bg:'#f0ebe4', color:C.terra },
  'Syrups':          { icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6l1 7H8L9 3z"/><path d="M8 10c0 6 1.5 9 4 9s4-3 4-9"/><path d="M7 14h10"/></svg>, bg:'#f5e8d8', color:C.gold },
  'Food & Pastries': { icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>, bg:'#fff0e8', color:C.err },
  'Cups & Packaging':{ icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3"/><path d="M21 8H3l1 12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2Z"/></svg>, bg:'#efe8e0', color:C.terra },
  'Equipment':       { icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>, bg:'#f0ebe4', color:C.muted },
  'Other':           { icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>, bg:'#f5ede2', color:C.muted },
};

// ── Styles ──
const s = {
  page:       { padding:'16px 16px 0', fontFamily:"-apple-system,'SF Pro Display','Helvetica Neue',sans-serif" },
  title:      { fontSize:24, fontWeight:700, color:C.ink, letterSpacing:'-0.5px', marginBottom:2, fontFamily:"-apple-system,'SF Pro Display','Helvetica Neue',sans-serif" },
  sub:        { fontSize:13, color:C.muted, marginBottom:16 },
  statsRow:   { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 },
  statCard:   { background:C.white, borderRadius:14, padding:'14px 10px', textAlign:'center', border:`1px solid ${C.border}` },
  statNum:    (c)=>({ fontSize:24, fontWeight:700, letterSpacing:'-1px', color:c }),
  statLabel:  { fontSize:11, color:C.muted, marginTop:2, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.5px' },
  connBtn:    { width:'100%', padding:'12px', borderRadius:13, background:C.gold, color:C.white, fontSize:13, fontWeight:600, marginBottom:10, display:'flex', alignItems:'center', justifyContent:'center', gap:7, border:'none', cursor:'pointer' },
  connBadge:  { background:C.greenBg, color:C.green, borderRadius:10, padding:'9px 14px', fontSize:12, fontWeight:600, marginBottom:12, display:'flex', alignItems:'center', gap:7, border:`1px solid ${C.greenBd}` },
  btnRow:     { display:'flex', gap:8, marginBottom:10 },
  // active buttons (connected)
  addBtn:     { flex:1, padding:'14px', borderRadius:14, background:'#f5ede2', color:C.terra, fontSize:14, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:8, border:`1.5px solid ${C.border}`, cursor:'pointer' },
  receiptBtn: { flex:1, padding:'14px', borderRadius:14, background:'#f5ede2', color:C.terra, fontSize:14, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:8, border:`1.5px solid ${C.border}`, cursor:'pointer' },
  // disabled buttons (not connected)
  addBtnOff:  { flex:1, padding:'14px', borderRadius:14, background:C.soft, color:C.disabled, fontSize:14, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:8, border:`1px solid ${C.border}`, cursor:'not-allowed' },
  receiptOff: { flex:1, padding:'14px', borderRadius:14, background:C.soft, color:C.disabled, fontSize:14, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:8, border:`1px solid ${C.border}`, cursor:'not-allowed' },
  lockNote:   { background:C.errBg, border:`1px solid ${C.errBd}`, borderRadius:10, padding:'10px 13px', fontSize:12.5, color:C.err, display:'flex', alignItems:'center', gap:7, marginBottom:10, fontWeight:500 },
  reviewBtn:  (p)=>({ width:'100%', padding:'11px', borderRadius:12, background:p?'#fbeede':'#f5ede2', color:p?C.warn:C.terra, fontSize:13, fontWeight:600, marginBottom:14, display:'flex', alignItems:'center', justifyContent:'center', gap:8, border:'1.5px solid', borderColor:p?C.warnBd:C.border, cursor:'pointer' }),
  pendCount:  { background:C.gold, color:C.white, borderRadius:10, minWidth:18, height:18, padding:'0 5px', fontSize:11, fontWeight:700, display:'inline-flex', alignItems:'center', justifyContent:'center' },
  searchWrap: { position:'relative', marginBottom:12 },
  searchIcon: { position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:C.muted, display:'flex', pointerEvents:'none' },
  searchInput:{ width:'100%', padding:'11px 14px 11px 36px', borderRadius:12, border:`1.5px solid ${C.border}`, fontSize:14, background:C.white, color:C.ink, outline:'none', boxSizing:'border-box', fontFamily:'inherit' },
  catFilter:  { display:'flex', gap:7, overflowX:'auto', paddingBottom:10, marginBottom:12, scrollbarWidth:'none' },
  catChip:    (a,crit)=>({ padding:'7px 14px', borderRadius:20, fontSize:12, fontWeight:600, flexShrink:0, display:'flex', alignItems:'center', cursor:'pointer', border:'1.5px solid',
    background: a?C.ink:(crit?C.errBg:C.white),
    color:      a?C.gold:(crit?C.err:C.muted),
    borderColor:a?C.ink:(crit?C.errBd:C.border) }),
  catDot:     (a)=>({ display:'inline-block', width:7, height:7, borderRadius:'50%', background:a?'#ffaa88':C.err, marginLeft:6, flexShrink:0 }),
  card:       { background:C.white, borderRadius:16, padding:'14px 16px', marginBottom:9, border:`1px solid ${C.border}` },
  itemName:   { fontSize:15, fontWeight:600, color:C.ink, margin:0 },
  itemSub:    { fontSize:12, color:C.muted, margin:'2px 0 0' },
  codePill:   { fontSize:10, fontWeight:700, color:C.muted, background:C.soft, borderRadius:6, padding:'2px 6px', fontFamily:'monospace', letterSpacing:'0.5px', flexShrink:0 },
  badge:      (st)=>({ padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:STATUS_CONFIG[st].bg, color:STATUS_CONFIG[st].color, flexShrink:0, textTransform:'uppercase', letterSpacing:'0.2px' }),
  actions:    { display:'flex', gap:7, marginTop:4 },
  actionBtn:  (v)=>({ flex:1, padding:'8px 6px', borderRadius:10, fontSize:12, fontWeight:600, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5,
    background: v==='danger'?C.errBg:'#f5ede2',
    color:      v==='danger'?C.err:'#8a5a2b' }),
  modal:      { position:'fixed', inset:0, background:'rgba(26,10,0,0.6)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' },
  modalCard:  { background:C.cream, borderRadius:'20px 20px 0 0', padding:'28px 22px 42px', width:'100%', maxWidth:480, animation:'slideUp 0.3s ease', maxHeight:'90vh', overflowY:'auto' },
  modalTitle: { fontSize:20, fontWeight:700, marginBottom:20, color:C.ink, display:'flex', alignItems:'center', gap:8 },
  label:      { display:'block', fontSize:11, fontWeight:700, color:C.muted, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.6px' },
  input:      { width:'100%', padding:'12px 14px', borderRadius:11, border:`1.5px solid ${C.border}`, fontSize:14, background:C.white, color:C.ink, marginBottom:14, outline:'none', boxSizing:'border-box', fontFamily:'inherit' },
  row2:       { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  saveBtn:    { width:'100%', padding:'14px', borderRadius:13, background:C.gold, color:C.white, fontSize:15, fontWeight:700, marginTop:4, border:'none', cursor:'pointer' },
  cancelBtn:  { width:'100%', padding:'13px', borderRadius:13, background:C.white, color:C.muted, fontSize:14, fontWeight:500, marginTop:8, border:`1.5px solid ${C.border}`, cursor:'pointer' },
  infoBox:    { background:C.soft, borderRadius:12, padding:'12px 14px', marginBottom:14, border:`1px solid ${C.border}` },
  prevBox:    { background:C.greenBg, borderRadius:11, padding:'11px 14px', marginBottom:14, fontSize:13, display:'flex', alignItems:'center', gap:6 },
  progressLbl:{ display:'flex', justifyContent:'space-between', fontSize:11, color:C.muted, marginBottom:5, fontWeight:500 },
  progressBg: { height:5, background:C.soft, borderRadius:3, overflow:'hidden', marginBottom:12 },
  syncTag:    { fontSize:10, color:C.muted, marginTop:8 },
  empty:      { textAlign:'center', padding:'40px 0', color:C.muted, fontSize:14 },
  photoBtn:   { width:'100%', padding:'34px 14px', borderRadius:14, background:C.white, color:C.muted, fontSize:14, fontWeight:600, marginBottom:14, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, border:`1.5px dashed ${C.border}`, cursor:'pointer' },
  photoPrev:  { width:'100%', borderRadius:14, marginBottom:10, border:`1px solid ${C.border}`, display:'block', maxHeight:280, objectFit:'cover' },
  retake:     { width:'100%', padding:'10px', borderRadius:11, background:C.white, color:C.muted, fontSize:13, fontWeight:600, marginBottom:14, border:`1.5px solid ${C.border}`, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 },
  notice:     { background:C.warnBg, border:`1px solid ${C.warnBd}`, color:C.warn, borderRadius:11, padding:'11px 14px', fontSize:12.5, fontWeight:500, marginBottom:14, lineHeight:1.45 },
  rcptCard:   { background:C.white, borderRadius:14, padding:'12px', marginBottom:10, border:`1px solid ${C.border}` },
  rcptThumb:  { width:54, height:54, borderRadius:10, objectFit:'cover', background:C.soft, flexShrink:0, border:`1px solid ${C.border}` },
  rcptThumbPh:{ width:54, height:54, borderRadius:10, background:C.soft, flexShrink:0, border:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'center', color:C.muted },
  rcptLink:   { fontSize:12, fontWeight:600, color:C.gold, textDecoration:'none' },
  rcptActions:{ display:'flex', gap:7, marginTop:10 },
  approveBtn: { flex:1, padding:'9px', borderRadius:10, background:C.greenBg, color:C.green, fontSize:12.5, fontWeight:700, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 },
  rejectBtn:  { flex:1, padding:'9px', borderRadius:10, background:C.errBg,   color:C.err,   fontSize:12.5, fontWeight:700, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 },
  rcptDelBtn: { width:28, height:28, borderRadius:8, background:C.soft, color:C.err, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
};

// ── Helpers ──
function fmtDate() {
  const n = new Date();
  return n.toLocaleDateString('en-PH',{month:'2-digit',day:'2-digit',year:'2-digit'}) + ' ' + n.toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'});
}
function genCode(existingItems) {
  const used = new Set(existingItems.filter(i=>i.code).map(i=>String(i.code)));
  let code, tries=0;
  do { code=String(Math.floor(1000+Math.random()*9000)); tries++; } while(used.has(code)&&tries<80);
  return code;
}
function buildItemRow(item) {
  const status = getStatus(item.quantity, item.threshold);
  const restock = (item.lastRestock!=null&&item.lastRestock!=='') ? `+${item.lastRestock} ${item.unit||''}${item.lastRestockNote?' — '+item.lastRestockNote:''}`.trim() : '';
  return [String(item.code||''), item.name||'', item.category||'', item.quantity??'', item.unit||'', STATUS_CONFIG[status]?.label||status, item.threshold??'', restock, fmtDate(), item.notes||''];
}

// ── Sheet API ──
async function sheetGetAll(token) {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}!A:J`, { headers:{Authorization:`Bearer ${token}`} });
  return (await r.json()).values || [];
}
async function sheetUpdateRow(token, rowNumber, row) {
  return fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}!A${rowNumber}:J${rowNumber}?valueInputOption=USER_ENTERED`, {
    method:'PUT', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}, body:JSON.stringify({values:[row]})
  });
}
async function sheetAppendRow(token, row) {
  return fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}!A:J:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method:'POST', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}, body:JSON.stringify({values:[row]})
  });
}
async function ensureHeaders(token) {
  const vals = await sheetGetAll(token);
  if (!vals.length||(vals[0]?.[0]||'')!=='Code') await sheetUpdateRow(token,1,SHEET_HEADERS);
}
async function upsertItemRow(token, code, row) {
  const vals = await sheetGetAll(token);
  let idx=-1;
  for(let i=1;i<vals.length;i++) { if((vals[i][0]||'')===String(code)){idx=i;break;} }
  if(idx===-1) await sheetAppendRow(token,row); else await sheetUpdateRow(token,idx+1,row);
}
async function getSheetGid(token) {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties(sheetId,title)`, {headers:{Authorization:`Bearer ${token}`}});
  const j = await r.json();
  const sheet = (j.sheets||[]).find(sh=>sh.properties.title===SHEET_NAME);
  return sheet?sheet.properties.sheetId:0;
}
async function deleteItemRow(token, code, gidRef) {
  const vals = await sheetGetAll(token);
  let idx=-1;
  for(let i=1;i<vals.length;i++){if((vals[i][0]||'')===String(code)){idx=i;break;}}
  if(idx===-1) return;
  if(gidRef.current==null) gidRef.current=await getSheetGid(token);
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,{
    method:'POST', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({requests:[{deleteDimension:{range:{sheetId:gidRef.current,dimension:'ROWS',startIndex:idx,endIndex:idx+1}}}]})
  });
}

// ── Drive API ──
async function uploadReceiptToDrive(token, file, filename) {
  const metadata={name:filename,parents:[DRIVE_FOLDER_ID],mimeType:file.type||'image/jpeg'};
  const form=new FormData();
  form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
  form.append('file',file);
  const r=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,thumbnailLink',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form});
  if(!r.ok) throw new Error('Drive upload failed: '+r.status);
  return r.json();
}
async function deleteDriveFile(token,fileId) {
  if(!token||!fileId) return;
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});
}

// ── Main Component ──
export default function Inventory({ role='staff', userName='' }) {
  const isManager = String(role||'').trim().toLowerCase()==='manager';

  const [items,         setItems]         = useState([]);
  const [showModal,     setShowModal]     = useState(false);
  const [showRestock,   setShowRestock]   = useState(false);
  const [restockItem,   setRestockItem]   = useState(null);
  const [restockQty,    setRestockQty]    = useState('');
  const [restockNote,   setRestockNote]   = useState('');
  const [form,          setForm]          = useState(DEFAULT_FORM);
  const [editId,        setEditId]        = useState(null);
  const [expandedCat,   setExpandedCat]   = useState(null);   // which category is open
  const [expandedId,    setExpandedId]    = useState(null);   // which item is open
  const [filterCat,     setFilterCat]     = useState('All');
  const [search,        setSearch]        = useState('');
  const [loading,       setLoading]       = useState(true);
  const [accessToken,   setAccessToken]   = useState(null);
  const [syncing,       setSyncing]       = useState(false);
  const [receipts,      setReceipts]      = useState([]);
  const [showReceipt,   setShowReceipt]   = useState(false);
  const [showReceipts,  setShowReceipts]  = useState(false);
  const [receiptFile,   setReceiptFile]   = useState(null);
  const [receiptPreview,setReceiptPreview]= useState('');
  const [receiptNote,   setReceiptNote]   = useState('');
  const [receiptAmount, setReceiptAmount] = useState('');
  const [uploader,      setUploader]      = useState('');
  const [uploadingReceipt,setUploadingReceipt]=useState(false);

  const tokenClientRef  = React.useRef(null);
  const gidRef          = React.useRef(null);
  const headersReadyRef = React.useRef(false);
  const backfilledRef   = React.useRef(false);
  const fileInputRef    = React.useRef(null);

  useEffect(() => {
    const script=document.createElement('script');
    script.src='https://accounts.google.com/gsi/client'; script.async=true;
    script.onload=()=>{
      if(!window.google) return;
      tokenClientRef.current=window.google.accounts.oauth2.initTokenClient({
        client_id:GOOGLE_CLIENT_ID, scope:SCOPES,
        callback:(res)=>{ if(res.access_token) setAccessToken(res.access_token); },
      });
    };
    document.body.appendChild(script);
    return ()=>document.body.removeChild(script);
  },[]);

  useEffect(()=>{
    const q=query(collection(db,'inventory'),orderBy('createdAt','desc'));
    return onSnapshot(q,(snap)=>{ setItems(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); });
  },[]);

  useEffect(()=>{
    const q=query(collection(db,'receipts'),orderBy('createdAt','desc'));
    return onSnapshot(q,(snap)=>setReceipts(snap.docs.map(d=>({id:d.id,...d.data()}))),e=>console.error('receipts:',e));
  },[]);

  useEffect(()=>{
    if(loading||backfilledRef.current) return;
    const missing=items.filter(i=>!i.code); backfilledRef.current=true;
    if(!missing.length) return;
    const used=new Set(items.filter(i=>i.code).map(i=>String(i.code)));
    (async()=>{
      for(const it of missing){
        let c; do{c=String(Math.floor(1000+Math.random()*9000));}while(used.has(c));
        used.add(c);
        try{await updateDoc(doc(db,'inventory',it.id),{code:c});}catch(e){console.error(e);}
      }
    })();
  },[items,loading]);

  const syncUpsert=async(item)=>{
    if(!accessToken) return;
    try{
      if(!headersReadyRef.current){await ensureHeaders(accessToken);headersReadyRef.current=true;}
      await upsertItemRow(accessToken,item.code,buildItemRow(item));
    }catch(e){console.error('Sheet upsert:',e);}
  };

  const openAdd=()=>{
    if(!accessToken) return;
    setForm(DEFAULT_FORM); setEditId(null); setShowModal(true);
  };
  const openEdit=(item)=>{
    setForm({name:item.name,category:item.category,quantity:item.quantity,unit:item.unit,threshold:item.threshold,notes:item.notes||''});
    setEditId(item.id); setShowModal(true);
  };

  const handleSave=async()=>{
    if(!form.name||form.quantity==='') return;
    setSyncing(true);
    const qty=Number(form.quantity), thresh=Number(form.threshold)||5;
    try{
      if(editId){
        const existing=items.find(i=>i.id===editId)||{};
        const code=existing.code||genCode(items);
        const data={name:form.name,category:form.category,quantity:qty,unit:form.unit,threshold:thresh,notes:form.notes,code,editedBy:userName||'Unknown',updatedAt:serverTimestamp()};
        await updateDoc(doc(db,'inventory',editId),data);
        await syncUpsert({...existing,...data});
      }else{
        const code=genCode(items);
        const data={name:form.name,category:form.category,quantity:qty,unit:form.unit,threshold:thresh,notes:form.notes,code,lastRestock:null,lastRestockNote:'',addedBy:userName||'Unknown',editedBy:null,createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
        const ref=await addDoc(collection(db,'inventory'),data);
        await syncUpsert({id:ref.id,...data});
      }
    }catch(e){console.error(e);}
    setSyncing(false); setShowModal(false);
  };

  const handleDelete=async(item)=>{
    if(!window.confirm(`Delete "${item.name}"?`)) return;
    setSyncing(true);
    try{
      await deleteDoc(doc(db,'inventory',item.id));
      if(accessToken&&item.code) await deleteItemRow(accessToken,item.code,gidRef);
    }catch(e){console.error(e);}
    setSyncing(false);
  };

  const openRestock=(item,e)=>{ e.stopPropagation(); setRestockItem(item);setRestockQty('');setRestockNote('');setShowRestock(true); };

  const handleRestock=async()=>{
    if(!restockItem||!restockQty||Number(restockQty)<=0) return;
    setSyncing(true);
    const added=Number(restockQty), newQty=(restockItem.quantity||0)+added;
    try{
      const data={quantity:newQty,lastRestock:added,lastRestockNote:(restockNote||''),lastRestockAt:serverTimestamp(),editedBy:userName||'Unknown',updatedAt:serverTimestamp()};
      await updateDoc(doc(db,'inventory',restockItem.id),data);
      await syncUpsert({...restockItem,...data});
    }catch(e){console.error(e);}
    setSyncing(false); setShowRestock(false); setExpandedId(null);
  };

  const openReceipt=()=>{
    if(!accessToken) return;
    setReceiptFile(null);setReceiptPreview('');setReceiptNote('');setReceiptAmount('');
    const match=STAFF_NAMES.find(n=>n.toLowerCase()===String(userName).toLowerCase());
    setUploader(match||''); setShowReceipt(true);
  };

  const onPickReceipt=(e)=>{
    const f=e.target.files?.[0]; if(!f) return;
    setReceiptFile(f);
    const reader=new FileReader();
    reader.onload=()=>setReceiptPreview(reader.result);
    reader.readAsDataURL(f);
    e.target.value='';
  };

  const submitReceipt=async()=>{
    if(!accessToken){alert('Connect Google muna.');return;}
    if(!receiptFile){alert('Kumuha muna ng larawan ng resibo.');return;}
    if(!uploader){alert('Piliin kung sino ang nag-upload.');return;}
    setUploadingReceipt(true);
    try{
      const d=new Date(), p=(n)=>String(n).padStart(2,'0');
      const stamp=`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
      const fname=`${stamp}_${uploader.replace(/[^\w]+/g,'')}.jpg`;
      const up=await uploadReceiptToDrive(accessToken,receiptFile,fname);
      await addDoc(collection(db,'receipts'),{fileId:up.id||'',fileName:up.name||fname,link:up.webViewLink||'',thumb:up.thumbnailLink||'',note:receiptNote||'',amount:receiptAmount?Number(receiptAmount):null,uploader,status:'pending',createdAt:serverTimestamp()});
      setShowReceipt(false); setReceiptFile(null);setReceiptPreview('');setReceiptNote('');setReceiptAmount('');setUploader('');
    }catch(e){ console.error(e); alert('Hindi na-upload. Subukan ulit.'); }
    setUploadingReceipt(false);
  };

  const reviewReceipt=async(r,status)=>{
    try{await updateDoc(doc(db,'receipts',r.id),{status,reviewedAt:serverTimestamp()});}catch(e){console.error(e);}
  };

  const deleteReceipt=async(r)=>{
    if(!isManager) return;
    if(!window.confirm('Delete this receipt?')) return;
    try{
      await deleteDoc(doc(db,'receipts',r.id));
      if(accessToken&&r.fileId) try{await deleteDriveFile(accessToken,r.fileId);}catch(err){console.error(err);}
    }catch(e){console.error(e);}
  };

  // Derived
  const term=search.trim().toLowerCase();
  const filtered=items.filter(i=>{
    const catOk=filterCat==='All'||i.category===filterCat;
    const searchOk=!term||(i.name||'').toLowerCase().includes(term)||String(i.code||'').includes(term);
    return catOk&&searchOk;
  });
  const lowCount=items.filter(i=>getStatus(i.quantity,i.threshold)!=='ok').length;
  const outCount=items.filter(i=>i.quantity<=0).length;
  const criticalCats=new Set(items.filter(i=>CRITICAL_STATUSES.includes(getStatus(i.quantity,i.threshold))).map(i=>i.category));
  const pendingCount=receipts.filter(r=>r.status==='pending').length;

  return (
    <div style={s.page}>
      <div style={s.title}>Inventory</div>
      <div style={s.sub}>Theonyx Cafe · {items.length} items{syncing?' · syncing…':''}</div>

      {/* Stats */}
      <div style={s.statsRow}>
        <div style={s.statCard}><div style={s.statNum(C.ink)}>{items.length}</div><div style={s.statLabel}>Total</div></div>
        <div style={s.statCard}><div style={s.statNum(C.warn)}>{lowCount}</div><div style={s.statLabel}>Low</div></div>
        <div style={s.statCard}><div style={s.statNum(C.err)}>{outCount}</div><div style={s.statLabel}>Out</div></div>
      </div>

      {/* Google connect */}
      {!accessToken
        ? <button style={s.connBtn} onClick={()=>tokenClientRef.current?.requestAccessToken()}>{IC.link} Connect Google (Sheets + Drive)</button>
        : <div style={s.connBadge}>{IC.check} Connected to Google Sheets &amp; Drive</div>
      }

      {/* Add + Receipt — disabled when not connected */}
      <div style={s.btnRow}>
        <button
          style={accessToken ? s.addBtn : s.addBtnOff}
          onClick={openAdd}
          disabled={!accessToken}
          title={!accessToken ? 'Connect Google first' : ''}
        >
          {!accessToken ? IC.lock : IC.plus} Add Item
        </button>
        <button
          style={accessToken ? s.receiptBtn : s.receiptOff}
          onClick={openReceipt}
          disabled={!accessToken}
          title={!accessToken ? 'Connect Google first' : ''}
        >
          {!accessToken ? IC.lock : IC.camera} Receipt
        </button>
      </div>

      {/* Lock notice when not connected */}
      {!accessToken && (
        <div style={s.lockNote}>
          {IC.lock} Connect to Google above to add items or submit receipts.
        </div>
      )}

      {/* Review receipts — Manager only */}
      {isManager && (
        <button style={s.reviewBtn(pendingCount>0)} onClick={()=>setShowReceipts(true)}>
          {IC.receipt} Review Receipts
          {pendingCount>0 && <span style={s.pendCount}>{pendingCount}</span>}
        </button>
      )}

      {/* Search */}
      <div style={s.searchWrap}>
        <span style={s.searchIcon}>{IC.search}</span>
        <input style={s.searchInput} placeholder="Search item name or code…" value={search} onChange={e=>setSearch(e.target.value)} />
      </div>

      {/* Category filter */}
      <div style={s.catFilter}>
        {['All',...CATEGORIES].map(c=>{
          const active=filterCat===c, crit=c!=='All'&&criticalCats.has(c);
          return <div key={c} style={s.catChip(active,crit)} onClick={()=>setFilterCat(c)}>{c}{crit&&<span style={s.catDot(active)}/>}</div>;
        })}
      </div>

      {loading && <div style={s.empty}>Loading inventory…</div>}
      {!loading&&filtered.length===0 && <div style={s.empty}>{term||filterCat!=='All'?'Walang tugmang item.':'No items yet. Connect Google then tap "Add Item".'}</div>}

      {/* Category grid 3-per-row + expanded item list below */}
      {!loading && (() => {
        const groups = {};
        const catOrder = filterCat === 'All' ? CATEGORIES : [filterCat];
        catOrder.forEach(c => { groups[c] = []; });
        filtered.forEach(item => {
          if (!groups[item.category]) groups[item.category] = [];
          groups[item.category].push(item);
        });
        const activeCats = catOrder.filter(cat => groups[cat]?.length > 0);
        return (
          <>
            {/* 3-column grid of category cards */}
            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:12}}>
              {activeCats.map(cat => {
                const catItems = groups[cat];
                const catCfg = CAT_SVG[cat] || CAT_SVG['Other'];
                const critCount = catItems.filter(i=>['low','out'].includes(getStatus(i.quantity,i.threshold))).length;
                const warnCount = catItems.filter(i=>getStatus(i.quantity,i.threshold)==='warn').length;
                const isCatOpen = expandedCat === cat;
                return (
                  <div key={cat}
                    style={{background:isCatOpen?C.ink:C.white, borderRadius:12, padding:'12px 10px', border:`1.5px solid ${isCatOpen?C.ink:C.border}`, cursor:'pointer', textAlign:'center', transition:'all 0.2s'}}
                    onClick={()=>{ setExpandedCat(isCatOpen?null:cat); setExpandedId(null); }}
                  >
                    <div style={{width:36,height:36,borderRadius:9,background:isCatOpen?'rgba(255,255,255,0.15)':catCfg.bg,display:'flex',alignItems:'center',justifyContent:'center',color:isCatOpen?C.gold:catCfg.color,margin:'0 auto 6px'}}>{catCfg.icon}</div>
                    <div style={{fontSize:11,fontWeight:700,color:isCatOpen?C.gold:C.ink,marginBottom:3,lineHeight:1.2}}>{cat}</div>
                    <div style={{fontSize:10,color:isCatOpen?'#d8b87a':C.muted,marginBottom:4}}>{catItems.length} item{catItems.length!==1?'s':''}</div>
                    {critCount>0
                      ? <span style={{background:isCatOpen?'rgba(181,72,46,0.25)':C.errBg,color:isCatOpen?'#ffaa88':C.err,borderRadius:20,padding:'2px 7px',fontSize:10,fontWeight:700}}>{critCount} ⚠</span>
                      : warnCount>0
                        ? <span style={{background:isCatOpen?'rgba(169,101,26,0.25)':C.warnBg,color:isCatOpen?'#ffd088':C.warn,borderRadius:20,padding:'2px 7px',fontSize:10,fontWeight:700}}>{warnCount} low</span>
                        : <span style={{background:isCatOpen?'rgba(90,138,58,0.25)':C.greenBg,color:isCatOpen?'#a8e080':C.green,borderRadius:20,padding:'2px 7px',fontSize:10,fontWeight:700}}>OK</span>
                    }
                  </div>
                );
              })}
            </div>

            {/* Expanded items for selected category */}
            {expandedCat && groups[expandedCat] && (
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:0.5,fontWeight:700,marginBottom:8}}>{expandedCat}</div>
                {groups[expandedCat].map((item, idx) => {
                  const status = getStatus(item.quantity, item.threshold);
                  const isItemOpen = expandedId === item.id;
                  const pct = Math.min(100,(item.quantity/(item.threshold*2))*100);
                  const barColor = status==='ok'?C.green:status==='warn'?C.warn:C.err;
                  const isFirst = idx === 0;
                  const isLast = idx === groups[expandedCat].length - 1;
                  return (
                    <div key={item.id}
                      style={{background:C.white, borderRadius:isFirst&&isLast?14:isFirst?'14px 14px 0 0':isLast?'0 0 14px 14px':0, padding:'12px 16px', border:`1px solid ${C.border}`, borderBottom: isLast?`1px solid ${C.border}`:'none', cursor:'pointer'}}
                      onClick={()=>setExpandedId(isItemOpen?null:item.id)}
                    >
                      <div style={{display:'flex',alignItems:'center',gap:12}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                            <p style={s.itemName}>{item.name}</p>
                            {item.code&&<span style={s.codePill}>#{item.code}</span>}
                          </div>
                          <p style={s.itemSub}>{item.quantity} {item.unit}</p>
                        </div>
                        <span style={s.badge(status)}>{STATUS_CONFIG[status].label}</span>
                      </div>

                      {isItemOpen && (
                        <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}} onClick={e=>e.stopPropagation()}>
                          {item.notes&&<p style={{fontSize:12,color:C.muted,marginBottom:8}}>{item.notes}</p>}
                          <p style={{fontSize:11,color:C.muted,marginBottom:6}}>Alert threshold: {item.threshold} {item.unit}</p>
                          <div style={s.progressLbl}><span>Stock level</span><span>{item.quantity} / {item.threshold*2} {item.unit}</span></div>
                          <div style={s.progressBg}><div style={{height:'100%',width:`${pct}%`,background:barColor,borderRadius:3,transition:'width 0.4s'}}/></div>
                          {(item.addedBy||item.editedBy)&&(
                            <div style={{fontSize:10.5,color:C.muted,marginBottom:8,display:'flex',gap:10,flexWrap:'wrap'}}>
                              {item.addedBy&&<span>Added by: <b style={{color:C.terra}}>{item.addedBy}</b></span>}
                              {item.editedBy&&<span>Last edited: <b style={{color:C.terra}}>{item.editedBy}</b></span>}
                            </div>
                          )}
                          <div style={s.actions}>
                            <button style={{...s.actionBtn('restock'),...(accessToken?{}:{opacity:0.45,cursor:'not-allowed'})}}
                              onClick={(e)=>{e.stopPropagation();if(accessToken)openRestock(item,e);}}
                            >{accessToken?IC.upload:IC.lock} Restock</button>
                            <button style={{...s.actionBtn('edit'),...(accessToken?{}:{opacity:0.45,cursor:'not-allowed'})}}
                              onClick={(e)=>{e.stopPropagation();if(accessToken)openEdit(item);}}
                            >{accessToken?IC.edit:IC.lock} Edit</button>
                            <button style={{...s.actionBtn('danger'),...(accessToken?{}:{opacity:0.45,cursor:'not-allowed'})}}
                              onClick={(e)=>{e.stopPropagation();if(accessToken)handleDelete(item);}}
                            >{IC.trash} Delete</button>
                          </div>
                          {item.updatedAt?.toDate&&<div style={s.syncTag}>Updated: {item.updatedAt.toDate().toLocaleString('en-PH')}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        );
      })()}

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={onPickReceipt}/>

      {/* ADD / EDIT MODAL */}
      {showModal&&(
        <div style={s.modal} onClick={()=>setShowModal(false)}>
          <div style={s.modalCard} onClick={e=>e.stopPropagation()}>
            <div style={s.modalTitle}>{editId?IC.edit:IC.plus}{editId?'Edit Item':'Add New Item'}</div>
            <label style={s.label}>Item Name</label>
            <input style={s.input} placeholder="e.g. Arabica Beans" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
            <label style={s.label}>Category</label>
            <select style={s.input} value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>
            <div style={s.row2}>
              <div><label style={s.label}>Quantity</label><input style={s.input} type="number" placeholder="0" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})}/></div>
              <div><label style={s.label}>Unit</label><select style={s.input} value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}>{UNITS.map(u=><option key={u}>{u}</option>)}</select></div>
            </div>
            <label style={s.label}>Low Stock Alert Threshold</label>
            <input style={s.input} type="number" placeholder="e.g. 5" value={form.threshold} onChange={e=>setForm({...form,threshold:e.target.value})}/>
            <label style={s.label}>Notes (optional)</label>
            <input style={s.input} placeholder="e.g. Supplier: ABC Trading" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
            <button style={s.saveBtn} onClick={handleSave} disabled={syncing}>{syncing?'Saving…':editId?'Save Changes':'Add Item'}</button>
            <button style={s.cancelBtn} onClick={()=>setShowModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* RESTOCK MODAL */}
      {showRestock&&restockItem&&(
        <div style={s.modal} onClick={()=>setShowRestock(false)}>
          <div style={s.modalCard} onClick={e=>e.stopPropagation()}>
            <div style={s.modalTitle}>{IC.restockLg} Restock Item</div>
            <div style={s.infoBox}>
              <div style={{fontSize:14,fontWeight:600,color:C.ink,marginBottom:6,display:'flex',alignItems:'center',gap:6}}>
                {restockItem.name}{restockItem.code&&<span style={s.codePill}>#{restockItem.code}</span>}
              </div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:12,color:C.muted}}>Current: <b style={{color:C.ink}}>{restockItem.quantity} {restockItem.unit}</b></span>
                <span style={s.badge(getStatus(restockItem.quantity,restockItem.threshold))}>{STATUS_CONFIG[getStatus(restockItem.quantity,restockItem.threshold)].label}</span>
              </div>
            </div>
            <label style={s.label}>Add Quantity ({restockItem.unit})</label>
            <input style={s.input} type="number" placeholder={`Amount to add in ${restockItem.unit}`} value={restockQty} onChange={e=>setRestockQty(e.target.value)} autoFocus/>
            {restockQty&&Number(restockQty)>0&&(
              <div style={s.prevBox}>{IC.check}<span style={{color:C.muted}}>New total:</span><b style={{color:C.green,fontSize:15}}>{(restockItem.quantity||0)+Number(restockQty)} {restockItem.unit}</b><span style={{color:C.muted,fontSize:11}}>(+{restockQty})</span></div>
            )}
            <label style={s.label}>Restock Note (optional)</label>
            <input style={s.input} placeholder="e.g. New delivery from supplier" value={restockNote} onChange={e=>setRestockNote(e.target.value)}/>
            <button style={s.saveBtn} onClick={handleRestock} disabled={syncing||!restockQty||Number(restockQty)<=0}>{syncing?'Saving…':'Confirm Restock'}</button>
            <button style={s.cancelBtn} onClick={()=>setShowRestock(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* RECEIPT CAPTURE MODAL */}
      {showReceipt&&(
        <div style={s.modal} onClick={()=>setShowReceipt(false)}>
          <div style={s.modalCard} onClick={e=>e.stopPropagation()}>
            <div style={s.modalTitle}>{IC.cameraLg} New Receipt</div>
            {!receiptPreview
              ? <div style={s.photoBtn} onClick={()=>fileInputRef.current?.click()}>{IC.cameraLg} Take photo / choose image</div>
              : <><img src={receiptPreview} alt="receipt" style={s.photoPrev}/><button style={s.retake} onClick={()=>fileInputRef.current?.click()}>{IC.camera} Retake / change photo</button></>
            }
            <label style={s.label}>Uploaded by</label>
            <select style={s.input} value={uploader} onChange={e=>setUploader(e.target.value)}>
              <option value="" disabled>Select your name…</option>
              {STAFF_NAMES.map(n=><option key={n} value={n}>{n}</option>)}
            </select>
            <label style={s.label}>What was purchased</label>
            <input style={s.input} placeholder="e.g. Milk + cups from supplier" value={receiptNote} onChange={e=>setReceiptNote(e.target.value)}/>
            <label style={s.label}>Amount (₱, optional)</label>
            <input style={s.input} type="number" placeholder="e.g. 1250" value={receiptAmount} onChange={e=>setReceiptAmount(e.target.value)}/>
            <button style={s.saveBtn} onClick={submitReceipt} disabled={uploadingReceipt||!receiptFile||!accessToken||!uploader}>{uploadingReceipt?'Uploading…':'Submit for Approval'}</button>
            <button style={s.cancelBtn} onClick={()=>setShowReceipt(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* RECEIPT REVIEW MODAL */}
      {showReceipts&&isManager&&(
        <div style={s.modal} onClick={()=>setShowReceipts(false)}>
          <div style={s.modalCard} onClick={e=>e.stopPropagation()}>
            <div style={s.modalTitle}>{IC.receipt} Receipts <span style={{fontSize:13,color:C.muted,fontWeight:500}}>{pendingCount} pending</span></div>
            {receipts.length===0&&<div style={s.empty}>Wala pang resibo.</div>}
            {receipts.map(r=>{
              const st=RECEIPT_STATUS[r.status]||RECEIPT_STATUS.pending;
              return (
                <div key={r.id} style={s.rcptCard}>
                  <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                    {r.thumb?<img src={r.thumb} alt="" style={s.rcptThumb} referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display='none';}}/>:<div style={s.rcptThumbPh}>{IC.receipt}</div>}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                        <span style={{fontSize:14,fontWeight:600,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.note||'Receipt'}</span>
                        <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                          <span style={{padding:'4px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:st.bg,color:st.color}}>{st.label}</span>
                          <button style={s.rcptDelBtn} title="Delete" onClick={()=>deleteReceipt(r)}>{IC.trash}</button>
                        </div>
                      </div>
                      <div style={{fontSize:12,color:C.muted,margin:'3px 0 6px'}}>
                        {r.uploader?`by ${r.uploader} · `:''}{r.amount!=null?`₱${Number(r.amount).toLocaleString('en-PH')} · `:''}
                        {r.createdAt?.toDate?r.createdAt.toDate().toLocaleString('en-PH',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'just now'}
                      </div>
                      {r.link&&<a href={r.link} target="_blank" rel="noreferrer" style={s.rcptLink}>View in Drive ↗</a>}
                    </div>
                  </div>
                  {r.status==='pending'&&(
                    <div style={s.rcptActions}>
                      <button style={s.approveBtn} onClick={()=>reviewReceipt(r,'approved')}>{IC.check} Approve</button>
                      <button style={s.rejectBtn}  onClick={()=>reviewReceipt(r,'rejected')}>{IC.x} Reject</button>
                    </div>
                  )}
                </div>
              );
            })}
            <button style={s.cancelBtn} onClick={()=>setShowReceipts(false)}>Close</button>
          </div>
        </div>
      )}

      <div style={{height:80}}/>
    </div>
  );
}
