"use client";

import dynamic from "next/dynamic";

// Load FeedPage client-only to avoid SSR/hydration mismatch
const FeedPage = dynamic(() => import("@/app/feed/page"), { ssr: false });

export default function RootPage() {
  return <FeedPage />;
}
