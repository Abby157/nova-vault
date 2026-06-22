import { useState, useEffect } from "react";
import { C } from "../theme";
import { Card, Badge, GoldDivider } from "../components/UI";
import { db, auth, collection, query, where, onSnapshot } from "../firebase";

const TYPE_CONFIG = {
  send:       { icon:"↑", label:"Sent",      color:C.red,   bg:`rgba(231,76,60,0.15)`   },
  receive:    { icon:"↓", label:"Received",   color:"#2ECC71", bg:`rgba(46,204,113,0.15)` },
  swap:       { icon:"⇄", label:"Swapped",   color:"#C9A84C", bg:`rgba(201,168,76,0.15)` },
  buy:        { icon:"↗️", label:"Buy",        color:"#2ECC71", bg:`rgba(46,204,113,0.15)` },
  sell:       { icon:"↙️", label:"Sell",       color:C.red,   bg:`rgba(231,76,60,0.15)`   },
  withdrawal: { icon:"↓", label:"Withdrawal", color:"#C9A84C", bg:`rgba(201,168,76,0.15)` },
};

// Load jsPDF from CDN once
let jsPDFPromise = null;
function loadJsPDF() {
  if (window.jspdf) return Promise.resolve(window.jspdf.jsPDF);
  if (jsPDFPromise) return jsPDFPromise;
  jsPDFPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = () => resolve(window.jspdf.jsPDF);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return jsPDFPromise;
}

async function downloadReceipt(tx, uid, userEmail) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const gold = [201, 168, 76];
  const dark = [20, 20, 20];
  const muted = [120, 120, 120];

  const isReceive = tx.toUid === uid && tx.fromUid !== uid;
  const isWithdraw = tx.type === "withdrawal";
  const typeLabel = isWithdraw ? "Withdrawal" : isReceive ? "Received" : tx.type === "swap" ? "Swap" : tx.type === "buy" ? "Buy" : tx.type === "sell" ? "Sell" : "Sent";

  const formatDate = (ts) => {
    if (!ts) return new Date().toLocaleString();
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
  };

  // Header
  doc.setFillColor(...dark);
  doc.rect(0, 0, 595, 90, "F");
  doc.setTextColor(...gold);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("NOVA VAULT", 40, 45);
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.text("PRIVATE BANKING · TRANSACTION RECEIPT", 40, 62);

  // Body
  let y = 130;
  doc.setTextColor(...dark);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`${typeLabel} Confirmation`, 40, y);

  y += 10;
  doc.setDrawColor(...gold);
  doc.setLineWidth(1.2);
  doc.line(40, y, 555, y);

  y += 30;
  const rows = [
    ["Reference Number", tx.refNumber || tx.id || "—"],
    ["Date & Time", formatDate(tx.createdAt)],
    ["Status", (tx.status || "completed").toUpperCase()],
    ["Amount", `$${Number(tx.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`],
    ["Account Holder", userEmail || "—"],
  ];

  if (isWithdraw) {
    rows.push(["Destination Wallet", tx.toEmail || "—"]);
    rows.push(["Method", "Crypto Withdrawal"]);
  } else if (isReceive) {
    rows.push(["From", tx.fromName || tx.fromEmail || "—"]);
  } else if (tx.type === "send") {
    rows.push(["To", tx.toName || tx.toEmail || "—"]);
  } else {
    rows.push(["Description", tx.note || "—"]);
  }

  doc.setFontSize(11);
  rows.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...muted);
    doc.text(label, 40, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    const valStr = String(value);
    doc.text(valStr, 555, y, { align: "right" });
    y += 26;
  });

  y += 20;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(40, y, 555, y);

  y += 30;
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.text("This is an official transaction receipt issued by NOVA Vault. Please retain for your records.", 40, y, { maxWidth: 515 });
  y += 16;
  doc.text(`Generated on ${new Date().toLocaleString()}`, 40, y);

  // Footer
  doc.setFillColor(...dark);
  doc.rect(0, 780, 595, 62, "F");
  doc.setTextColor(...gold);
  doc.setFontSize(9);
  doc.text("NOVA VAULT · PRIVATE BANKING · novavault.io", 40, 812);

  doc.save(`NOVA-Receipt-${tx.refNumber || tx.id}.pdf`);
}

