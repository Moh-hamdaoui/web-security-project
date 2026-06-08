/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,

  // Fix ZAP [10037]: supprime le header X-Powered-By: Next.js
  poweredByHeader: false,

  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3", "bcryptjs", "jsonwebtoken"],
  },

  async headers() {
    const isDev = process.env.NODE_ENV === "development";

    // CSP dev : permissive pour HMR + eval() + WebSocket
    // CSP prod : stricte — corrige ZAP [10055] (directives manquantes)
    const csp = isDev
      ? [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "connect-src 'self' ws://localhost:*",
          "img-src 'self' data:",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "object-src 'none'",
        ].join("; ")
      : [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "connect-src 'self'",
          "font-src 'self'",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "object-src 'none'",
        ].join("; ");

    return [
      {
        // Fix ZAP [10049]: assets statiques Next.js doivent être cachés longtemps
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          // Anti-clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // MIME sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Referrer
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Feature policy
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // CSP — corrige ZAP [10055]
          { key: "Content-Security-Policy", value: csp },
          // Fix ZAP [90004]: Cross-Origin Isolation
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },

  images: {
    remotePatterns: [],
  },
};

module.exports = nextConfig;
