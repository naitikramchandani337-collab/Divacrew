"use client";

import { useRef, useState } from "react";
import {
  Phone, MapPin, EyeOff, ShieldCheck, SendHorizonal,
  BadgeCheck, HandHeart, UserPlus,
} from "lucide-react";
import { SectionHead, Tape, Chip } from "@/components/ui";
import { HELPLINES, type Spill } from "@/lib/data";

const SPILL_CATS = [
  "poorly lit stretch", "harassment", "crowd situation",
  "unsafe auto driver", "suspicious behavior", "other",
];

/* ── SOS card ── */
function SosCard() {
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const R = 74, CIRC = 2 * Math.PI * R;

  const start = () => {
    if (active) return;
    timer.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(timer.current!); setActive(true); return 100; }
        return p + 2.5;
      });
    }, 45);
  };
  const stop = () => { if (timer.current) clearInterval(timer.current); if (!active) setProgress(0); };
  const reset = () => { if (timer.current) clearInterval(timer.current); setActive(false); setProgress(0); };

  return (
    <section className="dc-card relative overflow-hidden p-6 dc-fadeup">
      <div className="relative flex flex-col items-center text-center">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#be4560]">
          <ShieldCheck size={13} /> sos · backup button
        </div>
        <h2 className="font-semibold text-2xl text-[#47292f] mt-1" style={{ fontFamily: "var(--font-display)" }}>
          {active ? "backup activated. breathe, bestie." : "hold the button — we got you"}
        </h2>
        <p className="text-[12.5px] text-[#8a636e] mt-1 max-w-sm">
          {active
            ? "your trusted contacts have been notified."
            : "press and hold for a few seconds. your trusted contacts get an alert instantly."}
        </p>

        <div className="relative mt-5">
          <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90">
            <circle cx="90" cy="90" r={R} fill="none" stroke="#f6d5e1" strokeWidth="10" />
            <circle cx="90" cy="90" r={R} fill="none" stroke="url(#sosgrad)" strokeWidth="10"
              strokeLinecap="round" strokeDasharray={CIRC}
              strokeDashoffset={CIRC - (CIRC * progress) / 100}
              style={{ transition: "stroke-dashoffset 75ms linear" }} />
            <defs>
              <linearGradient id="sosgrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#9a3b63" />
                <stop offset="100%" stopColor="#be4560" />
              </linearGradient>
            </defs>
          </svg>
          <button
            type="button"
            onPointerDown={start}
            onPointerUp={stop}
            onPointerLeave={stop}
            className={`absolute inset-0 m-auto flex h-32 w-32 select-none flex-col items-center justify-center rounded-full text-white shadow-[0_20px_40px_-14px_rgba(190,69,96,.7)] transition-transform active:scale-95 ${active ? "scale-95" : "dc-pulsedot"}`}
            style={{ background: "linear-gradient(140deg,#be4560,#9a3b63)", touchAction: "none" }}
          >
            <span className="text-3xl leading-none font-bold" style={{ fontFamily: "var(--font-logo)" }}>
              {active ? "on" : "sos"}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] mt-1 opacity-80">
              {active ? "live" : "hold me"}
            </span>
          </button>
        </div>

        {active ? (
          <div className="mt-5 w-full max-w-sm dc-fadeup">
            <p className="text-[12.5px] text-[#8a636e] mb-3">
              add trusted contacts in Settings → Trusted Contacts to notify them automatically.
            </p>
            <button onClick={reset} className="dc-btn dc-btn-g w-full px-6 py-2.5 text-[12.5px]">
              <HandHeart size={15} /> i&apos;m okay now — call it off
            </button>
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {HELPLINES.map((h) => (
              <a key={h.num} href={`tel:${h.num}`}
                className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#eebad0] bg-white/70 px-3.5 py-1.5 text-[12px] font-bold text-[#6e2a47] hover:border-[#be4560] transition-colors">
                <Phone size={12} className="text-[#be4560]" />{h.name} · {h.num}
              </a>
            ))}
          </div>
        )}
        <p className="mt-4 text-[11px] text-[#8a636e] max-w-xs">
          sos notifies your people — it is not a replacement for emergency services. in danger, dial 112.
        </p>
      </div>
    </section>
  );
}

/* ── check-in card ── */
type CheckState = "good" | "check" | "help";

