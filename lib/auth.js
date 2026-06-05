import jwt from "jsonwebtoken";

// Validation lazy — ne pas throw au chargement du module (Next.js charge les modules
// avant que process.env soit garanti disponible dans certains contextes)
function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET doit faire au moins 32 caractères");
  }
  return secret;
}

function signToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: "24h" });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, getSecret());
  } catch {
    return null;
  }
}

function extractToken(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const candidate = authHeader.slice(7);
    // Ignorer les valeurs invalides envoyées par du JS client ("null", "undefined", "")
    if (candidate && candidate !== "null" && candidate !== "undefined") {
      return candidate;
    }
  }

  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(/token=([^;]+)/);
    if (match) return match[1];
  }

  return null;
}

function getAuthUser(request) {
  const token = extractToken(request);
  if (!token) return null;
  return verifyToken(token);
}

export { signToken, verifyToken, extractToken, getAuthUser };
