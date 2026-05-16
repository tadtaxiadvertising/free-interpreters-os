# Business Logic & Calculation Engines

*Note: Some algorithms are pending exact confirmation from the business stakeholders [VER SECCIÓN DE PREGUNTAS]*

## 1. QA Scoring Logic

The QA Scorecard is divided into specific weighted categories.

**Formula:**
`Total Score = (Protocol * 0.20) + (Interpretation * 0.40) + (Language * 0.20) + (Service * 0.10) + (Technical * 0.10)`

**Critical Auto-Fail Rule:**
If `criticalError == true`, the `totalScore` is overridden to `0.00`, and `accionRequerida` automatically escalates to "Advertencia" or "Coaching".

## 2. Payroll Engine (Motor de Nómina)

The engine runs asynchronously and calculates pay based on minutes.

**Base Calculation (Consolidated):**

1. **Raw Minutes**: `totalMinutes = SUM(production_logs.interpretedMinutes) + SUM(call_sessions.duration_seconds / 60)`
2. **Verification Override**: If a supervisor sets `verifiedMinutes`, this value **replaces** the Raw Minutes for the `grossTotal` calculation.
3. **Gross Total**: `grossTotal = (verifiedMinutes ?? totalMinutes) * interpreter.tariffPerMinute`

The engine actively merges two data sources:

1. **Static Logs (`production_logs`)**: Historical records imported via CSV from external dialing platforms.
2. **Dynamic Logs (`call_sessions`)**: Real-time tracked sessions captured natively within the Free Interpreters OS platform via the Command Center.

**Adjustments:**

- `qualityBonus`: Calculated based on QA Score averages for the period (Threshold based).
- `incentivesTotal`: Manual bonus added by administrators for performance or special campaigns.
- `penalidades`: Flat fee for No-Shows or specific behavioral infractions.
- `transferDeduction`: Depends on `metodoPago`.
  - Banking (Local DR): Flat fee or free depending on the bank.
  - PayPal: 5% fee or as configured in `SystemConfig`.

**Net Total Formula:**
`netTotal = (grossTotal + qualityBonus + incentivesTotal) - (penalidades + transferDeduction)`

## 3. Recruitment Funnel (Máquina de Estados)

The candidate flows strictly through the following states:

1. **Aplicante**: Initial entry via webhook.
2. **Entrevista Agendada**: Triggered when a scheduling tool (Calendly/Cal.com) fires an event.
3. **Evaluación (Roleplay)**: Candidate takes the language/interpretation test.
4. **Rechazado** OR **Contratado**: Based on `resultRoleplay` and background checks.
5. *(System Action)*: If `Contratado`, an automated trigger creates a record in the `interpreters` table and provisions their external ID.

## 4. RBAC & Vault Logic (Control de Acceso)

The platform enforces strict role separation using NextAuth/Auth.js with a unified `RbacUser` schema.

1. **Admin (ADMIN)**: Has unrestricted access. Can view all interpreters, payroll, and moderate Vault accounts.
2. **Account Holder (HOLDER)**: Owns Vault accounts containing external platform credentials. Holders can securely assign their Vault accounts to specific Interpreters without revealing the underlying passwords (via encrypted transmission and secure proxying, currently in progress).
3. **Interpreter (INTERPRETER)**: Can only view their own performance metrics, shift schedules, and the specific Vault accounts assigned to them. They use the portal strictly for their daily operational needs.
