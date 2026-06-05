import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

// FIX VLN-04: liste blanche stricte des domaines autorisés pour les webhooks
const ALLOWED_HOSTS = [
  "hooks.slack.com",
  "discord.com",
  "api.github.com",
  "hooks.zapier.com",
];

// Plages d'IPs privées / link-local à bloquer (anti-SSRF)
const PRIVATE_IP_RE = [
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

function validateUrl(rawUrl) {
  let parsed;
  try { parsed = new URL(rawUrl); } catch {
    return "URL invalide";
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return "Protocole non autorisé (http ou https uniquement)";
  }
  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return `Domaine non autorisé. Domaines acceptés : ${ALLOWED_HOSTS.join(", ")}`;
  }
  if (PRIVATE_IP_RE.some((r) => r.test(parsed.hostname))) {
    return "Adresse IP privée ou locale non autorisée";
  }
  return null;
}

export async function POST(request) {
  const user = getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: "URL requise" }, { status: 400 });

    // FIX VLN-04: validation avant tout appel réseau
    const error = validateUrl(url);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "TicketApp-Webhook/1.0",
      },
      body: JSON.stringify({ test: true }),
      signal: AbortSignal.timeout(5000),
    });

    // FIX VLN-04: on ne retourne que le statut HTTP, pas le corps de la réponse
    return NextResponse.json({
      status: response.status,
      ok: response.ok,
      message: response.ok ? "Webhook joignable" : "Le webhook a répondu avec une erreur",
    });
  } catch {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
