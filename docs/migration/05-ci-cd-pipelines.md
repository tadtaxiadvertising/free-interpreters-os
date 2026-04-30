# 05 — CI/CD Pipelines

> **Objetivo**: Configurar despliegue continuo a costo $0 usando GitHub Actions + Webhooks de Easypanel. Cada `push` a `main` dispara un build y despliegue automático.

---

## Propósito

Replicar la experiencia de "git push → deploy" que Vercel ofrecía, pero ahora usando infraestructura propia. GitHub Actions ejecuta validaciones (lint, typecheck) y luego notifica a Easypanel para que construya y despliegue la nueva versión.

---

## Prerrequisitos

- Repositorio en GitHub (público o privado — Actions es gratuito para ambos con límites generosos).
- Proyecto y servicio `app` configurados en Easypanel con source **GitHub**.
- Webhook URL de Easypanel (se obtiene en el servicio `app` → **Settings** → **Webhook**).

---

## Arquitectura del Pipeline

```text
Developer
    │
    ▼ git push origin main
    │
GitHub Actions ─────────────────────────────────┐
    │                                             │
    ├─ Step 1: Checkout code                     │
    ├─ Step 2: Setup Node.js 22                  │
    ├─ Step 3: Install dependencies (npm ci)     │
    ├─ Step 4: Prisma generate                    │
    ├─ Step 5: TypeScript typecheck              │
    ├─ Step 6: ESLint                            │
    ├─ Step 7: Build test (next build)           │  ← Validación
    │                                             │
    ├─ Step 8: Trigger Easypanel Webhook ────────┘  ← Despliegue
    │           POST https://panel.../webhook
    │
    ▼
Easypanel (VPS)
    │
    ├─ Pull latest code from GitHub
    ├─ Build Docker image (Dockerfile multistage)
    ├─ Stop old container
    ├─ Start new container
    └─ Health check → ✅ Live
```

---

## Paso 1: Obtener el Webhook de Easypanel

### 1.1 Configurar GitHub como Source

1. Easypanel UI → Proyecto `free-interp-os` → Servicio `app`.
2. **Source** → **GitHub**.
3. Conectar tu cuenta de GitHub (OAuth).
4. Seleccionar el repositorio: `<tu-org>/free-interpreters-os`.
5. **Branch**: `main`.

### 1.2 Copiar el Webhook URL

1. Servicio `app` → **Settings** o **Deploy**.
2. Localizar la sección **Webhook URL**.
3. Copiar la URL. Tiene el formato:

```text
https://panel.freeinterpreters.com/api/deploy/webhook/<PROJECT_ID>/<SERVICE_ID>
```

> Guardar este URL como un **GitHub Secret** (siguiente paso).

---

## Paso 2: Configurar GitHub Secrets

Ir a tu repositorio en GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

| Secret Name                | Valor                                              |
| :------------------------- | :------------------------------------------------- |
| `EASYPANEL_WEBHOOK_URL`    | La URL del webhook de Easypanel                    |
| `DATABASE_URL`             | `postgresql://postgres:pw@localhost:5432/test` (para CI test) |

> **Nota**: El `DATABASE_URL` en CI es una URL dummy o de un servicio PostgreSQL temporal. No es la URL de producción.

---

## Paso 3: Crear el Workflow de GitHub Actions

Crear `.github/workflows/deploy.yml`:

