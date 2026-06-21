import { useState, useEffect } from "react";
import { C } from "./theme";
import { fetchLivePrices, CRYPTO_DATA as FALLBACK } from "./data";
import { ToastContainer } from "./screens/AlertsScreen";
import { sendEmail, Emails } from "./notifications";
import { auth, onAuthStateChanged, signOut } from "./firebase";
import LoginScreen       from "./screens/LoginScreen";
import Dashboard         from "./screens/Dashboard";
import SendReceive       from "./screens/SendReceive";
import TradeScreen       from "./screens/TradeScreen";
import CardsScreen       from "./screens/CardsScreen";
import PortfolioScreen   from "./screens/PortfolioScreen";
import TransactionScreen from "./screens/TransactionScreen";
import AlertsScreen      from "./screens/AlertsScreen";
import SettingsScreen    from "./screens/SettingsScreen";
import AdminScreen       from "./screens/AdminScreen";
import SupportScreen     from "./screens/SupportScreen";

const ADMIN_EMAIL = "davehack966@gmail.com";

function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick} style={{
      display:"flex", flexDirection:"column", alignItems:"center", gap:4,
      background:"none", border:"none", cursor:"pointer",
      color:active ? C.gold : C.muted,
      padding:"8px 4px", borderRadius:12, transition:"all 0.2s",
      position:"relative", minWidth:44, flex:1,
    }}>
      {active && <div style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", width:24, height:2, background:C.gold, borderRadius:2, boxShadow:`0 0 8px ${C.gold}` }} />}
      <div style={{ position:"relative" }}>
        <span style={{ fontSize:18 }}>{icon}</span>
        {badge > 0 && <div style={{ position:"absolute", top:-4, right:-6, width:14, height:14, borderRadius:"50%", background:C.red, display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:800, color:"#fff" }}>{badge}</div>}
      </div>
      <span style={{ fontSize:9, fontWeight:600, letterSpacing:"0.04em" }}>{label}</span>
    </button>
  );
}

// Screens that show a back arrow and title
const SCREEN_TITLES = {
  send:"Transfer", trade:"Trade", cards:"My Cards",
  portfolio:"Portfolio", history:"History",
  alerts:"Price Alerts", settings:"Settings",
  admin:"Admin Panel", support:"Support Chat",
};

export default function App() {
  const [loggedIn, setLoggedIn]       = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser]               = useState(null);
  const [tab, setTab]                 = useState("dashboard");
  const [prevTab, setPrevTab]         = useState("dashboard");
  const [mounted, setMounted]         = useState(false);
  const [cryptos, setCryptos]         = useState(FALLBACK);
  const [priceStatus, setPriceStatus] = useState("loading");
  const [toasts, setToasts]           = useState([]);

  // Restore session automatically from Firebase Auth on refresh
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          name: firebaseUser.displayName || "",
          email: firebaseUser.email || "",
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
    setTab("dashboard"); setPriceStatus("loading");
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
      <div style={{ color:"#C9A84C", fontSize:14, letterSpacing:"0.1em" }}>Loading…</div>
    </div>
  );

  if (!loggedIn) return <LoginScreen onLogin={handleLogin} />;

  const isAdmin  = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const title    = SCREEN_TITLES[tab] || null;
  const initials = user?.name
    ? user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2)
    : (user?.email?.[0]||"U").toUpperCase();

  const NAV_TABS = [
    { id:"dashboard", icon:"⬡", label:"Home"     },
    { id:"send",      icon:"⇄", label:"Transfer" },
    { id:"trade",     icon:"◈", label:"Trade"    },
    { id:"alerts",    icon:"🔔", label:"Alerts"   },
    { id:"support",   icon:"💬", label:"Support"  },
    ...(isAdmin
      ? [{ id:"admin", icon:"⚙️", label:"Admin" }]
      : [{ id:"cards", icon:"▣", label:"Cards"  }]
    ),
  ];

  const SCREEN_MAP = {
    dashboard: <Dashboard setTab={goTo} cryptos={cryptos} user={user} />,
    send:      <SendReceive cryptos={cryptos} user={user} />,
    trade:     <TradeScreen cryptos={cryptos} />,
    cards:     <CardsScreen />,
    portfolio: <PortfolioScreen cryptos={cryptos} />,
    history:   <TransactionScreen />,
    alerts:    <AlertsScreen cryptos={cryptos} toasts={toasts} setToasts={setToasts} user={user} />,
    settings:  <SettingsScreen onLogout={handleLogout} user={user} />,
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
                <button
                  onClick={() => {
                    if (tab === "support" && window.supportChatOpen) {
                      window.supportCloseChat();
                      return;
                    }
                    goBack();
                  }}
                  style={{
                    background:"none",
                    border:"none",
                    color:C.gold,
                    fontSize:18,
                    cursor:"pointer",
                    padding:0,
                  }}
                >
                  ←
                </button>
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
      <div style={{ padding:"20px 16px calc(100px + env(safe-area-inset-bottom))" }}>
        {SCREEN_MAP[tab] || SCREEN_MAP.dashboard}
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