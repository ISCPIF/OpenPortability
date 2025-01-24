# Stage de build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage de production
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

# Copie des fichiers nécessaires
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/messages ./messages

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Utiliser le serveur Next.js intégré
CMD ["node", ".next/standalone/server.js"]