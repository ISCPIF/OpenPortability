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
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/messages ./messages
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["npm", "run", "start"]