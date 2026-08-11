import { useState, useEffect } from "react";
import { db, doc, onSnapshot, collection, query, where, getDocs } from "../firebase";

export function usePartnerAdmin(userEmail) {
  const [partnerAdmin, setPartnerAdmin] = useState(null)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    if (!userEmail) { setLoading(false); return }

    const q = query(
      collection(db, "partnerAdmins"),
      where("email",  "==", userEmail.toLowerCase()),
      where("active", "==", true)
    )

    getDocs(q).then(snap => {
      if (!snap.empty) {
        setPartnerAdmin({ id: snap.docs[0].id, ...snap.docs[0].data() })
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [userEmail])

  return { partnerAdmin, loading }
}