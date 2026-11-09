# API Reference

Base URL: `http://localhost:4000`

All endpoints except Health and Password Reset require `Authorization: Bearer <jwt>`.

Error responses follow this shape:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description",
  "details": {}
}
```

Common error codes: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `INTERNAL_ERROR` (500).

---

## Health

### `GET /api/health`

Liveness probe. No auth required.

**Response 200**

```json
{
  "status": "ok",
  "service": "pharmacy-chain-inventory",
  "timestamp": "2026-11-08T10:00:00.000Z"
}
```

---

## Auth

### `POST /api/auth/login`

Authenticate a user and receive a JWT token.

- **Auth:** None
- **Rate limit:** Global rate limiter applies

**Request body**

```json
{
  "email": "owner@pharmacy.so",
  "password": "Owner@123"
}
```

| Field      | Type   | Required | Notes              |
|------------|--------|----------|--------------------|
| `email`    | string | Yes      | Valid email address |
| `password` | string | Yes      | Min 1 character    |

**Response 200**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "fullName": "Abdirahman Owner",
    "email": "owner@pharmacy.so",
    "role": "OWNER",
    "branchId": null,
    "branchName": null
  }
}
```

**Errors:** 401 `UNAUTHORIZED` — invalid credentials.

---

### `GET /api/auth/me`

Return the currently authenticated user.

- **Auth:** Any role
- **Response 200:** `{ "user": { id, fullName, email, role, branchId, branchName } }`

---

### `POST /api/auth/forgot-password`

Request a password reset. Always returns `{status: "ok"}` regardless of whether the email exists (prevents user enumeration).

- **Auth:** None
- **Rate limit:** 10 requests per 15 minutes per IP

**Request body**

```json
{ "email": "owner@pharmacy.so" }
```

**Response 200**

```json
{
  "status": "ok",
  "message": "If an account exists for that email, a verification code has been sent."
}
```

**Business rules:**
- 6-digit OTP generated and sent via mock email adapter
- OTP expires in 5 minutes
- Max 3 reset requests per 15 minutes per account

---

### `POST /api/auth/verify-otp`

Verify the 6-digit OTP code and receive a one-shot reset token.

- **Auth:** None
- **Rate limit:** 10 requests per 15 minutes per IP

**Request body**

```json
{
  "email": "owner@pharmacy.so",
  "otp": "301440"
}
```

| Field   | Type   | Required | Notes                    |
|---------|--------|----------|--------------------------|
| `email` | string | Yes      | Valid email               |
| `otp`   | string | Yes      | Exactly 6 digits          |

**Response 200**

```json
{
  "status": "ok",
  "resetToken": "a1b2c3d4e5f6..."
}
```

**Errors:** 401 after 5 wrong attempts (OTP locked). 401 if OTP expired.

---

### `POST /api/auth/reset-password`

Set a new password using the reset token from verify-otp.

- **Auth:** None
- **Rate limit:** 10 requests per 15 minutes per IP

**Request body**

```json
{
  "email": "owner@pharmacy.so",
  "resetToken": "a1b2c3d4e5f6...",
  "newPassword": "NewPass@456"
}
```

| Field          | Type   | Required | Notes                                    |
|----------------|--------|----------|------------------------------------------|
| `email`        | string | Yes      | Valid email                              |
| `resetToken`   | string | Yes      | 64-char hex token from verify-otp        |
| `newPassword`  | string | Yes      | Min 8 chars, at least one letter + digit |

**Response 200:** `{ "status": "ok" }`

**Errors:** 401 invalid or expired token.

---

## Branches

### `GET /api/branches`

List all branches (read-only, for dropdowns and pickers).

- **Auth:** Any role

**Response 200**

```json
{
  "items": [
    {
      "id": 1,
      "code": "MOG-01",
      "name": "Mogadishu Main",
      "city": "Mogadishu",
      "phone": "+252612345678",
      "isActive": true
    }
  ]
}
```

---

## Medicines

All medicine endpoints require authentication.

### `GET /api/medicines`

List medicines with optional search and filters.

- **Auth:** Any role

**Query parameters**

| Param    | Type   | Default | Notes                              |
|----------|--------|---------|------------------------------------|
| `q`      | string | —       | Search by generic/brand name       |
| `active` | string | —       | `"true"` or `"false"`              |
| `limit`  | number | 100     | Max 500                            |
| `offset` | number | 0       | Pagination offset                  |

