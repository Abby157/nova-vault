import { useState, useEffect } from "react";
import { C } from "../theme";
import { Card, GoldButton } from "../components/UI";
import { db, auth, doc, onSnapshot, updateDoc, addDoc, collection, serverTimestamp, increment } from "../firebase";

const INTERVALS = ["1H","4H","1D","1W"];

function CandlestickChart({ candles, width=340, height=160 }) {
  if (!candles.length) return null;
  const pad = { top:10, bottom:20, left:8, right:40 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const allPrices = candles.flatMap(c => [c.high, c.low]);
  const minP = Math.min(...allPrices), maxP = Math.max(...allPrices);
  const range = maxP - minP || 1;
  const candleW = Math.max(4, Math.floor(chartW / candles.length) - 2);
  const toY = (p) => pad.top + chartH - ((p - minP) / range) * chartH;
  const toX = (i) => pad.left + (i / candles.length) * chartW + candleW / 2;
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow:"visible" }}>
      {[0,0.25,0.5,0.75,1].map(p => {
        const y = pad.top + chartH * p;
        const price = maxP - p * range;
        return (
          <g key={p}>
            <line x1={pad.left} y1={y} x2={width-pad.right} y2={y} stroke={`${C.gold}10`} strokeWidth="1" />
            <text x={width-pad.right+4} y={y+3} fontSize="8" fill={C.muted}>${price.toFixed(0)}</text>
          </g>
        );
      })}
      {candles.map((c,i) => {
        const x = toX(i);
        const isUp = c.close >= c.open;
        const color = isUp ? C.green : C.red;
        const bodyTop    = toY(Math.max(c.open, c.close));
        const bodyBottom = toY(Math.min(c.open, c.close));
        const bodyH = Math.max(1, bodyBottom - bodyTop);
        return (
          <g key={i}>
            <line x1={x} y1={toY(c.high)} x2={x} y2={toY(c.low)} stroke={color} strokeWidth="1" opacity="0.7" />
            <rect x={x-candleW/2} y={bodyTop} width={candleW} height={bodyH} fill={color} opacity={isUp?0.85:0.75} rx="1" />
          </g>
        );
      })}
    </svg>
  );
}

function generateCandles(basePrice, count=40, interval="1D") {
  const candles = [];
  let price = basePrice * 0.92;
  for (let i = 0; i < count; i++) {
    const v = basePrice * 0.015;
    const open  = price;
    const close = price + (Math.random() - 0.46) * v;
    const high  = Math.max(open, close) + Math.random() * v * 0.5;
    const low   = Math.min(open, close) - Math.random() * v * 0.5;
    candles.push({ open, close, high, low });
    price = close;
  }
  return candles;
}

