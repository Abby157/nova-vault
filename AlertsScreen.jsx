import { useState, useEffect, useRef } from "react";
import { C } from "../theme";
import { Card, GoldButton, GoldDivider, Badge } from "../components/UI";
import { sendEmail, Emails } from "../notifications";

export function ToastContainer({ toasts, onDismiss }) {
  return (
    <div style={{ position:"fixed", top:80, right:16, zIndex:9999, display:"flex", flexDirection:"column", gap:10, maxWidth:320, width:"calc(100% - 32px)", pointerEvents:"none" }}>
      {toasts.map(t => <Toast key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>
  );
}

function Toast({ toast, onDismiss }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setTimeout(() => setVisible(true), 10);
    const timer = setTimeout(() => { setVisible(false); setTimeout(() => onDismiss(toast.id), 400); }, 5000);
    return () => clearTimeout(timer);
  }, []);
  const isAbove = toast.direction === "above";
  const color = isAbove ? C.green : C.red;
  return (
    <div onClick={() => { setVisible(false); setTimeout(() => onDismiss(toast.id), 400); }}
      style={{ pointerEvents:"all", background:C.bgCard, border:`1px solid ${color}40`, borderLeft:`3px solid ${color}`, borderRadius:14, padding:"14px 16px", boxShadow:`0 8px 32px rgba(0,0,0,0.6),0 0 20px ${color}15`, opacity:visible?1:0, transform:visible?"translateX(0)":"translateX(120%)", transition:"all 0.35s cubic-bezier(0.34,1.56,0.64,1)", cursor:"pointer" }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
        <div style={{ fontSize:22, flexShrink:0 }}>{isAbove?"🚀":"📉"}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.white }}>{toast.title}</div>
          <div style={{ fontSize:12, color:C.muted, marginTop:3 }}>{toast.body}</div>
        </div>
        <div style={{ fontSize:16, color, fontWeight:700 }}>{isAbove?"▲":"▼"}</div>
      </div>
      <div style={{ marginTop:10, height:2, background:C.bgElevated, borderRadius:2, overflow:"hidden" }}>
        <div style={{ height:"100%", background:color, borderRadius:2, animation:"shrink-bar 5s linear forwards" }} />
      </div>
      <style>{`@keyframes shrink-bar{from{width:100%}to{width:0%}}`}</style>
    </div>
  );
}

function AlertRow({ alert, currentPrice, onDelete, onToggle }) {
  const triggered = alert.direction==="above" ? currentPrice>=alert.target : currentPrice<=alert.target;
  const pctAway = currentPrice ? (((alert.target-currentPrice)/currentPrice)*100).toFixed(2) : null;
  return (
    <div style={{ padding:"16px 18px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:38, height:38, borderRadius:"50%", flexShrink:0, background:`${alert.color}20`, border:`1px solid ${alert.color}40`, display:"flex", alignItems:"center", justifyContent:"center", color:alert.color, fontWeight:800, fontSize:14 }}>{alert.icon}</div>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <span style={{ fontSize:13, fontWeight:700, color:C.white }}>{alert.symbol}</span>
              <span style={{ fontSize:12, color:C.muted, marginLeft:8 }}>{alert.direction==="above"?"▲ above":"▼ below"}</span>
              <span style={{ fontSize:13, fontWeight:700, color:alert.direction==="above"?C.green:C.red, marginLeft:6 }}>${alert.target.toLocaleString()}</span>
            </div>
            <div onClick={() => onToggle(alert.id)} style={{ width:40, height:22, borderRadius:11, background:alert.active?C.gold:C.bgElevated, border:`1px solid ${alert.active?C.gold:C.border}`, position:"relative", cursor:"pointer", transition:"all 0.2s", flexShrink:0 }}>
              <div style={{ position:"absolute", top:3, left:alert.active?20:3, width:14, height:14, borderRadius:"50%", background:alert.active?"#000":C.muted, transition:"left 0.2s" }} />
            </div>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6 }}>
            <div style={{ display:"flex", gap:8 }}>
              {triggered && alert.active && <Badge color={C.green}>TRIGGERED</Badge>}
              {!alert.active && <Badge color={C.muted}>PAUSED</Badge>}
              {!triggered && alert.active && pctAway!==null && <span style={{ fontSize:11, color:C.muted }}>{Math.abs(pctAway)}% away</span>}
            </div>
            <span style={{ fontSize:11, color:C.muted }}>Now: ${currentPrice?.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})??"—"}</span>
          </div>
        </div>
        <button onClick={() => onDelete(alert.id)} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:16, padding:4, flexShrink:0 }}>✕</button>
      </div>
    </div>
  );
}