**Response 200**

```json
{
  "items": [
    {
      "id": 1,
      "genericName": "Amoxicillin",
      "brandName": "Amoxil",
      "form": "CAPSULE",
      "strength": "500 mg",
      "unitLabel": "Box of 21",
      "category": "Antibiotic",
      "barcode": null,
      "sellingPrice": "5.50",
      "isControlled": false,
      "isActive": true,
      "createdAt": "2026-11-03T10:00:00.000Z"
    }
  ]
}
```

---

### `GET /api/medicines/:id`

Get a single medicine by ID.

- **Auth:** Any role
- **Response 200:** `{ "medicine": { ... } }`
- **Errors:** 404 `NOT_FOUND`

---

### `POST /api/medicines`

Create a new medicine in the catalogue.

- **Auth:** OWNER only

**Request body**

```json
{
  "generic_name": "Amoxicillin",
  "brand_name": "Amoxil",
  "form": "CAPSULE",
  "strength": "500 mg",
  "unit_label": "Box of 21",
  "category": "Antibiotic",
  "barcode": null,
  "selling_price": 5.50,
  "is_controlled": false
}
```

| Field           | Type    | Required | Notes                                                    |
|-----------------|---------|----------|----------------------------------------------------------|
| `generic_name`  | string  | Yes      | 1–100 chars                                              |
| `brand_name`    | string  | Yes      | 1–100 chars                                              |
| `form`          | enum    | Yes      | TABLET, SYRUP, INJECTION, CAPSULE, CREAM, DROPS, OTHER  |
| `strength`      | string  | Yes      | 1–40 chars (e.g. "500 mg")                               |
| `unit_label`    | string  | Yes      | 1–40 chars (e.g. "Box of 21")                            |
| `category`      | string  | No       | Up to 60 chars                                           |
| `barcode`       | string  | No       | Up to 40 chars                                           |
| `selling_price` | number  | Yes      | Positive, max 999999. HQ-controlled price for all branches |
| `is_controlled` | boolean | No       | Default false. Controlled drugs require prescription at POS |

**Response 201:** `{ "medicine": { ... } }`

**Business rules:**
- `generic_name + strength + form + brand_name` must be unique (DB constraint). Duplicate returns 409.
- `selling_price` is set by HQ and applies to all branches.

---

### `PATCH /api/medicines/:id`

Update medicine fields.

- **Auth:** OWNER only
- **Request body:** Any subset of the fields from POST
- **Response 200:** `{ "medicine": { ... } }`

---

### `POST /api/medicines/:id/deactivate`

Soft-delete a medicine (set `is_active = false`).

- **Auth:** OWNER only
- **Response 200:** `{ "medicine": { ... } }`
- **Business rule:** Blocked if any batch still has `qty_on_hand > 0`. Returns 409 `CONFLICT`.

---

### `POST /api/medicines/:id/reactivate`

Re-enable a deactivated medicine.

- **Auth:** OWNER only
- **Response 200:** `{ "medicine": { ... } }`

---

## Suppliers

All supplier endpoints require authentication.

### `GET /api/suppliers`

List suppliers with optional search.

- **Auth:** Any role

**Query parameters:** Same as medicines (`q`, `active`, `limit`, `offset`).

**Response 200**

```json
{
  "items": [
    {
      "id": 1,
      "name": "Hormuud Pharma",
      "phone": "+252615551234",
      "address": "Bakaaraha, Mogadishu",
      "paymentTerms": "Net 30",
      "isActive": true,
      "createdAt": "2026-11-03T10:00:00.000Z"
    }
  ]
}
```

---

### `GET /api/suppliers/:id`

- **Auth:** Any role
- **Response 200:** `{ "supplier": { ... } }`

### `POST /api/suppliers`

- **Auth:** OWNER only

**Request body**

```json
{
  "name": "Hormuud Pharma",
  "phone": "+252615551234",
  "address": "Bakaaraha, Mogadishu",
  "payment_terms": "Net 30"
}
```

| Field           | Type   | Required | Notes         |
|-----------------|--------|----------|---------------|
| `name`          | string | Yes      | 1–120 chars   |
| `phone`         | string | No       | Up to 20 chars|
| `address`       | string | No       | Up to 200 chars|
| `payment_terms` | string | No       | Up to 60 chars|

