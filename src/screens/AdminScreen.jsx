import { useState, useEffect } from "react";
import { Users, Clock, Wallet, BarChart3, Banknote, Receipt, UserCog, Settings as SettingsIcon, AlertTriangle, Trash2, UserPlus, Save, Pencil, Lock } from "lucide-react";
import { C } from "../theme";
import { Card, GoldDivider, GoldButton, FeelButton } from "../components/UI";
import { db, collection, query, orderBy, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDocs, where, addDoc, serverTimestamp, getDoc } from "../firebase";
import { useSettings } from "../hooks/useSettings";
import { sendEmail, Emails } from "../notifications";

const ADMIN_EMAIL = "davehack966@gmail.com";
const ADMIN_PERMISSIONS = {
  canViewUsers: true,
  canEditWallet: true,
  canAdjustBalance: true,
  canViewTransactions: true,
};

const makeReferralCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "NV-";
  for (let i=0;i<8;i++) code += chars[Math.floor(Math.random()*chars.length)];
  return code;
};

const makeAdminId = () => {
  try { return crypto.randomUUID(); }
  catch { return `admin_${Date.now()}_${Math.random().toString(36).slice(2,9)}`; }
};

const REJECTION_REASONS = [
  "Insufficient proof of payment",
  "Incorrect destination wallet address",
  "Processing fee not received",
  "Transaction hash could not be verified",
  "Suspicious activity detected",
  "Other (specify below)",
];

function Badge({ children, color = C.gold }) {
  return (
    <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", padding:"2px 8px", borderRadius:20, background:`${color}20`, color, border:`1px solid ${color}40`, textTransform:"uppercase" }}>{children}</span>
  );
}

function StatCard({ icon: Icon, label, value, color = C.gold }) {
  return (
    <Card style={{ padding:"16px 14px", textAlign:"center" }}>
      <div style={{ marginBottom:6, color, display:"flex", justifyContent:"center" }}><Icon size={22} strokeWidth={2} /></div>
      <div style={{ fontSize:22, fontWeight:800, color }}>{value}</div>
      <div style={{ fontSize:11, color:C.muted, marginTop:3, letterSpacing:"0.06em" }}>{label}</div>
    </Card>
  );
}

function SetBalanceModal({ targetUser, onClose, actor }) {
  const [val, setVal]     = useState(targetUser.usdBalance?.toString() || "0");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const next = parseFloat(val);
    if (!Number.isFinite(next) || next < 0) return;
    setSaving(true);
    try {
      const previous = Number(targetUser.usdBalance || 0);
      await setDoc(doc(db, "wallets", targetUser.uid), {
        usdBalance: next,
        lastBalanceUpdateAt: new Date(),
        lastBalanceUpdatedBy: actor?.uid || actor?.email || "super_admin",
      }, { merge: true });

      await addDoc(collection(db, "balanceLedger"), {
        userId: targetUser.uid,
        adminId: actor?.adminId || "super_admin",
        actorUid: actor?.uid || null,
        actorEmail: actor?.email || null,
        previousBalance: previous,
        newBalance: next,
        adjustment: next - previous,
        currency: "USD",
        type: "balance_set",
        reason: "Admin balance update",
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "balance_updated",
        adminId: actor?.adminId || "super_admin",
        actorUid: actor?.uid || null,
        actorEmail: actor?.email || null,
        targetUserId: targetUser.uid,
        details: `Balance changed from $${previous.toFixed(2)} to $${next.toFixed(2)}`,
        createdAt: serverTimestamp(),
      });
    } finally {
      setSaving(false);
      onClose();
    }
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
          <FeelButton onClick={onClose} style={{ flex:1, padding:"13px", borderRadius:12, background:C.bgElevated, border:`1px solid ${C.border}`, color:C.white, fontWeight:700, cursor:"pointer" }}>Cancel</FeelButton>
          <FeelButton onClick={save} disabled={saving} style={{ flex:1, padding:"13px", borderRadius:12, background:`linear-gradient(135deg,${C.gold},${C.goldDim})`, border:"none", color:"#000", fontWeight:700, cursor:"pointer" }}>
            {saving?"Saving…":"Set Balance ✓"}
          </FeelButton>
        </div>
      </div>
    </div>
  );
}

