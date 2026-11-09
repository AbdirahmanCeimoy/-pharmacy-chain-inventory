# Database Schema — Pharmacy Chain Inventory

> 21 tables across 8 migrations. MariaDB 10.4+ / MySQL 8+ with InnoDB.

## ER Diagram (Mermaid)

```mermaid
erDiagram
    branches ||--o{ users : "employs"
    branches ||--o{ branch_counters : "has"
    branches ||--o{ batches : "stores"
    branches ||--o{ stock_movements : "logs"
    branches ||--o{ sales : "records"
    branches ||--o{ purchase_orders : "creates"
    branches ||--o{ transfers : "sends from"
    branches ||--o{ stock_counts : "counts"

    users ||--o{ purchase_orders : "creates/approves"
    users ||--o{ sales : "cashiers"
    users ||--o{ audit_log : "performs"

    medicines ||--o{ batches : "tracked in"
    medicines ||--o{ purchase_order_items : "ordered as"
    medicines ||--o{ sale_items : "sold as"
    medicines ||--o{ stock_movements : "moved"
    medicines ||--o{ controlled_drug_register : "dispensed"

    suppliers ||--o{ purchase_orders : "supplies"

    purchase_orders ||--o{ purchase_order_items : "contains"
    sales ||--o{ sale_items : "contains"
    sale_items ||--o{ sale_batch_allocations : "allocated from"
    batches ||--o{ sale_batch_allocations : "sourced by"
    batches ||--o{ stock_movements : "audited by"

    sales ||--o{ returns : "returned via"
    returns ||--o{ return_items : "contains"

    transfers ||--o{ transfer_items : "contains"

    stock_counts ||--o{ stock_count_items : "counts"
    batches ||--o{ stock_count_items : "counted in"

    branches {
        int id PK
        varchar code UK
        varchar name
        varchar city
        varchar phone
        varchar address
        tinyint is_active
    }

    users {
        int id PK
        varchar full_name
        varchar email UK
        varchar password_hash
        enum role "OWNER|MANAGER|PHARMACIST"
        int branch_id FK
        tinyint is_active
        datetime last_login_at
    }

    branch_counters {
        int branch_id PK_FK
        int last_receipt_seq
        int last_po_seq
        int last_transfer_seq
    }

    medicines {
        int id PK
        varchar generic_name
        varchar brand_name
        enum form "TABLET|SYRUP|INJECTION|CAPSULE|CREAM|DROPS|OTHER"
        varchar strength
        varchar unit_label
        varchar category
        varchar barcode UK
        decimal selling_price
        tinyint is_controlled
        tinyint is_active
    }

    suppliers {
        int id PK
        varchar name
        varchar phone
        varchar address
        varchar payment_terms
        tinyint is_active
    }

    purchase_orders {
        int id PK
        varchar po_number UK
        int branch_id FK
        int supplier_id FK
        enum status "DRAFT|SUBMITTED|APPROVED|PARTIALLY_RECEIVED|RECEIVED|CLOSED|CANCELLED"
        decimal total_amount
        int created_by FK
        int approved_by FK
        datetime approved_at
    }

    purchase_order_items {
        int id PK
        int purchase_order_id FK
        int medicine_id FK
        int qty_ordered
        int qty_received
        decimal expected_unit_cost
    }

    batches {
        int id PK
        int medicine_id FK
        int branch_id FK
        varchar batch_number
        date expiry_date
        int qty_on_hand "CHECK >= 0"
        decimal unit_cost
        tinyint is_blocked
    }

    stock_movements {
        bigint id PK
        int batch_id FK
        int medicine_id FK
        int branch_id FK
        int qty_delta
        enum movement_type "RECEIVE|SALE|RETURN|TRANSFER_OUT|TRANSFER_IN|ADJUST|WRITE_OFF|EXPIRED"
        enum reference_type "PO|SALE|RETURN|TRANSFER|COUNT|SYSTEM"
        int reference_id
        int performed_by FK
        varchar note
        datetime created_at
    }

    sales {
        int id PK
        varchar receipt_no
        int branch_id FK
        int cashier_id FK
        enum payment_method "CASH|EVC_PLUS|ZAAD|E_DAHAB"
        decimal subtotal
        decimal total
        enum status "COMPLETED|VOIDED"
    }

    sale_items {
        int id PK
        int sale_id FK
        int medicine_id FK
        int qty
        decimal unit_price
        decimal line_total
    }

    sale_batch_allocations {
        int id PK
        int sale_item_id FK
        int batch_id FK
        int qty
        decimal unit_cost
    }

    returns {
        int id PK
        int sale_id FK
        int approved_by FK
        varchar reason
        decimal refund_amount
    }

    return_items {
        int id PK
        int return_id FK
        int sale_item_id FK
        int batch_id FK
        int qty
        tinyint is_write_off
    }

    transfers {
        int id PK
        varchar transfer_no UK
        int from_branch_id FK
        int to_branch_id FK
        enum status "REQUESTED|APPROVED|DISPATCHED|RECEIVED|CANCELLED"
        decimal total_value
        int requested_by FK
        int approved_by FK
        int dispatched_by FK
        int received_by FK
        varchar shortage_note
    }

    transfer_items {
        int id PK
        int transfer_id FK
        int medicine_id FK
        int qty_requested
        int qty_dispatched
        int qty_received
        int source_batch_id FK
        varchar dest_batch_number
        date dest_expiry_date
        decimal unit_cost
    }

    controlled_drug_register {
        bigint id PK
        int sale_id FK
        int medicine_id FK
        int batch_id FK
        int qty
        varchar prescription_number
        varchar doctor_name
        varchar patient_name
        int pharmacist_id FK
        int running_balance
    }

    stock_counts {
        int id PK
        int branch_id FK
        enum status "IN_PROGRESS|COMPLETED|CANCELLED"
        int started_by FK
    }

    stock_count_items {
        int id PK
        int stock_count_id FK
        int batch_id FK
        int system_qty
        int physical_qty
        int adjustment_qty
        enum reason "DAMAGED|LOST|COUNTING_ERROR|THEFT|EXPIRED|OTHER"
    }

    audit_log {
        bigint id PK
        int user_id FK
        varchar action
        varchar entity_type
        int entity_id
        json meta_json
        varchar ip_address
    }

    sms_outbox {
        bigint id PK
        varchar to_phone
        varchar body
        enum status "QUEUED|SENT|FAILED"
    }

    password_resets {
        bigint id PK
        int user_id FK
        varchar otp_hash
        int attempts
        tinyint used
        varchar reset_token_hash
        tinyint reset_token_used
        datetime expires_at
        datetime reset_expires_at
    }

    email_outbox {
        bigint id PK
        varchar to_email
        varchar subject
        text body
        enum status "QUEUED|SENT|FAILED"
    }
```

## Key Design Decisions

1. **FEFO Index** (`idx_batch_fefo`): `(medicine_id, branch_id, expiry_date, id)` — the POS `SELECT ... FOR UPDATE` walks this index in order, ensuring all concurrent transactions lock rows in the same sequence (no deadlocks).

2. **`sale_batch_allocations`**: links each sale line to the specific batch(es) it pulled from, recording the actual `unit_cost` at time of sale. This is how the profit report uses real batch cost, not average cost.

3. **`branch_counters`**: incremented inside the sale/PO/transfer transaction. If the transaction rolls back, the counter rolls back too — gap-free receipt numbers.

4. **`CHECK (qty_on_hand >= 0)`**: database-level guard. Even if the application logic has a bug, InnoDB will reject a negative stock update.

5. **Controlled Drug Register**: append-only. Migration 007 installs `BEFORE UPDATE` and `BEFORE DELETE` triggers that `SIGNAL SQLSTATE '45000'` — rows can never be modified or removed.

6. **Stock Count → POS Block**: while a `stock_count` is `IN_PROGRESS`, the POS service queries `stock_count_items` to find which medicines are being counted and refuses to sell them. This prevents the count from going stale mid-sale.
