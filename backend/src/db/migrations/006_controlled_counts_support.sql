-- 006_controlled_counts_support.sql
-- controlled_drug_register: per-sale row for every controlled-drug dispense. Append-only;
--   update/delete blocked at DB level by triggers in 007.
-- stock_counts / stock_count_items: per-batch physical counts with reason-coded adjustments.
-- audit_log: who did what sensitive action (PO approved, price changed, transfer approved, sale voided).
-- sms_outbox: in-app queue for simulated SMS; adapter decides what to do with it.

CREATE TABLE controlled_drug_register (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_id             INT UNSIGNED NOT NULL,
  medicine_id         INT UNSIGNED NOT NULL,
  batch_id            INT UNSIGNED NOT NULL,
  qty                 INT UNSIGNED NOT NULL,
  prescription_number VARCHAR(60)  NOT NULL,
  doctor_name         VARCHAR(100) NOT NULL,
  patient_name        VARCHAR(100) NOT NULL,
  pharmacist_id       INT UNSIGNED NOT NULL,
  running_balance     INT NOT NULL,
  created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_cdr_sale   FOREIGN KEY (sale_id)       REFERENCES sales(id),
  CONSTRAINT fk_cdr_med    FOREIGN KEY (medicine_id)   REFERENCES medicines(id),
  CONSTRAINT fk_cdr_batch  FOREIGN KEY (batch_id)      REFERENCES batches(id),
  CONSTRAINT fk_cdr_pharm  FOREIGN KEY (pharmacist_id) REFERENCES users(id),
  INDEX idx_cdr_med_date (medicine_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE stock_counts (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  branch_id     INT UNSIGNED NOT NULL,
  status        ENUM('IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'IN_PROGRESS',
  started_by    INT UNSIGNED NOT NULL,
  started_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at  DATETIME NULL,
  CONSTRAINT fk_sc_branch FOREIGN KEY (branch_id)  REFERENCES branches(id),
  CONSTRAINT fk_sc_user   FOREIGN KEY (started_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE stock_count_items (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  stock_count_id  INT UNSIGNED NOT NULL,
  batch_id        INT UNSIGNED NOT NULL,
  system_qty      INT NOT NULL,
  physical_qty    INT NOT NULL,
  adjustment_qty  INT NOT NULL,
  reason          ENUM('DAMAGED','LOST','COUNTING_ERROR','THEFT','EXPIRED','OTHER') NOT NULL,
  note            VARCHAR(255),
  CONSTRAINT fk_sci_count FOREIGN KEY (stock_count_id) REFERENCES stock_counts(id) ON DELETE CASCADE,
  CONSTRAINT fk_sci_batch FOREIGN KEY (batch_id)       REFERENCES batches(id)
) ENGINE=InnoDB;

CREATE TABLE audit_log (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NULL,
  action      VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id   INT UNSIGNED NULL,
  meta_json   JSON NULL,
  ip_address  VARCHAR(45),
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_audit_user_date (user_id, created_at),
  INDEX idx_audit_entity    (entity_type, entity_id)
) ENGINE=InnoDB;

CREATE TABLE sms_outbox (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  to_phone   VARCHAR(20)  NOT NULL,
  body       VARCHAR(500) NOT NULL,
  status     ENUM('QUEUED','SENT','FAILED') NOT NULL DEFAULT 'QUEUED',
  queued_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at    DATETIME NULL
) ENGINE=InnoDB;
