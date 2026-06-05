import { getDb } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(request) {
  try {
    const { username, email, password } = await request.json();

    if (!username || !email || !password) {
      return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Mot de passe trop court (8 caractères minimum)" }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return NextResponse.json({ error: "Email déjà utilisé" }, { status: 409 });
    }

    // FIX VLN-05c: hashage bcrypt avant stockage
    const hashed = await bcrypt.hash(password, 12);
    const result = db
      .prepare("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'user')")
      .run(username, email, hashed);

    const token = signToken({ id: result.lastInsertRowid, email, role: "user", username });

    const response = NextResponse.json({
      message: "Compte créé",
      user: { id: result.lastInsertRowid, username, email, role: "user" },
      token,
    }, { status: 201 });

    // FIX VLN-05e: cookie sécurisé
    response.cookies.set("token", token, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