export default function AlertsScreen({ cryptos=[], toasts, setToasts, user }) {
  const [alerts, setAlerts]       = useState([
    { id:1, symbol:"BTC", icon:"₿", color:"#F7931A", target:80000, direction:"above", active:true },
    { id:2, symbol:"ETH", icon:"Ξ", color:"#627EEA", target:2000,  direction:"below", active:true },
  ]);
  const [showForm, setShowForm]   = useState(false);
  const [selSymbol, setSelSymbol] = useState("BTC");
  const [direction, setDirection] = useState("above");
  const [target, setTarget]       = useState("");
  const firedRef = useRef(new Set());

  const getPriceOf = (symbol) => cryptos.find(c => c.symbol===symbol)?.price ?? null;

  useEffect(() => {
    if (!cryptos.length) return;
    alerts.forEach(alert => {
      if (!alert.active) return;
      const price = getPriceOf(alert.symbol);
      if (!price) return;
      const triggered = alert.direction==="above" ? price>=alert.target : price<=alert.target;
      if (triggered && !firedRef.current.has(alert.id)) {
        firedRef.current.add(alert.id);
        const id = Date.now();
        // Toast notification
        setToasts(prev => [...prev, {
          id, direction:alert.direction,
          title:`${alert.symbol} Alert Triggered!`,
          body:`${alert.symbol} is ${alert.direction==="above"?"above":"below"} $${alert.target.toLocaleString()} — now $${price.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`,
        }]);
        // Email notification
        sendEmail(Emails.alertTriggered(
          { email:user?.email||"user@novavault.io", name:user?.name||"Valued Customer" },
          alert.symbol, alert.direction, alert.target, price
        ));
      }
      if (!triggered) firedRef.current.delete(alert.id);
    });
  }, [cryptos, alerts]);

  const addAlert = () => {
    if (!target || isNaN(parseFloat(target))) return;
    const coin = cryptos.find(c => c.symbol===selSymbol) ?? { symbol:selSymbol, icon:"?", color:C.gold };
    setAlerts(prev => [...prev, { id:Date.now(), symbol:coin.symbol, icon:coin.icon, color:coin.color, target:parseFloat(target), direction, active:true }]);
    setTarget(""); setShowForm(false);
  };

  const activeCount    = alerts.filter(a => a.active).length;
  const triggeredCount = alerts.filter(a => {
    const price = getPriceOf(a.symbol);
    if (!price||!a.active) return false;
    return a.direction==="above" ? price>=a.target : price<=a.target;
  }).length;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
        {[
          { label:"Total",    value:alerts.length,   color:C.gold  },
          { label:"Active",   value:activeCount,      color:C.green },
          { label:"Triggered",value:triggeredCount,   color:triggeredCount>0?C.red:C.muted },
        ].map(({ label,value,color }) => (
          <Card key={label} style={{ padding:"14px 12px", textAlign:"center" }}>
            <div style={{ fontSize:10, color:C.muted, letterSpacing:"0.08em", textTransform:"uppercase" }}>{label}</div>
            <div style={{ fontSize:24, fontWeight:800, color, marginTop:4 }}>{value}</div>
          </Card>
        ))}
      </div>

      <GoldButton onClick={() => setShowForm(v=>!v)} style={{ width:"100%", padding:"14px" }}>
        {showForm?"✕ Cancel":"+ New Price Alert"}
      </GoldButton>

      {showForm && (
        <Card hover={false} style={{ padding:20, display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.white }}>Set Price Alert</div>
          <div>
            <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em", marginBottom:8 }}>ASSET</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {cryptos.slice(0,5).map(c => (
                <button key={c.symbol} onClick={() => setSelSymbol(c.symbol)} style={{ padding:"7px 14px", borderRadius:10, cursor:"pointer", background:selSymbol===c.symbol?C.goldGlow:C.bgElevated, border:`1px solid ${selSymbol===c.symbol?C.gold:C.border}`, color:selSymbol===c.symbol?C.gold:C.mutedLight, fontSize:12, fontWeight:700, transition:"all 0.15s" }}>{c.symbol}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em", marginBottom:8 }}>CONDITION</div>
            <div style={{ display:"flex", background:C.bgElevated, borderRadius:10, padding:4, gap:4, border:`1px solid ${C.border}` }}>
              {[["above","▲ Rises Above"],["below","▼ Drops Below"]].map(([d,label]) => (
                <button key={d} onClick={() => setDirection(d)} style={{ flex:1, padding:"9px", borderRadius:8, border:"none", cursor:"pointer", background:direction===d?(d==="above"?C.green:C.red):"transparent", color:direction===d?"#fff":C.muted, fontWeight:700, fontSize:12, transition:"all 0.2s" }}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em", marginBottom:8 }}>
              TARGET PRICE
              {getPriceOf(selSymbol) && <span style={{ color:C.gold, marginLeft:8 }}>Now: ${getPriceOf(selSymbol)?.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>}
            </div>
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:C.gold, fontWeight:700 }}>$</span>
              <input value={target} onChange={e => setTarget(e.target.value)} placeholder="0.00" type="number"
                style={{ width:"100%", background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px 14px 30px", color:C.white, fontSize:18, fontWeight:700, outline:"none", boxSizing:"border-box" }} />
            </div>
          </div>
          <div style={{ background:`${C.gold}10`, border:`1px solid ${C.gold}30`, borderRadius:10, padding:"10px 14px" }}>
            <div style={{ fontSize:11, color:C.gold, fontWeight:600, marginBottom:2 }}>📧 Email alerts enabled</div>
            <div style={{ fontSize:11, color:C.mutedLight }}>You'll receive an email at <span style={{ color:C.gold }}>{user?.email||"your email"}</span> when this alert triggers.</div>
          </div>
          <GoldButton onClick={addAlert} disabled={!target} style={{ width:"100%", padding:"14px" }}>🔔 Set Alert</GoldButton>
        </Card>
      )}

      <div>
        <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:12 }}>Active Alerts</div>
        {alerts.length === 0 ? (
          <div style={{ textAlign:"center", padding:"40px 0", color:C.muted }}>
            <div style={{ fontSize:32, marginBottom:12 }}>🔔</div>
            <div>No alerts set yet</div>
          </div>
        ) : (
          <Card hover={false} style={{ padding:0, overflow:"hidden" }}>
            {alerts.map((alert,i) => (
              <div key={alert.id}>
                <AlertRow alert={alert} currentPrice={getPriceOf(alert.symbol)} onDelete={id => setAlerts(p=>p.filter(a=>a.id!==id))} onToggle={id => setAlerts(p=>p.map(a=>a.id===id?{...a,active:!a.active}:a))} />
                {i<alerts.length-1 && <GoldDivider margin="0 18px" />}
              </div>
            ))}
          </Card>
        )}
      </div>

      <Card hover={false} style={{ padding:"14px 18px", background:C.bgElevated }}>
        <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.08em", marginBottom:8, textTransform:"uppercase" }}>How it works</div>
        <div style={{ fontSize:12, color:C.mutedLight, lineHeight:1.7 }}>Alerts check live prices every 60 seconds. You'll get a toast notification AND an email to <span style={{ color:C.gold }}>{user?.email||"your email"}</span> when your target is hit.</div>
      </Card>
    </div>
  );
}