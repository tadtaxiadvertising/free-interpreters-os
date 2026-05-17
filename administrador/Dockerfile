# ============================================================
# ADMINISTRADOR — PRODUCTION DOCKERFILE (Stabilized)
# Target: Easypanel (Docker/VPS) — Role: interpreters service
# ============================================================
# FIXES APPLIED:
#   1. Removed redundant standalone/node_modules COPY (Defect 5)
#   2. Added prisma generate to ensure client is built with driver adapters
#   3. Optimized layer caching with explicit COPY ordering
#   4. HOSTNAME=0.0.0.0 for Docker network visibility
#   5. Telemetry OFF to save RAM on boot
#   6. Non-root user for container security
# ============================================================

# --- STAGE 1: Dependencies ---
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# --- STAGE 2: Builder ---
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time args injected by Easypanel
# NEXT_PUBLIC_* vars are inlined into the client bundle during `next build`
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL
ARG DATABASE_URL
ARG DIRECT_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV DATABASE_URL=$DATABASE_URL
ENV DIRECT_URL=$DIRECT_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generate Prisma client with driver adapters BEFORE building Next.js
RUN npx prisma generate

RUN npm run build

# --- STAGE 3: Runner (minimal production image) ---
FROM node:22-alpine AS runner
RUN apk add --no-cache curl openssl libc6-compat

WORKDIR /app

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build artifacts
# The standalone output is SELF-CONTAINED — it includes its own node_modules.
# Do NOT copy node_modules separately; doing so doubles the layer size
# and can cause version conflicts (Defect 5).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema + generated client for runtime introspection
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Runtime environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=80
ENV HOSTNAME="0.0.0.0"

# MEMORY OPTIMIZATION: Strict V8 heap limit for ~457 MB containers.
# Next.js standalone server + pg pool typically uses 80-150 MB RSS.
# This prevents OOM kills from V8 heap growth during CSV imports.
ENV NODE_OPTIONS="--max-old-space-size=256"

# Health check — pure liveness probe, no DB dependency
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://127.0.0.1:80/api/health || exit 1

USER nextjs
EXPOSE 80

# Start with node directly (saves ~20 MB vs npm start)
CMD ["node", "server.js"]