```yaml
# =============================================================================
# CI/CD Pipeline — Free Interpreters OS
# =============================================================================
# Trigger: push a main
# Jobs: validate → deploy
# Cost: $0 (GitHub Actions Free Tier: 2000 min/mes para repos privados)
# =============================================================================

name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

# Cancelar ejecuciones anteriores del mismo branch
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ──────────────────────────────────────────────
  # JOB 1: Validate (Lint + Typecheck + Build)
  # ──────────────────────────────────────────────
  validate:
    name: 🔍 Validate
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: 📥 Checkout
        uses: actions/checkout@v4

      - name: 📦 Setup Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: 📥 Install Dependencies
        run: npm ci

      - name: 🔧 Generate Prisma Client
        run: npx prisma generate

      - name: 🔎 TypeScript Typecheck
        run: npx tsc --noEmit

      - name: 🧹 ESLint
        run: npm run lint

      - name: 🏗️ Build Test
        run: npm run build
        env:
          # Variables dummy para que el build pase
          DATABASE_URL: "postgresql://postgres:test@localhost:5432/test"
          JWT_SECRET: "ci-test-secret-not-for-production-use-only"
          NEXT_TELEMETRY_DISABLED: "1"

  # ──────────────────────────────────────────────
  # JOB 2: Deploy (Trigger Easypanel Webhook)
  # ──────────────────────────────────────────────
  deploy:
    name: 🚀 Deploy to Easypanel
    runs-on: ubuntu-latest
    needs: validate
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    timeout-minutes: 5

    steps:
      - name: 🔔 Trigger Easypanel Deploy
        run: |
          RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
            -X POST \
            "${{ secrets.EASYPANEL_WEBHOOK_URL }}" \
            -H "Content-Type: application/json")

          echo "Webhook response: $RESPONSE"

          if [ "$RESPONSE" -ge 200 ] && [ "$RESPONSE" -lt 300 ]; then
            echo "✅ Deploy triggered successfully"
          else
            echo "❌ Deploy webhook failed with status: $RESPONSE"
            exit 1
          fi

      - name: ⏳ Wait for Deploy
        run: |
          echo "Waiting 60s for Easypanel to build and deploy..."
          sleep 60

      - name: 🏥 Health Check
        run: |
          for i in {1..5}; do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
              "https://app.freeinterpreters.com" \
              --max-time 10)

            if [ "$STATUS" -eq 200 ]; then
              echo "✅ Health check passed (attempt $i)"
              exit 0
            fi

            echo "⏳ Attempt $i: status $STATUS, retrying in 15s..."
            sleep 15
          done

          echo "❌ Health check failed after 5 attempts"
          exit 1
```

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
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Easypanel
        run: curl -X POST "${{ secrets.EASYPANEL_WEBHOOK_URL }}"
```

> **No recomendado**: Sin validaciones, código roto puede llegar a producción.

---

## Paso 5: Protección de Branch `main`

### 5.1 Configurar Branch Protection Rules

GitHub → Repositorio → **Settings** → **Branches** → **Add rule**.

| Regla                                           | Valor    |
| :---------------------------------------------- | :------- |
| Branch name pattern                             | `main`   |
| Require a pull request before merging           | ✅       |
| Require status checks to pass before merging    | ✅       |
| Status checks: `validate`                       | Required |
| Require branches to be up to date before merging | ✅      |

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

| Recurso                | Límite (Free)                   |
| :--------------------- | :------------------------------ |
| Minutos de ejecución   | 2,000 min/mes (repos privados) |
| Storage (artifacts)    | 500 MB                          |
| Concurrent jobs        | 20                              |
| Tiempo máximo por job  | 6 horas                         |

### Cálculo de Consumo Estimado

| Escenario             | Duración | Frecuencia      | Minutos/Mes |
| :-------------------- | :------- | :--------------- | :---------- |
| Validate (PR)         | ~3 min   | 20 PRs/mes       | 60 min      |
| Validate + Deploy     | ~5 min   | 20 merges/mes    | 100 min     |
| **Total estimado**    |          |                  | **160 min** |

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
# Easypanel → servicio app → Settings → Webhook URL

# Verificar que el secret en GitHub está configurado correctamente
# GitHub → Settings → Secrets → EASYPANEL_WEBHOOK_URL
# Verificar que no tiene espacios o saltos de línea extra
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
curl -v https://app.freeinterpreters.com

# Posibles causas:
# 1. DNS no propagado aún
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
