// ⚠️  VULN: IDOR — accès/modification/suppression d'un ticket par simple changement d'ID
// CWE-639 / OWASP A01:2021
// GET  /api/tickets/1  → alice peut lire le ticket de bob
// PUT  /api/tickets/1  → alice peut modifier le ticket de bob
// DELETE /api/tickets/1 → alice peut supprimer le ticket de bob

import { getDb } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const db = getDb();
  const ticket = db.prepare(`
    SELECT t.*, u.username as author_name
    FROM tickets t
    JOIN users u ON t.user_id = u.id
    WHERE t.id = ?
  `).get(params.id);

  if (!ticket) {
    return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });
  }

  // ⚠️  Aucune vérification que ticket.user_id === user.id
  // N'importe quel user authentifié peut lire n'importe quel ticket

  const comments = db.prepare(`
    SELECT c.*, u.username
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.ticket_id = ?
    ORDER BY c.created_at ASC
  `).all(params.id);

  return NextResponse.json({ ticket, comments });
}

export async function PUT(request, { params }) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const db = getDb();

    const ticket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(params.id);
    if (!ticket) {
      return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });
    }

    // ⚠️  Pas de contrôle d'appartenance — alice peut éditer le ticket de bob
    const { title, description, status, priority } = body;

    db.prepare(`
      UPDATE tickets
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          status = COALESCE(?, status),
          priority = COALESCE(?, priority),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, description, status, priority, params.id);

    const updated = db.prepare("SELECT * FROM tickets WHERE id = ?").get(params.id);
    return NextResponse.json({ ticket: updated });
  } catch (err) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const db = getDb();
  const ticket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(params.id);

  if (!ticket) {
    return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });
  }

  // ⚠️  Aucune vérification du propriétaire ni du rôle
  db.prepare("DELETE FROM tickets WHERE id = ?").run(params.id);
  return NextResponse.json({ message: "Ticket supprimé" });
}
