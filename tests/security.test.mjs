/**
 * Tests de sécurité applicatifs
 *
 * Sur branche main (vulnérable) : la majorité échoue → attendu, non-bloquant
 * Sur branche secure-version    : tout doit passer  → bloquant si échec
 *
 * Usage : node tests/security.test.mjs
 */

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const results = { pass: 0, fail: 0, errors: [] };

function pass(name) {
  console.log(`  ✅ PASS  ${name}`);
  results.pass++;
}
function fail(name, detail) {
  console.error(`  ❌ FAIL  ${name}`);
  console.error(`         → ${detail}`);
  results.fail++;
  results.errors.push(name);
}

async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, data, headers: res.headers };
}

async function login(email, password) {
  return req("POST", "/api/auth/login", { email, password });
}

// ─────────────────────────────────────────────
// VLN-01 : SQL Injection
// ─────────────────────────────────────────────
async function test_sqli() {
  console.log("\n[VLN-01] SQL Injection");

  // Payload classique de bypass
  const bypass = await login("' OR '1'='1' --", "x");
  if (bypass.status === 401)
    pass("Payload SQLi retourne 401 — injection bloquée");
  else
    fail("SQLi bypass", `attendu 401, reçu ${bypass.status} — l'injection fonctionne`);

  // Login légitime fonctionne quand même
  const legit = await login("alice@example.com", "alice123");
  if (legit.status === 200 && legit.data.token)
    pass("Login légitime fonctionne normalement");
  else
    fail("Login légitime", `attendu 200+token, reçu ${legit.status}`);
}

// ─────────────────────────────────────────────
// VLN-02 : IDOR
// ─────────────────────────────────────────────
async function test_idor() {
  console.log("\n[VLN-02] IDOR / Broken Access Control");

  const lr = await login("alice@example.com", "alice123");
  if (lr.status !== 200) { fail("Login alice", `status ${lr.status}`); return; }
  const token = lr.data.token;

  // Alice tente d'accéder au ticket 2 (appartient à bob, user_id=3)
  const r = await req("GET", "/api/tickets/2", null, token);
  if (r.status === 403)
    pass("IDOR ticket — accès refusé (403) au ticket d'un autre user");
  else
    fail("IDOR ticket", `attendu 403, reçu ${r.status} — alice voit le ticket de bob`);

  // La liste des tickets ne doit contenir que ceux d'alice (user_id=2)
  const list = await req("GET", "/api/tickets", null, token);
  if (list.status === 200) {
    const foreign = (list.data.tickets || []).filter((t) => t.user_id !== 2);
    if (foreign.length === 0)
      pass("IDOR liste — tickets filtrés par propriétaire");
    else
      fail("IDOR liste", `${foreign.length} ticket(s) étranger(s) visible(s) par alice`);
  }

  // Alice ne peut pas supprimer le ticket de bob
  const del = await req("DELETE", "/api/tickets/2", null, token);
  if (del.status === 403)
    pass("IDOR delete — suppression refusée (403)");
  else
    fail("IDOR delete", `attendu 403, reçu ${del.status} — alice peut supprimer le ticket de bob`);
}

// ─────────────────────────────────────────────
// VLN-03 : XSS Stocké
// ─────────────────────────────────────────────
async function test_xss() {
  console.log("\n[VLN-03] XSS Stocké");

  const lr = await login("alice@example.com", "alice123");
  if (lr.status !== 200) { fail("Login alice", `status ${lr.status}`); return; }
  const token = lr.data.token;

  // Poster un commentaire XSS
  const xssPayload = '<img src=x onerror="alert(document.cookie)">';
  const post = await req("POST", "/api/tickets/1/comments", { content: xssPayload }, token);

  if (post.status === 201) {
    const stored = post.data.comment?.content || "";
    // Le contenu ne doit pas être stocké tel quel (doit être sanitisé ou échappé)
    if (!stored.includes("<img") && !stored.includes("onerror"))
      pass("XSS commentaire — payload HTML sanitisé avant stockage");
    else
      fail("XSS commentaire", `payload stocké tel quel en base : "${stored}"`);
  } else {
    fail("XSS post commentaire", `status inattendu ${post.status}`);
  }
}

// ─────────────────────────────────────────────
// VLN-04 : SSRF
// ─────────────────────────────────────────────
async function test_ssrf() {
  console.log("\n[VLN-04] SSRF");

  const lr = await login("admin@tickets.local", "admin123");
  if (lr.status !== 200) { fail("Login admin", `status ${lr.status}`); return; }
  const token = lr.data.token;

  // URL interne (loopback) — doit être bloquée
  const loopback = await req("POST", "/api/admin/fetch-url", { url: "http://127.0.0.1:3000/" }, token);
  if (loopback.status === 400)
    pass("SSRF loopback — URL interne rejetée (400)");
  else
    fail("SSRF loopback", `attendu 400, reçu ${loopback.status} — requête interne exécutée`);

  // IP link-local (métadonnées cloud) — doit être bloquée
  const metadata = await req("POST", "/api/admin/fetch-url", { url: "http://169.254.169.254/" }, token);
  if (metadata.status === 400)
    pass("SSRF metadata IP — 169.254.169.254 rejetée (400)");
  else
    fail("SSRF metadata IP", `attendu 400, reçu ${metadata.status} — IP privée non bloquée`);

  // Domaine non autorisé — doit être bloqué
  const external = await req("POST", "/api/admin/fetch-url", { url: "https://evil.com/" }, token);
  if (external.status === 400)
    pass("SSRF domaine — domaine non autorisé rejeté (400)");
  else
    fail("SSRF domaine", `attendu 400, reçu ${external.status} — domaine arbitraire accepté`);
}

