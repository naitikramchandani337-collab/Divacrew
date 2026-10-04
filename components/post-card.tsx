"use client";

import { useState } from "react";
import { MessageCircle, Repeat2, Bookmark, Shirt, Newspaper, CalendarDays, Siren, Sparkles, MessagesSquare, MessageCircleQuestion, SendHorizonal, Link2 } from "lucide-react";
import { Avatar, GirlSame } from "@/components/ui";
import { ME, type Post, type PostKind } from "@/lib/data";

const KIND_STYLE: Record<PostKind, { icon: typeof Shirt; bg: string; fg: string; label: string }> = {
  fit: { icon: Shirt, bg: "#f6d5e1", fg: "#9a3b63", label: "fit check" },
  tea: { icon: Newspaper, bg: "#f0e9f6", fg: "#7a5c96", label: "the tea" },
  event: { icon: CalendarDays, bg: "#faf0da", fg: "#a1711f", label: "event" },
  safety: { icon: Siren, bg: "#f9dee2", fg: "#be4560", label: "safety update" },
  rec: { icon: Sparkles, bg: "#e7efe1", fg: "#5b7d53", label: "recommendation" },
  thought: { icon: MessagesSquare, bg: "#e6ecf5", fg: "#5c76a0", label: "thoughts" },
  question: { icon: MessageCircleQuestion, bg: "#f6d5e1", fg: "#c25783", label: "question" },
};

export function PostCard({ post, index = 0 }: { post: Post; index?: number }) {
  const [same, setSame] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [openComments, setOpenComments] = useState(false);
  const [comments, setComments] = useState(post.comments);
  const [draft, setDraft] = useState("");

  const kind = KIND_STYLE[post.kind];
  const KindIcon = kind.icon;

  const addComment = () => {
    const t = draft.trim();
    if (!t) return;
    setComments((c) => [...c, { girl: ME, text: t, time: "now" }]);
    setDraft("");
  };

  return (
    <article className="dc-card dc-card-hover p-5 dc-fadeup" style={{ animationDelay: `${Math.min(index, 6) * 0.07}s` }}>
      <div className="flex items-start gap-3">
        <Avatar girl={post.girl} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="text-[14.5px] font-bold text-[#47292f]">@{post.girl.handle}</span>
            <span className="text-[12px] text-[#8a636e]">· {post.time}</span>
            {post.crew && (
              <span className="rounded-full bg-[#fbe7ee] px-2 py-0.5 text-[10.5px] font-bold text-[#6e2a47]">{post.crew}</span>
            )}
          </div>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: kind.bg, color: kind.fg }}>
            <KindIcon size={11} />{kind.label}
          </span>
        </div>
        {post.source && (
          <span className="hidden items-center gap-1 rounded-full border border-[#f6d5e1] bg-white/70 px-2.5 py-1 text-[10.5px] font-bold text-[#8a636e]">
            <Link2 size={11} className="text-[#d577a0]" />{post.source}
          </span>
        )}
      </div>

      <p className="mt-3 text-[14.5px] leading-relaxed text-[#47292f]">{post.text}</p>

      {post.tags && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {post.tags.map((t) => <span key={t} className="text-[12px] font-bold text-[#c25783]">{t}</span>)}
        </div>
      )}

      {post.image && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-[#f6d5e1]" style={{ maxHeight: 340 }}>
          <img src={post.image} alt="" className="dc-img hover:scale-[1.03]" style={{ height: 340 }} />
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <GirlSame count={post.same + (same ? 1 : 0)} active={same} onToggle={() => setSame((s) => !s)} compact />
        <button
          type="button"
          onClick={() => setOpenComments((o) => !o)}
          className={`flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-xs font-bold transition-all ${openComments ? "border-[#e398b8] bg-[#fbe7ee] text-[#6e2a47]" : "border-[#eebad0] text-[#8a636e] hover:border-[#d577a0] hover:text-[#6e2a47]"}`}
        >
          <MessageCircle size={14} />
          {comments.length > 0 ? `${comments.length}` : "chat"}
        </button>
        <button
          type="button"
          onClick={() => setReposted((r) => !r)}
          className={`flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-xs font-bold transition-all ${reposted ? "border-transparent text-white" : "border-[#eebad0] text-[#8a636e] hover:border-[#d577a0] hover:text-[#6e2a47]"}`}
          style={reposted ? { background: "#87a97f" } : undefined}
        >
          <Repeat2 size={14} />{post.reposts + (reposted ? 1 : 0)}
        </button>
        <button
          type="button"
          onClick={() => setSaved((s) => !s)}
          aria-label="save"
          className={`ml-auto flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] transition-all ${saved ? "border-transparent bg-[#6e2a47] text-[#f3d89b]" : "border-[#eebad0] text-[#8a636e] hover:border-[#d577a0] hover:text-[#6e2a47]"}`}
        >
          <Bookmark size={14} fill={saved ? "#f3d89b" : "none"} />
        </button>
      </div>

      {openComments && (
        <div className="mt-4 rounded-2xl border border-[#f6d5e1] bg-[#fbe7ee]/50 p-3.5">
          {comments.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {comments.map((c, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Avatar girl={c.girl} size={28} />
                  <div className="min-w-0 rounded-2xl rounded-tl-md bg-white/80 px-3 py-2">
                    <span className="text-[11.5px] font-bold text-[#6e2a47]">@{c.girl.handle} <span className="font-normal text-[#8a636e]">· {c.time}</span></span>
                    <p className="text-[13px] text-[#47292f] leading-snug">{c.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] text-[#8a636e] italic">no comments yet — start the convo bestie</p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <Avatar girl={ME} size={30} />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addComment()}
              placeholder="say it with your chest…"
              className="dc-input !py-2 text-[13px]"
            />
            <button type="button" onClick={addComment} className="dc-btn dc-btn-p h-9 w-9 !p-0 shrink-0" aria-label="send">
              <SendHorizonal size={15} />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
