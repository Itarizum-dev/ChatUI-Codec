# ===== Stage 1: Build =====
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ===== Stage 2: Production =====
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 expressjs

# Copy built files
COPY --from=builder --chown=expressjs:nodejs /app/dist ./dist
COPY --from=builder --chown=expressjs:nodejs /app/package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Data directories (mounted via docker-compose volumes)
RUN mkdir -p data skills && \
    touch backend-debug.log && \
    chown -R expressjs:nodejs data skills backend-debug.log

USER expressjs

EXPOSE 3001
CMD ["node", "dist/server.js"]
