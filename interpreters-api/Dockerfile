# ============================================================
# INTERPRETERS API — BACKEND DOCKERFILE
# Target: Easypanel (Docker/VPS) - HIGH PERFORMANCE / LOW MEMORY
# ============================================================

# --- STAGE 1: Builder ---
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copiar dependencias
COPY package.json package-lock.json ./
RUN npm ci

# Copiar código fuente
COPY . .

# Dar permisos de ejecución a todos los binarios y compilar
RUN chmod -R +x ./node_modules/.bin
RUN npm run prisma:generate
RUN npm run build

# --- STAGE 2: Runner ---
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl curl
WORKDIR /app

# Definir usuario no-root por seguridad
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 apiuser
RUN chown -R apiuser:nodejs /app

# Instalar solo dependencias de producción (como el usuario apiuser)
COPY --chown=apiuser:nodejs package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copiar build y binarios generados de Prisma desde builder
COPY --chown=apiuser:nodejs --from=builder /app/dist ./dist
COPY --chown=apiuser:nodejs --from=builder /app/prisma ./prisma
COPY --chown=apiuser:nodejs --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=apiuser:nodejs --from=builder /app/node_modules/@prisma ./node_modules/@prisma

ENV NODE_ENV=production
ENV PORT=3000
# CRÍTICO: Forzar escucha en todas las interfaces, no solo localhost
ENV HOSTNAME="0.0.0.0"
# CORS_ORIGINS: comma-separated list of allowed frontend origins
# Set in Easypanel env vars, e.g.: https://interpreters.example.com,https://admin.example.com
# If not set, CORS will be open (development fallback).
# ENV CORS_ORIGINS=""

# MEMORY OPTIMIZATION: Bumped from 150 to 256 for stability
ENV NODE_OPTIONS="--max-old-space-size=256"

USER apiuser

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

EXPOSE 3000

# Usamos node directamente (npm consume ~30MB adicionales de RAM)
CMD ["node", "dist/server.js"]
