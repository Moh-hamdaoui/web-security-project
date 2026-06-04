// VERSION CORRIGÉE — VLN-02 (IDOR)
// Corrections appliquées :
//   1. Vérification de la propriété du ticket
//   2. Admin peut tout voir, user seulement ses tickets
//   3. Suppression soumise aux mêmes règles

import { getDb } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-secure";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const user = getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const db = getDb();
  const ticket = db.prepare(`
    SELECT t.*, u.username as author_name
    FROM tickets t JOIN users u ON t.user_id = u.id
    WHERE t.id = ?
  `).get(params.id);

  if (!ticket) return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });

  // FIX: contrôle d'accès basé sur la propriété
  if (ticket.user_id !== user.id && user.role !== "admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const comments = db.prepare(`
    SELECT c.id, c.content, c.created_at, u.username
    FROM comments c JOIN users u ON c.user_id = u.id
    WHERE c.ticket_id = ?
    ORDER BY c.created_at ASC
  `).all(params.id);

  return NextResponse.json({ ticket, comments });
}

export async function DELETE(request, { params }) {
  const user = getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const db = getDb();
  const ticket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(params.id);
  if (!ticket) return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });

  // FIX: seul le propriétaire ou un admin peut supprimer
  if (ticket.user_id !== user.id && user.role !== "admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  db.prepare("DELETE FROM tickets WHERE id = ?").run(params.id);
  return NextResponse.json({ message: "Ticket supprimé" });
}