function TxRow({ tx, uid, userEmail, onClick, active }) {
  const isReceive  = tx.toUid === uid && tx.type !== "withdrawal" && tx.fromUid !== uid;
  const type       = isReceive ? "receive" : tx.type || "send";
  const cfg        = TYPE_CONFIG[type] || TYPE_CONFIG.send;
  const sign       = isReceive ? "+" : "-";
  const amtColor   = isReceive ? "#2ECC71" : type==="withdrawal"?"#C9A84C":C.red;

  const statusColor = tx.status==="approved"||tx.status==="completed" ? "#2ECC71"
    : tx.status==="rejected" ? C.red : "#C9A84C";

  const formatTime = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = (Date.now()-d.getTime())/1000;
    if (diff < 60)    return "Just now";
    if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
  };

  const label = isReceive
    ? `From ${tx.fromName||tx.fromEmail||"User"}`
    : type==="withdrawal"
      ? `Withdrawal · ${tx.currency||""}`
      : type==="swap"||type==="buy"||type==="sell"
        ? tx.note || `${cfg.label}`
        : `To ${tx.toName||tx.toEmail||"User"}`;

  return (
    <div style={{ padding:"16px 18px", cursor:"pointer", background:active?`${cfg.color}08`:"transparent", transition:"background 0.15s" }}>
      <div onClick={onClick} style={{ display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ width:40, height:40, borderRadius:"50%", flexShrink:0, background:cfg.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, color:cfg.color }}>{cfg.icon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <span style={{ fontSize:13, fontWeight:700, color:C.white, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"55%" }}>{label}</span>
            <span style={{ fontSize:14, fontWeight:800, color:amtColor, flexShrink:0 }}>
              {sign}${tx.amount?.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
            </span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:4 }}>
            <span style={{ fontSize:11, color:C.muted }}>{formatTime(tx.createdAt)}</span>
            <Badge color={statusColor}>{tx.status||"pending"}</Badge>
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {active && (
        <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${C.border}`, display:"flex", flexDirection:"column", gap:8 }}>
          {[
            ["Reference No.", tx.refNumber || tx.id || "—"],
            ["Type",    cfg.label],
            ["Amount",  `$${tx.amount?.toLocaleString("en-US",{minimumFractionDigits:2})}`],
            ["Note",    tx.note||"—"],
            ["Status",  tx.status||"pending"],
            ["From",    tx.fromEmail||"—"],
            ["To",      tx.toEmail||"—"],
          ].map(([label,value]) => (
            <div key={label} style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:12, color:C.muted }}>{label}</span>
              <span style={{ fontSize:12, color:C.white, fontWeight:600, maxWidth:"60%", textAlign:"right", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontFamily:label==="Reference No."?"monospace":"inherit" }}>{value}</span>
            </div>
          ))}
          <button
            onClick={(e) => { e.stopPropagation(); downloadReceipt(tx, uid, userEmail); }}
            style={{ marginTop:8, padding:"10px", borderRadius:10, background:`${C.gold}15`, border:`1px solid ${C.gold}40`, color:C.gold, fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}
          >
            📄 Download Receipt (PDF)
          </button>
        </div>
      )}
    </div>
  );
}

function SummaryBar({ txs, uid }) {
  const totIn  = txs.filter(t => t.toUid===uid && t.fromUid!==uid && t.type!=="withdrawal").reduce((s,t)=>s+t.amount,0);
  const totOut = txs.filter(t => t.fromUid===uid && t.toUid!==uid).reduce((s,t)=>s+t.amount,0);
  const net    = totIn - totOut;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
      {[
        { label:"Total In",  value:`+$${totIn.toLocaleString("en-US",{minimumFractionDigits:0})}`,  color:"#2ECC71" },
        { label:"Total Out", value:`-$${totOut.toLocaleString("en-US",{minimumFractionDigits:0})}`, color:C.red },
        { label:"Net",       value:`${net>=0?"+":"-"}$${Math.abs(net).toLocaleString("en-US",{minimumFractionDigits:0})}`, color:net>=0?"#2ECC71":C.red },
      ].map(({ label,value,color }) => (
        <Card key={label} style={{ padding:"12px 10px", textAlign:"center" }}>
          <div style={{ fontSize:10, color:C.muted, letterSpacing:"0.08em", textTransform:"uppercase" }}>{label}</div>
          <div style={{ fontSize:15, fontWeight:800, color, marginTop:4 }}>{value}</div>
        </Card>
      ))}
    </div>
  );
}

export default function TransactionScreen() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [filterType, setFilterType]     = useState("all");
  const [sortBy, setSortBy]             = useState("newest");
  const [activeId, setActiveId]         = useState(null);

  const uid = auth.currentUser?.uid;
  const userEmail = auth.currentUser?.email;

  console.log("🔍 Current uid for transactions query:", uid);

  // Load real transactions from Firestore
  useEffect(() => {
    if (!uid) {
      console.warn("⚠️ No uid available — skipping transaction query");
      return;
    }
    const txMap = new Map();
    const update = () => {
      setTransactions(
        Array.from(txMap.values())
          .sort((a,b) => (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))
      );
      setLoading(false);
    };
    // Sent / withdrawals / trades
    const q1 = query(collection(db,"transactions"), where("fromUid","==",uid));
    const unsub1 = onSnapshot(q1, snap => {
      console.log("✅ Sent/withdrawal results (fromUid):", snap.size, "docs");
      snap.forEach(d => txMap.set(d.id,{id:d.id,...d.data()}));
      update();
    }, err => console.error("❌ Query 1 (fromUid) error:", err));
    // Received
    const q2 = query(collection(db,"transactions"), where("toUid","==",uid));
    const unsub2 = onSnapshot(q2, snap => {
      console.log("✅ Received results (toUid):", snap.size, "docs");
      snap.forEach(d => txMap.set(d.id,{id:d.id,...d.data()}));
      update();
    }, err => console.error("❌ Query 2 (toUid) error:", err));
    return () => { unsub1(); unsub2(); };
  }, [uid]);

  const filtered = transactions.filter(tx => {
    const isReceive = tx.toUid===uid && tx.fromUid!==uid;
    const type = isReceive ? "receive" : tx.type||"send";
    if (filterType!=="all" && type!==filterType) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (tx.fromEmail||"").includes(q)||(tx.toEmail||"").includes(q)||(tx.note||"").toLowerCase().includes(q)||(tx.type||"").includes(q)||(tx.refNumber||"").toLowerCase().includes(q);
  }).sort((a,b) => {
    if (sortBy==="newest") return (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0);
    if (sortBy==="oldest") return (a.createdAt?.seconds||0)-(b.createdAt?.seconds||0);
    if (sortBy==="largest") return b.amount-a.amount;
    return 0;
  });

  // Group by date
  const grouped = filtered.reduce((acc, tx) => {
    const d = tx.createdAt?.toDate ? tx.createdAt.toDate() : new Date();
    const key = d.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
    if (!acc[key]) acc[key] = [];
    acc[key].push(tx);
    return acc;
  }, {});

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:C.white }}>Transactions</div>
          <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{filtered.length} records</div>
        </div>
        <button onClick={() => {
          const rows = [["Reference","Type","Amount","From","To","Note","Status","Date"]];
          filtered.forEach(tx => {
            const isR = tx.toUid===uid && tx.fromUid!==uid;
            rows.push([tx.refNumber||tx.id, isR?"receive":tx.type||"send", tx.amount, tx.fromEmail||"", tx.toEmail||"", tx.note||"", tx.status||"", tx.createdAt?.toDate?.()?.toLocaleDateString()||""]);
          });
          const csv = rows.map(r=>r.join(",")).join("\n");
          const a = document.createElement("a"); a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv); a.download="transactions.csv"; a.click();
        }} style={{ background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:10, padding:"8px 14px", color:C.gold, fontSize:12, fontWeight:600, cursor:"pointer" }}>
          Export CSV ↓
        </button>
      </div>

      {/* Summary */}
      <SummaryBar txs={transactions} uid={uid} />

      {/* Search */}
      <div style={{ position:"relative" }}>
        <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:C.muted, fontSize:15 }}>⌕</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by email, type, reference…"
          style={{ width:"100%", background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 16px 12px 40px", color:C.white, fontSize:13, outline:"none", boxSizing:"border-box" }} />
        {search && <button onClick={()=>setSearch("")} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:16 }}>✕</button>}
      </div>

      {/* Filter chips */}
      <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:2 }}>
        {[["all","All"],["send","↑ Sent"],["receive","↓ Received"],["withdrawal","💸 Withdrawal"],["swap","⇄ Swap"]].map(([t,label]) => (
          <button key={t} onClick={()=>setFilterType(t)} style={{ flexShrink:0, padding:"6px 14px", borderRadius:20, background:filterType===t?C.goldGlow:C.bgElevated, border:`1px solid ${filterType===t?C.gold:C.border}`, color:filterType===t?C.gold:C.mutedLight, fontSize:11, fontWeight:700, cursor:"pointer", transition:"all 0.15s" }}>{label}</button>
        ))}
      </div>

      {/* Sort */}
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:11, color:C.muted, flexShrink:0 }}>Sort:</span>
        {[["newest","Newest"],["oldest","Oldest"],["largest","Largest"]].map(([k,label]) => (
          <button key={k} onClick={()=>setSortBy(k)} style={{ padding:"5px 12px", borderRadius:8, fontSize:11, fontWeight:600, background:sortBy===k?C.bgElevated:"transparent", border:`1px solid ${sortBy===k?C.gold:"transparent"}`, color:sortBy===k?C.gold:C.muted, cursor:"pointer" }}>{label}</button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign:"center", padding:"40px 0", color:C.muted }}>Loading transactions…</div>
      ) : Object.keys(grouped).length===0 ? (
        <div style={{ textAlign:"center", padding:"48px 0", color:C.muted }}>
          <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
          <div style={{ fontSize:14 }}>No transactions found</div>
        </div>
      ) : (
        Object.entries(grouped).map(([date, txs]) => (
          <div key={date}>
            <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8, paddingLeft:4 }}>{date}</div>
            <Card hover={false} style={{ padding:0, overflow:"hidden" }}>
              {txs.map((tx, i) => (
                <div key={tx.id}>
                  <TxRow tx={tx} uid={uid} userEmail={userEmail} active={activeId===tx.id} onClick={()=>setActiveId(activeId===tx.id?null:tx.id)} />
                  {i<txs.length-1&&<GoldDivider margin="0 18px" />}
                </div>
              ))}
            </Card>
          </div>
        ))
      )}
    </div>
  );
}