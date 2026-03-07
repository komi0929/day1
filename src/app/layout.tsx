import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
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
  title: "compass | あなたのnoteから「今読んでほしい一冊」をお届けします",
  description: "compassは、あなたの書いたnoteから「今読んでほしい一冊」をおすすめするアプリ。URLをひとつ入れるだけで、悩みや願いを読み解き、あなたの背中をそっと押してくれる本を、お手紙とともにお届けします。",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "compass",
  },
  openGraph: {
    title: "compass | あなたのnoteから「今読んでほしい一冊」をお届けします",
    description: "compassは、あなたの書いたnoteから「今読んでほしい一冊」をおすすめするアプリ。URLをひとつ入れるだけで、悩みや願いを読み解き、あなたの背中をそっと押してくれる本を、お手紙とともにお届けします。",
    siteName: "compass",
    type: "website",
    locale: "ja_JP",
    images: [
      {
        url: "/ogp.png",
        width: 1200,
        height: 630,
        alt: "compass — あなたの書いたnoteから「今読んでほしい一冊」をおすすめするアプリ",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "compass | あなたのnoteから「今読んでほしい一冊」をお届けします",
    description: "あなたの書いたnoteから「今読んでほしい一冊」をおすすめするアプリ。",
    images: ["/ogp.png"],
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
        {/* 接続プリウォーム: DNS+TCP+TLS handshakeを事前に完了 (~200-400ms短縮) */}
        <link rel="preconnect" href="https://app.rakuten.co.jp" />
        <link rel="preconnect" href="https://thumbnail.image.rakuten.co.jp" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.googleapis.com" />
        <link rel="preconnect" href="https://books.google.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://app.rakuten.co.jp" />
        <link rel="dns-prefetch" href="https://thumbnail.image.rakuten.co.jp" />
        <link rel="dns-prefetch" href="https://www.googleapis.com" />
        <link rel="dns-prefetch" href="https://books.google.com" />
        <link rel="dns-prefetch" href="https://note.com" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
