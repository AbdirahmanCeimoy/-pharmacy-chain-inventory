-- 004_sales_and_returns.sql
-- sales + sale_items: one receipt, many lines.
-- sale_batch_allocations: for each sale line, which batch(es) it came from and at what cost.
-- This table is what makes an honest "profit per branch" possible — we never average batch cost.
-- returns + return_items: 7-day rule and controlled-drug block live in the service layer.

CREATE TABLE sales (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  receipt_no      VARCHAR(30) NOT NULL,
  branch_id       INT UNSIGNED NOT NULL,
  cashier_id      INT UNSIGNED NOT NULL,
  payment_method  ENUM('CASH','EVC_PLUS','ZAAD','E_DAHAB') NOT NULL,
  subtotal        DECIMAL(12,2) NOT NULL,
  total           DECIMAL(12,2) NOT NULL,
  status          ENUM('COMPLETED','VOIDED') NOT NULL DEFAULT 'COMPLETED',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sale_branch  FOREIGN KEY (branch_id)  REFERENCES branches(id),
  CONSTRAINT fk_sale_cashier FOREIGN KEY (cashier_id) REFERENCES users(id),
  UNIQUE KEY uq_receipt (branch_id, receipt_no),
  INDEX idx_sale_branch_date (branch_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE sale_items (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_id     INT UNSIGNED NOT NULL,
  medicine_id INT UNSIGNED NOT NULL,
  qty         INT UNSIGNED NOT NULL,
  unit_price  DECIMAL(12,2) NOT NULL,
  line_total  DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_si_sale FOREIGN KEY (sale_id)     REFERENCES sales(id) ON DELETE CASCADE,
  CONSTRAINT fk_si_med  FOREIGN KEY (medicine_id) REFERENCES medicines(id),
  INDEX idx_si_sale (sale_id)
) ENGINE=InnoDB;

CREATE TABLE sale_batch_allocations (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_item_id  INT UNSIGNED NOT NULL,
  batch_id      INT UNSIGNED NOT NULL,
  qty           INT UNSIGNED NOT NULL,
  unit_cost     DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_sba_si    FOREIGN KEY (sale_item_id) REFERENCES sale_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_sba_batch FOREIGN KEY (batch_id)     REFERENCES batches(id),
  INDEX idx_sba_item (sale_item_id)
) ENGINE=InnoDB;

CREATE TABLE returns (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_id        INT UNSIGNED NOT NULL,
  approved_by    INT UNSIGNED NOT NULL,
  reason         VARCHAR(255) NOT NULL,
  refund_amount  DECIMAL(12,2) NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ret_sale FOREIGN KEY (sale_id)     REFERENCES sales(id),
  CONSTRAINT fk_ret_user FOREIGN KEY (approved_by) REFERENCES users(id),
  INDEX idx_ret_sale (sale_id)
) ENGINE=InnoDB;

CREATE TABLE return_items (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  return_id     INT UNSIGNED NOT NULL,
  sale_item_id  INT UNSIGNED NOT NULL,
  batch_id      INT UNSIGNED NOT NULL,
  qty           INT UNSIGNED NOT NULL,
  is_write_off  TINYINT(1)   NOT NULL DEFAULT 0,
  CONSTRAINT fk_ri_ret   FOREIGN KEY (return_id)    REFERENCES returns(id) ON DELETE CASCADE,
  CONSTRAINT fk_ri_si    FOREIGN KEY (sale_item_id) REFERENCES sale_items(id),
  CONSTRAINT fk_ri_batch FOREIGN KEY (batch_id)     REFERENCES batches(id)
) ENGINE=InnoDB;
