// ⚠️  VULN: Clé JWT faible, durée excessive, token accepté en query string
// CWE-321 / OWASP A07:2021

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "secret123";

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ⚠️  Accepte le token depuis l'URL (?token=...) → fuite dans les logs serveur
function extractToken(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);

  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(/token=([^;]+)/);
    if (match) return match[1];
  }

  const url = new URL(request.url);
  return url.searchParams.get("token");
}

function getAuthUser(request) {
  const token = extractToken(request);
  if (!token) return null;
  return verifyToken(token);
}

export { signToken, verifyToken, extractToken, getAuthUser };