function CheckInCard() {
  const [mine, setMine] = useState<CheckState | null>(null);
  const opts: { key: CheckState; label: string; color: string; note: string }[] = [
    { key: "good",  label: "i'm good",      color: "#87a97f", note: "vibes secured 💚" },
    { key: "check", label: "check on me",   color: "#e9b44c", note: "the crew will ping you every 15 min" },
    { key: "help",  label: "need help",     color: "#be4560", note: "trusted contacts notified 🚨" },
  ];

  return (
    <section className="dc-card relative p-6 dc-fadeup" style={{ animationDelay: ".08s" }}>
      <Tape className="-top-3 right-10" rotate={4} />
      <h3 className="font-semibold text-xl text-[#47292f]" style={{ fontFamily: "var(--font-display)" }}>
        crew check-in
      </h3>
      <p className="text-[12.5px] text-[#8a636e] mt-0.5">let your crew know how you're doing</p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {opts.map((o) => (
          <button key={o.key} onClick={() => setMine(o.key)}
            className={`flex flex-col items-center gap-1.5 rounded-2xl border-[1.5px] py-3.5 text-[11.5px] font-bold transition-all ${mine === o.key ? "border-transparent text-white scale-[1.03]" : "border-[#f6d5e1] text-[#8a636e] hover:border-[#e398b8] bg-white/60"}`}
            style={mine === o.key ? { background: o.color } : undefined}>
            <span className={`h-4 w-4 rounded-full border-2 border-white shadow ${mine === o.key ? "" : "dc-pulsedot"}`} style={{ background: o.color }} />
            {o.label}
          </button>
        ))}
      </div>

      {mine && (
        <p className="dc-fadeup mt-3 rounded-xl bg-[#fbe7ee] px-3.5 py-2.5 text-[12.5px] font-bold text-[#6e2a47]">
          {opts.find((o) => o.key === mine)!.note}
        </p>
      )}

      {/* Empty contacts notice */}
      <div className="mt-4 rounded-2xl border border-[#f6d5e1] bg-[#fbe7ee]/40 p-4 text-center">
        <p className="text-[12.5px] text-[#8a636e]">
          no trusted contacts yet —{" "}
          <a href="/me" className="font-bold text-[#c25783] underline">add them in settings</a>
        </p>
        <a href="/me" className="dc-btn dc-btn-p mt-3 px-5 py-2 text-[12px] inline-flex">
          <UserPlus size={13} /> add trusted contacts
        </a>
      </div>
    </section>
  );
}

/* ── spill card ── */
function SpillCard() {
  const [spills, setSpills] = useState<Spill[]>([]);
  const [area, setArea] = useState("");
  const [cat, setCat] = useState(SPILL_CATS[0]);
  const [text, setText] = useState("");
  const [verified, setVerified] = useState<Record<string, boolean>>({});

  const submit = () => {
    if (!text.trim() || !area.trim()) return;
    setSpills((s) => [{
      id: `sp-${Date.now()}`,
      area: area.trim(),
      category: cat,
      text: text.trim(),
      time: "just now",
      verifyCount: 0,
    }, ...s]);
    setText(""); setArea("");
  };

  return (
    <section id="spill" className="dc-card relative p-6 scroll-mt-24 dc-fadeup" style={{ animationDelay: ".16s" }}>
      <Tape className="-top-3 left-12" rotate={-5} />
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6e2a47] text-[#f3d89b]">
          <EyeOff size={19} />
        </span>
        <div>
          <h3 className="font-semibold text-xl text-[#47292f] leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            spill — anonymous reports
          </h3>
          <p className="text-[11.5px] text-[#8a636e]">anonymous by design. reviewed before it spreads.</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[#f6d5e1] bg-[#fbe7ee]/40 p-4">
        <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="area — e.g. outer circle, CP" className="dc-input text-[13px]" />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {SPILL_CATS.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)} className="!text-[11px] !px-2.5 !py-1.5">{c}</Chip>
          ))}
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
          placeholder="what happened? keep it factual — where, when, what to watch for…" className="dc-textarea mt-3" />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] italic text-[#8a636e]">no names, no blame — keep it useful for the next girl</span>
          <button onClick={submit} disabled={!text.trim() || !area.trim()}
            className="dc-btn dc-btn-p px-5 py-2 text-[12px] disabled:opacity-40 disabled:cursor-not-allowed">
            spill it <SendHorizonal size={13} />
          </button>
        </div>
      </div>

      {spills.length === 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-[#eebad0] p-8 text-center">
          <p className="text-[13px] text-[#8a636e]">no community reports yet — be the first to spill 👀</p>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3">
        {spills.map((s, i) => (
          <article key={s.id} className="rounded-2xl border border-[#f6d5e1] bg-white/70 p-5 dc-fadeup" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full text-white/90" style={{ background: "linear-gradient(135deg,#47292f,#8a636e)" }}>
                <EyeOff size={13} />
              </span>
              <span className="text-[12.5px] font-bold text-[#47292f]">a girlie spilled</span>
              <span className="text-[11px] text-[#8a636e]">· {s.time}</span>
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#fbe7ee] px-2.5 py-1 text-[10.5px] font-bold text-[#6e2a47]">
                <MapPin size={10} /> {s.area}
              </span>
            </div>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-[#47292f]">{s.text}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-full border border-[#f6d5e1] bg-white px-2.5 py-1 text-[10.5px] font-bold text-[#8a636e]">{s.category}</span>
              <button onClick={() => setVerified((v) => ({ ...v, [s.id]: !v[s.id] }))}
                className={`ml-auto inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-[11.5px] font-bold transition-all ${verified[s.id] ? "border-transparent text-white" : "border-[#eebad0] text-[#8a636e] hover:border-[#d577a0] hover:text-[#6e2a47]"}`}
                style={verified[s.id] ? { background: "#7b93b8" } : undefined}>
                <BadgeCheck size={12} />happened to me too · {s.verifyCount + (verified[s.id] ? 1 : 0)}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function SafetyPage() {
  return (
    <div className="max-w-[720px] flex flex-col gap-6">
      <SectionHead
        eyebrow="safety · the whole point"
        title={<>need <span className="italic dc-squiggle text-[#6e2a47]">backup?</span></>}
        sub="sos, check-ins, and the anonymous spill — because 'text me when you're home' is a lifestyle."
      />
      <SosCard />
      <CheckInCard />
      <SpillCard />
    </div>
  );
}
