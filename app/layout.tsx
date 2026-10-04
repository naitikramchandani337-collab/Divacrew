import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces, Shrikhand, DM_Sans, Caveat } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/shell";
import { SwRegister } from "@/components/sw-register";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700", "900"],
  style: ["normal", "italic"],
});
const shrikhand = Shrikhand({ subsets: ["latin"], weight: "400", variable: "--font-shrikhand" });
const dm = DM_Sans({ subsets: ["latin"], variable: "--font-dm", weight: ["400", "500", "700"], style: ["normal", "italic"] });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", weight: ["500", "700"] });

export const metadata: Metadata = {
  title: "DivaCrew — your girls. your voice. your crew.",
  description: "The internet's girls-only corner. Social. Safe. Informed.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DivaCrew",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#6e2a47",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${shrikhand.variable} ${dm.variable} ${caveat.variable}`}
    >
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="DivaCrew" />
      </head>
      <body
        className="bg-[#fff8f3] text-[#47292f] antialiased min-h-[100dvh]"
        style={{ fontFamily: "var(--font-body)", overscrollBehavior: "none" }}
      >
        <Shell>{children}</Shell>
        <SwRegister />
      </body>
    </html>
  );
}
