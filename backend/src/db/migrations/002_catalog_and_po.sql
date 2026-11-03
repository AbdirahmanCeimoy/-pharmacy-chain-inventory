-- 002_catalog_and_po.sql
-- Medicine catalogue (HQ-controlled price), suppliers, purchase orders and PO items.
-- Rule enforced in service layer: PO total > 1000 requires HQ (OWNER) approval.

CREATE TABLE medicines (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  generic_name   VARCHAR(100) NOT NULL,
  brand_name     VARCHAR(100) NOT NULL,
  form           ENUM('TABLET','SYRUP','INJECTION','CAPSULE','CREAM','DROPS','OTHER') NOT NULL,
  strength       VARCHAR(40)  NOT NULL,
  unit_label     VARCHAR(40)  NOT NULL,
  category       VARCHAR(60),
  barcode        VARCHAR(40) NULL UNIQUE,
  selling_price  DECIMAL(12,2) NOT NULL,
  is_controlled  TINYINT(1)    NOT NULL DEFAULT 0,
  is_active      TINYINT(1)    NOT NULL DEFAULT 1,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_medicine_identity (generic_name, strength, form, brand_name),
  INDEX idx_medicines_name (generic_name)
) ENGINE=InnoDB;

CREATE TABLE suppliers (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(120) NOT NULL,
  phone          VARCHAR(20),
  address        VARCHAR(200),
  payment_terms  VARCHAR(60),
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE purchase_orders (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  po_number     VARCHAR(20) NOT NULL UNIQUE,
  branch_id     INT UNSIGNED NOT NULL,
  supplier_id   INT UNSIGNED NOT NULL,
  status        ENUM('DRAFT','SUBMITTED','APPROVED','PARTIALLY_RECEIVED','RECEIVED','CLOSED','CANCELLED')
                  NOT NULL DEFAULT 'DRAFT',
  total_amount  DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_by    INT UNSIGNED NOT NULL,
  approved_by   INT UNSIGNED NULL,
  approved_at   DATETIME NULL,
  notes         VARCHAR(500),
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_po_branch   FOREIGN KEY (branch_id)   REFERENCES branches(id),
  CONSTRAINT fk_po_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_po_creator  FOREIGN KEY (created_by)  REFERENCES users(id),
  CONSTRAINT fk_po_approver FOREIGN KEY (approved_by) REFERENCES users(id),
  INDEX idx_po_branch_status (branch_id, status)
) ENGINE=InnoDB;

CREATE TABLE purchase_order_items (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id   INT UNSIGNED NOT NULL,
  medicine_id         INT UNSIGNED NOT NULL,
  qty_ordered         INT UNSIGNED NOT NULL,
  qty_received        INT UNSIGNED NOT NULL DEFAULT 0,
  expected_unit_cost  DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_poi_po  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_poi_med FOREIGN KEY (medicine_id)       REFERENCES medicines(id),
  INDEX idx_poi_po (purchase_order_id)
) ENGINE=InnoDB;
