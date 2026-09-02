import { useState, useEffect } from "react";
import { ArrowUp, ArrowDown, RefreshCw, PieChart, ArrowUpRight, ArrowDownRight, Settings as SettingsIcon, ChevronDown, FileText } from "lucide-react";
import { C } from "../theme";
import { CHART_DATA } from "../data";
import { Card, GoldDivider, Badge, Sparkline, FeelButton, Reveal, AnimatedNumber } from "../components/UI";
import { db, auth, doc, setDoc, collection, query, where, onSnapshot, getDocs } from "../firebase";
import { useSettings } from "../hooks/useSettings";
import { useCurrency } from "../hooks/useCurrency";
import { downloadReceipt } from "../utils/receipt";

const ADMIN_EMAIL = "davehack966@gmail.com";

function AdminBalanceEditor({ uid, balance, user, onClose }) {
  const [val, setVal]                 = useState(balance.toString());
  const [searchEmail, setSearchEmail] = useState("");
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState("");

  const save = async () => {
    setSaving(true);
    try {
      if (searchEmail.trim()) {
        const q = query(collection(db, "wallets"), where("email","==",searchEmail.trim().toLowerCase()));
        const snap = await getDocs(q);
        if (snap.empty) { setMsg("❌ No account found with that email."); setSaving(false); return; }
        const targetUid = snap.docs[0].id;
        await setDoc(doc(db, "wallets", targetUid), { usdBalance: parseFloat(val)||0 }, { merge:true });
        setMsg(`✓ Balance set to $${parseFloat(val).toLocaleString()} for ${searchEmail}`);
        setTimeout(() => onClose(), 1800);
      } else {
        await setDoc(doc(db, "wallets", uid), { usdBalance: parseFloat(val)||0 }, { merge:true });
        onClose();
      }
    } catch { setMsg("❌ Error saving balance."); }
    setSaving(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:C.bgCard, border:`1px solid ${C.borderStrong}`, borderRadius:20, padding:28, width:"100%", maxWidth:380 }}>
        <div style={{ fontSize:16, fontWeight:800, color:C.white, marginBottom:4, display:"flex", alignItems:"center", gap:7 }}><SettingsIcon size={16} /> Admin Panel</div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:20 }}>Set balance for yourself or any user by email.</div>
        <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:16 }}>
          <div>
            <label style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em", display:"block", marginBottom:6 }}>USER EMAIL (blank = your account)</label>
            <input value={searchEmail} onChange={e=>setSearchEmail(e.target.value)} placeholder="user@email.com" type="email"
              style={{ width:"100%", background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px", color:C.white, fontSize:13, outline:"none", boxSizing:"border-box" }} />
          </div>
          <div>
            <label style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em", display:"block", marginBottom:6 }}>USD BALANCE</label>
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute", left:16, top:"50%", transform:"translateY(-50%)", color:C.gold, fontSize:20, fontWeight:700 }}>$</span>
              <input value={val} onChange={e=>setVal(e.target.value)} type="number" placeholder="0.00"
                style={{ width:"100%", background:C.bgElevated, border:`1px solid ${C.gold}`, borderRadius:12, padding:"14px 16px 14px 36px", color:C.white, fontSize:22, fontWeight:800, outline:"none", boxSizing:"border-box" }} />
            </div>
          </div>
        </div>
        {msg && (
          <div style={{ marginBottom:14, padding:"10px 14px", borderRadius:10, background:msg.startsWith("✓")?`${C.green}15`:`${C.red}15`, border:`1px solid ${msg.startsWith("✓")?C.green:C.red}30`, color:msg.startsWith("✓")?C.green:C.red, fontSize:12, fontWeight:600 }}>{msg}</div>
        )}
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

function SkeletonRow() {
  return (
    <div style={{ padding:"14px 18px", display:"flex", alignItems:"center", gap:12 }}>
      <div style={{ width:36, height:36, borderRadius:"50%", background:C.bgElevated, flexShrink:0 }} />
      <div style={{ flex:1 }}>
        <div style={{ height:13, width:"55%", background:C.bgElevated, borderRadius:4, marginBottom:8 }} />
        <div style={{ height:11, width:"35%", background:C.bgElevated, borderRadius:4 }} />
      </div>
      <div style={{ height:13, width:60, background:C.bgElevated, borderRadius:4 }} />
    </div>
  );
}

function PctPill({ value }) {
  const isUp = value >= 0;
  const color = isUp ? C.green : C.red;
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:2, padding:"2px 7px", borderRadius:20, background:`${color}15`, border:`1px solid ${color}30`, color, fontSize:11, fontWeight:700 }}>
      <Icon size={11} strokeWidth={2.5} />
      {Math.abs(value)}%
    </span>
  );
}

