# ============================================================
# FREE INTERPRETERS OS — MULTI-STAGE DOCKERFILE
# Target: Easypanel (Docker/VPS ~457MB RAM) — STANDALONE BUILD
# ============================================================

# --- STAGE 1: Dependencies ---
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# --- STAGE 2: Builder ---
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client (requires schema, NOT DATABASE_URL)
RUN npx prisma generate

# Build-time args: ONLY public vars needed for static bundling.
# SENSITIVE vars (DATABASE_URL, AUTH_SECRET) are injected at RUNTIME
# by Easypanel — they must NOT appear as build ARGs.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_ROLE

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_ROLE=$NEXT_PUBLIC_APP_ROLE

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Increase heap during build (build machine has more RAM than runtime)
ENV NODE_OPTIONS="--max-old-space-size=2048"

RUN npm run build

# --- STAGE 3: Runner (Ultra-Lean ~150MB) ---
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl curl
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build (server.js + minimal node_modules)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Runtime config: Aggressive memory for ~457MB VPS
ENV PORT=80
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Limit heap to 384MB → triggers GC before the 457MB hard kill
ENV NODE_OPTIONS="--max-old-space-size=384"

# ── HEALTHCHECK ──────────────────────────────────────────────
# Points to /api/health which does a raw SELECT 1 against the DB.
# start-period=60s gives the container time to warm up before
# Easypanel starts counting failures.
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://127.0.0.1:80/api/health || exit 1

USER nextjs
EXPOSE 80

CMD ["node", "server.js"]
