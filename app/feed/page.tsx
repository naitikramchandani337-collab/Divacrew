"use client";

import { useState } from "react";
import {
  Shirt, Newspaper, CalendarDays, Siren, Sparkles,
  MessagesSquare, MessageCircleQuestion, ImagePlus, SendHorizonal,
} from "lucide-react";
import { Avatar, Chip, SectionHead } from "@/components/ui";
import { PostCard } from "@/components/post-card";
import { ME, type Post, type PostKind } from "@/lib/data";

const FILTERS = [
  { key: "all", label: "everything" },
  { key: "safety", label: "safety" },
  { key: "event", label: "events" },
  { key: "tea", label: "the tea" },
  { key: "fit", label: "fits" },
  { key: "rec", label: "recs" },
  { key: "question", label: "questions" },
];

const COMPOSER_KINDS: { kind: PostKind; label: string; icon: typeof Shirt }[] = [
  { kind: "fit",      label: "fit pic",     icon: Shirt },
  { kind: "thought",  label: "thoughts",    icon: MessagesSquare },
  { kind: "event",    label: "event",       icon: CalendarDays },
  { kind: "rec",      label: "rec",         icon: Sparkles },
  { kind: "tea",      label: "news",        icon: Newspaper },
  { kind: "question", label: "anyone else?",icon: MessageCircleQuestion },
  { kind: "safety",   label: "safety",      icon: Siren },
];

function Composer({ onPost }: { onPost: (p: Post) => void }) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState<PostKind>("thought");

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onPost({
      id: `new-${Date.now()}`,
      girl: ME,
      time: "now",
      kind,
      text: t,
      same: 0,
      reposts: 0,
      comments: [],
    });
    setText("");
  };

  return (
    <section className="dc-card p-5">
      <div className="flex items-start gap-3">
        <Avatar girl={ME} size={44} ring />
        <div className="flex-1 min-w-0">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="spill it, bestie — what's happening?"
            className="dc-textarea"
          />
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {COMPOSER_KINDS.map(({ kind: k, label, icon: Icon }) => (
              <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
                <Icon size={12} />{label}
              </Chip>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button type="button" className="dc-btn dc-btn-g px-3 py-1.5 text-[11.5px]">
              <ImagePlus size={14} /> add pics
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!text.trim()}
              className="dc-btn dc-btn-p px-5 py-2 text-[12.5px] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              post to the crew <SendHorizonal size={14} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState("all");

  const visible = filter === "all" ? posts : posts.filter((p) => p.kind === filter);

  return (
    <div className="flex flex-col gap-5 max-w-[680px]">
      <SectionHead
        eyebrow="the crew · live feed"
        title={<>what's the <span className="italic dc-squiggle text-[#6e2a47]">vibe</span>, bestie?</>}
        sub="outfits, tea, routes, and who's going where — all from your girls only."
      />

      <Composer onPost={(p) => setPosts((ps) => [p, ...ps])} />

      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => (
          <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}</Chip>
        ))}
      </div>

      {visible.length > 0 ? (
        <div className="flex flex-col gap-5">
          {visible.map((p, i) => <PostCard key={p.id} post={p} index={i} />)}
        </div>
      ) : (
        <div className="dc-card p-10 text-center">
          <p className="text-4xl mb-3">💜</p>
          <p className="font-semibold text-lg text-[#47292f]" style={{ fontFamily: "var(--font-display)" }}>
            {posts.length === 0 ? "nothing here yet" : `no ${filter} posts yet`}
          </p>
          <p className="text-[13px] text-[#8a636e] mt-1">
            {posts.length === 0
              ? "be the first to post something — your crew is waiting 💅"
              : "try a different filter or post something new"}
          </p>
        </div>
      )}
    </div>
  );
}
