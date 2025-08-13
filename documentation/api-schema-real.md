# API Schema Documentation - OpenPortability

Cette documentation décrit les endpoints API **réels** d'OpenPortability, basée sur l'analyse du code source dans `src/app/api/`.

## Table des Matières

1. [Architecture API](#architecture-api)
2. [Authentification](#authentification)
3. [Upload et Import](#upload-et-import)
4. [Statistiques](#statistiques)
5. [Migration et Matching](#migration-et-matching)
6. [Support et Newsletter](#support-et-newsletter)
7. [Endpoints Internes](#endpoints-internes)
8. [Middleware de Validation](#middleware-de-validation)
9. [Codes d'Erreur](#codes-derreur)

## Architecture API

### Structure des Endpoints Réels

```
/api/
├── auth/                    # NextAuth + OAuth/Credentials
│   ├── [...nextauth]/       # NextAuth handler
│   ├── bluesky/            # Auth Bluesky
│   ├── mastodon/           # Auth Mastodon
│   ├── refresh/            # Refresh tokens
│   └── unlink/             # Déconnexion comptes
├── connections/            # Données de graphe
│   ├── graph/anonyme/      # Graphe anonyme
│   └── graph/user-network/ # Réseau utilisateur
├── debug/                  # Outils debug
│   └── db-access/          # Test accès DB
├── delete/                 # Suppression données
├── import-status/          # Statut jobs
│   └── [jobId]/           # Statut job spécifique
├── internal/               # APIs internes (webhooks)
│   ├── activate-waiting-tasks/
│   ├── process-consent-change/
│   ├── refresh-mastodon-cache/
│   ├── refresh-redis-cache/
│   ├── refresh-user-stats-cache/
│   ├── sync-redis-mapping/
│   └── sync-redis-tasks/
├── migrate/                # Migration données
│   ├── ignore/             # Ignorer matches
│   ├── matching_found/     # Matches trouvés
│   └── send_follow/        # Envoi follows
├── newsletter/             # Newsletter
│   └── request/            # Gestion consentements
├── share/                  # Partage
│   ├── bluesky/           # Partage Bluesky
│   └── route.ts           # Partage général
├── stats/                  # Statistiques
│   ├── route.ts           # Stats utilisateur
│   └── total/             # Stats globales
├── support/                # Support utilisateur
├── update/                 # Mise à jour
│   └── user_stats/        # MAJ stats utilisateur
├── upload/                 # Upload fichiers
│   └── large-files/       # Upload archives Twitter
└── users/                  # Gestion utilisateurs
    ├── automatic-reconnect/ # Reconnexion auto
    └── language/           # Langue utilisateur
```

## Authentification

Tous les endpoints protégés utilisent le middleware `withValidation` avec NextAuth.js.

### Headers Requis
```
Cookie: next-auth.session-token=<session_token>
```

### Réponse d'Erreur d'Authentification
```json
{
  "error": "Unauthorized"
}
```

## Upload et Import

### 1. Upload d'Archive (`/api/upload/large-files`)

#### POST `/api/upload/large-files`
Upload d'archives Twitter (following.js, followers.js) avec validation et traitement asynchrone.

**Middleware:** `withValidation` avec `LargeFilesUploadSchema`

**Headers:**
```
Content-Type: multipart/form-data
Cookie: next-auth.session-token=<session_token>
```

**Body (FormData):**
```
following: <following.js>
followers: <followers.js>
```

**Success Response:**
```json
{
  "success": true,
  "jobId": "uuid-job-id",
  "message": "Files uploaded and job created successfully",
  "files": {
    "following": {
      "size": 1024000,
      "path": "/app/tmp/user-id/following.js"
    },
    "followers": {
      "size": 2048000,
      "path": "/app/tmp/user-id/followers.js"
    }
  }
}
```

**Error Responses:**
```json
{
  "error": "Operation not allowed for onboarded users"
}
```
```json
{
  "error": "Job already in progress"
}
```

### 2. Statut d'Import (`/api/import-status/[jobId]`)

#### GET `/api/import-status/[jobId]`
Récupération du statut d'un job d'import spécifique depuis Redis puis PostgreSQL.

**Middleware:** `withValidation` avec `EmptySchema`

**Headers:**
```
Cookie: next-auth.session-token=<session_token>
```

**Success Response (Redis):**
```json
{
  "id": "uuid-job-id",
  "status": "processing",
  "progress": 65,
  "stats": {
    "total": 1000,
    "processed": 650,
    "followers": {
      "total": 500,
      "processed": 325
    },
    "following": {
      "total": 500,
      "processed": 325
    }
  },
  "created_at": "2024-01-01T10:00:00Z",
  "updated_at": "2024-01-01T10:05:00Z"
}
```

**Success Response (PostgreSQL fallback):**
```json
{
  "id": "uuid-job-id",
  "status": "completed",
  "user_id": "user-uuid",
  "created_at": "2024-01-01T10:00:00Z",
  "completed_at": "2024-01-01T10:10:00Z"
}
```

**Error Response:**
```json
{
  "error": "Job not found"
}
```

## Statistiques

### 1. Statistiques Utilisateur (`/api/stats`)

#### GET `/api/stats`
Récupération des statistiques de l'utilisateur connecté via `StatsService`.

**Middleware:** `withValidation` avec validation des query params

**Headers:**
```
Cookie: next-auth.session-token=<session_token>
```

**Query Parameters:**
```
limit?: number // Limite pour les listes
```

**Response (Utilisateur Non-Onboardé sans Twitter):**
```json
{
  "connections": {
    "followers": 0,
    "following": 0
  },
  "matches": {
    "bluesky": {
      "total": 0,
      "hasFollowed": 0,
      "notFollowed": 0
    },
    "mastodon": {
      "total": 0,
      "hasFollowed": 0,
      "notFollowed": 0
    }
  }
}
```

**Response (Utilisateur Onboardé):**
```json
{
  "connections": {
    "followers": 1250,
    "following": 340
  },
  "matches": {
    "bluesky": {
      "total": 45,
      "hasFollowed": 12,
      "notFollowed": 33
    },
    "mastodon": {
      "total": 28,
      "hasFollowed": 8,
      "notFollowed": 20
    }
  }
}
```

### 2. Statistiques Globales (`/api/stats/total`)

#### GET `/api/stats/total`
Statistiques globales de la plateforme avec cache Redis via `StatsRepository`.

**Response:**
```json
{
  "users": {
    "total": 15420,
    "active": 8930,
    "onboarded": 12100
  },
  "connections": {
    "totalFollowers": 2450000,
    "totalFollowing": 1890000
  },
  "matches": {
    "bluesky": {
      "totalUsers": 3420,
      "totalMatches": 45600
    },
    "mastodon": {
      "totalUsers": 2180,
      "totalMatches": 28900
    }
  }
}
```

## Migration et Matching

### 1. Envoi de Follows (`/api/migrate/send_follow`)

#### POST `/api/migrate/send_follow`
Envoi de demandes de suivi en lot vers Bluesky et Mastodon.

**Middleware:** `withValidation` avec `SendFollowRequestSchema` et rate limiting personnalisé (100 req/min)

**Headers:**
```
Cookie: next-auth.session-token=<session_token>
```

**Request Body:**
```json
{
  "accounts": [
    {
      "twitter_id": "123456789",
      "bluesky_username": "user.bsky.social",
      "mastodon_username": "user@mastodon.social",
      "mastodon_instance": "mastodon.social"
    }
  ]
}
```

**Success Response:**
```json
{
  "bluesky": {
    "success": 12,
    "failed": 1,
    "results": [
      {
        "username": "user.bsky.social",
        "success": true
      }
    ]
  },
  "mastodon": {
    "success": 8,
    "failed": 0,
    "results": [
      {
        "username": "user@mastodon.social",
        "success": true
      }
    ]
  }
}
```

### 2. Matches Trouvés (`/api/migrate/matching_found`)

#### GET `/api/migrate/matching_found`
Récupération des correspondances trouvées pour l'utilisateur.

### 3. Ignorer Match (`/api/migrate/ignore`)

#### POST `/api/migrate/ignore`
Marquer un match comme ignoré.

## Support et Newsletter

### 1. Support (`/api/support`)

#### POST `/api/support`
Envoi d'un message de support avec validation de sécurité multi-couches.

**Middleware:** `withValidation` avec `SupportRequestSchema`, pas d'auth requise

**Request Body:**
```json
{
  "subject": "Problème de connexion",
  "message": "Je n'arrive pas à me connecter à mon compte Bluesky",
  "email": "user@example.com"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Support request sent successfully"
}
```

**Error Response:**
```json
{
  "error": "Content validation failed. Please check your message."
}
```

### 2. Newsletter (`/api/newsletter/request`)

#### GET `/api/newsletter/request`
Récupération des consentements newsletter actifs.

**Middleware:** `withValidation` avec `EmptySchema`

**Response:**
```json
{
  "consents": [
    {
      "type": "weekly_digest",
      "active": true
    },
    {
      "type": "feature_updates",
      "active": false
    }
  ],
  "email": "user@example.com"
}
```

#### POST `/api/newsletter/request`
Mise à jour des consentements newsletter.

**Middleware:** `withValidation` avec `NewsletterRequestSchema`

**Request Body:**
```json
{
  "consents": [
    {
      "type": "weekly_digest",
      "active": true
    }
  ],
  "email": "user@example.com"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Newsletter preferences updated"
}
```

## Endpoints Internes

Ces endpoints sont utilisés par les triggers PostgreSQL et les webhooks internes.

### 1. Synchronisation Redis (`/api/internal/sync-redis-mapping`)

#### POST `/api/internal/sync-redis-mapping`
Synchronisation des mappings d'identités vers Redis.

### 2. Refresh Cache Redis (`/api/internal/refresh-redis-cache`)

#### POST `/api/internal/refresh-redis-cache`
Actualisation du cache Redis des statistiques globales.

### 3. Traitement Consentements (`/api/internal/process-consent-change`)

#### POST `/api/internal/process-consent-change`
Traitement des changements de consentements newsletter.

## Middleware de Validation

Tous les endpoints utilisent le middleware `withValidation` avec :

### Configuration Standard
```typescript
{
  requireAuth: true,           // Authentification requise
  applySecurityChecks: true,   // Vérifications SQL/XSS
  skipRateLimit: false,        // Rate limiting activé
  validateQueryParams: true,   // Validation params URL
  customRateLimit: undefined   // Rate limit personnalisé
}
```

### Schémas Zod
- `EmptySchema`: Pour les requêtes sans body
- `LargeFilesUploadSchema`: Upload de fichiers
- `SendFollowRequestSchema`: Envoi de follows
- `SupportRequestSchema`: Messages de support
- `NewsletterRequestSchema`: Consentements newsletter
- `StatsQueryParamsSchema`: Paramètres de statistiques

## Codes d'Erreur

### Codes HTTP Standards
- `200`: Succès
- `400`: Requête invalide (validation Zod échouée)
- `401`: Non authentifié
- `403`: Non autorisé (utilisateur onboardé pour upload, etc.)
- `404`: Ressource non trouvée
- `429`: Rate limit dépassé
- `500`: Erreur serveur interne

### Messages d'Erreur Typiques
```json
{
  "error": "Unauthorized"
}
```
```json
{
  "error": "Validation failed",
  "details": ["Field 'email' is required"]
}
```
```json
{
  "error": "Rate limit exceeded"
}
```
```json
{
  "error": "Internal Server Error"
}
```

## Sécurité

### Validation Multi-Couches
1. **Middleware `withValidation`**: Validation Zod + sécurité
2. **Détection SQL Injection**: Patterns malveillants détectés
3. **Détection XSS**: Scripts et HTML malveillants bloqués
4. **Rate Limiting**: Protection contre le spam
5. **Sanitisation HTML**: Contenu sécurisé pour les emails

### Logging
Tous les endpoints loggent via `logger.logInfo/logWarning/logError` avec contexte utilisateur et métadonnées.
