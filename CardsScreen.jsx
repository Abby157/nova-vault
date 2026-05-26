import { useState } from "react";
import { C } from "../theme";
import { Card, GoldDivider, Badge } from "../components/UI";

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
  const [modal, setModal]           = useState(null); // "freeze"|"pin"|"limits"|"block"
  const [frozen, setFrozen]         = useState(false);
  const [pinStep, setPinStep]       = useState(1);
  const [oldPin, setOldPin]         = useState("");
  const [newPin, setNewPin]         = useState("");
  const [spendLimit, setSpendLimit] = useState(5000);
  const [confirmed, setConfirmed]   = useState("");

  const card = CARDS_DATA[activeCard];

  const closeModal = () => { setModal(null); setPinStep(1); setOldPin(""); setNewPin(""); setConfirmed(""); };

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
            opacity: frozen && activeCard===i ? 0.6 : 1,
          }}>
            <div style={{ position:"absolute", top:0, right:0, width:160, height:160, borderRadius:"50%", background:`radial-gradient(circle,${c.accent}10,transparent)` }} />
            {frozen && activeCard===i && (
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:20, background:"rgba(0,0,0,0.3)" }}>
                <div style={{ fontSize:32 }}>🔒</div>
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
          { icon: frozen?"🔓":"🔒", label: frozen?"Unfreeze":"Freeze", action:() => { setFrozen(f=>!f); setConfirmed(frozen?"Card unfrozen":"Card frozen"); setTimeout(()=>setConfirmed(""),2500); } },
          { icon:"🔑", label:"PIN",    action:()=>setModal("pin")    },
          { icon:"💳", label:"Limits", action:()=>setModal("limits") },
          { icon:"❌", label:"Block",  action:()=>setModal("block")  },
        ].map(({ icon, label, action }) => (
          <button key={label} onClick={action} style={{
            background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:12,
            padding:"14px 8px", display:"flex", flexDirection:"column",
            alignItems:"center", gap:6, cursor:"pointer", transition:"all 0.2s",
            color: label==="Freeze"||label==="Unfreeze" ? (frozen?C.green:C.gold) : label==="Block" ? C.red : C.mutedLight,
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor=C.gold}
            onMouseLeave={e => e.currentTarget.style.borderColor=C.border}
          >
            <span style={{ fontSize:20 }}>{icon}</span>
            <span style={{ fontSize:11, fontWeight:600 }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Confirmed toast */}
      {confirmed && (
        <div style={{ background:`${C.green}15`, border:`1px solid ${C.green}40`, borderRadius:10, padding:"12px 16px", textAlign:"center", color:C.green, fontSize:13, fontWeight:600 }}>
          ✓ {confirmed}
        </div>
      )}

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {[
          { label:"Monthly Spent",   value:"$4,281.40", sub:"72% of limit"        },
          { label:"Cashback Earned", value:"$84.20",    sub:"This month"          },
          { label:"Transactions",    value:"38",         sub:"This month"          },
          { label:"Credit Limit",    value:"$10,000",   sub:`Available: $${(10000-4281).toLocaleString()}` },
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
            { icon:"🏦", label:"Bank Transfer (SWIFT/SEPA)", sub:"Send to any bank worldwide",  badge:"Instant", color:C.green  },
            { icon:"📊", label:"Savings Vault",              sub:"4.8% APY on USD holdings",   badge:"Popular", color:C.gold   },
            { icon:"💰", label:"Crypto Earn",                sub:"Up to 12% APY on crypto",    badge:"New",     color:"#9945FF"},
          ].map(({ icon,label,sub,badge,color },i,arr) => (
            <div key={label}>
              <div style={{ padding:"16px 18px", display:"flex", alignItems:"center", gap:14, cursor:"pointer" }}
                onMouseEnter={e => e.currentTarget.style.background=C.bgHover}
                onMouseLeave={e => e.currentTarget.style.background="transparent"}
              >
                <div style={{ fontSize:24 }}>{icon}</div>
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
              <button onClick={() => { if(oldPin.length===6) setPinStep(2); }} style={{ background:C.gold, border:"none", borderRadius:12, padding:"14px", color:"#000", fontWeight:700, fontSize:14, cursor:"pointer", width:"100%" }}>Continue →</button>
            </div>
          )}
          {pinStep === 2 && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ fontSize:13, color:C.muted }}>Enter your new 6-digit PIN.</div>
              <input type="password" maxLength={6} placeholder="New PIN (6 digits)" value={newPin} onChange={e => setNewPin(e.target.value)}
                style={{ background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px", color:C.white, fontSize:18, fontWeight:700, outline:"none", textAlign:"center", letterSpacing:"0.3em", width:"100%", boxSizing:"border-box" }} />
              <button onClick={() => { if(newPin.length===6) { setConfirmed("PIN updated successfully"); closeModal(); } }} style={{ background:C.gold, border:"none", borderRadius:12, padding:"14px", color:"#000", fontWeight:700, fontSize:14, cursor:"pointer", width:"100%" }}>Set New PIN →</button>
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
                <button key={v} onClick={() => setSpendLimit(v)} style={{ padding:"8px 4px", borderRadius:8, fontSize:11, fontWeight:700, cursor:"pointer", background:spendLimit===v?C.goldGlow:C.bgElevated, border:`1px solid ${spendLimit===v?C.gold:C.border}`, color:spendLimit===v?C.gold:C.muted }}>${(v/1000).toFixed(0)}k</button>
              ))}
            </div>
            <button onClick={() => { setConfirmed(`Limit set to $${spendLimit.toLocaleString()}`); closeModal(); }} style={{ background:C.gold, border:"none", borderRadius:12, padding:"14px", color:"#000", fontWeight:700, fontSize:14, cursor:"pointer", width:"100%" }}>Save Limit →</button>
          </div>
        </ActionModal>
      )}

      {/* Block modal */}
      {modal === "block" && (
        <ActionModal title="Block Card" onClose={closeModal}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ background:`${C.red}15`, border:`1px solid ${C.red}30`, borderRadius:12, padding:"14px 16px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.red, marginBottom:6 }}>⚠️ Permanent Action</div>
              <div style={{ fontSize:12, color:C.mutedLight, lineHeight:1.7 }}>Blocking this card is permanent and cannot be undone. A replacement card will be issued within 5–7 business days.</div>
            </div>
            <div style={{ fontSize:13, color:C.muted }}>Are you sure you want to permanently block <span style={{ color:C.white, fontWeight:700 }}>{card.name} {card.number.slice(-4)}</span>?</div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={closeModal} style={{ flex:1, padding:"13px", borderRadius:12, background:C.bgElevated, border:`1px solid ${C.border}`, color:C.white, fontWeight:700, cursor:"pointer" }}>Cancel</button>
              <button onClick={() => { setConfirmed("Card blocked. Replacement ordered."); closeModal(); }} style={{ flex:1, padding:"13px", borderRadius:12, background:C.red, border:"none", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>Block Card</button>
            </div>
          </div>
        </ActionModal>
      )}
    </div>
  );
}