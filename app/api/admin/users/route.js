import { getDb } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request) {
  const user = getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const db = getDb();
  // FIX VLN-05c: password exclu de la réponse
  const users = db.prepare("SELECT id, username, email, role, created_at FROM users").all();
  return NextResponse.json({ users });
}

export async function DELETE(request) {
  const user = getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  try {
    const { userId } = await request.json();

    if (!userId || typeof userId !== "number") {
      return NextResponse.json({ error: "userId invalide" }, { status: 400 });
    }

    // Empêcher la suppression du compte admin courant
    if (userId === user.id) {
      return NextResponse.json({ error: "Impossible de supprimer son propre compte" }, { status: 400 });
    }

    const db = getDb();
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    return NextResponse.json({ message: "Utilisateur supprimé" });
  } catch {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
