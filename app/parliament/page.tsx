"use client";

import { useState } from "react";
import { Landmark, Scale, SendHorizonal, TriangleAlert } from "lucide-react";
import { Chip, SectionHead, Tape } from "@/components/ui";
import { type DiscussLabel, type DiscussPost } from "@/lib/data";

const CATEGORIES = ["all", "Women & Safety", "Education", "Jobs", "Technology", "Environment", "Healthcare", "Laws & Rights"];

const LABEL_META: Record<DiscussLabel, { bg: string; fg: string; hint: string }> = {
  fact:     { bg: "#e6ecf5", fg: "#5c76a0", hint: "facts need receipts — add a source link" },
  opinion:  { bg: "#f6d5e1", fg: "#9a3b63", hint: "your take, your voice. no source needed" },
  source:   { bg: "#e7efe1", fg: "#5b7d53", hint: "drop the link so girlies can verify" },
  question: { bg: "#faf0da", fg: "#a1711f", hint: "ask away — genuinely curious energy only" },
};

function Discuss() {
  const [posts, setPosts] = useState<DiscussPost[]>([]);
  const [label, setLabel] = useState<DiscussLabel>("opinion");
  const [text, setText] = useState("");
  const [source, setSource] = useState("");

  const needsSource = label === "fact" || label === "source";
  const blocked = needsSource && text.trim().length > 0 && !source.trim();

  const submit = () => {
    if (!text.trim() || blocked) return;
    setPosts((p) => [{
      id: `d-${Date.now()}`,
      girl: { handle: "you", name: "you", grad: "linear-gradient(135deg,#6e2a47,#c25783)" },
      label,
      text: text.trim(),
      source: source.trim() || undefined,
      same: 0,
      time: "now",
    }, ...p]);
    setText("");
    setSource("");
  };

  return (
    <section className="mt-8">
      <div className="flex items-center gap-3 mb-4">
        <Scale size={18} className="text-[#c25783]" />
        <h2 className="font-semibold text-2xl text-[#47292f]" style={{ fontFamily: "var(--font-display)" }}>
          discuss it <span className="italic text-[#d577a0]">— without the warzone</span>
        </h2>
      </div>
      <p className="text-[13px] text-[#8a636e] mb-4">
        every take gets a label. claims need receipts. screaming matches get muted.
      </p>

      <div className="dc-card relative p-5">
        <Tape className="-top-3 left-10" rotate={-4} />
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(LABEL_META) as DiscussLabel[]).map((l) => (
            <Chip key={l} active={label === l} onClick={() => setLabel(l)}>{l}</Chip>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder={`your ${label} on today's news…`}
          className="dc-textarea mt-3"
        />
        {needsSource && (
          <div className="mt-2">
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="source link — pib, gazette, a real one"
              className="dc-input text-[13px]"
            />
            {blocked && (
              <p className="mt-2 flex items-center gap-1.5 text-[12px] font-bold text-[#be4560]">
                <TriangleAlert size={13} />posting a {label}? the crew needs a link — paste one above
              </p>
            )}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11.5px] italic text-[#8a636e]">{LABEL_META[label].hint}</span>
          <button
            onClick={submit}
            disabled={!text.trim() || blocked}
            className="dc-btn dc-btn-p px-5 py-2 text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            add to the floor <SendHorizonal size={13} />
          </button>
        </div>
      </div>

      {posts.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {posts.map((p) => {
            const lm = LABEL_META[p.label];
            return (
              <div key={p.id} className="dc-card p-5">
                <div className="flex items-center gap-2.5">
                  <span className="text-[13px] font-bold text-[#47292f]">@{p.girl.handle}</span>
                  <span className="text-[11px] text-[#8a636e]">· {p.time}</span>
                  <span className="ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ background: lm.bg, color: lm.fg }}>
                    {p.label}
                  </span>
                </div>
                <p className="mt-2.5 text-[14px] leading-relaxed text-[#47292f]">{p.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function ParliamentPage() {
  const [cat, setCat] = useState("all");

  return (
    <div className="max-w-[720px]">
      <SectionHead
        eyebrow="parliament today · what's worth knowing"
        title={<>what <span className="italic dc-squiggle text-[#6e2a47]">changed?</span></>}
        sub="no 47-paragraph legal downloads. what happened, in words a sleep-deprived 17-year-old gets at midnight."
        right={
          <span className="hidden items-center gap-2 rounded-full border border-[#f6d5e1] bg-white/70 px-3.5 py-2 text-[11.5px] font-bold text-[#8a636e]">
            <Landmark size={14} className="text-[#c25783]" />live updates
          </span>
        }
      />

      <div className="dc-card mt-5 flex items-start gap-3 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f0e9f6] text-[#a283bd]">
          <Scale size={18} />
        </span>
        <p className="text-[13px] leading-relaxed text-[#8a636e]">
          <span className="font-bold text-[#47292f]">the divacrew promise:</span> we explain what happened, link the primary source, and label facts vs commentary. we never tell you what to think — that&apos;s your job, bestie.
        </p>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORIES.map((c) => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c === "all" ? "all of it" : c}</Chip>
        ))}
      </div>

      {/* Empty state — no civic content yet */}
      <div className="dc-card mt-6 p-12 text-center">
        <div className="flex justify-center mb-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#f0e9f6]">
            <Landmark size={28} className="text-[#a283bd]" />
          </span>
        </div>
        <p className="font-semibold text-xl text-[#47292f]" style={{ fontFamily: "var(--font-display)" }}>
          no updates today
        </p>
        <p className="text-[13px] text-[#8a636e] mt-2 max-w-xs mx-auto">
          editors are reviewing today&apos;s parliament session — check back soon 💛
        </p>
      </div>

      <Discuss />
    </div>
  );
}
