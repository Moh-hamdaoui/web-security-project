// ⚠️  VULN: Security Misconfiguration — middleware qui ne protège rien
// Les routes /admin/* ne sont pas protégées ici, uniquement côté client
// Un attaquant peut donc appeler directement /api/admin/* sans passer par l'UI

import { NextResponse } from "next/server";

export function middleware(request) {
  // ⚠️  Aucune vérification du token JWT ici
  // Les routes API admin sont censées être protégées,
  // mais le middleware ne fait rien de bloquant
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
