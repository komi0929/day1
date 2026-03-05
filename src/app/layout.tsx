import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "あなたのための1冊 — noteから運命の本を見つける",
  description: "noteに書いたあなたの思考をAIが徹底的に読み解き、あなたの今に寄り添う「運命の1冊」をリコメンド。深夜の私設図書館から、編集者があなたへ手紙を添えて本を届けます。",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "あなたのための1冊",
  },
  openGraph: {
    title: "あなたのための1冊 — noteから運命の本を見つける",
    description: "noteに書いたあなたの思考をAIが読み解き、運命の1冊を見つけます。",
    siteName: "あなたのための1冊",
    type: "website",
    locale: "ja_JP",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1A1512",
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
        {/* Grainy noise overlay — fixed, covers entire viewport */}
        <div className="noise-bg" aria-hidden="true" />

        <div className="content-layer">
          {children}
        </div>
      </body>
    </html>
  );
}
