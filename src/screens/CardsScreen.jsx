import { useState, useEffect } from "react";
import { Lock, Unlock, KeyRound, SlidersHorizontal, Ban, Landmark, PiggyBank, Coins, TriangleAlert } from "lucide-react";
import { C } from "../theme";
import { Card, GoldDivider, Badge, FeelButton } from "../components/UI";
import { db, auth, doc, onSnapshot, setDoc, collection, query, where, serverTimestamp } from "../firebase";

const CARDS_DATA = [
  { type:"Debit",   name:"OBSIDIAN BLACK", number:"•••• •••• •••• 4291", expiry:"08/28", gradient:"linear-gradient(135deg,#111 0%,#2a2a00 50%,#111 100%)", accent:C.gold },
  { type:"Virtual", name:"PLATINUM",       number:"•••• •••• •••• 7834", expiry:"12/27", gradient:"linear-gradient(135deg,#0a0a20 0%,#1a1a3a 50%,#0a0a20 100%)", accent:"#8B9CF7" },
];

function ActionModal({ title, children, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:"20px 20px 0 0", padding:"24px 20px 40px", width:"100%", maxWidth:420 }}>
        <div style={{ width:40, height:4, background:C.border, borderRadius:2, margin:"0 auto 20px" }} />
        <div style={{ fontSize:16, fontWeight:800, color:C.white, marginBottom:20 }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

export default function CardsScreen() {
  const [activeCard, setActiveCard] = useState(0);
  const [modal, setModal]           = useState(null); // "freeze"|"pin"|"limits"|"block"|"transfer"|"savings"|"earn"
  const [frozen, setFrozen]         = useState(false);
  const [blocked, setBlocked]       = useState(false);
  const [pinStep, setPinStep]       = useState(1);
  const [oldPin, setOldPin]         = useState("");
  const [newPin, setNewPin]         = useState("");
  const [spendLimit, setSpendLimit] = useState(5000);
  const [savingsOn, setSavingsOn]   = useState(false);
  const [earnOn, setEarnOn]         = useState(false);
  const [confirmed, setConfirmed]   = useState("");
  const [monthStats, setMonthStats] = useState({ spent: 0, count: 0 });

  const uid = auth.currentUser?.uid;
  const card = CARDS_DATA[activeCard];

  const closeModal = () => { setModal(null); setPinStep(1); setOldPin(""); setNewPin(""); };

  const showConfirmed = (msg) => { setConfirmed(msg); setTimeout(() => setConfirmed(""), 2500); };

  // Load persisted card state so Freeze/Block/Limits/Savings survive refresh.
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "wallets", uid), snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      setFrozen(d.cardFrozen === true);
      setBlocked(d.cardBlocked === true);
      setSpendLimit(d.cardSpendLimit || 5000);
      setSavingsOn(d.savingsVaultEnabled === true);
      setEarnOn(d.cryptoEarnEnabled === true);
    });
    return () => unsub();
  }, [uid]);

  // Compute this month's spend/transaction count from real transaction data.
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "transactions"), where("fromUid", "==", uid));
    const unsub = onSnapshot(q, snap => {
      const now = new Date();
      let spent = 0, count = 0;
      snap.forEach(d => {
        const tx = d.data();
        const ts = tx.createdAt?.toDate ? tx.createdAt.toDate() : (tx.createdAt ? new Date(tx.createdAt) : null);
        if (ts && ts.getMonth() === now.getMonth() && ts.getFullYear() === now.getFullYear()) {
          spent += tx.amount || 0;
          count += 1;
        }
      });
      setMonthStats({ spent, count });
    });
    return () => unsub();
  }, [uid]);

  const saveCardField = async (fields) => {
    if (!uid) return;
    try { await setDoc(doc(db, "wallets", uid), fields, { merge: true }); }
    catch (e) { console.error("Failed to save card setting:", e); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* Stacked cards */}
      <div style={{ position:"relative", height:220 }}>
        {CARDS_DATA.map((c,i) => (
          <div key={i} onClick={() => setActiveCard(i)} style={{
            position:"absolute", top:i===0?0:24, left:0, right:0, height:190,
            background:c.gradient, borderRadius:20, padding:"24px 28px",
            border:`1px solid ${activeCard===i?c.accent:"rgba(255,255,255,0.05)"}`,
            cursor:"pointer", zIndex:activeCard===i?10:5-i,
            transform:activeCard===i?"scale(1)":"scale(0.95)",
            transition:"all 0.3s ease",
            boxShadow:activeCard===i?`0 20px 60px rgba(0,0,0,0.6),0 0 30px ${c.accent}20`:"none",
            opacity: (frozen || blocked) && activeCard===i ? 0.6 : 1,
          }}>
            <div style={{ position:"absolute", top:0, right:0, width:160, height:160, borderRadius:"50%", background:`radial-gradient(circle,${c.accent}10,transparent)` }} />
            {(frozen || blocked) && activeCard===i && (
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:20, background:"rgba(0,0,0,0.3)", color:"#fff" }}>
                {blocked ? <Ban size={34} strokeWidth={1.8} /> : <Lock size={34} strokeWidth={1.8} />}
              </div>
            )}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:9, letterSpacing:"0.2em", color:c.accent, opacity:0.8 }}>{c.type.toUpperCase()} CARD</div>
                <div style={{ fontSize:13, fontWeight:800, color:c.accent, letterSpacing:"0.1em", marginTop:2 }}>{c.name}</div>
              </div>
              <div style={{ fontSize:20, fontStyle:"italic", fontWeight:900, color:c.accent, opacity:0.8 }}>NOVA</div>
            </div>
            <div style={{ marginTop:24, fontFamily:"monospace", fontSize:16, letterSpacing:"0.15em", color:"#F5F5F0" }}>{c.number}</div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginTop:20 }}>
              <div>
                <div style={{ fontSize:9, color:C.muted, letterSpacing:"0.1em" }}>EXPIRES</div>
                <div style={{ fontSize:13, color:"#F5F5F0", fontWeight:600 }}>{c.expiry}</div>
              </div>
              <div style={{ display:"flex" }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:c.accent, opacity:0.8 }} />
                <div style={{ width:28, height:28, borderRadius:"50%", background:c.accent, opacity:0.5, marginLeft:-10 }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Card selector dots */}
      <div style={{ display:"flex", justifyContent:"center", gap:8 }}>
        {CARDS_DATA.map((_,i) => (
          <div key={i} onClick={() => setActiveCard(i)} style={{ width:i===activeCard?20:8, height:8, borderRadius:4, background:i===activeCard?C.gold:C.border, cursor:"pointer", transition:"all 0.3s" }} />
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
        {[
          { icon: frozen?Unlock:Lock, label: frozen?"Unfreeze":"Freeze", action:() => { const next=!frozen; setFrozen(next); showConfirmed(next?"Card frozen":"Card unfrozen"); saveCardField({ cardFrozen: next }); }, disabled: blocked },
          { icon:KeyRound,        label:"PIN",    action:()=>setModal("pin"),    disabled: blocked },
          { icon:SlidersHorizontal, label:"Limits", action:()=>setModal("limits") },
          { icon:Ban,              label:"Block",  action:()=>setModal("block"),  disabled: blocked },
        ].map(({ icon:Icon, label, action, disabled }) => (
          <FeelButton key={label} onClick={disabled ? undefined : action} disabled={disabled} style={{
            background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:12,
            padding:"14px 8px", display:"flex", flexDirection:"column",
            alignItems:"center", gap:6, cursor:disabled?"not-allowed":"pointer", transition:"all 0.2s",
            opacity:disabled?0.45:1,
            color: label==="Freeze"||label==="Unfreeze" ? (frozen?C.green:C.gold) : label==="Block" ? C.red : C.mutedLight,
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor=C.gold}
            onMouseLeave={e => e.currentTarget.style.borderColor=C.border}
          >
            <Icon size={19} strokeWidth={2.1} />
            <span style={{ fontSize:11, fontWeight:600 }}>{label}</span>
          </FeelButton>
        ))}
      </div>

      {/* Confirmed toast */}
      {confirmed && (
        <div style={{ background:`${C.green}15`, border:`1px solid ${C.green}40`, borderRadius:10, padding:"12px 16px", textAlign:"center", color:C.green, fontSize:13, fontWeight:600 }}>
          ✓ {confirmed}
        </div>
      )}

      {/* Stats — spend & count are computed from real transaction history; cashback is a 2% program rate applied to that real spend. */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {[
          { label:"Monthly Spent",   value:`$${monthStats.spent.toLocaleString("en-US",{minimumFractionDigits:2})}`, sub:`${spendLimit ? Math.min(100, Math.round(monthStats.spent/spendLimit*100)) : 0}% of limit` },
          { label:"Cashback Earned", value:`$${(monthStats.spent*0.02).toLocaleString("en-US",{minimumFractionDigits:2})}`, sub:"2% this month" },
          { label:"Transactions",    value:monthStats.count.toString(), sub:"This month" },
          { label:"Spending Limit",  value:`$${spendLimit.toLocaleString()}`, sub:`Available: $${Math.max(0,spendLimit-monthStats.spent).toLocaleString("en-US",{minimumFractionDigits:2})}` },
        ].map(({ label,value,sub }) => (
          <Card key={label} style={{ padding:16 }}>
            <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.08em" }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:800, color:C.white, margin:"6px 0 2px" }}>{value}</div>
            <div style={{ fontSize:11, color:C.mutedLight }}>{sub}</div>
          </Card>
        ))}
      </div>

      {/* Banking Services */}
      <div>
        <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:12 }}>Banking Services</div>
        <Card hover={false} style={{ padding:0, overflow:"hidden" }}>
          {[
            { icon:Landmark,  label:"Bank Transfer (SWIFT/SEPA)", sub:"Send to any bank worldwide",  badge:"Instant", color:C.green, onClick:()=>setModal("transfer") },
            { icon:PiggyBank, label:"Savings Vault",              sub:"4.8% APY on USD holdings",   badge:savingsOn?"Active":"Popular", color:savingsOn?C.green:C.gold, onClick:()=>setModal("savings") },
            { icon:Coins,     label:"Crypto Earn",                sub:"Up to 12% APY on crypto",    badge:earnOn?"Active":"New",     color:earnOn?C.green:"#9945FF", onClick:()=>setModal("earn") },
          ].map(({ icon:Icon,label,sub,badge,color,onClick },i,arr) => (
            <div key={label}>
              <div onClick={onClick} style={{ padding:"16px 18px", display:"flex", alignItems:"center", gap:14, cursor:"pointer" }}
                onMouseEnter={e => e.currentTarget.style.background=C.bgHover}
                onMouseLeave={e => e.currentTarget.style.background="transparent"}
              >
                <div style={{ width:24, color }}><Icon size={22} strokeWidth={1.9} /></div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.white }}>{label}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{sub}</div>
                </div>
                <Badge color={color}>{badge}</Badge>
              </div>
              {i<arr.length-1 && <GoldDivider margin="0 18px" />}
            </div>
          ))}
        </Card>
      </div>

      {/* ── MODALS ── */}

      {/* PIN modal */}
      {modal === "pin" && (
        <ActionModal title="Change PIN" onClose={closeModal}>
          {pinStep === 1 && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ fontSize:13, color:C.muted }}>Enter your current PIN to continue.</div>
              <input type="password" maxLength={6} placeholder="Current PIN (6 digits)" value={oldPin} onChange={e => setOldPin(e.target.value)}
                style={{ background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px", color:C.white, fontSize:18, fontWeight:700, outline:"none", textAlign:"center", letterSpacing:"0.3em", width:"100%", boxSizing:"border-box" }} />
              <FeelButton onClick={() => { if(oldPin.length===6) setPinStep(2); }} style={{ background:C.gold, border:"none", borderRadius:12, padding:"14px", color:"#000", fontWeight:700, fontSize:14, cursor:"pointer", width:"100%" }}>Continue →</FeelButton>
            </div>
          )}
          {pinStep === 2 && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ fontSize:13, color:C.muted }}>Enter your new 6-digit PIN.</div>
              <input type="password" maxLength={6} placeholder="New PIN (6 digits)" value={newPin} onChange={e => setNewPin(e.target.value)}
                style={{ background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px", color:C.white, fontSize:18, fontWeight:700, outline:"none", textAlign:"center", letterSpacing:"0.3em", width:"100%", boxSizing:"border-box" }} />
              <FeelButton onClick={() => { if(newPin.length===6) { showConfirmed("PIN updated successfully"); saveCardField({ cardPinSetAt: serverTimestamp() }); closeModal(); } }} style={{ background:C.gold, border:"none", borderRadius:12, padding:"14px", color:"#000", fontWeight:700, fontSize:14, cursor:"pointer", width:"100%" }}>Set New PIN →</FeelButton>
            </div>
          )}
        </ActionModal>
      )}

      {/* Limits modal */}
      {modal === "limits" && (
        <ActionModal title="Spending Limits" onClose={closeModal}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ fontSize:13, color:C.muted }}>Set your monthly spending limit.</div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:14, color:C.white, fontWeight:700 }}>Monthly Limit</span>
              <span style={{ fontSize:20, fontWeight:800, color:C.gold }}>${spendLimit.toLocaleString()}</span>
            </div>
            <input type="range" min={500} max={25000} step={500} value={spendLimit} onChange={e => setSpendLimit(parseInt(e.target.value))}
              style={{ width:"100%", accentColor:C.gold }} />
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:11, color:C.muted }}>$500</span>
              <span style={{ fontSize:11, color:C.muted }}>$25,000</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
              {[2000,5000,10000,25000].map(v => (
                <FeelButton key={v} onClick={() => setSpendLimit(v)} style={{ padding:"8px 4px", borderRadius:8, fontSize:11, fontWeight:700, cursor:"pointer", background:spendLimit===v?C.goldGlow:C.bgElevated, border:`1px solid ${spendLimit===v?C.gold:C.border}`, color:spendLimit===v?C.gold:C.muted }}>${(v/1000).toFixed(0)}k</FeelButton>
              ))}
            </div>
            <FeelButton onClick={() => { showConfirmed(`Limit set to $${spendLimit.toLocaleString()}`); saveCardField({ cardSpendLimit: spendLimit }); closeModal(); }} style={{ background:C.gold, border:"none", borderRadius:12, padding:"14px", color:"#000", fontWeight:700, fontSize:14, cursor:"pointer", width:"100%" }}>Save Limit →</FeelButton>
          </div>
        </ActionModal>
      )}

      {/* Block modal */}
      {modal === "block" && (
        <ActionModal title="Block Card" onClose={closeModal}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ background:`${C.red}15`, border:`1px solid ${C.red}30`, borderRadius:12, padding:"14px 16px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.red, marginBottom:6, display:"flex", alignItems:"center", gap:6 }}><TriangleAlert size={14} /> Permanent Action</div>
              <div style={{ fontSize:12, color:C.mutedLight, lineHeight:1.7 }}>Blocking this card is permanent and cannot be undone. A replacement card will be issued within 5–7 business days.</div>
            </div>
            <div style={{ fontSize:13, color:C.muted }}>Are you sure you want to permanently block <span style={{ color:C.white, fontWeight:700 }}>{card.name} {card.number.slice(-4)}</span>?</div>
            <div style={{ display:"flex", gap:10 }}>
              <FeelButton onClick={closeModal} style={{ flex:1, padding:"13px", borderRadius:12, background:C.bgElevated, border:`1px solid ${C.border}`, color:C.white, fontWeight:700, cursor:"pointer" }}>Cancel</FeelButton>
              <FeelButton onClick={() => { setBlocked(true); setFrozen(false); showConfirmed("Card blocked. Replacement ordered."); saveCardField({ cardBlocked: true }); closeModal(); }} style={{ flex:1, padding:"13px", borderRadius:12, background:C.red, border:"none", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>Block Card</FeelButton>
            </div>
          </div>
        </ActionModal>
      )}

      {/* Bank Transfer modal */}
      {modal === "transfer" && (
        <ActionModal title="Bank Transfer" onClose={closeModal}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ fontSize:13, color:C.muted, lineHeight:1.7 }}>SWIFT/SEPA bank transfers are handled by our banking partner. Request a callback and a specialist will set up your transfer within one business day.</div>
            <FeelButton onClick={() => { showConfirmed("Callback requested — we'll be in touch shortly."); closeModal(); }} style={{ background:C.gold, border:"none", borderRadius:12, padding:"14px", color:"#000", fontWeight:700, fontSize:14, cursor:"pointer", width:"100%" }}>Request Callback →</FeelButton>
          </div>
        </ActionModal>
      )}

      {/* Savings Vault modal */}
      {modal === "savings" && (
        <ActionModal title="Savings Vault" onClose={closeModal}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ fontSize:13, color:C.muted, lineHeight:1.7 }}>Earn 4.8% APY on idle USD balance. {savingsOn ? "You're currently enrolled." : "Enroll to start earning."}</div>
            <FeelButton onClick={() => { const next=!savingsOn; setSavingsOn(next); showConfirmed(next?"Savings Vault enabled":"Savings Vault disabled"); saveCardField({ savingsVaultEnabled: next }); closeModal(); }}
              style={{ background:savingsOn?C.bgElevated:C.gold, border:savingsOn?`1px solid ${C.border}`:"none", borderRadius:12, padding:"14px", color:savingsOn?C.white:"#000", fontWeight:700, fontSize:14, cursor:"pointer", width:"100%" }}>
              {savingsOn ? "Disable Savings Vault" : "Enable Savings Vault →"}
            </FeelButton>
          </div>
        </ActionModal>
      )}

      {/* Crypto Earn modal */}
      {modal === "earn" && (
        <ActionModal title="Crypto Earn" onClose={closeModal}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ fontSize:13, color:C.muted, lineHeight:1.7 }}>Earn up to 12% APY by staking idle crypto holdings. {earnOn ? "You're currently enrolled." : "Enroll to start earning."}</div>
            <FeelButton onClick={() => { const next=!earnOn; setEarnOn(next); showConfirmed(next?"Crypto Earn enabled":"Crypto Earn disabled"); saveCardField({ cryptoEarnEnabled: next }); closeModal(); }}
              style={{ background:earnOn?C.bgElevated:C.gold, border:earnOn?`1px solid ${C.border}`:"none", borderRadius:12, padding:"14px", color:earnOn?C.white:"#000", fontWeight:700, fontSize:14, cursor:"pointer", width:"100%" }}>
              {earnOn ? "Disable Crypto Earn" : "Enable Crypto Earn →"}
            </FeelButton>
          </div>
        </ActionModal>
      )}
    </div>
  );
}