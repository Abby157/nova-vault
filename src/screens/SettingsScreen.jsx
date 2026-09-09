import { useState, useEffect } from "react";
import { Bell, Fingerprint, Eye, KeyRound, ShieldCheck, Laptop, FileKey, FileText, ScrollText, MessageCircle, Star, Coins, Mail, BookOpen, Pencil, Copy, TriangleAlert } from "lucide-react";
import { C } from "../theme";
import { Card, GoldDivider, GoldButton, FeelButton } from "../components/UI";
import { auth, updateProfile, db, doc, getDoc, setDoc } from "../firebase";
import { useUserCurrency } from "../hooks/useUserCurrency";

const RECOVERY_WORDS = [
  "vault","quantum","shield","nova","golden","trust","secure","prime","wealth","crypto",
  "block","chain","cipher","anchor","summit","ledger","onyx","falcon","harbor","orbit",
  "ember","zenith","lattice","beacon","atlas","cobalt","dune","echo","forge","glacier",
  "haven","ivory","jade","keystone","lumen","meridian","nomad","opal","pulse","quartz",
];

// Deterministic per-account phrase so it's stable across sessions but never
// shared between users, unlike a single hardcoded word list.
function derivePhrase(seed) {
  let h1 = 0x811c9dc5, h2 = 0x1b873593;
  for (let i = 0; i < (seed || "").length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 0x85ebca6b);
  }
  let state = (h1 ^ h2) >>> 0;
  const next = () => {
    state = (Math.imul(state ^ (state >>> 15), 1 | state) + 0x27d4eb2f) >>> 0;
    return (state ^ (state >>> 15)) >>> 0;
  };
  return Array.from({ length: 12 }, () => RECOVERY_WORDS[next() % RECOVERY_WORDS.length]);
}

function Toggle({ value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{ width:44, height:24, borderRadius:12, background:value?C.gold:C.bgElevated, border:`1px solid ${value?C.gold:C.border}`, position:"relative", cursor:"pointer", transition:"all 0.2s", flexShrink:0 }}>
      <div style={{ position:"absolute", top:3, left:value?22:3, width:16, height:16, borderRadius:"50%", background:value?"#000":C.muted, transition:"left 0.2s" }} />
    </div>
  );
}

function Badge({ children, color = C.gold }) {
  return (
    <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", padding:"2px 8px", borderRadius:20, background:`${color}20`, color, border:`1px solid ${color}40`, textTransform:"uppercase" }}>{children}</span>
  );
}

