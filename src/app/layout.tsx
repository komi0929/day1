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
        <link rel="icon" href="/favicon.ico" sizes="any" />
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
