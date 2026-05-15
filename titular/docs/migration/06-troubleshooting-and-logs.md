# 06 — Troubleshooting & Logs

> **Objetivo**: Guía de depuración completa para el entorno Docker/Easypanel. Cómo leer logs, inspeccionar redes, resolver errores de memoria, y recuperar servicios caídos.

---

## Propósito

En un entorno Serverless (Vercel), la depuración se limita al dashboard del proveedor. En un entorno Docker/VPS, tienes **acceso total** al sistema operativo, contenedores, redes y procesos. Este documento equipa al equipo con las herramientas y procedimientos necesarios.

---

## Prerrequisitos

- Acceso SSH al VPS como usuario `deployer` (o root).
- Docker instalado y corriendo.
- Familiaridad básica con comandos Linux.

---

## 1. Lectura de Logs

### 1.1 Logs desde Easypanel UI

1. Proyecto `free-interp-os` → Servicio → **Logs**.
2. Easypanel muestra los logs en tiempo real (stdout + stderr del contenedor).
3. Filtrar por: **App**, **DB**, o **Redis**.

### 1.2 Logs desde CLI (SSH)

```bash
# ─────────────────────────────────────────────────
# Ver logs de la aplicación (últimas 100 líneas)
# ─────────────────────────────────────────────────
sudo docker logs $(sudo docker ps -q -f "name=free-interp-os_app") --tail 100

# En tiempo real (follow)
sudo docker logs $(sudo docker ps -q -f "name=free-interp-os_app") -f

# Filtrar por errores
sudo docker logs $(sudo docker ps -q -f "name=free-interp-os_app") 2>&1 | grep -i "error\|fatal\|exception"

# Logs con timestamp
sudo docker logs $(sudo docker ps -q -f "name=free-interp-os_app") --timestamps --tail 50

# ─────────────────────────────────────────────────
# Logs de PostgreSQL
# ─────────────────────────────────────────────────
sudo docker logs $(sudo docker ps -q -f "name=free-interp-os_db") --tail 50

# ─────────────────────────────────────────────────
# Logs de Traefik (reverse proxy)
# ─────────────────────────────────────────────────
sudo docker logs traefik --tail 50

# Logs de Easypanel (el panel mismo)
sudo docker logs easypanel --tail 50
```

### 1.3 Exportar Logs a Archivo

```bash
# Exportar logs de la app para análisis offline
sudo docker logs $(sudo docker ps -q -f "name=free-interp-os_app") \
  --since 24h > /tmp/app-logs-$(date +%Y%m%d).txt 2>&1

# Comprimir para enviar
gzip /tmp/app-logs-*.txt
```

---

## 2. Inspección de Contenedores

### 2.1 Estado de Todos los Contenedores

```bash
# Lista completa con estado, puertos, nombres
sudo docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}"

# Output esperado:

| NAMES                | STATUS     | PORTS           | IMAGE         |
| :------------------- | :--------- | :-------------- | :------------ |
| free-interp-os_app-1 | Up 2 hours | 3000/tcp        | ...           |
| free-interp-os_db-1  | Up 2 hours | 5432/tcp        | postgres:16   |
| traefik              | Up 3 days  | 80/tcp, 443/tcp | traefik:v3    |
| easypanel            | Up 3 days  | 3000/tcp        | easypanel/... |
```

### 2.2 Inspeccionar un Contenedor Específico

```bash
# Información completa (JSON)
sudo docker inspect $(sudo docker ps -q -f "name=free-interp-os_app")

# Solo la IP interna
sudo docker inspect $(sudo docker ps -q -f "name=free-interp-os_app") \
  --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'

# Variables de entorno activas
sudo docker inspect $(sudo docker ps -q -f "name=free-interp-os_app") \
  --format '{{range .Config.Env}}{{println .}}{{end}}'

# Estado del health check
sudo docker inspect $(sudo docker ps -q -f "name=free-interp-os_app") \
  --format '{{json .State.Health}}' | python3 -m json.tool
```

### 2.3 Ejecutar Comandos Dentro del Contenedor

