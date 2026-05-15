# 01 — VPS & Easypanel Setup

> **Objetivo**: Provisionar un servidor Ubuntu gratuito en Oracle Cloud y instalar Easypanel como plataforma de gestión de contenedores.

---

## Propósito

Configurar la infraestructura base sobre la cual correrá toda la plataforma Free Interpreters OS. Easypanel actúa como un PaaS self-hosted (similar a Heroku) encima de Docker, con Traefik como reverse proxy y Let's Encrypt para SSL automático.

---

## Prerrequisitos

- Cuenta en [Oracle Cloud](https://cloud.oracle.com/) (Free Tier — no requiere tarjeta de crédito en la mayoría de regiones).
- Dominio propio apuntado a Cloudflare u otro DNS (ej. `freeinterpreters.com`).
- Conocimiento básico de SSH y terminal Linux.
- Cliente SSH: PowerShell (Windows), Terminal (macOS), o PuTTY.

---

## Paso 1: Crear Instancia en Oracle Cloud (Always Free)

### 1.1 Especificaciones del Free Tier ARM

| Recurso    | Valor                          |
| :--------- | :----------------------------- |
| Shape      | `VM.Standard.A1.Flex` (ARM)    |
| OCPUs      | Hasta 4 vCPUs (Ampere A1)      |
| RAM        | Hasta 24 GB                    |
| Disco      | 200 GB Block Volume (boot)     |
| Networking | 1 Gbps, IP pública estática    |
| OS         | Ubuntu 22.04 Minimal (aarch64) |

### 1.2 Procedimiento

1. Ir a **Oracle Cloud Console** → **Compute** → **Instances** → **Create Instance**.
2. Seleccionar:
   - **Image**: Ubuntu 22.04 Minimal (aarch64)
   - **Shape**: `VM.Standard.A1.Flex`
   - **OCPUs**: 4, **Memory**: 24 GB
   - **Boot volume**: 200 GB
3. En **Networking**:
   - Asignar IP pública.
   - Crear o usar una VCN existente con subnet pública.
4. **SSH Key**: Subir tu clave pública (`~/.ssh/id_rsa.pub`) o generar una nueva.
5. Click **Create** y esperar ~2 minutos.

### 1.3 Abrir Puertos en Security List

Oracle Cloud bloquea puertos por defecto. Abrir los siguientes en la **Security List** de la subnet:

```text
Ingress Rules (Stateless = No):
┌──────────┬──────────┬─────────────────┬────────────────────┐
│ Protocol │ Port     │ Source          │ Descripción         │
├──────────┼──────────┼─────────────────┼────────────────────┤
│ TCP      │ 22       │ 0.0.0.0/0      │ SSH                │
│ TCP      │ 80       │ 0.0.0.0/0      │ HTTP (Traefik)     │
│ TCP      │ 443      │ 0.0.0.0/0      │ HTTPS (Traefik)    │
│ TCP      │ 3000     │ 0.0.0.0/0      │ Easypanel UI       │
└──────────┴──────────┴─────────────────┴────────────────────┘
```

> **Nota**: El puerto 3000 es temporal para el setup de Easypanel. Después de configurar SSL en Easypanel, puedes restringirlo.

### 1.4 Firewall del OS (iptables)

Oracle Ubuntu usa `iptables` por defecto. Ejecutar después de conectar por SSH:

```bash
# Conectar al VPS
ssh -i ~/.ssh/id_rsa ubuntu@<IP_PUBLICA>

# Abrir puertos en iptables
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT

# Persistir reglas
sudo netfilter-persistent save
sudo netfilter-persistent reload
```

---

## Paso 2: Preparar el Servidor

### 2.1 Actualizar el Sistema

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip
```

### 2.2 Configurar Swap (recomendado para builds)

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Persistir swap
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Optimizar swappiness
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### 2.3 Configurar Timezone

```bash
sudo timedz set-timezone America/New_York  # Ajustar a tu zona
```

---

## Paso 3: Instalar Easypanel

### 3.1 Instalación (un solo comando)

```bash
curl -sSL https://get.easypanel.io | sudo bash
```

Este script:

- Instala Docker CE si no está presente.
- Configura la red Docker interna (`easypanel`).
- Levanta Traefik como reverse proxy.
- Inicia la UI de Easypanel en `http://<IP>:3000`.

### 3.2 Verificar Instalación

```bash
# Verificar que Docker está corriendo
sudo docker ps

# Output esperado (3 contenedores):
# easypanel       — Panel de control
# traefik         — Reverse proxy
# easypanel-db    — SQLite interna de Easypanel
```

### 3.3 Acceder al Panel

1. Abrir `http://<IP_PUBLICA>:3000` en el navegador.
2. Crear la cuenta de administrador (primer acceso).
3. **Guardar las credenciales de forma segura** — no hay recuperación de contraseña sin acceso SSH.

---

## Paso 4: Configurar Dominio y SSL

### 4.1 DNS en Cloudflare (o tu proveedor)

Crear los siguientes registros DNS:

```text
┌──────┬────────────────────────────┬──────────────────┬───────┐
│ Type │ Name                       │ Content          │ Proxy │
├──────┼────────────────────────────┼──────────────────┼───────┤
│ A    │ panel.freeinterpreters.com │ <IP_PUBLICA_VPS> │ OFF   │
│ A    │ app.freeinterpreters.com   │ <IP_PUBLICA_VPS> │ OFF   │
│ A    │ *.freeinterpreters.com     │ <IP_PUBLICA_VPS> │ OFF   │
└──────┴────────────────────────────┴──────────────────┴───────┘
```

> **Importante**: Si usas Cloudflare, el proxy debe estar **OFF** (DNS Only / gris) para que Traefik gestione SSL directamente. Si activas el proxy de Cloudflare, tendrás doble SSL y conflictos con los certificados.

### 4.2 Configurar Dominio en Easypanel

1. En la UI de Easypanel → **Settings** → **General**.
2. Establecer **Panel Domain**: `panel.freeinterpreters.com`.
3. Easypanel generará automáticamente un certificado SSL vía Let's Encrypt.
4. Reiniciar Easypanel si se pide.

### 4.3 Verificar SSL

```bash
# Desde tu máquina local
curl -I https://panel.freeinterpreters.com

# Output esperado:
# HTTP/2 200
# server: traefik
# strict-transport-security: max-age=31536000
```

---

## Paso 5: Crear el Proyecto en Easypanel

### 5.1 Crear Proyecto

1. Easypanel UI → **Projects** → **+ New Project**.
2. **Project Name**: `free-interp-os`.
3. Click **Create**.

### 5.2 Estructura Final del Proyecto

Dentro del proyecto, crearemos los siguientes servicios (en documentos posteriores):

| Servicio | Tipo         | Documento de Referencia          |
| :------- | :----------- | :------------------------------- |
| app      | App (Docker) | `02-dockerization-and-builds.md` |
| db       | PostgreSQL   | `03-database-and-services.md`    |
| redis    | Redis        | `03-database-and-services.md`    |

---

## Paso 6: Hardening Básico del Servidor

### 6.1 Crear Usuario No-Root

```bash
sudo adduser deployer
sudo usermod -aG sudo deployer
sudo usermod -aG docker deployer

# Copiar SSH keys
sudo mkdir -p /home/deployer/.ssh
sudo cp ~/.ssh/authorized_keys /home/deployer/.ssh/
sudo chown -R deployer:deployer /home/deployer/.ssh
```

### 6.2 Deshabilitar Root Login SSH

```bash
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd
```

### 6.3 Fail2Ban (Protección contra Brute Force)

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 6.4 Actualizaciones Automáticas de Seguridad

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
# Seleccionar "Yes" para habilitar actualizaciones automáticas
```

---

## Troubleshooting

### Easypanel no carga en `http://<IP>:3000`

```bash
# Verificar que los contenedores están corriendo
sudo docker ps -a | grep easypanel

# Reiniciar Easypanel
sudo docker restart easypanel

# Ver logs
sudo docker logs easypanel --tail 50
```

### Error "Connection refused" después de configurar dominio

```bash
# Verificar que Traefik está escuchando
sudo docker logs traefik --tail 30

# Verificar resolución DNS
nslookup panel.freeinterpreters.com

# Verificar puertos abiertos
sudo ss -tlnp | grep -E '80|443|3000'
```

### Oracle Cloud: Instancia no obtiene IP pública

1. Ir a **Networking** → **Virtual Cloud Networks** → tu VCN.
2. Verificar que la subnet es **pública** y tiene un **Internet Gateway** asociado.
3. En la instancia, verificar que tiene una **VNIC** con IP pública asignada.

### Let's Encrypt falla al generar certificado

```bash
# El dominio debe resolver a la IP del VPS (DNS propagado)
dig +short panel.freeinterpreters.com

# Let's Encrypt necesita puertos 80 y 443 abiertos
sudo iptables -L -n | grep -E '80|443'

# Logs de Traefik para ver errores ACME
sudo docker logs traefik 2>&1 | grep -i "acme\|certificate\|error"
```

### SSH timeout (Oracle Cloud específico)

```bash
# Agregar keepalive en tu ~/.ssh/config local
Host oracle-vps
    HostName <IP_PUBLICA>
    User deployer
    IdentityFile ~/.ssh/id_rsa
    ServerAliveInterval 60
    ServerAliveCountMax 3
```
