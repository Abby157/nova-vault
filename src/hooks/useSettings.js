import { useState, useEffect } from "react";
import { db, doc, onSnapshot, setDoc } from "../firebase";

const DEFAULTS = {
  withdrawalFee: 350,
  withdrawWallet: "bc1qmwt97a72cmwvkkqq9zervfqd8j43nm7mqdv5ze",
  minWithdrawal: 100,
  maxWithdrawal: 50000,
};

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "app"), snap => {
      if (snap.exists()) setSettings(prev => ({ ...prev, ...snap.data() }));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const updateSettings = async (newSettings) => {
    await setDoc(doc(db, "settings", "app"), newSettings, { merge: true });
  };

  return { settings, loading, updateSettings };
}