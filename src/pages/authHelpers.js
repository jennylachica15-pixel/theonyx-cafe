import { auth, db } from '../firebase/config';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, deleteDoc, serverTimestamp, collection, getDocs, query, where,
} from 'firebase/firestore';

const DOMAIN = '@theonyxcafe.games';
const SESSION_KEY = 'onyxGameSession';

// ── localStorage helpers ──────────────────────────────────────────────────────
export function saveGameSession(uid, username) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ uid, username })); } catch (_) {}
}
export function clearGameSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
}
export function getStoredGameSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (_) { return null; }
}

// ── validate username format ──────────────────────────────────────────────────
function validateUsername(username) {
  if (!username || username.length < 3 || username.length > 20)
    return 'Username must be 3–20 characters.';
  if (!/^[a-zA-Z0-9._-]+$/.test(username))
    return 'Only letters, numbers, dots, dashes, and underscores allowed.';
  return null;
}

// ── register new game user ────────────────────────────────────────────────────
export async function registerUser(username, password) {
  const usernameError = validateUsername(username);
  if (usernameError) return { error: usernameError };
  if (!password || password.length < 6)
    return { error: 'Password must be at least 6 characters.' };

  const email = `${username.toLowerCase()}${DOMAIN}`;

  // check if username already taken
  const existing = await getDocs(
    query(collection(db, 'chatUsers'), where('nameLower', '==', username.toLowerCase()))
  ).catch(() => null);
  if (existing && !existing.empty) return { error: 'Username already taken.' };

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: username });
    await setDoc(doc(db, 'chatUsers', cred.user.uid), {
      name: username, nameLower: username.toLowerCase(),
      email, isAdmin: false, createdAt: serverTimestamp(), lastSeen: serverTimestamp(),
    });
    saveGameSession(cred.user.uid, username);
    return { user: cred.user, username };
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') return { error: 'Username already taken.' };
    return { error: err.message };
  }
}

// ── login existing game user ──────────────────────────────────────────────────
export async function loginUser(username, password) {
  if (!username || !password) return { error: 'Enter your username and password.' };

  const email = `${username.toLowerCase()}${DOMAIN}`;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (!cred.user.displayName) {
      await updateProfile(cred.user, { displayName: username });
    }
    // ensure chatUsers entry exists
    await setDoc(doc(db, 'chatUsers', cred.user.uid), {
      name: username, nameLower: username.toLowerCase(),
      email, isAdmin: false, lastSeen: serverTimestamp(),
    }, { merge: true });
    saveGameSession(cred.user.uid, username);
    return { user: cred.user, username };
  } catch (err) {
    // ── auto-migrate from old plain-text gameUsers system ──
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      return migrateOldUser(username, password);
    }
    if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      return { error: 'Incorrect password.' };
    }
    return { error: err.message };
  }
}

async function migrateOldUser(username, password) {
  try {
    // look up old record
    const oldRef = doc(db, 'gameUsers', username.toLowerCase());
    const oldSnap = await getDoc(oldRef);
    if (!oldSnap.exists()) return { error: 'Username not found.' };
    const oldData = oldSnap.data();
    if (oldData.password !== password) return { error: 'Incorrect password.' };

    // create Firebase Auth account
    const email = `${username.toLowerCase()}${DOMAIN}`;
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: username });
    await setDoc(doc(db, 'chatUsers', cred.user.uid), {
      name: username, nameLower: username.toLowerCase(),
      email, isAdmin: false, migratedFrom: 'gameUsers',
      createdAt: serverTimestamp(), lastSeen: serverTimestamp(),
    });
    // remove old plain-text record
    await deleteDoc(oldRef).catch(() => {});
    saveGameSession(cred.user.uid, username);
    return { user: cred.user, username };
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      // account was already created — just sign in
      return loginUser(username, password);
    }
    return { error: err.message };
  }
}

// ── logout ────────────────────────────────────────────────────────────────────
export async function logoutUser() {
  clearGameSession();
  await signOut(auth);
}
