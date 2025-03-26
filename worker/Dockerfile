FROM node:20-alpine

# Créer un utilisateur non-root
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser

# Installation de bash
RUN apk add --no-cache bash

RUN npm install -g npm@11.2.0

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers avec les bonnes permissions
COPY --chown=appuser:appgroup package*.json ./
COPY --chown=appuser:appgroup . .

# Donner les permissions à l'utilisateur non-root
RUN chown -R appuser:appgroup /app

# Passer à l'utilisateur non-root pour l'installation et le build
USER appuser


RUN npm install
RUN npm run build

# Rendre le script executable
RUN chmod +x start-workers.sh

ENV NODE_ENV=production

CMD ["/bin/bash", "./start-workers.sh"]