**Response 201:** `{ "supplier": { ... } }`

### `PATCH /api/suppliers/:id`

- **Auth:** OWNER only
- **Request body:** Any subset of POST fields

### `POST /api/suppliers/:id/deactivate`

- **Auth:** OWNER only

### `POST /api/suppliers/:id/reactivate`

- **Auth:** OWNER only

---

## Purchase Orders

All PO endpoints require authentication.

### `GET /api/purchase-orders`

List purchase orders with optional filters.

- **Auth:** OWNER sees all; MANAGER sees own branch only; PHARMACIST has no access.

**Query parameters**

| Param     | Type   | Notes                                                              |
|-----------|--------|--------------------------------------------------------------------|
| `status`  | enum   | DRAFT, SUBMITTED, APPROVED, PARTIALLY_RECEIVED, RECEIVED, CLOSED, CANCELLED |
| `branchId`| number | Filter by branch (OWNER only)                                     |
| `q`       | string | Search by PO number                                               |
| `limit`   | number | Default 100, max 500                                              |
| `offset`  | number | Default 0                                                         |

**Response 200**

```json
{
  "items": [
    {
      "id": 1,
      "poNumber": "PO-MOG01-000001",
      "branchId": 1,
      "branchCode": "MOG-01",
      "branchName": "Mogadishu Main",
      "supplierId": 1,
      "supplierName": "Hormuud Pharma",
      "status": "DRAFT",
      "totalAmount": "1500.00",
      "createdBy": 2,
      "createdByName": "Abdi Manager",
      "approvedBy": null,
      "notes": null,
      "createdAt": "2026-11-08T10:00:00.000Z"
    }
  ]
}
```

---

### `GET /api/purchase-orders/:id`

Get PO with its line items.

- **Auth:** OWNER or own-branch MANAGER
- **Response 200:** `{ "purchaseOrder": { ...header, items: [...] } }`

---

### `POST /api/purchase-orders`

Create a new purchase order (status: DRAFT).

- **Auth:** MANAGER, OWNER

**Request body**

```json
{
  "branch_id": 1,
  "supplier_id": 1,
  "notes": "Monthly restock",
  "items": [
    {
      "medicine_id": 1,
      "qty_ordered": 100,
      "expected_unit_cost": 3.50
    }
  ]
}
```

| Field               | Type   | Required | Notes                      |
|---------------------|--------|----------|----------------------------|
| `branch_id`         | number | No       | OWNER must specify; MANAGER defaults to own branch |
| `supplier_id`       | number | Yes      | Must exist and be active   |
| `notes`             | string | No       | Up to 500 chars            |
| `items`             | array  | Yes      | 1–200 items                |
| `items[].medicine_id` | number | Yes    | Must exist and be active   |
| `items[].qty_ordered` | number | Yes    | Positive integer, max 100000 |
| `items[].expected_unit_cost` | number | Yes | Positive, max 999999 |

**Response 201:** `{ "purchaseOrder": { ... } }`

---

### `POST /api/purchase-orders/:id/submit`

Submit a draft PO for approval.

- **Auth:** MANAGER, OWNER

**Business rules:**
- **Auto-approval:** If `totalAmount <= $1,000`, status jumps directly to APPROVED.
- **HQ approval required:** If `totalAmount > $1,000`, status moves to SUBMITTED and awaits OWNER approval.
- Writes an audit log entry.

**Response 200:** `{ "purchaseOrder": { ... } }`

---

### `POST /api/purchase-orders/:id/approve`

HQ approves a submitted PO.

- **Auth:** OWNER only
- **Precondition:** PO must be in SUBMITTED status
- **Response 200:** `{ "purchaseOrder": { ... } }`
- **Errors:** 409 if not in SUBMITTED status

---

### `POST /api/purchase-orders/:id/cancel`

Cancel a PO.

- **Auth:** MANAGER, OWNER
- **Precondition:** PO must be in DRAFT, SUBMITTED, or APPROVED status (cannot cancel after receiving begins)
- **Response 200:** `{ "purchaseOrder": { ... } }`

---

### `POST /api/purchase-orders/:id/receive`

Receive goods against an approved PO (goods receiving).

- **Auth:** MANAGER, OWNER
- **Precondition:** PO must be APPROVED or PARTIALLY_RECEIVED

**Request body**

