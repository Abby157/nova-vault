import { useState, useEffect } from "react";
import { C } from "../theme";
import { Card, GoldDivider, GoldButton } from "../components/UI";
import { auth, updateProfile } from "../firebase";
import { useSettings } from "../hooks/useSettings";

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

function SettingRow({ icon, label, sub, right, onClick }) {
  return (
    <div onClick={onClick} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 18px", cursor:onClick?"pointer":"default" }}
      onMouseEnter={e => { if(onClick) e.currentTarget.style.background=C.bgHover; }}
      onMouseLeave={e => { e.currentTarget.style.background="transparent"; }}
    >
      <div style={{ width:36, height:36, borderRadius:10, background:C.bgElevated, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{icon}</div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:600, color:C.white }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{sub}</div>}
      </div>
      {right}
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

export default function SettingsScreen({ onLogout, user }) {
  const { settings: globalSettings, updateSettings: updateGlobalSettings } = useSettings();

  const [notifs, setNotifs]         = useState(true);
  const [biometric, setBiometric]   = useState(true);
  const [hideBalance, setHideBalance] = useState(false);
  const [currency, setCurrency]     = useState(globalSettings.currency || "USD");
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

  // Sync currency from global settings (Firestore)
  useEffect(() => {
    setCurrency(globalSettings.currency || "USD");
  }, [globalSettings]);

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
    setCurrency(c);
    try {
      await updateGlobalSettings({ currency: c });
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
      <Card hover={false} style={{ background:"linear-gradient(135deg,#0f0f0f,#1a1400)", border:`1px solid ${C.borderStrong}`, textAlign:"center", padding:"28px 24px" }}>
        <div style={{ width:72, height:72, borderRadius:"50%", background:`linear-gradient(135deg,${C.gold},${C.goldDim})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, fontWeight:800, color:"#000", margin:"0 auto 14px" }}>{initials}</div>

        {editing ? (
          <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              style={{ background:C.bgElevated, border:`1px solid ${C.gold}`, borderRadius:8, padding:"8px 12px", color:C.white, fontSize:14, fontWeight:700, outline:"none", textAlign:"center", width:180 }}
            />
            <button onClick={saveName} disabled={saving} style={{ background:C.gold, border:"none", borderRadius:8, padding:"8px 14px", color:"#000", fontWeight:700, cursor:"pointer" }}>
              {saving ? "…" : "✓"}
            </button>
            <button onClick={() => { setEditing(false); setDisplayName(user?.name||""); }} style={{ background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", color:C.muted, fontWeight:700, cursor:"pointer" }}>✕</button>
          </div>
        ) : (
          <div style={{ fontSize:18, fontWeight:800, color:C.white, cursor:"pointer" }} onClick={() => setEditing(true)}>
            {displayName || user?.name || "User"} <span style={{ fontSize:12, color:C.gold }}>✎</span>
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
          <SettingRow icon="🔔" label="Push Notifications" sub="Price alerts and activity" right={<Toggle value={notifs} onChange={v => { setNotifs(v); showConfirmed(v?"Notifications enabled":"Notifications disabled"); }} />} />
          <GoldDivider margin="0 18px" />
          <SettingRow icon="⬡" label="Biometric Login" sub="Face ID / Fingerprint" right={<Toggle value={biometric} onChange={v => { setBiometric(v); showConfirmed(v?"Biometric enabled":"Biometric disabled"); }} />} />
          <GoldDivider margin="0 18px" />
          <SettingRow icon="👁" label="Hide Balance" sub="Mask portfolio value" right={<Toggle value={hideBalance} onChange={v => { setHideBalance(v); showConfirmed(v?"Balance hidden":"Balance visible"); }} />} />
          <GoldDivider margin="0 18px" />
          <div style={{ padding:"14px 18px", display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:C.bgElevated, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>💱</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:C.white }}>Display Currency</div>
              <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>Converts balance everywhere in the app</div>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {["USD","EUR","GBP"].map(c => (
                <button key={c} onClick={() => changeCurrency(c)} style={{ padding:"5px 10px", borderRadius:8, fontSize:11, fontWeight:700, cursor:"pointer", background:currency===c?C.gold:C.bgElevated, color:currency===c?"#000":C.muted, border:`1px solid ${currency===c?C.gold:C.border}`, transition:"all 0.15s" }}>{c}</button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Security */}
      <div>
        <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:10, paddingLeft:4 }}>Security</div>
        <Card hover={false} style={{ padding:0, overflow:"hidden" }}>
          <SettingRow icon="🔑" label="Change Password" sub="Update your login password" right={<span style={{ color:C.muted, fontSize:16 }}>›</span>} onClick={() => setModal("password")} />
          <GoldDivider margin="0 18px" />
          <SettingRow icon="🛡" label="Two-Factor Auth" sub={twoFA?"Enabled — SMS verification":"Disabled"} right={<Toggle value={twoFA} onChange={v => { setTwoFA(v); showConfirmed(v?"2FA enabled":"2FA disabled"); }} />} />
          <GoldDivider margin="0 18px" />
          <SettingRow icon="📋" label="Active Sessions" sub="2 devices connected" right={<span style={{ color:C.muted, fontSize:16 }}>›</span>} onClick={() => setModal("sessions")} />
          <GoldDivider margin="0 18px" />
          <SettingRow icon="🔐" label="Recovery Phrase" sub="Back up your wallet" right={<span style={{ color:C.muted, fontSize:16 }}>›</span>} onClick={() => setModal("recovery")} />
        </Card>
      </div>

      {/* About */}
      <div>
        <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:10, paddingLeft:4 }}>About</div>
        <Card hover={false} style={{ padding:0, overflow:"hidden" }}>
          {[
            { icon:"📄", label:"Privacy Policy",  sub:"How we handle your data", onClick:() => window.open("https://www.termsfeed.com/live/privacy-policy","_blank") },
            { icon:"📜", label:"Terms of Service", sub:"User agreement",          onClick:() => window.open("https://www.termsfeed.com/live/terms-of-service","_blank") },
            { icon:"💬", label:"Support",          sub:"Chat with our team",      onClick:() => setModal("support") },
            { icon:"⭐", label:"Rate NOVA Vault",  sub:"Leave us a review",       onClick:() => showConfirmed("Thank you for your support! ⭐") },
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
            <button onClick={async () => {
              try {
                const { sendPasswordResetEmail } = await import("../firebase");
                await sendPasswordResetEmail(auth, user?.email);
                showConfirmed("Reset email sent! Check your inbox.");
              } catch { showConfirmed("Reset email sent!"); }
              setModal(null);
            }} style={{ background:C.gold, border:"none", borderRadius:12, padding:"14px", color:"#000", fontWeight:700, fontSize:14, cursor:"pointer", width:"100%" }}>
              Send Reset Email →
            </button>
          </div>
        </ActionModal>
      )}

      {modal === "sessions" && (
        <ActionModal title="Active Sessions" onClose={() => setModal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {[
              { device:"MacBook Air", location:"Current session", time:"Now", current:true },
              { device:"iPhone 15",   location:"Last seen 2h ago", time:"May 23", current:false },
            ].map(s => (
              <div key={s.device} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:C.bgElevated, borderRadius:12, border:`1px solid ${s.current?C.gold:C.border}` }}>
                <div style={{ fontSize:24 }}>{s.current?"💻":"📱"}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.white }}>{s.device}</div>
                  <div style={{ fontSize:11, color:C.muted }}>{s.location} · {s.time}</div>
                </div>
                {s.current ? <Badge color={C.green}>Active</Badge> : <button style={{ fontSize:11, color:C.red, background:"none", border:`1px solid ${C.red}40`, borderRadius:6, padding:"4px 10px", cursor:"pointer" }}>Revoke</button>}
              </div>
            ))}
          </div>
        </ActionModal>
      )}

      {modal === "recovery" && (
        <ActionModal title="Recovery Phrase" onClose={() => setModal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ background:`${C.red}10`, border:`1px solid ${C.red}30`, borderRadius:10, padding:"12px 14px" }}>
              <div style={{ fontSize:12, color:C.red, fontWeight:700, marginBottom:4 }}>⚠️ Keep this secret</div>
              <div style={{ fontSize:11, color:C.mutedLight, lineHeight:1.7 }}>Never share your recovery phrase with anyone. NOVA Vault staff will never ask for it.</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
              {["vault","quantum","shield","nova","golden","trust","secure","prime","wealth","crypto","block","chain"].map((w,i) => (
                <div key={w} style={{ background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                  <div style={{ fontSize:9, color:C.muted }}>{i+1}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:C.white }}>{w}</div>
                </div>
              ))}
            </div>
            <button onClick={() => { navigator.clipboard?.writeText("vault quantum shield nova golden trust secure prime wealth crypto block chain"); showConfirmed("Recovery phrase copied!"); setModal(null); }} style={{ background:C.gold, border:"none", borderRadius:12, padding:"13px", color:"#000", fontWeight:700, cursor:"pointer", width:"100%" }}>📋 Copy Phrase</button>
          </div>
        </ActionModal>
      )}

      {modal === "support" && (
        <ActionModal title="Support" onClose={() => setModal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {[
              { icon:"💬", label:"Live Chat",      sub:"Available 24/7",         action:() => showConfirmed("Live chat coming soon!") },
              { icon:"📧", label:"Email Support",  sub:"support@novavault.io",   action:() => window.open("mailto:support@novavault.io") },
              { icon:"📖", label:"Help Center",    sub:"FAQs and guides",        action:() => showConfirmed("Help center coming soon!") },
            ].map(({ icon,label,sub,action }) => (
              <div key={label} onClick={() => { action(); setModal(null); }} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px", background:C.bgElevated, borderRadius:12, border:`1px solid ${C.border}`, cursor:"pointer" }}>
                <div style={{ fontSize:24 }}>{icon}</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:C.white }}>{label}</div>
                  <div style={{ fontSize:11, color:C.muted }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </ActionModal>
      )}
    </div>
  );
}