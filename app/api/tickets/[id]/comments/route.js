import { getDb } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request, { params }) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    // ⚠️  VULN: XSS Stocké — le contenu du commentaire est sauvegardé tel quel
    // et sera rendu via dangerouslySetInnerHTML côté client
    const { content } = await request.json();

    if (!content) {
      return NextResponse.json({ error: "Contenu requis" }, { status: 400 });
    }

    const db = getDb();
    const ticket = db.prepare("SELECT id FROM tickets WHERE id = ?").get(params.id);
    if (!ticket) {
      return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });
    }

    // ⚠️  Aucune sanitisation du contenu HTML/JS avant stockage
    const result = db
      .prepare("INSERT INTO comments (ticket_id, user_id, content) VALUES (?, ?, ?)")
      .run(params.id, user.id, content);

    const comment = db.prepare(`
      SELECT c.*, u.username FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(result.lastInsertRowid);

    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
