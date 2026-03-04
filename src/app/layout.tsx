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
  title: "Compass — もやもやから、自分だけの指針を見つける",
  description: "他者の言葉と自分のもやもやを掛け合わせ、AIが深層心理を言語化。あなただけのNow/Be/Doを導き出すインサイト・ライブラリ。",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Compass",
  },
  openGraph: {
    title: "Compass — もやもやから、自分だけの指針を見つける",
    description: "他者の言葉と自分のもやもやを掛け合わせ、深層心理を言語化するインサイト・ライブラリ。",
    siteName: "Compass",
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