```bash
# Shell interactivo en la app
sudo docker exec -it $(sudo docker ps -q -f "name=free-interp-os_app") sh

# Verificar que Node.js está corriendo
sudo docker exec $(sudo docker ps -q -f "name=free-interp-os_app") node -v

# Test rápido de conexión a DB desde la app
sudo docker exec $(sudo docker ps -q -f "name=free-interp-os_app") \
  node -e "
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    p.\$queryRaw\`SELECT 1 as test\`.then(r => {
      console.log('✅ DB OK:', r);
      process.exit(0);
    }).catch(e => {
      console.error('❌ DB Error:', e.message);
      process.exit(1);
    });
  "
```

---

## 3. Inspección de Red Docker

### 3.1 Listar Redes

```bash
sudo docker network ls

# Output esperado:
# NETWORK ID     NAME        DRIVER    SCOPE
# xxxx           bridge      bridge    local
# xxxx           easypanel   bridge    local  ← Tu red de proyecto
# xxxx           host        host      local
```

### 3.2 Inspeccionar la Red del Proyecto

```bash
sudo docker network inspect easypanel

# Buscar la sección "Containers" para ver qué contenedores están conectados
# y sus IPs internas.
```

### 3.3 Test de Conectividad entre Contenedores

```bash
# Desde la app → DB
sudo docker exec $(sudo docker ps -q -f "name=free-interp-os_app") \
  wget -qO- --timeout=5 http://free-interp-os_db:5432 2>&1 || echo "Puerto PostgreSQL alcanzable"

# Desde la app → Redis
sudo docker exec $(sudo docker ps -q -f "name=free-interp-os_app") \
  wget -qO- --timeout=5 http://free-interp-os_redis:6379 2>&1 || echo "Puerto Redis alcanzable"

# Verificar resolución DNS interna
sudo docker exec $(sudo docker ps -q -f "name=free-interp-os_app") \
  nslookup free-interp-os_db 2>/dev/null || \
  sudo docker exec $(sudo docker ps -q -f "name=free-interp-os_app") \
  getent hosts free-interp-os_db
```

### 3.4 Inspeccionar Tráfico (avanzado)

```bash
# Instalar tcpdump en el VPS
sudo apt install -y tcpdump

# Capturar tráfico entre app y DB
sudo tcpdump -i any port 5432 -c 20

# Capturar requests HTTP entrantes
sudo tcpdump -i any port 80 or port 443 -c 20

# Verificar puertos abiertos del VPS
sudo ss -tlnp
```

---

## 4. Errores de Memoria (OOM — Out Of Memory)

### 4.1 Detectar OOM Kill

```bash
# Verificar si Docker mató un contenedor por OOM
sudo docker inspect $(sudo docker ps -aq -f "name=free-interp-os_app") \
  --format '{{.State.OOMKilled}}'
# Output: true = fue matado por OOM

# Ver eventos de Docker
sudo docker events --since 1h --filter 'type=container' --filter 'event=oom'

# Verificar en el log del kernel
sudo dmesg | grep -i "oom\|killed" | tail -20
```

### 4.2 Monitorear Uso de Memoria en Tiempo Real

```bash
# Uso de memoria de todos los contenedores
sudo docker stats --no-stream --format \
  "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}"

# Output esperado:
# NAME                    CPU %   MEM USAGE / LIMIT     MEM %   NET I/O
# free-interp-os_app-1    2.5%    256MiB / 1GiB         25%     10MB / 5MB
# free-interp-os_db-1     1.0%    128MiB / 512MiB       25%     5MB / 2MB

# Monitoreo continuo (actualiza cada 3s)
sudo docker stats
```

### 4.3 Soluciones para OOM

| Causa                              | Solución                                             |
| :--------------------------------- | :--------------------------------------------------- |
| Build de Next.js consume mucha RAM | Agregar swap al VPS (`fallocate -l 8G /swapfile`)    |
| Node.js heap overflow              | `NODE_OPTIONS=--max-old-space-size=1024` en env      |
| PostgreSQL shared_buffers muy alto | Reducir a 2GB si el VPS tiene < 16GB RAM             |
| Memory leak en la app              | Reiniciar periódicamente o debuggear con `--inspect` |
| Demasiados contenedores            | Reducir servicios innecesarios                       |

