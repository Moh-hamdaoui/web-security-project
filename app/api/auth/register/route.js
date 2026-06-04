import { getDb } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { username, email, password } = await request.json();

    if (!username || !email || !password) {
      return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 });
    }

    const db = getDb();

    // ⚠️  VULN: Pas de hashage du mot de passe — stocké en clair
    // CWE-256 / OWASP A02:2021
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return NextResponse.json({ error: "Email déjà utilisé" }, { status: 409 });
    }

    const result = db
      .prepare("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'user')")
      .run(username, email, password);

    const token = signToken({ id: result.lastInsertRowid, email, role: "user", username });

    const response = NextResponse.json({
      message: "Compte créé",
      user: { id: result.lastInsertRowid, username, email, role: "user" },
      token,
    }, { status: 201 });

    response.cookies.set("token", token, { path: "/" });
    return response;
  } catch (err) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
