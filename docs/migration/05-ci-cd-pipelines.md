# 05 — CI/CD Pipelines

> **Objetivo**: Configurar despliegue continuo a costo $0 usando GitHub Actions + Webhooks de Easypanel. Cada `push` a `main` dispara un build y despliegue automático.

---

## Propósito

Replicar la experiencia de "git push → deploy" que Vercel ofrecía, pero ahora usando infraestructura propia. GitHub Actions ejecuta validaciones (lint, typecheck) y luego notifica a Easypanel para que construya y despliegue la nueva versión.

---

## Prerrequisitos

- Repositorio en GitHub (público o privado — Actions es gratuito para ambos con límites generosos).
- Proyecto y dos servicios (`interpreters` + `interpreters-api`) configurados en Easypanel con source **GitHub**.
- Webhook URLs de Easypanel para ambos servicios (se obtiene en cada servicio → **Settings** → **Webhook**).
- Instancia Easypanel accesible en `rewvid.easypanel.host`.

---

## Arquitectura del Pipeline

```text
Developer
    │
    ▼ git push origin main
    │
GitHub Actions ───────────────────────────────────────┐
    │                                                  │
    ├─ Step 1: Checkout code                          │
    ├─ Step 2: Setup Node.js 22                       │
    ├─ Step 3: Install dependencies (npm ci)          │
    ├─ Step 4: Prisma generate                        │
    ├─ Step 5: TypeScript typecheck                   │
    ├─ Step 6: ESLint                                 │
    ├─ Step 7: Build test (next build)                │  ← Validación
    │                                                  │
    ├─ Step 8: Trigger Easypanel Webhooks ────────────┘  ← Despliegue
    │           POST https://rewvid.easypanel.host/api/deploy/webhook/...
    │           ├─ interpreters (Next.js frontend)
    │           └─ interpreters-api (Backend)
    │
    ▼
Easypanel (VPS — rewvid.easypanel.host)
    │
    ├─ Pull latest code from GitHub (per service)
    ├─ Build Docker image (Dockerfile multistage)
    ├─ Stop old container
    ├─ Start new container
    └─ Health check → ✅ Live
```

---

## Paso 1: Obtener los Webhooks de Easypanel

### 1.1 Configurar GitHub como Source

1. Easypanel UI (`rewvid.easypanel.host`) → Proyecto → Servicio `interpreters`.
2. **Source** → **GitHub**.
3. Conectar tu cuenta de GitHub (OAuth).
4. Seleccionar el repositorio: `tadtaxiadvertising/free-interpreters-os`.
5. **Branch**: `main`.
6. Repetir para el servicio `interpreters-api`.

### 1.2 Copiar los Webhook URLs

Para **cada servicio**, copiar la webhook URL:

1. Servicio → **Settings** → Localizar **Webhook URL**.
2. Copiar la URL. Tiene el formato:

```text
https://rewvid.easypanel.host/api/deploy/webhook/<PROJECT_ID>/<SERVICE_ID>
```

Guarda **dos** URLs como GitHub Secrets (siguiente paso):

| Servicio              | Secret Name                         |
| :-------------------- | :---------------------------------- |
| `interpreters`        | `EASYPANEL_WEBHOOK_INTERPRETERS`    |
| `interpreters-api`    | `EASYPANEL_WEBHOOK_API`             |

---

## Paso 2: Configurar GitHub Secrets

Ir a tu repositorio en GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

| Secret Name                      | Valor                                                        |
| :------------------------------- | :----------------------------------------------------------- |
| `EASYPANEL_WEBHOOK_INTERPRETERS` | Webhook URL del servicio `interpreters` (Next.js frontend)   |
| `EASYPANEL_WEBHOOK_API`          | Webhook URL del servicio `interpreters-api` (Backend)        |

> **Nota**: El workflow `deploy.yml` envía un POST a cada webhook URL por separado. Si un secret no está configurado, el deploy de ese servicio se **salta** con un warning (no falla).

---

## Paso 3: Workflow de GitHub Actions (Actual)