```json
{
  "allow_short_expiry": false,
  "items": [
    {
      "po_item_id": 1,
      "qty": 50,
      "batch_number": "BATCH-2026-A",
      "expiry_date": "2027-06-15",
      "actual_unit_cost": 3.25
    }
  ]
}
```

| Field                    | Type    | Required | Notes                                      |
|--------------------------|---------|----------|--------------------------------------------|
| `allow_short_expiry`     | boolean | No       | Default false. Override 3-month expiry check |
| `items`                  | array   | Yes      | 1–200 items                                |
| `items[].po_item_id`     | number  | Yes      | Must match a line in this PO               |
| `items[].qty`            | number  | Yes      | Positive, max 1000000                      |
| `items[].batch_number`   | string  | Yes      | 1–60 chars                                 |
| `items[].expiry_date`    | string  | Yes      | YYYY-MM-DD format                          |
| `items[].actual_unit_cost`| number | Yes      | Positive, max 999999                       |

**Business rules:**
- **110% cap:** Cumulative received qty cannot exceed `qty_ordered × 1.10`.
- **3-month expiry:** Expiry must be ≥ 90 days from today, unless `allow_short_expiry: true` (manager override).
- **Batch merge:** If a batch with the same `(medicine, branch, batch_number)` already exists, its `qty_on_hand` is incremented.
- **PO status auto-update:** All lines fully received → RECEIVED. Some received → PARTIALLY_RECEIVED.
- Creates a `RECEIVE` stock movement for each line.

**Response 200:** `{ "purchaseOrder": { ... } }`

---

## Batches (Expiry Dashboard)

### `GET /api/batches`

List stock batches with filters.

- **Auth:** Any role (OWNER sees all; others see own branch)

**Query parameters**

| Param            | Type   | Notes                              |
|------------------|--------|------------------------------------|
| `branchId`       | number | Filter by branch (OWNER only)      |
| `medicineId`     | number | Filter by medicine                 |
| `maxDaysToExpiry` | number | Show batches expiring within N days |
| `includeExpired` | string | `"true"` or `"false"` (default true) |
| `limit`          | number | Default 200, max 500               |
| `offset`         | number | Default 0                          |

**Response 200**

```json
{
  "items": [
    {
      "id": 1,
      "medicineId": 1,
      "medicine": {
        "genericName": "Amoxicillin",
        "brandName": "Amoxil",
        "form": "CAPSULE",
        "strength": "500 mg",
        "unitLabel": "Box of 21"
      },
      "branchId": 1,
      "branchCode": "MOG-01",
      "branchName": "Mogadishu Main",
      "batchNumber": "BATCH-2026-A",
      "expiryDate": "2027-03-15",
      "daysToExpiry": 127,
      "qtyOnHand": 50,
      "unitCost": "3.25",
      "stockValue": "162.50",
      "isBlocked": false,
      "receivedAt": "2026-11-03T10:00:00.000Z"
    }
  ]
}
```

---

### `GET /api/batches/expiry-summary`

Aggregated expiry summary grouped into 30/60/90 day buckets.

- **Auth:** Any role (branch-scoped for non-OWNER)

**Query parameters:** `branchId` (optional, OWNER only)

**Response 200**

```json
{
  "summary": {
    "buckets": [
      { "label": "≤ 30 days", "count": 3, "totalQty": 150, "totalValue": "487.50" },
      { "label": "31–60 days", "count": 5, "totalQty": 300, "totalValue": "975.00" },
      { "label": "61–90 days", "count": 2, "totalQty": 80, "totalValue": "260.00" }
    ],
    "expired": { "count": 1, "totalQty": 20, "totalValue": "65.00" }
  }
}
```

**UI color coding:** Red (≤30 days), Orange (31–60), Yellow (61–90).

---

## POS / Sales

### `POST /api/pos/sales`

Create a new sale. This is the **core technical challenge** endpoint implementing FEFO and race-safe concurrency.

- **Auth:** PHARMACIST, MANAGER, OWNER

**Request body**

```json
{
  "branch_id": 1,
  "payment_method": "CASH",
  "customer_phone": "+252612345678",
  "items": [
    {
      "medicine_id": 1,
      "qty": 5,
      "prescription": {
        "prescription_number": "RX-2026-001",
        "doctor_name": "Dr. Axmed",
        "patient_name": "Faadumo Cali"
      }
    }
  ]
}
```

