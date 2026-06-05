import { getDb } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

// Rate limiting en mémoire : max 5 tentatives par IP sur 15 minutes
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function getRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + WINDOW_MS;
  }
  return entry;
}

export async function POST(request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
             || request.headers.get("x-real-ip")
             || "unknown";

    // FIX: rate limiting — bloque les bruteforce
    const limit = getRateLimit(ip);
    if (limit.count >= MAX_ATTEMPTS) {
      const retryAfter = Math.ceil((limit.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Trop de tentatives. Réessayez dans quelques minutes." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }

    const db = getDb();

    // FIX VLN-01: requête paramétrée
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

    // FIX VLN-01 + VLN-05c: bcrypt à durée constante (anti timing attack)
    const dummyHash = "$2b$12$invalidhashpadding000000000000000000000000000000000000";
    const valid = user
      ? await bcrypt.compare(password, user.password)
      : await bcrypt.compare(password, dummyHash);

    if (!user || !valid) {
      // Incrémenter le compteur seulement en cas d'échec
      limit.count++;
      loginAttempts.set(ip, limit);
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }

    // Succès — réinitialiser le compteur
    loginAttempts.delete(ip);

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      username: user.username,
    });

    // FIX: token uniquement dans le cookie httpOnly — pas dans le JSON
    // Protège contre le vol de token via XSS (localStorage accessible au JS)
    const response = NextResponse.json({
      message: "Connexion réussie",
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
    });

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
