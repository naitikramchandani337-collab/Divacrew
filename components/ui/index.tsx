"use client";

import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import type { Girl } from "@/lib/data";

/* ── Avatar ── */
export function Avatar({
  girl, size = 42, ring = false, status,
}: {
  girl: Girl; size?: number; ring?: boolean; status?: "good" | "check" | "help";
}) {
  const statusColor =
    status === "good" ? "#87a97f" : status === "check" ? "#e9b44c" : status === "help" ? "#be4560" : undefined;
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span
        className="flex items-center justify-center rounded-full text-white font-bold select-none"
        style={{
          width: size, height: size,
          background: girl.grad,
          fontSize: size * 0.42,
          boxShadow: ring ? "0 0 0 2px #fff, 0 0 0 4px #e398b8" : "0 4px 10px -4px rgba(154,59,99,.5)",
          fontStyle: "italic",
          fontFamily: "var(--font-display)",
        }}
      >
        {girl.name[0]}
      </span>
      {statusColor && (
        <span
          className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white"
          style={{ width: size * 0.32, height: size * 0.32, background: statusColor }}
        />
      )}
    </span>
  );
}

/* ── Bow ── */
export function Bow({ className = "", color = "#c25783" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 64 44" fill="none" className={className} aria-hidden>
      <path d="M32 22C26 10 12 6 6 12c-5 5-3 16 4 19 8 3 18-3 22-9Zm0 0c6-12 20-16 26-10 5 5 3 16-4 19-8 3-18-3-22-9Z" fill={color} />
      <circle cx="32" cy="22" r="6.5" fill="#9a3b63" />
      <path d="M29 27c-2 6-6 11-10 13l4 2c5-2 8-7 9-12" fill={color} opacity=".75" />
      <path d="M35 27c2 6 6 11 10 13l-4 2c-5-2-8-7-9-12" fill={color} opacity=".75" />
    </svg>
  );
}

/* ── SparkleStar ── */
export function SparkleStar({ className = "", color = "#e398b8" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 2c.8 4.6 3.4 7.2 8 8-4.6.8-7.2 3.4-8 8-.8-4.6-3.4-7.2-8-8 4.6-.8 7.2-3.4 8-8Z" fill={color} />
    </svg>
  );
}

/* ── Tape ── */
export function Tape({ className = "", rotate = -6 }: { className?: string; rotate?: number }) {
  return <span className={`dc-tape ${className}`} style={{ transform: `rotate(${rotate}deg)` }} />;
}

/* ── HandNote ── */
export function HandNote({ children, className = "", rotate = -3 }: { children: ReactNode; className?: string; rotate?: number }) {
  return (
    <span className={`font-hand text-[#d577a0] text-xl leading-tight inline-block ${className}`} style={{ transform: `rotate(${rotate}deg)`, fontFamily: "var(--font-hand)" }}>
      {children}
    </span>
  );
}

/* ── Chip ── */
export function Chip({ active = false, onClick, children, className = "" }: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" data-active={active} onClick={onClick} className={`dc-chip ${className}`}>
      {children}
    </button>
  );
}

/* ── SectionHead ── */
export function SectionHead({ eyebrow, title, sub, right, className = "" }: { eyebrow?: string; title: ReactNode; sub?: string; right?: ReactNode; className?: string }) {
  return (
    <div className={`flex items-end justify-between gap-4 ${className}`}>
      <div>
        {eyebrow && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#c25783]">
            <Sparkles size={12} />{eyebrow}
          </div>
        )}
        <h1 className="font-semibold leading-[1.05] mt-1 text-[#47292f]" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem,3.5vw,2.6rem)" }}>
          {title}
        </h1>
        {sub && <p className="text-[#8a636e] text-sm mt-1.5 max-w-md">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/* ── GirlSame ── */
export function GirlSame({ count, active, onToggle, compact = false }: { count: number; active: boolean; onToggle: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`group flex items-center gap-1.5 rounded-full border-[1.5px] font-bold text-xs transition-all duration-200 ${compact ? "px-3 py-1.5" : "px-3.5 py-2"} ${active ? "border-transparent text-white" : "border-[#eebad0] text-[#d577a0] hover:border-[#d577a0] hover:bg-[#fbe7ee]"}`}
      style={active ? { background: "linear-gradient(120deg,#6e2a47,#c25783)" } : undefined}
    >
      <Sparkles size={14} className={active ? "animate-[dc-pop_0.45s_cubic-bezier(0.2,1.4,0.36,1)_both]" : ""} />
      girl, same
      <span className={active ? "text-[#f6d5e1]" : "text-[#8a636e]"}>{count}</span>
    </button>
  );
}