### 4.4 Configurar Límites de Memoria en Easypanel

1. Servicio `app` → **Advanced** → **Resources**.
2. Configurar:

| Recurso | Valor   |
| :------ | :------ |
| Memory  | 1024 MB |
| Swap    | 512 MB  |
| CPU     | 1 core  |

> Easypanel traduce esto a `--memory=1024m --memory-swap=1536m` en Docker.

---

## 5. Reinicio y Recuperación de Servicios

### 5.1 Reiniciar un Servicio desde Easypanel UI

1. Servicio → **Settings** → **Restart** (o botón de restart).
2. El contenedor se detiene y se levanta con la misma configuración.

### 5.2 Reiniciar desde CLI

```bash
# Reiniciar la app
sudo docker restart $(sudo docker ps -q -f "name=free-interp-os_app")

# Reiniciar la DB
sudo docker restart $(sudo docker ps -q -f "name=free-interp-os_db")

# Reiniciar TODO el proyecto (Easypanel completo)
sudo docker restart easypanel

# Reiniciar Docker daemon (último recurso)
sudo systemctl restart docker
```

### 5.3 Reinicio Automático (Restart Policy)

Docker/Easypanel configura por defecto `--restart=unless-stopped`. Si un contenedor crashea:

- Se reinicia automáticamente.
- Si crashea repetidamente, Docker aplica back-off exponencial (espera progresiva).

Verificar:

```bash
sudo docker inspect $(sudo docker ps -q -f "name=free-interp-os_app") \
  --format '{{.HostConfig.RestartPolicy.Name}}'
# Output esperado: unless-stopped
```

### 5.4 Recuperación de Desastre

#### Escenario: VPS reiniciado (reboot)

```bash
# Docker se levanta automáticamente con systemd
# Los contenedores con restart policy se levantan solos

# Verificar estado después del reboot
sudo docker ps -a
sudo docker logs easypanel --tail 20
```

#### Escenario: Disco lleno

```bash
# Identificar qué ocupa espacio
df -h
sudo du -sh /var/lib/docker/*

# Limpiar imágenes y contenedores no usados
sudo docker system prune -a --volumes --force

# Limpiar build cache
sudo docker builder prune --force

# Verificar espacio recuperado
df -h
```

#### Escenario: Base de datos corrupta

```bash
# 1. Detener la app (para evitar más escrituras)
sudo docker stop $(sudo docker ps -q -f "name=free-interp-os_app")

# 2. Intentar reparar
sudo docker exec $(sudo docker ps -q -f "name=free-interp-os_db") \
  pg_isready -U postgres

# 3. Si no responde, restaurar desde backup
# Ver 03-database-and-services.md → Paso 5.3

# 4. Reiniciar la app
sudo docker start $(sudo docker ps -q -f "name=free-interp-os_app")
```

---

## 6. Debugging de la Aplicación Next.js

### 6.1 Errores Comunes en Producción

| Síntoma                          | Causa Probable                          | Solución                                 |
| :------------------------------- | :-------------------------------------- | :--------------------------------------- |
| Página muestra "500 Internal"    | Variable de entorno faltante            | Verificar env vars en Easypanel          |
| "ECONNREFUSED" en logs           | DB no está corriendo                    | `docker restart` del servicio db         |
| "Prisma Client not generated"    | Dockerfile no ejecuta `prisma generate` | Verificar Dockerfile stage `deps`        |
| Página en blanco (blank page)    | Error en build de Next.js               | Verificar logs del build en Easypanel    |
| "ENOMEM" o "JavaScript heap OOM" | Poca memoria                            | Aumentar `--max-old-space-size`          |
| Lentitud extrema                 | Swap exhausto                           | Verificar `free -h`, aumentar RAM o swap |

### 6.2 Habilitar Debug Mode Temporalmente

```bash
# Establecer variable de entorno temporal
sudo docker exec -e LOG_LEVEL=debug \
  $(sudo docker ps -q -f "name=free-interp-os_app") \
  node -e "console.log(process.env.LOG_LEVEL)"

# Para debug persistente: cambiar LOG_LEVEL en Easypanel → Environment
```

