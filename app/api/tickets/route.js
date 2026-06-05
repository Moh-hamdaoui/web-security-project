import { getDb } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request) {
  const user = getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const db = getDb();

  // FIX VLN-02: admin voit tous les tickets, user voit uniquement les siens
  const tickets = user.role === "admin"
    ? db.prepare(`
        SELECT t.*, u.username as author_name
        FROM tickets t JOIN users u ON t.user_id = u.id
        ORDER BY t.created_at DESC
      `).all()
    : db.prepare(`
        SELECT t.*, u.username as author_name
        FROM tickets t JOIN users u ON t.user_id = u.id
        WHERE t.user_id = ?
        ORDER BY t.created_at DESC
      `).all(user.id);

  return NextResponse.json({ tickets });
}

export async function POST(request) {
  const user = getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const { title, description, priority } = await request.json();

    if (!title || !description) {
      return NextResponse.json({ error: "Titre et description requis" }, { status: 400 });
    }

    const VALID_PRIORITIES = ["low", "medium", "high", "critical"];
    const safePriority = VALID_PRIORITIES.includes(priority) ? priority : "medium";

    const db = getDb();
    const result = db
      .prepare("INSERT INTO tickets (title, description, priority, user_id) VALUES (?, ?, ?, ?)")
      .run(title, description, safePriority, user.id);

    const ticket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(result.lastInsertRowid);
    return NextResponse.json({ ticket }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
