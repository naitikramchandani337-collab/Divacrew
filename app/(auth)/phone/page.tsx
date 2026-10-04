/**
 * Step 1 of sign-up: phone number entry.
 * Full implementation is tracked in foundation-auth tasks (task 15.3).
 */
export default function PhonePage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Section header */}
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#B94A3C]">
          Join DivaCrew
        </span>
        <h1 className="text-[32px] font-bold leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
          What&apos;s your number, girl?
        </h1>
      </div>

      {/* Phone input placeholder */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 h-[52px] rounded-[50px] bg-white border border-[#E8DDD6] px-4">
          <span className="text-[#6B5F58] text-sm">🇮🇳 +91</span>
          <span className="w-px h-5 bg-[#E8DDD6]" />
          <input
            type="tel"
            placeholder="Enter your phone number"
            className="flex-1 bg-transparent outline-none text-[#1A1A1A] text-sm placeholder:text-[#6B5F58]"
          />
        </div>

        <button className="h-[52px] rounded-[50px] bg-[#2D5A45] text-white font-semibold text-sm w-full">
          Get OTP →
        </button>
      </div>

      <p className="text-xs text-[#6B5F58] text-center">
        Women-only · Invite-only · Private by design 🔒
      </p>
    </div>
  );
}
