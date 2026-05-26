import { useState, useEffect } from "react";
import { C } from "../theme";
import { GoldButton, Input } from "../components/UI";
import { sendEmail, Emails } from "../notifications";
import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from "../firebase";

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i, x: Math.random() * 100, y: Math.random() * 100,
  size: Math.random() * 2 + 1, dur: Math.random() * 6 + 4, delay: Math.random() * 4,
}));

function Particles() {
  return PARTICLES.map(p => (
    <div key={p.id} style={{ position:"absolute", left:`${p.x}%`, top:`${p.y}%`, width:p.size, height:p.size, borderRadius:"50%", background:C.gold, opacity:0.15, pointerEvents:"none", animation:`float-p ${p.dur}s ease-in-out ${p.delay}s infinite alternate` }} />
  ));
}

function CSS() {
  return (
    <style>{`
      @keyframes float-p{from{transform:translateY(0);opacity:0.1}to{transform:translateY(-20px);opacity:0.3}}
      @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
      @keyframes fadeSlideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
      @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
    `}</style>
  );
}

function Spinner() {
  return <div style={{ width:16, height:16, border:`2px solid #00000040`, borderTop:`2px solid #000`, borderRadius:"50%", animation:"spin 0.8s linear infinite", display:"inline-block", marginRight:8, verticalAlign:"middle" }} />;
}

const friendlyError = (code) => {
  switch(code) {
    case "auth/user-not-found":       return "No account found with this email. Please register first.";
    case "auth/wrong-password":       return "Incorrect password. Try again or reset your password.";
    case "auth/invalid-credential":   return "Incorrect email or password. Check and try again.";
    case "auth/email-already-in-use": return "This email is already registered. Please sign in.";
    case "auth/weak-password":        return "Password must be at least 6 characters.";
    case "auth/invalid-email":        return "Please enter a valid email address.";
    case "auth/too-many-requests":    return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed": return "Network error. Check your connection and try again.";
    default:                          return "Something went wrong. Please try again.";
  }
};

