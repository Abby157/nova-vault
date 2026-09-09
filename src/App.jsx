import { useState, useEffect, lazy, Suspense } from "react";
import { Home, ArrowLeftRight, Repeat, Bell, MessageCircle, ShieldCheck, CreditCard, Lock, Mail } from "lucide-react";
import { C } from "./theme";
import { FeelButton } from "./components/UI";
import { fetchLivePrices, CRYPTO_DATA as FALLBACK } from "./data";
import { sendEmail, Emails } from "./notifications";
import { auth, db, onAuthStateChanged, signOut, doc, getDoc, onSnapshot, collection, query, where, getDocs, updateDoc } from "./firebase";
import LoginScreen       from "./screens/LoginScreen";
import Dashboard         from "./screens/Dashboard";
import { ToastContainer } from "./screens/AlertsScreen";
const LandingScreen     = lazy(() => import("./screens/LandingScreen"));
const SendReceive       = lazy(() => import("./screens/SendReceive"));
const TradeScreen       = lazy(() => import("./screens/TradeScreen"));
const CardsScreen       = lazy(() => import("./screens/CardsScreen"));
const PortfolioScreen   = lazy(() => import("./screens/PortfolioScreen"));
const TransactionScreen = lazy(() => import("./screens/TransactionScreen"));
const AlertsScreen      = lazy(() => import("./screens/AlertsScreen"));
const SettingsScreen    = lazy(() => import("./screens/SettingsScreen"));
const AdminScreen       = lazy(() => import("./screens/AdminScreen"));
const SupportScreen     = lazy(() => import("./screens/SupportScreen"));

const ADMIN_EMAIL = "davehack966@gmail.com";

function NavItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <FeelButton onClick={onClick} rippleColor={`${C.gold}30`} style={{
      display:"flex", flexDirection:"column", alignItems:"center", gap:4,
      background:"none", border:"none", cursor:"pointer",
      color:active ? C.gold : C.muted,
      padding:"8px 4px", borderRadius:12, transition:"all 0.2s",
      minWidth:44, flex:1,
    }}>
      {active && <div style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", width:24, height:2, background:C.gold, borderRadius:2, boxShadow:`0 0 8px ${C.gold}` }} />}
      <div style={{ position:"relative" }}>
        <Icon size={19} strokeWidth={2.2} />
        {badge > 0 && <div style={{ position:"absolute", top:-4, right:-6, width:14, height:14, borderRadius:"50%", background:C.red, display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:800, color:"#fff" }}>{badge}</div>}
      </div>
      <span style={{ fontSize:9, fontWeight:600, letterSpacing:"0.04em" }}>{label}</span>
    </FeelButton>
  );
}

