# ============================================================
# INTERPRETERS — FRONTEND PRODUCTION DOCKERFILE
# Target: Easypanel (Docker/VPS)
# ============================================================
# Optimized Multistage Build for Next.js 16 SSR (No Prisma)
# ────────────────────────────────────────────────────────────

# --- STAGE 1: Dependencies ---
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

# --- STAGE 2: Builder ---
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time args (public vars must be available at build time)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# --- STAGE 3: Runner ---
FROM node:22-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

RUN apk add --no-cache curl

# Copy standalone build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Runtime config
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# CRITICAL: NEXT_PUBLIC_* vars must also be available at RUNTIME
# for middleware and Server Components (they read process.env at runtime).
# These are NOT set here — they MUST be injected by Easypanel as
# runtime environment variables in the service's Environment tab.
# Without them, the middleware will crash → 502 Bad Gateway.

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://127.0.0.1:3000/login || exit 1

USER nextjs
EXPOSE 3000

CMD ["sh", "-c", "echo '🚀 INTERPRETERS-FRONTEND starting on port: '\"$PORT\"' (internal)' && node server.js"]
