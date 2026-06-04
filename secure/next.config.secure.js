// VERSION CORRIGÉE — VLN-05d (Security Misconfiguration — headers absents)

/** @type {import('next').NextConfig} */
const secureConfig = {
  // Désactiver les source maps en production
  productionBrowserSourceMaps: false,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Empêche le clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Empêche le MIME sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Force HTTPS pour 2 ans
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // Limite les infos de référent
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Désactive les fonctionnalités sensibles
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // CSP stricte — ajuster selon les ressources tierces utilisées
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",  // 'unsafe-inline' à retirer si possible avec nonces
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "connect-src 'self'",
              "font-src 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },

  images: {
    // FIX: liste blanche explicite au lieu de '**'
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
};

module.exports = secureConfig;
