# Data Model Dictionary (Single Source of Truth)

All tables are managed via Prisma and hosted in PostgreSQL.

## 1. `interpreters` (Master Roster)

The core table containing all interpreter details, tariffs, and operational statuses.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `Int` | `PK, Autoincrement` | Unique internal identifier |
| `externalId` | `String` | `UNIQUE` | Legacy or third-party system ID |
| `name` | `String` | `NOT NULL` | Full name |
| `status` | `String` | `Default: "Activo"` | Valid values: Activo, Training, Inactivo, Probation |
| `campaign` | `String?` | `NULLABLE` | Assigned campaign |
| `emailCorporativo` | `String?` | `UNIQUE` | Professional email |
| `tariffPerMinute` | `Decimal(10,2)` | `NOT NULL` | Base pay rate per interpreted minute |
| `monthlyGoal` | `Int` | `Default: 2000` | Target production minutes per month |
| `banco` | `String?` | `NULLABLE` | Bank name (e.g., Popular, BHD) |
| `tipoCuenta` | `String?` | `NULLABLE` | Ahorros, Corriente |
| `cedulaRnc` | `String?` | `NULLABLE` | DR Identification number |
| `metodoPago` | `String?` | `NULLABLE` | Transferencia, PayPal, etc. |
| `paymentFrequency` | `String?` | `Default: "Monthly"` | Frequency of payments (Monthly, Bi-weekly) |
| `paymentDay` | `String?` | `Default: "1"` | Specific day of the month for payment |

## 2. `production_logs` (Daily Metrics)

Stores shift records, exact connected times, and call statistics.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `Int` | `PK, Autoincrement` | Unique record ID |
| `interpreterId` | `Int` | `FK -> interpreters(id)` | Cascade on delete |
| `date` | `Date` | `NOT NULL` | Date of the shift |
| `connectedHours` | `Decimal(10,2)` | `NULLABLE` | Total system logged hours |
| `interpretedMinutes` | `Int` | `Default: 0` | Actual billed minutes |
| `callsAttended` | `Int` | `Default: 0` | Total calls handled |
| `adherence` | `Decimal(5,2)` | `NULLABLE` | Schedule adherence percentage |
| `status` | `String` | `NOT NULL` | E.g., Completed, No-Show, Late |
| `verifiedMinutes` | `Int?` | `NULLABLE` | Audited minutes after administrative review |

## 3. `qa_scores` (Quality Assurance)

Stores audit results tied directly to a specific production log/call.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `Int` | `PK, Autoincrement` | Unique score ID |
| `productionLogId` | `Int` | `UNIQUE, FK -> production_logs` | 1:1 Relationship |
| `interpreterId` | `Int` | `FK -> interpreters(id)` | Evaluated interpreter |
| `protocolScore` | `Decimal(5,2)` | `NULLABLE` | Weighs 20% |
| `interpretationScore` | `Decimal(5,2)` | `NULLABLE` | Weighs 40% |
| `languageScore` | `Decimal(5,2)` | `NULLABLE` | Weighs 20% |
| `serviceScore` | `Decimal(5,2)` | `NULLABLE` | Weighs 10% |
| `technicalScore` | `Decimal(5,2)` | `NULLABLE` | Weighs 10% |
| `criticalError` | `Boolean` | `Default: false` | If true, auto-fails the evaluation |

## 4. `payroll_records` (Calculated Payroll)

Immutable snapshots of calculated pay periods.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `PK, Cuid` | Secure identifier for transactions |
| `periodStart` | `Date` | `NOT NULL` | Cycle start date |
| `periodEnd` | `Date` | `NOT NULL` | Cycle end date |
| `interpreterId` | `Int` | `FK -> interpreters(id)` | Target interpreter |
| `totalMinutes` | `Int` | `NOT NULL` | Aggregated from `production_logs` |
| `verifiedMinutes` | `Int?` | `NULLABLE` | Manual override for payroll verification |
| `grossTotal` | `Decimal(10,2)` | `NOT NULL` | `totalMinutes * tariffPerMinute` |
| `qualityBonus` | `Decimal(10,2)` | `Default: 0` | Extra earnings from QA |
| `incentivesTotal` | `Decimal(10,2)` | `Default: 0` | Manual or calculated incentives |
| `penalidades` | `Decimal(10,2)` | `Default: 0` | Deductions (e.g., No-Shows) |
| `transferDeduction` | `Decimal(10,2)` | `Default: 0` | Wire fees based on `metodoPago` |
| `netTotal` | `Decimal(10,2)` | `NOT NULL` | `gross + bonus + incentives - penalidades - transfer` |
| `status` | `String` | `Default: "Pendiente"` | Pendiente, Procesando, Pagado, APPROVED, PAID |
| `transactionReference` | `String?` | `NULLABLE` | Bank transaction ID or reference number |
| `reconciliationHash` | `String?` | `UNIQUE` | Unique hash for financial integrity verification |
| `paidAt` | `DateTime?` | `NULLABLE` | Actual timestamp when payment was processed |
| `paymentDate` | `DateTime?` | `NULLABLE` | Scheduled or record date of payment |

## 5. `recruitment_candidates` (Pipeline Funnel)

Tracks applicants from ingestion to hiring.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `Int` | `PK, Autoincrement` | Pipeline ID |
| `email` | `String` | `UNIQUE` | Main contact and dedup key |
| `status` | `String` | `Default: "Aplicante"` | Aplicante, Entrevista, Rechazado, Contratado |
| `englishLevel` | `String?` | `NULLABLE` | C1, C2, etc. |
| `speedtestMbps` | `Int?` | `NULLABLE` | Upload/Download speed check |
| `resultRoleplay` | `Int?` | `NULLABLE` | Scored 0-100 |
| `fechaInicio` | `DateTime?` | `NULLABLE` | Expected start date if hired |

## 6. `call_sessions` (Real-time Timer)

Individual sessions tracked via the dashboard's Call Timer.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `Int` | `PK, Autoincrement` | Session ID |
| `interpreterId` | `Int` | `FK -> interpreters(id)` | Session owner |
| `startedAt` | `DateTime` | `NOT NULL` | Timer start |
| `endedAt` | `DateTime?` | `NULLABLE` | Timer end |
| `durationSeconds` | `Int?` | `NULLABLE` | Calculated delta |
| `callCost` | `Decimal` | `NULLABLE` | `durationMinutes * tariffSnapshot` |

## 7. `user_profiles` (System Users)

Extended profile linked to Supabase Auth and Roster.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `PK, UUID` | Linked to `auth.users.id` |
| `email` | `String` | `UNIQUE` | Auth email |
| `role` | `String` | `Default: "interpreter"` | admin, interpreter, qa, payroll |
| `onboardingComplete` | `Boolean` | `Default: false` | Interactive flow status |
| `termsAcceptedAt` | `DateTime?` | `NULLABLE` | Legal compliance timestamp |
| `bankName` | `String?` | `NULLABLE` | DR Banking details |
