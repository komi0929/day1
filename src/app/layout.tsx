import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "day1 — 今日の朝を、学びではじめよう",
  description: "1日1記事、5分間で知識を自分のものに。朝活のような学習習慣をつくるアプリ。",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "day1",
  },
  openGraph: {
    title: "day1 — 今日の朝を、学びではじめよう",
    description: "noteの記事を血肉にする。1日5分の朝習慣アプリ。",
    url: "https://day1.hitokoto.tech",
    siteName: "day1",
    type: "website",
    locale: "ja_JP",
  },
  twitter: {
    card: "summary",
    title: "day1 — 今日の朝を、学びではじめよう",
    description: "noteの記事を血肉にする。1日5分の朝習慣アプリ。",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1A1716",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-dvh`}
      >
        {/* Grainy noise overlay — fixed, covers entire viewport */}
        <div className="noise-bg" aria-hidden="true" />

        <AuthProvider>
          <div className="content-layer">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
