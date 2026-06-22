import { useState, useEffect } from "react";
import { C } from "../theme";
import { Card, GoldDivider, GoldButton } from "../components/UI";
import { db, auth, collection, query, orderBy, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDocs, where } from "../firebase";
import { useSettings } from "../hooks/useSettings";

const ADMIN_EMAIL = "davehack966@gmail.com";

function Badge({ children, color = C.gold }) {
  return (
    <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", padding:"2px 8px", borderRadius:20, background:`${color}20`, color, border:`1px solid ${color}40`, textTransform:"uppercase" }}>{children}</span>
  );
}

function StatCard({ icon, label, value, color = C.gold }) {
  return (
    <Card style={{ padding:"16px 14px", textAlign:"center" }}>
      <div style={{ fontSize:24, marginBottom:6 }}>{icon}</div>
      <div style={{ fontSize:22, fontWeight:800, color }}>{value}</div>
      <div style={{ fontSize:11, color:C.muted, marginTop:3, letterSpacing:"0.06em" }}>{label}</div>
    </Card>
  );
}

function SetBalanceModal({ targetUser, onClose }) {
  const [val, setVal]     = useState(targetUser.usdBalance?.toString() || "0");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    await setDoc(doc(db, "wallets", targetUser.uid), { usdBalance: parseFloat(val) || 0 }, { merge: true });
    setSaving(false);
    onClose();
  };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:C.bgCard, border:`1px solid ${C.borderStrong}`, borderRadius:20, padding:28, width:"100%", maxWidth:360 }}>
        <div style={{ fontSize:15, fontWeight:800, color:C.white, marginBottom:4 }}>Set Balance</div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:20 }}>{targetUser.email}</div>
        <div style={{ position:"relative", marginBottom:20 }}>
          <span style={{ position:"absolute", left:16, top:"50%", transform:"translateY(-50%)", color:C.gold, fontSize:20, fontWeight:700 }}>$</span>
          <input value={val} onChange={e=>setVal(e.target.value)} type="number"
            style={{ width:"100%", background:C.bgElevated, border:`1px solid ${C.gold}`, borderRadius:12, padding:"14px 16px 14px 36px", color:C.white, fontSize:22, fontWeight:800, outline:"none", boxSizing:"border-box" }} />
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:"13px", borderRadius:12, background:C.bgElevated, border:`1px solid ${C.border}`, color:C.white, fontWeight:700, cursor:"pointer" }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex:1, padding:"13px", borderRadius:12, background:`linear-gradient(135deg,${C.gold},${C.goldDim})`, border:"none", color:"#000", fontWeight:700, cursor:"pointer" }}>
            {saving?"Saving…":"Set Balance ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Manage User Modal — fee override, freeze, delete, activity ────
function ManageUserModal({ targetUser, allTransactions, allWithdrawals, onClose, onDeleted }) {
  const [customFee, setCustomFee]   = useState(targetUser.customFee?.toString() || "");
  const [frozen, setFrozen]         = useState(targetUser.frozen === true);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg]               = useState("");
  const [showActivity, setShowActivity] = useState(false);

  const userTxs = allTransactions.filter(t => t.fromUid===targetUser.uid || t.toUid===targetUser.uid);
  const userWds = allWithdrawals.filter(w => w.uid===targetUser.uid);

  const saveFee = async () => {
    setSaving(true);
    try {
      const feeVal = customFee.trim() === "" ? null : parseFloat(customFee);
      if (feeVal === null) {
        await setDoc(doc(db, "wallets", targetUser.uid), { customFee: null }, { merge:true });
      } else {
        await setDoc(doc(db, "wallets", targetUser.uid), { customFee: feeVal }, { merge:true });
      }
      setMsg("✓ Fee override saved!");
      setTimeout(() => setMsg(""), 2500);
    } catch { setMsg("❌ Failed to save."); }
    setSaving(false);
  };

  const toggleFrozen = async () => {
    const next = !frozen;
    setFrozen(next);
    try {
      await setDoc(doc(db, "wallets", targetUser.uid), { frozen: next }, { merge:true });
      setMsg(next ? "🔒 Account frozen" : "✓ Account unfrozen");
      setTimeout(() => setMsg(""), 2500);
    } catch {
      setFrozen(!next);
      setMsg("❌ Failed to update.");
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      // Delete wallet doc
      await deleteDoc(doc(db, "wallets", targetUser.uid));

      // Delete all transactions involving this user
      const txQ1 = query(collection(db,"transactions"), where("fromUid","==",targetUser.uid));
      const txQ2 = query(collection(db,"transactions"), where("toUid","==",targetUser.uid));
      const [snap1, snap2] = await Promise.all([getDocs(txQ1), getDocs(txQ2)]);
      const txDeletes = [...snap1.docs, ...snap2.docs].map(d => deleteDoc(doc(db,"transactions",d.id)));

      // Delete all withdrawals for this user
      const wdQ = query(collection(db,"withdrawals"), where("uid","==",targetUser.uid));
      const wdSnap = await getDocs(wdQ);
      const wdDeletes = wdSnap.docs.map(d => deleteDoc(doc(db,"withdrawals",d.id)));

      // Delete support messages
      const supQ = query(collection(db,"support"), where("uid","==",targetUser.uid));
      const supSnap = await getDocs(supQ);
      const supDeletes = supSnap.docs.map(d => deleteDoc(doc(db,"support",d.id)));

      await Promise.all([...txDeletes, ...wdDeletes, ...supDeletes]);

      onDeleted();
    } catch (e) {
      console.error(e);
      setMsg("❌ Failed to delete user completely.");
      setDeleting(false);
    }
  };

  const formatTime = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US",{ month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
  };

  if (showActivity) return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:C.bgCard, border:`1px solid ${C.borderStrong}`, borderRadius:"20px 20px 0 0", padding:"24px 20px 32px", width:"100%", maxWidth:480, maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:800, color:C.white }}>Activity Log</div>
          <button onClick={()=>setShowActivity(false)} style={{ background:"none", border:"none", color:C.muted, fontSize:20, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>{targetUser.email}</div>

        <div style={{ fontSize:12, fontWeight:700, color:C.gold, marginBottom:8 }}>💸 Withdrawals ({userWds.length})</div>
        {userWds.length === 0 ? (
          <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>No withdrawals</div>
        ) : (
          <Card hover={false} style={{ padding:0, overflow:"hidden", marginBottom:16 }}>
            {userWds.map((wd,i) => (
              <div key={wd.id}>
                <div style={{ padding:"10px 14px", display:"flex", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontSize:12, color:C.white, fontWeight:600 }}>{wd.amount} {wd.currency}</div>
                    <div style={{ fontSize:10, color:C.muted }}>{formatTime(wd.createdAt)}</div>
                  </div>
                  <Badge color={wd.status==="approved"?C.green:wd.status==="rejected"?C.red:C.gold}>{wd.status}</Badge>
                </div>
                {i<userWds.length-1 && <div style={{ height:1, background:C.border }} />}
              </div>
            ))}
          </Card>
        )}

        <div style={{ fontSize:12, fontWeight:700, color:C.gold, marginBottom:8 }}>📋 Transactions ({userTxs.length})</div>
        {userTxs.length === 0 ? (
          <div style={{ fontSize:12, color:C.muted }}>No transactions</div>
        ) : (
          <Card hover={false} style={{ padding:0, overflow:"hidden" }}>
            {userTxs.slice(0,30).map((tx,i,arr) => (
              <div key={tx.id}>
                <div style={{ padding:"10px 14px", display:"flex", justifyContent:"space-between" }}>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ fontSize:12, color:C.white, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{tx.note||tx.type}</div>
                    <div style={{ fontSize:10, color:C.muted }}>{formatTime(tx.createdAt)}</div>
                  </div>
                  <div style={{ fontSize:12, fontWeight:700, color:C.white, flexShrink:0, marginLeft:8 }}>${tx.amount?.toLocaleString()}</div>
                </div>
                {i<arr.length-1 && <div style={{ height:1, background:C.border }} />}
              </div>
            ))}
          </Card>
        )}

        <GoldButton onClick={()=>setShowActivity(false)} style={{ width:"100%", marginTop:20, padding:"14px" }}>Close</GoldButton>
      </div>
    </div>
  );

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:C.bgCard, border:`1px solid ${C.borderStrong}`, borderRadius:20, padding:28, width:"100%", maxWidth:380, maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ fontSize:16, fontWeight:800, color:C.white, marginBottom:4 }}>Manage User</div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:20 }}>{targetUser.email}</div>

        {msg && (
          <div style={{ marginBottom:16, padding:"10px 14px", borderRadius:10, background:msg.startsWith("✓")||msg.startsWith("🔒")?`${C.green}15`:`${C.red}15`, border:`1px solid ${msg.startsWith("✓")||msg.startsWith("🔒")?C.green:C.red}30`, color:msg.startsWith("✓")||msg.startsWith("🔒")?C.green:C.red, fontSize:12, fontWeight:600 }}>{msg}</div>
        )}

        {/* View Activity */}
        <button onClick={()=>setShowActivity(true)} style={{ width:"100%", padding:"12px", borderRadius:10, background:C.bgElevated, border:`1px solid ${C.border}`, color:C.white, fontSize:13, fontWeight:600, cursor:"pointer", marginBottom:16, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          📋 View Activity Log
        </button>

        <GoldDivider margin="0 0 16px" />

        {/* Per-user fee override */}
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em", display:"block", marginBottom:8 }}>CUSTOM WITHDRAWAL FEE (BLANK = USE GLOBAL)</label>
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:C.gold, fontWeight:700, fontSize:16 }}>$</span>
            <input value={customFee} onChange={e=>setCustomFee(e.target.value)} type="number" placeholder="Use global fee"
              style={{ width:"100%", background:C.bgElevated, border:`1px solid ${C.gold}`, borderRadius:12, padding:"12px 16px 12px 32px", color:C.white, fontSize:16, fontWeight:700, outline:"none", boxSizing:"border-box" }} />
          </div>
          <button onClick={saveFee} disabled={saving} style={{ width:"100%", marginTop:8, padding:"10px", borderRadius:10, background:`${C.gold}15`, border:`1px solid ${C.gold}40`, color:C.gold, fontSize:12, fontWeight:700, cursor:"pointer" }}>
            {saving ? "Saving…" : "Save Fee Override"}
          </button>
        </div>

        <GoldDivider margin="0 0 16px" />

        {/* Freeze toggle */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:C.white }}>{frozen ? "🔒 Account Frozen" : "Account Active"}</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{frozen ? "User cannot send or withdraw" : "User has full access"}</div>
          </div>
          <button onClick={toggleFrozen} style={{ padding:"8px 16px", borderRadius:10, background:frozen?`${C.green}15`:`${C.red}15`, border:`1px solid ${frozen?C.green:C.red}40`, color:frozen?C.green:C.red, fontSize:12, fontWeight:700, cursor:"pointer" }}>
            {frozen ? "Unfreeze" : "Freeze"}
          </button>
        </div>

        <GoldDivider margin="0 0 16px" />

        {/* Delete user */}
        <div style={{ background:`${C.red}08`, border:`1px solid ${C.red}30`, borderRadius:12, padding:"14px 16px", marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.red, marginBottom:6 }}>⚠️ Danger Zone</div>
          <div style={{ fontSize:11, color:C.mutedLight, lineHeight:1.6, marginBottom:12 }}>
            Permanently deletes this user's wallet, transactions, withdrawals, and support messages. This cannot be undone.
          </div>
          <button onClick={handleDelete} disabled={deleting} style={{ width:"100%", padding:"12px", borderRadius:10, background:confirmDelete?C.red:`${C.red}15`, border:`1px solid ${C.red}50`, color:confirmDelete?"#fff":C.red, fontSize:13, fontWeight:700, cursor:"pointer" }}>
            {deleting ? "Deleting…" : confirmDelete ? "⚠️ Confirm Delete — This Cannot Be Undone" : "🗑️ Delete User Completely"}
          </button>
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:"13px", borderRadius:12, background:C.bgElevated, border:`1px solid ${C.border}`, color:C.white, fontWeight:700, cursor:"pointer" }}>Close</button>
        </div>
      </div>
    </div>
  );
}

