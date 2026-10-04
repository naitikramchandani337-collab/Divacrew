"use client";

import { useState } from "react";
import { Search, Plus, Users } from "lucide-react";
import { SectionHead } from "@/components/ui";

export default function CrewsPage() {
  const [q, setQ] = useState("");

  return (
    <div className="max-w-[760px]">
      <SectionHead
        eyebrow="crews · find your people"
        title={<>every girl needs a <span className="italic dc-squiggle text-[#6e2a47]">crew</span></>}
        sub="public squares or private rooms — chats, posts, polls, events and resources, all under one roof."
      />

      <div className="mt-5 flex flex-col gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#d577a0]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search crews…"
            className="dc-input !pl-10"
          />
        </div>
        <button className="dc-btn dc-btn-p px-4 py-2.5 text-[12px] shrink-0">
          <Plus size={14} /> start a crew
        </button>
      </div>

      {/* Empty state */}
      <div className="dc-card mt-8 p-12 text-center">
        <div className="flex justify-center mb-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#fbe7ee]">
            <Users size={28} className="text-[#c25783]" />
          </span>
        </div>
        <p className="font-semibold text-xl text-[#47292f]" style={{ fontFamily: "var(--font-display)" }}>
          no crews yet
        </p>
        <p className="text-[13px] text-[#8a636e] mt-2 max-w-xs mx-auto">
          join a crew to connect with girls who get it — or start your own 💜
        </p>
        <button className="dc-btn dc-btn-p mt-5 px-6 py-2.5 text-[13px]">
          <Plus size={14} /> start a crew
        </button>
      </div>
    </div>
  );
}
