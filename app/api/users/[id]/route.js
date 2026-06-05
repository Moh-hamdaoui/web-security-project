import { getDb } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const user = getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // FIX VLN-02: un user ne peut consulter que son propre profil
  if (user.role !== "admin" && String(user.id) !== String(params.id)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const db = getDb();
  // FIX VLN-05c: password exclu de la réponse
  const target = db
    .prepare("SELECT id, username, email, role, created_at FROM users WHERE id = ?")
    .get(params.id);

  if (!target) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  return NextResponse.json({ user: target });
}

export async function PUT(request, { params }) {
  const user = getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // FIX VLN-02 + VLN-06: seul le user lui-même (ou admin) peut modifier son profil
  if (user.role !== "admin" && String(user.id) !== String(params.id)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  try {
    const body = await request.json();

    // FIX VLN-06: whitelist stricte — le champ "role" est ignoré même s'il est envoyé
    // Un utilisateur ne peut modifier que son username et son email
    const { username, email } = body;

    if (!username && !email) {
      return NextResponse.json({ error: "Aucun champ valide fourni" }, { status: 400 });
    }

    const db = getDb();
    const target = db.prepare("SELECT * FROM users WHERE id = ?").get(params.id);
    if (!target) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

    db.prepare(`
      UPDATE users SET
        username = COALESCE(?, username),
        email    = COALESCE(?, email)
      WHERE id = ?
    `).run(username || null, email || null, params.id);

    const updated = db
      .prepare("SELECT id, username, email, role, created_at FROM users WHERE id = ?")
      .get(params.id);

    return NextResponse.json({ user: updated });
  } catch {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
