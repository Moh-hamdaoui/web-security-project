import { NextResponse } from "next/server";

// jsonwebtoken n'est pas compatible Edge Runtime — décodage manuel du payload JWT
// La vérification cryptographique complète est faite dans chaque route API (Node.js runtime)
function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Conversion base64url → base64 standard + padding requis par atob()
    const b64url = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64url + "=".repeat((4 - (b64url.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

const PUBLIC_PATHS = ["/", "/login", "/register", "/api/auth/login", "/api/auth/register"];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const cookieToken = request.cookies.get("token")?.value;
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = cookieToken || bearerToken;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const payload = decodeJwtPayload(token);

  // Token mal formé ou expiré
  if (!payload || (payload.exp && payload.exp < Date.now() / 1000)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Protection des routes admin
  if ((pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) && payload.role !== "admin") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
