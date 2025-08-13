# API Documentation - OpenPortability

## Vue d'ensemble des APIs

L'application OpenPortability expose plusieurs endpoints API organisés par fonctionnalité. Toutes les APIs utilisent l'authentification NextAuth + Supabase.

## Structure des Endpoints

```
/api/
├── auth/                 # Authentification
├── connections/          # Gestion des connexions sociales
├── debug/               # Outils de débogage
├── delete/              # Suppression de données
├── import-status/       # Statut des imports
├── internal/            # APIs internes
├── migrate/             # Migration des données
├── newsletter/          # Gestion newsletter
├── share/               # Partage de données
├── stats/               # Statistiques utilisateur
├── support/             # Support utilisateur
├── update/              # API Schema Documentation
├── upload/              # Upload de fichiers
└── users/               # Gestion utilisateurs
```

## Endpoints Détaillés

### 1. Authentification (`/api/auth/`)

#### POST `/api/auth/signin`
Connexion utilisateur via NextAuth.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name"
  },
  "session": {
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token"
  }
}
```

#### POST `/api/auth/signup`
Inscription nouvel utilisateur.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name"
}
```

### 2. Upload (`/api/upload/`)

#### POST `/api/upload`
Upload d'archive Twitter pour traitement.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request:**
```
FormData:
- file: Twitter archive (.zip/.tar.gz)
- userId: string
```

**Response:**
```json
{
  "success": true,
  "jobId": "job_uuid",
  "message": "File uploaded successfully",
  "estimatedProcessingTime": "5-10 minutes"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "INVALID_FILE_FORMAT",
  "message": "Only .zip and .tar.gz files are supported"
}
```

### 3. Import Status (`/api/import-status/`)

