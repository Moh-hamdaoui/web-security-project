// ⚠️  VULN: SQL Injection — requête construite par concaténation de chaînes
// CWE-89 / OWASP A03:2021
// Payload: email = ' OR '1'='1' --   → bypass complet de l'authentification

import { getDb } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    const db = getDb();

    // ⚠️  INJECTION SQL — interpolation directe sans paramètres liés
    const query = `SELECT * FROM users WHERE email = '${email}' AND password = '${password}'`;

    // ⚠️  VULN: Security Misconfiguration — la requête SQL est loggée en clair
    if (process.env.DEBUG === "true") {
      console.log("[DEBUG] Login query:", query);
    }

    const user = db.prepare(query).get();

    if (!user) {
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect" },
        { status: 401 }
      );
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role, username: user.username });

    const response = NextResponse.json({
      message: "Connexion réussie",
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
      token,
    });

    // Cookie sans HttpOnly ni Secure ni SameSite → accessible via JS, pas de protection CSRF
    response.cookies.set("token", token, { path: "/" });

    return response;
  } catch (err) {
    // ⚠️  VULN: Stack trace complète exposée au client
    return NextResponse.json(
      { error: err.message, stack: err.stack },
      { status: 500 }
    );
  }
}
