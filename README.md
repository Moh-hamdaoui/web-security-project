# TicketApp — Version sécurisée

> Branche `secure-version` — toutes les vulnérabilités de la branche `main` sont corrigées.  
> Pour la version vulnérable à des fins pédagogiques, consulter la branche `main`.

## Stack technique

- **Framework :** Next.js 14.2.35 (App Router)
- **Base de données :** SQLite (better-sqlite3)
- **Authentification :** JWT httpOnly cookie (jsonwebtoken + bcryptjs)
- **Style :** Tailwind CSS
- **CI/CD :** GitHub Actions — SCA + SAST + Secret Scan + Tests + DAST

---

## Installation et démarrage

```bash
# 1. Copier et remplir le fichier d'environnement
cp .env.example .env
# Éditer .env : renseigner JWT_SECRET (min 32 caractères)

# 2. Installer les dépendances
npm install

# 3. Initialiser la base de données
node scripts/init-db.js

# 4. Démarrer en développement
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

## Corrections de sécurité appliquées

| ID | Vulnérabilité | Statut |
|----|--------------|--------|
| VLN-01 | SQL Injection | ✅ Corrigé — requêtes paramétrées |
| VLN-02 | IDOR | ✅ Corrigé — vérification propriétaire |
| VLN-03 | XSS Stocké | ✅ Corrigé — rendu texte React |
| VLN-04 | SSRF | ✅ Corrigé — liste blanche domaines |
| VLN-05 | Security Misconfiguration | ✅ Corrigé — headers, cookies, secrets |
| VLN-06 | Mass Assignment | ✅ Corrigé — whitelist champs PUT |

Détail complet des corrections : voir la section [Ensemble des corrections](#ensemble-des-corrections-apportées-branche-secure-version) plus bas.

---

## Pipeline CI/CD de Sécurité

Le fichier [`.github/workflows/security.yml`](.github/workflows/security.yml) met en place une pipeline automatique déclenchée sur chaque `push` (branches `main`, `secure-version`) et `pull_request`.

### Étapes

| # | Étape | Outil | Ce qu'il détecte |
|---|-------|-------|-----------------|
| 1 | Install | `npm ci` | — |
| 2 | **SCA** | `npm audit --audit-level=critical` | CVE critiques dans les dépendances |
| 3 | **SCA info** | `npm audit --audit-level=high` | CVE high — informatif, ne bloque pas |
| 4 | **SAST** | `semgrep-action@v1` | SQLi, XSS, SSRF, JWT faible, stack traces exposées |
| 5 | **Secret Scan** | `gitleaks-action@v2` | Secrets commités : `JWT_SECRET=secret123`, mots de passe |
| 6 | Build + Init DB | `npm run build` / `init-db.js` | Préparation pour le DAST |
| 7 | Start app | `npm start &` | Lancement de l'app sur port 3000 |
| 8 | Wait | `wait-on` | Attend que l'app réponde |
| 9 | **DAST** | `zaproxy/action-baseline@v0.12.0` | XSS reflété, headers manquants, infos sensibles exposées |
| 10 | Artifacts | `upload-artifact@v4` | Upload rapport ZAP (HTML) |

### Schéma

```
push (main / secure-version) ou pull_request
              │
              ▼
     ┌─────────────────┐
     │  npm ci          │
     └────────┬─────────┘
              │
     ┌────────▼─────────┐
     │  SCA              │  npm audit → CVE dépendances
     └────────┬─────────┘
              │
     ┌────────▼─────────┐
     │  SAST             │  Semgrep → SQLi, XSS, SSRF dans le code
     └────────┬─────────┘
              │
     ┌────────▼─────────┐
     │  Secret Scan      │  Gitleaks → secrets dans le dépôt git
     └────────┬─────────┘
              │
     ┌────────▼─────────┐
     │  Build + Start    │  next build → next start
     └────────┬─────────┘
              │
     ┌────────▼─────────┐
     │  DAST             │  OWASP ZAP → attaque l'app en live
     └────────┬─────────┘
              │
     ┌────────▼─────────┐
     │  Artifacts        │  Rapports ZAP & npm audit uploadés
     └─────────────────┘
