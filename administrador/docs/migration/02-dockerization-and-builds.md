# 02 — Dockerization & Builds

> **Objetivo**: Contenerizar la aplicación Next.js 16 con un Dockerfile multistage optimizado para producción, y documentar la alternativa Nixpacks.

---

## Propósito

Crear una imagen Docker que produzca un contenedor de ~150MB (vs. ~1GB sin optimizar) con la aplicación lista para producción. Se usa el output `standalone` de Next.js para eliminar dependencias innecesarias del bundle final.

---

## Prerrequisitos

- Proyecto con `next.config.ts` accesible.
- Docker instalado localmente (para pruebas) — o confiar en Nixpacks de Easypanel.
- Node.js 22 LTS como target runtime.

---

## Paso 1: Configurar Next.js para Standalone Output

Editar `next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Desactivar telemetría de Next.js en el contenedor
  env: {
    NEXT_TELEMETRY_DISABLED: "1",
  },
};

export default nextConfig;
```

> **Nota**: `output: "standalone"` genera una carpeta `.next/standalone` con un servidor Node.js mínimo y solo las dependencias necesarias. Reduce el tamaño de la imagen final drásticamente.

---

## Paso 2: Crear `.dockerignore`

```dockerignore
# Dependencias (se instalan en el build)
node_modules
.pnp
.pnp.js

# Build output local
.next
out

# Testing & tooling
coverage
.nyc_output

# IDEs & OS
.vscode
.idea
*.swp
.DS_Store
Thumbs.db

# Git
.git
.gitignore

# Vercel (legacy — eliminar del repo también)
.vercel
vercel.json

# Environment (se inyectan en runtime)
.env
.env.local
.env.development
.env.production

# Documentation
docs
Documentation
README.md
CLAUDE.md
AGENTS.md

# Logs
*.log
out.log

# Scratch files
scratch
```

---

## Paso 3: Dockerfile Multistage (Producción)

```dockerfile
# ============================================================
# STAGE 1: Dependencies — Instalar solo producción + Prisma
# ============================================================
FROM node:22-alpine AS deps

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Instalar todas las dependencias (incluyendo devDeps para prisma generate)
RUN npm ci

# Generar el Prisma Client
RUN npx prisma generate

# ============================================================
# STAGE 2: Builder — Compilar la aplicación Next.js
# ============================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copiar dependencias instaladas
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variables de build (no se persisten en la imagen final)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build de Next.js (produce .next/standalone)
RUN npm run build

# ============================================================
# STAGE 3: Runner — Imagen final mínima de producción
# ============================================================
FROM node:22-alpine AS runner

WORKDIR /app

# Crear usuario no-root para seguridad
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Instalar dependencias del sistema mínimas
RUN apk add --no-cache openssl curl

# Copiar archivos públicos estáticos
COPY --from=builder /app/public ./public

# Copiar el standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copiar Prisma schema + client generado (necesario en runtime)
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

# Metadata
LABEL maintainer="Free Interpreters Team"
LABEL description="Free Interpreters CRM — Production Build"

# Cambiar al usuario no-root
USER nextjs

# Exponer el puerto de la app
EXPOSE 3000

# Variables de entorno de runtime
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Health check para Docker/Easypanel
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Comando de inicio
CMD ["node", "server.js"]
```

### Desglose de Tamaños

| Stage     | Contenido                            | Tamaño Estimado |
| :-------- | :----------------------------------- | :-------------- |
| `deps`    | node_modules + Prisma Client         | ~800MB          |
| `builder` | .next/standalone + static            | ~600MB          |
| `runner`  | Standalone server + static + Prisma  | **~150-200MB**  |

---

## Paso 4: Build Local (Testing)

### 4.1 Build de la Imagen

```bash
# Desde la raíz del proyecto
docker build -t free-interp-os:latest .

# Con build args para variables necesarias en build-time
docker build \
  --build-arg DATABASE_URL="postgresql://postgres:password@host.docker.internal:5432/freeinterpreters" \
  -t free-interp-os:latest .
```

### 4.2 Ejecutar Localmente

```bash
docker run -d \
  --name free-interp-os \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://postgres:password@host.docker.internal:5432/freeinterpreters" \
  -e JWT_SECRET="dev-secret-change-in-production" \
  free-interp-os:latest
```

### 4.3 Verificar

```bash
# Ver logs
docker logs free-interp-os --follow

# Health check manual
curl http://localhost:3000

# Inspeccionar tamaño final
docker images free-interp-os
```

---

## Paso 5: Alternativa — Nixpacks en Easypanel

