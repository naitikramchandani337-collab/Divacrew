/* ── DivaCrew data layer ─────────────────────────────────────────── */
/* All live data will come from Supabase once auth is wired up.      */
/* This file defines types only — no mock data.                      */

export type Girl = {
  handle: string;
  name: string;
  grad: string;
  badge?: "verified" | "org" | "mod";
};

export const ME: Girl = {
  handle: "you",
  name: "you",
  grad: "linear-gradient(135deg,#6e2a47,#c25783)",
};

export type PostKind = "fit" | "tea" | "event" | "safety" | "rec" | "thought" | "question";

export const KIND_LABEL: Record<PostKind, string> = {
  fit: "fit check",
  tea: "the tea",
  event: "event",
  safety: "safety update",
  rec: "recommendation",
  thought: "thoughts",
  question: "question",
};

export type Comment = { girl: Girl; text: string; time: string };

export type Post = {
  id: string;
  girl: Girl;
  time: string;
  crew?: string;
  kind: PostKind;
  text: string;
  image?: string;
  same: number;
  reposts: number;
  tags?: string[];
  comments: Comment[];
  source?: string;
};

export const FEED_POSTS: Post[] = [];

export type FitOption = { id: string; label: string; img: string; votes: number };
export type Fit = {
  id: string;
  girl: Girl;
  time: string;
  title: string;
  note?: string;
  options: FitOption[];
  tags: string[];
  comments: Comment[];
};

export const FITS: Fit[] = [];

export type Crew = {
  slug: string;
  name: string;
  members: string;
  desc: string;
  grad: string;
  privacy: "public" | "private";
  joined?: boolean;
  temp?: boolean;
  online?: string;
  channels?: { id: string; name: string; unread?: number }[];
};

export const CREWS: Crew[] = [];

export type BillKind = "introduced" | "passed" | "announced";
export type ParliamentItem = {
  id: string;
  kind: BillKind;
  title: string;
  alpha: string;
  category: string;
  accent: "lilac" | "sage" | "dusty";
  simple: string;
  happened: string;
  matters: string;
  applies: string;
  undecided: string;
  sources: { name: string; url: string }[];
};

export const PARLIAMENT: ParliamentItem[] = [];

export type DiscussLabel = "fact" | "opinion" | "source" | "question";
export type DiscussPost = {
  id: string;
  girl: Girl;
  label: DiscussLabel;
  text: string;
  source?: string;
  same: number;
  time: string;
};

export const DISCUSS_SEED: DiscussPost[] = [];

export type Channel = { id: string; name: string; unread?: number };
export type ChatCrew = { id: string; name: string; grad: string; tempEnd?: string; channels: Channel[] };
export type Msg = { id: string; girl: Girl; text: string; time: string; system?: boolean };

export const CHAT_CREWS: ChatCrew[] = [];
export const CHAT_MSGS: Record<string, Msg[]> = {};

export type PinKind = "medical" | "metro" | "water" | "exit" | "lit";
export const PIN_META: Record<PinKind, { label: string; color: string }> = {
  medical: { label: "first aid",       color: "#be4560" },
  metro:   { label: "metro gate",      color: "#7b93b8" },
  water:   { label: "water point",     color: "#87a97f" },
  exit:    { label: "exit",            color: "#f3d89b" },
  lit:     { label: "well-lit route",  color: "#a283bd" },
};

export type MapPin = { id: string; kind: PinKind; x: number; y: number; name: string; dist: string };
export const MAP_PINS: MapPin[] = [];

export type CrewStatus = { girl: Girl; state: "good" | "check" | "help"; note: string; time: string };
export const CREW_STATUS: CrewStatus[] = [];

export type Spill = { id: string; area: string; category: string; text: string; time: string; verifyCount: number };
export const SPILL_SEED: Spill[] = [];

export const HELPLINES = [
  { name: "emergency",         num: "112"        },
  { name: "women helpline",    num: "1091"       },
  { name: "women in distress", num: "181"        },
  { name: "cyber cell",        num: "1930"       },
];
