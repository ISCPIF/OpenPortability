FROM node:18-alpine AS builder
WORKDIR /app

# Install bash
RUN apk add --no-cache bash

# Copier d'abord les fichiers de dépendances
COPY package*.json ./

# Installer toutes les dépendances (y compris devDependencies pour le build)
RUN npm ci

# Copier le reste des fichiers
COPY . .

# Build TypeScript
RUN npm run build

# Stage de production
FROM node:18-alpine
WORKDIR /app

RUN apk add --no-cache bash

COPY package*.json ./
RUN npm ci --only=production

# Copier les fichiers buildés et les scripts
COPY --from=builder /app/dist ./dist
COPY start-workers.sh .
RUN chmod +x start-workers.sh

ENV NODE_ENV=production

CMD ["/bin/bash", "./start-workers.sh"]