| Field                  | Type   | Required | Notes                                      |
|------------------------|--------|----------|--------------------------------------------|
| `branch_id`            | number | No       | OWNER must specify; others default to own branch |
| `payment_method`       | enum   | Yes      | CASH, EVC_PLUS, ZAAD, E_DAHAB             |
| `customer_phone`       | string | No       | For SMS receipt (simulated)                |
| `items`                | array  | Yes      | 1–50 items                                 |
| `items[].medicine_id`  | number | Yes      | Must be active                             |
| `items[].qty`          | number | Yes      | Positive integer, max 100000               |
| `items[].prescription` | object | Conditional | **Required** for controlled drugs        |

**Prescription fields** (required when medicine `is_controlled = true`):

| Field                 | Type   | Required |
|-----------------------|--------|----------|
| `prescription_number` | string | Yes      |
| `doctor_name`         | string | Yes      |
| `patient_name`        | string | Yes      |

**FEFO Algorithm (core technical challenge — 25 points):**

1. Cart items sorted by `medicine_id ASC` for deterministic lock order (prevents deadlocks).
2. Transaction opened with deadlock-aware retry (up to 3 retries).
3. For each medicine: `SELECT ... FROM batches WHERE medicine_id=? AND branch_id=? AND qty_on_hand > 0 AND expiry_date > CURDATE() ORDER BY expiry_date ASC, id ASC FOR UPDATE`
4. Walk batches earliest-expiry-first, deducting `take = min(remaining, batch.qty_on_hand)`.
5. `UPDATE batches SET qty_on_hand = qty_on_hand - ? WHERE id = ? AND qty_on_hand >= ?` (defensive guard — stock never goes negative).
6. If total available < requested → ROLLBACK → 409 OUT_OF_STOCK.
7. Insert sale + sale_items + sale_batch_allocations + stock_movements (one per batch tapped).
8. Controlled drugs: compute running balance and insert into `controlled_drug_register`.
9. Payment adapter charge (mock) — rollback if fails.
10. COMMIT.
11. Best-effort SMS after commit (failure never undoes the sale).

**Concurrency guarantee:** Two cashiers selling the last unit simultaneously — `SELECT ... FOR UPDATE` serializes them. The second transaction sees `qty_on_hand = 0` after the first commits, and returns 409 OUT_OF_STOCK. Stock **never** goes negative.

**Response 201**

```json
{
  "sale": {
    "id": 1,
    "receiptNo": "MOG01-000001",
    "branchId": 1,
    "branchCode": "MOG-01",
    "cashierId": 3,
    "cashierName": "Faarax Pharmacist",
    "paymentMethod": "CASH",
    "subtotal": "27.50",
    "total": "27.50",
    "status": "COMPLETED",
    "createdAt": "2026-11-08T10:00:00.000Z",
    "items": [
      {
        "id": 1,
        "medicineId": 1,
        "medicine": { "genericName": "Amoxicillin", "brandName": "Amoxil", "form": "CAPSULE", "strength": "500 mg", "unitLabel": "Box of 21", "isControlled": false },
        "qty": 5,
        "unitPrice": "5.50",
        "lineTotal": "27.50",
        "allocations": [
          { "id": 1, "batchId": 1, "batchNumber": "BATCH-2026-A", "expiryDate": "2027-03-15", "qty": 3, "unitCost": "3.25" },
          { "id": 2, "batchId": 2, "batchNumber": "BATCH-2026-B", "expiryDate": "2027-09-20", "qty": 2, "unitCost": "3.50" }
        ]
      }
    ]
  }
}
```

**Errors:**
- 409 `OUT_OF_STOCK` — insufficient stock (includes `requested` and `available` in details)
- 409 `COUNT_IN_PROGRESS` — medicine is under stock count, sales blocked
- 409 `CONFLICT` — inactive medicine
- 403 `FORBIDDEN` — controlled drug sold by non-PHARMACIST, or wrong branch
- 400 `VALIDATION_ERROR` — missing prescription for controlled drug

---

### `GET /api/pos/sales`

List sales.

- **Auth:** Any role (OWNER sees all; others see own branch)

**Query parameters:** `branchId`, `limit` (default 50), `offset`

**Response 200:** `{ "items": [{ id, receiptNo, branchId, branchCode, cashierId, cashierName, paymentMethod, subtotal, total, status, createdAt }] }`

