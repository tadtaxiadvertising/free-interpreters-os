# Architecture Decision Records (ADR)

> **Última actualización:** 2026-05-01
> **Autor:** Lead Architect — Free Interpreters OS
> **Estado:** Vigente — Single Source of Truth

---

## ADR-001: Supabase Edge Functions para Ranking

### Contexto

El cálculo de ranking requiere agregar datos de `call_sessions` y `production_logs` de todos
los intérpretes activos. En un entorno serverless con presupuesto $0, las funciones del
frontend (Server Components de Next.js) ejecutan estas consultas directamente contra la
base de datos vía Prisma.

### Decisión

**No usar Supabase Edge Functions para el ranking en la V1.**

En su lugar, el cálculo se ejecuta en los **Server Components** de Next.js
(`dashboard/layout.tsx` y `dashboard/ranking/page.tsx`) usando Prisma Client con el
adaptador `@prisma/adapter-pg` conectado al Connection Pooler de Supabase (puerto 6543).

#### Justificación

| Criterio | Edge Functions | Server Components (Elegido) |
|---|---|---|
| Latencia | ~200ms cold start + query | ~50ms (pool activo) |
| Costo | Gratis hasta 500K invocaciones | $0 (incluido en tier Next.js) |
| Complejidad | Requiere deploy separado + CORS | Código co-locado con UI |
| Caché | Manual | `force-dynamic` + ISR futuro |
| Monitoreo | Dashboard Supabase | Logs Easypanel unificados |

#### Consecuencias

- Los cálculos de ranking **siempre** se ejecutan en el servidor (RSC), nunca en el cliente.
- Si la plataforma escala a >100 intérpretes, se debe migrar a una
  **Supabase Edge Function** con caché de 5 minutos o una **vista materializada**
  en PostgreSQL.
- Todo el código de ranking está centralizado en dos archivos para facilitar la migración
  futura.

### Estado

✅ Implementado — `src/app/dashboard/layout.tsx` (sidebar ranking) y
`src/app/dashboard/ranking/page.tsx` (tabla completa).

---

## ADR-002: Connection Pooling con Prisma en Easypanel

### Contexto

Easypanel ejecuta contenedores Docker en un VPS. Cada contenedor mantiene un pool de
conexiones PostgreSQL. El tier gratuito de Supabase permite máximo **60 conexiones
directas** y ofrece un **Connection Pooler (PgBouncer)** en el puerto `6543` en
modo `transaction`.

### Decisión

**Usar exclusivamente el Connection Pooler de Supabase (puerto 6543) como
`DATABASE_URL` en todos los entornos.**

```env
# ✅ CORRECTO — Pool transaccional
DATABASE_URL="postgresql://postgres.xxxxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# ❌ INCORRECTO — Conexión directa (agota el límite rápidamente)
DATABASE_URL="postgresql://postgres.xxxxx:password@db.xxxxx.supabase.co:5432/postgres"
```

#### Configuración Prisma

```prisma
datasource db {
  provider = "postgresql"
  // La URL se inyecta desde la variable de entorno
}

generator client {
  provider = "prisma-client-js"
}
```

El cliente Prisma se inicializa con el adaptador `pg` para máxima compatibilidad con
PgBouncer:

```typescript
// src/lib/prisma.ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
```

#### Consecuencias

- **No usar** `directUrl` en `schema.prisma` — todas las conexiones van por el pooler.
- Las migraciones deben ejecutarse con la **conexión directa** (puerto 5432) vía script
  local, nunca desde el contenedor de producción.
- El pool de `pg` se configura con `max: 5` para respetar los límites del tier gratuito.

### Estado

✅ Implementado — `prisma/schema.prisma`, `src/lib/prisma.ts`, `prisma.config.ts`.

---

## ADR-003: Estrategia de Autenticación con Supabase Auth (sin NextAuth)

### Contexto

Originalmente se evaluó NextAuth como capa de autenticación. Sin embargo, la plataforma
ya depende completamente de Supabase para la base de datos, almacenamiento y Edge
Functions. Añadir NextAuth crearía una dependencia duplicada y complejidad innecesaria.

### Decisión

**Usar Supabase Auth nativo como único proveedor de autenticación.**

#### Arquitectura

