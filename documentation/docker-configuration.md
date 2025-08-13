# Configuration Docker - OpenPortability

## Vue d'ensemble Docker

L'application OpenPortability utilise Docker Compose pour orchestrer plusieurs services dans un environnement containerisé. Cette architecture permet une scalabilité et une maintenance facilitées.

## Structure des Fichiers Docker

```
.
├── docker-compose.yml          # Configuration production
├── docker-compose.dev.yml      # Configuration développement
├── Dockerfile                  # Image principale Next.js
├── Dockerfile.dev             # Image développement
├── worker/
│   └── Dockerfile             # Image worker Node.js
├── python_worker/
│   └── Dockerfile             # Image worker Python
├── redis/
│   └── Dockerfile.init        # Image initialisation Redis
└── nginx/
    └── nginx.conf             # Configuration Nginx
```

## Configuration Docker Compose

### Services Définis

```yaml
version: '3.8'

services:
  # Application Next.js principale
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    networks:
      - app_network
      - supabase_network_goodbyex
    volumes:
      - shared-tmp:/app/tmp
      - app_logs:/app/logs
    depends_on:
      redis-init:
        condition: service_completed_successfully

  # Worker de traitement des données
  worker:
    build:
      context: ./worker
      dockerfile: Dockerfile
    volumes:
      - ./worker:/app
      - /app/node_modules
      - shared-tmp:/app/tmp
      - app_logs:/app/logs
    networks:
      - app_network
      - supabase_network_goodbyex
    depends_on:
      redis-init:
        condition: service_completed_successfully

  # Worker Python pour notifications
  python_worker:
    build:
      context: ./python_worker
      dockerfile: Dockerfile
    volumes:
      - ./python_worker/messages:/app/messages
      - app_logs:/app/logs
    networks:
      - app_network
      - supabase_network_goodbyex
    depends_on:
      - app

  # Cache et files d'attente Redis
  redis:
    image: redis:7-alpine
    container_name: openportability_redis
    restart: unless-stopped
    networks:
      - app_network
    volumes:
      - ./redis.conf:/usr/local/etc/redis/redis.conf:ro
      - redis_data:/data
    command: redis-server /usr/local/etc/redis/redis.conf
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "password", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  # Initialisation Redis
  redis-init:
    build:
      context: ./redis
      dockerfile: Dockerfile.init
    env_file:
      - redis/.env.redis
    networks:
      - app_network
      - supabase_network_goodbyex
    depends_on:
      redis:
        condition: service_healthy
    restart: "no"

  # Reverse proxy Nginx
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/certs:/etc/nginx/certs:ro
      - ./nginx/auth:/etc/nginx/auth:ro
    depends_on:
      - app
    networks:
      - app_network
```

## Dockerfiles Détaillés

### Dockerfile Principal (Next.js App)

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Installer les dépendances seulement quand nécessaire
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Installer les dépendances basées sur le gestionnaire de paquets préféré
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Rebuild du code source seulement quand nécessaire
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Construire l'application
RUN npm run build

# Image de production, copier tous les fichiers et lancer Next.js
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Définir les permissions correctes pour les fichiers prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copier automatiquement les fichiers de sortie en fonction du gestionnaire de paquets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Créer les répertoires nécessaires
RUN mkdir -p /app/tmp /app/logs
RUN chown -R nextjs:nodejs /app/tmp /app/logs

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### Dockerfile Worker (Node.js)

```dockerfile
# worker/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Installer les dépendances système
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && ln -sf python3 /usr/bin/python

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci --only=production

# Copier le code source
COPY . .

# Construire l'application TypeScript
RUN npm run build

# Créer les répertoires nécessaires
RUN mkdir -p /app/tmp /app/logs
RUN chown -R node:node /app

USER node

# Commande par défaut
CMD ["npm", "start"]
```

### Dockerfile Python Worker

```dockerfile
# python_worker/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Installer Python et les dépendances système
RUN apk add --no-cache \
    python3 \
    py3-pip \
    python3-dev \
    build-base \
    && ln -sf python3 /usr/bin/python

# Copier et installer les dépendances Python
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt

# Copier et installer les dépendances Node.js
COPY package*.json ./
RUN npm ci --only=production

# Copier le code source
COPY . .

# Construire l'application TypeScript
RUN npm run build

# Créer les répertoires nécessaires
RUN mkdir -p /app/logs /app/messages
RUN chown -R node:node /app

USER node

# Commande par défaut
CMD ["npm", "start"]
```

### Dockerfile Redis Init

```dockerfile
# redis/Dockerfile.init
FROM node:18-alpine

WORKDIR /app

# Installer les dépendances
COPY package*.json ./
RUN npm ci --only=production

# Copier le script d'initialisation
COPY init.js ./

# Commande d'initialisation
CMD ["node", "init.js"]
```