---

### `GET /api/pos/sales/:id`

Get a sale by ID with full items and batch allocations.

- **Auth:** Any role (branch-scoped for non-OWNER)
- **Response 200:** `{ "sale": { ... } }` (same shape as POST response)

---

### `GET /api/pos/receipts/:receiptNo`

Look up a sale by its receipt number.

- **Auth:** Any role
- **Query:** `branchId` (required for OWNER)
- **Response 200:** `{ "sale": { ... } }`
- **Business rule:** Reprints include the full sale data. The frontend marks reprints with a COPY stamp.

---

## Returns

### `GET /api/returns`

List returns.

- **Auth:** Any role (branch-scoped for non-OWNER)
- **Query:** `branchId`, `limit`, `offset`
- **Response 200:** `{ "items": [...] }`

### `GET /api/returns/:id`

- **Auth:** Any role (branch-scoped)
- **Response 200:** `{ "return": { ... } }`

### `POST /api/returns`

Process a return against an original sale receipt.

- **Auth:** MANAGER, OWNER (manager approval built-in)

**Request body**

```json
{
  "receipt_no": "MOG01-000001",
  "branch_id": 1,
  "reason": "Wrong medication dispensed",
  "items": [
    { "sale_item_id": 1, "qty": 2 }
  ]
}
```

| Field                 | Type   | Required | Notes                                |
|-----------------------|--------|----------|--------------------------------------|
| `receipt_no`          | string | Yes      | Must match an existing sale          |
| `branch_id`           | number | No       | OWNER must specify                   |
| `reason`              | string | Yes      | 1–255 chars                          |
| `items`               | array  | Yes      | 1–50 items                           |
| `items[].sale_item_id`| number | Yes      | Must belong to the referenced sale   |
| `items[].qty`         | number | Yes      | Positive, max 100000                 |

**Business rules:**
- **7-day window:** Return must be within 7 days of the original sale. Returns 409 after.
- **Controlled drugs cannot be returned.** Returns 409.
- **Return qty capped:** Cannot exceed `original_qty - already_returned_qty`.
- **Batch restock:** If the originating batch is still valid (not expired), stock is returned to that batch. If expired, the return is written off (`WRITE_OFF` movement).
- Creates `RETURN` or `WRITE_OFF` stock_movements per allocation.

**Response 201:** `{ "return": { ... } }`

---

## Inter-Branch Transfers

### `GET /api/transfers`

List transfers.

- **Auth:** Any role (branch-scoped for non-OWNER)
- **Query:** `branchId`, `status`, `limit`, `offset`
- **Response 200:** `{ "items": [...] }`

### `GET /api/transfers/:id`

- **Auth:** Any role (branch-scoped)
- **Response 200:** `{ "transfer": { ... } }`

### `POST /api/transfers`

Create a transfer request (requesting branch asks for stock from another branch).

- **Auth:** MANAGER, OWNER

**Request body**

```json
{
  "from_branch_id": 1,
  "to_branch_id": 2,
  "items": [
    { "medicine_id": 1, "qty_requested": 20 }
  ]
}
```

| Field                     | Type   | Required | Notes               |
|---------------------------|--------|----------|----------------------|
| `from_branch_id`          | number | Yes      | Source branch         |
| `to_branch_id`            | number | Yes      | Destination branch    |
| `items`                   | array  | Yes      | 1–100 items           |
| `items[].medicine_id`     | number | Yes      | Must exist            |
| `items[].qty_requested`   | number | Yes      | Positive, max 100000  |

**Business rules:**
- **Auto-approval:** If estimated total value ≤ $500, status jumps to APPROVED.
- **HQ approval:** If > $500, stays at REQUESTED until OWNER approves.

**Response 201:** `{ "transfer": { ... } }`

---

### `POST /api/transfers/:id/approve`

HQ approves a transfer request.

- **Auth:** OWNER only
- **Precondition:** Status must be REQUESTED
- **Response 200:** `{ "transfer": { ... } }`

---

### `POST /api/transfers/:id/dispatch`

Dispatch stock from the source branch. Uses FEFO to pick source batches.

- **Auth:** MANAGER (source branch), OWNER
- **Precondition:** Status must be APPROVED
- **Business rules:**
  - Picks one source batch per item via FEFO.
  - Creates `TRANSFER_OUT` stock movement at the source branch.
  - Stock is "in transit" — not sellable by either branch.
  - Batch number and expiry are preserved for the destination.