export default function LoginScreen({ onLogin }) {
  const [screen, setScreen]           = useState("login");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [name, setName]               = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [success, setSuccess]         = useState(false);
  const [error, setError]             = useState("");
  const [shake, setShake]             = useState(false);
  const [visible, setVisible]         = useState(false);
  const [loading, setLoading]         = useState(false);
  const [resetEmail, setResetEmail]   = useState("");
  const [resetSent, setResetSent]     = useState(false);

  useEffect(() => { setTimeout(() => setVisible(true), 80); }, []);

  const triggerError = (msg) => {
    setError(msg); setShake(true);
    setTimeout(() => setShake(false), 500);
    setTimeout(() => setError(""), 4000);
  };

  const reset = () => { setError(""); setSuccess(false); setLoading(false); };

  const handleLogin = async () => {
    if (!email || !password) { triggerError("Please fill all fields."); return; }
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = { name: result.user.displayName || email.split("@")[0], email: result.user.email, uid: result.user.uid };
      setSuccess(true);
      sendEmail(Emails.loginDetected(user));
      setTimeout(() => onLogin(user), 700);
    } catch(err) { setLoading(false); triggerError(friendlyError(err.code)); }
  };

  const handleRegister = async () => {
    if (!name.trim())   { triggerError("Please enter your full name."); return; }
    if (!email.trim())  { triggerError("Please enter your email."); return; }
    if (!password)      { triggerError("Please enter a password."); return; }
    if (password.length < 6) { triggerError("Password must be at least 6 characters."); return; }
    if (password !== confirmPass) { triggerError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(result.user, { displayName: name.trim() });
      const user = { name: name.trim(), email: email.trim(), uid: result.user.uid };
      setSuccess(true);
      sendEmail(Emails.welcomeEmail(user));
      setTimeout(() => onLogin(user), 700);
    } catch(err) { setLoading(false); triggerError(friendlyError(err.code)); }
  };

  const handleForgot = async () => {
    if (!resetEmail) { triggerError("Enter your email address."); return; }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetSent(true); setLoading(false);
    } catch(err) { setLoading(false); triggerError(friendlyError(err.code)); }
  };

  const pageStyle = {
    minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center",
    justifyContent:"center", padding:"32px 16px", position:"relative",
    overflow:"hidden", opacity:visible?1:0, transition:"opacity 0.5s",
  };

  const cardStyle = {
    width:"100%", maxWidth:400, display:"flex", flexDirection:"column",
    alignItems:"center", position:"relative", zIndex:1,
    animation:"fadeSlideUp 0.5s ease both",
  };

  const Logo = ({ sub }) => (
    <div style={{ textAlign:"center", marginBottom:28 }}>
      <div style={{ fontSize:52, fontWeight:900, letterSpacing:"-0.02em", lineHeight:1, background:`linear-gradient(135deg,${C.gold},${C.goldLight},${C.gold})`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>NOVA</div>
      <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.3em", marginTop:2 }}>{sub}</div>
    </div>
  );

  const ErrorBox = () => error ? (
    <div style={{ marginTop:14, padding:"12px 16px", borderRadius:10, background:`${C.red}15`, border:`1px solid ${C.red}40`, color:C.red, fontSize:13, textAlign:"center", fontWeight:600, width:"100%" }}>{error}</div>
  ) : null;

  // ── FORGOT PASSWORD ──
  if (screen === "forgot") return (
    <div style={pageStyle}>
      <Particles />
      <div style={{ ...cardStyle, gap:20 }}>
        <Logo sub="RESET PASSWORD" />
        {!resetSent ? (
          <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:14 }}>
            <p style={{ fontSize:13, color:C.mutedLight, textAlign:"center", margin:0, lineHeight:1.7 }}>
              Enter your email and we'll send a password reset link instantly.
            </p>
            <Input label="EMAIL ADDRESS" type="email" placeholder="alex@novavault.io" value={resetEmail} onChange={e=>setResetEmail(e.target.value)} />
            <GoldButton onClick={handleForgot} disabled={loading} style={{ width:"100%", padding:"15px" }}>
              {loading ? <><Spinner />Sending…</> : "Send Reset Link →"}
            </GoldButton>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16, width:"100%" }}>
            <div style={{ width:64, height:64, borderRadius:"50%", background:`${C.green}15`, border:`2px solid ${C.green}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>📧</div>
            <div style={{ fontSize:18, fontWeight:700, color:C.white }}>Reset Email Sent!</div>
            <div style={{ fontSize:13, color:C.muted, textAlign:"center", lineHeight:1.7 }}>
              Check your inbox at <span style={{ color:C.gold }}>{resetEmail}</span> and click the reset link.
            </div>
            <GoldButton onClick={()=>{ setScreen("login"); setResetSent(false); setResetEmail(""); reset(); }} style={{ width:"100%", padding:"15px" }}>
              Back to Sign In →
            </GoldButton>
          </div>
        )}
        <ErrorBox />
        {!resetSent && <span onClick={()=>{ setScreen("login"); reset(); }} style={{ fontSize:12, color:C.gold, cursor:"pointer", marginTop:8 }}>← Back to Login</span>}
      </div>
      <CSS />
    </div>
  );

  // ── REGISTER ──
  if (screen === "register") return (
    <div style={pageStyle}>
      <Particles />
      <div style={{ ...cardStyle, gap:0 }}>
        <Logo sub="CREATE ACCOUNT" />
        <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:14, animation:shake?"shake 0.4s ease":"none" }}>
          <Input label="FULL NAME" placeholder="Alex Kim" value={name} onChange={e=>setName(e.target.value)} />
          <Input label="EMAIL ADDRESS" type="email" placeholder="alex@novavault.io" value={email} onChange={e=>setEmail(e.target.value)} />
          <Input label="PASSWORD" type="password" placeholder="Min. 6 characters" value={password} onChange={e=>setPassword(e.target.value)} />
          <Input label="CONFIRM PASSWORD" type="password" placeholder="Repeat password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} />
          <div style={{ background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 16px" }}>
            <div style={{ fontSize:11, color:C.muted, lineHeight:1.6 }}>
              By creating an account you agree to our{" "}
              <span style={{ color:C.gold, cursor:"pointer" }}>Terms of Service</span>{" "}and{" "}
              <span style={{ color:C.gold, cursor:"pointer" }}>Privacy Policy</span>
            </div>
          </div>
          <GoldButton onClick={handleRegister} disabled={loading} style={{ width:"100%", padding:"15px" }}>
            {loading ? <><Spinner />Creating account…</> : success ? "✓ Done!" : "Create Account →"}
          </GoldButton>
          <ErrorBox />
        </div>
        <div style={{ marginTop:20, fontSize:13, color:C.muted }}>
          Already have an account?{" "}
          <span onClick={()=>{ setScreen("login"); reset(); setEmail(""); setPassword(""); }} style={{ color:C.gold, cursor:"pointer", fontWeight:700 }}>Sign In</span>
        </div>
      </div>
      <CSS />
    </div>
  );

  // ── MAIN LOGIN — Email only, no biometrics ──
  return (
    <div style={pageStyle}>
      <Particles />
      <div style={{ position:"absolute", top:"15%", left:"50%", transform:"translateX(-50%)", width:420, height:420, borderRadius:"50%", background:`radial-gradient(circle,${C.goldGlow},transparent 70%)`, pointerEvents:"none" }} />
      <div style={cardStyle}>
        <Logo sub="VAULT · PRIVATE BANKING" />

        <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:14, animation:shake?"shake 0.4s ease":"none" }}>
          <Input label="EMAIL ADDRESS" type="email" placeholder="alex@novavault.io" value={email} onChange={e=>setEmail(e.target.value)} />
          <Input label="PASSWORD" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} />
          <div style={{ textAlign:"right", marginTop:-4 }}>
            <span onClick={()=>{ setScreen("forgot"); reset(); }} style={{ fontSize:12, color:C.gold, cursor:"pointer", fontWeight:600 }}>Forgot password?</span>
          </div>
          <GoldButton onClick={handleLogin} disabled={loading} style={{ width:"100%", padding:"15px" }}>
            {loading ? <><Spinner />Signing in…</> : success ? "✓ Welcome back!" : "Sign In →"}
          </GoldButton>
          <div style={{ textAlign:"center", fontSize:13, color:C.muted }}>
            Don't have an account?{" "}
            <span onClick={()=>{ setScreen("register"); reset(); setEmail(""); setPassword(""); }} style={{ color:C.gold, cursor:"pointer", fontWeight:700 }}>Create Account</span>
          </div>
          <ErrorBox />
        </div>

        <div style={{ marginTop:36, fontSize:10, color:C.muted, letterSpacing:"0.12em" }}>
          NOVA VAULT · SECURED BY 256-BIT AES
        </div>
      </div>
      <CSS />
    </div>
  );
}