// ⚠️  VULN: Broken Access Control — vérification du rôle côté client uniquement
// Le middleware Next.js ne protège pas cette route
// CWE-285 / OWASP A01:2021

import { getDb } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // ⚠️  La vérification du rôle admin est présente ici mais elle est contournable
  // car le JWT n'est pas correctement validé côté serveur dans tous les contextes
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const db = getDb();
  // ⚠️  Retourne les mots de passe en clair dans la réponse
  const users = db.prepare("SELECT id, username, email, password, role, created_at FROM users").all();

  return NextResponse.json({ users });
}

export async function DELETE(request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { userId } = await request.json();
  const db = getDb();
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);

  return NextResponse.json({ message: "Utilisateur supprimé" });
}
