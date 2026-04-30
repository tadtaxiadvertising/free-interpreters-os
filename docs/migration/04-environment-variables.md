# 04 — Environment Variables & Secrets

> **Objetivo**: Definir la estrategia de gestión de secretos para Docker/Easypanel, proporcionar una plantilla `.env.example`, y documentar cómo inyectar variables desde la interfaz de Easypanel.

---

## Propósito

Centralizar y documentar todas las variables de entorno que la aplicación necesita para funcionar en el nuevo entorno containerizado. Eliminar toda referencia a servicios de Vercel, Clerk, Supabase, y Neon, reemplazándolos por configuraciones locales.

---

## Prerrequisitos

- Servicios `app`, `db`, y `redis` creados en Easypanel (ver documentos anteriores).
- Contraseña de PostgreSQL generada por Easypanel (disponible en el servicio `db` → **Environment**).
- Un string aleatorio de 64+ caracteres para `JWT_SECRET`.

---

## Paso 1: Plantilla `.env.example`

Crear este archivo en la raíz del repositorio. **Nunca commitear `.env` real al repositorio.**

```bash
# =============================================================================
# FREE INTERPRETERS OS — Environment Variables
# =============================================================================
# Copiar a .env y completar con valores reales.
# Para Easypanel: inyectar desde la UI → Servicio app → Environment.
# =============================================================================

# ─────────────────────────────────────────────────
# DATABASE (PostgreSQL 16)
# ─────────────────────────────────────────────────
# Formato: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
# En Easypanel, el hostname es el nombre del servicio DB (red interna Docker).
DATABASE_URL="postgresql://postgres:CHANGE_ME@free-interp-os_db:5432/freeinterpreters"

# ─────────────────────────────────────────────────
# AUTHENTICATION (JWT Nativo)
# ─────────────────────────────────────────────────
# Generar con: openssl rand -base64 64
JWT_SECRET="CHANGE_ME_GENERATE_WITH_OPENSSL_RAND_BASE64_64"

# Duración del token JWT (en segundos)
# 86400 = 24 horas | 604800 = 7 días
JWT_EXPIRATION_SECONDS=86400

# ─────────────────────────────────────────────────
# APPLICATION
# ─────────────────────────────────────────────────
NODE_ENV=production
PORT=3000
NEXT_TELEMETRY_DISABLED=1

# URL pública de la aplicación (para redirects, links en emails, etc.)
NEXT_PUBLIC_APP_URL="https://app.freeinterpreters.com"

# ─────────────────────────────────────────────────
# REDIS (Opcional — Cache/Sessions)
# ─────────────────────────────────────────────────
# Formato: redis://:PASSWORD@HOST:PORT
# Dejar vacío si no se usa Redis.
REDIS_URL=""

# ─────────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────────
# Niveles: debug, info, warn, error
LOG_LEVEL=info
```

---

## Paso 2: Variables Eliminadas (Legacy)

Las siguientes variables **ya no se usan** y deben eliminarse de cualquier archivo `.env`:

