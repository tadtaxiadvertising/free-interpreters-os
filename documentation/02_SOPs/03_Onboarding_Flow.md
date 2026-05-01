# SOP 03 — Flujo de Onboarding del Intérprete

> **Versión:** 2.0
> **Última actualización:** 2026-05-01
> **Responsable:** Lead Architect
> **Aplica a:** Todo nuevo intérprete con `isFirstLogin === true`

---

## 1. Objetivo

Garantizar que cada nuevo intérprete complete un proceso de incorporación estructurado
que incluya la aceptación legal, la configuración de pagos y un tour funcional antes de
acceder al dashboard de producción.

---

## 2. Diagrama de Flujo

```mermaid
flowchart TD
    A[Intérprete inicia sesión por primera vez] --> B{¿onboardingComplete === true?}
    B -->|Sí| Z[Dashboard normal]
    B -->|No| C[OnboardingWizard se muestra como overlay]

    C --> D[PASO 1: Acuerdo Legal]
    D --> D1[El contrato se renderiza en un scroll box]
    D1 --> D2{¿El usuario scrolleó hasta el final?}
    D2 -->|No| D3[Botón 'Acepto' deshabilitado + indicador 'Desplázate']
    D3 --> D2
    D2 -->|Sí| D4[Botón 'Acepto los Términos' habilitado]
    D4 --> D5[Server Action: acceptTerms]
    D5 --> D6[Se graba signature_date y terms_accepted_at en user_profiles]

    D6 --> E[PASO 2: Datos de Pago RD]
    E --> E1[Formulario BankFormRD]
    E1 --> E2[Seleccionar Banco de lista enum RD]
    E2 --> E3[Ingresar No. de Cuenta]
    E3 --> E4[Ingresar Cédula / RNC]
    E4 --> E5[Seleccionar Tipo de Cuenta: Ahorro o Corriente]
    E5 --> E6{¿Todos los campos válidos?}
    E6 -->|No| E7[Botón 'Siguiente' deshabilitado]
    E7 --> E1
    E6 -->|Sí| E8[Server Action: saveBankingDetails]
    E8 --> E9[Se guardan bank_name, bank_account, bank_cedula, bank_account_type]

    E9 --> F[PASO 3: Tour Interactivo]
    F --> F1[Card 1: Temporizador de Llamadas — cómo iniciar/detener]
    F1 --> F2[Card 2: Tu Ranking — qué significa y cómo mejorar]
    F2 --> F3[Card 3: Registro Rápido — log manual de minutos]
    F3 --> F4[Card 4: Metas Mensuales — progreso y MTD]
    F4 --> F5[Botón '¡Empezar! 🚀']
    F5 --> F6[Server Action: completeOnboarding]
    F6 --> F7[Se marca onboarding_complete = true]

    F7 --> Z
```

---

## 3. Detalle por Paso

### 3.1 Paso 1 — Acuerdo Legal (Contrato de Confidencialidad)

**Archivo fuente:** `src/components/OnboardingWizard.tsx`

| Aspecto | Detalle |
|---|---|
| **Contenido** | Contrato de Prestación de Servicios (Freelance) con cláusulas de confidencialidad HIPAA |
| **Mecanismo de lectura forzada** | Scroll listener detecta cuando el usuario llega a ≤40px del final del contenedor |
| **Acción bloqueante** | El botón "Acepto los Términos" permanece `disabled` hasta que `hasScrolledToBottom === true` |
| **Persistencia** | `acceptTerms()` actualiza `terms_accepted_at` y `signature_date` en `user_profiles` vía Supabase Client |
| **Referencia documental** | `documentation/01_Administrative/01_Acuerdo_Confidencialidad.md` |

### 3.2 Paso 2 — Datos de Pago (Exclusivo Transferencia Bancaria RD)

**Archivo fuente:** `src/components/BankFormRD.tsx` (integrado en `OnboardingWizard`)

| Campo | Tipo | Validación | Ejemplo |
|---|---|---|---|
| Banco | `select` (enum) | Requerido, debe ser un banco RD válido | `Banreservas` |
| No. de Cuenta | `text` | Requerido, mín. 5 caracteres, solo numérico | `0123456789` |
| Cédula / RNC | `text` | Requerido, formato `XXX-XXXXXXX-X` | `001-1234567-8` |
| Tipo de Cuenta | `select` | Requerido: `Ahorro` o `Corriente` | `Ahorro` |

**Validaciones en cliente:**

- Todos los campos son obligatorios.
- El número de cuenta acepta solo dígitos.
- La cédula se valida con el formato dominicano (`/^\d{3}-\d{7}-\d{1}$/`).

**Validaciones en servidor:**

- `saveBankingDetails()` verifica que los 3 campos principales no estén vacíos.
- Sanitiza los valores con `.trim()` antes de guardarlos.

### 3.3 Paso 3 — Tour Interactivo

**Archivo fuente:** `src/components/OnboardingWizard.tsx` (sección tutorial)

El tour consiste en **4 tarjetas interactivas** que se expanden al hacer clic:

| # | Título | Descripción |
|---|---|---|
| 1 | ⏱️ Temporizador de Llamadas | Explica cómo usar el botón "Iniciar Llamada" y que el tiempo se registra incluso al cambiar de pestaña (Web Worker) |
| 2 | 📊 Tu Ranking | Describe el sistema de posiciones basado en minutos interpretados y su impacto en oportunidades |
| 3 | 💰 Registro Rápido | Indica cómo registrar minutos manualmente si se olvidó iniciar el temporizador |
| 4 | 🎯 Metas Mensuales | Explica que la meta se personaliza según el perfil y cómo alcanzar el 100% |

**Comportamiento:** El usuario debe hacer clic en al menos una tarjeta antes de que
el botón "¡Empezar!" se habilite (UX guidance, no bloqueo técnico).

---

## 4. Componentes Involucrados

| Componente | Archivo | Rol |
|---|---|---|
| `OnboardingGate` | `src/components/OnboardingGate.tsx` | Client-side gate que decide si mostrar el wizard |
| `OnboardingWizard` | `src/components/OnboardingWizard.tsx` | Wizard de 3 pasos con stepper visual |
| `BankFormRD` | `src/components/BankFormRD.tsx` | Formulario aislado de datos bancarios RD |
| `acceptTerms` | `src/app/actions/onboarding.ts` | Server Action — guarda fecha de firma |
| `saveBankingDetails` | `src/app/actions/onboarding.ts` | Server Action — guarda datos bancarios |
| `completeOnboarding` | `src/app/actions/onboarding.ts` | Server Action — marca onboarding completo |

---

## 5. Diagrama de Estados del Perfil

```mermaid
stateDiagram-v2
    [*] --> SinOnboarding: Registro completado
    SinOnboarding --> AcuerdoFirmado: acceptTerms()
    AcuerdoFirmado --> DatosBancarios: saveBankingDetails()
    DatosBancarios --> OnboardingCompleto: completeOnboarding()
    OnboardingCompleto --> [*]: Dashboard habilitado
```

---

## 6. Criterios de Aceptación

- [ ] El wizard se muestra **solo** cuando `onboarding_complete === false`.
- [ ] El botón "Acepto" se habilita **solo** cuando el scroll llega al final.
- [ ] Los datos bancarios son **obligatorios** — no se puede saltar al paso 3 sin completarlos.
- [ ] Al completar el onboarding, el wizard se oculta **inmediatamente** sin recargar la página.
- [ ] Los datos persisten en la base de datos — un refresh no reinicia el proceso.
