# 03 — Database & Services

> **Objetivo**: Levantar PostgreSQL y Redis como servicios integrados en Easypanel, configurar volúmenes persistentes, redes internas, y migrar datos desde Neon.tech/Supabase.

---

## Propósito

Reemplazar las bases de datos remotas (Neon.tech/Supabase) por servicios locales gestionados directamente desde Easypanel. La comunicación entre la app y la DB será por red interna Docker (latencia < 1ms vs. ~50-100ms en conexiones remotas).

---

## Prerrequisitos

- Proyecto `free-interp-os` creado en Easypanel (ver `01-vps-and-easypanel-setup.md`).
- Acceso SSH al VPS para operaciones de backup/restore.
- `pg_dump` instalado en la máquina de desarrollo (viene con PostgreSQL CLI).

---

## Paso 1: Levantar PostgreSQL en Easypanel

### 1.1 Crear Servicio de Base de Datos

1. En Easypanel UI → Proyecto `free-interp-os` → **+ New Service**.
2. Seleccionar **Postgres** de la lista de templates.
3. Configurar:

| Campo         | Valor                           |
| :------------ | :------------------------------ |
| Service Name  | `db`                            |
| Image         | `postgres:16-alpine`            |
| Password      | (Easypanel genera una automática) |

4. Click **Create**.

### 1.2 Verificar Conexión Interna

El hostname interno generado por Easypanel sigue el patrón:

```text
Hostname: free-interp-os_db
Puerto:   5432
Database: postgres (default)
User:     postgres
Password: <generado por Easypanel>
```

La connection string interna será:
```text
postgresql://postgres:<PASSWORD>@free-interp-os_db:5432/postgres
```

> **Nota**: Este hostname es **solo accesible dentro de la red Docker de Easypanel**. No es accesible desde internet.

### 1.3 Configurar Volúmenes Persistentes

Easypanel configura volúmenes automáticamente para PostgreSQL. Verificar:

1. Servicio `db` → **Advanced** → **Volumes**.
2. Confirmar que existe un mount:

| Mount Path (Container) | Tipo     | Descripción                     |
| :---------------------- | :------- | :------------------------------ |
| `/var/lib/postgresql/data` | Volume | Datos persistentes de PostgreSQL |

> Los datos sobreviven a reinicios del contenedor, updates de imagen, y re-deployments.

### 1.4 Crear la Base de Datos de la Aplicación

Desde la terminal del VPS:

```bash
# Conectar al contenedor de PostgreSQL
sudo docker exec -it $(sudo docker ps -q -f "name=free-interp-os_db") psql -U postgres

# Dentro de psql:
CREATE DATABASE freeinterpreters;
\q
```

O usando la terminal integrada en Easypanel:
1. Servicio `db` → **Terminal**.
2. Ejecutar: `psql -U postgres -c "CREATE DATABASE freeinterpreters;"`

---

## Paso 2: Levantar Redis (Opcional — Caché/Sesiones)

### 2.1 Crear Servicio

1. Proyecto `free-interp-os` → **+ New Service**.
2. Seleccionar **Redis** de la lista de templates.
3. Configurar:

| Campo         | Valor              |
| :------------ | :----------------- |
| Service Name  | `redis`            |
| Image         | `redis:7-alpine`   |
| Password      | (configurar una)   |

### 2.2 Conexión Interna

```text
Hostname: free-interp-os_redis
Puerto:   6379
URL:      redis://:<PASSWORD>@free-interp-os_redis:6379
```

### 2.3 Cuándo Usar Redis

| Caso de Uso                     | Sin Redis              | Con Redis                  |
| :------------------------------ | :--------------------- | :------------------------- |
| Rate limiting (API)             | In-memory (se pierde)  | Persistente entre requests |
| Caché de consultas frecuentes   | No hay caché           | TTL configurable           |
| Sesiones JWT (blacklist)        | Sin revocación         | Revocación inmediata       |
| Cola de notificaciones          | Síncrono               | Asíncrono con BullMQ       |

> Para la v1 de la migración, Redis es **opcional**. La app funciona sin él.

---

## Paso 3: Red Interna de Docker

### 3.1 Topología

Easypanel crea automáticamente una red Docker para cada proyecto. Todos los servicios dentro de un proyecto se ven entre sí por su nombre de servicio.

