FROM node:18-alpine
WORKDIR /app

# Copier tous les fichiers du projet
COPY . .

# Installer les dépendances
RUN npm install

# Set environment variables
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Exposer le port
EXPOSE 3000

# Utiliser npm run dev pour le hot reload
CMD ["npm", "run", "dev"]