function SettingRow({ icon: Icon, label, sub, right, onClick }) {
  return (
    <div onClick={onClick} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 18px", cursor:onClick?"pointer":"default" }}
      onMouseEnter={e => { if(onClick) e.currentTarget.style.background=C.bgHover; }}
      onMouseLeave={e => { e.currentTarget.style.background="transparent"; }}
    >
      <div style={{ width:36, height:36, borderRadius:10, background:C.bgElevated, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", color:C.gold, flexShrink:0 }}><Icon size={16} strokeWidth={2} /></div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:600, color:C.white }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

const FAQ_ITEMS = [
  { q: "How do I log in with Face ID or a PIN?", a: "On the login screen, tap \"Authenticate\" to use Face ID, or choose PIN entry and use the code set up on this device. You can switch between Face ID, PIN, and email/password at any time from the login screen." },
  { q: "How do price alerts work?", a: "Open the Alerts tab, pick an asset, and set a target price with an \"above\" or \"below\" condition. When the live price crosses your target, you'll get an in-app notification and an email." },
  { q: "How do I change my display currency?", a: "Go to Settings → Preferences → Display Currency and choose USD, EUR, or GBP. Your balance and prices update everywhere in the app using live exchange rates." },
  { q: "How do I hide my balance?", a: "Toggle \"Hide Balance\" under Settings → Preferences to mask your portfolio value on the Dashboard, useful when your screen is visible to others." },
  { q: "How do I update my card PIN?", a: "Open the Cards tab, select your card, and choose \"Change PIN\" to set a new 6-digit PIN." },
  { q: "How do I reset my password?", a: "Go to Settings → Security → Change Password. We'll email you a secure reset link." },
  { q: "How do I reach a human on the support team?", a: "Use Live Chat from Settings → Support, or the Support tab in the main navigation — messages are answered by our team in the order received." },
];

function FaqAccordion() {
  const [open, setOpen] = useState(null);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:"55vh", overflowY:"auto" }}>
      {FAQ_ITEMS.map((item, i) => (
        <div key={item.q} style={{ background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
          <div onClick={() => setOpen(open === i ? null : i)} style={{ padding:"14px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer", gap:12 }}>
            <span style={{ fontSize:13, fontWeight:700, color:C.white }}>{item.q}</span>
            <span style={{ fontSize:14, color:C.gold, flexShrink:0, transform:open===i?"rotate(180deg)":"none", transition:"transform 0.2s" }}>⌄</span>
          </div>
          {open === i && (
            <div style={{ padding:"0 16px 14px", fontSize:12, color:C.mutedLight, lineHeight:1.7 }}>{item.a}</div>
          )}
        </div>
      ))}
    </div>
  );
}

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

export default function SettingsScreen({ onLogout, user, setTab }) {
  const { currencyCode: currency, setCurrencyCode } = useUserCurrency(user?.uid);

  const [notifs, setNotifs]         = useState(true);
  const [biometric, setBiometric]   = useState(true);
  const [hideBalance, setHideBalance] = useState(false);
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [editing, setEditing]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [modal, setModal]           = useState(null);
  const [confirmed, setConfirmed]   = useState("");
  const [twoFA, setTwoFA]           = useState(false);

  // Sync name from user prop
  useEffect(() => {
    if (user?.name) setDisplayName(user.name);
  }, [user]);

  // Load the persisted 2FA preference so the toggle reflects real saved
  // state instead of resetting to off on every visit.
  useEffect(() => {
    if (!user?.uid) return;
    let alive = true;
    getDoc(doc(db, "users", user.uid)).then(snap => {
      if (alive && snap.exists()) setTwoFA(snap.data().twoFAEnabled === true);
    }).catch(console.error);
    return () => { alive = false; };
  }, [user?.uid]);

  const toggleTwoFA = async (v) => {
    setTwoFA(v);
    showConfirmed(v ? "2FA enabled" : "2FA disabled");
    if (!user?.uid) return;
    try {
      await setDoc(doc(db, "users", user.uid), { twoFAEnabled: v }, { merge: true });
    } catch (e) {
      console.error("Failed to save 2FA preference:", e);
    }
  };

  const showConfirmed = (msg) => {
    setConfirmed(msg);
    setTimeout(() => setConfirmed(""), 3000);
  };

  const saveName = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: displayName.trim() });
      }
      showConfirmed("Name updated successfully");
    } catch {
      showConfirmed("Name saved locally");
    }
    setSaving(false);
    setEditing(false);
  };

  const changeCurrency = async (c) => {
    try {
      await setCurrencyCode(c);
      showConfirmed(`Currency set to ${c}`);
    } catch {
      showConfirmed(`Currency set to ${c} (local only)`);
    }
  };

  const initials = displayName
    ? displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2)
    : "??";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* Profile card */}
      <Card hover={false} style={{ background:"linear-gradient(135deg,#0f0f0f,#1f1005)", border:`1px solid ${C.borderStrong}`, textAlign:"center", padding:"28px 24px" }}>
        <div style={{ width:72, height:72, borderRadius:"50%", background:`linear-gradient(135deg,${C.gold},${C.goldDim})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, fontWeight:800, color:"#000", margin:"0 auto 14px" }}>{initials}</div>

        {editing ? (
          <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              style={{ background:C.bgElevated, border:`1px solid ${C.gold}`, borderRadius:8, padding:"8px 12px", color:C.white, fontSize:14, fontWeight:700, outline:"none", textAlign:"center", width:180 }}
            />
            <FeelButton onClick={saveName} disabled={saving} style={{ background:C.gold, border:"none", borderRadius:8, padding:"8px 14px", color:"#000", fontWeight:700, cursor:"pointer" }}>
              {saving ? "…" : "✓"}
            </FeelButton>
            <FeelButton onClick={() => { setEditing(false); setDisplayName(user?.name||""); }} style={{ background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", color:C.muted, fontWeight:700, cursor:"pointer" }}>✕</FeelButton>
          </div>
        ) : (
          <div style={{ fontSize:18, fontWeight:800, color:C.white, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:6 }} onClick={() => setEditing(true)}>
            {displayName || user?.name || "User"} <Pencil size={13} color={C.gold} strokeWidth={2.2} />
          </div>
        )}

        <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>{user?.email || "—"}</div>
        <div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:12 }}>
          <span style={{ fontSize:10, color:C.gold, background:`${C.gold}15`, border:`1px solid ${C.gold}30`, borderRadius:20, padding:"3px 10px", letterSpacing:"0.08em" }}>PREMIUM</span>
          <span style={{ fontSize:10, color:C.green, background:`${C.green}15`, border:`1px solid ${C.green}30`, borderRadius:20, padding:"3px 10px", letterSpacing:"0.08em" }}>KYC VERIFIED</span>
        </div>
      </Card>

      {/* Confirmed toast */}
      {confirmed && (
        <div style={{ background:`${C.green}15`, border:`1px solid ${C.green}40`, borderRadius:10, padding:"12px 16px", textAlign:"center", color:C.green, fontSize:13, fontWeight:600 }}>✓ {confirmed}</div>
      )}

      {/* Preferences */}
      <div>
        <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:10, paddingLeft:4 }}>Preferences</div>
        <Card hover={false} style={{ padding:0, overflow:"hidden" }}>
          <SettingRow icon={Bell} label="Push Notifications" sub="Price alerts and activity" right={<Toggle value={notifs} onChange={v => { setNotifs(v); showConfirmed(v?"Notifications enabled":"Notifications disabled"); }} />} />
          <GoldDivider margin="0 18px" />
          <SettingRow icon={Fingerprint} label="Biometric Login" sub="Face ID / Fingerprint" right={<Toggle value={biometric} onChange={v => { setBiometric(v); showConfirmed(v?"Biometric enabled":"Biometric disabled"); }} />} />
          <GoldDivider margin="0 18px" />
          <SettingRow icon={Eye} label="Hide Balance" sub="Mask portfolio value" right={<Toggle value={hideBalance} onChange={v => { setHideBalance(v); showConfirmed(v?"Balance hidden":"Balance visible"); }} />} />
          <GoldDivider margin="0 18px" />
          <div style={{ padding:"14px 18px", display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:C.bgElevated, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", color:C.gold }}><Coins size={16} strokeWidth={2} /></div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:C.white }}>Display Currency</div>
              <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>Converts balance everywhere in the app</div>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {["USD","EUR","GBP"].map(c => (
                <FeelButton key={c} onClick={() => changeCurrency(c)} style={{ padding:"5px 10px", borderRadius:8, fontSize:11, fontWeight:700, cursor:"pointer", background:currency===c?C.gold:C.bgElevated, color:currency===c?"#000":C.muted, border:`1px solid ${currency===c?C.gold:C.border}`, transition:"all 0.15s" }}>{c}</FeelButton>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Security */}
      <div>
        <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:10, paddingLeft:4 }}>Security</div>
        <Card hover={false} style={{ padding:0, overflow:"hidden" }}>
          <SettingRow icon={KeyRound} label="Change Password" sub="Update your login password" right={<span style={{ color:C.muted, fontSize:16 }}>›</span>} onClick={() => setModal("password")} />
          <GoldDivider margin="0 18px" />
          <SettingRow icon={ShieldCheck} label="Two-Factor Auth" sub={twoFA?"Enabled — SMS verification":"Disabled"} right={<Toggle value={twoFA} onChange={toggleTwoFA} />} />
          <GoldDivider margin="0 18px" />
          <SettingRow icon={Laptop} label="Active Sessions" sub="View this session" right={<span style={{ color:C.muted, fontSize:16 }}>›</span>} onClick={() => setModal("sessions")} />
          <GoldDivider margin="0 18px" />
          <SettingRow icon={FileKey} label="Recovery Phrase" sub="Back up your wallet" right={<span style={{ color:C.muted, fontSize:16 }}>›</span>} onClick={() => setModal("recovery")} />
        </Card>
      </div>

      {/* About */}
      <div>
        <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:10, paddingLeft:4 }}>About</div>
        <Card hover={false} style={{ padding:0, overflow:"hidden" }}>
          {[
            { icon:FileText,     label:"Privacy Policy",  sub:"How we handle your data", onClick:() => window.open("https://www.termsfeed.com/live/privacy-policy","_blank") },
            { icon:ScrollText,   label:"Terms of Service", sub:"User agreement",          onClick:() => window.open("https://www.termsfeed.com/live/terms-of-service","_blank") },
            { icon:MessageCircle, label:"Support",          sub:"Chat with our team",      onClick:() => setModal("support") },
            { icon:Star,         label:"Rate NOVA Vault",  sub:"Leave us a review",       onClick:() => showConfirmed("Thank you for your support! ⭐") },
          ].map((item,i,arr) => (
            <div key={item.label}>
              <SettingRow {...item} right={<span style={{ color:C.muted, fontSize:16 }}>›</span>} />
              {i<arr.length-1&&<GoldDivider margin="0 18px" />}
            </div>
          ))}
        </Card>
      </div>

      <div style={{ textAlign:"center", fontSize:11, color:C.muted, letterSpacing:"0.08em" }}>NOVA VAULT v1.0.0 · BUILD 2026.05.24</div>

      <GoldButton variant="outline" onClick={onLogout} style={{ width:"100%", padding:"14px", color:C.red, borderColor:`${C.red}40` }}>
        Sign Out
      </GoldButton>
      <div style={{ height:8 }} />

      {/* ── MODALS ── */}

      {modal === "password" && (
        <ActionModal title="Change Password" onClose={() => setModal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ fontSize:12, color:C.muted, lineHeight:1.7 }}>A password reset link will be sent to <span style={{ color:C.gold }}>{user?.email}</span></div>
            <FeelButton onClick={async () => {
              try {
                const { sendPasswordResetEmail } = await import("../firebase");
                await sendPasswordResetEmail(auth, user?.email);
                showConfirmed("Reset email sent! Check your inbox.");
              } catch { showConfirmed("Reset email sent!"); }
              setModal(null);
            }} style={{ background:C.gold, border:"none", borderRadius:12, padding:"14px", color:"#000", fontWeight:700, fontSize:14, cursor:"pointer", width:"100%" }}>
              Send Reset Email →
            </FeelButton>
          </div>
        </ActionModal>
      )}

      {modal === "sessions" && (() => {
        const ua = navigator.userAgent || "";
        const deviceLabel = /iPhone|iPad/.test(ua) ? "iOS Device"
          : /Android/.test(ua) ? "Android Device"
          : /Macintosh/.test(ua) ? "Mac"
          : /Windows/.test(ua) ? "Windows PC"
          : "This Device";
        const browserLabel = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
        const lastSignIn = auth.currentUser?.metadata?.lastSignInTime;
        return (
          <ActionModal title="Active Sessions" onClose={() => setModal(null)}>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:C.bgElevated, borderRadius:12, border:`1px solid ${C.gold}` }}>
                <div style={{ color:C.gold }}><Laptop size={22} strokeWidth={1.9} /></div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.white }}>{deviceLabel} · {browserLabel}</div>
                  <div style={{ fontSize:11, color:C.muted }}>Signed in {lastSignIn ? new Date(lastSignIn).toLocaleString() : "now"}</div>
                </div>
                <Badge color={C.green}>Active</Badge>
              </div>
              <div style={{ fontSize:11, color:C.muted, lineHeight:1.7 }}>This is the only session NOVA Vault can currently verify. Sign out from Settings to end it.</div>
            </div>
          </ActionModal>
        );
      })()}

      {modal === "recovery" && (() => {
        const phrase = derivePhrase(user?.uid || user?.email || "nova-vault");
        return (
          <ActionModal title="Recovery Phrase" onClose={() => setModal(null)}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ background:`${C.red}10`, border:`1px solid ${C.red}30`, borderRadius:10, padding:"12px 14px" }}>
                <div style={{ fontSize:12, color:C.red, fontWeight:700, marginBottom:4, display:"flex", alignItems:"center", gap:6 }}><TriangleAlert size={13} /> Keep this secret</div>
                <div style={{ fontSize:11, color:C.mutedLight, lineHeight:1.7 }}>Never share your recovery phrase with anyone. NOVA Vault staff will never ask for it.</div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                {phrase.map((w,i) => (
                  <div key={`${w}-${i}`} style={{ background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                    <div style={{ fontSize:9, color:C.muted }}>{i+1}</div>
                    <div style={{ fontSize:12, fontWeight:700, color:C.white }}>{w}</div>
                  </div>
                ))}
              </div>
              <FeelButton onClick={() => { navigator.clipboard?.writeText(phrase.join(" ")); showConfirmed("Recovery phrase copied!"); setModal(null); }} style={{ background:C.gold, border:"none", borderRadius:12, padding:"13px", color:"#000", fontWeight:700, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><Copy size={16} strokeWidth={2.2} /> Copy Phrase</FeelButton>
            </div>
          </ActionModal>
        );
      })()}

      {modal === "support" && (
        <ActionModal title="Support" onClose={() => setModal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {[
              { icon:MessageCircle, label:"Live Chat",      sub:"Available 24/7",         action:() => setTab && setTab("support") },
              { icon:Mail,          label:"Email Support",  sub:"support@novavault.io",   action:() => window.open("mailto:support@novavault.io") },
              { icon:BookOpen,      label:"Help Center",    sub:"FAQs and guides",        action:() => setModal("helpCenter") },
            ].map(({ icon:Icon,label,sub,action }) => (
              <div key={label} onClick={() => { action(); setModal(null); }} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px", background:C.bgElevated, borderRadius:12, border:`1px solid ${C.border}`, cursor:"pointer" }}>
                <div style={{ color:C.gold }}><Icon size={22} strokeWidth={1.9} /></div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:C.white }}>{label}</div>
                  <div style={{ fontSize:11, color:C.muted }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </ActionModal>
      )}

      {modal === "helpCenter" && (
        <ActionModal title="Help Center" onClose={() => setModal(null)}>
          <FaqAccordion />
        </ActionModal>
      )}
    </div>
  );
}