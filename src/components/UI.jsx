import { useState, useEffect } from "react";
import { C } from "../theme";

const REVEAL_CSS = `
@keyframes uiRevealFadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;
let revealCssInjected = false;

// Staggered fade-up-in wrapper for a block of UI — pass an increasing
// `delay` (seconds) to successive siblings for a cascading entrance.
export function Reveal({ delay = 0, children, style = {} }) {
  if (!revealCssInjected) {
    revealCssInjected = true;
    const tag = document.createElement("style");
    tag.textContent = REVEAL_CSS;
    document.head.appendChild(tag);
  }
  return (
    <div style={{
      opacity: 0,
      animation: `uiRevealFadeUp 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s both`,
      ...style,
    }}>
      {children}
    </div>
  );
}

export function Sparkline({ data, color = C.gold, height = 40, width = 120 }) {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min;
  const pts = data.map((v, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * width : width / 2;
    // A flat/zero-variance series would divide by zero — draw it as a
    // level line through the middle instead of collapsing to NaN.
    const y = range ? height - ((v - min) / range) * height : height / 2;
    return `${x},${y}`;
  }).join(" ");
  const area = `0,${height} ${pts} ${width},${height}`;
  const id = `g${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AnimatedNumber({ value, decimals = 2 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = null;
    const end = parseFloat(value);
    const tick = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1200, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(e * end);
      if (p < 1) requestAnimationFrame(tick);
      else setDisplay(end);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <span>{display.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>;
}

export function GoldDivider({ margin = "0 -24px" }) {
  return <div style={{ height: 1, background: `linear-gradient(90deg,transparent,${C.gold},transparent)`, margin, opacity: 0.18 }} />;
}

export function Badge({ children, color = C.gold }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
      padding: "2px 8px", borderRadius: 20,
      background: `${color}20`, color, border: `1px solid ${color}40`,
      textTransform: "uppercase",
    }}>{children}</span>
  );
}

export function Card({ children, style = {}, onClick, onMouseMove, onMouseLeave }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseMove={onMouseMove}
      onMouseLeave={(e) => { setHov(false); onMouseLeave && onMouseLeave(e); }}
      style={{
        background: hov && onClick ? C.bgHover : C.bgCard,
        border: `1px solid ${hov && onClick ? C.borderStrong : C.border}`,
        borderRadius: 16, padding: 24,
        transition: "all 0.2s",
        cursor: onClick ? "pointer" : "default",
        boxShadow: hov && onClick ? `0 0 30px ${C.goldGlow}` : "none",
        ...style,
      }}
    >{children}</div>
  );
}

const GOLD_BUTTON_CSS = `
@keyframes goldBtnShine {
  from { transform: translateX(-140%) skewX(-20deg); }
  to   { transform: translateX(240%) skewX(-20deg); }
}
@keyframes goldBtnRipple {
  from { transform: scale(0); opacity: 0.45; }
  to   { transform: scale(1); opacity: 0; }
}
@keyframes goldBtnPulse {
  0%, 100% { box-shadow: 0 0 16px ${C.goldGlow}, 0 4px 18px rgba(0,0,0,0.35); }
  50%      { box-shadow: 0 0 34px ${C.goldGlow}, 0 4px 18px rgba(0,0,0,0.35); }
}
`;
let goldBtnCssInjected = false;