function WithdrawalRow({ wd, onApprove, onReject }) {
  const [acting, setActing] = useState(false);
  const statusColor = wd.status==="approved" ? C.green : wd.status==="rejected" ? C.red : C.gold;

  const formatTime = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US",{ month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
  };

  return (
    <div style={{ padding:"16px 18px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:C.white }}>{wd.userName}</div>
          <div style={{ fontSize:11, color:C.muted }}>{wd.userEmail}</div>
          <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{formatTime(wd.createdAt)}</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:16, fontWeight:800, color:C.white }}>${wd.usdValue?.toLocaleString("en-US",{minimumFractionDigits:2})}</div>
          <div style={{ fontSize:12, color:C.mutedLight }}>{wd.amount} {wd.currency}</div>
          <div style={{ marginTop:4 }}><Badge color={statusColor}>{wd.status}</Badge></div>
        </div>
      </div>

      {/* Details */}
      <div style={{ background:C.bgElevated, borderRadius:10, padding:"10px 14px", marginBottom:10 }}>
        {[
          ["Destination", wd.destWallet ? `${wd.destWallet.slice(0,16)}…` : "—"],
          ["TX Hash",     wd.txHash || "Not provided"],
          ["Proof File",  wd.proofName || "Not provided"],
          ["Fee",         `$${wd.fee}`],
          ["Net Receive", `$${wd.netReceive}`],
        ].map(([label,value]) => (
          <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0" }}>
            <span style={{ fontSize:11, color:C.muted }}>{label}</span>
            <span style={{ fontSize:11, color:C.white, fontWeight:600, fontFamily:label==="TX Hash"||label==="Destination"?"monospace":"inherit", maxWidth:"60%", textAlign:"right", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Action buttons — only show if pending */}
      {wd.status === "pending" && (
        <div style={{ display:"flex", gap:10 }}>
          <button
            onClick={async () => { setActing(true); await onReject(wd.id); setActing(false); }}
            disabled={acting}
            style={{ flex:1, padding:"10px", borderRadius:10, background:`${C.red}15`, border:`1px solid ${C.red}40`, color:C.red, fontWeight:700, fontSize:12, cursor:"pointer" }}
          >
            ✕ Reject
          </button>
          <button
            onClick={async () => { setActing(true); await onApprove(wd.id, wd.uid); setActing(false); }}
            disabled={acting}
            style={{ flex:1, padding:"10px", borderRadius:10, background:`${C.green}15`, border:`1px solid ${C.green}40`, color:C.green, fontWeight:700, fontSize:12, cursor:"pointer" }}
          >
            ✓ Approve
          </button>
        </div>
      )}

      {wd.status === "approved" && (
        <div style={{ padding:"8px 14px", borderRadius:10, background:`${C.green}10`, border:`1px solid ${C.green}30`, textAlign:"center", fontSize:12, color:C.green, fontWeight:600 }}>
          ✓ Withdrawal Approved
        </div>
      )}
      {wd.status === "rejected" && (
        <div style={{ padding:"8px 14px", borderRadius:10, background:`${C.red}10`, border:`1px solid ${C.red}30`, textAlign:"center", fontSize:12, color:C.red, fontWeight:600 }}>
          ✕ Withdrawal Rejected
        </div>
      )}
    </div>
  );
}

// ── Settings Panel — Wallet + Fee ────────────────────────────────
function SettingsPanel() {
  const { settings, updateSettings } = useSettings();
  const [fee, setFee]       = useState(settings.withdrawalFee?.toString() || "350");
  const [wallet, setWallet] = useState(settings.withdrawWallet || "");
  const [minWd, setMinWd]   = useState(settings.minWithdrawal?.toString() || "100");
  const [maxWd, setMaxWd]   = useState(settings.maxWithdrawal?.toString() || "50000");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState("");

  useEffect(() => {
    setFee(settings.withdrawalFee?.toString() || "350");
    setWallet(settings.withdrawWallet || "");
    setMinWd(settings.minWithdrawal?.toString() || "100");
    setMaxWd(settings.maxWithdrawal?.toString() || "50000");
  }, [settings]);

  const saveAll = async () => {
    setSaving(true);
    await updateSettings({
      withdrawalFee:  parseFloat(fee)  || 350,
      withdrawWallet: wallet.trim()    || "bc1qmwt97a72cmwvkkqq9zervfqd8j43nm7mqdv5ze",
      minWithdrawal:  parseFloat(minWd)|| 100,
      maxWithdrawal:  parseFloat(maxWd)|| 50000,
    });
    setSaving(false);
    setSaved("✓ Settings saved!");
    setTimeout(() => setSaved(""), 3000);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* Fee + Wallet */}
      <Card hover={false} style={{ padding:"18px 20px", display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.white }}>💸 Withdrawal Fee</div>
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
            <span style={{ fontSize:11, color:C.muted }}>Fixed fee charged per withdrawal</span>
            <span style={{ fontSize:16, fontWeight:800, color:C.gold }}>${fee}</span>
          </div>
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:C.gold, fontWeight:700, fontSize:16 }}>$</span>
            <input value={fee} onChange={e=>setFee(e.target.value)} type="number" placeholder="350"
              style={{ width:"100%", background:C.bgElevated, border:`1px solid ${C.gold}`, borderRadius:12, padding:"12px 16px 12px 32px", color:C.white, fontSize:18, fontWeight:700, outline:"none", boxSizing:"border-box" }} />
          </div>
          <div style={{ display:"flex", gap:8, marginTop:10 }}>
            {[50,100,200,350,500,1000].map(v => (
              <button key={v} onClick={()=>setFee(v.toString())} style={{ flex:1, padding:"6px 4px", borderRadius:8, cursor:"pointer", background:fee===v.toString()?C.goldGlow:C.bgElevated, border:`1px solid ${fee===v.toString()?C.gold:C.border}`, color:fee===v.toString()?C.gold:C.muted, fontSize:11, fontWeight:700 }}>${v}</button>
            ))}
          </div>
        </div>

        <GoldDivider margin="0" />

        {/* Withdrawal Wallet Address */}
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:C.white, marginBottom:6 }}>Withdrawal Wallet Address</div>
          <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>Where users send the processing fee</div>
          <input
            value={wallet}
            onChange={e => setWallet(e.target.value)}
            placeholder="bc1q..."
            style={{ width:"100%", background:C.bgElevated, border:`1px solid ${C.gold}`, borderRadius:12, padding:"12px 14px", color:C.white, fontSize:12, outline:"none", boxSizing:"border-box", fontFamily:"monospace" }}
          />
          <div style={{ fontSize:11, color:C.mutedLight, marginTop:6 }}>This address is shown to all users during withdrawal.</div>
        </div>

        <GoldDivider margin="0" />

        {/* Min Withdrawal */}
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
            <span style={{ fontSize:13, fontWeight:700, color:C.white }}>Minimum Withdrawal</span>
            <span style={{ fontSize:14, fontWeight:700, color:C.mutedLight }}>${minWd}</span>
          </div>
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:C.gold, fontWeight:700, fontSize:14 }}>$</span>
            <input value={minWd} onChange={e=>setMinWd(e.target.value)} type="number" placeholder="100"
              style={{ width:"100%", background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:12, padding:"10px 14px 10px 30px", color:C.white, fontSize:14, fontWeight:700, outline:"none", boxSizing:"border-box" }} />
          </div>
        </div>

        {/* Max Withdrawal */}
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
            <span style={{ fontSize:13, fontWeight:700, color:C.white }}>Maximum Withdrawal</span>
            <span style={{ fontSize:14, fontWeight:700, color:C.mutedLight }}>${parseFloat(maxWd||0).toLocaleString()}</span>
          </div>
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:C.gold, fontWeight:700, fontSize:14 }}>$</span>
            <input value={maxWd} onChange={e=>setMaxWd(e.target.value)} type="number" placeholder="50000"
              style={{ width:"100%", background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:12, padding:"10px 14px 10px 30px", color:C.white, fontSize:14, fontWeight:700, outline:"none", boxSizing:"border-box" }} />
          </div>
        </div>
      </Card>

      {/* Current summary */}
      <Card hover={false} style={{ padding:"16px 18px", background:`${C.gold}08`, border:`1px solid ${C.gold}20` }}>
        <div style={{ fontSize:12, fontWeight:700, color:C.gold, marginBottom:10 }}>📊 Current Settings</div>
        {[
          ["Withdrawal Fee", `$${settings.withdrawalFee||350}`],
          ["Wallet Address", `${(settings.withdrawWallet||"").slice(0,16)}…`],
          ["Min Withdrawal", `$${settings.minWithdrawal||100}`],
          ["Max Withdrawal", `$${(settings.maxWithdrawal||50000).toLocaleString()}`],
        ].map(([label,value]) => (
          <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0" }}>
            <span style={{ fontSize:12, color:C.muted }}>{label}</span>
            <span style={{ fontSize:12, fontWeight:700, color:C.white, fontFamily:label==="Wallet Address"?"monospace":"inherit" }}>{value}</span>
          </div>
        ))}
      </Card>

      {saved && (
        <div style={{ padding:"12px 16px", borderRadius:10, background:`${C.green}15`, border:`1px solid ${C.green}40`, color:C.green, fontSize:13, fontWeight:600, textAlign:"center" }}>{saved}</div>
      )}
      <GoldButton onClick={saveAll} disabled={saving} style={{ width:"100%", padding:"16px", fontSize:15 }}>
        {saving ? "Saving…" : "💾 Save Settings"}
      </GoldButton>
    </div>
  );
}

