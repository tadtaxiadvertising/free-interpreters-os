# ============================================================
# FREE INTERPRETERS OS — STABLE MULTI-STAGE DOCKERFILE
# Target: Easypanel (Docker/VPS ~457MB RAM) — STANDALONE BUILD
# ============================================================

# --- STAGE 1: Dependencies ---
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy package definition files
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Clean install of all dependencies (needed for build & Prisma client)
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

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Limit heap to 384MB → triggers GC before the 457MB hard kill
ENV NODE_OPTIONS="--max-old-space-size=384"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build (server.js + minimal node_modules)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# ── HEALTHCHECK ──────────────────────────────────────────────
# Points to /api/health (a zero-auth, ultra-fast endpoint).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
