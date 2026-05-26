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
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  serverTimestamp,
  increment,
};