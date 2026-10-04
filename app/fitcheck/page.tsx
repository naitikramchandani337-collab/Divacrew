"use client";

import { useState } from "react";
import { Plus, Shirt } from "lucide-react";
import { SectionHead } from "@/components/ui";
import { type Fit } from "@/lib/data";

export default function FitCheckPage() {
  const [fits] = useState<Fit[]>([]);

  return (
    <div className="max-w-[720px]">
      <SectionHead
        eyebrow="fit check · community mirror"
        title={<>rate the <span className="italic dc-squiggle text-[#6e2a47]">fit</span>, save a farewell</>}
        sub="post an outfit, let the crew vote. a/b/c democracy, but make it fashion."
        right={
          <button className="dc-btn dc-btn-p px-4 py-2.5 text-[12px]">
            <Plus size={15} /> drop a fit
          </button>
        }
      />

      {fits.length === 0 && (
        <div className="dc-card mt-8 p-12 text-center">
          <div className="flex justify-center mb-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#fbe7ee]">
              <Shirt size={28} className="text-[#c25783]" />
            </span>
          </div>
          <p className="font-semibold text-xl text-[#47292f]" style={{ fontFamily: "var(--font-display)" }}>
            no fits yet
          </p>
          <p className="text-[13px] text-[#8a636e] mt-2 max-w-xs mx-auto">
            be the first to drop a fit. the crew is ready to vote 💅
          </p>
          <button className="dc-btn dc-btn-p mt-5 px-6 py-2.5 text-[13px]">
            <Plus size={14} /> drop a fit
          </button>
        </div>
      )}
    </div>
  );
}
