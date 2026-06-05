import { getDb } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

function canAccess(ticket, user) {
  return user.role === "admin" || ticket.user_id === user.id;
}

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

  // FIX VLN-02: vérification de la propriété
  if (!canAccess(ticket, user)) {
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

export async function PUT(request, { params }) {
  const user = getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const db = getDb();
    const ticket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(params.id);
    if (!ticket) return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });

    // FIX VLN-02: seul le propriétaire ou un admin peut modifier
    if (!canAccess(ticket, user)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, priority } = body;

    // Seul l'admin peut changer le statut
    const status = user.role === "admin" ? body.status : undefined;

    const VALID_STATUSES   = ["open", "in_progress", "resolved", "closed"];
    const VALID_PRIORITIES = ["low", "medium", "high", "critical"];

    db.prepare(`
      UPDATE tickets
      SET title       = COALESCE(?, title),
          description = COALESCE(?, description),
          status      = COALESCE(?, status),
          priority    = COALESCE(?, priority),
          updated_at  = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title || null,
      description || null,
      status && VALID_STATUSES.includes(status) ? status : null,
      priority && VALID_PRIORITIES.includes(priority) ? priority : null,
      params.id
    );

    const updated = db.prepare("SELECT * FROM tickets WHERE id = ?").get(params.id);
    return NextResponse.json({ ticket: updated });
  } catch {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const user = getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const db = getDb();
  const ticket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(params.id);
  if (!ticket) return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });

  // FIX VLN-02: seul le propriétaire ou un admin peut supprimer
  if (!canAccess(ticket, user)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  db.prepare("DELETE FROM tickets WHERE id = ?").run(params.id);
  return NextResponse.json({ message: "Ticket supprimé" });
}
