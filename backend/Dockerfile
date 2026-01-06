# ===== Stage 1: Dependencies =====
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# ===== Stage 2: Build =====
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ===== Stage 3: Production =====
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 expressjs

# Copy built files and production dependencies
COPY --from=deps --chown=expressjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=expressjs:nodejs /app/dist ./dist
COPY --from=builder --chown=expressjs:nodejs /app/package.json ./

# Data directories will be mounted via docker-compose volumes
# Create placeholder directories with correct ownership
RUN mkdir -p data skills && chown -R expressjs:nodejs data skills

USER expressjs

EXPOSE 3001
CMD ["node", "dist/server.js"]
