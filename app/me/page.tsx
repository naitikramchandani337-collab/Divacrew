"use client";

import { useState } from "react";
import {
  Settings, Shield, BookOpen, LogOut, ChevronRight,
  Bell, Lock, Trash2, BadgeCheck, Users, Shirt, Star, UserPlus,
} from "lucide-react";
import { Avatar, SectionHead, Tape } from "@/components/ui";
import { ME } from "@/lib/data";

const STATS = [
  { label: "crews", value: "0", icon: Users },
  { label: "fit checks", value: "0", icon: Shirt },
  { label: "girl, same", value: "0", icon: Star },
];

const MENU = [
  {
    section: "Account",
    items: [
      { label: "Notifications", icon: Bell, href: "#" },
      { label: "Privacy Settings", icon: Lock, href: "#" },
      { label: "Community Rules", icon: BookOpen, href: "#" },
    ],
  },
  {
    section: "Safety",
    items: [
      { label: "Block List", icon: Shield, href: "#" },
      { label: "Trusted Contacts", icon: BadgeCheck, href: "/safety" },
    ],
  },
  {
    section: "Danger Zone",
    items: [
      { label: "Delete Account", icon: Trash2, href: "#", danger: true },
    ],
  },
];

export default function MePage() {
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState("your nickname");
  const [city, setCity] = useState("your city");
  const [bio, setBio] = useState("");

  return (
    <div className="flex flex-col gap-5 max-w-[680px]">
      <SectionHead
        eyebrow="your profile"
        title={<>hey, <span className="italic dc-squiggle text-[#6e2a47]">diva</span> ✨</>}
      />

      {/* Profile card */}
      <section className="dc-card relative overflow-hidden p-6 dc-fadeup">
        <Tape className="-top-3 right-10" rotate={4} />
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <Avatar girl={ME} size={72} ring />
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="dc-input !rounded-xl !py-1.5 text-lg font-bold mb-1"
                autoFocus
              />
            ) : (
              <h2 className="text-xl font-bold text-[#47292f]" style={{ fontFamily: "var(--font-display)" }}>
                {nickname}
              </h2>
            )}
            <p className="text-[12px] font-bold text-[#c25783]">@{ME.handle}</p>
            {editing ? (
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="dc-input !rounded-xl !py-1 text-sm mt-1"
                placeholder="your city"
              />
            ) : (
              <p className="text-[12.5px] text-[#8a636e] mt-0.5">📍 {city}</p>
            )}
          </div>
          <button
            onClick={() => setEditing((e) => !e)}
            className="dc-btn dc-btn-g px-3 py-1.5 text-[11px] shrink-0"
          >
            {editing ? "save" : "edit"}
          </button>
        </div>

        <div className="mt-4">
          {editing ? (
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={2}
              className="dc-textarea text-[13px]"
              placeholder="say something about yourself…"
            />
          ) : bio ? (
            <p className="text-[13.5px] leading-relaxed text-[#47292f]">{bio}</p>
          ) : (
            <p className="text-[13px] italic text-[#8a636e]">tap edit to add a bio 💜</p>
          )}
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {STATS.map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex flex-col items-center gap-1 rounded-2xl bg-[#fbe7ee]/60 py-3">
              <Icon size={16} className="text-[#c25783]" />
              <span className="text-lg font-bold text-[#47292f]">{value}</span>
              <span className="text-[10.5px] font-bold text-[#8a636e] uppercase tracking-wide">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Crews — empty state */}
      <section className="dc-fadeup" style={{ animationDelay: ".05s" }}>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#c25783] mb-3">your crews</p>
        <div className="dc-card p-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fbe7ee] mx-auto mb-3">
            <Users size={22} className="text-[#c25783]" />
          </span>
          <p className="text-[13.5px] font-semibold text-[#47292f]">no crews yet</p>
          <p className="text-[12px] text-[#8a636e] mt-1">join or start a crew to see them here</p>
          <a href="/crews" className="dc-btn dc-btn-p mt-4 px-5 py-2 text-[12px] inline-flex">find crews</a>
        </div>
      </section>

      {/* Trusted contacts — empty state */}
      <section className="dc-fadeup" style={{ animationDelay: ".08s" }}>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#c25783] mb-3">trusted contacts</p>
        <div className="dc-card p-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fbe7ee] mx-auto mb-3">
            <UserPlus size={22} className="text-[#c25783]" />
          </span>
          <p className="text-[13.5px] font-semibold text-[#47292f]">no trusted contacts yet</p>
          <p className="text-[12px] text-[#8a636e] mt-1">add up to 5 people who get notified when you need help</p>
          <button className="dc-btn dc-btn-p mt-4 px-5 py-2 text-[12px]">
            <UserPlus size={13} /> add a contact
          </button>
        </div>
      </section>

      {/* Settings menu */}
      {MENU.map((group, gi) => (
        <section key={group.section} className="dc-fadeup" style={{ animationDelay: `${0.1 + gi * 0.04}s` }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#c25783] mb-3">{group.section}</p>
          <div className="dc-card overflow-hidden divide-y divide-[#f6d5e1]">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isDanger = (item as { danger?: boolean }).danger;
              return (
                <a
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#fbe7ee]/40 transition-colors"
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${isDanger ? "bg-[#fce4e8]" : "bg-[#fbe7ee]"}`}>
                    <Icon size={15} className={isDanger ? "text-[#be4560]" : "text-[#c25783]"} />
                  </span>
                  <span className={`flex-1 text-[13.5px] font-semibold ${isDanger ? "text-[#be4560]" : "text-[#47292f]"}`}>
                    {item.label}
                  </span>
                  <ChevronRight size={15} className="text-[#8a636e]" />
                </a>
              );
            })}
          </div>
        </section>
      ))}

      <button className="dc-btn dc-btn-g w-full py-3 text-[13px] text-[#be4560] border-[#f6d5e1] dc-fadeup" style={{ animationDelay: ".22s" }}>
        <LogOut size={15} /> sign out
      </button>

      <p className="text-center text-[10.5px] text-[#8a636e] pb-2">DivaCrew · private by design 🔒</p>
    </div>
  );
}
