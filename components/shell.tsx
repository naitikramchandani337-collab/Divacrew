"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Users, Shirt, Landmark, MessagesSquare, ShieldCheck, EyeOff, Siren, UserCircle,
} from "lucide-react";
import { Bow, SparkleStar } from "@/components/ui";

const NAV = [
  { href: "/feed",       label: "crew",    icon: Home,           match: (p: string) => p === "/feed" || p === "/" },
  { href: "/crews",      label: "crews",   icon: Users,          match: (p: string) => p.startsWith("/crews") },
  { href: "/fitcheck",   label: "fits",    icon: Shirt,          match: (p: string) => p.startsWith("/fitcheck") },
  { href: "/parliament", label: "changed", icon: Landmark,       match: (p: string) => p.startsWith("/parliament") },
  { href: "/chats",      label: "chats",   icon: MessagesSquare, match: (p: string) => p.startsWith("/chats"), unread: 12 },
  { href: "/safety",     label: "safety",  icon: ShieldCheck,    match: (p: string) => p.startsWith("/safety") },
  { href: "/me",         label: "me",      icon: UserCircle,     match: (p: string) => p.startsWith("/me") },
];

function Logo() {
  return (
    <Link href="/feed" className="flex items-center gap-2">
      <span className="relative">
        <Bow className="w-8 h-6" />
        <SparkleStar className="absolute -top-1 -right-1.5 w-3 h-3" color="#f3d89b" />
      </span>
      <span
        className="text-[21px] text-[#6e2a47] leading-none tracking-tight"
        style={{ fontFamily: "var(--font-logo)", fontWeight: 400 }}
      >
        DivaCrew
      </span>
    </Link>
  );
}

function TopBar() {
  return (
    <header className="z-30 shrink-0 border-b border-[#f6d5e1] bg-[#fff8f3]/90 backdrop-blur-lg">
      <div className="flex items-center justify-between px-4 py-2.5 safe-area-top">
        <Logo />
        <div className="flex items-center gap-2">
          <Link href="/safety" className="dc-btn dc-btn-g px-3 py-1.5 text-[11px]">
            <EyeOff size={12} /> spill
          </Link>
          <Link
            href="/safety"
            className="dc-btn px-3 py-1.5 text-[11px] text-white"
            style={{ background: "linear-gradient(120deg,#be4560,#9a3b63)" }}
          >
            <Siren size={12} /> sos
          </Link>
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="z-30 shrink-0 border-t border-[#f6d5e1] bg-white/90 backdrop-blur-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-stretch justify-around px-1 pt-1 pb-1.5">
        {NAV.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1 transition-colors ${
                active ? "text-[#6e2a47]" : "text-[#8a636e]"
              }`}
            >
              <span
                className={`relative flex h-8 w-10 items-center justify-center rounded-full transition-all duration-200 ${
                  active ? "bg-[#fbe7ee]" : ""
                }`}
              >
                <Icon size={19} strokeWidth={active ? 2.5 : 2} />
                {item.unread ? (
                  <span className="absolute -top-0.5 right-0.5 h-4 w-4 rounded-full bg-[#c25783] text-[8px] font-bold text-white flex items-center justify-center">
                    {item.unread}
                  </span>
                ) : null}
              </span>
              <span className="text-[9.5px] font-bold leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-[#fff8f3]">
      {/* ambient blobs — desktop only */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden hidden lg:block">
        <div className="absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full bg-[#f6d5e1]/60 blur-[110px]" />
        <div className="absolute top-1/4 -right-40 h-[520px] w-[520px] rounded-full bg-[#faf0da] blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[420px] w-[420px] rounded-full bg-[#f0e9f6] blur-[110px]" />
      </div>

      <TopBar />

      <main
        className="flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain"
        style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        <div className="px-4 pt-4 pb-6 max-w-[680px] mx-auto">
          {children}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
