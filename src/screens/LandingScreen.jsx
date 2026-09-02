import { useState, useEffect, Suspense, lazy } from "react";
import { Activity, ShieldCheck, MessageCircle } from "lucide-react";
import { C } from "../theme";
import { GoldButton } from "../components/UI";

const GoldGlassHero = lazy(() => import("../components/GoldGlassHero"));

const FEATURES = [
  { icon: Activity,      label: "Real-Time Markets", sub: "Live prices, always on" },
  { icon: ShieldCheck,   label: "Bank-Grade Security", sub: "Encrypted end to end" },
  { icon: MessageCircle, label: "24/7 Support", sub: "A real team behind it" },
];

// Staggered fade-up-in for text/UI blocks, plus a slow shimmer sweep across
// the gold headline once it has settled in.
const ANIM_CSS = `
@keyframes landingFadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes landingShimmer {
  0%   { background-position: -120% 0; }
  100% { background-position: 220% 0; }
}
`;

function Reveal({ delay = 0, children, style = {} }) {
  return (
    <div style={{
      opacity: 0,
      animation: `landingFadeUp 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s both`,
      ...style,
    }}>
      {children}
    </div>
  );
}

export default function LandingScreen({ onEnter }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setTimeout(() => setMounted(true), 60); }, []);

  return (
    <div style={{
      minHeight: "100dvh", width: "100%", maxWidth: 480, margin: "0 auto",
      background: C.bg, color: C.white, position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column",
      fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif",
      opacity: mounted ? 1 : 0, transition: "opacity 0.4s ease",
    }}>
      <style>{ANIM_CSS}</style>

      {/* Header */}
      <Reveal delay={0.05} style={{ padding: "calc(20px + env(safe-area-inset-top)) 24px 0", textAlign: "center" }}>
        <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "0.01em" }}>
          <span style={{
            fontFamily: "'Playfair Display', 'SF Pro Display', Georgia, serif",
            backgroundImage: `linear-gradient(100deg, ${C.gold} 30%, ${C.goldLight} 45%, #fff 50%, ${C.goldLight} 55%, ${C.gold} 70%)`,
            backgroundSize: "300% 100%",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            animation: "landingShimmer 4.5s ease-in-out 1s infinite",
          }}>NOVA</span>
          <span style={{ color: C.white, fontSize: 18, letterSpacing: "0.04em" }}> Vault</span>
        </div>
      </Reveal>

      {/* 3D Hero */}
      <Reveal delay={0.15} style={{ padding: "16px 16px 0" }}>
        <Suspense fallback={
          <div style={{ width: "100%", height: 340, borderRadius: 24, background: C.bgElevated, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 12, letterSpacing: "0.1em" }}>
            LOADING…
          </div>
        }>
          <GoldGlassHero height={340} />
        </Suspense>
      </Reveal>

      {/* Copy */}
      <div style={{ padding: "24px 28px 0", textAlign: "center" }}>
        <Reveal delay={0.35}>
          <div style={{
            fontSize: 26, fontWeight: 800, lineHeight: 1.25, letterSpacing: "-0.01em",
            backgroundImage: `linear-gradient(100deg, ${C.white} 40%, ${C.goldLight} 50%, ${C.white} 60%)`,
            backgroundSize: "300% 100%",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            animation: "landingShimmer 5s ease-in-out 1.2s infinite",
          }}>
            Premium crypto banking,<br />reimagined.
          </div>
        </Reveal>
        <Reveal delay={0.48} style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, maxWidth: 340, margin: "0 auto" }}>
            Track markets, move funds, and manage your portfolio — all in one dark, ember-toned vault built for people who take crypto seriously.
          </div>
        </Reveal>
      </div>

      {/* Features */}
      <div style={{ display: "flex", justifyContent: "center", gap: 10, padding: "28px 20px 0" }}>
        {FEATURES.map((f, i) => (
          <Reveal key={f.label} delay={0.6 + i * 0.1} style={{ flex: 1, maxWidth: 130 }}>
            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 10px", textAlign: "center" }}>
              <div style={{ color: C.gold, display: "flex", justifyContent: "center" }}><f.icon size={18} strokeWidth={2} /></div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.white, marginTop: 6 }}>{f.label}</div>
              <div style={{ fontSize: 9.5, color: C.muted, marginTop: 3, lineHeight: 1.4 }}>{f.sub}</div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* CTA */}
      <Reveal delay={0.95} style={{ marginTop: "auto", padding: "28px 24px calc(28px + env(safe-area-inset-bottom))" }}>
        <GoldButton onClick={onEnter} pulse style={{ width: "100%", padding: "16px", fontSize: 15 }}>
          Get Started →
        </GoldButton>
        <div style={{ textAlign: "center", fontSize: 10, color: C.muted, marginTop: 14, letterSpacing: "0.06em" }}>
          NOVA VAULT · YOUR VAULT, YOUR CONTROL
        </div>
      </Reveal>
    </div>
  );
}