#### GET `/api/import-status`
Récupération du statut d'import en cours.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "processing", // "pending" | "processing" | "completed" | "failed"
  "progress": 65,
  "currentStep": "Indexing tweets",
  "totalSteps": 4,
  "estimatedTimeRemaining": "2 minutes",
  "processedItems": {
    "tweets": 1250,
    "followers": 340,
    "following": 180
  },
  "errors": []
}
```

### 4. Connexions Sociales (`/api/connections/`)

#### GET `/api/connections`
Liste des connexions sociales de l'utilisateur.

**Response:**
```json
{
  "connections": [
    {
      "platform": "bluesky",
      "username": "@user.bsky.social",
      "connected": true,
      "connectedAt": "2024-01-15T10:30:00Z",
      "permissions": ["read", "write", "follow"]
    },
    {
      "platform": "mastodon",
      "instance": "mastodon.social",
      "username": "@user",
      "connected": true,
      "connectedAt": "2024-01-16T14:20:00Z",
      "permissions": ["read", "write", "follow"]
    }
  ]
}
```

#### POST `/api/connections/bluesky`
Connexion à Bluesky via OAuth.

**Request:**
```json
{
  "authCode": "oauth_code",
  "redirectUri": "https://app.com/callback"
}
```

#### POST `/api/connections/mastodon`
Connexion à Mastodon via OAuth.

**Request:**
```json
{
  "instance": "mastodon.social",
  "authCode": "oauth_code",
  "redirectUri": "https://app.com/callback"
}
```

### 5. Migration (`/api/migrate/`)

#### POST `/api/migrate/start`
Démarrage d'une migration de données.

**Request:**
```json
{
  "targetPlatform": "bluesky", // "bluesky" | "mastodon"
  "dataTypes": ["tweets", "followers", "following"],
  "options": {
    "includeReplies": false,
    "includeRetweets": true,
    "dateRange": {
      "start": "2023-01-01",
      "end": "2024-01-01"
    },
    "batchSize": 50
  }
}
```

**Response:**
```json
{
  "migrationId": "migration_uuid",
  "status": "started",
  "estimatedDuration": "30 minutes",
  "totalItems": 1500
}
```

#### GET `/api/migrate/status/:migrationId`
Statut d'une migration en cours.

**Response:**
```json
{
  "migrationId": "migration_uuid",
  "status": "in_progress", // "pending" | "in_progress" | "completed" | "failed"
  "progress": 45,
  "currentStep": "Migrating tweets",
  "completed": {
    "tweets": 120,
    "followers": 45,
    "following": 30
  },
  "failed": {
    "tweets": 2,
    "followers": 0,
    "following": 1
  },
  "errors": [
    {
      "type": "RATE_LIMIT",
      "message": "Rate limit exceeded, retrying in 15 minutes",
      "timestamp": "2024-01-15T15:30:00Z"
    }
  ]
}
```

### 6. Statistiques (`/api/stats/`)

#### GET `/api/stats/overview`
Vue d'ensemble des statistiques utilisateur.

**Response:**
```json
{
  "twitter": {
    "tweets": {
      "total": 2500,
      "replies": 800,
      "retweets": 400,
      "originalTweets": 1300
    },
    "followers": 1200,
    "following": 350,
    "likes": 15000,
    "accountAge": "8 years",
    "mostActiveYear": "2022"
  },
  "migration": {
    "bluesky": {
      "migrated": 1200,
      "pending": 300,
      "failed": 50
    },
    "mastodon": {
      "migrated": 800,
      "pending": 100,
      "failed": 20
    }
  },
  "engagement": {
    "avgLikesPerTweet": 6.2,
    "avgRetweetsPerTweet": 2.1,
    "avgRepliesPerTweet": 1.8,
    "topHashtags": ["#tech", "#ai", "#coding"],
    "topMentions": ["@user1", "@user2", "@user3"]
  }
}
```

#### GET `/api/stats/timeline`
Données pour graphiques temporels.

**Query Parameters:**
- `period`: "week" | "month" | "year"
- `metric`: "tweets" | "followers" | "engagement"

**Response:**
```json
{
  "period": "month",
  "metric": "tweets",
  "data": [
    {
      "date": "2024-01-01",
      "value": 45
    },
    {
      "date": "2024-01-02",
      "value": 52
    }
  ]
}
```

### 7. Utilisateurs (`/api/users/`)

#### GET `/api/users/profile`
Profil utilisateur complet.

**Response:**
```json
{
  "id": "user_uuid",
  "email": "user@example.com",
  "name": "User Name",
  "avatar": "https://avatar.url",
  "createdAt": "2024-01-01T00:00:00Z",
  "settings": {
    "language": "fr",
    "timezone": "Europe/Paris",
    "notifications": {
      "email": true,
      "dm": true,
      "newsletter": false
    },
    "privacy": {
      "publicProfile": false,
      "shareStats": true
    }
  },
  "subscription": {
    "plan": "free", // "free" | "pro" | "enterprise"
    "features": ["basic_migration", "stats"],
    "limits": {
      "monthlyMigrations": 5,
      "dataRetention": "30 days"
    }
  }
}
```

#### PUT `/api/users/profile`
Mise à jour du profil utilisateur.

**Request:**
```json
{
  "name": "New Name",
  "settings": {
    "language": "en",
    "notifications": {
      "email": false
    }
  }
}
```

### 8. Support (`/api/support/`)

#### POST `/api/support/ticket`
Création d'un ticket de support.

**Request:**
```json
{
  "subject": "Migration failed",
  "category": "technical", // "technical" | "billing" | "feature_request"
  "priority": "medium", // "low" | "medium" | "high" | "urgent"
  "description": "My migration to Bluesky failed with error...",
  "attachments": ["error_log.txt"]
}
```

**Response:**
```json
{
  "ticketId": "ticket_uuid",
  "status": "open",
  "estimatedResponse": "24 hours"
}
```

## Codes d'Erreur

### Erreurs Communes

| Code | Message | Description |
|------|---------|-------------|
| `AUTH_REQUIRED` | Authentication required | Token manquant ou invalide |
| `INVALID_REQUEST` | Invalid request format | Format de requête incorrect |
| `RATE_LIMITED` | Rate limit exceeded | Limite de taux dépassée |
| `INTERNAL_ERROR` | Internal server error | Erreur serveur interne |

### Erreurs Upload

| Code | Message | Description |
|------|---------|-------------|
| `INVALID_FILE_FORMAT` | Invalid file format | Format de fichier non supporté |
| `FILE_TOO_LARGE` | File size exceeds limit | Fichier trop volumineux |
| `CORRUPTED_ARCHIVE` | Archive is corrupted | Archive corrompue |
| `MISSING_REQUIRED_FILES` | Required files missing | Fichiers requis manquants |

### Erreurs Migration

| Code | Message | Description |
|------|---------|-------------|
| `PLATFORM_NOT_CONNECTED` | Platform not connected | Plateforme non connectée |
| `INSUFFICIENT_PERMISSIONS` | Insufficient permissions | Permissions insuffisantes |
| `MIGRATION_IN_PROGRESS` | Migration already in progress | Migration déjà en cours |
| `QUOTA_EXCEEDED` | Migration quota exceeded | Quota de migration dépassé |

## Authentification et Sécurité

### Headers Requis
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
X-API-Version: v1
```

### Rate Limiting
- **Authentification**: 5 tentatives/minute
- **Upload**: 3 fichiers/heure
- **Migration**: 1 migration/heure
- **APIs générales**: 100 requêtes/minute

### CORS
```
Access-Control-Allow-Origin: https://openportability.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Authorization, Content-Type
```

## Webhooks (Optionnel)

### Configuration Webhook
```json
{
  "url": "https://your-app.com/webhook",
  "events": ["migration.completed", "migration.failed", "import.completed"],
  "secret": "webhook_secret"
}
```

### Payload Webhook
```json
{
  "event": "migration.completed",
  "timestamp": "2024-01-15T16:30:00Z",
  "data": {
    "migrationId": "migration_uuid",
    "userId": "user_uuid",
    "platform": "bluesky",
    "stats": {
      "migrated": 1200,
      "failed": 5
    }
  },
  "signature": "sha256=signature"
}
```