// ── Manage User Modal — fee override, freeze, delete, activity ────
function ManageUserModal({ targetUser, allTransactions, allWithdrawals, onClose, onDeleted, actor, canEditWallet = true }) {
  const [customFee, setCustomFee]   = useState(targetUser.customFee?.toString() || "");
  const [walletAddress, setWalletAddress] = useState(targetUser.walletAddress || targetUser.address || "");
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

  const saveWalletAddress = async () => {
  if (!canEditWallet) return;

  const next = walletAddress.trim();
  if (!next) {
    setMsg("❌ Wallet address cannot be empty.");
    return;
  }

  setSaving(true);

  try {
    const previous = targetUser.walletAddress || targetUser.address || "";

    // Update the user's wallet record
    await setDoc(
      doc(db, "wallets", targetUser.uid),
      {
        walletAddress: next,
        address: next,
        lastWalletUpdateAt: serverTimestamp(),
        lastWalletUpdatedBy: actor?.uid || actor?.email || null,
      },
      { merge: true }
    );

    // Record the action, but don't let an audit-log failure
    // make a successful wallet update appear to be stuck.
    try {
      await addDoc(collection(db, "auditLogs"), {
        action: "wallet_address_updated",
        adminId: targetUser.adminId || actor?.adminId || "super_admin",
        actorUid: actor?.uid || null,
        actorEmail: actor?.email || null,
        targetUserId: targetUser.uid,
        details: "Wallet address updated",
        previousAddress: previous,
        newAddress: next,
        createdAt: serverTimestamp(),
      });
    } catch (auditError) {
      console.warn("Wallet saved, but audit log failed:", auditError);
    }

    // Update the local object immediately
    targetUser.walletAddress = next;
    targetUser.address = next;

    setMsg("✓ Wallet address saved!");
    setTimeout(() => setMsg(""), 2500);
  } catch (error) {
    console.error("Wallet update failed:", error);
    setMsg(`❌ Failed to save wallet address: ${error?.message || "Unknown error"}`);
  } finally {
    setSaving(false);
  }
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
          <FeelButton onClick={()=>setShowActivity(false)} style={{ background:"none", border:"none", color:C.muted, fontSize:20, cursor:"pointer" }}>✕</FeelButton>
        </div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>{targetUser.email}</div>

        <div style={{ fontSize:12, fontWeight:700, color:C.gold, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}><Banknote size={14} /> Withdrawals ({userWds.length})</div>
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

        <div style={{ fontSize:12, fontWeight:700, color:C.gold, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}><Receipt size={14} /> Transactions ({userTxs.length})</div>
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
        <FeelButton onClick={()=>setShowActivity(true)} style={{ width:"100%", padding:"12px", borderRadius:10, background:C.bgElevated, border:`1px solid ${C.border}`, color:C.white, fontSize:13, fontWeight:600, cursor:"pointer", marginBottom:16, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          <Receipt size={15} /> View Activity Log
        </FeelButton>

        <GoldDivider margin="0 0 16px" />

        {/* Per-user fee override */}
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em", display:"block", marginBottom:8 }}>CUSTOM WITHDRAWAL FEE (BLANK = USE GLOBAL)</label>
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:C.gold, fontWeight:700, fontSize:16 }}>$</span>
            <input value={customFee} onChange={e=>setCustomFee(e.target.value)} type="number" placeholder="Use global fee"
              style={{ width:"100%", background:C.bgElevated, border:`1px solid ${C.gold}`, borderRadius:12, padding:"12px 16px 12px 32px", color:C.white, fontSize:16, fontWeight:700, outline:"none", boxSizing:"border-box" }} />
          </div>
          <FeelButton onClick={saveFee} disabled={saving} style={{ width:"100%", marginTop:8, padding:"10px", borderRadius:10, background:`${C.gold}15`, border:`1px solid ${C.gold}40`, color:C.gold, fontSize:12, fontWeight:700, cursor:"pointer" }}>
            {saving ? "Saving…" : "Save Fee Override"}
          </FeelButton>
        </div>

        <GoldDivider margin="0 0 16px" />

        {/* Wallet address */}
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em", display:"block", marginBottom:8 }}>USER WALLET ADDRESS</label>
          <input
            value={walletAddress}
            onChange={e=>setWalletAddress(e.target.value)}
            disabled={!canEditWallet || saving}
            placeholder="Wallet address"
            style={{ width:"100%", background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 14px", color:C.white, fontSize:12, outline:"none", boxSizing:"border-box", fontFamily:"monospace" }}
          />
          <FeelButton onClick={saveWalletAddress} disabled={!canEditWallet || saving}
            style={{ width:"100%", marginTop:8, padding:"11px", borderRadius:10, background:C.bgElevated, border:`1px solid ${C.gold}40`, color:C.gold, fontSize:12, fontWeight:700, cursor:canEditWallet?"pointer":"not-allowed", opacity:canEditWallet?1:.5 }}>
            {saving ? "Saving…" : "Save Wallet Address"}
          </FeelButton>
        </div>

        <GoldDivider margin="0 0 16px" />

        {/* Freeze toggle */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:C.white, display:"flex", alignItems:"center", gap:6 }}>{frozen && <Lock size={13} />} {frozen ? "Account Frozen" : "Account Active"}</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{frozen ? "User cannot send or withdraw" : "User has full access"}</div>
          </div>
          <FeelButton onClick={toggleFrozen} style={{ padding:"8px 16px", borderRadius:10, background:frozen?`${C.green}15`:`${C.red}15`, border:`1px solid ${frozen?C.green:C.red}40`, color:frozen?C.green:C.red, fontSize:12, fontWeight:700, cursor:"pointer" }}>
            {frozen ? "Unfreeze" : "Freeze"}
          </FeelButton>
        </div>

        <GoldDivider margin="0 0 16px" />

        {/* Delete user */}
        <div style={{ background:`${C.red}08`, border:`1px solid ${C.red}30`, borderRadius:12, padding:"14px 16px", marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.red, marginBottom:6, display:"flex", alignItems:"center", gap:6 }}><AlertTriangle size={13} /> Danger Zone</div>
          <div style={{ fontSize:11, color:C.mutedLight, lineHeight:1.6, marginBottom:12 }}>
            Permanently deletes this user's wallet, transactions, withdrawals, and support messages. This cannot be undone.
          </div>
          <FeelButton onClick={handleDelete} disabled={deleting} style={{ width:"100%", padding:"12px", borderRadius:10, background:confirmDelete?C.red:`${C.red}15`, border:`1px solid ${C.red}50`, color:confirmDelete?"#fff":C.red, fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            {deleting ? "Deleting…" : confirmDelete ? <><AlertTriangle size={15} /> Confirm Delete — This Cannot Be Undone</> : <><Trash2 size={15} /> Delete User Completely</>}
          </FeelButton>
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <FeelButton onClick={onClose} style={{ flex:1, padding:"13px", borderRadius:12, background:C.bgElevated, border:`1px solid ${C.border}`, color:C.white, fontWeight:700, cursor:"pointer" }}>Close</FeelButton>
        </div>
      </div>
    </div>
  );
}

// ── Reject Reason Modal ────────────────────────────────────────────
function RejectReasonModal({ wd, onConfirm, onCancel }) {
  const [reason, setReason]       = useState(REJECTION_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [sending, setSending]     = useState(false);

  const finalReason = reason === "Other (specify below)" ? customReason.trim() : reason;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:C.bgCard, border:`1px solid ${C.borderStrong}`, borderRadius:20, padding:28, width:"100%", maxWidth:380 }}>
        <div style={{ fontSize:16, fontWeight:800, color:C.white, marginBottom:4 }}>Reject Withdrawal</div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:20 }}>{wd.userEmail} · ${wd.usdValue?.toLocaleString()}</div>

        <label style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em", display:"block", marginBottom:8 }}>REASON FOR REJECTION</label>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
          {REJECTION_REASONS.map(r => (
            <div key={r} onClick={()=>setReason(r)} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10, background:reason===r?`${C.gold}15`:C.bgElevated, border:`1px solid ${reason===r?C.gold:C.border}`, cursor:"pointer" }}>
              <div style={{ width:16, height:16, borderRadius:"50%", border:`2px solid ${reason===r?C.gold:C.muted}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {reason===r && <div style={{ width:8, height:8, borderRadius:"50%", background:C.gold }} />}
              </div>
              <span style={{ fontSize:13, color:C.white }}>{r}</span>
            </div>
          ))}
        </div>

        {reason === "Other (specify below)" && (
          <textarea
            value={customReason}
            onChange={e=>setCustomReason(e.target.value)}
            placeholder="Describe the reason for rejection…"
            rows={3}
            style={{ width:"100%", background:C.bgElevated, border:`1px solid ${C.gold}`, borderRadius:12, padding:"12px 14px", color:C.white, fontSize:13, outline:"none", boxSizing:"border-box", marginBottom:16, resize:"vertical", fontFamily:"inherit" }}
          />
        )}

        <div style={{ display:"flex", gap:10 }}>
          <FeelButton onClick={onCancel} style={{ flex:1, padding:"13px", borderRadius:12, background:C.bgElevated, border:`1px solid ${C.border}`, color:C.white, fontWeight:700, cursor:"pointer" }}>Cancel</FeelButton>
          <FeelButton
            onClick={async () => {
              if (!finalReason) return;
              setSending(true);
              await onConfirm(finalReason);
              setSending(false);
            }}
            disabled={sending || !finalReason}
            style={{ flex:1, padding:"13px", borderRadius:12, background:`${C.red}15`, border:`1px solid ${C.red}50`, color:C.red, fontWeight:700, cursor:"pointer" }}
          >
            {sending ? "Rejecting…" : "Confirm Rejection"}
          </FeelButton>
        </div>
      </div>
    </div>
  );
}

function WithdrawalRow({ wd, onApprove, onReject }) {
  const [acting, setActing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
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
          <FeelButton
            onClick={() => setShowRejectModal(true)}
            disabled={acting}
            style={{ flex:1, padding:"10px", borderRadius:10, background:`${C.red}15`, border:`1px solid ${C.red}40`, color:C.red, fontWeight:700, fontSize:12, cursor:"pointer" }}
          >
            ✕ Reject
          </FeelButton>
          <FeelButton
            onClick={async () => { setActing(true); await onApprove(wd.id, wd.uid); setActing(false); }}
            disabled={acting}
            style={{ flex:1, padding:"10px", borderRadius:10, background:`${C.green}15`, border:`1px solid ${C.green}40`, color:C.green, fontWeight:700, fontSize:12, cursor:"pointer" }}
          >
            ✓ Approve
          </FeelButton>
        </div>
      )}

      {wd.status === "approved" && (
        <div style={{ padding:"8px 14px", borderRadius:10, background:`${C.green}10`, border:`1px solid ${C.green}30`, textAlign:"center", fontSize:12, color:C.green, fontWeight:600 }}>
          ✓ Withdrawal Approved
        </div>
      )}
      {wd.status === "rejected" && (
        <div style={{ padding:"8px 14px", borderRadius:10, background:`${C.red}10`, border:`1px solid ${C.red}30`, textAlign:"center", fontSize:12, color:C.red, fontWeight:600 }}>
          ✕ Withdrawal Rejected{wd.rejectionReason ? ` · ${wd.rejectionReason}` : ""}
        </div>
      )}

      {showRejectModal && (
        <RejectReasonModal
          wd={wd}
          onCancel={() => setShowRejectModal(false)}
          onConfirm={async (reason) => {
            setActing(true);
            await onReject(wd.id, reason);
            setActing(false);
            setShowRejectModal(false);
          }}
        />
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
        <div style={{ fontSize:13, fontWeight:700, color:C.white, display:"flex", alignItems:"center", gap:6 }}><Banknote size={15} /> Withdrawal Fee</div>
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
              <FeelButton key={v} onClick={()=>setFee(v.toString())} style={{ flex:1, padding:"6px 4px", borderRadius:8, cursor:"pointer", background:fee===v.toString()?C.goldGlow:C.bgElevated, border:`1px solid ${fee===v.toString()?C.gold:C.border}`, color:fee===v.toString()?C.gold:C.muted, fontSize:11, fontWeight:700 }}>${v}</FeelButton>
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
        <div style={{ fontSize:12, fontWeight:700, color:C.gold, marginBottom:10, display:"flex", alignItems:"center", gap:6 }}><BarChart3 size={14} /> Current Settings</div>
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
      <GoldButton onClick={saveAll} disabled={saving} style={{ width:"100%", padding:"16px", fontSize:15, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
        {saving ? "Saving…" : <><Save size={16} /> Save Settings</>}
      </GoldButton>
    </div>
  );
}


function AdminManagementPanel({ users, showConfirmed }) {
  const [admins, setAdmins] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState("");
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "admins"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => {
      setAdmins(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    });
  }, []);

  const createAdmin = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!name.trim() || !cleanEmail) return;
    setCreating(true);
    try {
      const existingQ = query(collection(db, "admins"), where("email", "==", cleanEmail));
      const existing = await getDocs(existingQ);
      if (!existing.empty) {
        showConfirmed("⚠️ An admin with that email already exists.");
        return;
      }

      const adminId = makeAdminId();
      let code = makeReferralCode();
      for (let attempt = 0; attempt < 10; attempt++) {
        const codeSnap = await getDoc(doc(db, "referralLinks", code));
        if (!codeSnap.exists()) break;
        code = makeReferralCode();
      }

      const finalCodeSnap = await getDoc(doc(db, "referralLinks", code));
      if (finalCodeSnap.exists()) {
        throw new Error("Could not generate a unique referral code. Please try again.");
      }

      await setDoc(doc(db, "admins", adminId), {
        name: name.trim(),
        email: cleanEmail,
        role: "admin",
        active: true,
        authUid: null,
        referralCode: code,
        permissions: { ...ADMIN_PERMISSIONS },
        createdAt: serverTimestamp(),
      });

      try {
        await setDoc(doc(db, "referralLinks", code), {
          code,
          adminId,
          adminName: name.trim(),
          adminEmail: cleanEmail,
          role: "admin",
          active: true,
          createdAt: serverTimestamp(),
        });
      } catch (refErr) {
        await deleteDoc(doc(db, "admins", adminId)).catch(() => {});
        throw refErr;
      }

      await addDoc(collection(db, "auditLogs"), {
        action: "admin_created",
        adminId: "super_admin",
        targetAdminId: adminId,
        details: `Created partner admin ${cleanEmail} with referral code ${code}`,
        createdAt: serverTimestamp(),
      });

      const url = `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
      setName("");
      setEmail("");
      showConfirmed(`✓ Partner admin created. Referral link ready: ${url}`);
    } catch (e) {
      console.error("Failed to create admin:", e);
      const code = e?.code ? ` [${e.code}]` : "";
      const message = e?.message || "Unknown error";
      showConfirmed(`❌ Failed to create admin${code}: ${message}`);
    } finally {
      setCreating(false);
    }
  };

  const toggleAdmin = async (admin) => {
    try {
      const active = !admin.active;
      await updateDoc(doc(db, "admins", admin.id), { active });
      await updateDoc(doc(db, "referralLinks", admin.referralCode), { active }).catch(() => {});
      await addDoc(collection(db, "auditLogs"), {
        action: active ? "admin_reactivated" : "admin_deactivated",
        adminId: "super_admin",
        targetAdminId: admin.id,
        createdAt: serverTimestamp(),
      });
      showConfirmed(active ? "✓ Admin reactivated." : "✓ Admin deactivated.");
    } catch (e) {
      console.error(e);
      showConfirmed("❌ Failed to update admin.");
    }
  };

  const updatePermissions = async (admin, key) => {
    const permissions = { ...ADMIN_PERMISSIONS, ...(admin.permissions || {}) };
    permissions[key] = !permissions[key];
    try {
      await updateDoc(doc(db, "admins", admin.id), { permissions });
      await addDoc(collection(db, "auditLogs"), {
        action: "admin_permissions_updated",
        adminId: "super_admin",
        targetAdminId: admin.id,
        details: `${key} = ${permissions[key]}`,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
      showConfirmed("❌ Failed to update permissions.");
    }
  };

  const referralUrl = (code) => `${window.location.origin}/?ref=${encodeURIComponent(code)}`;

  const copyLink = async (code) => {
    const url = referralUrl(code);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(code);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      window.prompt("Copy this registration link:", url);
    }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <Card hover={false} style={{ padding:"18px 20px" }}>
        <div style={{ fontSize:14, fontWeight:800, color:C.white, marginBottom:4, display:"flex", alignItems:"center", gap:6 }}><UserPlus size={16} /> Create Partner Admin</div>
        <div style={{ fontSize:11, color:C.muted, lineHeight:1.6, marginBottom:14 }}>
          Create a partner admin profile and a unique registration link. The partner uses this link to create their Nova Vault account and then receives the Admin dashboard.
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Admin full name"
            style={{ width:"100%", boxSizing:"border-box", background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px", color:C.white, outline:"none" }} />
          <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="Admin email address"
            style={{ width:"100%", boxSizing:"border-box", background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px", color:C.white, outline:"none" }} />
          <GoldButton onClick={createAdmin} disabled={creating || !name.trim() || !email.trim()} style={{ width:"100%", padding:"13px" }}>
            {creating ? "Creating…" : "Create Admin + Generate Link"}
          </GoldButton>
        </div>
      </Card>

      <div style={{ fontSize:13, fontWeight:700, color:C.white }}>
        {admins.length} partner admin{admins.length!==1?"s":""}
      </div>

      {admins.length === 0 ? (
        <Card hover={false} style={{ padding:30, textAlign:"center", color:C.muted }}>
          No partner admins created yet.
        </Card>
      ) : admins.map(admin => {
        const assigned = users.filter(u => u.adminId === admin.id);
        const perms = { ...ADMIN_PERMISSIONS, ...(admin.permissions || {}) };
        const url = referralUrl(admin.referralCode);
        return (
          <Card key={admin.id} hover={false} style={{ padding:"16px 18px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:"50%", background:`linear-gradient(135deg,${C.gold},${C.goldDim})`, display:"flex", alignItems:"center", justifyContent:"center", color:"#000", fontWeight:800 }}>
                {(admin.name||admin.email||"?")[0].toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:C.white, fontSize:13, fontWeight:800 }}>{admin.name}</div>
                <div style={{ color:C.muted, fontSize:11, overflow:"hidden", textOverflow:"ellipsis" }}>{admin.email}</div>
                <div style={{ marginTop:5, display:"flex", gap:6, flexWrap:"wrap" }}>
                  <Badge color={admin.active ? C.green : C.red}>{admin.active ? "Active" : "Inactive"}</Badge>
                  <Badge color={C.gold}>{assigned.length} Users</Badge>
                </div>
              </div>
            </div>

            <div style={{ marginTop:14, background:C.bgElevated, borderRadius:10, padding:"10px 12px" }}>
              <div style={{ fontSize:10, color:C.muted, letterSpacing:"0.08em", marginBottom:5 }}>PERSONAL REGISTRATION LINK</div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <div style={{ flex:1, minWidth:0, fontSize:11, color:C.white, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontFamily:"monospace" }}>{url}</div>
                <FeelButton onClick={()=>copyLink(admin.referralCode)} style={{ padding:"7px 9px", borderRadius:8, border:`1px solid ${C.gold}40`, background:`${C.gold}12`, color:C.gold, fontSize:10, fontWeight:700, cursor:"pointer" }}>
                  {copied===admin.referralCode ? "Copied" : "Copy"}
                </FeelButton>
              </div>
              <div style={{ marginTop:6, fontSize:10, color:C.muted }}>Code: <span style={{ color:C.gold, fontFamily:"monospace" }}>{admin.referralCode}</span></div>
            </div>

            <div style={{ display:"flex", gap:8, marginTop:12 }}>
              <FeelButton onClick={()=>setExpanded(expanded===admin.id?null:admin.id)}
                style={{ flex:1, padding:"9px", borderRadius:9, background:C.bgElevated, border:`1px solid ${C.border}`, color:C.white, fontSize:11, fontWeight:700, cursor:"pointer" }}>
                {expanded===admin.id ? "Hide Details" : "Manage Admin"}
              </FeelButton>
              <FeelButton onClick={()=>toggleAdmin(admin)}
                style={{ flex:1, padding:"9px", borderRadius:9, background:admin.active?`${C.red}12`:`${C.green}12`, border:`1px solid ${admin.active?C.red:C.green}35`, color:admin.active?C.red:C.green, fontSize:11, fontWeight:700, cursor:"pointer" }}>
                {admin.active ? "Deactivate" : "Reactivate"}
              </FeelButton>
            </div>

            {expanded===admin.id && (
              <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
                <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>Permissions</div>
                {Object.entries({
                  canViewUsers:"View Users",
                  canEditWallet:"Edit Wallet",
                  canAdjustBalance:"Adjust Balance",
                  canViewTransactions:"View Transactions",
                }).map(([key,label]) => (
                  <FeelButton key={key} onClick={()=>updatePermissions(admin,key)}
                    style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", background:"none", border:"none", color:C.white, cursor:"pointer" }}>
                    <span style={{ fontSize:12 }}>{label}</span>
                    <Badge color={perms[key] ? C.green : C.red}>{perms[key] ? "Allowed" : "Blocked"}</Badge>
                  </FeelButton>
                ))}
                <div style={{ fontSize:11, color:C.muted, marginTop:8 }}>
                  Auth account: {admin.authUid ? "Linked" : "Not linked — the admin must sign in/register with this email."}
                </div>
              </div>
            )}
          </Card>
        );
      })}
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
  const [admins, setAdmins]           = useState([]);

  const isSuperAdmin = user?.role === "super_admin" || user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const isAdmin = isSuperAdmin || user?.role === "admin";
  const myAdminId = user?.adminId || null;

  const showConfirmed = (msg) => { setConfirmed(msg); setTimeout(() => setConfirmed(""), 3000); };

  // Load partner admin profiles (Super Admin only)
  useEffect(() => {
    if (!isSuperAdmin) return;
    const unsub = onSnapshot(collection(db, "admins"), snap => {
      setAdmins(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    });
    return () => unsub();
  }, [isSuperAdmin]);

  // Load the signed-in partner's own permission profile.
  useEffect(() => {
    if (!isAdmin || isSuperAdmin || !myAdminId) return;
    let alive = true;
    getDoc(doc(db, "admins", myAdminId)).then(snap => {
      if (alive && snap.exists()) setAdmins([{ id:snap.id, ...snap.data() }]);
    }).catch(console.error);
    return () => { alive = false; };
  }, [isAdmin, isSuperAdmin, myAdminId]);

  // Load wallets. Partner admins query only their assigned users so
  // Firestore rules can enforce isolation at the database level.
  useEffect(() => {
    if (!isAdmin) return;
    const source = isSuperAdmin
      ? collection(db, "wallets")
      : query(collection(db, "wallets"), where("adminId", "==", myAdminId));

    const unsub = onSnapshot(source, snap => {
      const list = [];
      snap.forEach(d => list.push({ uid:d.id, ...d.data() }));
      setUsers(list.sort((a,b) => (b.usdBalance||0)-(a.usdBalance||0)));
      setLoading(false);
    }, err => {
      console.error("Wallet access failed:", err);
      setLoading(false);
    });
    return () => unsub();
  }, [isAdmin, isSuperAdmin, myAdminId]);

  // Load transactions. Partners receive only transactions involving
  // their assigned users.
  useEffect(() => {
    if (!isAdmin) return;
    const q = isSuperAdmin
      ? query(collection(db, "transactions"), orderBy("createdAt","desc"))
      : query(collection(db, "transactions"), where("adminId", "==", myAdminId));
    const unsub = onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id:d.id, ...d.data() }));
      list.sort((a,b) => {
        const av = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
        const bv = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
        return bv - av;
      });
      setTransactions(list);
    }, err => console.error("Transaction access failed:", err));
    return () => unsub();
  }, [isAdmin, isSuperAdmin, myAdminId]);

  // Load withdrawals scoped to the partner admin.
  useEffect(() => {
    if (!isAdmin) return;
    const q = isSuperAdmin
      ? query(collection(db, "withdrawals"), orderBy("createdAt","desc"))
      : query(collection(db, "withdrawals"), where("adminId", "==", myAdminId));
    const unsub = onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id:d.id, ...d.data() }));
      list.sort((a,b) => {
        const av = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
        const bv = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
        return bv - av;
      });
      setWithdrawals(list);
    }, err => console.error("Withdrawal access failed:", err));
    return () => unsub();
  }, [isAdmin, isSuperAdmin, myAdminId]);

  const accessibleUsers = isSuperAdmin
    ? users
    : users.filter(u => u.adminId === myAdminId);

  const accessibleIds = new Set(accessibleUsers.map(u => u.uid));

  const scopedTransactions = isSuperAdmin
    ? transactions
    : transactions.filter(t => accessibleIds.has(t.fromUid) || accessibleIds.has(t.toUid));

  const scopedWithdrawals = isSuperAdmin
    ? withdrawals
    : withdrawals.filter(w => accessibleIds.has(w.uid));

  const myAdminProfile = admins.find(a => a.id === myAdminId) || null;
  const permissions = { ...ADMIN_PERMISSIONS, ...(myAdminProfile?.permissions || {}) };

  const assignUserToAdmin = async (targetUser, adminId) => {
    if (!isSuperAdmin) return;
    try {
      const admin = admins.find(a => a.id === adminId);
      const cleanAdminId = adminId || null;
      await setDoc(doc(db, "wallets", targetUser.uid), {
        adminId: cleanAdminId,
        assignedAt: new Date(),
        assignedBy: user?.uid || null,
      }, { merge:true });

      await setDoc(doc(db, "users", targetUser.uid), {
        uid: targetUser.uid,
        name: targetUser.name || "",
        email: (targetUser.email || "").toLowerCase(),
        role: "user",
        adminId: cleanAdminId,
        referralCode: admin?.referralCode || null,
      }, { merge:true });

      await addDoc(collection(db, "auditLogs"), {
        action: "user_admin_assignment_changed",
        adminId: "super_admin",
        targetUserId: targetUser.uid,
        targetAdminId: cleanAdminId,
        createdAt: serverTimestamp(),
      });
      showConfirmed(cleanAdminId ? `✓ User assigned to ${admin?.name || "admin"}.` : "✓ User unassigned.");
    } catch (e) {
      console.error(e);
      showConfirmed("❌ Failed to assign user.");
    }
  };

  const approveWithdrawal = async (wdId, userUid) => {
    if (!isSuperAdmin && (!permissions.canViewUsers || !accessibleIds.has(userUid))) return;
    const approvedAt = new Date();
    const wd = withdrawals.find(w => w.id === wdId);
    await updateDoc(doc(db, "withdrawals", wdId), { status:"approved", approvedAt });
    if (wd?.refNumber) {
      const txQ = query(collection(db, "transactions"), where("refNumber","==",wd.refNumber));
      const txSnap = await getDocs(txQ);
      txSnap.forEach(async d => {
        await updateDoc(doc(db, "transactions", d.id), { status:"approved", approvedAt });
      });
    }
    showConfirmed("✓ Withdrawal approved!");
  };

  const rejectWithdrawal = async (wdId, reason) => {
    const target = withdrawals.find(w => w.id === wdId);
    if (!isSuperAdmin && (!permissions.canViewUsers || !accessibleIds.has(target?.uid))) return;
    const rejectedAt = new Date();
    const wd = withdrawals.find(w => w.id === wdId);
    await updateDoc(doc(db, "withdrawals", wdId), { status:"rejected", rejectedAt, rejectionReason: reason });
    if (wd?.refNumber) {
      const txQ = query(collection(db, "transactions"), where("refNumber","==",wd.refNumber));
      const txSnap = await getDocs(txQ);
      txSnap.forEach(async d => {
        await updateDoc(doc(db, "transactions", d.id), { status:"rejected", rejectedAt, rejectionReason: reason });
      });
    }

    // Email the user with the honest rejection reason
    if (wd) {
      try {
        await sendEmail(Emails.withdrawalRejected(
          { email: wd.userEmail, name: wd.userName || "Valued Customer" },
          wd.amount, wd.currency, reason
        ));
      } catch (e) { console.error("Failed to send rejection email:", e); }
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

  const totalBalance  = accessibleUsers.reduce((s,u) => s+(u.usdBalance||0), 0);
  const totalVolume   = scopedTransactions.reduce((s,t) => s+(t.amount||0), 0);
  const pendingCount  = scopedWithdrawals.filter(w => w.status==="pending").length;

  const filteredUsers = accessibleUsers.filter(u =>
    (u.email||"").toLowerCase().includes(search.toLowerCase()) ||
    (u.name||"").toLowerCase().includes(search.toLowerCase())
  );
  const filteredTxs = scopedTransactions.filter(t =>
    (t.fromEmail||"").includes(search) || (t.toEmail||"").includes(search) || (t.note||"").includes(search)
  );
  const filteredWds = scopedWithdrawals.filter(w =>
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
      <div style={{ background:`linear-gradient(135deg,#0f0f0f,#1f1005)`, border:`1px solid ${C.borderStrong}`, borderRadius:16, padding:"18px 20px" }}>
        <div style={{ fontSize:11, color:C.gold, letterSpacing:"0.15em", marginBottom:4, display:"flex", alignItems:"center", gap:6 }}>
          {isSuperAdmin ? <SettingsIcon size={12} /> : <Users size={12} />}
          {isSuperAdmin ? "SUPER ADMIN PANEL" : "PARTNER ADMIN PANEL"}
        </div>
        <div style={{ fontSize:20, fontWeight:800, color:C.white }}>{isSuperAdmin ? "NOVA Vault Dashboard" : "My Users Dashboard"}</div>
        <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>{isSuperAdmin ? "Full visibility · Real-time data" : "Assigned users only · Real-time data"}</div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
        <StatCard icon={Users} label="Total Users"    value={users.length}       color={C.gold}  />
        <StatCard icon={Clock} label="Pending Withdrawals" value={pendingCount}  color={pendingCount>0?C.red:C.green} />
        <StatCard icon={Wallet} label="Total Balances" value={`$${Math.round(totalBalance).toLocaleString()}`} color={C.gold} />
        <StatCard icon={BarChart3} label="Tx Volume"      value={`$${Math.round(totalVolume).toLocaleString()}`} color={C.green} />
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
          ["withdrawals", Banknote, `Withdrawals${pendingCount>0?` (${pendingCount})`:""}` ],
          ...(isSuperAdmin || permissions.canViewUsers ? [["users", Users, "Users"]] : []),
          ...(isSuperAdmin || permissions.canViewTransactions ? [["txs", Receipt, "Transactions"]] : []),
          ...(isSuperAdmin ? [["admins", UserCog, "Admins"]] : []),
          ...(isSuperAdmin ? [["settings", SettingsIcon, "Settings"]] : []),
        ].map(([t,Icon,label]) => (
          <FeelButton key={t} onClick={()=>setTab(t)} style={{ flex:1, padding:"9px 6px", borderRadius:9, border:"none", cursor:"pointer", background:tab===t?C.gold:"transparent", color:tab===t?"#000":C.muted, fontWeight:700, fontSize:11, transition:"all 0.2s", whiteSpace:"nowrap", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}><Icon size={13} strokeWidth={2.3} />{label}</FeelButton>
        ))}
      </div>

      {/* Search — not on settings tab */}
      {tab !== "settings" && (
        <div style={{ position:"relative" }}>
          <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:C.muted, fontSize:15 }}>⌕</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…"
            style={{ width:"100%", background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 16px 12px 40px", color:C.white, fontSize:13, outline:"none", boxSizing:"border-box" }} />
          {search && <FeelButton onClick={()=>setSearch("")} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:16 }}>✕</FeelButton>}
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
                  {u.frozen && <div style={{ position:"absolute", bottom:-2, right:-2, width:16, height:16, borderRadius:"50%", background:C.bgCard, display:"flex", alignItems:"center", justifyContent:"center", color:C.red }}><Lock size={10} strokeWidth={2.5} /></div>}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.white, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:6 }}>
                    {u.name||"Unknown"}
                    {u.customFee !== undefined && u.customFee !== null && <Badge color={C.gold}>Custom Fee</Badge>}
                  </div>
                  <div style={{ fontSize:11, color:C.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.email||u.uid}</div>
                  {isSuperAdmin && (
                    <select
                      value={u.adminId || ""}
                      onChange={e=>assignUserToAdmin(u, e.target.value)}
                      style={{ marginTop:6, maxWidth:"100%", background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:7, padding:"5px 7px", color:C.mutedLight, fontSize:10, outline:"none" }}
                    >
                      <option value="">Unassigned</option>
                      {admins.filter(a=>a.active !== false).map(a => (
                        <option key={a.id} value={a.id}>{a.name} · {a.referralCode}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:16, fontWeight:800, color:C.white }}>${(u.usdBalance||0).toLocaleString("en-US",{minimumFractionDigits:2})}</div>
                  <div style={{ display:"flex", gap:6, marginTop:6 }}>
                    <FeelButton
                      onClick={()=> (isSuperAdmin || permissions.canAdjustBalance) && setEditUser(u)}
                      disabled={!isSuperAdmin && !permissions.canAdjustBalance}
                      style={{ padding:"5px 10px", borderRadius:8, background:`${C.gold}15`, border:`1px solid ${C.gold}30`, color:C.gold, fontSize:11, fontWeight:700, cursor:(isSuperAdmin || permissions.canAdjustBalance)?"pointer":"not-allowed", opacity:(isSuperAdmin || permissions.canAdjustBalance)?1:.45, display:"flex", alignItems:"center", gap:4 }}
                    ><Pencil size={12} /> Balance</FeelButton>
                    <FeelButton onClick={()=>setManageUser(u)} style={{ padding:"5px 10px", borderRadius:8, background:`${C.red}15`, border:`1px solid ${C.red}30`, color:C.red, fontSize:11, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}><SettingsIcon size={12} /> Manage</FeelButton>
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

      {/* PARTNER ADMIN MANAGEMENT — Super Admin only */}
      {tab==="admins" && isSuperAdmin && (
        <AdminManagementPanel users={users} showConfirmed={showConfirmed} />
      )}

      {/* SETTINGS tab */}
      {tab==="settings" && isSuperAdmin && <SettingsPanel />}

      {editUser && <SetBalanceModal
          targetUser={editUser}
          actor={user}
          onClose={()=>setEditUser(null)}
        />}

      {manageUser && (
        <ManageUserModal
          targetUser={manageUser}
          allTransactions={transactions}
          allWithdrawals={withdrawals}
          onClose={()=>setManageUser(null)}
          actor={user}
          canEditWallet={isSuperAdmin || permissions.canEditWallet}
          onDeleted={()=>{ setManageUser(null); showConfirmed("✓ User deleted completely."); }}
        />
      )}
    </div>
  );
}