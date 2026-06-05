import { getDb } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request, { params }) {
  const user = getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const { content } = await request.json();

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "Contenu requis" }, { status: 400 });
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: "Commentaire trop long (2000 caractères max)" }, { status: 400 });
    }

    const db = getDb();

    // FIX VLN-02: vérifier que l'utilisateur a accès au ticket
    const ticket = db.prepare("SELECT id, user_id FROM tickets WHERE id = ?").get(params.id);
    if (!ticket) return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });

    if (user.role !== "admin" && ticket.user_id !== user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // FIX VLN-03 (côté serveur): le contenu est stocké tel quel mais sera échappé au rendu
    // La sanitisation XSS se fait côté client via rendu texte React (pas de dangerouslySetInnerHTML)
    const result = db
      .prepare("INSERT INTO comments (ticket_id, user_id, content) VALUES (?, ?, ?)")
      .run(params.id, user.id, content.trim());

    const comment = db.prepare(`
      SELECT c.id, c.content, c.created_at, u.username
      FROM comments c JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(result.lastInsertRowid);

    return NextResponse.json({ comment }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
