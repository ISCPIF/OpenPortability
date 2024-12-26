FROM node:18-alpine

WORKDIR /app

# Installer les dépendances nécessaires
RUN apk add --no-cache python3 make g++ gcc

# Copier les fichiers de dépendances
COPY package*.json ./
RUN npm install

# Copier le reste des fichiers
COPY . .
RUN npm run build

# Exposer le port si nécessaire
EXPOSE 3000

CMD ["npm", "start"]