// ─────────────────────────────────────────────
// VLN-05c : Mot de passe exposé
// ─────────────────────────────────────────────
async function test_password_exposure() {
  console.log("\n[VLN-05c] Exposition mot de passe");

  const lr = await login("alice@example.com", "alice123");
  if (lr.status !== 200) { fail("Login alice", `status ${lr.status}`); return; }
  const token = lr.data.token;

  // GET /api/users/1 ne doit pas retourner le mot de passe
  const r = await req("GET", "/api/users/1", null, token);
  if (r.data.user?.password !== undefined)
    fail("Password exposé", `champ "password" présent dans GET /api/users/1 : "${String(r.data.user.password).slice(0, 30)}..."`);
  else
    pass("Champ password absent de la réponse GET /api/users");

  // La réponse de login ne doit pas contenir le mot de passe
  if (lr.data.user?.password !== undefined)
    fail("Password dans login", `champ "password" présent dans la réponse de login`);
  else
    pass("Champ password absent de la réponse de login");
}

// ─────────────────────────────────────────────
// VLN-06 : Mass Assignment
// ─────────────────────────────────────────────
async function test_mass_assignment() {
  console.log("\n[VLN-06] Mass Assignment");

  // Login alice (role: user)
  const lr = await login("alice@example.com", "alice123");
  if (lr.status !== 200) { fail("Login alice", `status ${lr.status}`); return; }
  const token = lr.data.token;
  const aliceId = lr.data.user.id;

  // Tentative d'auto-promotion admin via le champ "role"
  const r = await req("PUT", `/api/users/${aliceId}`, { username: "alice", role: "admin" }, token);

  if (r.status === 200 && r.data.user?.role === "admin") {
    fail("Mass Assignment rôle", "alice a pu changer son rôle en admin — mass assignment non protégé");
    // Remettre alice en user pour ne pas casser les autres tests
    await req("PUT", `/api/users/${aliceId}`, { role: "user" }, token);
  } else if (r.status === 200 && r.data.user?.role === "user") {
    pass("Mass Assignment bloqué — champ role ignoré (whitelist)");
  } else if (r.status === 400 || r.status === 403) {
    pass(`Mass Assignment bloqué — requête rejetée (${r.status})`);
  } else {
    fail("Mass Assignment", `réponse inattendue : status ${r.status}, role=${r.data.user?.role}`);
  }

  // Vérifier qu'on ne peut pas changer le rôle d'un autre user
  const r2 = await req("PUT", `/api/users/1`, { role: "user" }, token);
  if (r2.status === 403)
    pass("Mass Assignment IDOR — modification d'un autre user refusée (403)");
  else if (r2.status === 200 && r2.data.user?.role !== undefined)
    fail("Mass Assignment IDOR", `alice a modifié l'utilisateur id=1 (status ${r2.status})`);
}

// ─────────────────────────────────────────────
// VLN-05b : Stack trace exposée
// ─────────────────────────────────────────────
async function test_stack_trace() {
  console.log("\n[VLN-05b] Stack trace");

  // Déclencher une erreur 500 via un body invalide
  const r = await req("POST", "/api/auth/login", { email: null, password: null });
  if (r.data.stack)
    fail("Stack trace exposée", `champ "stack" présent dans la réponse d'erreur`);
  else
    pass("Aucune stack trace dans les réponses d'erreur");
}

// ─────────────────────────────────────────────
// VLN-05e : Cookie HttpOnly
// ─────────────────────────────────────────────
async function test_cookie_httponly() {
  console.log("\n[VLN-05e] Cookie sécurisé");

  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "alice@example.com", password: "alice123" }),
  });

  const setCookie = res.headers.get("set-cookie") || "";
  if (setCookie.toLowerCase().includes("httponly"))
    pass("Cookie token — flag HttpOnly présent");
  else
    fail("Cookie HttpOnly", `Set-Cookie reçu : "${setCookie}"`);

  if (setCookie.toLowerCase().includes("samesite=strict"))
    pass("Cookie token — flag SameSite=Strict présent");
  else
    fail("Cookie SameSite", `Set-Cookie reçu : "${setCookie}"`);
}

// ─────────────────────────────────────────────
// Runner principal
// ─────────────────────────────────────────────
(async () => {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║       Tests de sécurité applicatifs      ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`Cible : ${BASE}`);

  try {
    await test_sqli();
    await test_idor();
    await test_xss();
    await test_ssrf();
    await test_mass_assignment();
    await test_password_exposure();
    await test_stack_trace();
    await test_cookie_httponly();
  } catch (err) {
    console.error("\nErreur inattendue :", err.message);
    process.exit(1);
  }

  const total = results.pass + results.fail;
  console.log("\n══════════════════════════════════════════");
  console.log(`Résultat : ${results.pass}/${total} tests passés`);
  console.log(`  ✅ ${results.pass} réussis  |  ❌ ${results.fail} échoués`);

  if (results.fail > 0) {
    console.error("\nTests échoués :");
    results.errors.forEach((e) => console.error(`  - ${e}`));
    console.error(
      results.fail > 3
        ? "\n⚠️  Version vulnérable détectée — corrections requises"
        : "\n⚠️  Corrections incomplètes"
    );
    process.exit(1);
  }

  console.log("\n✅ Tous les tests passent — version sécurisée validée");
  process.exit(0);
})();
