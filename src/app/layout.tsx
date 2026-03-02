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
  description: "1日1記事、知識を自分のものに。朝活のような学習習慣をつくるアプリ。",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "day1",
  },
  openGraph: {
    title: "day1 — 今日の朝を、学びではじめよう",
    description: "noteの記事を自分のものにする。毎朝の学習習慣アプリ。",
    url: "https://day1.hitokoto.tech",
    siteName: "day1",
    type: "website",
    locale: "ja_JP",
    images: [
      {
        url: "https://day1.hitokoto.tech/og-image.png",
        width: 1200,
        height: 1200,
        alt: "day1 — 今日の朝を、学びではじめよう",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "day1 — 今日の朝を、学びではじめよう",
    description: "noteの記事を自分のものにする。毎朝の学習習慣アプリ。",
    images: ["https://day1.hitokoto.tech/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FDF6EE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" href="/icons/icon-192.png" type="image/png" />
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