| Variable                              | Servicio Eliminado | Reemplazo                         |
| :------------------------------------ | :----------------- | :-------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`            | Supabase           | N/A — eliminado                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`       | Supabase           | N/A — eliminado                   |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`   | Clerk              | N/A — JWT nativo                  |
| `CLERK_SECRET_KEY`                    | Clerk              | `JWT_SECRET`                      |
| `CLERK_WEBHOOK_SECRET`               | Clerk              | N/A — eliminado                   |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`       | Clerk              | Hardcoded en app (`/login`)       |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`       | Clerk              | Hardcoded en app (`/register`)    |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Clerk              | Hardcoded en app (`/dashboard`)   |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Clerk              | Hardcoded en app (`/dashboard`)   |
| `DIRECT_URL`                          | Neon.tech           | N/A — conexión TCP directa local  |

---

## Paso 3: Inyectar Variables en Easypanel

### 3.1 Vía Interfaz UI

1. Easypanel UI → Proyecto `free-interp-os` → Servicio `app`.
2. Ir a la pestaña **Environment**.
3. Agregar cada variable como par `KEY=VALUE`:

```text
DATABASE_URL        = postgresql://postgres:<PW_REAL>@free-interp-os_db:5432/freeinterpreters
JWT_SECRET          = <tu-string-de-64-chars>
JWT_EXPIRATION_SECONDS = 86400
NODE_ENV            = production
PORT                = 3000
NEXT_TELEMETRY_DISABLED = 1
NEXT_PUBLIC_APP_URL = https://app.freeinterpreters.com
LOG_LEVEL           = info
```

4. Click **Save** → el servicio se reiniciará automáticamente con las nuevas variables.

### 3.2 Variables Automáticas de Easypanel

Easypanel inyecta automáticamente ciertas variables para servicios de base de datos:

| Variable (auto-generada)    | Ejemplo de Valor                                              |
| :-------------------------- | :------------------------------------------------------------ |
| `POSTGRES_PASSWORD`         | `auto-generated-pw-12345`                                     |
| `POSTGRES_USER`             | `postgres`                                                    |
| `POSTGRES_DB`               | `postgres`                                                    |

> Puedes referenciar variables de otros servicios usando la sintaxis de Easypanel:
> `$(free-interp-os_db.POSTGRES_PASSWORD)` — si el panel lo soporta en tu versión.

---

## Paso 4: Generar el JWT_SECRET

### Desde Linux/macOS

```bash
openssl rand -base64 64
# Output: kJf7x9...largo-string...Qw==
```

### Desde Windows (PowerShell)

```powershell
[Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }) -as [byte[]])
```

### Desde Node.js

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

> **Regla**: El JWT_SECRET debe tener mínimo 256 bits (32 bytes) de entropía. 64 bytes (512 bits) es la recomendación.

---

## Paso 5: Variables de Build-time vs. Runtime

### Diferencia Crítica en Next.js

| Prefijo            | Disponibilidad     | Inyección            | Seguridad         |
| :----------------- | :----------------- | :------------------- | :---------------- |
| `NEXT_PUBLIC_*`    | Cliente + Servidor | **Build-time** (embebido en el JS bundle) | ⚠️ Pública       |
| Sin prefijo        | Solo Servidor      | **Runtime** (process.env) | ✅ Privada        |

### Implicaciones para Docker

Las variables `NEXT_PUBLIC_*` deben estar disponibles **durante el build** de la imagen Docker. Las demás se inyectan en runtime via Easypanel.

```dockerfile
# En el Dockerfile, stage builder:
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Las variables sin prefijo NO necesitan estar en build-time
# Se inyectan vía Easypanel en runtime
```

### Tabla de Clasificación

| Variable                    | Tipo      | Momento     | Sensible |
| :-------------------------- | :-------- | :---------- | :------- |
| `DATABASE_URL`              | Runtime   | Container start | ✅ Sí   |
| `JWT_SECRET`                | Runtime   | Container start | ✅ Sí   |
| `JWT_EXPIRATION_SECONDS`    | Runtime   | Container start | ❌ No   |
| `NODE_ENV`                  | Runtime   | Container start | ❌ No   |
| `PORT`                      | Runtime   | Container start | ❌ No   |
| `NEXT_PUBLIC_APP_URL`       | Build     | Docker build    | ❌ No   |
| `NEXT_TELEMETRY_DISABLED`   | Build     | Docker build    | ❌ No   |
| `REDIS_URL`                 | Runtime   | Container start | ✅ Sí   |
| `LOG_LEVEL`                 | Runtime   | Container start | ❌ No   |

---

## Paso 6: Validación de Variables en Runtime

Agregar validación con Zod al arranque de la app. Crear `src/lib/env.ts`:

```typescript
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRATION_SECONDS: z.coerce.number().positive().default(86400),
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  PORT: z.coerce.number().default(3000),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().startsWith("redis://").optional().or(z.literal("")),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
```

> Importar `env` en vez de usar `process.env` directamente garantiza type-safety y fallo temprano si falta alguna variable.

---

## Paso 7: Seguridad de Secretos

### Qué NUNCA hacer

| ❌ Práctica Insegura                         | ✅ Alternativa                              |
| :------------------------------------------- | :------------------------------------------ |
| Commitear `.env` al repositorio              | Usar `.env.example` sin valores reales      |
| Hardcodear secretos en el código             | Usar `process.env` + validación Zod         |
| Compartir secretos por chat/email            | Usar Easypanel UI o SSH directo             |
| Usar el mismo JWT_SECRET en dev y prod       | Generar uno diferente por entorno           |
| Loguear variables sensibles                  | Enmascarar en logs: `DB: ***@host:port`     |

### `.gitignore` — Verificar que incluye:

```gitignore
# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
.env.production
```

---

## Troubleshooting

### App crashea al iniciar — "Invalid environment variables"

```bash
# Ver qué variable falta o es inválida
sudo docker logs $(sudo docker ps -q -f "name=free-interp-os_app") --tail 20

# Verificar las variables configuradas en Easypanel
# Servicio app → Environment → revisar cada valor
```

### DATABASE_URL no conecta — "ENOTFOUND free-interp-os_db"

```bash
# Verificar el hostname exacto del servicio DB
sudo docker ps --format '{{.Names}}' | grep db

# El nombre puede variar. Usar el nombre exacto del contenedor.
# Ejemplo: si el contenedor se llama "free-interp-os-db-1", el hostname es ese.

# Alternativa: usar la IP del contenedor directamente
sudo docker inspect $(sudo docker ps -q -f "name=free-interp-os_db") \
  --format '{{.NetworkSettings.Networks.easypanel.IPAddress}}'
```

### NEXT_PUBLIC_APP_URL no se aplica en el frontend

```bash
# Causa: Las variables NEXT_PUBLIC_* se embeben en build-time.
# Si cambias el valor en Easypanel, debes RE-CONSTRUIR la imagen (no solo reiniciar).

# Solución: Trigger un nuevo build desde GitHub o manual en Easypanel.
```

### JWT_SECRET rotación — cómo cambiar sin downtime

```bash
# 1. Generar nuevo secret
NEW_SECRET=$(openssl rand -base64 64)

# 2. Actualizar en Easypanel (servicio app → Environment → JWT_SECRET)
# 3. El servicio se reinicia automáticamente
# 4. Los tokens existentes se invalidan — los usuarios deben re-loguearse

# Para rotación sin invalidar tokens existentes:
# Implementar un array de secrets y validar contra ambos durante la transición.
```