```text
┌─────────────────────────────────────────────────┐
│           Red Docker: easypanel (bridge)         │
│                                                   │
│  ┌──────────────┐  ┌──────────┐  ┌────────────┐  │
│  │  app (:3000)  │  │ db (:5432)│  │redis (:6379)│ │
│  │               │→ │           │  │             │  │
│  │  Next.js 16   │  │ PG 16    │  │ Redis 7     │  │
│  └──────────────┘  └──────────┘  └────────────┘  │
│         ↑                                          │
│    Traefik (:443) — Único punto de entrada externo │
└─────────────────────────────────────────────────┘
```

### 3.2 Resolución de Nombres

| Desde `app` | Destino              | Ejemplo                              |
| :---------- | :------------------- | :----------------------------------- |
| DB          | `free-interp-os_db`  | `postgresql://postgres:pw@free-interp-os_db:5432/freeinterpreters` |
| Redis       | `free-interp-os_redis` | `redis://:pw@free-interp-os_redis:6379` |

### 3.3 Verificar Conectividad (desde el contenedor app)

```bash
# Entrar al contenedor de la app
sudo docker exec -it $(sudo docker ps -q -f "name=free-interp-os_app") sh

# Ping a la DB (si curl está disponible)
wget -qO- http://free-interp-os_db:5432 || echo "Puerto PostgreSQL responde"

# Test de conexión con Node.js
node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(() => { console.log('✅ DB Connected'); c.end(); }).catch(e => console.error('❌', e.message));
"
```

---

## Paso 4: Migrar Datos desde Neon.tech/Supabase

### 4.1 Exportar Datos (desde el origen remoto)

```bash
# Opción A: Desde Neon.tech
pg_dump \
  --host=ep-xxxx.us-east-2.aws.neon.tech \
  --port=5432 \
  --username=neondb_owner \
  --dbname=neondb \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file=backup_neon.dump

# Opción B: Desde Supabase
pg_dump \
  --host=db.kzbkygppplknynrwmtmf.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --format=custom \
  --no-owner \
  --no-privileges \
  --exclude-schema='auth|storage|realtime|supabase_*' \
  --file=backup_supabase.dump
```

> **Nota**: `--exclude-schema` en Supabase es crucial para no importar los esquemas internos de Supabase (auth, storage, etc.) que no existen en tu PostgreSQL de Easypanel.

### 4.2 Subir el Dump al VPS

```bash
# Desde tu máquina local
scp backup_supabase.dump deployer@<IP_VPS>:/tmp/
```

### 4.3 Importar Datos en PostgreSQL de Easypanel

```bash
# En el VPS — copiar dump al contenedor
sudo docker cp /tmp/backup_supabase.dump $(sudo docker ps -q -f "name=free-interp-os_db"):/tmp/

# Restaurar
sudo docker exec -it $(sudo docker ps -q -f "name=free-interp-os_db") \
  pg_restore \
    --username=postgres \
    --dbname=freeinterpreters \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    /tmp/backup_supabase.dump
```

### 4.4 Alternativa: Migración con Prisma (Schema Fresh)

Si prefieres empezar con un schema limpio y poblar datos después:

```bash
# Desde el contenedor app o una sesión con acceso al código
npx prisma db push --accept-data-loss

# O usar migraciones formales:
npx prisma migrate deploy
```

---

## Paso 5: Backups Automatizados

### 5.1 Script de Backup

Crear `/opt/scripts/backup-db.sh` en el VPS:

```bash
#!/bin/bash
# backup-db.sh — Backup diario de PostgreSQL

BACKUP_DIR="/opt/backups/postgresql"
DATE=$(date +%Y-%m-%d_%H%M)
CONTAINER=$(sudo docker ps -q -f "name=free-interp-os_db")
RETENTION_DAYS=7

# Crear directorio si no existe
mkdir -p "$BACKUP_DIR"

# Ejecutar pg_dump dentro del contenedor
sudo docker exec "$CONTAINER" \
  pg_dump -U postgres -d freeinterpreters -Fc \
  > "${BACKUP_DIR}/freeinterpreters_${DATE}.dump"

# Verificar integridad
if [ $? -eq 0 ]; then
  echo "[$(date)] ✅ Backup exitoso: freeinterpreters_${DATE}.dump"
else
  echo "[$(date)] ❌ Error en backup" >&2
  exit 1
fi

# Eliminar backups antiguos
find "$BACKUP_DIR" -name "*.dump" -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] 🗑️ Backups > ${RETENTION_DAYS} días eliminados"
```

