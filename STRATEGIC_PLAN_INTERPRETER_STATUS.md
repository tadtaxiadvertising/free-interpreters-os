# 🧠 Plan Estratégico: Sistema de Estados Inteligente para Intérpretes

## Visión General

Sistema de detección de actividad en tiempo real que permite al administrador saber cuándo los intérpretes están disponibles, ocupados, ausentes o desconectados — sin depender de acciones manuales.

---

## 🏗️ Arquitectura Actual (Estado Actual)

```
Interpreter.realtimeStatus → "Online" | "Offline" | "Busy"
├── status.ts (Server Action) → update manual por el intérprete
├── api/presence/route.ts → endpoint REST con heartbeat
├── calls.ts → setea "Busy" al iniciar llamada, "Online" al terminar
└── Dashboard → PresenceBadge component
```

**Problemas detectados:**
- ❌ `getLiveRosterAction` (monitoring.ts) **no incluye** `realtimeStatus` en el SELECT
- ❌ Sin detección de inactividad: si el intérprete cierra el navegador, queda "Online" para siempre
- ❌ Sin campos `lastHeartbeat`, `lastActivity`, `lastOnlineAt`, `lastOfflineAt`
- ❌ Sin historial de cambios de estado (auditoría)
- ❌ Sin filtros por estado en la vista admin
- ❌ Sin notificaciones de ausencia prolongada

---

## 📡 Fase 1: Data Model (Prisma Schema)

### Migración de Schema

```prisma
model Interpreter {
  // ... campos existentes ...

  realtimeStatus     String?   @default("Offline") @map("realtime_status")
  statusReason       String?   @default("initial")  @map("status_reason")     // NUEVO
  lastHeartbeat      DateTime? @map("last_heartbeat")                        // NUEVO
  lastActivity       DateTime? @map("last_activity")                         // NUEVO
  lastOnlineAt       DateTime? @map("last_online_at")                        // NUEVO
  lastOfflineAt      DateTime? @map("last_offline_at")                       // NUEVO
  statusChangedAt    DateTime? @map("status_changed_at")                     // NUEVO
  browserTabId       String?   @map("browser_tab_id")                        // NUEVO
  clientIp           String?   @map("client_ip")                             // NUEVO
}

model InterpreterStatusLog {
  id             Int      @id @default(autoincrement())
  interpreterId  Int      @map("interpreter_id")
  previousStatus String?  @map("previous_status")
  newStatus      String   @map("new_status")
  reason         String   @default("manual")
  changedBy      String?  @map("changed_by")        // "system" | "interpreter" | "admin"
  metadata       Json?                              // browser info, tabId, ip
  createdAt      DateTime @default(now()) @map("created_at")

  interpreter    Interpreter @relation(fields: [interpreterId], references: [id])

  @@index([interpreterId, createdAt(sort: Desc)])
  @@map("interpreter_status_logs")
}
```

### Valores de statusReason

| Reason | Descripción |
|---|---|
| `initial` | Recién creado, nunca conectado |
| `user_online` | Intérprete marcó Online manualmente |
| `call_started` | Inició una llamada → Busy |
| `call_ended` | Terminó la llamada → Online |
| `inactivity_timeout` | Sin actividad por 5 min → Away |
| `heartbeat_timeout` | Sin heartbeat por 10 min → Offline |
| `browser_closed` | Detectado por beforeunload → Offline |
| `login` | Inicio de sesión → Online |
| `admin_override` | Admin cambió manualmente el estado |
| `system_auto` | Sistema (CRON) forzó transición |

---

## 🔄 Fase 2: Máquina de Estados (State Machine)

```
                    ┌──────────────┐
                    │   OFFLINE    │
                    └──────┬───────┘
                           │ login / user_online
                           ▼
                    ┌──────────────┐
            ┌──────▶│    ONLINE    │◀────────────┐
            │       └──────┬───────┘              │
            │              │                      │
            │     call_started              call_ended
            │              │                      │
            │              ▼                      │
            │       ┌──────────────┐              │
            │       │    BUSY      │──────────────┘
            │       └──────────────┘
            │
            │      inactivity (5 min sin mouse/teclado)
            │              │
            │              ▼
            │       ┌──────────────┐
            │       │    AWAY      │────────────┐
            │       └──────────────┘             │
            │              │                     │
            │    heartbeat timeout (10 min)     vuelve con actividad
            │              │                     │
            │              ▼                     │
            └──────┐ ┌──────────────┐ ◄─────────┘
                   │ │   OFFLINE    │
                   │ └──────────────┘
                   │
            browser_closed (beforeunload)
```

