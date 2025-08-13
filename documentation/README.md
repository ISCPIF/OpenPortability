# OpenPortability - Documentation Complète

## Vue d'ensemble

OpenPortability est une application de migration de données sociales permettant aux utilisateurs d'importer leurs données Twitter et de les migrer vers d'autres plateformes (Bluesky, Mastodon). L'application utilise une architecture microservices avec Docker pour assurer la scalabilité et la modularité.

## Architecture Générale

L'application est composée de plusieurs services Docker orchestrés via `docker-compose.yml` :

### Services Principaux

1. **App (Next.js)** - Interface utilisateur et API
2. **Worker (Node.js/TypeScript)** - Traitement des imports Twitter et indexation
3. **Python Worker** - Notifications DM et newsletters
4. **Redis** - Cache et files d'attente
5. **Redis Init** - Initialisation des mappings Redis
6. **Nginx** - Reverse proxy et SSL

### Services Externes

- **PostgreSQL (Supabase)** - Base de données principale
- **Supabase Auth** - Authentification utilisateur

## Structure des Données

### Workflow Principal Utilisateur
1. **Inscription/Connexion** → Authentification via Supabase
2. **Import Twitter** → Upload du fichier d'archive Twitter
3. **Traitement** → Worker indexe les données dans PostgreSQL
4. **Liaison Comptes** → Connexion Bluesky/Mastodon
5. **Migration** → Transfert automatique ou manuel des données

### Workflow des Données
1. **Upload** → Fichier stocké temporairement
2. **Queue Redis** → Job ajouté à la file d'attente
3. **Worker Processing** → Extraction et indexation
4. **Database Storage** → Données sauvées dans PostgreSQL
5. **Cache Sync** → Mise à jour des caches Redis
6. **Stats Update** → Calcul des statistiques utilisateur

## Documentation Détaillée

- [Architecture des Services](./services-architecture.md)
- [Workflows Détaillés](./workflows.md)
- [API Documentation](./api-schema.md)
- [Structure des Pages](./pages-structure.md)
- [Configuration Docker](./docker-configuration.md)


## Technologies Utilisées

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js, TypeScript, Supabase
- **Workers**: Node.js (indexation), Python (notifications)
- **Base de données**: PostgreSQL (Supabase)
- **Cache**: Redis 7
- **Conteneurisation**: Docker, Docker Compose
- **Proxy**: Nginx
- **Authentification**: NextAuth + Supabase

## Sécurité

- Authentification via Supabase
- Variables d'environnement pour les secrets
- Redis protégé par mot de passe
- Nginx avec support SSL
- Validation des données côté serveur

## Monitoring et Logs

- Logs centralisés dans `/app/logs`
- Métriques Redis pour les performances
- Health checks pour tous les services
- Circuit breaker pour la résilience
