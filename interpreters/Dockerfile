# ============================================================
# INTERPRETERS — PRODUCTION DOCKERFILE
# Target: Easypanel (Docker/VPS) — Role: INTERPRETER only
# ============================================================

# --- STAGE 1: Dependencias ---
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# --- STAGE 2: Builder ---
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL
ARG AUTH_TRUST_HOST
ARG NEXT_PUBLIC_API_URL
ARG DATABASE_URL
ARG DIRECT_URL

ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV AUTH_TRUST_HOST=$AUTH_TRUST_HOST
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV DATABASE_URL=$DATABASE_URL
ENV DIRECT_URL=$DIRECT_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# --- STAGE 3: Runner ---
FROM node:22-alpine AS runner
RUN apk add --no-cache curl openssl libc6-compat

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=80
ENV HOSTNAME="0.0.0.0"

# MEMORY OPTIMIZATION: Para VPS de <150MB RAM
ENV NODE_OPTIONS="--max-old-space-size=100"

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://127.0.0.1:80/api/health || exit 1

USER nextjs
EXPOSE 80

# Iniciamos con node directamente (ahorra RAM vs npm)
CMD ["node", "server.js"]
