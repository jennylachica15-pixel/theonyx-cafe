import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCboHvu__PvwakE516dNWM3fm_eTFDt9zw",
  authDomain: "theonyx-cafe.firebaseapp.com",
  projectId: "theonyx-cafe",
  storageBucket: "theonyx-cafe.firebasestorage.app",
  messagingSenderId: "91444742156",
  appId: "1:91444742156:web:53a5580687dcc3af0c0629",
  measurementId: "G-BCRYJD9GH0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