El workflow actual está en `.github/workflows/deploy.yml` y usa **dos jobs paralelos** que llaman a Easypanel webhooks por separado:

```yaml
# yaml-language-server: $schema=https://json.schemastore.org/github-workflow
name: 🚀 Auto-Deploy to Easypanel

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  deploy-interpreters:
    name: Deploy interpreters (Next.js)
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Call Easypanel Webhook — interpreters
        run: |
          set -euo pipefail
          WEBHOOK_URL="${EASYPANEL_WEBHOOK_INTERPRETERS:-}"
          WEBHOOK_URL="$(printf '%s' "$WEBHOOK_URL" | tr -d '\r\n')"
          if [ -z "$WEBHOOK_URL" ]; then
            echo "⚠️ WARNING: EASYPANEL_WEBHOOK_INTERPRETERS secret not configured. Skipping."
            exit 0
          fi
          HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --retry 3 -X POST "$WEBHOOK_URL")
          case "$HTTP_CODE" in 200|201|202|204) echo "OK: deployed (HTTP $HTTP_CODE)";; *) echo "FAIL: HTTP $HTTP_CODE"; exit 1;; esac
        env:
          EASYPANEL_WEBHOOK_INTERPRETERS: ${{ secrets.EASYPANEL_WEBHOOK_INTERPRETERS }}

  deploy-interpreters-api:
    name: Deploy interpreters-api (Backend)
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Call Easypanel Webhook — interpreters-api
        run: |
          set -euo pipefail
          WEBHOOK_URL="${EASYPANEL_WEBHOOK_API:-}"
          WEBHOOK_URL="$(printf '%s' "$WEBHOOK_URL" | tr -d '\r\n')"
          if [ -z "$WEBHOOK_URL" ]; then
            echo "⚠️ WARNING: EASYPANEL_WEBHOOK_API secret not configured. Skipping."
            exit 0
          fi
          HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --retry 3 -X POST "$WEBHOOK_URL")
          case "$HTTP_CODE" in 200|201|202|204) echo "OK: deployed (HTTP $HTTP_CODE)";; *) echo "FAIL: HTTP $HTTP_CODE"; exit 1;; esac
        env:
          EASYPANEL_WEBHOOK_API: ${{ secrets.EASYPANEL_WEBHOOK_API }}
```

> **Nota**: Si un secret no existe, el job se **salta** con un warning (`exit 0`). Esto permite configurar gradualmente sin romper el pipeline.

---

## Paso 4: Workflow Alternativo — Solo Webhook (Mínimo)

Si prefieres que Easypanel maneje todo el build sin validaciones previas:

```yaml
# .github/workflows/deploy-minimal.yml
name: Deploy (Minimal)

on:
  push:
    branches: [main]

jobs:
  deploy-interpreters:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Easypanel — interpreters
        run: curl -X POST "${{ secrets.EASYPANEL_WEBHOOK_INTERPRETERS }}"

  deploy-interpreters-api:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Easypanel — interpreters-api
        run: curl -X POST "${{ secrets.EASYPANEL_WEBHOOK_API }}"
```

> **No recomendado**: Sin validaciones, código roto puede llegar a producción.

---

## Paso 5: Protección de Branch `main`

### 5.1 Configurar Branch Protection Rules

GitHub → Repositorio → **Settings** → **Branches** → **Add rule**.

| Regla                                            | Valor    |
| :----------------------------------------------- | :------- |
| Branch name pattern                              | `main`   |
| Require a pull request before merging            | ✅       |
| Require status checks to pass before merging     | ✅       |
| Status checks: `validate`                        | Required |
| Require branches to be up to date before merging | ✅       |

### 5.2 Flujo de Trabajo del Desarrollador

```text
1. Crear branch: git checkout -b feature/new-dashboard
2. Desarrollar + commit + push
3. Abrir Pull Request → GitHub Actions ejecuta 'validate'
4. Si pasa: merge a main
5. Push a main → GitHub Actions ejecuta 'validate' + 'deploy'
6. Easypanel recibe webhook → build → deploy → live
```

