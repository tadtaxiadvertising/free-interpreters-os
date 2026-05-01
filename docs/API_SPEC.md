# API Specification & Webhooks

> **Service**: `interpreters-api` (Backend)  
> **Base URL**: `https://api.freeinterpreters.com` (production) / `http://localhost:4000` (local)  
> **Auth**: All endpoints require a valid Supabase `Authorization: Bearer <token>` header unless marked as public.

All endpoints reside and execute **exclusively** in the `interpreters-api` service. The Frontend (`interpreters`) communicates with these endpoints via `NEXT_PUBLIC_API_URL`. Endpoints are designed for fast `< 10s` execution.

## Dynamic Routes in Next.js 16.2.4

> **Critical**: Based on the updated architecture, all dynamic API routes (e.g., `[id]`) must handle parameters asynchronously.

```typescript
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  // ...
}
```

## 1. Interpreters Roster

### 1.1 List Interpreters

**Endpoint:** `GET /api/interpreters`  
**Purpose:** Fetch the list of all interpreters for the roster.  
**Query Params:**

- `status` (optional): Filter by status (e.g., `Activo`, `Inactivo`).
- `search` (optional): Search by name, ID, or campaign.

**Response (200 OK):**

```json
[
  {
    "id": 1,
    "name": "Jane Doe",
    "externalId": "INT-001",
    "status": "Activo",
    "campaign": "HealthCare",
    "tariffPerMinute": 0.15
  }
]
```

### 1.2 Add Interpreter

**Endpoint:** `POST /api/interpreters`  
**Purpose:** Create a new interpreter record.  
**Request Body:** (Validated by `InterpreterSchema`)

```json
{
  "name": "John Smith",
  "externalId": "INT-002",
  "emailCorporativo": "john@freeinterpreters.com",
  "tariffPerMinute": 0.12,
  "status": "Activo"
}
```

**Endpoint:** `POST /api/v1/webhooks/recruitment`  
**Purpose:** Triggered by Typeform/Google Forms/Make when a new candidate applies.

**Request Body (JSON):**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "telefono": "+123456789",
  "pais": "Colombia",
  "fuente": "LinkedIn"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "candidateId": 101,
  "status": "Aplicante"
}
```

## 2. Production Logs Ingestion

**Endpoint:** `POST /api/import/csv`  
**Purpose:** Bulk upsert daily production minutes from the telephony system via CSV file upload.

**Request Body (FormData):**

- `file`: CSV file containing columns for `name`, `minutes`, `date`, `externalId`.

**Response (200 OK):**

```json
{
  "success": true,
  "importedCount": 42,
  "errors": []
}
```

## 3. Payroll Execution Engine

**Implementation:** `Server Action` (`src/app/actions/payroll.ts -> generatePayrollAction`)  
**Purpose:** Calculates the payroll for a given period for all active interpreters, merging historical CSV logs and live `call_sessions`.

**Function Signature (TypeScript):**

```typescript
export async function generatePayrollAction(
  periodStart: Date, 
  periodEnd: Date
): Promise<{ success: boolean; recordsCreated?: number; error?: string }>
```

> [!NOTE]
> Automatically protected by Supabase Auth and Admin Role checks

---

## HTTP Status Codes

- **200 OK:** Request successful.
- **201 Created:** Resource successfully created.
- **400 Bad Request:** Missing fields or validation error (Zod).
- **401 Unauthorized:** Invalid API Key / Token.
- **404 Not Found:** Referenced entity (e.g., interpreter) does not exist.
- **500 Internal Server Error:** Database crash or execution timeout.