```

> **Note :** Sur la branche `main` (version vulnérable), les étapes SAST/Secret Scan ont `continue-on-error: true` pour produire tous les rapports malgré les alertes. Sur la branche `secure-version`, aucun `continue-on-error` — toute alerte critique bloque le pipeline.

### Secrets GitHub requis

| Secret | Utilisation |
|--------|------------|
| `JWT_SECRET` | **Requis** — secret de signature JWT (≥ 32 caractères) |
| `SEMGREP_APP_TOKEN` | Optionnel — pour envoyer les résultats au dashboard Semgrep Cloud |
| `GITLEAKS_LICENSE` | Optionnel — requis uniquement pour les dépôts privés |

---

## Versions corrigées (branche `secure-version`)

Les corrections sont appliquées directement dans les fichiers de l'application :

| Fichier | Vulnérabilité corrigée |
|---------|----------------------|
| `app/api/auth/login/route.js` | SQLi → requête paramétrée, bcrypt, message générique |
| `app/api/auth/register/route.js` | Mot de passe haché bcrypt, cookie sécurisé |
| `app/api/tickets/[id]/route.js` | IDOR → `canAccess()`, double `request.json()` corrigé |
| `app/api/tickets/route.js` | IDOR → filtre `WHERE user_id = ?` pour les non-admins |
| `app/api/users/[id]/route.js` | IDOR → accès restreint au profil propre |
| `app/api/admin/users/route.js` | Champ `password` exclu des réponses |
| `app/api/admin/fetch-url/route.js` | SSRF → liste blanche + blocage IPs privées |
| `app/tickets/[id]/page.js` | XSS → suppression `dangerouslySetInnerHTML` |
| `lib/auth.js` | JWT secret ≥ 32 chars, durée 24h, validation lazy |
| `lib/db.js` | Mots de passe hachés bcrypt (cost 12) |
| `middleware.js` | Protection routes, décodage JWT Edge-compatible |
| `next.config.js` | Headers sécurité complets, `poweredByHeader: false` |
| `.env` | `JWT_SECRET` fort (40 chars aléatoires) |

---

## Ensemble des corrections apportées (branche `secure-version`)

### VLN-01 — SQL Injection

| | Vulnérable | Corrigé |
|--|-----------|---------|
| **Fichier** | `app/api/auth/login/route.js` | idem |
| **Problème** | Requête construite par interpolation : `` `WHERE email='${email}'` `` | — |
| **Fix** | Requête paramétrée `db.prepare("... WHERE email = ?").get(email)` | ✅ |
| **Bonus** | Comparaison `bcrypt` à durée constante (anti timing-attack) | ✅ |

---

### VLN-02 — IDOR / Broken Access Control

| | Vulnérable | Corrigé |
|--|-----------|---------|
| **Fichiers** | `api/tickets/[id]/route.js`, `api/tickets/route.js`, `api/users/[id]/route.js` | idem |
| **Problème** | Aucune vérification de propriété — tout user pouvait lire/modifier/supprimer | — |
| **Fix** | Fonction `canAccess(ticket, user)` : `ticket.user_id === user.id \|\| role === "admin"` | ✅ |
| **Fix** | `GET /api/tickets` filtre par `user_id` pour les users, tout pour admin | ✅ |
| **Fix** | `GET /api/users/:id` restreint au profil du user connecté uniquement | ✅ |

---

### VLN-03 — XSS Stocké

| | Vulnérable | Corrigé |
|--|-----------|---------|
| **Fichier** | `app/tickets/[id]/page.js` | idem |
| **Problème** | `dangerouslySetInnerHTML={{ __html: ticket.title }}` sur titre, description, commentaires | — |
| **Fix** | Rendu texte React natif : `<p>{ticket.description}</p>` (échappement automatique) | ✅ |
| **Fix API** | Limite de 2000 caractères sur les commentaires + `content.trim()` | ✅ |

---

### VLN-04 — SSRF

| | Vulnérable | Corrigé |
|--|-----------|---------|
| **Fichier** | `app/api/admin/fetch-url/route.js` | idem |
| **Problème** | `fetch(url)` sans aucune validation — accès à `169.254.169.254`, réseau interne | — |
| **Fix** | Liste blanche stricte : `hooks.slack.com`, `discord.com`, `api.github.com`, `hooks.zapier.com` | ✅ |
| **Fix** | Blocage regex des plages IP privées (10.x, 192.168.x, 127.x, 169.254.x…) | ✅ |
| **Fix** | Seul le statut HTTP est retourné — le corps de la réponse n'est plus exposé | ✅ |

---

### VLN-05 — Security Misconfiguration

#### 05a — Secrets dans `.env`
| Vulnérable | Corrigé |
|-----------|---------|
| `JWT_SECRET=secret123` (6 chars, brute-forceable) | Secret de 40 caractères aléatoires |
| `.env` commité avec mots de passe en clair | Documenté comme intentionnel (démo) |

#### 05b — Stack traces exposées
| Vulnérable | Corrigé |
|-----------|---------|
| `return NextResponse.json({ error: err.message, stack: err.stack })` | `return NextResponse.json({ error: "Erreur interne" })` dans tous les `catch` |

#### 05c — Mots de passe en clair
| Vulnérable | Corrigé |
|-----------|---------|
| Stockage en clair en base + retour dans les réponses API | `bcrypt.hash(password, 12)` à l'inscription, `bcrypt.compare()` à la connexion |
| `SELECT ..., password FROM users` | `SELECT id, username, email, role, created_at FROM users` (password exclu) |

#### 05d — Headers HTTP absents
| Header | Ajouté |
|--------|--------|
| `X-Frame-Options: DENY` | ✅ |
| `X-Content-Type-Options: nosniff` | ✅ |
| `Referrer-Policy: strict-origin-when-cross-origin` | ✅ |
| `Permissions-Policy: camera=(), microphone=(), geolocation=()` | ✅ |
| `Content-Security-Policy` avec `base-uri`, `form-action`, `object-src 'none'` | ✅ |
| `Cross-Origin-Embedder-Policy: require-corp` | ✅ |
| `Cross-Origin-Opener-Policy: same-origin` | ✅ |
| `Cross-Origin-Resource-Policy: same-origin` | ✅ |
| `X-Powered-By` supprimé (`poweredByHeader: false`) | ✅ |

#### 05e — Cookie JWT non sécurisé
| Vulnérable | Corrigé |
|-----------|---------|
| `cookies.set("token", token, { path: "/" })` | `httpOnly: true`, `secure: true` (prod), `sameSite: "strict"`, `maxAge: 86400` |

#### 05f — Token JWT dans l'URL
| Vulnérable | Corrigé |
|-----------|---------|
| `extractToken` acceptait `?token=...` dans l'URL | Supprimé — uniquement cookie `httpOnly` ou header `Authorization` |

#### 05g — JWT secret faible
| Vulnérable | Corrigé |
|-----------|---------|
| `JWT_SECRET=secret123`, durée 7 jours | Secret ≥ 32 chars, durée 24h, validation lazy dans `getSecret()` |

#### 05h — Middleware vide
| Vulnérable | Corrigé |
|-----------|---------|
| Middleware ne vérifiait rien | Vérification JWT Edge-compatible (décodage base64url) + protection routes `/admin` |

---

### SCA — Dépendances (npm audit)

| Version | CVE critiques | CVE high | Action |
|---------|--------------|----------|--------|
| Next.js `14.1.0` | 26 dont auth bypass, SSRF | — | Mise à jour vers `14.2.35` |
| Next.js `14.2.35` | **0** | 14 (DoS, cache) | Acceptés — documentés dans `.audit-exceptions.md` |

---

### DAST — OWASP ZAP

| Alerte ZAP | Résolution |
|-----------|-----------|
| `X-Powered-By` exposé [10037] | `poweredByHeader: false` dans `next.config.js` |
| CSP directives manquantes [10055] | Ajout `base-uri`, `form-action`, `object-src 'none'` |
| `Cross-Origin-Embedder-Policy` absent [90004] | Headers COEP + COOP + CORP ajoutés |
| `unsafe-inline` dans script-src [10055] | Ignoré — requis par Next.js 14 runtime (plan : nonce CSP avec Next.js 15) |
| Non-Storable Content [10049] | Ignoré — comportement normal des assets statiques Next.js |
| Sec-Fetch-Dest manquant [90005] | Ignoré — header émis par le navigateur, pas le serveur |

**Résultat final ZAP :** `FAIL-NEW: 0 — WARN-NEW: 0 — PASS: 66` ✅