- **Response 200:** `{ "transfer": { ... } }`

---

### `POST /api/transfers/:id/receive`

Receive stock at the destination branch.

- **Auth:** MANAGER (destination branch), OWNER
- **Precondition:** Status must be DISPATCHED

**Request body**

```json
{
  "items": [
    { "transfer_item_id": 1, "qty_received": 18 }
  ],
  "shortage_note": "2 units damaged in transit"
}
```

| Field                        | Type   | Required | Notes                              |
|------------------------------|--------|----------|------------------------------------|
| `items`                      | array  | Yes      | 1+ items                          |
| `items[].transfer_item_id`   | number | Yes      | Must match a dispatched item       |
| `items[].qty_received`       | number | Yes      | 0 to qty_dispatched               |
| `shortage_note`              | string | No       | Up to 255 chars. Alerts HQ if shortage detected |

**Business rules:**
- Creates or merges batch at destination with same batch_number/expiry/unit_cost.
- Creates `TRANSFER_IN` stock movement at destination.
- Shortages (qty_received < qty_dispatched) are logged and alert HQ.

**Response 200:** `{ "transfer": { ... } }`

---

### `POST /api/transfers/:id/cancel`

Cancel a transfer request.

- **Auth:** MANAGER, OWNER
- **Precondition:** Status must be REQUESTED or APPROVED (cannot cancel after dispatch)
- **Response 200:** `{ "transfer": { ... } }`

---

## Reorder Suggestions

### `GET /api/reorder-suggestions`

Get medicines that need reordering based on sales velocity.

- **Auth:** Any role

**Query parameters:** `branchId` (required for OWNER)

**Response 200**

```json
{
  "branchId": 1,
  "items": [
    {
      "medicineId": 1,
      "genericName": "Amoxicillin",
      "brandName": "Amoxil",
      "form": "CAPSULE",
      "strength": "500 mg",
      "unitLabel": "Box of 21",
      "sellingPrice": "5.50",
      "currentStock": 10,
      "avgDaily": 2.5,
      "daysCover": 4.0,
      "suggestedQty": 75
    }
  ]
}
```

**Business rules:**
- `avg_daily` = total units sold in last 30 days ÷ 30
- **Threshold:** If `days_cover < 14`, the medicine appears in suggestions
- `suggested_qty` = ceil(avg_daily × 30) — enough for 30-day cover
- **No sales in 30 days → not suggested** (avg_daily = 0 is excluded)

---

## Reports

### `GET /api/reports/dashboard`

Dashboard summary with KPIs.

- **Auth:** Any role (OWNER sees all branches; others see own branch)

**Response 200**

```json
{
  "todayRevenue": "1250.00",
  "todayUnits": 45,
  "lowStockCount": 3,
  "expiringIn30": 5,
  "pendingPOs": 2
}
```

---

### `GET /api/reports/profit`

Profit per branch — revenue minus actual batch cost (not average cost).

- **Auth:** Any role (branch-scoped for non-OWNER)

**Query parameters**

| Param     | Type   | Default    | Notes                          |
|-----------|--------|------------|--------------------------------|
| `branchId`| number | —          | Filter by branch (OWNER only)  |
| `from`    | string | -30 days   | YYYY-MM-DD start date          |
| `to`      | string | today      | YYYY-MM-DD end date            |
| `groupBy` | string | `"day"`    | `"day"` or `"month"`           |

**Response 200**

```json
{
  "rows": [
    {
      "period": "2026-11-08",
      "branchId": 1,
      "branchCode": "MOG-01",
      "revenue": "250.00",
      "cost": "150.00",
      "profit": "100.00"
    }
  ],
  "totals": {
    "revenue": "1250.00",
    "cost": "750.00",
    "profit": "500.00"
  }
}
```

**Business rules:**
- Cost is the **actual batch cost** of the specific units sold (via `sale_batch_allocations`), not an average.
- Returns reduce both revenue and cost on the original sale's period.

---

### `GET /api/reports/expiry-loss`

Expiry/write-off loss report — cost of expired and written-off stock.

- **Auth:** Any role (branch-scoped for non-OWNER)

**Query parameters:** `branchId`, `from`, `to`

**Response 200**