export default function TradeScreen({ cryptos=[] }) {
  const [fromAsset, setFromAsset] = useState(null);
  const [toAsset, setToAsset]     = useState(null);
  const [amount, setAmount]       = useState("");
  const [activeTab, setActiveTab] = useState("swap");
  const [interval, setIntervalV]  = useState("1D");
  const [candles, setCandles]     = useState([]);
  const [balance, setBalance]     = useState(0);
  const [holdings, setHoldings]   = useState({});
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState("");
  const [error, setError]         = useState("");

  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (cryptos.length) {
      setFromAsset(cryptos[0]);
      setToAsset(cryptos[1]);
    }
  }, [cryptos]);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "wallets", uid), snap => {
      if (snap.exists()) {
        setBalance(snap.data().usdBalance || 0);
        setHoldings(snap.data().holdings || {});
      }
    });
    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!fromAsset) return;
    setCandles(generateCandles(fromAsset.price, 40, interval));
  }, [fromAsset, interval]);

  if (!fromAsset || !toAsset) return (
    <div style={{ textAlign:"center", padding:"60px 0", color:C.muted }}>Loading market data…</div>
  );

  const fromHolding = holdings[fromAsset.symbol] || 0;
  const toAmount     = amount ? ((parseFloat(amount) * fromAsset.price) / toAsset.price).toFixed(6) : "";
  const usdCost      = amount ? (parseFloat(amount) * fromAsset.price).toFixed(2) : "0.00";
  const rate         = (fromAsset.price / toAsset.price).toFixed(6);
  const lastCandle   = candles[candles.length - 1];
  const firstCandle  = candles[0];
  const priceChange  = lastCandle && firstCandle ? ((lastCandle.close - firstCandle.open) / firstCandle.open * 100).toFixed(2) : 0;
  const isUp         = parseFloat(priceChange) >= 0;

  const swapAssets = () => {
    const tmp = fromAsset; setFromAsset(toAsset); setToAsset(tmp);
    setAmount(toAmount);
  };

  const handleTrade = async () => {
    if (!amount || parseFloat(amount) <= 0) { setError("Enter an amount."); return; }
    const cost = parseFloat(usdCost);

    // For "buy" — deduct USD, credit crypto
    // For "sell" — deduct crypto holding, credit USD
    // For "swap" — deduct fromAsset holding (or USD if fromAsset is USD type), credit toAsset

    if (activeTab === "sell") {
      if (parseFloat(amount) > fromHolding) {
        setError(`Insufficient ${fromAsset.symbol}. You have ${fromHolding} ${fromAsset.symbol}.`);
        return;
      }
    } else {
      if (cost > balance) { setError(`Insufficient balance. You have $${balance.toFixed(2)} USD.`); return; }
    }

    setLoading(true); setError(""); setSuccess("");
    try {
      const updates = {};

      if (activeTab === "buy") {
        // Deduct USD, credit crypto holding
        updates.usdBalance = increment(-cost);
        updates[`holdings.${fromAsset.symbol}`] = increment(parseFloat(amount));
      } else if (activeTab === "sell") {
        // Deduct crypto holding, credit USD
        updates[`holdings.${fromAsset.symbol}`] = increment(-parseFloat(amount));
        updates.usdBalance = increment(cost);
      } else {
        // Swap — deduct fromAsset holding, credit toAsset holding
        updates[`holdings.${fromAsset.symbol}`] = increment(-parseFloat(amount));
        updates[`holdings.${toAsset.symbol}`]   = increment(parseFloat(toAmount));
      }

      await updateDoc(doc(db, "wallets", uid), updates);

      await addDoc(collection(db, "transactions"), {
        fromUid: uid, fromEmail: auth.currentUser?.email||"",
        fromName: auth.currentUser?.displayName||"User",
        toUid: uid, toEmail: auth.currentUser?.email||"",
        toName: auth.currentUser?.displayName||"User",
        amount: cost, note: `${activeTab === "swap" ? "Swapped" : activeTab === "buy" ? "Bought" : "Sold"} ${amount} ${fromAsset.symbol} → ${toAmount} ${toAsset.symbol}`,
        status:"completed", type:activeTab, createdAt: serverTimestamp(),
      });
      setSuccess(`✓ ${activeTab === "swap" ? "Swap" : activeTab === "buy" ? "Purchase" : "Sale"} complete! ${amount} ${fromAsset.symbol} → ${toAmount} ${toAsset.symbol}`);
      setAmount("");
    } catch(e) {
      setError("Trade failed. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Tabs */}
      <div style={{ display:"flex", gap:8 }}>
        {["swap","buy","sell"].map(t => (
          <button key={t} onClick={()=>{ setActiveTab(t); setError(""); setSuccess(""); }} style={{ flex:1, padding:"10px", borderRadius:10, border:`1px solid ${activeTab===t?C.gold:C.border}`, background:activeTab===t?C.goldGlow:C.bgElevated, color:activeTab===t?C.gold:C.muted, fontWeight:700, fontSize:12, cursor:"pointer", textTransform:"uppercase", letterSpacing:"0.05em", transition:"all 0.2s" }}>{t}</button>
        ))}
      </div>

      {/* Balance bar */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 16px" }}>
        <span style={{ fontSize:12, color:C.muted }}>USD Balance</span>
        <span style={{ fontSize:14, fontWeight:700, color:C.white }}>${balance.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
      </div>

      {/* Holding bar — shows for sell/swap */}
      {(activeTab === "sell" || activeTab === "swap") && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 16px" }}>
          <span style={{ fontSize:12, color:C.muted }}>{fromAsset.symbol} Holdings</span>
          <span style={{ fontSize:14, fontWeight:700, color:C.white }}>{fromHolding.toFixed(6)} {fromAsset.symbol}</span>
        </div>
      )}

      {/* Chart card */}
      <Card hover={false} style={{ padding:"16px 12px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:28, height:28, borderRadius:"50%", background:`${fromAsset.color}20`, border:`1px solid ${fromAsset.color}40`, display:"flex", alignItems:"center", justifyContent:"center", color:fromAsset.color, fontWeight:800, fontSize:12 }}>{fromAsset.icon}</div>
              <span style={{ fontSize:16, fontWeight:800, color:C.white }}>{fromAsset.symbol}/USD</span>
            </div>
            <div style={{ fontSize:22, fontWeight:800, color:C.white, marginTop:4 }}>
              ${fromAsset.price.toLocaleString("en-US",{minimumFractionDigits:2})}
            </div>
            <div style={{ fontSize:12, fontWeight:600, color:isUp?C.green:C.red, marginTop:2 }}>
              {isUp?"▲":"▼"} {Math.abs(priceChange)}% ({interval})
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {cryptos.slice(0,4).map(c => (
              <button key={c.symbol} onClick={()=>setFromAsset(c)} style={{ padding:"4px 10px", borderRadius:8, cursor:"pointer", fontSize:11, fontWeight:700, background:fromAsset.symbol===c.symbol?C.goldGlow:"transparent", border:`1px solid ${fromAsset.symbol===c.symbol?C.gold:C.border}`, color:fromAsset.symbol===c.symbol?C.gold:C.muted, transition:"all 0.15s" }}>{c.symbol}</button>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", gap:6, marginBottom:12 }}>
          {INTERVALS.map(iv => (
            <button key={iv} onClick={()=>setIntervalV(iv)} style={{ padding:"4px 12px", borderRadius:8, fontSize:11, fontWeight:700, cursor:"pointer", background:interval===iv?C.gold:"transparent", color:interval===iv?"#000":C.muted, border:`1px solid ${interval===iv?C.gold:"transparent"}`, transition:"all 0.15s" }}>{iv}</button>
          ))}
        </div>
        <CandlestickChart candles={candles} width={340} height={160} />
        {lastCandle && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:4, marginTop:10 }}>
            {[["O",lastCandle.open],["H",lastCandle.high],["L",lastCandle.low],["C",lastCandle.close]].map(([label,val]) => (
              <div key={label} style={{ background:C.bgElevated, borderRadius:6, padding:"5px 6px", textAlign:"center" }}>
                <div style={{ fontSize:9, color:C.muted }}>{label}</div>
                <div style={{ fontSize:10, fontWeight:700, color:C.white }}>${val.toFixed(0)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Swap UI */}
      <Card hover={false}>
        <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em", marginBottom:10 }}>FROM</div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:10, padding:"8px 12px" }}>
            <span style={{ color:fromAsset.color, fontWeight:800 }}>{fromAsset.icon}</span>
            <span style={{ color:C.white, fontWeight:700, fontSize:14 }}>{fromAsset.symbol}</span>
          </div>
          <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" type="number"
            style={{ flex:1, background:"none", border:"none", outline:"none", color:C.white, fontSize:24, fontWeight:700, textAlign:"right" }} />
        </div>
        <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>
          ≈ ${usdCost} USD · Holdings: {fromHolding.toFixed(6)} {fromAsset.symbol}
        </div>
      </Card>

      <div style={{ display:"flex", justifyContent:"center" }}>
        <button onClick={swapAssets} style={{ width:44, height:44, borderRadius:"50%", background:C.bgElevated, border:`1px solid ${C.borderStrong}`, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:C.gold, fontSize:18, transition:"all 0.2s" }}
          onMouseEnter={e=>{ e.currentTarget.style.background=C.goldGlow; e.currentTarget.style.transform="rotate(180deg)"; }}
          onMouseLeave={e=>{ e.currentTarget.style.background=C.bgElevated; e.currentTarget.style.transform="rotate(0)"; }}
        >⇅</button>
      </div>

      <Card hover={false}>
        <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em", marginBottom:10 }}>TO</div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:10, padding:"8px 12px" }}>
            <span style={{ color:toAsset.color, fontWeight:800 }}>{toAsset.icon}</span>
            <span style={{ color:C.white, fontWeight:700, fontSize:14 }}>{toAsset.symbol}</span>
          </div>
          <div style={{ flex:1, textAlign:"right", fontSize:24, fontWeight:700, color:toAmount?C.white:C.muted }}>{toAmount||"0.00"}</div>
        </div>
        <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>Rate: 1 {fromAsset.symbol} = {rate} {toAsset.symbol}</div>
      </Card>

      <Card hover={false} style={{ padding:"14px 18px" }}>
        {[
          ["Rate",         `1 ${fromAsset.symbol} = ${rate} ${toAsset.symbol}`],
          ["You Pay",      `$${usdCost} USD`],
          ["Price Impact", "< 0.01%"],
          ["Network Fee",  "~$2.40"],
          ["Min. Received",`${toAmount?(parseFloat(toAmount)*0.995).toFixed(6):"0"} ${toAsset.symbol}`],
        ].map(([label,value]) => (
          <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0" }}>
            <span style={{ fontSize:12, color:C.muted }}>{label}</span>
            <span style={{ fontSize:12, color:C.mutedLight, fontWeight:600 }}>{value}</span>
          </div>
        ))}
      </Card>

      {error  && <div style={{ padding:"12px 16px", borderRadius:10, background:`${C.red}15`,   border:`1px solid ${C.red}40`,   color:C.red,   fontSize:13, fontWeight:600 }}>{error}</div>}
      {success && <div style={{ padding:"12px 16px", borderRadius:10, background:`${C.green}15`, border:`1px solid ${C.green}40`, color:C.green, fontSize:13, fontWeight:600 }}>{success}</div>}

      <GoldButton onClick={handleTrade} disabled={loading||!amount} style={{ width:"100%", padding:"16px" }}>
        {loading ? "Processing…" : activeTab==="swap" ? "⇄ Confirm Swap" : activeTab==="buy" ? "Buy Now" : "Sell Now"}
      </GoldButton>
    </div>
  );
}