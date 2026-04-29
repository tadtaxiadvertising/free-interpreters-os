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
`grossTotal = (SUM(production_logs.interpretedMinutes) + SUM(call_sessions.duration_seconds / 60)) * interpreter.tariffPerMinute`

The engine actively merges two data sources:
1. **Static Logs (`production_logs`)**: Historical records imported via CSV from external dialing platforms.
2. **Dynamic Logs (`call_sessions`)**: Real-time tracked sessions captured natively within the Free Interpreters OS platform via the Command Center.

**Adjustments:**

- `qualityBonus`: [PENDING] How is this calculated? Is it a % of gross, or a flat rate if QA > 95%?
- `penalidades`: [PENDING] Flat fee for No-Shows? Deductions for critical errors?
- `transferDeduction`: Depends on `metodoPago`.
  - Example: PayPal = 5% fee? Wire Transfer = $15 flat? [PENDING DEFINITION]
- **Currency Conversion:** [PENDING] Is the tariff exclusively USD, or do we handle local currency conversions (COP, MXN, ARS) at billing time?

**Net Total Formula:**
`netTotal = (grossTotal + qualityBonus) - (penalidades + transferDeduction)`

## 3. Recruitment Funnel (Máquina de Estados)

The candidate flows strictly through the following states:

1. **Aplicante**: Initial entry via webhook.
2. **Entrevista Agendada**: Triggered when a scheduling tool (Calendly/Cal.com) fires an event.
3. **Evaluación (Roleplay)**: Candidate takes the language/interpretation test.
4. **Rechazado** OR **Contratado**: Based on `resultRoleplay` and background checks.
5. *(System Action)*: If `Contratado`, an automated trigger creates a record in the `interpreters` table and provisions their external ID.