function FrozenScreen({ onLogout }) {
  return (
    <div style={{
      minHeight: "100dvh", width: "100%", maxWidth: 480, margin: "0 auto",
      background: C.bg, color: C.white, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", textAlign: "center",
      padding: "32px 28px", boxSizing: "border-box",
      fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif",
    }}>
      <div style={{ width: 72, height: 72, borderRadius: "50%", background: `${C.red}15`, border: `2px solid ${C.red}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.red, marginBottom: 20 }}>
        <Lock size={30} strokeWidth={1.8} />
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: C.white }}>Account Frozen</div>
      <div style={{ fontSize: 13, color: C.muted, marginTop: 10, lineHeight: 1.7, maxWidth: 320 }}>
        Your NOVA Vault account has been temporarily suspended. For your protection, your balance and account features are hidden until this is resolved.
      </div>
      <div style={{ fontSize: 13, color: C.mutedLight, marginTop: 20, lineHeight: 1.7 }}>
        Please contact support or email us for help.
      </div>
      <a href="mailto:support@novavault.io" style={{ marginTop: 20, width: "100%", textDecoration: "none" }}>
        <FeelButton style={{ width: "100%", padding: "14px", borderRadius: 12, background: C.gold, border: "none", color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Mail size={15} /> Email Support
        </FeelButton>
      </a>
      <FeelButton onClick={onLogout} style={{ marginTop: 12, width: "100%", padding: "14px", borderRadius: 12, background: "none", border: `1px solid ${C.border}`, color: C.muted, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
        Sign Out
      </FeelButton>
    </div>
  );
}

// Screens that show a back arrow and title
const SCREEN_TITLES = {
  send:"Transfer", trade:"Trade", cards:"My Cards",
  portfolio:"Portfolio", history:"History",
  alerts:"Price Alerts", settings:"Settings",
  admin:"Admin Panel", support:"Support Chat",
};

// Fixed logical order used only to decide which direction a tab
// transition should slide in from.
const TAB_ORDER = ["dashboard","send","trade","portfolio","history","alerts","support","cards","admin","settings"];
const tabIndex = (t) => { const i = TAB_ORDER.indexOf(t); return i === -1 ? 0 : i; };

const TAB_TRANSITION_CSS = `
@keyframes tabSlideInRight { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
@keyframes tabSlideInLeft  { from { opacity:0; transform:translateX(-20px); } to { opacity:1; transform:translateX(0); } }
`;

export default function App() {
  const [loggedIn, setLoggedIn]       = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser]               = useState(null);
  const [tab, setTab]                 = useState("dashboard");
  const [prevTab, setPrevTab]         = useState("dashboard");
  const [mounted, setMounted]         = useState(false);
  const [cryptos, setCryptos]         = useState(FALLBACK);
  const [priceStatus, setPriceStatus] = useState("loading");
  const [toasts, setToasts]           = useState([]);
  const [frozen, setFrozen]           = useState(false);

  // Restore session automatically from Firebase Auth on refresh
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let role = "user";
        let adminId = null;

        try {
          const profileSnap = await getDoc(doc(db, "users", firebaseUser.uid));
          if (profileSnap.exists()) {
            const profile = profileSnap.data();
            role = profile.role || "user";
            adminId = profile.adminId || null;
          }

          // The platform owner remains the Super Admin even if an old
          // account predates the new users collection.
          if (firebaseUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
            role = "super_admin";
            adminId = null;
          } else {
            // Partner admins are provisioned by email from the Super Admin.
            // Once they sign in, bind their Firebase Auth UID to the admin
            // profile so subsequent sessions are tied to the same account.
            const adminQ = query(
              collection(db, "admins"),
              where("email", "==", firebaseUser.email?.toLowerCase())
            );
            const adminSnap = await getDocs(adminQ);
            if (!adminSnap.empty) {
              const adminDoc = adminSnap.docs.find(d => d.data().active !== false);
              if (adminDoc) {
                role = "admin";
                adminId = adminDoc.id;
                if (adminDoc.data().authUid !== firebaseUser.uid) {
                  try {
                    await updateDoc(doc(db, "admins", adminDoc.id), {
                      authUid: firebaseUser.uid,
                      lastLoginAt: new Date(),
                    });
                  } catch (bindErr) {
                    console.warn("Could not bind admin account:", bindErr);
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error("Failed to load Nova role:", e);
        }

        setUser({
          name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "",
          email: firebaseUser.email || "",
          uid: firebaseUser.uid,
          role,
          adminId,
        });
        setLoggedIn(true);
      } else {
        setUser(null);
        setLoggedIn(false);
      }
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  // Live-watch this account's frozen status so a freeze takes effect
  // immediately, without waiting for the user to refresh or navigate.
  useEffect(() => {
    if (!loggedIn || !user?.uid) { setFrozen(false); return; }
    const unsub = onSnapshot(doc(db, "wallets", user.uid), snap => {
      setFrozen(snap.exists() && snap.data().frozen === true);
    });
    return () => unsub();
  }, [loggedIn, user?.uid]);

  useEffect(() => {
    if (!loggedIn) return;
    const load = async () => {
      try { const live = await fetchLivePrices(); setCryptos(live); setPriceStatus("live"); }
      catch { setPriceStatus("error"); }
    };
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, [loggedIn]);

  const handleLogin = (u) => {
    setUser(u); setLoggedIn(true);
    if (u?.email) sendEmail(Emails.loginDetected(u));
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Sign out error:", e);
    }
    setTab("dashboard"); setPriceStatus("loading"); setShowLanding(true);
  };

  const goTo = (newTab) => {
    setPrevTab(tab);
    setTab(newTab);
  };

  const goBack = () => {
    setTab(prevTab);
  };

  const dismissToast = (id) => setToasts(p => p.filter(t => t.id !== id));

  if (!authChecked) return (
    <div style={{ minHeight:"100dvh", display:"flex", alignItems:"center", justifyContent:"center", background:"#080808" }}>
      <div style={{ color:C.gold, fontSize:14, letterSpacing:"0.1em" }}>Loading…</div>
    </div>
  );

  if (!loggedIn) {
    if (showLanding) return (
      <Suspense fallback={
        <div style={{ minHeight:"100dvh", display:"flex", alignItems:"center", justifyContent:"center", background:"#080808" }}>
          <div style={{ color:C.gold, fontSize:14, letterSpacing:"0.1em" }}>Loading…</div>
        </div>
      }>
        <LandingScreen onEnter={() => setShowLanding(false)} />
      </Suspense>
    );
    return <LoginScreen onLogin={handleLogin} />;
  }

  const isSuperAdmin = user?.role === "super_admin" || user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const isAdmin = isSuperAdmin || user?.role === "admin";

  // A frozen account sees nothing but this — no balance, no nav, no other
  // screen. Admins are exempt so a frozen admin wallet (shouldn't normally
  // happen) can never lock them out of the panel that unfreezes accounts.
  if (frozen && !isAdmin) return <FrozenScreen onLogout={handleLogout} />;

  const title    = SCREEN_TITLES[tab] || null;
  const initials = user?.name
    ? user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2)
    : (user?.email?.[0]||"U").toUpperCase();

  const NAV_TABS = [
    { id:"dashboard", icon:Home,          label:"Home"     },
    { id:"send",      icon:ArrowLeftRight, label:"Transfer" },
    { id:"trade",     icon:Repeat,        label:"Trade"    },
    { id:"alerts",    icon:Bell,          label:"Alerts"   },
    { id:"support",   icon:MessageCircle, label:"Support"  },
    ...(isAdmin
      ? [{ id:"admin", icon:ShieldCheck, label:"Admin" }]
      : [{ id:"cards", icon:CreditCard,  label:"Cards"  }]
    ),
  ];

  const SCREEN_MAP = {
    dashboard: <Dashboard setTab={goTo} cryptos={cryptos} user={user} />,
    send:      <SendReceive cryptos={cryptos} user={user} />,
    trade:     <TradeScreen cryptos={cryptos} user={user} />,
    cards:     <CardsScreen />,
    portfolio: <PortfolioScreen cryptos={cryptos} />,
    history:   <TransactionScreen />,
    alerts:    <AlertsScreen cryptos={cryptos} toasts={toasts} setToasts={setToasts} user={user} />,
    settings:  <SettingsScreen onLogout={handleLogout} user={user} setTab={goTo} />,
    admin:     <AdminScreen user={user} />,
    support:   <SupportScreen user={user} setTab={goTo} />,
  };

  return (
    <div style={{
      background:C.bg,
      minHeight:"100dvh",
      width:"100%",
      maxWidth:480,
      margin:"0 auto",
      fontFamily:"'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif",
      color:C.white,
      opacity:mounted?1:0,
      transition:"opacity 0.5s",
      position:"relative",
      overflowX:"hidden",
    }}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div style={{
        position:"sticky", top:0, zIndex:100,
        background:"rgba(8,8,8,0.92)", backdropFilter:"blur(20px)",
        padding:"calc(16px + env(safe-area-inset-top)) 20px 12px",
        borderBottom:`1px solid ${C.border}`,
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            {title ? (
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <FeelButton
                  onClick={() => {
                    if (tab === "support" && window.supportChatOpen) {
                      window.supportCloseChat();
                      return;
                    }
                    if (tab === "send" && window.withdrawFlowActive && window.withdrawFlowBack) {
                      const handled = window.withdrawFlowBack();
                      if (handled) return;
                    }
                    goBack();
                  }}
                  rippleColor={`${C.gold}35`}
                  style={{
                    background:"none",
                    border:"none",
                    color:C.gold,
                    fontSize:18,
                    cursor:"pointer",
                    padding:6,
                    margin:-6,
                    borderRadius:8,
                  }}
                >
                  ←
                </FeelButton>
                <span style={{ fontSize:18, fontWeight:800, color:C.white }}>{title}</span>
              </div>
            ) : (
              <>
                <div style={{ fontSize:10, color:C.muted, letterSpacing:"0.15em" }}>WELCOME BACK</div>
                <div style={{ fontSize:18, fontWeight:800 }}>
                  <span style={{ background:`linear-gradient(90deg,${C.gold},${C.goldLight})`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>NOVA</span>
                  <span style={{ color:C.white }}> Vault</span>
                </div>
              </>
            )}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:20, padding:"4px 8px" }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:priceStatus==="live"?C.green:priceStatus==="error"?C.red:C.gold, boxShadow:`0 0 6px ${priceStatus==="live"?C.green:priceStatus==="error"?C.red:C.gold}` }} />
              <span style={{ fontSize:9, color:C.muted, letterSpacing:"0.08em" }}>{priceStatus==="live"?"LIVE":priceStatus==="error"?"OFFLINE":"LOADING"}</span>
            </div>
            <div onClick={() => goTo("settings")} style={{ width:36, height:36, borderRadius:"50%", background:`linear-gradient(135deg,${C.gold},${C.goldDim})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, color:"#000", cursor:"pointer", flexShrink:0 }}>{initials}</div>
          </div>
        </div>
        {!title && user?.name && (
          <div style={{ fontSize:11, color:C.mutedLight, marginTop:4 }}>
            Good {new Date().getHours()<12?"morning":new Date().getHours()<17?"afternoon":"evening"}, {user.name.split(" ")[0]} 👋
          </div>
        )}
      </div>

      {/* Screen */}
      <style>{TAB_TRANSITION_CSS}</style>
      <div style={{ padding:"20px 16px calc(100px + env(safe-area-inset-bottom))", overflowX:"hidden" }}>
        <Suspense fallback={<div style={{ textAlign:"center", padding:"80px 0", color:C.muted, fontSize:13 }}>Loading…</div>}>
          <div key={tab} style={{
            animation: `${tabIndex(tab) >= tabIndex(prevTab) ? "tabSlideInRight" : "tabSlideInLeft"} 0.32s cubic-bezier(0.16,1,0.3,1) both`,
          }}>
            {SCREEN_MAP[tab] || SCREEN_MAP.dashboard}
          </div>
        </Suspense>
      </div>

      {/* Bottom Nav */}
      <div style={{
        position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
        width:"100%", maxWidth:480,
        background:"rgba(8,8,8,0.96)", backdropFilter:"blur(20px)",
        borderTop:`1px solid ${C.border}`,
        display:"flex", justifyContent:"space-around",
        padding:"8px 4px calc(16px + env(safe-area-inset-bottom))",
        zIndex:100,
      }}>
        {NAV_TABS.map(t => (
          <NavItem key={t.id} icon={t.icon} label={t.label} active={tab===t.id} onClick={() => goTo(t.id)} badge={t.id==="alerts"?toasts.length:0} />
        ))}
      </div>
    </div>
  );
}