```json
{
  "monthly": [
    { "period": "2026-11", "branchId": 1, "branchCode": "MOG-01", "totalLoss": "325.00" }
  ],
  "topMedicines": [
    { "medicineId": 5, "genericName": "Cetirizine", "brandName": "Zyrtec", "totalLoss": "150.00" }
  ],
  "grandTotal": "325.00"
}
```

**Business rules:**
- Sums `qty × unit_cost` from `EXPIRED` and `WRITE_OFF` stock_movements.
- Months without losses show `$0.00`.
- Top 10 medicines by total loss value.

---

## Stock Counts

### `GET /api/stock-counts`

List stock counts.

- **Auth:** Any role (branch-scoped for non-OWNER)
- **Query:** `branchId`, `status`, `limit`, `offset`
- **Response 200:** `{ "items": [...] }`

### `GET /api/stock-counts/:id`

Get stock count with all item lines.

- **Auth:** Any role (branch-scoped)
- **Response 200:** `{ "stockCount": { ...header, items: [...] } }`

### `POST /api/stock-counts`

Start a new stock count (snapshots current batch quantities).

- **Auth:** MANAGER, OWNER

**Request body**

```json
{
  "branch_id": 1,
  "medicine_ids": [1, 2, 3]
}
```

| Field          | Type        | Required | Notes                                             |
|----------------|-------------|----------|----------------------------------------------------|
| `branch_id`    | number      | No       | OWNER must specify; MANAGER defaults to own branch |
| `medicine_ids` | number[]    | No       | Optional — omit to count all medicines with stock  |

**Business rules:**
- Creates an IN_PROGRESS count and snapshots `qty_on_hand` for every batch at the branch (optionally filtered by `medicine_ids`).
- **POS sales are blocked** for all medicines covered by the count until it is submitted or cancelled.

**Response 201:** `{ "stockCount": { ... } }`

---

### `POST /api/stock-counts/:id/submit`

Submit count results with physical quantities.

- **Auth:** MANAGER, OWNER
- **Precondition:** Status must be IN_PROGRESS

**Request body**

```json
{
  "items": [
    {
      "stock_count_item_id": 1,
      "physical_qty": 48,
      "reason": "DAMAGED",
      "note": "2 boxes water damaged"
    }
  ]
}
```

| Field                        | Type   | Required    | Notes                                           |
|------------------------------|--------|-------------|-------------------------------------------------|
| `items`                      | array  | Yes         | 1+ items                                        |
| `items[].stock_count_item_id`| number | Yes         | Must belong to this count                        |
| `items[].physical_qty`       | number | Yes         | 0 to 1000000                                     |
| `items[].reason`             | enum   | Conditional | Required if adjustment ≠ 0. DAMAGED, LOST, COUNTING_ERROR, THEFT, EXPIRED, OTHER |
| `items[].note`               | string | No          | Up to 255 chars                                  |

**Business rules:**
- `adjustment_qty = physical_qty - system_qty`
- `batches.qty_on_hand` is set to `physical_qty`
- Non-zero adjustments create `ADJUST` stock_movement with the reason code.
- Count marked COMPLETED. POS sales unblocked for those medicines.

**Response 200:** `{ "stockCount": { ... } }`

---

### `POST /api/stock-counts/:id/cancel`

Cancel an in-progress count (no adjustments made).

- **Auth:** MANAGER, OWNER
- **Precondition:** Status must be IN_PROGRESS
- **Effect:** Count marked CANCELLED. POS sales unblocked.
- **Response 200:** `{ "stockCount": { ... } }`

---

## Global Security

| Feature               | Implementation                                              |
|-----------------------|-------------------------------------------------------------|
| Password hashing      | bcryptjs, 10 rounds                                        |
| Authentication         | JWT (HS256), 12h expiry, `Authorization: Bearer` header    |
| Role enforcement       | Server-side `requireRole()` middleware on every protected route |
| Input validation       | Zod schemas on every POST/PATCH body and query parameter   |
| Rate limiting          | express-rate-limit: 100 req/min global, 10/15min for password reset |
| Security headers       | helmet (CSP, HSTS, X-Frame-Options, etc.)                  |
| CORS                   | Locked to configured origin in production                  |
| Audit logging          | Sensitive actions (PO submit/approve/cancel, stock adjustments) logged to audit_log table |
| Secrets                | All in `.env`, never in source. `.env.example` provided    |
