import { useState, useEffect } from "react";
import { C } from "../theme";
import { Card, GoldDivider, AnimatedNumber } from "../components/UI";
import { db, auth, doc, onSnapshot } from "../firebase";

const SLICE_COLORS = ["#F7931A","#627EEA","#9945FF","#F3BA2F","#26A17B","#6B9EFF"];

function PieChart({ data, active, setActive }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  let cumAngle = -90;
  const cx = 130, cy = 130, r = 100, inner = 58;

  const slices = data.map((d, i) => {
    const pct = total ? d.value / total : 0;
    const angle = pct * 360;
    const startA = cumAngle;
    const endA = cumAngle + angle;
    cumAngle += angle;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startA));
    const y1 = cy + r * Math.sin(toRad(startA));
    const x2 = cx + r * Math.cos(toRad(endA));
    const y2 = cy + r * Math.sin(toRad(endA));
    const xi1 = cx + inner * Math.cos(toRad(startA));
    const yi1 = cy + inner * Math.sin(toRad(startA));
    const xi2 = cx + inner * Math.cos(toRad(endA));
    const yi2 = cy + inner * Math.sin(toRad(endA));
    const large = angle > 180 ? 1 : 0;
    const isActive = active === i;
    const midA = startA + angle / 2;
    const nudge = isActive ? 10 : 0;
    const nx = nudge * Math.cos(toRad(midA));
    const ny = nudge * Math.sin(toRad(midA));
    return {
      path: `M ${xi1+nx} ${yi1+ny} L ${x1+nx} ${y1+ny} A ${r} ${r} 0 ${large} 1 ${x2+nx} ${y2+ny} L ${xi2+nx} ${yi2+ny} A ${inner} ${inner} 0 ${large} 0 ${xi1+nx} ${yi1+ny} Z`,
      color: SLICE_COLORS[i % SLICE_COLORS.length], pct, i, label: d.label,
    };
  });

  const activeSlice = active !== null ? data[active] : null;

  if (total === 0) return (
    <div style={{ position:"relative", width:260, height:260, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <svg width="260" height="260" viewBox="0 0 260 260">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={`${C.gold}15`} strokeWidth="42" />
        <text x={cx} y={cy-8} textAnchor="middle" fontSize="11" fill={C.muted} letterSpacing="2">TOTAL</text>
        <text x={cx} y={cy+14} textAnchor="middle" fontSize="18" fontWeight="800" fill={C.white}>$0.00</text>
      </svg>
    </div>
  );

  return (
    <div style={{ position: "relative", width: 260, margin: "0 auto" }}>
      <svg width="260" height="260" viewBox="0 0 260 260">
        {slices.map(s => (
          <path key={s.i} d={s.path} fill={s.color}
            opacity={active === null || active === s.i ? 1 : 0.35}
            style={{ cursor:"pointer", transition:"all 0.25s ease" }}
            onClick={() => setActive(active === s.i ? null : s.i)}
          />
        ))}
        <circle cx={cx} cy={cy} r={inner - 1} fill={C.bg} />
        <circle cx={cx} cy={cy} r={inner} fill="none" stroke={`${C.gold}20`} strokeWidth="1" />
        {activeSlice ? (
          <>
            <text x={cx} y={cy-12} textAnchor="middle" fontSize="13" fontWeight="700" fill={SLICE_COLORS[active % SLICE_COLORS.length]}>{activeSlice.label}</text>
            <text x={cx} y={cy+8}  textAnchor="middle" fontSize="20" fontWeight="800" fill={C.white}>{(activeSlice.pct*100).toFixed(1)}%</text>
            <text x={cx} y={cy+26} textAnchor="middle" fontSize="11" fill={C.muted}>${activeSlice.value.toLocaleString()}</text>
          </>
        ) : (
          <>
            <text x={cx} y={cy-8}  textAnchor="middle" fontSize="11" fill={C.muted} letterSpacing="2">TOTAL</text>
            <text x={cx} y={cy+14} textAnchor="middle" fontSize="18" fontWeight="800" fill={C.white}>${total.toLocaleString()}</text>
          </>
        )}
      </svg>
    </div>
  );
}

export default function PortfolioScreen({ cryptos = [] }) {
  const [active, setActive]     = useState(null);
  const [period, setPeriod]     = useState("1M");
  const [visible, setVisible]   = useState(false);
  const [realHoldings, setRealHoldings] = useState({});
  const [loadingHoldings, setLoadingHoldings] = useState(true);

  const uid = auth.currentUser?.uid;

  useEffect(() => { setTimeout(() => setVisible(true), 80); }, []);

  // Pull real holdings from Firestore wallet doc
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "wallets", uid), snap => {
      if (snap.exists()) {
        setRealHoldings(snap.data().holdings || {});
      }
      setLoadingHoldings(false);
    });
    return () => unsub();
  }, [uid]);

  if (!cryptos.length || loadingHoldings) return (
    <div style={{ textAlign:"center", padding:"60px 0", color:C.muted }}>Loading portfolio…</div>
  );

  // Build holdings list from REAL balances only (skip coins with 0 or no holding)
  const holdings = cryptos
    .map((c, i) => {
      const realBalance = realHoldings[c.symbol] || 0;
      return {
        ...c,
        balance: realBalance,
        value: Math.round(c.price * realBalance * 100) / 100,
        pct: 0,
        label: c.symbol,
        color: SLICE_COLORS[i % SLICE_COLORS.length],
      };
    })
    .filter(h => h.balance > 0);

  const total = holdings.reduce((s, h) => s + h.value, 0);
  holdings.forEach(h => { h.pct = total ? h.value / total : 0; });
  const pieData = holdings.map(h => ({ label: h.symbol, value: h.value, pct: h.pct }));

  const perfData = [
    { period:"1D", val:"—", pct:"—" },
    { period:"1W", val:"—", pct:"—" },
    { period:"1M", val:"—", pct:"—" },
    { period:"1Y", val:"—", pct:"—" },
  ];
  const selected = perfData.find(p => p.period === period) || perfData[2];

  const bestPerformer  = holdings.length ? holdings.reduce((a,b)=>a.change>b.change?a:b, holdings[0]) : null;
  const worstPerformer = holdings.length ? holdings.reduce((a,b)=>a.change<b.change?a:b, holdings[0]) : null;

  return (
    <div style={{ opacity:visible?1:0, transition:"opacity 0.4s", display:"flex", flexDirection:"column", gap:20 }}>
      <div>
        <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.15em", textTransform:"uppercase" }}>Portfolio</div>
        <div style={{ fontSize:28, fontWeight:800, color:C.white, marginTop:4 }}>
          $<AnimatedNumber value={total.toFixed(2)} decimals={2} />
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
          <span style={{ color:C.muted, fontSize:12 }}>{holdings.length} asset{holdings.length!==1?"s":""} held</span>
        </div>
      </div>

      <div style={{ display:"flex", gap:6 }}>
        {["1D","1W","1M","1Y","All"].map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            flex:1, padding:"7px 4px", borderRadius:8,
            background: period===p ? C.goldGlow : "transparent",
            border: `1px solid ${period===p ? C.gold : C.border}`,
            color: period===p ? C.gold : C.muted,
            fontSize:11, fontWeight:700, cursor:"pointer", transition:"all 0.15s",
          }}>{p}</button>
        ))}
      </div>

      <Card hover={false} style={{ padding:"24px 16px" }}>
        <PieChart data={pieData} active={active} setActive={setActive} />
        <div style={{ textAlign:"center", marginTop:8, fontSize:11, color:C.muted }}>
          {holdings.length ? "Tap a slice to inspect" : "Buy or swap crypto on the Trade screen to see it here"}
        </div>
      </Card>

      <div>
        <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:12 }}>Breakdown</div>
        {holdings.length === 0 ? (
          <Card hover={false} style={{ padding:"32px 16px", textAlign:"center" }}>
            <div style={{ fontSize:32, marginBottom:8 }}>💼</div>
            <div style={{ fontSize:13, fontWeight:600, color:C.mutedLight }}>No holdings yet</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>Go to Trade to buy or swap your first asset</div>
          </Card>
        ) : (
          <Card hover={false} style={{ padding:0, overflow:"hidden" }}>
            {holdings.map((h, i) => (
              <div key={h.symbol}>
                <div onClick={() => setActive(active===i?null:i)} style={{ padding:"14px 18px", display:"flex", alignItems:"center", gap:14, background:active===i?`${SLICE_COLORS[i%SLICE_COLORS.length]}10`:"transparent", cursor:"pointer", transition:"background 0.2s" }}>
                  <div style={{ width:4, height:36, borderRadius:4, background:SLICE_COLORS[i%SLICE_COLORS.length], flexShrink:0 }} />
                  <div style={{ width:36, height:36, borderRadius:"50%", background:`${h.color}20`, border:`1px solid ${h.color}40`, display:"flex", alignItems:"center", justifyContent:"center", color:h.color, fontWeight:800, flexShrink:0 }}>{h.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ fontSize:13, fontWeight:700, color:C.white }}>{h.symbol}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:C.white }}>${h.value.toLocaleString()}</span>
                    </div>
                    <div style={{ marginTop:6, height:4, background:C.bgElevated, borderRadius:4, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${(h.pct*100).toFixed(1)}%`, background:`linear-gradient(90deg,${SLICE_COLORS[i%SLICE_COLORS.length]},${SLICE_COLORS[i%SLICE_COLORS.length]}80)`, borderRadius:4, transition:"width 0.6s ease" }} />
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
                      <span style={{ fontSize:11, color:C.muted }}>{h.balance.toFixed(6)} {h.symbol}</span>
                      <span style={{ fontSize:11, color:C.mutedLight, fontWeight:600 }}>{(h.pct*100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                {i < holdings.length-1 && <GoldDivider margin="0 18px" />}
              </div>
            ))}
          </Card>
        )}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {[
          { label:"Best Performer",  value: bestPerformer?.symbol ?? "—",  sub:bestPerformer?`${bestPerformer.change>=0?"+":""}${bestPerformer.change}% 24h`:"No holdings yet", color:"#9945FF" },
          { label:"Worst Performer", value: worstPerformer?.symbol ?? "—", sub:worstPerformer?`${worstPerformer.change>=0?"+":""}${worstPerformer.change}% 24h`:"No holdings yet", color:C.red },
          { label:"Total Assets",    value: holdings.length,               sub:"Coins held",        color:C.gold  },
          { label:"Portfolio Value", value: `$${total.toLocaleString()}`,  sub:"Current total",     color:C.green },
        ].map(({ label, value, sub, color }) => (
          <Card key={label} style={{ padding:16 }}>
            <div style={{ fontSize:10, color:C.muted, letterSpacing:"0.08em", textTransform:"uppercase" }}>{label}</div>
            <div style={{ fontSize:18, fontWeight:800, color, margin:"6px 0 2px" }}>{value}</div>
            <div style={{ fontSize:11, color:C.mutedLight }}>{sub}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}