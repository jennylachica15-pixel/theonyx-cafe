import { auth, db } from '../firebase/config';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  updateProfile, signOut,
} from 'firebase/auth';
import { doc, getDoc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';

// One account for the whole app (games + chat), username-only UX.
// Behind the scenes each username maps to a hidden Firebase Auth email.
const EMAIL_DOMAIN = 'theonyxcafe.games';
const cleanName = (username) => username.trim();
const keyOf = (username) => cleanName(username).toLowerCase();
const emailFor = (username) => `${keyOf(username).replace(/[^a-z0-9._-]/g, '.')}@${EMAIL_DOMAIN}`;
const VALID_USERNAME = /^[a-zA-Z0-9._-]{3,20}$/;
// Firebase requires 6+ char passwords; legacy accounts may have shorter ones,
// so short passwords get a deterministic pad (applied the same way every login).
const fbPassword = (password) => (password.length >= 6 ? password : password + '#onyx');

// Put/refresh the user in the chat "People" directory the moment they sign in,
// no matter where they signed in from (Games tab or Chat tab).
async function touchUserDoc(user, name) {
  try {
    await setDoc(doc(db, 'chatUsers', user.uid), {
      name: name || user.displayName || (user.email ? user.email.split('@')[0] : 'Guest'),
      email: user.email || '',
      lastSeen: serverTimestamp(),
    }, { merge: true });
  } catch {}
}

export async function registerUser(username, password) {
  const name = cleanName(username);
  if (!VALID_USERNAME.test(name)) throw new Error('Username must be 3-20 letters/numbers (no spaces).');
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');
  const legacy = await getDoc(doc(db, 'gameUsers', keyOf(name)));
  if (legacy.exists()) throw new Error('Username already taken!');
  try {
    const cred = await createUserWithEmailAndPassword(auth, emailFor(name), password);
    await updateProfile(cred.user, { displayName: name });
    await touchUserDoc(cred.user, name);
    return name;
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') throw new Error('Username already taken!');
    throw new Error('Could not create account. Please try again.');
  }
}

export async function loginUser(username, password) {
  const name = cleanName(username);
  const email = emailFor(name);

  // 1) Normal path: account already exists in Firebase Auth
  try {
    const cred = await signInWithEmailAndPassword(auth, email, fbPassword(password));
    await touchUserDoc(cred.user, cred.user.displayName || name);
    return cred.user.displayName || name;
  } catch (e) { /* fall through to legacy check below */ }

  // 2) Legacy path: account still lives in the old gameUsers collection.
  //    If the old credentials match, silently migrate to Firebase Auth
  //    and remove the old record (which stored the password in plain text).
  const ref = doc(db, 'gameUsers', keyOf(name));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Wrong username or password!');
  if (snap.data().password !== password) throw new Error('Wrong password!');
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, fbPassword(password));
    await updateProfile(cred.user, { displayName: snap.data().username || name });
    await touchUserDoc(cred.user, snap.data().username || name);
    deleteDoc(ref).catch(() => {});
    return cred.user.displayName || name;
  } catch (e) {
    throw new Error('Could not sign in. Please try again.');
  }
}

export function logoutUser() {
  return signOut(auth);
}