Easypanel soporta **Nixpacks** (auto-detection de framework). Si prefieres no mantener un Dockerfile manualmente:

### 5.1 Cómo Funciona Nixpacks

Nixpacks detecta automáticamente:

- **Lenguaje**: Node.js (por `package.json`)
- **Framework**: Next.js (por `next.config.ts`)
- **Build command**: `npm run build`
- **Start command**: `npm run start`

### 5.2 Configurar en Easypanel

1. En el proyecto → **+ New Service** → **App**.
2. **Source**: GitHub (conectar repo).
3. **Build Method**: Seleccionar **Nixpacks** (default).
4. Easypanel auto-detecta la configuración y construye la imagen.

### 5.3 Nixpacks vs. Dockerfile Custom

| Criterio             | Nixpacks                   | Dockerfile Multistage          |
| :------------------- | :------------------------- | :----------------------------- |
| Configuración        | Zero-config                | Manual                         |
| Tamaño de imagen     | ~400-600MB                 | ~150-200MB                     |
| Control sobre layers | Limitado                   | Total                          |
| Caching de deps      | Automático                 | Configurable por layer         |
| Prisma compatibility | Funciona con `postinstall` | Explícito en Dockerfile        |
| Recomendación        | Para empezar rápido        | **Para producción optimizada** |

> **Recomendación**: Usar el Dockerfile multistage proporcionado. Nixpacks es una alternativa válida para prototipado rápido, pero el Dockerfile da control total sobre el tamaño y seguridad de la imagen.

---

## Paso 6: Configurar App Service en Easypanel (con Dockerfile)

### 6.1 Crear el Servicio

1. En el proyecto `free-interp-os` → **+ New Service** → **App**.
2. **Service Name**: `app`.
3. **Source**: GitHub.
4. **Repository**: `<tu-org>/free-interpreters-os`.
5. **Branch**: `main`.
6. **Build Method**: **Dockerfile** (seleccionar).
7. **Dockerfile Path**: `./Dockerfile` (raíz del repo).

### 6.2 Configurar Dominio

1. En el servicio `app` → **Domains**.
2. Agregar: `app.freeinterpreters.com`.
3. Easypanel configurará Traefik automáticamente con SSL.

### 6.3 Configurar Puerto

1. En el servicio `app` → **Settings**.
2. **Port**: `3000`.
3. **Protocol**: HTTP.

### 6.4 Configurar Resources

| Recurso | Valor Recomendado | Mínimo |
| :------ | :---------------- | :----- |
| CPU     | 1 core            | 0.5    |
| Memory  | 1024 MB           | 512 MB |
| Swap    | 512 MB            | 256 MB |

---

## Troubleshooting

### Error: `prisma generate` falla durante el build

```bash
# Verificar que el schema está copiado antes del generate
# En el Dockerfile, la secuencia debe ser:
# COPY prisma ./prisma/   ← ANTES de npm ci
# RUN npm ci
# RUN npx prisma generate
```

### Error: `ENOENT: no such file or directory, open '.next/BUILD_ID'`

```bash
# Causa: `output: "standalone"` no está configurado en next.config.ts
# Solución: Verificar que next.config.ts contiene:
#   output: "standalone"
```

### Error: Imagen demasiado grande (>1GB)

```bash
# Verificar que .dockerignore existe y excluye:
# - node_modules
# - .git
# - .next

# Verificar las capas de la imagen
docker history free-interp-os:latest
```

### Error: `Cannot find module '/app/server.js'`

```bash
# Causa: El standalone output no se copió correctamente
# Verificar que el COPY en el stage runner apunta a:
# COPY --from=builder /app/.next/standalone ./

# Verificar que el CMD es:
# CMD ["node", "server.js"]
# (NO "npm start" — standalone usa server.js directo)
```

### Build tarda demasiado en el VPS

```bash
# Opciones:
# 1. Hacer el build en GitHub Actions y subir la imagen al registry
# 2. Aumentar el swap del VPS:
sudo fallocate -l 8G /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 3. Usar Docker BuildKit para caching:
DOCKER_BUILDKIT=1 docker build -t free-interp-os:latest .
```

### Nixpacks no detecta Next.js

```bash
# Verificar que package.json tiene los scripts:
# "build": "prisma generate && next build"
# "start": "next start"

# Si Nixpacks falla, crear un archivo nixpacks.toml en la raíz:
```

```toml
# nixpacks.toml
[phases.setup]
nixPkgs = ["nodejs_22", "openssl"]

[phases.install]
cmds = ["npm ci"]

[phases.build]
cmds = ["npx prisma generate", "npm run build"]

[start]
cmd = "npm run start"
```
