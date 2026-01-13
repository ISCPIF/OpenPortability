#  # Build stage
# FROM node:24-alpine AS builder

# # Create non-root user
# RUN addgroup -g 1001 appgroup && \
#     adduser -u 1001 -G appgroup -s /bin/sh -D appuser

# RUN npm install -g npm@11.6.0


# WORKDIR /app

# # Set ownership of the working directory
# RUN chown -R appuser:appgroup /app

# # Copy dependency files with correct ownership
# COPY --chown=appuser:appgroup package*.json ./

# # Create node_modules with correct permissions
# RUN mkdir -p node_modules && chown -R appuser:appgroup node_modules

# # Switch to non-root user
# USER appuser


# RUN npm install

# # Copy source with correct ownership
# COPY --chown=appuser:appgroup . .

# RUN npm run build

# # Production stage
# FROM node:24-alpine AS production

# # Create the same non-root user in production stage
# RUN addgroup -g 1001 appgroup && \
#     adduser -u 1001 -G appgroup -s /bin/sh -D appuser

# RUN npm install -g npm@11.6.0


# WORKDIR /app


# # Set ownership of the working directory
# RUN chown -R appuser:appgroup /app

# ENV NODE_ENV production
# ENV PORT 3000
# ENV HOSTNAME "0.0.0.0"

# # Copy dependency files with correct ownership
# COPY --chown=appuser:appgroup package*.json ./

# # Create node_modules with correct permissions
# RUN mkdir -p node_modules && chown -R appuser:appgroup node_modules

# # Switch to non-root user
# USER appuser


# RUN npm install --production

# # Copy built files from builder stage with correct ownership
# COPY --chown=appuser:appgroup --from=builder /app/.next ./.next
# COPY --chown=appuser:appgroup --from=builder /app/public ./public
# COPY --chown=appuser:appgroup --from=builder /app/next.config.js ./

# EXPOSE 3000

# CMD ["npm", "run", "start"]

# Build stage
FROM node:24-alpine
WORKDIR /app

# Update npm to latest version
RUN npm install -g npm@11.6.0

# Optimisations spécifiques pour le développement
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Variables d'environnement pour optimiser Docker + Next.js
ENV WATCHPACK_POLLING=true
ENV CHOKIDAR_USEPOLLING=true
ENV CHOKIDAR_INTERVAL=1000


WORKDIR /app

# Set ownership of the working directory
RUN chown -R node:node /app

# ============================================
# Build embedding-atlas from local source
# ============================================
# Copy embedding-atlas source first (for caching)
COPY --chown=node:node embedding-atlas ./embedding-atlas

# Build embedding-atlas packages (as root, then fix permissions)
WORKDIR /app/embedding-atlas
RUN npm install && npm run build && chown -R node:node /app/embedding-atlas

# Go back to app directory
WORKDIR /app

# ============================================
# Install app dependencies
# ============================================
# Copy dependency files with correct ownership
COPY --chown=node:node package*.json ./

# Create node_modules with correct permissions
RUN mkdir -p node_modules && chown -R node:node node_modules

# Switch to non-root user
USER node

RUN npm install

# Copier le reste des fichiers (après npm install pour optimiser le cache Docker)
COPY . .

# Créer le répertoire .next avec les bonnes permissions
RUN mkdir -p .next

# Utiliser l'utilisateur node pour la sécurité


EXPOSE 3000

# Option 1: Avec Turbopack (recommandé mais peut être instable)
# CMD ["npm", "run", "dev", "--", "--turbo", "--port", "3000", "--hostname", "0.0.0.0"]

# Option 2: Sans Turbopack (plus stable)
CMD ["npm", "run", "dev", "--", "--port", "3000", "--hostname", "0.0.0.0"]
