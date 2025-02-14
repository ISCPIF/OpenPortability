FROM node:18-alpine

# Créer un utilisateur non-root
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser

# Définir le répertoire de travail
WORKDIR /app

# Installer les dépendances système nécessaires (en tant que root)
RUN apk add --no-cache python3 make g++ gcc

# Copier les fichiers de dépendances avec les bonnes permissions
COPY --chown=appuser:appgroup package*.json ./

# Donner les permissions à l'utilisateur non-root
RUN chown -R appuser:appgroup /app

# Passer à l'utilisateur non-root pour les installations npm
USER appuser

# Installer les dépendances npm
RUN npm install

# Copier le reste des fichiers avec les bonnes permissions
COPY --chown=appuser:appgroup . .

# Build de l'application
RUN npm run build

# Exposer le port si nécessaire
EXPOSE 3000

CMD ["npm", "start"]