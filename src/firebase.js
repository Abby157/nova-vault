import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  serverTimestamp,
  increment,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDiwsmzSXQBwzJzXiyXF_rZVaB9sBNU4nA",
  authDomain: "nova-vault-app.firebaseapp.com",
  projectId: "nova-vault-app",
  storageBucket: "nova-vault-app.firebasestorage.app",
  messagingSenderId: "697158526749",
  appId: "1:697158526749:web:e4e70c8a0dd6cfd941a3f4",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Creates a partner-admin Firebase Auth account without replacing the
// currently signed-in Super Admin session. A temporary password is generated
// only for the secondary auth session, then a password-reset email is sent.
export async function provisionPartnerAdminAuth(email) {
  const secondaryApp = initializeApp(firebaseConfig, `nova-admin-provision-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const secondaryAuth = getAuth(secondaryApp);
  const tempPassword = `${crypto.randomUUID()}Aa1!`;

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, tempPassword);
    await sendPasswordResetEmail(secondaryAuth, email);
    await signOut(secondaryAuth);
    return { uid: credential.user.uid, resetSent: true };
  } finally {
    // Firebase does not require an explicit app deletion for this short-lived
    // browser helper; the secondary auth instance is signed out and unused.
  }
}

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  serverTimestamp,
  increment,
};