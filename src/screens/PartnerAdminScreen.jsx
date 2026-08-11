import { useState, useEffect } from "react"
import { C } from "../theme"
import { Card, GoldDivider, GoldButton } from "../components/UI"
import { db, collection, query, where, getDocs, doc, setDoc, updateDoc, onSnapshot, orderBy, getDoc } from "../firebase"

function Badge({ children, color = C.gold }) {
  return (
    <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", padding:"2px 8px", borderRadius:20, background:`${color}20`, color, border:`1px solid ${color}40`, textTransform:"uppercase" }}>
      {children}
    </span>
  )
}

function StatCard({ icon, label, value, color = C.gold }) {
  return (
    <Card style={{ padding:"16px 14px", textAlign:"center" }}>
      <div style={{ fontSize:24, marginBottom:6 }}>{icon}</div>
      <div style={{ fontSize:22, fontWeight:800, color }}>{value}</div>
      <div style={{ fontSize:11, color:C.muted, marginTop:3, letterSpacing:"0.06em" }}>{label}</div>
    </Card>
  )
}

export default function PartnerAdminScreen({ user, partnerAdmin: initialPartnerAdmin }) {
  const [partnerAdmin, setPartnerAdmin] = useState(initialPartnerAdmin)
  const [users,        setUsers]        = useState([])
  const [withdrawals,  setWithdrawals]  = useState([])
  const [tab,          setTab]          = useState("overview")
  const [fee,          setFee]          = useState(initialPartnerAdmin?.fee?.toString() || "")
  const [wallet,       setWallet]       = useState(initialPartnerAdmin?.wallet || "")
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState("")
  const [search,       setSearch]       = useState("")
  const [copied,       setCopied]       = useState(false)

  const signupLink = `${window.location.origin}/?ref=${partnerAdmin?.code}`

  // Load fresh partner data + users + withdrawals
  const load = async () => {
    if (!partnerAdmin?.id) return
    try {
      // Reload fresh partner doc
      const partnerSnap = await getDoc(doc(db, "partnerAdmins", partnerAdmin.id))
      if (partnerSnap.exists()) {
        const fresh = { id: partnerSnap.id, ...partnerSnap.data() }
        setPartnerAdmin(fresh)
        setFee(fresh.fee?.toString() || "")
        setWallet(fresh.wallet || "")
      }

      // Load users by partnerCode
      const usersSnap = await getDocs(
        query(collection(db, "wallets"), where("partnerCode", "==", partnerAdmin.code))
      )
      setUsers(usersSnap.docs.map(d => ({ uid: d.id, ...d.data() })))
    } catch (err) { console.error(err) }
  }

  useEffect(() => {
    if (!partnerAdmin?.code) return
    load()

    // Live withdrawals
    const unsub = onSnapshot(
      query(collection(db, "withdrawals"), where("partnerCode", "==", partnerAdmin.code), orderBy("createdAt", "desc")),
      snap => setWithdrawals(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return () => unsub()
  }, [partnerAdmin?.code])

  const handleCopy = () => {
    const el = document.createElement("textarea")
    el.value = signupLink
    el.style.position = "fixed"
    el.style.left = "-9999px"
    document.body.appendChild(el)
    el.focus()
    el.select()
    document.execCommand("copy")
    document.body.removeChild(el)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const newFee    = parseFloat(fee) || 0
      const newWallet = wallet.trim()

      // Update partner admin doc
      await updateDoc(doc(db, "partnerAdmins", partnerAdmin.id), {
        fee:    newFee,
        wallet: newWallet,
      })

      // Update all partner's users with new fee and wallet
      for (const u of users) {
        await setDoc(doc(db, "wallets", u.uid), {
          customFee:    newFee,
          customWallet: newWallet,
        }, { merge: true })
      }

      // Reload fresh data so UI reflects changes immediately
      await load()

      setSaved("✓ Settings saved and applied to all your users!")
      setTimeout(() => setSaved(""), 3000)
    } catch (err) {
      console.error(err)
      setSaved("❌ Failed to save settings")
    }
    setSaving(false)
  }

  const filteredUsers = users.filter(u =>
    (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.name  || "").toLowerCase().includes(search.toLowerCase())
  )

  const pendingCount = withdrawals.filter(w => w.status === "pending").length

  const formatTime = ts => {
    if (!ts) return "—"
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleDateString("en-US", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,#0f0f0f,#1a1400)`, border:`1px solid ${C.borderStrong}`, borderRadius:16, padding:"18px 20px" }}>
        <div style={{ fontSize:11, color:C.gold, letterSpacing:"0.15em", marginBottom:4 }}>⚙️ PARTNER ADMIN</div>
        <div style={{ fontSize:20, fontWeight:800, color:C.white }}>{partnerAdmin?.name}</div>
        <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>Code: <span style={{ color:C.gold, fontWeight:700, fontFamily:"monospace" }}>{partnerAdmin?.code}</span></div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
        <StatCard icon="👥" label="Your Users"          value={users.length}       color={C.gold} />
        <StatCard icon="⏳" label="Pending Withdrawals" value={pendingCount}        color={pendingCount > 0 ? C.red : C.green} />
        <StatCard icon="💸" label="Your Fee"            value={`$${partnerAdmin?.fee || 0}`} color={C.gold} />
        <StatCard icon="📋" label="Total Withdrawals"   value={withdrawals.length} color={C.green} />
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:12, padding:4, gap:4, overflowX:"auto" }}>
        {[
          ["overview",    "📊 Overview"],
          ["users",       `👥 Users (${users.length})`],
          ["withdrawals", `💸 Withdrawals${pendingCount > 0 ? ` (${pendingCount})` : ""}`],
          ["settings",    "⚙️ Settings"],
        ].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{ flex:1, padding:"9px 6px", borderRadius:9, border:"none", cursor:"pointer", background:tab===t?C.gold:"transparent", color:tab===t?"#000":C.muted, fontWeight:700, fontSize:11, transition:"all 0.2s", whiteSpace:"nowrap" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <Card hover={false} style={{ padding:"16px 18px" }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.gold, marginBottom:10 }}>🔗 Your Signup Link</div>
            <div style={{ background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", marginBottom:10, fontFamily:"monospace", fontSize:11, color:C.mutedLight, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {signupLink}
            </div>
            <button onClick={handleCopy} style={{ width:"100%", padding:"10px", borderRadius:10, background:copied?`${C.green}15`:`${C.gold}15`, border:`1px solid ${copied?C.green:C.gold}40`, color:copied?C.green:C.gold, fontSize:12, fontWeight:700, cursor:"pointer" }}>
              {copied ? "✓ Copied!" : "Copy Signup Link"}
            </button>
          </Card>

          <Card hover={false} style={{ padding:"16px 18px", background:`${C.gold}08`, border:`1px solid ${C.gold}20` }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.gold, marginBottom:10 }}>📊 Your Current Settings</div>
            {[
              ["Withdrawal Fee",  `$${partnerAdmin?.fee || "Not set"}`],
              ["Wallet Address",  partnerAdmin?.wallet ? `${partnerAdmin.wallet.slice(0,20)}…` : "Not set"],
              ["Referral Code",   partnerAdmin?.code],
              ["Total Users",     users.length],
            ].map(([label, value]) => (
              <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
                <span style={{ fontSize:12, color:C.muted }}>{label}</span>
                <span style={{ fontSize:12, fontWeight:700, color: value === "Not set" ? C.red : C.white }}>{value}</span>
              </div>
            ))}
          </Card>

          {/* Prompt if fee/wallet not set */}
          {(!partnerAdmin?.fee && !partnerAdmin?.wallet) && (
            <div style={{ padding:"14px 16px", borderRadius:12, background:`${C.gold}08`, border:`1px solid ${C.gold}30`, textAlign:"center" }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.gold, marginBottom:6 }}>⚠️ Setup Required</div>
              <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>You haven't set your withdrawal fee and wallet yet. Set them before sharing your link.</div>
              <button onClick={() => setTab("settings")} style={{ padding:"9px 20px", borderRadius:10, background:`linear-gradient(135deg,${C.gold},${C.goldDim})`, border:"none", color:"#000", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                Go to Settings →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Users */}
      {tab === "users" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:C.muted, fontSize:15 }}>⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users…"
              style={{ width:"100%", background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 16px 12px 40px", color:C.white, fontSize:13, outline:"none", boxSizing:"border-box" }} />
          </div>

          <div style={{ fontSize:13, fontWeight:700, color:C.white }}>{filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}</div>

          {filteredUsers.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:C.muted }}>
              <div style={{ fontSize:32, marginBottom:8 }}>👥</div>
              <div>No users yet — share your signup link!</div>
            </div>
          ) : (
            <Card hover={false} style={{ padding:0, overflow:"hidden" }}>
              {filteredUsers.map((u, i) => (
                <div key={u.uid}>
                  <div style={{ padding:"14px 18px", display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ width:40, height:40, borderRadius:"50%", background:`linear-gradient(135deg,${C.gold},${C.goldDim})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:"#000", flexShrink:0 }}>
                      {(u.name || u.email || "?")[0].toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:C.white, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.name || "Unknown"}</div>
                      <div style={{ fontSize:11, color:C.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.email}</div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontSize:15, fontWeight:800, color:C.white }}>${(u.usdBalance || 0).toLocaleString("en-US", { minimumFractionDigits:2 })}</div>
                      <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>balance</div>
                    </div>
                  </div>
                  {i < filteredUsers.length - 1 && <div style={{ height:1, background:C.border }} />}
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* Withdrawals */}
      {tab === "withdrawals" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.white }}>
            {withdrawals.length} withdrawal{withdrawals.length !== 1 ? "s" : ""}
            {pendingCount > 0 && <span style={{ color:C.red, marginLeft:8 }}>· {pendingCount} pending</span>}
          </div>
          {withdrawals.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:C.muted }}>
              <div style={{ fontSize:32, marginBottom:8 }}>💸</div>
              <div>No withdrawals yet</div>
            </div>
          ) : (
            <Card hover={false} style={{ padding:0, overflow:"hidden" }}>
              {withdrawals.map((wd, i) => {
                const statusColor = wd.status === "approved" ? C.green : wd.status === "rejected" ? C.red : C.gold
                return (
                  <div key={wd.id}>
                    <div style={{ padding:"14px 18px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:C.white }}>{wd.userName}</div>
                          <div style={{ fontSize:11, color:C.muted }}>{wd.userEmail}</div>
                          <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{formatTime(wd.createdAt)}</div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:16, fontWeight:800, color:C.white }}>${wd.usdValue?.toLocaleString("en-US", { minimumFractionDigits:2 })}</div>
                          <div style={{ fontSize:12, color:C.mutedLight }}>{wd.amount} {wd.currency}</div>
                          <div style={{ marginTop:4 }}><Badge color={statusColor}>{wd.status}</Badge></div>
                        </div>
                      </div>
                      {wd.status === "pending" && (
                        <div style={{ padding:"8px 12px", borderRadius:8, background:`${C.gold}10`, border:`1px solid ${C.gold}30`, fontSize:11, color:C.gold, textAlign:"center" }}>
                          ⏳ Pending — approved by super admin
                        </div>
                      )}
                    </div>
                    {i < withdrawals.length - 1 && <div style={{ height:1, background:C.border }} />}
                  </div>
                )
              })}
            </Card>
          )}
        </div>
      )}

      {/* Settings */}
      {tab === "settings" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>
            Set your withdrawal fee and wallet address. Changes apply to all your existing and future users automatically.
          </div>

          <Card hover={false} style={{ padding:"18px 20px", display:"flex", flexDirection:"column", gap:16 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:C.white, marginBottom:8 }}>💸 Your Withdrawal Fee</div>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:C.gold, fontWeight:700, fontSize:16 }}>$</span>
                <input value={fee} onChange={e => setFee(e.target.value)} type="number"
                  placeholder={partnerAdmin?.fee?.toString() || "e.g. 350"}
                  style={{ width:"100%", background:C.bgElevated, border:`1px solid ${C.gold}`, borderRadius:12, padding:"12px 16px 12px 32px", color:C.white, fontSize:18, fontWeight:700, outline:"none", boxSizing:"border-box" }} />
              </div>
              <div style={{ display:"flex", gap:8, marginTop:10 }}>
                {[50, 100, 200, 350, 500, 1000].map(v => (
                  <button key={v} onClick={() => setFee(v.toString())} style={{ flex:1, padding:"6px 4px", borderRadius:8, cursor:"pointer", background:fee===v.toString()?C.goldGlow:C.bgElevated, border:`1px solid ${fee===v.toString()?C.gold:C.border}`, color:fee===v.toString()?C.gold:C.muted, fontSize:11, fontWeight:700 }}>${v}</button>
                ))}
              </div>
            </div>

            <GoldDivider margin="0" />

            <div>
              <div style={{ fontSize:13, fontWeight:700, color:C.white, marginBottom:6 }}>👛 Your Wallet Address</div>
              <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>Users will send the withdrawal fee to this address</div>
              <input value={wallet} onChange={e => setWallet(e.target.value)} placeholder="bc1q… or 0x…"
                style={{ width:"100%", background:C.bgElevated, border:`1px solid ${C.gold}`, borderRadius:12, padding:"12px 14px", color:C.white, fontSize:12, outline:"none", boxSizing:"border-box", fontFamily:"monospace" }} />
            </div>
          </Card>

          {saved && (
            <div style={{ padding:"12px 16px", borderRadius:10, background:saved.startsWith("✓")?`${C.green}15`:`${C.red}15`, border:`1px solid ${saved.startsWith("✓")?C.green:C.red}30`, color:saved.startsWith("✓")?C.green:C.red, fontSize:13, fontWeight:600, textAlign:"center" }}>
              {saved}
            </div>
          )}

          <GoldButton onClick={saveSettings} disabled={saving} style={{ width:"100%", padding:"16px", fontSize:15 }}>
            {saving ? "Saving…" : "💾 Save Settings"}
          </GoldButton>

          <div style={{ fontSize:11, color:C.muted, textAlign:"center" }}>
            Saving updates fee & wallet for all {users.length} of your existing users
          </div>
        </div>
      )}
    </div>
  )
}