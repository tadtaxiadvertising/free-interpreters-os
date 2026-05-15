# 00 — Migration Overview: Vercel → Easypanel

> **Project**: Free Interpreters CRM v2  
> **From**: Vercel Hobby (Serverless / Edge)  
> **To**: Easypanel (Docker Containers / VPS)  
> **Budget**: $0 — Oracle Cloud Free Tier + Open Source  
> **Last Updated**: 2026-04-30

---

## Propósito

Este documento define el cambio de paradigma de arquitectura de la plataforma Free Interpreters OS: de un modelo **Serverless (Vercel)** hacia un modelo **Stateful/Dockerizado (Easypanel)** sobre un VPS con capa gratuita permanente.

---

## 1. ¿Por Qué Migrar?

| Limitación en Vercel Hobby          | Solución en Easypanel/VPS                       |
| :---------------------------------- | :---------------------------------------------- |
| Timeout de 10s en Serverless Fn     | Sin timeout — proceso Node.js persistente       |
| Frío arranque (Cold Start) en Edge  | Contenedor siempre en ejecución (hot)           |
| 100 builds/día máximo               | Builds ilimitados vía webhook                   |
| 50MB máximo por función             | Sin límite de bundle (memoria del VPS)          |
| Base de datos externa obligatoria   | PostgreSQL local en el mismo host (latencia ~0) |
| Sin acceso a filesystem persistente | Volúmenes Docker persistentes                   |
| Dependencia de Clerk Auth (SaaS)    | Auth nativa con JWT (`jose` + `bcryptjs`)       |
| Vendor lock-in en Edge Runtime      | Node.js estándar — portable a cualquier VPS     |

---

## 2. Arquitectura Anterior (Vercel)

```text
┌──────────────┐    HTTPS    ┌────────────────────┐    HTTP/WS     ┌────────────┐
│   Cloudflare  │ ─────────→ │   Vercel Edge CDN   │ ────────────→ │ Neon.tech   │
│   (DNS)       │            │   Next.js SSR        │              │ PostgreSQL  │
│               │            │   Server Actions     │              │ (Serverless)│
└──────────────┘            │   Clerk Middleware   │              └────────────┘
                             └────────────────────┘
                                     │
                                     ├─ Edge Functions (auth check, 25s max)
                                     ├─ Serverless Functions (CRUD, 10s max)
                                     └─ ISR/SSG (static pages, CDN cache)
```

**Dependencias eliminadas en la migración:**

- `vercel.json` — Configuración de despliegue Vercel
- `.vercel/` — Directorio local de Vercel CLI
- Vercel Edge Runtime — Sustituido por Node.js estándar
- Clerk Auth SDK — Sustituido por JWT nativo (`jose` + `bcryptjs`)
- `@neondatabase/serverless` — Sustituido por `pg` driver estándar
- `@supabase/ssr`, `@supabase/supabase-js` — Eliminados (legacy)
- ISR/Edge caching — Sustituido por `Cache-Control` headers + Redis opcional

---

## 3. Arquitectura Nueva (Easypanel)

```text
┌──────────────────────────────────────────────────────────────────────┐
│                        VPS (Oracle Cloud ARM)                       │
│                        Ubuntu 22.04 · 4 vCPU · 24GB RAM · 200GB    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                        Easypanel                              │    │
│  │                   (Panel de Control Web)                      │    │
│  │                                                                │    │
│  │  ┌─────────────┐    ┌────────────────┐    ┌───────────────┐   │    │
│  │  │   Traefik    │    │  free-interp   │    │  PostgreSQL   │   │    │
│  │  │  (Reverse    │───→│  -os (App)     │───→│  16 (DB)      │   │    │
│  │  │   Proxy)     │    │                │    │               │   │    │
│  │  │              │    │  Next.js 16    │    │  Vol: pgdata  │   │    │
│  │  │  :80 / :443  │    │  Node.js 22   │    │  :5432        │   │    │
│  │  │  SSL Auto    │    │  :3000        │    │  (internal)   │   │    │
│  │  └─────────────┘    └────────────────┘    └───────────────┘   │    │
│  │         │                                                      │    │
│  │         │            ┌───────────────┐                        │    │
│  │         │            │  Redis 7      │  (Opcional)            │    │
│  │         └───────────→│  Cache/Queue  │                        │    │
│  │                      │  :6379        │                        │    │
│  │                      └───────────────┘                        │    │
│  │                                                                │    │
│  │  Red Interna Docker: easypanel-network (bridge)               │    │
│  │  Todos los servicios se comunican por hostname interno        │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Mapa de Red Interno

| Servicio    | Hostname Interno           | Puerto | Acceso Externo     |
| :---------- | :------------------------- | :----- | :----------------- |
| Traefik     | (gestionado por Easypanel) | 80/443 | ✅ Público (HTTPS) |
| App Next.js | `free-interp-os`           | 3000   | ❌ Solo vía Traefik|
| PostgreSQL  | `free-interp-os-db`        | 5432   | ❌ Solo interno    |
| Redis       | `free-interp-os-redis`     | 6379   | ❌ Solo interno    |

### Flujo de una Request

```text
Cliente (Browser)
    │
    ▼
