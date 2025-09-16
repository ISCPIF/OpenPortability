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

# RUN npm install -g npm@11.4.2


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

# Development optimizations
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Environment variables to optimize Docker + Next.js
ENV WATCHPACK_POLLING=true
ENV CHOKIDAR_USEPOLLING=true
ENV CHOKIDAR_INTERVAL=1000

# Set ownership of the working directory to the node user
RUN chown -R node:node /app

# Copy dependency files with correct ownership
COPY --chown=node:node package*.json ./

# Switch to non-root user before installing dependencies
USER node

# Install dependencies
RUN npm install

# Copy the rest of the files (after npm install to optimize Docker cache)
COPY --chown=node:node . .

# Create .next directory with correct permissions
RUN mkdir -p .next

EXPOSE 3000

# Option 1: With Turbopack (recommended but may be unstable)
# CMD ["npm", "run", "dev", "--", "--turbo", "--port", "3000", "--hostname", "0.0.0.0"]

# Option 2: Without Turbopack (more stable)
CMD ["npm", "run", "dev", "--", "--port", "3000", "--hostname", "0.0.0.0"]