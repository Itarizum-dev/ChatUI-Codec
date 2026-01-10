# ===== Stage 1: Build =====
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ===== Stage 2: Production =====
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy built files
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Data directories (mounted via docker-compose volumes)
# Ensure logs and data dir are writable by node user
RUN mkdir -p data skills && \
    touch backend-debug.log && \
    chown -R node:node data skills backend-debug.log

USER node

EXPOSE 3001
CMD ["node", "dist/server.js"]
