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

**Endpoint:** `POST /api/v1/logs/import`  
**Purpose:** Bulk upsert daily production minutes from the telephony system.

**Request Body (JSON Array):**

```json
{
  "records": [
    {
      "interpreterExternalId": "INT-001",
      "date": "2026-04-28",
      "interpretedMinutes": 240,
      "callsAttended": 45,
      "status": "Completed"
    }
  ]
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "importedCount": 1,
  "errors": []
}
```

## 3. Payroll Execution Engine

**Endpoint:** `POST /api/v1/payroll/calculate`  
**Purpose:** Calculates the payroll for a given period for all active interpreters.

**Request Body (JSON):**

```json
{
  "periodStart": "2026-04-01",
  "periodEnd": "2026-04-15"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "recordsCreated": 150,
  "totalPayoutUsd": 45000.50
}
```

*(Note: Requires Admin Bearer Token)*

---

## HTTP Status Codes

- **200 OK:** Request successful.
- **201 Created:** Resource successfully created.
- **400 Bad Request:** Missing fields or validation error (Zod).
- **401 Unauthorized:** Invalid API Key / Token.
- **404 Not Found:** Referenced entity (e.g., interpreter) does not exist.
- **500 Internal Server Error:** Database crash or execution timeout.
