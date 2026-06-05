// ⚠️  VULN: IDOR + Mass Assignment
// CWE-639 / OWASP A01:2021 (IDOR)
// CWE-915 / OWASP A08:2021 (Mass Assignment)
//
// GET  : retourne le mot de passe en clair + accessible par n'importe quel user
// PUT  : accepte tous les champs sans whitelist — un user peut s'auto-promouvoir admin
//        Payload : {"role": "admin"}  → élévation de privilèges complète

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

export async function PUT(request, { params }) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const db = getDb();

    const target = db.prepare("SELECT * FROM users WHERE id = ?").get(params.id);
    if (!target) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // ⚠️  VULN: Mass Assignment — aucune whitelist sur les champs acceptés
    // Le champ "role" est extrait et appliqué directement sans contrôle
    // Payload malveillant : {"username": "alice", "role": "admin"}
    const { username, email, password, role } = body;

    db.prepare(`
      UPDATE users SET
        username = COALESCE(?, username),
        email    = COALESCE(?, email),
        password = COALESCE(?, password),
        role     = COALESCE(?, role)
      WHERE id = ?
    `).run(
      username || null,
      email    || null,
      password || null,
      role     || null,   // ⚠️  le rôle est modifiable par n'importe qui
      params.id
    );

    const updated = db
      .prepare("SELECT id, username, email, role, created_at FROM users WHERE id = ?")
      .get(params.id);

    return NextResponse.json({ user: updated });
  } catch (err) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
