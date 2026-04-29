# API Specification & Webhooks

All endpoints will be located under `/api/v1/` and executed as Next.js API Routes. They are designed for fast `< 10s` execution.

## 1. Recruitment Inbound Webhook

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

*(Note: Automatically protected by Supabase Auth and Admin Role checks)*

---

## HTTP Status Codes

- **200 OK:** Request successful.
- **201 Created:** Resource successfully created.
- **400 Bad Request:** Missing fields or validation error (Zod).
- **401 Unauthorized:** Invalid API Key / Token.
- **404 Not Found:** Referenced entity (e.g., interpreter) does not exist.
- **500 Internal Server Error:** Database crash or execution timeout.
