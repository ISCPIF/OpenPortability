# Build stage
FROM node:20-alpine AS builder

# Create non-root user
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser

RUN npm install -g npm@11.2.0


WORKDIR /app

# Set ownership of the working directory
RUN chown -R appuser:appgroup /app

# Copy dependency files with correct ownership
COPY --chown=appuser:appgroup package*.json ./

# Create node_modules with correct permissions
RUN mkdir -p node_modules && chown -R appuser:appgroup node_modules

# Switch to non-root user
USER appuser


RUN npm install

# Copy source with correct ownership
COPY --chown=appuser:appgroup . .

RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Create the same non-root user in production stage
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser

RUN npm install -g npm@11.2.0


WORKDIR /app


# Set ownership of the working directory
RUN chown -R appuser:appgroup /app

ENV NODE_ENV production
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Copy dependency files with correct ownership
COPY --chown=appuser:appgroup package*.json ./

# Create node_modules with correct permissions
RUN mkdir -p node_modules && chown -R appuser:appgroup node_modules

# Switch to non-root user
USER appuser


RUN npm install --production

# Copy built files from builder stage with correct ownership
COPY --chown=appuser:appgroup --from=builder /app/.next ./.next
COPY --chown=appuser:appgroup --from=builder /app/public ./public
COPY --chown=appuser:appgroup --from=builder /app/next.config.js ./

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