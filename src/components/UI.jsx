import { useState, useEffect } from "react";
import { C } from "../theme";

export function Sparkline({ data, color = C.gold, height = 40, width = 120 }) {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / (max - min)) * height;
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

export function Card({ children, style = {}, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
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

export function GoldButton({ children, onClick, variant = "primary", style = {}, disabled = false }) {
  const [hov, setHov] = useState(false);
  const isPrimary = variant === "primary";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: disabled ? C.bgElevated : isPrimary
          ? hov ? `linear-gradient(135deg,${C.goldLight},${C.gold})` : `linear-gradient(135deg,${C.gold},${C.goldDim})`
          : hov ? C.bgHover : "transparent",
        color: disabled ? C.muted : isPrimary ? "#000" : C.gold,
        border: isPrimary ? "none" : `1px solid ${C.borderStrong}`,
        borderRadius: 12, padding: "12px 24px",
        fontWeight: 700, fontSize: 13, letterSpacing: "0.05em",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.2s",
        boxShadow: isPrimary && hov && !disabled ? `0 0 20px ${C.goldGlow}` : "none",
        ...style,
      }}
    >{children}</button>
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
