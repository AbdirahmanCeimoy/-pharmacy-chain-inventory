-- 005_transfers.sql
-- Inter-branch transfer with explicit in-transit state.
-- On DISPATCH: sender's batch decremented, TRANSFER_OUT movement written; dest batch NOT created.
-- On RECEIVE: receiver creates or merges a batch with the SAME batch_number/expiry/unit_cost,
--             and TRANSFER_IN movement is written.
-- Between DISPATCH and RECEIVE the stock belongs to neither branch's sellable inventory.

CREATE TABLE transfers (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  transfer_no     VARCHAR(30) NOT NULL UNIQUE,
  from_branch_id  INT UNSIGNED NOT NULL,
  to_branch_id    INT UNSIGNED NOT NULL,
  status          ENUM('REQUESTED','APPROVED','DISPATCHED','RECEIVED','CANCELLED') NOT NULL DEFAULT 'REQUESTED',
  total_value     DECIMAL(12,2) NOT NULL DEFAULT 0,
  requested_by    INT UNSIGNED NOT NULL,
  approved_by     INT UNSIGNED NULL,
  dispatched_by   INT UNSIGNED NULL,
  received_by     INT UNSIGNED NULL,
  shortage_note   VARCHAR(255),
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_t_from  FOREIGN KEY (from_branch_id) REFERENCES branches(id),
  CONSTRAINT fk_t_to    FOREIGN KEY (to_branch_id)   REFERENCES branches(id),
  CONSTRAINT fk_t_req   FOREIGN KEY (requested_by)   REFERENCES users(id),
  CONSTRAINT fk_t_appr  FOREIGN KEY (approved_by)    REFERENCES users(id),
  CONSTRAINT fk_t_disp  FOREIGN KEY (dispatched_by)  REFERENCES users(id),
  CONSTRAINT fk_t_recv  FOREIGN KEY (received_by)    REFERENCES users(id),
  CONSTRAINT chk_t_diff CHECK (from_branch_id <> to_branch_id)
) ENGINE=InnoDB;

CREATE TABLE transfer_items (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  transfer_id        INT UNSIGNED NOT NULL,
  medicine_id        INT UNSIGNED NOT NULL,
  qty_requested      INT UNSIGNED NOT NULL,
  qty_dispatched     INT UNSIGNED NOT NULL DEFAULT 0,
  qty_received       INT UNSIGNED NOT NULL DEFAULT 0,
  source_batch_id    INT UNSIGNED NULL,
  dest_batch_number  VARCHAR(60)  NULL,
  dest_expiry_date   DATE NULL,
  unit_cost          DECIMAL(12,2) NULL,
  CONSTRAINT fk_ti_t   FOREIGN KEY (transfer_id)     REFERENCES transfers(id) ON DELETE CASCADE,
  CONSTRAINT fk_ti_med FOREIGN KEY (medicine_id)     REFERENCES medicines(id),
  CONSTRAINT fk_ti_src FOREIGN KEY (source_batch_id) REFERENCES batches(id)
) ENGINE=InnoDB;
