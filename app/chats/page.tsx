"use client";

import { MessagesSquare, Plus } from "lucide-react";
import { SectionHead } from "@/components/ui";

export default function ChatsPage() {
  return (
    <div className="flex flex-col gap-5 max-w-[680px]">
      <SectionHead
        eyebrow="group chats · the digital adda"
        title={<>the <span className="italic dc-squiggle text-[#6e2a47]">group chat</span>, but organized</>}
        sub="channels per mood. no buried announcements."
      />

      {/* Empty state */}
      <div className="dc-card p-12 text-center">
        <div className="flex justify-center mb-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#fbe7ee]">
            <MessagesSquare size={28} className="text-[#c25783]" />
          </span>
        </div>
        <p className="font-semibold text-xl text-[#47292f]" style={{ fontFamily: "var(--font-display)" }}>
          no chats yet
        </p>
        <p className="text-[13px] text-[#8a636e] mt-2 max-w-xs mx-auto">
          join a crew to start chatting with your girls 💜
        </p>
        <a href="/crews" className="dc-btn dc-btn-p mt-5 px-6 py-2.5 text-[13px] inline-flex">
          <Plus size={14} /> find a crew
        </a>
      </div>

      <div className="dc-card flex items-start gap-3 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#fbe7ee] text-[#c25783]">
          <MessagesSquare size={15} />
        </span>
        <p className="text-[11.5px] leading-relaxed text-[#8a636e]">
          <span className="font-bold text-[#47292f]">house rules:</span> no screenshots of chats outside the app, no unverified panic forwards, no unsolicited dms to minors. break rules, lose the crew.
        </p>
      </div>
    </div>
  );
}
