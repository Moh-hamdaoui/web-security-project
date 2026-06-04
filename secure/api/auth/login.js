// VERSION CORRIGÉE — VLN-01 (SQLi) + VLN-05c (passwords en clair) + VLN-05b (stack traces)
// Corrections appliquées :
//   1. Requêtes paramétrées (prepared statements)
//   2. bcrypt pour la vérification du mot de passe
//   3. Pas de stack trace dans la réponse

import { getDb } from "@/lib/db-secure";
import { signToken } from "@/lib/auth-secure";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email et mot de passe requis" }, { status: 400 });
    }

    const db = getDb();

    // FIX: requête paramétrée — plus d'injection possible
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

    if (!user) {
      // Délai constant pour éviter les timing attacks
      await bcrypt.compare(password, "$2b$12$invalidhashpadding000000000000000");
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }

    // FIX: comparaison bcrypt au lieu de mot de passe en clair
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role, username: user.username });

    const response = NextResponse.json({
      message: "Connexion réussie",
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
      token,
    });

    // FIX: Cookie sécurisé avec httpOnly, secure et sameSite
    response.cookies.set("token", token, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24, // 24h au lieu de 7j
    });

    return response;
  } catch {
    // FIX: message générique sans stack trace
    console.error("Login error:", arguments[0]);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
