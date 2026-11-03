-- 003_stock.sql
-- batches: where stock physically lives, one row per (medicine, branch, batch_number).
-- stock_movements: append-only audit of every quantity change.
--
-- idx_batch_fefo is deliberately (medicine_id, branch_id, expiry_date, id) because the
-- FEFO lock query SELECTs ... ORDER BY expiry_date, id FOR UPDATE on that exact column list.
-- The index guarantees the server returns rows in index order and acquires row locks in
-- a stable, deterministic sequence across all concurrent transactions. Two concurrent
-- sales of the same medicine walk the same locks in the same order → no deadlocks.

CREATE TABLE batches (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  medicine_id   INT UNSIGNED NOT NULL,
  branch_id     INT UNSIGNED NOT NULL,
  batch_number  VARCHAR(60)  NOT NULL,
  expiry_date   DATE         NOT NULL,
  qty_on_hand   INT          NOT NULL DEFAULT 0,
  unit_cost     DECIMAL(12,2) NOT NULL,
  received_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_blocked    TINYINT(1)   NOT NULL DEFAULT 0,
  CONSTRAINT fk_batch_med    FOREIGN KEY (medicine_id) REFERENCES medicines(id),
  CONSTRAINT fk_batch_branch FOREIGN KEY (branch_id)   REFERENCES branches(id),
  CONSTRAINT uq_batch        UNIQUE (medicine_id, branch_id, batch_number),
  CONSTRAINT chk_qty_nonneg  CHECK (qty_on_hand >= 0),
  INDEX idx_batch_fefo (medicine_id, branch_id, expiry_date, id),
  INDEX idx_batch_expiry (expiry_date)
) ENGINE=InnoDB;

CREATE TABLE stock_movements (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  batch_id        INT UNSIGNED NOT NULL,
  medicine_id     INT UNSIGNED NOT NULL,
  branch_id       INT UNSIGNED NOT NULL,
  qty_delta       INT          NOT NULL,
  movement_type   ENUM('RECEIVE','SALE','RETURN','TRANSFER_OUT','TRANSFER_IN','ADJUST','WRITE_OFF','EXPIRED') NOT NULL,
  reference_type  ENUM('PO','SALE','RETURN','TRANSFER','COUNT','SYSTEM') NOT NULL,
  reference_id    INT UNSIGNED NOT NULL,
  performed_by    INT UNSIGNED NOT NULL,
  note            VARCHAR(255),
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_mov_batch  FOREIGN KEY (batch_id)     REFERENCES batches(id),
  CONSTRAINT fk_mov_med    FOREIGN KEY (medicine_id)  REFERENCES medicines(id),
  CONSTRAINT fk_mov_branch FOREIGN KEY (branch_id)    REFERENCES branches(id),
  CONSTRAINT fk_mov_user   FOREIGN KEY (performed_by) REFERENCES users(id),
  INDEX idx_mov_batch       (batch_id),
  INDEX idx_mov_branch_date (branch_id, created_at),
  INDEX idx_mov_type_date   (movement_type, created_at)
) ENGINE=InnoDB;
