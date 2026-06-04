// ⚠️  VULN: SSRF (Server-Side Request Forgery)
// CWE-918 / OWASP A10:2021
//
// Endpoint censé tester les webhooks, mais sans validation de l'URL cible.
// Exploits possibles :
//   - Accès aux métadonnées cloud : http://169.254.169.254/latest/meta-data/
//   - Scan du réseau interne : http://192.168.1.1, http://localhost:8080
//   - Lecture de fichiers via file:// (selon l'environnement)
//   - Contournement de firewall en pivotant par le serveur

import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  try {
    const { url, method = "GET" } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL requise" }, { status: 400 });
    }

    // ⚠️  Aucune validation de l'URL — pas de liste blanche, pas de blocage des IPs privées
    const response = await fetch(url, {
      method,
      headers: { "User-Agent": "TicketApp-Webhook/1.0" },
      signal: AbortSignal.timeout(5000),
    });

    const contentType = response.headers.get("content-type") || "";
    let body;

    if (contentType.includes("application/json")) {
      body = await response.json();
    } else {
      body = await response.text();
    }

    // ⚠️  Retourne le contenu complet de la réponse interne au client
    return NextResponse.json({
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
