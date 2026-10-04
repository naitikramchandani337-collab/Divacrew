"use client";

import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { SectionHead } from "@/components/ui";

export default function CrewPage() {
  return (
    <div className="max-w-[720px]">
      <Link href="/crews" className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#8a636e] hover:text-[#6e2a47] transition-colors">
        <ArrowLeft size={14} /> all crews
      </Link>

      <div className="dc-card mt-4 p-12 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#fbe7ee] mx-auto mb-4">
          <Users size={28} className="text-[#c25783]" />
        </span>
        <p className="font-semibold text-xl text-[#47292f]" style={{ fontFamily: "var(--font-display)" }}>
          crew coming soon
        </p>
        <p className="text-[13px] text-[#8a636e] mt-2">
          crew pages will be live once the backend is connected 💜
        </p>
        <Link href="/crews" className="dc-btn dc-btn-p mt-5 px-6 py-2.5 text-[13px] inline-flex">
          ← back to crews
        </Link>
      </div>
    </div>
  );
}
