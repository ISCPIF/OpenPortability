# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Update npm to latest version
RUN npm install -g npm@11.1.0

COPY package*.json ./
COPY tsconfig*.json ./
COPY next.config.js ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY package*.json ./
COPY tsconfig*.json ./
COPY next.config.js ./
RUN npm install --production

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["npm", "run", "start"]

# # Build stage
# FROM node:20-alpine
# WORKDIR /app

# # Update npm to latest version
# RUN npm install -g npm@11.1.0

# # Copier uniquement les fichiers nécessaires pour npm install
# COPY package*.json ./
# COPY tsconfig*.json ./
# COPY next.config.js ./

# # Installer les dépendances avec cache
# RUN npm install

# # Set environment variables
# ENV NODE_ENV=development
# ENV NEXT_TELEMETRY_DISABLED=1
# ENV PORT=3000
# ENV HOSTNAME="0.0.0.0"

# # Exposer le port
# EXPOSE 3000

# # Utiliser npm run dev pour le hot reload
# CMD ["npm", "run", "dev"]