// ⚠️  VULN: Broken Access Control (IDOR) — un user voit TOUS les tickets via GET /api/tickets
// CWE-284 / OWASP A01:2021
// Un user authentifié peut lister les tickets de tous les autres utilisateurs

import { getDb } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const db = getDb();

  // ⚠️  Pas de filtre par user_id → tous les tickets sont retournés à tout le monde
  const tickets = db.prepare(`
    SELECT t.*, u.username as author_name
    FROM tickets t
    JOIN users u ON t.user_id = u.id
    ORDER BY t.created_at DESC
  `).all();

  return NextResponse.json({ tickets });
}

export async function POST(request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { title, description, priority } = await request.json();

    if (!title || !description) {
      return NextResponse.json({ error: "Titre et description requis" }, { status: 400 });
    }

    const db = getDb();
    const result = db
      .prepare("INSERT INTO tickets (title, description, priority, user_id) VALUES (?, ?, ?, ?)")
      .run(title, description, priority || "medium", user.id);

    const ticket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(result.lastInsertRowid);
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