### 5.2 Programar con Cron

```bash
sudo chmod +x /opt/scripts/backup-db.sh

# Editar crontab
sudo crontab -e

# Agregar: backup diario a las 3:00 AM
0 3 * * * /opt/scripts/backup-db.sh >> /var/log/db-backup.log 2>&1
```

### 5.3 Restaurar desde Backup

```bash
# Copiar el dump al contenedor
sudo docker cp /opt/backups/postgresql/freeinterpreters_2026-04-30_0300.dump \
  $(sudo docker ps -q -f "name=free-interp-os_db"):/tmp/restore.dump

# Restaurar
sudo docker exec -it $(sudo docker ps -q -f "name=free-interp-os_db") \
  pg_restore -U postgres -d freeinterpreters --clean --if-exists /tmp/restore.dump
```

---

## Paso 6: Configuración Avanzada de PostgreSQL

### 6.1 Tuning para VPS con 24GB RAM

Crear un `postgresql.conf` optimizado montado como volumen:

```bash
# Crear archivo de configuración
sudo mkdir -p /opt/config/postgresql
sudo tee /opt/config/postgresql/custom.conf << 'EOF'
# Memoria
shared_buffers = 4GB
effective_cache_size = 12GB
work_mem = 64MB
maintenance_work_mem = 512MB

# WAL
wal_buffers = 64MB
checkpoint_completion_target = 0.9
max_wal_size = 2GB

# Conexiones
max_connections = 100

# Query planner
random_page_cost = 1.1
effective_io_concurrency = 200
default_statistics_target = 100

# Logging
log_min_duration_statement = 1000  # Log queries > 1s
log_checkpoints = on
log_connections = on
log_disconnections = on
EOF
```

Para montar en Easypanel:
1. Servicio `db` → **Advanced** → **Volumes**.
2. Agregar bind mount:
   - **Host Path**: `/opt/config/postgresql/custom.conf`
   - **Container Path**: `/etc/postgresql/conf.d/custom.conf`

> O ejecutar directamente en psql: `ALTER SYSTEM SET shared_buffers = '4GB';`

---

## Troubleshooting

### PostgreSQL no inicia — "data directory has wrong ownership"

```bash
# Verificar permisos del volumen
sudo docker exec $(sudo docker ps -q -f "name=free-interp-os_db") ls -la /var/lib/postgresql/data

# Fix: cambiar ownership
sudo docker exec $(sudo docker ps -q -f "name=free-interp-os_db") \
  chown -R postgres:postgres /var/lib/postgresql/data
```

### Error: "FATAL: password authentication failed"

```bash
# Verificar la contraseña configurada en Easypanel
# Servicio db → Environment → POSTGRES_PASSWORD

# Verificar que el DATABASE_URL en el servicio app usa la misma contraseña
```

### La app no puede conectar a la DB — "ECONNREFUSED"

```bash
# 1. Verificar que ambos servicios están en la misma red
sudo docker network inspect easypanel

# 2. Verificar el hostname
sudo docker exec $(sudo docker ps -q -f "name=free-interp-os_app") \
  ping -c 3 free-interp-os_db

# 3. Verificar que PostgreSQL está escuchando
sudo docker exec $(sudo docker ps -q -f "name=free-interp-os_db") \
  pg_isready -U postgres
```

### Disco lleno — PostgreSQL crashea

```bash
# Verificar espacio
df -h

# Limpiar WAL logs antiguos
sudo docker exec $(sudo docker ps -q -f "name=free-interp-os_db") \
  psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('freeinterpreters'));"

# Limpiar backups antiguos
find /opt/backups -name "*.dump" -mtime +3 -delete

# Vacuum para recuperar espacio
sudo docker exec $(sudo docker ps -q -f "name=free-interp-os_db") \
  psql -U postgres -d freeinterpreters -c "VACUUM FULL VERBOSE;"
```

### Migración de datos incompleta — tablas faltantes

```bash
# Verificar tablas existentes
sudo docker exec $(sudo docker ps -q -f "name=free-interp-os_db") \
  psql -U postgres -d freeinterpreters -c "\dt"

# Si faltan tablas, ejecutar Prisma push:
sudo docker exec $(sudo docker ps -q -f "name=free-interp-os_app") \
  npx prisma db push
```
