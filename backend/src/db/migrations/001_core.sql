-- 001_core.sql
-- Core identity: branches, users, per-branch sequential counters.
-- Every stock-affecting table later FKs to branches so queries filter cheaply.

CREATE TABLE branches (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(10)  NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  city        VARCHAR(60)  NOT NULL,
  phone       VARCHAR(20),
  address     VARCHAR(200),
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('OWNER','MANAGER','PHARMACIST') NOT NULL,
  branch_id     INT UNSIGNED NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  INDEX idx_users_role_branch (role, branch_id)
) ENGINE=InnoDB;

-- Per-branch counters used to generate gap-free, human-readable numbers.
-- Each counter is incremented inside the same transaction as the record it labels,
-- so a rolled-back sale/PO/transfer rolls back its counter too.
CREATE TABLE branch_counters (
  branch_id          INT UNSIGNED NOT NULL PRIMARY KEY,
  last_receipt_seq   INT UNSIGNED NOT NULL DEFAULT 0,
  last_po_seq        INT UNSIGNED NOT NULL DEFAULT 0,
  last_transfer_seq  INT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_bc_branch FOREIGN KEY (branch_id) REFERENCES branches(id)
) ENGINE=InnoDB;
