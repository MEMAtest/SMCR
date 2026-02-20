import type { Metadata } from "next";
import { Playfair_Display, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/auth/SessionProvider";
import { Analytics } from "@vercel/analytics/react";

const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

const ICON_VERSION = "20260220";

export const metadata: Metadata = {
  title: "MEMA Consultants",
  description:
    "Design, evidence, and export Senior Managers & Certification Regime packs with a premium guided experience.",
  icons: {
    icon: [
      { url: `/favicon.ico?v=${ICON_VERSION}`, sizes: "any" },
      { url: `/icon.svg?v=${ICON_VERSION}`, type: "image/svg+xml" },
    ],
    shortcut: [{ url: `/favicon.ico?v=${ICON_VERSION}` }],
    apple: [{ url: `/apple-icon.png?v=${ICON_VERSION}`, sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${inter.variable} ${plexMono.variable} bg-midnight text-sand min-h-screen`}
      >
        <SessionProvider>{children}</SessionProvider>
        <Analytics />
      </body>
    </html>
  );
}
