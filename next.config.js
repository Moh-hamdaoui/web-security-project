/** @type {import('next').NextConfig} */

// ⚠️  VULN: Security Misconfiguration — configuration permissive
// Headers de sécurité absents, erreurs exposées

const nextConfig = {
  // Pas de Content Security Policy
  // Pas de X-Frame-Options
  // Pas de HSTS

  // ⚠️  Expose les stack traces dans les réponses API
  productionBrowserSourceMaps: true,

  // ⚠️  Pas de restriction sur les domaines d'images
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
};

module.exports = nextConfig;