## Configuration Nginx

```nginx
# nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    # Configuration SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    # Configuration de base
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=upload:10m rate=1r/s;

    server {
        listen 80;
        server_name _;
        
        # Redirection HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name _;

        # Certificats SSL
        ssl_certificate /etc/nginx/certs/cert.pem;
        ssl_certificate_key /etc/nginx/certs/key.pem;

        # Headers de sécurité
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

        # Proxy vers l'application
        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Rate limiting pour les APIs
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Rate limiting spécial pour upload
        location /api/upload {
            limit_req zone=upload burst=5 nodelay;
            client_max_body_size 100M;
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 300s;
            proxy_send_timeout 300s;
        }

        # Fichiers statiques
        location /_next/static/ {
            proxy_pass http://app;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # Health check
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

## Réseaux Docker

### app_network
```yaml
networks:
  app_network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### supabase_network_goodbyex
```yaml
networks:
  supabase_network_goodbyex:
    external: true
    # Réseau externe pour connexion Supabase
```

## Volumes Docker

### Volumes Partagés
```yaml
volumes:
  # Stockage temporaire en mémoire
  shared-tmp:
    driver: local
    driver_opts:
      type: tmpfs
      device: tmpfs
      o: "noexec,nosuid,size=1g"

  # Logs centralisés
  app_logs:
    driver: local
    driver_opts:
      type: none
      device: /home/ubuntu/openportability_logs
      o: "bind,noexec"

  # Données Redis persistantes
  redis_data:
    driver: local
```

## Variables d'Environnement

### Fichier .env.local (App)
```bash
# Base de données
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# NextAuth
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=http://localhost:3000

# Redis
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=xxx

# APIs externes
TWITTER_API_KEY=xxx
BLUESKY_API_URL=https://bsky.social
MASTODON_DEFAULT_INSTANCE=mastodon.social

# Configuration
NODE_ENV=production
LOG_LEVEL=info
```

### Fichier worker/.env (Worker)
```bash
# Base de données
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# Redis
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=xxx

# Configuration Worker
WORKER_ID=worker_1
POLLING_INTERVAL=30000
STALLED_JOB_TIMEOUT=60000
CIRCUIT_BREAKER_RESET_TIMEOUT=15000
RETRY_DELAY=15000

# Logs
LOG_LEVEL=info
```

### Fichier python_worker/.env (Python Worker)
```bash
# Base de données
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# Redis
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=xxx

# APIs
BLUESKY_API_URL=https://bsky.social
MASTODON_API_BASE=https://mastodon.social

# Configuration
WORKER_ID=python_worker_1
MAX_RETRIES=3
LOG_LEVEL=info
```

## Commandes Docker Utiles

### Développement
```bash
# Démarrage en mode développement
docker-compose -f docker-compose.dev.yml up -d

# Logs en temps réel
docker-compose logs -f

# Rebuild d'un service
docker-compose build app
docker-compose up -d app

# Shell dans un conteneur
docker-compose exec app sh
docker-compose exec worker sh
```

### Production
```bash
# Démarrage production
docker-compose up -d

# Mise à jour des images
docker-compose pull
docker-compose up -d

# Backup des volumes
docker run --rm -v redis_data:/data -v $(pwd):/backup alpine tar czf /backup/redis_backup.tar.gz -C /data .

# Restauration
docker run --rm -v redis_data:/data -v $(pwd):/backup alpine tar xzf /backup/redis_backup.tar.gz -C /data
```

### Monitoring
```bash
# Statut des services
docker-compose ps

# Utilisation des ressources
docker stats

# Logs d'erreur
docker-compose logs --tail=50 app | grep ERROR

# Health check
docker-compose exec redis redis-cli ping
curl http://localhost/health
```

## Optimisations de Performance

### Multi-stage Builds
- Séparation des étapes de build et runtime
- Réduction de la taille des images finales
- Cache des layers Docker optimisé

### Resource Limits
```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
```

### Health Checks
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

## Sécurité Docker

### User Privileges
- Utilisation d'utilisateurs non-root
- Permissions minimales sur les volumes
- Isolation des réseaux

### Secrets Management
```yaml
secrets:
  db_password:
    file: ./secrets/db_password.txt
  api_key:
    external: true
```

### Image Security
- Images Alpine pour réduire la surface d'attaque
- Scan de vulnérabilités régulier
- Mise à jour des images de base

## Troubleshooting

### Problèmes Courants

1. **Service ne démarre pas**
   ```bash
   docker-compose logs service_name
   docker-compose exec service_name sh
   ```

2. **Problème de réseau**
   ```bash
   docker network ls
   docker network inspect app_network
   ```

3. **Volume non monté**
   ```bash
   docker volume ls
   docker volume inspect volume_name
   ```

4. **Mémoire insuffisante**
   ```bash
   docker system df
   docker system prune
   ```