### Reglas de Transición

| Desde | Hacia | Gatillo | Timeout |
|---|---|---|---|
| Offline | Online | Login / Manual | — |
| Online | Busy | Inicio de llamada | — |
| Busy | Online | Fin de llamada | — |
| Online | Away | Sin interacción | 5 min |
| Away | Online | Interacción detectada | — |
| Away | Offline | Sin heartbeat | 10 min (desde Away) |
| Busy | Offline | Sin heartbeat + call forced end | 12 min |
| Online | Offline | beforeunload / heartbeat timeout | 10 min |
| * | * | Admin override | Manual |

---

## 💓 Fase 3: Heartbeat & Detección (Cliente)

### 1. Heartbeat del Navegador

```typescript
// components/HeartbeatProvider.tsx
// Intervalo: cada 60s
// Envía: { type: 'heartbeat', tabId, timestamp }
// Supera: api/presence (POST) → actualiza lastHeartbeat en DB

useEffect(() => {
  const interval = setInterval(async () => {
    await fetch('/api/presence', {
      method: 'POST',
      body: JSON.stringify({ type: 'heartbeat', tabId }),
    });
    // También actualiza lastActivity vía nometalock
  }, 60_000); // cada minuto

  // Cleanup on tab close
  window.addEventListener('beforeunload', () => {
    navigator.sendBeacon('/api/presence', JSON.stringify({
      type: 'offline',
      reason: 'browser_closed',
      tabId,
    }));
  });

  return () => clearInterval(interval);
}, []);
```

### 2. Detección de Inactividad

```typescript
// components/ActivityTracker.tsx
// Detecta mouse move, keyboard, click, touch
// Si no hay actividad en 5 min → setea status "Away" vía API
// Si hay actividad después de Away → setea status "Online"

const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 min

useEffect(() => {
  let idleTimer: NodeJS.Timeout;

  const resetIdle = () => {
    clearTimeout(idleTimer);
    if (status === 'Away') setStatus('Online'); // Auto-recuperación
    idleTimer = setTimeout(() => setStatus('Away'), IDLE_TIMEOUT);
  };

  window.addEventListener('mousemove', resetIdle);
  window.addEventListener('keydown', resetIdle);
  window.addEventListener('click', resetIdle);

  return () => {
    clearTimeout(idleTimer);
    window.removeEventListener('mousemove', resetIdle);
    window.removeEventListener('keydown', resetIdle);
    window.removeEventListener('click', resetIdle);
  };
}, []);
```

### 3. Detección de Múltiples Tabs

```typescript
// BroadcastChannel API para detectar multiples sesiones
const channel = new BroadcastChannel('tad-status');
channel.postMessage({ type: 'online', tabId });

channel.onmessage = (event) => {
  if (event.data.type === 'online' && event.data.tabId !== tabId) {
    // Otro tab está activo — este tab se pone en segundo plano
    setActiveTab(false);
  }
};
```

---

## ⚙️ Fase 4: Servidor — CRON de Staleness

### Ticker cada 2 minutos

