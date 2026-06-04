// ⚠️  VULN: IDOR — un user peut lire le profil de n'importe quel autre user
// incluant son mot de passe en clair
// CWE-639 / OWASP A01:2021

import { getDb } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const db = getDb();

  // ⚠️  Pas de vérification que params.id === user.id
  // Et le mot de passe en clair est inclus dans la réponse
  const target = db
    .prepare("SELECT id, username, email, password, role, created_at FROM users WHERE id = ?")
    .get(params.id);

  if (!target) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  return NextResponse.json({ user: target });
}