export default function Dashboard({ setTab, cryptos, user }) {
  const [balance, setBalance]           = useState(0);
  const [holdings, setHoldings]         = useState({});
  const [transactions, setTransactions] = useState([]);
  const [showEditor, setShowEditor]     = useState(false);
  const [visible, setVisible]           = useState(false);
  const [loadingTx, setLoadingTx]       = useState(true);
  const [expandedTxId, setExpandedTxId] = useState(null);
  const [walletLoaded, setWalletLoaded] = useState(false);

  const uid     = auth.currentUser?.uid;
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // Currency conversion
  const { settings: appSettings } = useSettings();
  const { format, convert, symbol } = useCurrency(appSettings.currency || "USD");

  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  // Keep wallet doc in sync with email/name + listen to balance
  useEffect(() => {
    if (!uid || !user?.email) return;
    const ref = doc(db, "wallets", uid);
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        setBalance(snap.data().usdBalance || 0);
        setHoldings(snap.data().holdings || {});
        // Keep email/name synced
        setDoc(ref, { email: user.email.toLowerCase(), name: user.name || "" }, { merge:true });
      } else {
        setDoc(ref, {
          usdBalance: 0, owner: uid,
          email: user.email.toLowerCase(),
          name: user.name || "",
          createdAt: new Date().toISOString(),
        });
      }
      setWalletLoaded(true);
    });
    return () => unsub();
  }, [uid, user]);

  // Live transactions — sent, received and withdrawals
  useEffect(() => {
    if (!uid) return;
    const txMap = new Map();

    const updateTxs = () => {
      setTransactions(
        Array.from(txMap.values())
          .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0))
          .slice(0, 10)
      );
      setLoadingTx(false);
    };

    // Sent / swap / withdrawal
    const q1 = query(collection(db, "transactions"), where("fromUid","==",uid));
    const unsub1 = onSnapshot(q1, snap => {
      snap.forEach(d => txMap.set(d.id, { id:d.id, ...d.data() }));
      updateTxs();
    });

    // Received
    const q2 = query(collection(db, "transactions"), where("toUid","==",uid));
    const unsub2 = onSnapshot(q2, snap => {
      snap.forEach(d => txMap.set(d.id, { id:d.id, ...d.data() }));
      updateTxs();
    });

    return () => { unsub1(); unsub2(); };
  }, [uid]);

  const formatTime = (ts) => {
    if (!ts) return "Just now";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60)    return "Just now";
    if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return `${Math.floor(diff/86400)}d ago`;
  };

  const getTxDisplay = (tx) => {
    const isWithdraw = tx.type === "withdrawal";
    const isReceive  = tx.toUid === uid && !isWithdraw && tx.fromUid !== uid;
    const isSwap     = tx.type === "swap";

    const color = isWithdraw
      ? (tx.status==="approved" ? C.green : tx.status==="rejected" ? C.red : C.gold)
      : isReceive ? C.green : C.red;

    const Icon = isWithdraw ? ArrowDown : isReceive ? ArrowDown : isSwap ? RefreshCw : ArrowUp;

    const label = isWithdraw
      ? `Withdrawal · ${tx.toName?.replace("Withdraw ","") || ""}`
      : isReceive
        ? `From ${tx.fromName || tx.fromEmail || "User"}`
        : isSwap
          ? `Swap · ${tx.note || ""}`
          : `To ${tx.toName || tx.toEmail || "User"}`;

    const amountColor = isWithdraw
      ? (tx.status==="approved" ? C.green : tx.status==="rejected" ? C.red : C.gold)
      : isReceive ? C.green : C.white;

    const amountPrefix = isReceive ? "+" : isWithdraw ? "-" : "-";

    const statusColor = tx.status==="approved"  ? C.green
      : tx.status==="rejected"  ? C.red
      : tx.status==="completed" ? C.green
      : C.gold;

    return { color, Icon, label, amountColor, amountPrefix, statusColor };
  };

  const QUICK_ACTIONS = [
    { Icon: ArrowUp,   label:"Send",      tab:"send" },
    { Icon: ArrowDown, label:"Receive",   tab:"send" },
    { Icon: RefreshCw, label:"Swap",      tab:"trade" },
    { Icon: PieChart,  label:"Portfolio", tab:"portfolio" },
  ];

  // Prefer real held assets (sorted by USD value, biggest first). If the
  // user hasn't bought/swapped anything yet, fall back to the live market
  // list instead of an empty state — the dashboard should always show a
  // full asset list, not a hole where one used to be.
  const heldAssets = (cryptos||[])
    .map(c => ({ ...c, heldBalance: holdings[c.symbol] || 0 }))
    .filter(c => c.heldBalance > 0)
    .sort((a,b) => (b.price*b.heldBalance) - (a.price*a.heldBalance))
    .slice(0,4);
  const myAssets = heldAssets.length > 0
    ? heldAssets
    : (cryptos||[]).slice(0,4).map(c => ({ ...c, heldBalance: c.balance || 0 }));

  // Real balance trend, reconstructed from the same transactions already
  // shown in Recent Activity — same sign convention as getTxDisplay's
  // amountPrefix, so the chart never disagrees with the list below it.
  // The window's total delta is subtracted from the current (ground-truth)
  // balance to get a starting point, then each transaction is replayed
  // forward — so the line always ends exactly on the real balance. Falls
  // back to the static demo trend for brand-new accounts with too little
  // history to plot anything meaningful.
  const balanceHistory = transactions.length < 3 ? CHART_DATA : (() => {
    const chronological = [...transactions].reverse();
    const deltas = chronological.map(tx => {
      const isWithdraw = tx.type === "withdrawal";
      const isReceive = tx.toUid === uid && !isWithdraw && tx.fromUid !== uid;
      const amt = tx.amount || 0;
      return isReceive ? amt : -amt;
    });
    const sumDeltas = deltas.reduce((s,d) => s+d, 0);
    let running = balance - sumDeltas;
    const points = [running];
    for (const d of deltas) { running += d; points.push(running); }
    return points;
  })();

  return (
    <div style={{ opacity:visible?1:0, transition:"opacity 0.4s", display:"flex", flexDirection:"column", gap:20 }}>

      {/* Hero Balance — subtle cursor-tilt for a bit of depth */}
      <Reveal delay={0}><Card
        hover={false}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          e.currentTarget.style.transition = "transform 0.08s linear";
          e.currentTarget.style.transform = `perspective(700px) rotateX(${(-py*6).toFixed(2)}deg) rotateY(${(px*6).toFixed(2)}deg) scale(1.012)`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transition = "transform 0.45s cubic-bezier(0.16,1,0.3,1)";
          e.currentTarget.style.transform = "perspective(700px) rotateX(0deg) rotateY(0deg) scale(1)";
        }}
        style={{ background:"linear-gradient(145deg,#0f0f0f 0%,#1f1005 60%,#140a03 100%)", border:`1px solid ${C.borderStrong}`, position:"relative", overflow:"hidden", transformStyle:"preserve-3d", willChange:"transform" }}>
        {/* Subtle texture: diagonal hairlines */}
        <div style={{
          position:"absolute", inset:0,
          backgroundImage:`repeating-linear-gradient(115deg, ${C.gold}05 0px, ${C.gold}05 1px, transparent 1px, transparent 14px)`,
          pointerEvents:"none",
        }} />
        <div style={{ position:"absolute", top:-50, right:-50, width:180, height:180, borderRadius:"50%", background:`radial-gradient(circle,${C.goldGlow},transparent)` }} />

        <div style={{ position:"relative" }}>
          <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:8 }}>Total Balance</div>
          <div style={{ fontSize:42, fontWeight:800, color:C.white, letterSpacing:"-0.02em", lineHeight:1 }}>
            {walletLoaded
              ? <>{symbol}<AnimatedNumber value={convert(balance)} decimals={2} /></>
              : <div style={{ height:42, width:220, borderRadius:8, background:C.bgElevated }} />}
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:C.green, boxShadow:`0 0 6px ${C.green}` }} />
              <span style={{ color:C.muted, fontSize:12 }}>NOVA Vault {appSettings.currency || "USD"} Wallet</span>
            </div>
            {isAdmin && (
              <FeelButton onClick={() => setShowEditor(true)} style={{ background:`${C.gold}15`, border:`1px solid ${C.gold}40`, borderRadius:8, padding:"5px 14px", color:C.gold, fontSize:11, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
                <SettingsIcon size={12} /> Admin
              </FeelButton>
            )}
          </div>
          <div style={{ marginTop:20 }}>
            <Sparkline data={balanceHistory} color={C.gold} height={50} width={300} />
          </div>
        </div>
      </Card></Reveal>

      {/* Quick Actions */}
      <Reveal delay={0.1}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
        {QUICK_ACTIONS.map(({ Icon, label, tab }) => (
          <FeelButton key={label} onClick={() => setTab(tab)} style={{ background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 8px", display:"flex", flexDirection:"column", alignItems:"center", gap:8, cursor:"pointer", transition:"all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor=C.gold; e.currentTarget.style.background=C.bgHover; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.background=C.bgElevated; }}
          >
            <div style={{ width:36, height:36, borderRadius:"50%", background:C.goldGlow, border:`1px solid ${C.borderStrong}`, display:"flex", alignItems:"center", justifyContent:"center", color:C.gold }}>
              <Icon size={16} strokeWidth={2.25} />
            </div>
            <span style={{ fontSize:11, color:C.mutedLight, fontWeight:600 }}>{label}</span>
          </FeelButton>
        ))}
      </div>
      </Reveal>

      {/* Crypto Assets — real holdings when you have them, market list otherwise */}
      <Reveal delay={0.2}>
      <div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <span style={{ fontSize:14, fontWeight:700, color:C.white }}>My Assets</span>
          <span style={{ fontSize:12, color:C.gold, cursor:"pointer" }} onClick={() => setTab("portfolio")}>View All</span>
        </div>
        {!walletLoaded ? (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <Card hover={false} style={{ padding:0, overflow:"hidden" }}><SkeletonRow /></Card>
            <Card hover={false} style={{ padding:0, overflow:"hidden" }}><SkeletonRow /></Card>
          </div>
        ) : myAssets.length === 0 ? (
          <Card hover={false} style={{ padding:"28px 16px", textAlign:"center" }}>
            <div style={{ fontSize:28, marginBottom:6 }}>💼</div>
            <div style={{ fontSize:13, fontWeight:600, color:C.mutedLight }}>No crypto holdings yet</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>Buy or swap on the Trade screen to see it here</div>
          </Card>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {myAssets.map(c => (
              <Card key={c.symbol} style={{ padding:"14px 18px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ width:40, height:40, borderRadius:"50%", background:`${c.color}20`, border:`1px solid ${c.color}40`, display:"flex", alignItems:"center", justifyContent:"center", color:c.color, fontSize:16, fontWeight:800, flexShrink:0 }}>{c.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ fontSize:14, fontWeight:700, color:C.white }}>{c.symbol}</span>
                      <span style={{ fontSize:14, fontWeight:700, color:C.white }}>{format(c.price*c.heldBalance)}</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:4 }}>
                      <span style={{ fontSize:12, color:C.muted }}>{c.heldBalance.toFixed(6)} {c.symbol}</span>
                      <PctPill value={c.change} />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      </Reveal>

      {/* Recent Activity — real Firestore */}
      <Reveal delay={0.3}>
      <div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <span style={{ fontSize:14, fontWeight:700, color:C.white }}>Recent Activity</span>
          <span style={{ fontSize:12, color:C.gold, cursor:"pointer" }} onClick={() => setTab("history")}>See All</span>
        </div>
        <Card hover={false} style={{ padding:0, overflow:"hidden" }}>
          {loadingTx ? (
            <>
              <SkeletonRow />
              <GoldDivider />
              <SkeletonRow />
              <GoldDivider />
              <SkeletonRow />
            </>
          ) : transactions.length === 0 ? (
            <div style={{ padding:"32px 16px", textAlign:"center", color:C.muted }}>
              <div style={{ fontSize:32, marginBottom:8 }}>💸</div>
              <div style={{ fontSize:13, fontWeight:600, color:C.mutedLight }}>No transactions yet</div>
              <div style={{ fontSize:11, marginTop:4 }}>Send money to get started</div>
            </div>
          ) : (
            transactions.slice(0,3).map((tx, i) => {
              const { color, Icon, label, amountColor, amountPrefix, statusColor } = getTxDisplay(tx);
              const isOpen = expandedTxId === tx.id;
              return (
                <div key={tx.id}>
                  <div
                    onClick={() => setExpandedTxId(isOpen ? null : tx.id)}
                    style={{ padding:"14px 18px", display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}
                  >
                    <div style={{ width:36, height:36, borderRadius:"50%", flexShrink:0, background:`${color}15`, display:"flex", alignItems:"center", justifyContent:"center", color }}>
                      <Icon size={15} strokeWidth={2.25} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                        <span style={{ fontSize:13, fontWeight:600, color:C.white, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"55%" }}>{label}</span>
                        <span style={{ fontSize:13, fontWeight:700, color:amountColor, flexShrink:0 }}>
                          {amountPrefix}{format(tx.amount)}
                        </span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:4 }}>
                        <span style={{ fontSize:11, color:C.muted }}>{formatTime(tx.createdAt)}</span>
                        <Badge color={statusColor}>{tx.status || "pending"}</Badge>
                      </div>
                    </div>
                    <ChevronDown size={15} color={C.muted} style={{ flexShrink:0, transition:"transform 0.2s", transform:isOpen?"rotate(180deg)":"none" }} />
                  </div>
                  {isOpen && (
                    <div style={{ padding:"0 18px 16px", display:"flex", flexDirection:"column", gap:8 }}>
                      {[
                        tx.refNumber && ["Reference No.", tx.refNumber],
                        ["Date", tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleString("en-US",{dateStyle:"medium",timeStyle:"short"}) : "—"],
                        tx.note && ["Note", tx.note],
                      ].filter(Boolean).map(([k,v]) => (
                        <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                          <span style={{ color:C.muted }}>{k}</span>
                          <span style={{ color:C.mutedLight, fontWeight:600, textAlign:"right", maxWidth:"70%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v}</span>
                        </div>
                      ))}
                      <FeelButton
                        onClick={(e) => { e.stopPropagation(); downloadReceipt(tx, uid, user?.email); }}
                        style={{ marginTop:4, padding:"9px", borderRadius:9, background:`${C.gold}12`, border:`1px solid ${C.gold}35`, color:C.gold, fontSize:11, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}
                      >
                        <FileText size={13} /> Download Receipt (PDF)
                      </FeelButton>
                    </div>
                  )}
                  {i < Math.min(transactions.length,3)-1 && <GoldDivider />}
                </div>
              );
            })
          )}
        </Card>
      </div>
      </Reveal>

      {/* Admin modal */}
      {showEditor && (
        <AdminBalanceEditor
          uid={uid}
          balance={balance}
          user={user}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}