export function GoldButton({ children, onClick, variant = "primary", style = {}, disabled = false, pulse = false }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [ripples, setRipples] = useState([]);
  const isPrimary = variant === "primary";

  if (!goldBtnCssInjected) {
    goldBtnCssInjected = true;
    const tag = document.createElement("style");
    tag.textContent = GOLD_BUTTON_CSS;
    document.head.appendChild(tag);
  }

  const spawnRipple = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.8;
    const id = `${Date.now()}-${Math.random()}`;
    setRipples(r => [...r, { id, x: e.clientX - rect.left - size / 2, y: e.clientY - rect.top - size / 2, size }]);
    setTimeout(() => setRipples(r => r.filter(rp => rp.id !== id)), 650);
  };

  const handleClick = (e) => {
    if (disabled) return;
    spawnRipple(e);
    onClick && onClick(e);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        position: "relative", overflow: "hidden", isolation: "isolate",
        background: disabled ? C.bgElevated : isPrimary
          ? hov ? `linear-gradient(135deg,${C.goldLight},${C.gold})` : `linear-gradient(135deg,${C.gold},${C.goldDim})`
          : hov ? C.bgHover : "transparent",
        color: disabled ? C.muted : isPrimary ? "#000" : C.gold,
        border: isPrimary ? "none" : `1px solid ${C.borderStrong}`,
        borderRadius: 12, padding: "12px 24px",
        fontWeight: 700, fontSize: 13, letterSpacing: "0.05em",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.25s ease, box-shadow 0.25s ease, transform 0.15s cubic-bezier(0.34,1.56,0.64,1)",
        transform: pressed && !disabled ? "scale(0.96)" : "scale(1)",
        boxShadow: !isPrimary || disabled
          ? "none"
          : hov
            ? `0 0 26px ${C.goldGlow}, 0 4px 18px rgba(0,0,0,0.35)`
            : pulse
              ? undefined // let the keyframe own box-shadow while idle-pulsing
              : `0 0 0 ${C.goldGlow}, 0 4px 14px rgba(0,0,0,0.3)`,
        animation: isPrimary && !disabled && !hov && pulse ? "goldBtnPulse 2.4s ease-in-out infinite" : "none",
        ...style,
      }}
    >
      <span style={{ position: "relative", zIndex: 2 }}>{children}</span>
      {isPrimary && !disabled && hov && (
        <span style={{
          position: "absolute", top: 0, left: 0, width: "45%", height: "100%",
          background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)",
          animation: "goldBtnShine 1s ease forwards",
          pointerEvents: "none", zIndex: 1,
        }} />
      )}
      {ripples.map(r => (
        <span key={r.id} style={{
          position: "absolute", left: r.x, top: r.y, width: r.size, height: r.size,
          borderRadius: "50%",
          background: isPrimary ? "rgba(0,0,0,0.25)" : `${C.gold}30`,
          animation: "goldBtnRipple 0.6s ease-out forwards",
          pointerEvents: "none", zIndex: 1,
        }} />
      ))}
    </button>
  );
}

// Drop-in replacement for a raw <button> that adds press feedback (scale
// down on click) and a ripple that expands from the exact click point —
// without imposing any visual style of its own. Any existing onClick,
// onMouseDown/Up/Enter/Leave, and style keep working exactly as before;
// this only adds the interaction layer on top, so it's safe to swap in
// anywhere a plain <button> is used.
export function FeelButton({
  children, onClick, onMouseDown, onMouseUp, onMouseEnter, onMouseLeave,
  style = {}, disabled = false, rippleColor, scale = 0.95, ...rest
}) {
  const [pressed, setPressed] = useState(false);
  const [ripples, setRipples] = useState([]);

  if (!goldBtnCssInjected) {
    goldBtnCssInjected = true;
    const tag = document.createElement("style");
    tag.textContent = GOLD_BUTTON_CSS;
    document.head.appendChild(tag);
  }

  const spawnRipple = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.8;
    const id = `${Date.now()}-${Math.random()}`;
    setRipples(r => [...r, { id, x: e.clientX - rect.left - size / 2, y: e.clientY - rect.top - size / 2, size }]);
    setTimeout(() => setRipples(r => r.filter(rp => rp.id !== id)), 600);
  };

  return (
    <button
      {...rest}
      disabled={disabled}
      onClick={(e) => { if (disabled) return; spawnRipple(e); onClick && onClick(e); }}
      onMouseDown={(e) => { setPressed(true); onMouseDown && onMouseDown(e); }}
      onMouseUp={(e) => { setPressed(false); onMouseUp && onMouseUp(e); }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={(e) => { setPressed(false); onMouseLeave && onMouseLeave(e); }}
      style={{
        position: "relative", overflow: "hidden", isolation: "isolate",
        transform: pressed && !disabled ? `scale(${scale})` : "scale(1)",
        transition: `${style.transition ? style.transition + ", " : ""}transform 0.15s cubic-bezier(0.34,1.56,0.64,1)`,
        ...style,
      }}
    >
      {children}
      {ripples.map(r => (
        <span key={r.id} style={{
          position: "absolute", left: r.x, top: r.y, width: r.size, height: r.size,
          borderRadius: "50%",
          background: rippleColor || "rgba(255,255,255,0.3)",
          animation: "goldBtnRipple 0.6s ease-out forwards",
          pointerEvents: "none", zIndex: 0,
        }} />
      ))}
    </button>
  );
}

export function Input({ label, hint, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em" }}>{label}</label>
          {hint && <span style={{ fontSize: 11, color: C.gold }}>{hint}</span>}
        </div>
      )}
      <input
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%", background: C.bgElevated,
          border: `1px solid ${focused ? C.gold : C.border}`,
          borderRadius: 12, padding: "14px 16px",
          color: C.white, fontSize: 14, outline: "none",
          boxSizing: "border-box", transition: "border-color 0.2s",
          boxShadow: focused ? `0 0 0 3px ${C.goldGlow}` : "none",
          ...props.style,
        }}
        {...props}
      />
    </div>
  );
}