### 6.3 Verificar el Estado de Prisma

```bash
sudo docker exec $(sudo docker ps -q -f "name=free-interp-os_app") \
  npx prisma db pull --print 2>/dev/null | head -20

# Si falla, verificar que el binario de Prisma existe
sudo docker exec $(sudo docker ps -q -f "name=free-interp-os_app") \
  ls -la node_modules/.prisma/client/
```

---

## 7. Monitoreo del Sistema (VPS)

### 7.1 Comandos Esenciales

```bash
# CPU y memoria del sistema
htop  # o: top

# Memoria libre
free -h

# Disco
df -h

# Procesos que más consumen
ps aux --sort=-%mem | head -10

# Uptime del sistema
uptime

# Tráfico de red
sudo iftop -i eth0  # Instalar con: sudo apt install iftop
```

### 7.2 Script de Health Check Automatizado

Crear `/opt/scripts/healthcheck.sh`:

```bash
#!/bin/bash
# healthcheck.sh — Verificación automática de servicios

APP_URL="https://app.freeinterpreters.com"
LOG="/var/log/healthcheck.log"

check_service() {
  local name=$1
  local container_filter=$2

  if sudo docker ps -q -f "name=$container_filter" --filter "status=running" | grep -q .; then
    echo "[$(date)] ✅ $name: running" >> "$LOG"
  else
    echo "[$(date)] ❌ $name: DOWN — attempting restart" >> "$LOG"
    sudo docker restart $(sudo docker ps -aq -f "name=$container_filter") 2>> "$LOG"
  fi
}

check_http() {
  local status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$APP_URL")
  if [ "$status" -eq 200 ]; then
    echo "[$(date)] ✅ HTTP: $status" >> "$LOG"
  else
    echo "[$(date)] ⚠️ HTTP: $status — app may be unhealthy" >> "$LOG"
  fi
}

check_disk() {
  local usage=$(df / --output=pcent | tail -1 | tr -d ' %')
  if [ "$usage" -gt 90 ]; then
    echo "[$(date)] 🚨 DISK: ${usage}% — CRITICAL" >> "$LOG"
    sudo docker system prune -f >> "$LOG" 2>&1
  fi
}

# Ejecutar checks
check_service "App" "free-interp-os_app"
check_service "Database" "free-interp-os_db"
check_http
check_disk
```

### 7.3 Programar Health Check con Cron

```bash
sudo chmod +x /opt/scripts/healthcheck.sh

sudo crontab -e
# Agregar: cada 5 minutos
*/5 * * * * /opt/scripts/healthcheck.sh
```

---

## 8. Referencia Rápida de Comandos

```text
┌──────────────────────────────────────────────────────────────────┐
│                    CHEAT SHEET — Docker/Easypanel                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LOGS                                                            │
│  docker logs <container> --tail 100      Últimas 100 líneas     │
│  docker logs <container> -f              Tiempo real (follow)    │
│  docker logs <container> --since 1h      Última hora             │
│                                                                  │
│  ESTADO                                                          │
│  docker ps -a                            Todos los contenedores  │
│  docker stats                            Uso de recursos (live)  │
│  docker inspect <container>              Detalle completo (JSON) │
│                                                                  │
│  ACCIONES                                                        │
│  docker restart <container>              Reiniciar               │
│  docker stop <container>                 Detener                 │
│  docker exec -it <container> sh          Shell interactivo       │
│                                                                  │
│  RED                                                             │
│  docker network ls                       Listar redes            │
│  docker network inspect easypanel        Detalle de red          │
│                                                                  │
│  LIMPIEZA                                                        │
│  docker system prune -a                  Limpiar todo no usado   │
│  docker builder prune                    Limpiar build cache     │
│  docker volume prune                     Limpiar volúmenes       │
│                                                                  │
│  SISTEMA (VPS)                                                   │
│  free -h                                 Memoria                 │
│  df -h                                   Disco                   │
│  htop                                    CPU/Procesos            │
│  ss -tlnp                                Puertos abiertos        │
│  dmesg | tail -50                        Kernel logs             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```