export default function AdminScreen({ user }) {
  const [users, setUsers]             = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [tab, setTab]                 = useState("withdrawals");
  const [search, setSearch]           = useState("");
  const [editUser, setEditUser]       = useState(null);
  const [manageUser, setManageUser]   = useState(null);
  const [loading, setLoading]         = useState(true);
  const [confirmed, setConfirmed]     = useState("");

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const showConfirmed = (msg) => { setConfirmed(msg); setTimeout(() => setConfirmed(""), 3000); };

  // Load wallets
  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(collection(db, "wallets"), snap => {
      const list = [];
      snap.forEach(d => list.push({ uid:d.id, ...d.data() }));
      setUsers(list.sort((a,b) => (b.usdBalance||0)-(a.usdBalance||0)));
      setLoading(false);
    });
    return () => unsub();
  }, [isAdmin]);

  // Load transactions
  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, "transactions"), orderBy("createdAt","desc"));
    const unsub = onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id:d.id, ...d.data() }));
      setTransactions(list);
    });
    return () => unsub();
  }, [isAdmin]);

  // Load withdrawals
  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, "withdrawals"), orderBy("createdAt","desc"));
    const unsub = onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id:d.id, ...d.data() }));
      setWithdrawals(list);
    });
    return () => unsub();
  }, [isAdmin]);

  const approveWithdrawal = async (wdId, userUid) => {
  const approvedAt = new Date();
  await updateDoc(doc(db, "withdrawals", wdId), { status:"approved", approvedAt });
  const txQ = query(collection(db, "transactions"), where("fromUid","==",userUid), where("type","==","withdrawal"), where("status","==","pending"));
  const txSnap = await getDocs(txQ);
  txSnap.forEach(async d => {
    await updateDoc(doc(db, "transactions", d.id), { status:"approved", approvedAt });
  });
  showConfirmed("✓ Withdrawal approved!");
};

  const rejectWithdrawal = async (wdId) => {
    await updateDoc(doc(db, "withdrawals", wdId), { status:"rejected", rejectedAt: new Date() });
    const wd = withdrawals.find(w => w.id === wdId);
    if (wd) {
      const txQ = query(collection(db, "transactions"), where("fromUid","==",wd.uid), where("type","==","withdrawal"), where("status","==","pending"));
      const txSnap = await getDocs(txQ);
      txSnap.forEach(async d => {
        await updateDoc(doc(db, "transactions", d.id), { status:"rejected" });
      });
    }
    showConfirmed("✕ Withdrawal rejected.");
  };

  if (!isAdmin) return (
    <div style={{ textAlign:"center", padding:"80px 20px", color:C.muted }}>
      <div style={{ fontSize:48, marginBottom:16 }}>🔒</div>
      <div style={{ fontSize:16, fontWeight:700, color:C.white }}>Access Denied</div>
      <div style={{ fontSize:13, marginTop:8 }}>Admin access only</div>
    </div>
  );

  const totalBalance  = users.reduce((s,u) => s+(u.usdBalance||0), 0);
  const totalVolume   = transactions.reduce((s,t) => s+(t.amount||0), 0);
  const pendingCount  = withdrawals.filter(w => w.status==="pending").length;

  const filteredUsers = users.filter(u =>
    (u.email||"").toLowerCase().includes(search.toLowerCase()) ||
    (u.name||"").toLowerCase().includes(search.toLowerCase())
  );
  const filteredTxs = transactions.filter(t =>
    (t.fromEmail||"").includes(search) || (t.toEmail||"").includes(search) || (t.note||"").includes(search)
  );
  const filteredWds = withdrawals.filter(w =>
    (w.userEmail||"").includes(search) || (w.userName||"").includes(search)
  );

  const formatTime = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US",{ month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,#0f0f0f,#1a1400)`, border:`1px solid ${C.borderStrong}`, borderRadius:16, padding:"18px 20px" }}>
        <div style={{ fontSize:11, color:C.gold, letterSpacing:"0.15em", marginBottom:4 }}>⚙️ ADMIN PANEL</div>
        <div style={{ fontSize:20, fontWeight:800, color:C.white }}>NOVA Vault Dashboard</div>
        <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>Full visibility · Real-time data</div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
        <StatCard icon="👥" label="Total Users"    value={users.length}       color={C.gold}  />
        <StatCard icon="⏳" label="Pending Withdrawals" value={pendingCount}  color={pendingCount>0?C.red:C.green} />
        <StatCard icon="💰" label="Total Balances" value={`$${Math.round(totalBalance).toLocaleString()}`} color={C.gold} />
        <StatCard icon="📊" label="Tx Volume"      value={`$${Math.round(totalVolume).toLocaleString()}`} color={C.green} />
      </div>

      {/* Confirmed toast */}
      {confirmed && (
        <div style={{ padding:"12px 16px", borderRadius:10, background:confirmed.startsWith("✓")?`${C.green}15`:`${C.red}15`, border:`1px solid ${confirmed.startsWith("✓")?C.green:C.red}30`, color:confirmed.startsWith("✓")?C.green:C.red, fontSize:13, fontWeight:600, textAlign:"center" }}>
          {confirmed}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:12, padding:4, gap:4, overflowX:"auto" }}>
        {[
          ["withdrawals", `💸 Withdrawals${pendingCount>0?` (${pendingCount})`:""}` ],
          ["users",       "👥 Users"],
          ["txs",         "📋 Transactions"],
          ["settings",    "⚙️ Settings"],
        ].map(([t,label]) => (
          <button key={t} onClick={()=>setTab(t)} style={{ flex:1, padding:"9px 6px", borderRadius:9, border:"none", cursor:"pointer", background:tab===t?C.gold:"transparent", color:tab===t?"#000":C.muted, fontWeight:700, fontSize:11, transition:"all 0.2s", whiteSpace:"nowrap" }}>{label}</button>
        ))}
      </div>

      {/* Search — not on settings tab */}
      {tab !== "settings" && (
        <div style={{ position:"relative" }}>
          <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:C.muted, fontSize:15 }}>⌕</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…"
            style={{ width:"100%", background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 16px 12px 40px", color:C.white, fontSize:13, outline:"none", boxSizing:"border-box" }} />
          {search && <button onClick={()=>setSearch("")} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:16 }}>✕</button>}
        </div>
      )}

      {/* WITHDRAWALS tab */}
      {tab==="withdrawals" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.white }}>
            {filteredWds.length} withdrawal request{filteredWds.length!==1?"s":""}
            {pendingCount > 0 && <span style={{ color:C.red, marginLeft:8 }}>· {pendingCount} pending</span>}
          </div>
          {filteredWds.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:C.muted }}>
              <div style={{ fontSize:32, marginBottom:8 }}>💸</div>
              <div>No withdrawal requests yet</div>
            </div>
          ) : (
            <Card hover={false} style={{ padding:0, overflow:"hidden" }}>
              {filteredWds.map((wd,i) => (
                <div key={wd.id}>
                  <WithdrawalRow wd={wd} onApprove={approveWithdrawal} onReject={rejectWithdrawal} />
                  {i < filteredWds.length-1 && <div style={{ height:1, background:C.border }} />}
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* USERS tab */}
      {tab==="users" && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.white }}>{filteredUsers.length} user{filteredUsers.length!==1?"s":""}</div>
          {loading ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:C.muted }}>Loading…</div>
          ) : filteredUsers.map(u => (
            <Card key={u.uid} style={{ padding:"16px 18px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <div style={{ width:42, height:42, borderRadius:"50%", background:`linear-gradient(135deg,${C.gold},${C.goldDim})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:800, color:"#000", flexShrink:0, position:"relative" }}>
                  {(u.name||u.email||"?")[0].toUpperCase()}
                  {u.frozen && <div style={{ position:"absolute", bottom:-2, right:-2, fontSize:12 }}>🔒</div>}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.white, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:6 }}>
                    {u.name||"Unknown"}
                    {u.customFee !== undefined && u.customFee !== null && <Badge color={C.gold}>Custom Fee</Badge>}
                  </div>
                  <div style={{ fontSize:11, color:C.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.email||u.uid}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:16, fontWeight:800, color:C.white }}>${(u.usdBalance||0).toLocaleString("en-US",{minimumFractionDigits:2})}</div>
                  <div style={{ display:"flex", gap:6, marginTop:6 }}>
                    <button onClick={()=>setEditUser(u)} style={{ padding:"5px 10px", borderRadius:8, background:`${C.gold}15`, border:`1px solid ${C.gold}30`, color:C.gold, fontSize:11, fontWeight:700, cursor:"pointer" }}>✎ Balance</button>
                    <button onClick={()=>setManageUser(u)} style={{ padding:"5px 10px", borderRadius:8, background:`${C.red}15`, border:`1px solid ${C.red}30`, color:C.red, fontSize:11, fontWeight:700, cursor:"pointer" }}>⚙️ Manage</button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* TRANSACTIONS tab */}
      {tab==="txs" && (
        <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.white, marginBottom:12 }}>{filteredTxs.length} transaction{filteredTxs.length!==1?"s":""}</div>
          {filteredTxs.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:C.muted }}>No transactions yet</div>
          ) : (
            <Card hover={false} style={{ padding:0, overflow:"hidden" }}>
              {filteredTxs.slice(0,50).map((tx,i) => {
                const isWd = tx.type==="withdrawal";
                const statusColor = tx.status==="approved"?C.green:tx.status==="rejected"?C.red:tx.status==="completed"?C.green:C.gold;
                return (
                  <div key={tx.id}>
                    <div style={{ padding:"14px 18px", display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ width:36, height:36, borderRadius:"50%", flexShrink:0, background:isWd?`${C.red}15`:`${C.green}15`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:isWd?C.red:C.green }}>
                        {isWd?"↓":"⇄"}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:C.white, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {tx.fromName||tx.fromEmail||"?"} {isWd?"→ Withdrawal":`→ ${tx.toName||tx.toEmail||"?"}`}
                        </div>
                        <div style={{ fontSize:11, color:C.muted, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {tx.note||"Transfer"} · {formatTime(tx.createdAt)}
                        </div>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        <div style={{ fontSize:14, fontWeight:800, color:isWd?C.red:C.green }}>
                          {isWd?"-":"+"}{tx.amount?.toLocaleString("en-US",{minimumFractionDigits:2})}
                        </div>
                        <Badge color={statusColor}>{tx.status||"pending"}</Badge>
                      </div>
                    </div>
                    {i<Math.min(filteredTxs.length,50)-1&&<div style={{ height:1, background:C.border, margin:"0 18px" }} />}
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      )}

      {/* SETTINGS tab */}
      {tab==="settings" && <SettingsPanel />}

      {editUser && <SetBalanceModal targetUser={editUser} onClose={()=>setEditUser(null)} />}

      {manageUser && (
        <ManageUserModal
          targetUser={manageUser}
          allTransactions={transactions}
          allWithdrawals={withdrawals}
          onClose={()=>setManageUser(null)}
          onDeleted={()=>{ setManageUser(null); showConfirmed("✓ User deleted completely."); }}
        />
      )}
    </div>
  );
}