---

## Paso 6: GitHub Actions — Límites del Free Tier

| Recurso               | Límite (Free)                  |
| :-------------------- | :----------------------------- |
| Minutos de ejecución  | 2,000 min/mes (repos privados) |
| Storage (artifacts)   | 500 MB                         |
| Concurrent jobs       | 20                             |
| Tiempo máximo por job | 6 horas                        |

### Cálculo de Consumo Estimado

| Escenario          | Duración | Frecuencia    | Minutos/Mes |
| :----------------- | :------- | :------------ | :---------- |
| Validate (PR)      | ~3 min   | 20 PRs/mes    | 60 min      |
| Validate + Deploy  | ~5 min   | 20 merges/mes | 100 min     |
| **Total estimado** |          |               | **160 min** |

> Consumo estimado: **8% del límite gratuito**. Margen amplísimo.

---

## Paso 7: Notificaciones de Deploy

### 7.1 Notificación por Email (GitHub nativo)

GitHub envía emails de status de Actions por defecto. No requiere configuración adicional.

### 7.2 Notificación por Discord/Slack (opcional)

Agregar al final del job `deploy`:

```yaml
      - name: 📢 Notify Discord
        if: always()
        run: |
          STATUS="${{ job.status }}"
          COLOR=$([[ "$STATUS" == "success" ]] && echo "3066993" || echo "15158332")

          curl -X POST "${{ secrets.DISCORD_WEBHOOK_URL }}" \
            -H "Content-Type: application/json" \
            -d "{
              \"embeds\": [{
                \"title\": \"Deploy ${STATUS}\",
                \"description\": \"Commit: \`${{ github.sha }}\`\nBranch: \`${{ github.ref_name }}\`\nBy: ${{ github.actor }}\",
                \"color\": $COLOR,
                \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
              }]
            }"
```

---

## Troubleshooting

### Webhook retorna 401/403

```bash
# Verificar que la URL del webhook es correcta
# Easypanel → servicio → Settings → Webhook URL

# Verificar que el secret en GitHub está configurado correctamente
# GitHub → Settings → Secrets → EASYPANEL_WEBHOOK_INTERPRETERS y EASYPANEL_WEBHOOK_API
# Verificar que no tiene espacios o saltos de línea extra
# Verificar que la URL usa el host correcto: rewvid.easypanel.host
```

### Build pasa en CI pero falla en Easypanel

```bash
# Diferencia común: variables de entorno
# CI usa variables dummy, Easypanel usa las de producción

# Verificar logs del build en Easypanel:
# Servicio app → Deployments → ver logs del último build

# Causa frecuente: DATABASE_URL inválido durante el build
# Solución: Asegurar que las env vars están configuradas antes del build
```

### GitHub Actions se queda sin minutos

```bash
# Verificar consumo: GitHub → Settings → Billing → Actions

# Optimizaciones:
# 1. Agregar paths-ignore para no ejecutar en cambios de docs:
# on:
#   push:
#     branches: [main]
#     paths-ignore:
#       - 'docs/**'
#       - 'README.md'
#       - '*.md'

# 2. Usar caché de npm (ya incluido con actions/setup-node cache: npm)
# 3. Solo ejecutar deploy en push a main (no en PRs)
```

### Health check falla pero la app funciona

```bash
# Verificar que la URL del health check es accesible
# El servicio interpreters está en: rewvid.easypanel.host (subdominio del proyecto)
# El dominio custom freeinterpreters.com aún no está configurado

curl -v https://interpreters.rewvid.easypanel.host

# Posibles causas:
# 1. DNS no propagado aún (si usa dominio custom)
# 2. Easypanel aún está haciendo el build (aumentar sleep)
# 3. La app tarda en arrancar (aumentar retries)
```

### Deploy duplicado — webhook se dispara múltiples veces

```yaml
# Agregar concurrency al job deploy para evitar builds paralelos:
concurrency:
  group: deploy-production
  cancel-in-progress: false  # No cancelar deploys en progreso
```
