import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://thumbnail.image.rakuten.co.jp https://books.google.com https://books.googleusercontent.com https://cover.openbd.jp https://ndlsearch.ndl.go.jp https://cover.hanmoto.com https://img.hanmoto.com; connect-src 'self' https://*.supabase.co https://*.supabase.in https://generativelanguage.googleapis.com; font-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      // OGP画像 — CSP/X-Frame-Optionsなし、クローラーが自由に取得可能に
      {
        source: "/ogp.png",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
      {
        source: "/og-image.png",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
      // その他すべてのパス — セキュリティヘッダー適用
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
