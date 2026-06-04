// VERSION CORRIGÉE — VLN-04 (SSRF)
// Corrections appliquées :
//   1. Validation de l'URL contre une liste blanche de domaines
//   2. Blocage des IPs privées / link-local / loopback
//   3. Restriction aux protocoles http/https uniquement
//   4. Résolution DNS vérifiée pour bloquer les rebinding attacks

import { getAuthUser } from "@/lib/auth-secure";
import { NextResponse } from "next/server";
import { URL } from "url";
import dns from "dns/promises";

// Liste blanche des domaines autorisés pour les webhooks
const ALLOWED_WEBHOOK_HOSTS = [
  "hooks.slack.com",
  "discord.com",
  "api.github.com",
  "hooks.zapier.com",
];

// Plages d'IPs privées à bloquer
const PRIVATE_IP_PATTERNS = [
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^127\.\d+\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fc[0-9a-f]{2}:/i,
  /^fe80:/i,
];

async function isUrlSafe(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { safe: false, reason: "URL invalide" };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { safe: false, reason: "Protocole non autorisé (uniquement http/https)" };
  }

  if (!ALLOWED_WEBHOOK_HOSTS.includes(parsed.hostname)) {
    return { safe: false, reason: `Domaine non autorisé. Autorisés: ${ALLOWED_WEBHOOK_HOSTS.join(", ")}` };
  }

  // Résoudre le DNS et vérifier que l'IP résolue n'est pas privée (anti-rebinding)
  try {
    const addresses = await dns.resolve4(parsed.hostname);
    for (const ip of addresses) {
      if (PRIVATE_IP_PATTERNS.some((r) => r.test(ip))) {
        return { safe: false, reason: `Résolution DNS vers IP privée bloquée: ${ip}` };
      }
    }
  } catch {
    return { safe: false, reason: "Résolution DNS échouée" };
  }

  return { safe: true };
}

export async function POST(request) {
  const user = getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: "URL requise" }, { status: 400 });

    // FIX: validation complète de l'URL avant la requête
    const { safe, reason } = await isUrlSafe(url);
    if (!safe) {
      return NextResponse.json({ error: `URL bloquée: ${reason}` }, { status: 400 });
    }

    const response = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "TicketApp-Webhook/1.0" },
      signal: AbortSignal.timeout(5000),
    });

    // FIX: on ne retourne que le statut, pas le contenu complet
    return NextResponse.json({
      status: response.status,
      message: response.ok ? "Webhook accessible" : "Webhook a retourné une erreur",
    });
  } catch {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
