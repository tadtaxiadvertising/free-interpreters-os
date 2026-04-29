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
| `languageA` | `String` | `Default: "Español"` | Primary language |
| `languageB` | `String` | `Default: "Inglés"` | Secondary language |
| `tariffPerMinute` | `Decimal(10,2)` | `NOT NULL` | Base pay rate per interpreted minute |
| `metodoPago` | `String?` | `NULLABLE` | PayPal, Bank Transfer, Payoneer, USDT |
| `cuentaPago` | `String?` | `NULLABLE` | Account details for payroll |

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
| `grossTotal` | `Decimal(10,2)` | `NOT NULL` | `totalMinutes * tariffPerMinute` |
| `qualityBonus` | `Decimal(10,2)` | `Default: 0` | Extra earnings from QA |
| `penalidades` | `Decimal(10,2)` | `Default: 0` | Deductions (e.g., No-Shows) |
| `transferDeduction` | `Decimal(10,2)` | `Default: 0` | Wire fees based on `metodoPago` |
| `netTotal` | `Decimal(10,2)` | `NOT NULL` | `gross + bonus - penalidades - transfer` |
| `status` | `String` | `Default: "Pendiente"` | Pendiente, Procesando, Pagado |

## 5. `recruitment_candidates` (Pipeline Funnel)

Tracks applicants from ingestion to hiring.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `Int` | `PK, Autoincrement` | Pipeline ID |
| `email` | `String` | `UNIQUE` | Main contact and dedup key |
| `status` | `String` | `Default: "Aplicante"` | Aplicante, Entrevista, Rechazado, Contratado |
| `englishLevel` | `String?` | `NULLABLE` | C1, C2, etc. |
| `resultRoleplay` | `Int?` | `NULLABLE` | Scored 0-100 |
| `fechaInicio` | `DateTime?` | `NULLABLE` | Expected start date if hired |