```typescript
// scripts/staleness-detector.ts
// Ejecutar via CRON en EasyPanel cada 2 minutos

import prisma from '@/lib/prisma';

async function detectStaleInterpreters() {
  const now = new Date();
  const awayTimeout = new Date(now.getTime() - 5 * 60 * 1000);  // 5 min
  const offlineTimeout = new Date(now.getTime() - 10 * 60 * 1000); // 10 min

  // Online → Away (sin heartbeat por 5 min)
  await prisma.interpreter.updateMany({
    where: {
      realtimeStatus: 'Online',
      lastHeartbeat: { lt: awayTimeout },
    },
    data: {
      realtimeStatus: 'Away',
      statusReason: 'inactivity_timeout',
      statusChangedAt: now,
    },
  });

  // Away → Offline (sin heartbeat por 10 min desde que se fue Away)
  await prisma.interpreter.updateMany({
    where: {
      realtimeStatus: 'Away',
      lastHeartbeat: { lt: offlineTimeout },
    },
    data: {
      realtimeStatus: 'Offline',
      lastOfflineAt: now,
      statusReason: 'heartbeat_timeout',
      statusChangedAt: now,
    },
  });

  // Busy sin heartbeat por 12 min → Offline forzado
  const busyTimeout = new Date(now.getTime() - 12 * 60 * 1000);
  await prisma.interpreter.updateMany({
    where: {
      realtimeStatus: 'Busy',
      lastHeartbeat: { lt: busyTimeout },
    },
    data: {
      realtimeStatus: 'Offline',
      lastOfflineAt: now,
      statusReason: 'heartbeat_timeout',
      statusChangedAt: now,
    },
  });
}
```

---

## 🖥️ Fase 5: Dashboard Admin — Monitoreo Inteligente

### Vista de Control en Vivo (monitoring/page.tsx)

```
┌─────────────────────────────────────────────────────┐
│  🟢 Control de Operaciones en Vivo                  │
│  ··· 12 Online  ··· 3 Busy  ··· 2 Away  ··· 5 Off │
├─────────────────────────────────────────────────────┤
│  [Online ▼]  [Search...                     🔍]     │
├─────────────────────────────────────────────────────┤
│ 🟢 Juan Pérez        Online · 45min  │ 📞 Busy 3min │
│ 🟡 María García      Away  · 7min    │ ⏰ Off 12min │
│ 🔴 Carlos López      Offline · 2h    │              │
│ 🟢 Ana Martínez      Online · 1h     │ 📞 Busy 8min │
│ ...                                                    │
└─────────────────────────────────────────────────────┘
```

### Componentes a crear/modificar

| Componente | Archivo | Función |
|---|---|---|
| `RealTimeMonitor` | `components/admin/RealTimeMonitor.tsx` | Grid en vivo con Supabase Presence |
| `StatusBadge` | `components/StatusBadge.tsx` | Indicador visual 🟢🟡🔴 con tooltip |
| `StatusTimeline` | `components/admin/StatusTimeline.tsx` | Timeline de cambios de estado |
| `StatusFilter` | `components/admin/StatusFilter.tsx` | Filtro por estado |
| `ActivityTracker` | `components/ActivityTracker.tsx` | Detección de inactividad (lado intérprete) |
| `HeartbeatProvider` | `components/HeartbeatProvider.tsx` | Heartbeat periódico |
| `PresenceBadge` | Mejorar el existente | Agregar tiempo desde última actividad |

### Fix crítico en monitoring.ts

```typescript
// ACTUAL (roto): no incluye realtimeStatus
select: { id: true, name: true, externalId: true, campaign: true, status: true }

// CORREGIDO:
select: {
  id: true, name: true, externalId: true, campaign: true,
  status: true, realtimeStatus: true, lastHeartbeat: true,
  statusChangedAt: true, statusReason: true,
}
```

---

## 📱 Fase 6: Notificaciones y Alertas

### Alertas para Admin

| Evento | Notificación | Método |
|---|---|---|
| Intérprete offline > 30 min laboral | Alerta en dashboard | Banner naranja |
| Intérprete offline > 2h en horario laboral | Push notification | Toast + sonido |
| Intérprete Busy por > 1h sin llamada activa | Advertencia | Estado inconsistente flag |
| Múltiples intérpretes offline simultáneos | Alerta de equipo | Dashboard aggregate |

### Auto-Remediación

- Si un intérprete está "Busy" pero no tiene call session activa → auto-corregir a "Online"
- Si un intérprete está "Online" pero no tiene heartbeat > 10 min → "Offline" forzado

---

## 🗓️ Roadmap de Implementación

### Sprint 1 (Inmediato — 1 día)

