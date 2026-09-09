import { useState, useEffect } from "react";
import { db, doc, onSnapshot, setDoc } from "../firebase";
import { useCurrency } from "./useCurrency";

// Per-user display currency, stored on their own users/{uid} doc so each
// account can pick its own currency instead of one global platform setting.
// All balances/ledger amounts stay stored and computed in USD — this only
// changes what symbol/number is shown.
export function useUserCurrency(uid) {
  const [currencyCode, setCurrencyCodeState] = useState("USD");

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "users", uid), snap => {
      if (snap.exists()) setCurrencyCodeState(snap.data().currency || "USD");
    });
    return () => unsub();
  }, [uid]);

  const setCurrencyCode = async (code) => {
    setCurrencyCodeState(code);
    if (uid) await setDoc(doc(db, "users", uid), { currency: code }, { merge: true });
  };

  return { currencyCode, setCurrencyCode, ...useCurrency(currencyCode) };
}