Traefik (:443, TLS automático via Let's Encrypt)
    │
    ▼ proxy_pass → http://free-interp-os:3000
    │
App Container (Next.js 16 en modo `next start`)
    │
    ├─→ Prisma ORM → PostgreSQL (:5432 interno, TCP directo)
    │                  Latencia: < 1ms (mismo host)
    │
    └─→ Redis (:6379 interno) — cache de sesiones, rate limiting
```

---

## 4. Cambio de Paradigma

| Aspecto           | Vercel (Antes)                   | Easypanel (Después)                  |
| :---------------- | :------------------------------- | :----------------------------------- |
| **Runtime**       | Serverless Functions (aisladas)  | Proceso Node.js persistente          |
| **State**         | Stateless (cada request = nuevo) | Stateful (in-memory cache posible)   |
| **DB Connection** | Pool efímero (max ~10, HTTP)     | Pool persistente (max ~50, TCP)      |
| **Build**         | Vercel CI (auto en push)         | GitHub Actions → Webhook Easypanel   |
| **SSL**           | Automático (Vercel)              | Automático (Traefik + Let's Encrypt) |
| **Logs**          | Vercel Dashboard (limitado)      | Docker logs + Easypanel UI           |
| **Escalado**      | Auto-scale (Vercel)              | Vertical (upgrade VPS) o Horizontal  |
| **Costo**         | $0 (con limites estrictos)       | $0 (Oracle Cloud Always Free Tier)   |
| **Auth**          | Clerk SaaS                       | JWT nativo (`jose` + `bcryptjs`)     |
| **DB Host**       | Neon.tech (remoto, ~50-100ms)    | Localhost (<1ms)                     |

---

## 5. Inventario de Archivos a Eliminar/Modificar

### Eliminar

| Archivo/Directorio | Motivo                             |
| :----------------- | :--------------------------------- |
| `.vercel/`         | Configuración local de Vercel CLI  |
| `vercel.json`      | No aplica en Easypanel (si existe) |

### Modificar

| Archivo                | Cambio                                                     |
| :--------------------- | :--------------------------------------------------------- |
| `package.json`         | Eliminar `@supabase/*`, `svix`; agregar script `docker`    |
| `prisma/schema.prisma` | Confirmar `provider = "postgresql"` sin driver serverless  |
| `next.config.ts`       | Agregar `output: "standalone"` para builds Docker          |
| `.env`                 | Reescribir para apuntar a DB local del contenedor          |
| `src/middleware.ts`    | Confirmar que usa JWT nativo, sin Clerk                    |

### Crear

| Archivo         | Propósito                                   |
| :-------------- | :------------------------------------------ |
| `Dockerfile`    | Build multistage optimizado para producción |
| `.dockerignore` | Excluir node_modules, .git, etc.            |
| `.env.example`  | Plantilla de variables para Easypanel       |

---

## 6. Plan de Ejecución

| Fase | Documento                        | Acción                                 |
| :--- | :------------------------------- | :------------------------------------- |
| 1    | `01-vps-and-easypanel-setup.md`  | Provisionar VPS + Instalar Easypanel   |
| 2    | `02-dockerization-and-builds.md` | Crear Dockerfile + `.dockerignore`     |
| 3    | `03-database-and-services.md`    | Levantar PostgreSQL + migrar datos     |
| 4    | `04-environment-variables.md`    | Configurar secretos en Easypanel       |
| 5    | `05-ci-cd-pipelines.md`          | GitHub Actions + Webhook de despliegue |
| 6    | `06-troubleshooting-and-logs.md` | Guía de depuración y recuperación      |

---

## 7. Criterios de Éxito

- [ ] La aplicación responde en `https://app.freeinterpreters.com` con certificado SSL válido.
- [ ] PostgreSQL corre como servicio interno en Easypanel con datos migrados.
- [ ] `git push origin main` dispara un build y despliegue automático en < 5 minutos.
- [ ] Latencia de DB queries < 5ms (TCP local vs. ~100ms en Neon remoto).
- [ ] Uptime de 99.5%+ con reinicio automático de contenedores caídos.
- [ ] Costo mensual total: **$0.00 USD**.