| # | Tarea | Archivo |
|---|---|---|
| 1.1 | Agregar campos a Prisma schema (`lastHeartbeat`, `lastActivity`, etc.) | `prisma/schema.prisma` |
| 1.2 | Crear modelo `InterpreterStatusLog` | `prisma/schema.prisma` |
| 1.3 | Fix `getLiveRosterAction` — incluir `realtimeStatus` | `src/app/actions/monitoring.ts` |
| 1.4 | Mejorar endpoint `api/presence` para heartbeat + lastActivity | `src/app/api/presence/route.ts` |
| 1.5 | Crear `HeartbeatProvider` component | `src/components/HeartbeatProvider.tsx` |

### Sprint 2 (Medio — 2-3 días)

| # | Tarea | Archivo |
|---|---|---|
| 2.1 | Crear `ActivityTracker` (detección inactividad) | `src/components/ActivityTracker.tsx` |
| 2.2 | Transiciones automáticas Busy ↔ Online en calls | `src/app/actions/calls.ts` |
| 2.3 | Mejorar `StatusBadge` con tooltip y tiempo | `src/components/StatusBadge.tsx` |
| 2.4 | beforeunload handler para detectar cierre de navegador | `src/components/HeartbeatProvider.tsx` |
| 2.5 | CRON job staleness detector | `scripts/staleness-detector.ts` |

### Sprint 3 (Dashboard — 2 días)

| # | Tarea | Archivo |
|---|---|---|
| 3.1 | `RealTimeMonitor` — grid en vivo con Supabase Presence | `src/components/admin/RealTimeMonitor.tsx` |
| 3.2 | Filtros por estado en admin panel | `src/app/admin/monitoring/page.tsx` |
| 3.3 | StatusTimeline — historial de cambios | `src/components/admin/StatusTimeline.tsx` |
| 3.4 | Estadísticas: Online / Busy / Away / Offline counts | `src/app/admin/monitoring/page.tsx` |

### Sprint 4 (Backend — 1 día)

| # | Tarea | Archivo |
|---|---|---|
| 4.1 | Registrar `statusChangedAt` en todas las transiciones | `src/app/actions/status.ts` |
| 4.2 | Logging a `InterpreterStatusLog` en cada cambio | `src/app/actions/status.ts` |
| 4.3 | API endpoint para historial de estado (`/api/v1/interpreters/:id/status-history`) | `interpreters-api/` |
| 4.4 | Admin override — cambiar estado manualmente | `src/app/actions/admin.ts` |

### Sprint 5 (Alertas — 1 día)

| # | Tarea | Archivo |
|---|---|---|
| 5.1 | Detección de offline prolongado en horario laboral | `scripts/staleness-detector.ts` |
| 5.2 | Dashboard alerts — banner para admins | `src/components/admin/AlertBanner.tsx` |
| 5.3 | Notificaciones in-app para eventos de estado | `src/lib/notifications.ts` |

---

## 📊 Impacto Esperado

| Métrica | Antes | Después |
|---|---|---|
| Tiempo para detectar intérprete offline | ∞ (nunca) | 30s–2 min |
| Confiabilidad del estado | Baja (manual) | Alta (automático) |
| Alertas de ausencia | Ninguna | En tiempo real |
| Historial de actividad | No existe | Auditoría completa |
| Cobertura de detección | Solo Online/Busy manual | 4 estados + transiciones automáticas |

---

## 💰 Costo de Implementación

| Componente | Esfuerzo | Prioridad |
|---|---|---|
| Prisma schema + migración | 30 min | 🔴 Alta |
| HeartbeatProvider | 1h | 🔴 Alta |
| ActivityTracker | 1h | 🔴 Alta |
| Fix monitoring.ts | 15 min | 🔴 Alta |
| CRON staleness detector | 1h | 🟠 Media |
| RealTimeMonitor dashboard | 3h | 🟠 Media |
| StatusTimeline | 1h | 🟡 Baja |
| Notificaciones | 2h | 🟡 Baja |
| BroadcastChannel multi-tab | 1h | 🟢 Nice-to-have |

**Total estimado:** ~12 horas de desarrollo

---

## 🔧 Próximo Paso

¿Querés que empiece a implementar el **Sprint 1** directamente? Empiezo con:
1. Migración Prisma (agregar campos + `InterpreterStatusLog`)
2. Fix del `getLiveRosterAction` en monitoring.ts
3. Mejorar endpoint `/api/presence`
4. Crear `HeartbeatProvider`
5. Crear `ActivityTracker`