```mermaid
sequenceDiagram
    participant Browser
    participant Middleware
    participant ServerComponent
    participant SupabaseAuth
    participant Database

    Browser->>Middleware: Request + Cookies
    Middleware->>SupabaseAuth: Refresh session (if needed)
    SupabaseAuth-->>Middleware: Updated session cookies
    Middleware->>ServerComponent: Forward with fresh session
    ServerComponent->>SupabaseAuth: getUser()
    SupabaseAuth-->>ServerComponent: user.id (UUID)
    ServerComponent->>Database: Prisma query (WHERE userId = user.id)
    Database-->>ServerComponent: Data
    ServerComponent-->>Browser: Rendered HTML
```

#### Componentes Clave

| Componente | Archivo | Responsabilidad |
|---|---|---|
| Server Client | `src/lib/supabase/server.ts` | Crea cliente Supabase SSR con cookies |
| Browser Client | `src/lib/supabase/client.ts` | Crea cliente Supabase para Client Components |
| Auth Bridge | `src/lib/auth.ts` | Wrapper `auth()` para compatibilidad legacy |
| Middleware | `src/middleware.ts` | Refresca tokens automáticamente |
| Login Page | `src/app/login/page.tsx` | Email/password con `signInWithPassword` |
| Register Page | `src/app/register/page.tsx` | `signUp` + creación de `UserProfile` |

#### Flujo de Roles

1. El usuario se registra → se crea un registro en `auth.users` (Supabase) y
   `user_profiles` (Prisma).
2. El campo `role` en `user_profiles` determina si es `admin` o `interpreter`.
3. El `interpreterId` en `user_profiles` vincula al intérprete con su registro en la
   tabla `interpreters`.
4. El middleware NO verifica roles — la verificación de roles ocurre en los
   Server Components y Server Actions.

#### Consecuencias

- **No instalar** `next-auth`, `@auth/core` ni `@auth/supabase-adapter`.
- Los tokens JWT se gestionan vía cookies httpOnly (manejado por `@supabase/ssr`).
- Para agregar OAuth (Google, GitHub) en el futuro, se configura directamente en el
  Dashboard de Supabase sin cambios en el código.
- Las Row Level Security (RLS) policies de Supabase complementan la autenticación
  a nivel de aplicación.

### Estado

✅ Implementado — Migración completa desde Clerk Auth completada en V2.

---

## ADR-004: Modelo de Datos Bancarios — Exclusivo República Dominicana

### Contexto

Todos los intérpretes operan desde la República Dominicana. El único método de pago
soportado es **Transferencia Bancaria Nacional (RD)**. Se requiere capturar los datos
bancarios durante el onboarding.

### Decisión

**Los datos bancarios se almacenan en dos ubicaciones complementarias:**

1. **`user_profiles`** (datos del onboarding del intérprete):
   - `bank_name` — Nombre del banco (enum controlado en UI)
   - `bank_account` — Número de cuenta
   - `bank_cedula` — Cédula o RNC del titular
   - `bank_account_type` — Tipo de cuenta (Ahorro/Corriente)

2. **`interpreters`** (datos administrativos):
   - `banco` — Espejo del banco para reportes de nómina
   - `cuenta_pago` — Cuenta para la generación de payroll
   - `tipo_cuenta` — Tipo de cuenta
   - `cedula_rnc` — Documento de identidad

#### Bancos Soportados (RD)

| Código | Nombre Completo |
|---|---|
| Banreservas | Banco de Reservas |
| Popular | Banco Popular Dominicano |
| BHD | BHD León |
| Scotiabank | Scotiabank RD |
| Santa Cruz | Banco Santa Cruz |
| BDI | Banco BDI |
| Promerica | Banco Promerica |
| Caribe | Banco Caribe |
| Otro | Otro (especificar en notas) |

### Estado

✅ Implementado — `prisma/schema.prisma`, `OnboardingWizard.tsx`, `BankFormRD.tsx`.

---

## ADR-005: Despliegue Serverless en Easypanel ($0)

### Contexto

La plataforma debe operar con presupuesto $0 para infraestructura cloud. Easypanel
se ejecuta en un VPS propio con Docker.

### Decisión

**Arquitectura de servicio único en Easypanel:**

- Un solo servicio `free-interpreters-os` con el Dockerfile estándar de Next.js
  (`standalone` output).
- La API y el frontend coexisten en el mismo proceso Next.js.
- Las variables de entorno se inyectan vía el panel de Easypanel.

#### Variables Requeridas

```env
DATABASE_URL=postgresql://...@pooler:6543/postgres?pgbouncer=true
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_API_URL=https://api.freeinterpreters.com
```

### Estado

✅ En producción — Desplegado vía GitHub webhook + Easypanel auto-build.
